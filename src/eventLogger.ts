import {
  AbiEvent,
  Block,
  createPublicClient,
  getAbiItem,
  PublicClient,
  WatchBlocksReturnType,
  webSocket,
} from "viem";
import { DB } from "./db";
import { abi } from "./abi";
import { sepolia } from "viem/chains";
import { Network } from "./network";
const BATCH_SIZE = 1000;

export type WatcherState = {
  lastProcessedBlock: number;
  currentNonce: number;
  id: number;
};
export class EventLogger {
  private unwatch: WatchBlocksReturnType | undefined;
  private db: DB;
  private network: Network;
  private contractAddress: string;
  private watcherState: WatcherState|undefined;
  constructor() {
    this.db = new DB();
    this.contractAddress = process.env.CONTRACT_ADDRESS!;
    this.network = new Network();
  }

  async initialize() {
    await this.db.connect();
    const startBlockNumber = parseInt(process.env.START_BLOCK_NUMBER!);

    const currentBlock = Number(await this.network.getBlockNumber());
    console.log(`Current block number: ${currentBlock}`);

    this.watcherState = await this.db.getWatcherState();
    let lastProcessedBlock = this.watcherState?.lastProcessedBlock;
    console.log(`Last processed block: ${lastProcessedBlock}`);

    // Initialize watcher state if it doesn't exist
    if (!lastProcessedBlock) {
      console.log(
        `Initializing watcher state at block ${startBlockNumber}`
      );
      const txCount = await this.network.getTransactionCount(process.env.DEV_WALLET as `0x${string}`);
      await this.db.updateWatcherStateFields({
        last_block_number: startBlockNumber,
        current_nonce: Number(txCount),
      });
      this.watcherState = {
        currentNonce: Number(txCount),
        lastProcessedBlock: startBlockNumber,
        id: 1,
      };
      lastProcessedBlock = startBlockNumber;
    }

    if (lastProcessedBlock < currentBlock) {
      await this.processHistoricalBlocks(lastProcessedBlock+1, currentBlock);
    }
  }
  async run() {
    await this.initialize();
    await this.startLogger();
  }

  async processBatch(fromBlock: number, toBlock: number) {
    if(!this.watcherState){
      throw new Error("Watcher state not found");
    }
    console.log(`Processing batch from ${fromBlock} to ${toBlock}`);
    try {
      await this.db.beginTransaction();
      const logs = await this.network.fetchLogs(fromBlock, toBlock);
      let nonce = this.watcherState.currentNonce;
      for (const log of logs) {
        await this.db.insertPingEvent(
          log.transactionHash,
          Number(log.blockNumber),
          nonce
        );
        await this.db.updateWatcherStateFields({
          last_block_number: Number(log.blockNumber),
          current_nonce: nonce,
        });
        nonce = nonce+1;
      }
      await this.db.updateWatcherStateFields({
        last_block_number: Number(toBlock),
        current_nonce: nonce,
      });
      
      await this.db.commit();
      this.watcherState.lastProcessedBlock = Number(toBlock);
      this.watcherState.currentNonce = nonce;
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }
  async processHistoricalBlocks(fromBlock: number, toBlock: number) {
    console.log(`Processing historical blocks from ${fromBlock} to ${toBlock}`);
    try {
      // Process in batches of BATCH_SIZE blocks
      for (
        let currentBlock = fromBlock;
        currentBlock <= toBlock;
        currentBlock += BATCH_SIZE
      ) {
        const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
        console.log(`Processing batch from ${currentBlock} to ${batchEndBlock}`);
        await this.processBatch(currentBlock, batchEndBlock);
      }
    } catch (error) {
      console.error("Error processing historical events:", error);
      throw error;
    }
  }
  
  async startLogger() {
    
    console.log("Starting logger");
    const unwatch = this.network.publicClient.watchBlocks({
      onBlock: async (block) =>  {
        const blockNumber = Number(block.number);
        if(!this.watcherState){
          throw new Error("Watcher state not found");
        }
        try {
          let nonce = this.watcherState.currentNonce;
          console.log(`Processing block: ${blockNumber}`);
  
          const logs = await this.network.fetchLogs(blockNumber, blockNumber);
          this.db.beginTransaction();
          for (const log of logs) {
            console.log(`
              New Ping Event Detected!
              Transaction Hash: ${log.transactionHash}
              Block Number: ${log.blockNumber}
            `);
            await this.db.insertPingEvent(log.transactionHash, blockNumber,nonce);
            nonce = nonce+1;
          }
  
          await this.db.updateWatcherStateFields({
            last_block_number: blockNumber,
            current_nonce: nonce,
          });
          await this.db.commit();
          this.watcherState.lastProcessedBlock = blockNumber;
          // Always update the last processed block
        } catch (error) {
          await this.db.rollback();
          console.error("Error processing block:", error);
        }
      },
    });

    this.unwatch = unwatch;
  }

  async shutdown() {
    if (this.unwatch) {
      this.unwatch();
    }
    await this.db.close();
  }
}
