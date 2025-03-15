
import dotenv from "dotenv";
import { EventLogger } from "./eventLogger";
dotenv.config();



// const BATCH_SIZE = 10000;

// // Validate environment variables
function validateEnv() {
  const required = [
    "SEPOLIA_RPC_URL",
    "CONTRACT_ADDRESS",
    "START_BLOCK_NUMBER",
  ];
  for (const req of required) {
    if (!process.env[req]) {
      throw new Error(`Please set ${req} in .env file`);
    }
  }
}

// async function fetchLogs(
//   client: PublicClient,
//   contractAddress: string,
//   fromBlock: number,
//   toBlock: number
// ) {
//   console.log(`Fetching logs from block ${fromBlock} to ${toBlock}`);

//   try {

//     const PingEvent = getAbiItem({
//       abi,
//       name: "Ping",
//     });
//     const logs = await client.getLogs({
//       address: contractAddress as `0x${string}`,
//       fromBlock: BigInt(fromBlock),
//       toBlock: BigInt(toBlock),
//       event: PingEvent as AbiEvent,
//     });

//     return logs;
//   } catch (error) {
//     console.error("Error fetching logs:", error);
//     throw error;
//   }
// }

// async function processHistoricalEvents(
//   clientViem: PublicClient,
//   contractAddress: string,
//   fromBlock: number,
//   toBlock: number
// ) {
//   console.log(
//     `Processing historical events from block ${fromBlock} to ${toBlock}`
//   );

//   const client = await getClient();
//   try {
//     // Process in batches of BATCH_SIZE blocks
//     for (
//       let currentBlock = fromBlock;
//       currentBlock <= toBlock;
//       currentBlock += BATCH_SIZE
//     ) {
//       const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
//       await processBatch(
//         client,
//         clientViem,
//         contractAddress,
//         currentBlock,
//         batchEndBlock
//       );
//     }
//   } catch (error) {
//     console.error("Error processing historical events:", error);
//     throw error;
//   } finally {
//     await releaseClient(client);
//   }
// }

async function main() {
  const logger = new EventLogger();
  try {
    validateEnv();
    
    try{
      await logger.run();
    } catch (error) {
      console.error("Error in main:", error);
      process.exit(1);
    }

  } catch (error) {
    console.error("Error in main:", error);
    logger.shutdown();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error in main:", error);
  process.exit(1);
});


//OLD MAIN {

  //   const clientViem = createPublicClient({
  //     chain: sepolia,
  //     transport: webSocket(process.env.SEPOLIA_RPC_URL!),
  //   });
  //   const contractAddress = process.env.CONTRACT_ADDRESS!;
  //   const startBlockNumber = parseInt(process.env.START_BLOCK_NUMBER!);

  //   const currentBlock = await clientViem.getBlockNumber();
  //   console.log(`Current block number: ${currentBlock}`);

  //   let lastProcessedBlock = await getLastProcessedBlock();
  //   console.log(`Last processed block: ${lastProcessedBlock}`);

  //   // Initialize watcher state if it doesn't exist
  //   if (lastProcessedBlock === null) {
  //     console.log(
  //       `Initializing watcher state at block ${startBlockNumber - 1}`
  //     );
  //     const client = await getClient();
  //     await queuePingEvent("", startBlockNumber - 1, client).finally(() =>
  //       releaseClient(client)
  //     );
  //     lastProcessedBlock = startBlockNumber - 1;
  //   }

  //   // Catch up processing if needed
  //   if (lastProcessedBlock < currentBlock) {
  //     console.log(
  //       `Catching up from block ${lastProcessedBlock + 1} to ${currentBlock}`
  //     );
  //     await processHistoricalEvents(
  //       clientViem,
  //       contractAddress,
  //       Number(lastProcessedBlock) + 1,
  //       Number(currentBlock)
  //     );
  //   }

  //   console.log(
  //     `Starting to watch for Ping events on contract: ${contractAddress}`
  //   );

  //   // Watch for new blocks
  //   const PingEvent = getAbiItem({
  //     abi,
  //     name: "Ping",
  //   });
  //   const eventFilter =  clientViem.createEventFilter({
  //    event: PingEvent as AbiEvent,
  //    address: contractAddress as `0x${string}`,
  //   });

    

  //   const unwatch = clientViem.watchBlocks({
  //     poll:false,
  //     onBlock: async (block:  Block) => {
  //       const blockNumber = Number(block.number);
  //       try {
  //         console.log(`Processing block: ${blockNumber}`);
  
  //         const logs = await fetchLogs(
  //           clientViem,
  //           contractAddress,
  //           blockNumber,
  //           blockNumber
  //         );
  //         const client = await getClient();
  //         client.query("BEGIN");
  //         for (const log of logs) {
  //           console.log(`
  //             New Ping Event Detected!
  //             Transaction Hash: ${log.transactionHash}
  //             Block Number: ${log.blockNumber}
  //           `);
  
  //           await queuePingEvent(log.transactionHash, blockNumber, client);
  //         }
  
  //         await updateWatcherState(blockNumber, client);
  //         await client.query("COMMIT");
  //         await releaseClient(client);
  
  //         // Always update the last processed block
  //       } catch (error) {
  //         console.error("Error processing block:", error);
  //       }
  //     },
  //   });
//}
// const processBatch = async (
//   client: PoolClient,
//   clientViem: PublicClient,
//   contractAddress: string,
//   startBlock: number,
//   endBlock: number
// ) => {
//   try {
//     client.query("BEGIN");
//     const logs = await fetchLogs(
//       clientViem,
//       contractAddress,
//       startBlock,
//       endBlock
//     );
//     for (const log of logs) {
//       await queuePingEvent(log.transactionHash, Number(log.blockNumber), client);
//     }
//     await updateWatcherState(endBlock, client);
//     await client.query("COMMIT");
//   } catch (error) {
//     await client.query("ROLLBACK");
//     throw error;
//   }
// };
// Start the server
