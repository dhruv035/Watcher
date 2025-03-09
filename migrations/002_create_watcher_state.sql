CREATE TABLE IF NOT EXISTS watcher_state (
  id PRIMARY KEY,
  last_block_number BIGINT NOT NULL,
  last_block_hash TEXT NOT NULL,
);

-- Insert the initial row