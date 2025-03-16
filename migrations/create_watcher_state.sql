-- Table: public.watcher_state

-- DROP TABLE IF EXISTS public.watcher_state;

CREATE TABLE IF NOT EXISTS public.watcher_state
(
    id integer NOT NULL,
    last_block_number bigint NOT NULL,
    current_nonce bigint NOT NULL,
    CONSTRAINT watcher_state_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.watcher_state
    OWNER to postgres;