import {
  WatchBlocksReturnType,
} from "viem";
import { DB } from "./db";
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
  private watcherState: WatcherState|undefined;
  constructor() {
    this.db = new DB();
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
      const logs = await this.network.fetchLogs(fromBlock, toBlock);
      let nonce = this.watcherState.currentNonce;
      nonce = await this.db.processEventLogs(logs,nonce,toBlock);
      
      this.watcherState.lastProcessedBlock = Number(toBlock);
      this.watcherState.currentNonce = nonce;
    } catch (error) {
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
          console.log(`Processing block: ${blockNumber}`);
          let nonce = this.watcherState.currentNonce;
          const logs = await this.network.fetchLogs(blockNumber, blockNumber);
          nonce = await this.db.processEventLogs(logs,nonce,blockNumber);
          this.watcherState.lastProcessedBlock = blockNumber;
          this.watcherState.currentNonce = nonce;
        } catch (error) {
          console.error("Error processing l:", error);
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
