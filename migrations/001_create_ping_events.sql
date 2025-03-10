CREATE TABLE IF NOT EXISTS ping_events (
  tx_hash VARCHAR(66) NOT NULL PRIMARY KEY,
  block_number BIGINT NOT NULL
  processed BOOLEAN DEFAULT FALSE,
  pong_tx_hash VARCHAR(66),
  pong_block_number BIGINT,
  pong_tx_nonce BIGINT
); 