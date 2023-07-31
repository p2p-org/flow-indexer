import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { environment } from '@/environment'

import { ProcessingMetricsModel } from '@/models/processing_metrics.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class SliMetrics {
  constructor(@Inject('knex') private readonly knex: Knex, @Inject('logger') private readonly logger: Logger) {
    this.add({ entity: 'system', name: `restart_framework`, row_time: new Date() })
  }

  public async add(data: ProcessingMetricsModel): Promise<void> {
    await ProcessingMetricsModel(this.knex).insert({ ...data, ...network, row_time: new Date() })
  }
}
