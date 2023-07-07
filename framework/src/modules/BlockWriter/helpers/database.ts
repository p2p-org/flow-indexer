import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'

import { ENTITY } from '@/models/processing_task.model'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { environment } from '@/environment'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class BlockWriterDatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
    @Inject('logger') private readonly logger: Logger,
  ) { }


  async getBlockById(blockId: number): Promise<any | null> {
    const blocksRecords = await this.knex('blocks')
      .select()
      .where({ block_id: blockId, ...network })

    return blocksRecords[0]
  }

  async saveBlock(trx: Knex.Transaction<any, any[]>, block: any): Promise<void> {
    await this.knex('blocks')
      .transacting(trx)
      .insert({ ...block, ...network, row_time: new Date() })
  }

  async saveEvent(trx: Knex.Transaction<any, any[]>, event: any): Promise<void> {
    await this.knex('events')
      .transacting(trx)
      .insert({ ...event, ...network, row_time: new Date() })
  }

  async saveTransaction(trx: Knex.Transaction<any, any[]>, transaction: any): Promise<void> {
    const strigifiedDataExtrinsic = {
      ...transaction,
      extrinsic: JSON.stringify(transaction),
    }
    await this.knex('transactions')
      .transacting(trx)
      .insert({ ...transaction, ...network, row_time: new Date() })
  }
}
