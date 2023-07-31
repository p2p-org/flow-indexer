import dotenv from 'dotenv'
import { cleanEnv, str, num, bool, url } from 'envalid'

dotenv.config()
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

export enum NODE_ENV {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

export type Environment = {
  SLACK_WEBHOOK?: string
  PG_CONNECTION_STRING: string
  LOG_LEVEL: string
  RPC_URI: string
  REST_API_PORT: number
  START_BLOCK_ID: number
  RABBITMQ: string
  RABBITMQ_QUEUE_BLOCK_SENSOR: string
  RABBITMQ_QUEUE_BLOCK_PROCESSOR: string
  RABBITMQ_QUEUE_BLOCK_WRITER: string
  NETWORK: string
  NETWORK_ID: number
  NODE_ENV: NODE_ENV
  BATCH_INSERT_CHUNK_SIZE: number
  MAX_ATTEMPTS: number
}

const preEnv = cleanEnv(process.env, {
  SLACK_WEBHOOK: url({ default: '' }),
  PG_CONNECTION_STRING: url(),
  LOG_LEVEL: str({ default: 'info', choices: ['info', 'debug', 'trace', 'error'] }),
  RPC_URI: url(),
  REST_API_PORT: num({ default: 3000 }),
  START_BLOCK_ID: num({ default: -1 }), // -1 = continue from last preloaded block from db
  RABBITMQ: url(),
  RABBITMQ_QUEUE_BLOCK_SENSOR: str({ default: 'blocks_sensor' }),
  RABBITMQ_QUEUE_BLOCK_PROCESSOR: str({ default: 'blocks_processor' }),
  RABBITMQ_QUEUE_BLOCK_WRITER: str({ default: 'blocks_writer' }),
  NETWORK: str(),
  NETWORK_ID: num({ default: 1 }),
  NODE_ENV: str(),
  BATCH_INSERT_CHUNK_SIZE: num({ default: 1000 }),
  MAX_ATTEMPTS: num({ default: 5 }),
})

const parseModeEnum = (env: typeof preEnv) => {
  //env.MODE === 'BLOCK_PROCESSOR' ? MODE.BLOCK_PROCESSOR : env.MODE === 'LISTENER' ? MODE.LISTENER : MODE.STAKING_PROCESSOR
  const nodeEnv: NODE_ENV = env.NODE_ENV === 'development' ? NODE_ENV.DEVELOPMENT : NODE_ENV.PRODUCTION
  return { ...env, NODE_ENV: nodeEnv }
}

export const environment: Environment = parseModeEnum(preEnv)

console.log(environment)
