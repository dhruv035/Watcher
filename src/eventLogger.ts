import {
  AbiEvent,
  createPublicClient,
  getAbiItem,
  PublicClient,
  WatchBlocksReturnType,
  webSocket,
} from "viem";
import { DB } from "./db";
import { abi } from "./abi";
import { sepolia } from "viem/chains";
const BATCH_SIZE = 1000;
export class EventLogger {
  private viemClient: PublicClient;
  private unwatch: WatchBlocksReturnType | undefined;
  private db: DB;
  private contractAddress: string;
  constructor() {
    const viemClient = createPublicClient({
      chain: sepolia,
      transport: webSocket(process.env.SEPOLIA_RPC_URL!),
    });
    this.viemClient = viemClient;
    this.db = new DB();
    this.contractAddress = process.env.CONTRACT_ADDRESS!;
  }

  async initialize() {
    await this.db.connect();
    const startBlockNumber = parseInt(process.env.START_BLOCK_NUMBER!);

    const currentBlock = Number(await this.viemClient.getBlockNumber());
    console.log(`Current block number: ${currentBlock}`);

    let lastProcessedBlock = Number(await this.db.getLastProcessedBlock());
    console.log(`Last processed block: ${lastProcessedBlock}`);

    // Initialize watcher state if it doesn't exist
    if (!lastProcessedBlock) {
      console.log(
        `Initializing watcher state at block ${startBlockNumber}`
      );
      await this.db.updateWatcherState(startBlockNumber-1);
      lastProcessedBlock = startBlockNumber-1;
    }

    if (lastProcessedBlock < currentBlock) {
      console.log(`Processing historical blocks from ${lastProcessedBlock} to ${currentBlock}`);
      await this.processHistoricalBlocks(lastProcessedBlock, currentBlock);
    }
  }

  async fetchLogs(fromBlock: number, toBlock: number) {
    try {
      const PingEvent = getAbiItem({
        abi,
        name: "Ping",
      });
      const logs = await this.viemClient.getLogs({
        address: this.contractAddress as `0x${string}`,
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
        event: PingEvent as AbiEvent,
      });

      return logs;
    } catch (error) {
      console.error("Error fetching logs:", error);
      throw error;
    }
  }
  async run() {
    await this.initialize();
    await this.startLogger();
  }

  async processBatch(fromBlock: number, toBlock: number) {
    console.log(`Processing batch from ${fromBlock} to ${toBlock}`);
    try {
      await this.db.beginTransaction();
      const logs = await this.fetchLogs(fromBlock, toBlock);
      for (const log of logs) {
        await this.db.insertPingEvent(
          log.transactionHash,
          Number(log.blockNumber)
        );
        await this.db.updateWatcherState(Number(log.blockNumber));
      }
      await this.db.updateWatcherState(toBlock);
      await this.db.commit();
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
        await this.processBatch(currentBlock, batchEndBlock);
      }
    } catch (error) {
      console.error("Error processing historical events:", error);
      throw error;
    }
  }
  async startLogger() {
    console.log("Starting logger");
    const unwatch = this.viemClient.watchBlocks({
      onBlock: async (block) => {
        const blockNumber = Number(block.number);
        try {
          console.log(`Processing block: ${blockNumber}`);

          const logs = await this.fetchLogs(blockNumber, blockNumber);
          this.db.beginTransaction();
          for (const log of logs) {
            console.log(`
              New Ping Event Detected!
              Transaction Hash: ${log.transactionHash}
              Block Number: ${log.blockNumber}
            `);

            await this.db.insertPingEvent(log.transactionHash, blockNumber);
          }

          await this.db.updateWatcherState(blockNumber);
          await this.db.commit();

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
