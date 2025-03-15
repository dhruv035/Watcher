import { Client, Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();


export class DB {
  private dbClient: Client;
  constructor(){
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    this.dbClient = client;
  }

  async connect(){
    await this.dbClient.connect();
  }

  async close(){
    await this.dbClient.end();
  }

  async beginTransaction(){
    await this.dbClient.query('BEGIN');
  }
  async commit(){
    await this.dbClient.query('COMMIT');
  }
  async rollback(){
    await this.dbClient.query('ROLLBACK');
  }
  
  async getLastProcessedBlock(){
    try{
      const result = await this.dbClient.query('SELECT last_block_number FROM watcher_state WHERE id = 1');
      return result.rows.length > 0 ? result.rows[0].last_block_number : null;
    } catch (error) {
      console.error('Error getting last processed block:', error);
      throw error;
    }
  }
  
  async insertPingEvent(txHash: string, blockNumber: number){
    try{
      await this.dbClient.query('INSERT INTO ping_events (tx_hash,block_number) VALUES ($1, $2)', [txHash,blockNumber]);
    } catch (error) {
      console.error('Error inserting ping event:', error);
      throw error;
    }
  }
  async updateWatcherState(blockNumber: number){
    try{
      await this.dbClient.query('INSERT INTO watcher_state (id, last_block_number) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET last_block_number = $1', [blockNumber]);
    } catch (error) {
      console.error('Error updating watcher state:', error);
      throw error;
    }
  }
}
