import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool using connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Add a ping event to the queue
// Get the last processed block number
export async function getLastProcessedBlock(): Promise<number | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT last_block_number FROM watcher_state WHERE id = 1'
    );
    return result.rows.length > 0 ? result.rows[0].last_block_number : null;
  } finally {
    client.release();
  }
}

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
}

export const releaseClient = async (client: PoolClient): Promise<void> => {
  client.release();
}
// Queue ping event and update block number in a single transaction
export async function queuePingEvent(
  txHash: string,
  timestamp: number,
  blockNumber: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Only insert ping event if we have valid data
    if (txHash && timestamp) {
      await client.query(
        'INSERT INTO ping_events (tx_hash, timestamp,block_number) VALUES ($1, $2, $3)',
        [txHash, timestamp,blockNumber]
      );
    }

    // Update watcher state
    await updateWatcherState(blockNumber,client)

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateWatcherState(blockNumber: number,client: PoolClient): Promise<void> {
  try {
    await client.query(`
      INSERT INTO watcher_state (id, last_block_number) 
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE 
      SET last_block_number = $1
    `, [blockNumber]);
  } catch (error) {
    console.error('Error updating watcher state:', error);
    throw error;
  }
}