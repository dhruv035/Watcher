import { AbiEvent, Block, createPublicClient, getAbiItem, webSocket } from "viem";
import { abi } from "./abi";
import { PublicClient } from "viem";
import { sepolia } from "viem/chains";

export class Network {
  public publicClient: PublicClient;
  public contractAddress: string;
  constructor(){
    this.publicClient = createPublicClient({
        chain: sepolia,
        transport: webSocket(process.env.SEPOLIA_RPC_URL),
      });
    this.contractAddress = process.env.CONTRACT_ADDRESS!;
    }

  async getBlockNumber(){
    return await this.publicClient.getBlockNumber();
  }

  async getTransactionCount(address: `0x${string}`){
    return await this.publicClient.getTransactionCount({address});
  } 

  async getTransactionReceipt(hash: `0x${string}`){
    return await this.publicClient.getTransactionReceipt({hash});
  }

  async fetchLogs(fromBlock: number, toBlock: number) {
    try {
      const PingEvent = getAbiItem({
        abi,
        name: "Ping",
      });
      const logs = await this.publicClient.getLogs({
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
  watchBlocks(onBlock: (block: Block) => Promise<void>){
    return this.publicClient.watchBlocks({onBlock});
  }
}