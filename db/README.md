
# Database structure

- blocks: This table stores information about blocks, including block height, block ID, parent id, block time, parent_voter_signature

- events: This table stores information about events, including block heught, event ID, transaction ID, transaction index, event index, type and payload.

- transactions: This table stores information about extrinsics, including block height, block ID, transaction ID, script, arguments, reference_block_id, gas_limit, payer, proposal_key, authorizers, payload_signatures, envelope_signatures, execution, status, status_code, error_message, computation_used.

- processing_tasks: This table stores information about processing tasks, including network ID, entity, entity ID, status, collection unique ID, start time, finish time, data, attempts, and a unique identifier (row_id).

- processing_state: This table stores information about the processing state, including network ID, entity, entity ID, and a unique identifier (row_id). It also has a constraint to ensure a unique combination of entity and network ID.

- processing_metrics: This table stores information about the processing metrics, including delay_time_ms, process_time_ms, missed_count, duplicates_count, rpc_sync_diff_count, memory_usage_mb, not_processed_count and restart.
