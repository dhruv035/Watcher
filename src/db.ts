import { Client, Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { WatcherState } from './eventLogger';

dotenv.config();


export class DB {
  private pool: Pool;
  constructor(){
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      keepAlive: true,
    });
    this.pool = pool;
  }

 async connect(){
  await this.pool.connect();
 }
  async close(){
    await this.pool.end();
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>){
    const client = await this.pool.connect();
    const result = await fn(client);
    client.release();
    return result;
  }
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>){
    const client = await this.pool.connect();
    try{  
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async processEventLogs(logs: any[],nonce:number,toBlock:number):Promise<number>{
    let newNonce = nonce;
    await this.withTransaction(async (client) => {
      for (const log of logs) {
        
        await client.query('INSERT INTO ping_events (tx_hash,block_number,pong_tx_nonce) VALUES ($1, $2, $3)', [log.transactionHash,log.blockNumber,nonce]);
        await this.updateWatcherStateFields({
          last_block_number: Number(log.blockNumber),
          current_nonce: nonce,
        },client);
        newNonce = newNonce+1;
      }
      await this.updateWatcherStateFields({
        last_block_number: Number(toBlock),
        current_nonce: newNonce,
      },client);
    });
    return newNonce;
  }
  async getWatcherState(){
    return await this.withClient(async (client) => {
      try{
        const result = await client.query('SELECT * FROM watcher_state WHERE id = 1');
        return result.rows.length > 0 ? {
          id: result.rows[0].id,
        lastProcessedBlock: Number(result.rows[0].last_block_number),
        currentNonce: Number(result.rows[0].current_nonce),
      } as WatcherState : undefined;
      } catch (error) {
        console.error('Error getting watcher state:', error);
        throw error;
      }
    });
  }
  
  async getLastProcessedBlock(){
    return await this.withClient(async (client) => {
      try{
        const result = await client.query('SELECT last_block_number FROM watcher_state WHERE id = 1');
        return result.rows.length > 0 ? result.rows[0].last_block_number : null;
      } catch (error) {
        console.error('Error getting last processed block:', error);
        throw error;
      }
    });
  }
  
  async insertPingEvent(txHash: string, blockNumber: number, nonce: number){
    await this.withClient(async (client) => {
      try{
        await client.query('INSERT INTO ping_events (tx_hash,block_number,pong_tx_nonce) VALUES ($1, $2, $3)', [txHash,blockNumber,nonce]);
      } catch (error) {
      console.error('Error inserting ping event:', error);
        throw error;
      }
    });
  }

  async updateWatcherState(blockNumber: number){
    await this.withClient(async (client) => {
      try{
        await client.query('UPDATE watcher_state SET last_block_number = $1 WHERE id = 1', [blockNumber]);
      } catch (error) {
        console.error('Error updating watcher state:', error);
        throw error;
        }
    });
  }

  async updateWatcherStateFields(fields: Record<string, any>,client?:PoolClient){

    let internalClient:PoolClient;
    if(!client){
      internalClient = await this.pool.connect();
    }else{
      internalClient = client;
    }
      try{
      const fieldEntries = Object.entries(fields);
      if (fieldEntries.length === 0) {
        return; // No fields to update
      }
      
      

      // Create column lists for the INSERT and UPDATE parts
      const insertColumns = ['id'].concat(fieldEntries.map(([key]) => key)).join(', ');
      
      // Create values list for the INSERT part with parameters
      const insertValues = ['1'].concat(fieldEntries.map((_, index) => `$${index + 1}`)).join(', ');
      
      // Create SET clause for the UPDATE part
      const updateSet = fieldEntries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
      
      // Construct the full query
      const query = `
        INSERT INTO watcher_state (${insertColumns}) 
        VALUES (${insertValues}) 
        ON CONFLICT (id) 
        DO UPDATE SET ${updateSet}
      `;
      
      // Extract just the values for the parameters
      const values = fieldEntries.map(([_, value]) => value);
      
        await internalClient.query(query, values);
      } catch (error) {
        console.error('Error updating watcher state fields:', error);
        throw error;
      } finally {
        if(!client){
          internalClient.release();
        }
      }
  }
}
