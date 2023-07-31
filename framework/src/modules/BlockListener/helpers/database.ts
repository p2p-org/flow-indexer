import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { environment } from '@/environment'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class BlockListenerDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex, @Inject('logger') private readonly logger: Logger) {}

  public async findLastEntityId(entity: ENTITY): Promise<number> {
    const lastEntity = await ProcessingStateModel(this.knex)
      .where({ entity, ...network })
      .orderBy('row_id', 'desc')
      .limit(1)
      .first()

    const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : environment.START_BLOCK_ID
    return lastEntityId
  }

  public async updateLastTaskEntityId(status: ProcessingStateModel<ENTITY>): Promise<void> {
    await ProcessingStateModel(this.knex)
      //.transacting(trx)
      .insert({ ...status, ...network })
      .onConflict(['entity', 'network_id'])
      .merge()
  }
}
