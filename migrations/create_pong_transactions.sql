-- Table: public.pong_transactions

-- DROP TABLE IF EXISTS public.pong_transactions;

CREATE TABLE IF NOT EXISTS public.pong_transactions
(
    tx_hash character varying(66) COLLATE pg_catalog."default" NOT NULL,
    nonce bigint NOT NULL,
    ping_hash character varying(66) COLLATE pg_catalog."default" NOT NULL,
    status character varying COLLATE pg_catalog."default" NOT NULL,
    block_number bigint,
    replacement_hash character varying(66) COLLATE pg_catalog."default",
    CONSTRAINT pong_transactions_pkey PRIMARY KEY (nonce),
    CONSTRAINT tx_hash UNIQUE (tx_hash)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pong_transactions
    OWNER to postgres;