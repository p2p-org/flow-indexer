import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'

@Service()
export class MonitoringDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex) {}

  async getLastBlockId(): Promise<any> {
    const sql = `
      SELECT * 
      FROM blocks      
      WHERE network_id=${environment.NETWORK_ID}
      ORDER BY block_height DESC
      LIMIT 1`

    const blocks = await this.knex.raw(sql)
    return blocks.rows[0].block_height
  }

  async getDublicatesBlocks(): Promise<Array<any>> {
    const sql = `
      SELECT block_height, count(block_height) as count_id
      FROM blocks
      WHERE network_id=${environment.NETWORK_ID}
      GROUP BY block_height
      HAVING COUNT(*) > 1
      LIMIT 10`
    const dublicatesBlocks = await this.knex.raw(sql)
    return dublicatesBlocks.rows
  }

  async getMissedBlocks(lastBlockId: number): Promise<Array<any>> {
    const missedBlocksSQL = `
      SELECT generate_series(${lastBlockId - 1002}, ${lastBlockId - 2}) as missing_block except 
      SELECT block_height FROM blocks WHERE network_id=${environment.NETWORK_ID} 
      ORDER BY missing_block
      LIMIT 10`
    const missedBlocksRows = await this.knex.raw(missedBlocksSQL)
    return missedBlocksRows.rows
  }

  async getMissedProcessingTasks(): Promise<Array<any>> {
    const missedTasksSQL = `
      SELECT entity, entity_id 
      FROM processing_tasks pt 
      WHERE status='not_processed' 
        AND finish_timestamp is null 
        AND start_timestamp < NOW() - INTERVAL '1 HOUR'
      LIMIT 10`
    const missedTasksRows = await this.knex.raw(missedTasksSQL)
    return missedTasksRows.rows
  }
}
