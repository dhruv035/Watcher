-- Table: public.ping_events

-- DROP TABLE IF EXISTS public.ping_events;

CREATE TABLE IF NOT EXISTS public.ping_events
(
    tx_hash character varying(66) COLLATE pg_catalog."default" NOT NULL,
    processed boolean DEFAULT false,
    block_number bigint,
    pong_tx_nonce bigint,
    CONSTRAINT ping_events_pkey PRIMARY KEY (tx_hash),
    CONSTRAINT pong_nonce FOREIGN KEY (pong_tx_nonce)
        REFERENCES public.pong_transactions (nonce) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.ping_events
    OWNER to postgres;

-- FUNCTION: public.notify_ping_event()

-- DROP FUNCTION IF EXISTS public.notify_ping_event();

CREATE OR REPLACE FUNCTION public.notify_ping_event()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
BEGIN
    -- Create a JSON payload with the relevant data from the new row
    PERFORM pg_notify(
        'ping_events',  -- Channel name
        json_build_object(
            'tx_hash', NEW.tx_hash,
            'processed', NEW.processed,
            'pong_tx_nonce', NEW.pong_tx_nonce,
            'block_number', NEW.block_number
        )::text
    );
    RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.notify_ping_event()
    OWNER TO postgres;

-- Trigger: ping_events_notify_trigger

-- DROP TRIGGER IF EXISTS ping_events_notify_trigger ON public.ping_events;

CREATE OR REPLACE TRIGGER ping_events_notify_trigger
    AFTER INSERT
    ON public.ping_events
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_ping_event();