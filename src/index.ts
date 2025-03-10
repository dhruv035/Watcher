import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getClient, getLastProcessedBlock, queuePingEvent, releaseClient, updateWatcherState } from './db';
import { PoolClient } from 'pg';

dotenv.config();

const BATCH_SIZE = 10000;
const PING_EVENT_SIGNATURE = ethers.id("Ping()");

// Validate environment variables
function validateEnv() {
  const required = ['SEPOLIA_RPC_URL', 'CONTRACT_ADDRESS', 'START_BLOCK_NUMBER'];
  for (const req of required) {
    if (!process.env[req]) {
      throw new Error(`Please set ${req} in .env file`);
    }
  }
}

async function fetchLogs(
  provider: ethers.JsonRpcProvider,
  contractAddress: string,
  fromBlock: number,
  toBlock: number
) {
  console.log(`Fetching logs from block ${fromBlock} to ${toBlock}`);
  
  try {
    // Use eth_getLogs directly for better control
    const logs = await provider.send("eth_getLogs", [{
      address: contractAddress,
      fromBlock: ethers.toBeHex(fromBlock),
      toBlock: ethers.toBeHex(toBlock),
      topics: [
        PING_EVENT_SIGNATURE
      ]
    }]);

    return logs;
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
}


async function processHistoricalEvents(
  provider: ethers.JsonRpcProvider,
  contractAddress: string,
  fromBlock: number,
  toBlock: number
) {
  console.log(`Processing historical events from block ${fromBlock} to ${toBlock}`);
  
  const client = await getClient();
  try {
    // Process in batches of BATCH_SIZE blocks
    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += BATCH_SIZE) {
      const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
      await processBatch(client,provider,contractAddress,currentBlock,batchEndBlock)
    }
  } catch (error) {
    console.error('Error processing historical events:', error);
    throw error;
  } finally {
    await releaseClient(client)
  }
}

async function main() {
  try {
    validateEnv();

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contractAddress = process.env.CONTRACT_ADDRESS!;
    const startBlockNumber = parseInt(process.env.START_BLOCK_NUMBER!);
    
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${currentBlock}`);

    let lastProcessedBlock = await getLastProcessedBlock();
    console.log(`Last processed block: ${lastProcessedBlock}`);
    
    // Initialize watcher state if it doesn't exist
    if (lastProcessedBlock === null) {
      console.log(`Initializing watcher state at block ${startBlockNumber - 1}`);
      const client = await getClient();
      await queuePingEvent('',startBlockNumber - 1,client).finally(() => releaseClient(client))
      lastProcessedBlock = startBlockNumber - 1;
    }

    // Catch up processing if needed
    if (lastProcessedBlock < currentBlock) {
      console.log(`Catching up from block ${lastProcessedBlock + 1} to ${currentBlock}`);
      await processHistoricalEvents(provider, contractAddress, Number(lastProcessedBlock) + 1, currentBlock);
    }

    console.log(`Starting to watch for Ping events on contract: ${contractAddress}`);
    
    // Watch for new blocks
    provider.on('block', async (blockNumber: number) => {
      try {
        console.log(`Processing block: ${blockNumber}`);
        
        const logs = await fetchLogs(provider, contractAddress, blockNumber, blockNumber);
        const client = await getClient();
        client.query('BEGIN');
        for (const log of logs) {
          console.log(`
            New Ping Event Detected!
            Transaction Hash: ${log.transactionHash}
            Block Number: ${log.blockNumber}
          `);

          await queuePingEvent(
            log.transactionHash,
            blockNumber,
            client
          );
        }

        await updateWatcherState(blockNumber,client)
        await client.query('COMMIT')
        await releaseClient(client)

        // Always update the last processed block
      

      } catch (error) {
        console.error('Error processing block:', error);
      }
    });

    // Handle provider errors
    provider.on('error', (error: Error) => {
      console.error('Provider Error:', error);
    });

  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

const processBatch = async (client: PoolClient,provider: ethers.JsonRpcProvider,contractAddress: string,startBlock: number,endBlock: number) => {
  try {
    client.query('BEGIN');
    const logs = await fetchLogs(provider, contractAddress, startBlock, endBlock);
    for (const log of logs) {
      await queuePingEvent(log.transactionHash,log.blockNumber,client)
    }
    await updateWatcherState(endBlock,client)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } 
}
// Start the server
main().catch((error) => {
  console.error('Error in main:', error);
  process.exit(1);
}); 

