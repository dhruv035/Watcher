-- Table: public.pong_transactions

-- DROP TABLE IF EXISTS public.pong_transactions;

CREATE TABLE IF NOT EXISTS public.pong_transactions
(
    tx_hash character varying(66) NOT NULL,
    nonce bigint NOT NULL,
    ping_hash character varying(66) NOT NULL,
    status character varying NOT NULL,
    block_number bigint,
    replacement_hash character varying(66),
    CONSTRAINT pong_transactions_pkey PRIMARY KEY (nonce),
    CONSTRAINT tx_hash UNIQUE (tx_hash)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pong_transactions
    OWNER to postgres;