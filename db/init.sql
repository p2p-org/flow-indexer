CREATE TABLE public.blocks (
	network_id int4 NULL,
	block_height int8 NULL,
	block_id varchar(66) NULL,
	parent_id varchar(66) NULL,
	block_time timestamp NULL,
	parent_voter_signature varchar(255) NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT blocks_pkey PRIMARY KEY (row_id)
);

CREATE TABLE public.events (
	network_id int4 NULL,
	block_height int8 NULL,
	block_id varchar(66) NULL,
	transaction_id varchar(66) NULL,
	transaction_index int4 NULL,
	event_index int4 NULL,
	"type" varchar(256) NULL,
	payload jsonb NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT events_pkey PRIMARY KEY (row_id)
);

CREATE TABLE public.transactions (
	network_id int4 NULL,
	block_height int8 NULL,
	block_id varchar(66) NULL,
	transaction_id varchar(66) NULL,
	script text NULL,
	arguments jsonb NULL,
	reference_block_id varchar(66) NULL,
	gas_limit int8 NULL,
	payer varchar(66) NULL,
	proposal_key jsonb NULL,
	authorizers jsonb NULL,
	payload_signatures jsonb NULL,
	envelope_signatures jsonb NULL,
	execution varchar(32) NULL,
	status varchar(32) NULL,
	status_code int4 NULL,
	error_message text NULL,
	computation_used varchar(32) NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT transactions_pkey PRIMARY KEY (row_id)
);

CREATE TABLE public.processing_metrics (
	network_id int4 NULL,
	entity varchar(66) NULL,
	entity_id int4 NULL,
	"name" varchar(20) NULL,
	value int4 NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT processing_metrics_pkey PRIMARY KEY (row_id)
);

CREATE TABLE public.processing_state (
	network_id int4 NULL,
	entity varchar(50) NULL,
	entity_id int4 NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT processing_state_pkey PRIMARY KEY (row_id),
	CONSTRAINT processing_state_uniq_key UNIQUE (entity, network_id)
);

CREATE TYPE processing_status AS ENUM ('not_processed', 'processed', 'cancelled');
CREATE TABLE public.processing_tasks (
	network_id int4 NULL,
	entity varchar(50) NULL,
	entity_id int4 NULL,
	status processing_status,
	collect_uid uuid NULL,
	start_timestamp timestamp NULL,
	finish_timestamp timestamp NULL,
	"data" jsonb NULL,
	attempts int4 NULL,
	row_id serial4 NOT NULL,
	row_time timestamp NULL,
	CONSTRAINT processing_tasks_pkey PRIMARY KEY (row_id)
);
CREATE UNIQUE INDEX processing_tasks_entity_idx ON public.processing_tasks USING btree (entity, entity_id, network_id);
