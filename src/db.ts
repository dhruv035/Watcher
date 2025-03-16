import { Client } from 'pg';
import dotenv from 'dotenv';
import { WatcherState } from './eventLogger';

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
  
  async getWatcherState(){
    try{
      const result = await this.dbClient.query('SELECT * FROM watcher_state WHERE id = 1');
      return result.rows.length > 0 ? {
        id: result.rows[0].id,
        lastProcessedBlock: Number(result.rows[0].last_block_number),
        currentNonce: Number(result.rows[0].current_nonce),
      } as WatcherState : undefined;
    } catch (error) {
      console.error('Error getting watcher state:', error);
      throw error;
    }
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
  
  async insertPingEvent(txHash: string, blockNumber: number, nonce: number){
    try{
      await this.dbClient.query('INSERT INTO ping_events (tx_hash,block_number,pong_tx_nonce) VALUES ($1, $2, $3)', [txHash,blockNumber,nonce]);
    } catch (error) {
      console.error('Error inserting ping event:', error);
      throw error;
    }
  }
  async updateWatcherState(blockNumber: number){
    try{
      await this.updateWatcherStateFields({ last_block_number: blockNumber });
    } catch (error) {
      console.error('Error updating watcher state:', error);
      throw error;
    }
  }

  async updateWatcherStateFields(fields: Record<string, any>){
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
      
      await this.dbClient.query(query, values);
    } catch (error) {
      console.error('Error updating watcher state fields:', error);
      throw error;
    }
  }
}
