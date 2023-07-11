# Flow Indexer


# Introduction

Flow indexer is an first open-source data warehouse to provide application-specific data, designed to reduce cost as well as simplify the process of building wallets, dashboards, explorers and apps that interact with Flow blockchain.

# Features

- Real-time data (20 seconds maximum delay for a bloc to appear in the database)
- High-speed extraction (up to 3000 blocks per hour for 1 instance with 1CPU and 200MB RAM)
- High-scalability (100 instances can process 300K million blocks per hour).
- High-speed access to extracted data (up to 10 thousands rows per second)
- Docker-compose in-house setup in 5 seconds

# Dependencies

- Docker
- Docker Compose

# Ram requirements

- BlockSensors: 1cpu, 200MB
- BlockProcessor: 1-100cpu, 200MB
- IndexerFramework: 1cpu, 500MB
- PostgreSQL: 1cpu, 1GB
- RabbitMQ: 1cpu, 300MB

You need own RPC-node **in archive mode**.

Docker service should be started first.

# INSTALLATION 

## Docker installation

```
1. Update package:

sudo apt update

2. Install package for HTTPS:

sudo apt install apt-transport-https ca-certificates curl software-properties-common

3. Add GPG-key for Docker:

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

4. Add repository for Docker:

sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"

5. Update package:

sudo apt update

6. Switch to Docker repository and install:

apt-cache policy docker-ce

7. Install Docker:

sudo apt install docker-ce

8. Check installation:

sudo systemctl status docker

Output info:
docker install ubuntu
Docker install Ubuntu

9. Check Docker image:

docker run hello-world

You must see «Hello from Docker!»

10. Install docker compose

sudo apt install docker-compose 

11. Check docker-compose 

docker-compose --version

Output info:

docker-compose version 1.20.1, build 1719ceb
```

# Quick Start

```
1) Create .env file

cp .env.sample .env 

2) Specify RPC URL in .env file. Like

RPC_URI=wss://rpc.polkadot.io/

3) Specify block id which from whuich you want to start sync. For ex:

START_BLOCK_ID=56000000

4) Start docker containers

docker-compose up -d
```

# Scalability

If you want to run 30 Block Processor instances then run it like

```
docker-compose up -d --scale flow_block_processor=30
```


# REST API

To monitor streamer status, you can use API on 3000 port

## API methods

[http://0.0.0.0:3000/health](http://0.0.0.0:3000/health) - responses `{"status":"live"}` if healthy

[http://0.0.0.0:3000/metrics](http://0.0.0.0:3000/metrics) - prometheus metrics for Grafana

[http://0.0.0.0:3000/blocks/pause](http://0.0.0.0:3000/blocks/pause) - pause blocks sync

[http://0.0.0.0:3000/blocks/resume](http://0.0.0.0:3000/blocks/resume) - resume blocks sync

[http://0.0.0.0:3000/blocks/restart-unporcessed](http://0.0.0.0:3000/blocks/restart-unprocessed) - if there were some problems with blocks data extraction, then maybe you need to increase memory of the BlockProcessor instance and call this method for restart extraction of all unprocessed blocks

[http://0.0.0.0:3000/blocks/process/:blockId](http://0.0.0.0:3000/blocks/process/:blockId) - manually process blockId

[http://0.0.0.0:3000/blocks/process/:startBlockId/:endBlockId](http://0.0.0.0:3000/blocks/process/:startBlockId/:endBlockId) - manually process of a range of blocks starting from startBlockId to endBlockId

After preload completed, the streamer will switch to the finalized blocks listening.

# How it works

## Project structure

```
├── db: schema to spin up postrges db
├── db-data: external docker volume for postgres data
├── docker-compose.yml: defenition of all containers (DB, RabbitMQ, BlockSensors, BlockkProcessors, IndexerFramework, etc)
├── framework: indexer framework for controll indexing process (language: TypeScript)
│   ├── Dockerfile: common docker rules for build the Indexer FrameWork container
│   └── src
│       ├── index: main application
│       ├── environment: environment defenition with default values
│       ├── loaders
│       │   ├── database: PosgreSQL initializer using knex library
│       │   ├── express: Express initializer for Rest API
│       │   ├── logger: Pino logger initializer
│       │   ├── prometheus: Prometheus metrics initalizer for Grafana 
│       │   └── rabbitmq: RabbitMQ queue intializer
│       ├── models: database models 
│       └── modules
│           ├── index: modules initializer depends MODE (specified in the docker-compose.yml)
│           ├── BlockListener: initial preloader and finalized block processor
│           │   ├── index: module initializer
│           │   ├── controller: Rest API endpoints 
│           │   ├── service: base module logic (get message from BlockSensor check it and send to BlockProcessor queue)
│           │   └── helpers
│           │       └── database: methods for get/save data in db
│           ├── BlockWriter: get block data structure from BlockProcessor and write it to DB
│           └── Monitoring: check missing blocks and tasks
└── src: main containers for fetch block data from RPC-node
    ├── block-sensor: python module for fetch latest block height 
    │   ├── Dockerfile: common docker rules for build the python container
    │   └── sensor.py: get latest block height from RPC-node and send it to the rabbitmq queue
    └── block-processor: python module for get block data, transactions and events from RPC-node
        ├── Dockerfile: common docker rules for build the python container
        └── processor.py: main script for get structured block data from RPC-node

```

## Database structure

DB shema is desribed in ./db directory

It is used as entrypoint SQL when Postgres started by ./db/Dockerfile from ./docker-compose.yml

Tables structre:

- blocks: This table stores information about blocks, including block height, block ID, parent id, block time, parent_voter_signature

- events: This table stores information about events, including block heught, event ID, transaction ID, transaction index, event index, type and payload.

- transactions: This table stores information about extrinsics, including block height, block ID, transaction ID, script, arguments, reference_block_id, gas_limit, payer, proposal_key, authorizers, payload_signatures, envelope_signatures, execution, status, status_code, error_message, computation_used.

- processing_tasks: This table stores information about processing tasks, including network ID, entity, entity ID, status, collection unique ID, start time, finish time, data, attempts, and a unique identifier (row_id).

- processing_state: This table stores information about the processing state, including network ID, entity, entity ID, and a unique identifier (row_id). It also has a constraint to ensure a unique combination of entity and network ID.

- processing_metrics: This table stores information about the processing metrics, including delay_time_ms, process_time_ms, missed_count, duplicates_count, rpc_sync_diff_count, memory_usage_mb, not_processed_count and restart.


## Indexer SLI metrics for each ODS
1. Speed
      - *delay_time_ms* - from appearing in the blockchain to being found in the database (milliseconds)
      - *process_time_ms* - block processing time (milliseconds)      
2. Data quality
      - *missed_count* - number of missed blocks
      - *duplicates_count* - number of duplicates records
      - *rpc_sync_diff_count* - diff between RPC and database
3. System
      - *memory_usage_mb* - used memory for processing each task
      - *not_processed_count* - number of unprocessed tasks
      - *restart* - count of indexer restarts
