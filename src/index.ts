import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { getClient, getLastProcessedBlock, queuePingEvent, releaseClient, updateWatcherState } from './db';

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
  
  try {
    // Process in batches of BATCH_SIZE blocks
    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += BATCH_SIZE) {
      const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
      
      const logs = await fetchLogs(provider, contractAddress, currentBlock, batchEndBlock);
      console.log(`Found ${logs.length} events in batch from ${currentBlock} to ${batchEndBlock}`);

      for (const log of logs) {
        await queuePingEvent(
          log.transactionHash,
          Math.floor(Date.now() / 1000),
          parseInt(log.blockNumber, 16)
        );
      }

      // Always update the last processed block after each batch
      if (logs.length === 0) {
        const client = await getClient();
        await updateWatcherState(batchEndBlock,client).finally(() => releaseClient(client))
      }
    }
  } catch (error) {
    console.error('Error processing historical events:', error);
    throw error;
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
      await queuePingEvent('', 0,startBlockNumber - 1).finally(() => releaseClient(client))
      lastProcessedBlock = startBlockNumber - 1;
    }

    // Catch up processing if needed
    if (lastProcessedBlock < currentBlock) {
      console.log(`Catching up from block ${lastProcessedBlock + 1} to ${currentBlock}`);
      await processHistoricalEvents(provider, contractAddress, lastProcessedBlock + 1, currentBlock);
    }

    console.log(`Starting to watch for Ping events on contract: ${contractAddress}`);
    
    // Watch for new blocks
    provider.on('block', async (blockNumber: number) => {
      try {
        console.log(`Processing block: ${blockNumber}`);
        
        const logs = await fetchLogs(provider, contractAddress, blockNumber, blockNumber);
        
        for (const log of logs) {
          console.log(`
            New Ping Event Detected!
            Transaction Hash: ${log.transactionHash}
            Block Number: ${log.blockNumber}
          `);

          await queuePingEvent(
            log.transactionHash,
            Math.floor(Date.now() / 1000),
            blockNumber
          );
        }

        // Always update the last processed block
        if (logs.length === 0) {
          const client = await getClient();
          await updateWatcherState(blockNumber,client).finally(() => releaseClient(client))
        }

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

// Start the server
main().catch((error) => {
  console.error('Error in main:', error);
  process.exit(1);
}); 

