import { Knex } from 'knex'

export type ProcessingMetricsModel = {
  entity: string
  entity_id?: number
  name: string
  value?: number
  row_id?: number
  row_time?: Date
}

export const ProcessingMetricsModel = (knex: Knex) => knex<ProcessingMetricsModel>('processing_metrics')
