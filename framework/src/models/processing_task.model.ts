import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
}

export enum PROCESSING_STATUS {
  NOT_PROCESSED = 'not_processed',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  CANCELLED = 'cancelled',
}

export type ProcessingTaskModel<T> = {
  entity: ENTITY
  entity_id: number
  status: PROCESSING_STATUS
  collect_uid: string
  start_timestamp: Date
  finish_timestamp?: Date
  data: any
  attempts: number
  row_id?: number
}

export const ProcessingTaskModel = (knex: Knex) => knex<ProcessingTaskModel<ENTITY>>('processing_tasks')
