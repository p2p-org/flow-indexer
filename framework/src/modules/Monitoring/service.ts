import { Inject, Service } from 'typedi'
import { Container } from 'typedi'
import { Knex } from 'knex'
import { TasksRepository } from '@/libs/tasks.repository'
import { MonitoringDatabaseHelper } from './helpers/database'
import { MonitoringSlackHelper } from './helpers/slack'
import { Logger } from 'pino'
import { environment } from '@/environment'
import cron from 'node-cron'
import { SliMetrics } from '@/loaders/sli_metrics'
import { BlockListenerService } from '@/modules/BlockListener/service'
import { ENTITY } from '@/models/processing_task.model'

@Service()
export class MonitoringService {

  listnerServiceInstance;

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,
    private readonly databaseHelper: MonitoringDatabaseHelper,
    private readonly slackHelper: MonitoringSlackHelper,
    private readonly tasksRepository: TasksRepository,
  ) {
    this.listnerServiceInstance = Container.get(BlockListenerService)
    this.cronInit()
  }

  public async cronInit(): Promise<void> {
    cron.schedule('*/5 * * * *', async () => {
      this.checkProcessingTasks()
    })
    cron.schedule('0 * * * *', async () => {
      this.checkBlocksSync()
    })
    cron.schedule('*/30 * * * *', async () => {
      this.checkMissingBlocks()
    })
    cron.schedule('45 0 * * *', async () => {
      this.checkDublicatesBlocks()
    })
  }

  public async checkBlocksSync(): Promise<void> {
    const lastDBBlockId = await this.databaseHelper.getLastBlockId()
    const lastNodeBlockId = this.listnerServiceInstance.getLastRPCBlockId()
    if (lastDBBlockId < lastNodeBlockId - 10) {
      this.slackHelper.sendMessage(`Sync problem. Last RPC-node blockId: ${lastNodeBlockId}. Last DB blockId: ${lastDBBlockId}`)

      await this.sliMetrics.add({ entity: 'block', name: 'rpc_sync_diff_count', value: lastNodeBlockId - lastDBBlockId })
    }
  }

  public async checkMissingBlocks(): Promise<void> {
    const lastBlockId = await this.databaseHelper.getLastBlockId()
    const missedBlocks = await this.databaseHelper.getMissedBlocks(lastBlockId)
    if (missedBlocks && missedBlocks.length) {
      this.slackHelper.sendMessage(`Detected missed blocks: ${JSON.stringify(missedBlocks)}`)

      await this.sliMetrics.add({ entity: 'block', name: 'missed_count', value: missedBlocks.length })

      this.logger.info({
        event: 'MonitoringService.checkMissingBlocks',
        message: `Need to restart unprocessed blocks`,
        missed: missedBlocks
      })

      try {
        this.listnerServiceInstance.restartUnprocessedTasks(ENTITY.BLOCK)
      } catch (error: any) {
        this.logger.error({
          event: 'MonitoringService.checkMissingBlocks',
          error: error.message,
          missedBlocks
        })
      }
    }
  }

  public async checkDublicatesBlocks(): Promise<void> {
    const dublicatesBlocks = await this.databaseHelper.getDublicatesBlocks()
    if (dublicatesBlocks && dublicatesBlocks.length) {
      this.slackHelper.sendMessage(`Detected dublicates blocks: ${JSON.stringify(dublicatesBlocks)}`)

      await this.sliMetrics.add({ entity: 'block', name: 'dublicates_count', value: dublicatesBlocks.length })
    }
  }

  public async checkProcessingTasks(): Promise<void> {
    const missedTasks = await this.databaseHelper.getMissedProcessingTasks()
    if (missedTasks && missedTasks.length) {
      this.slackHelper.sendMessage(`Detected not processed tasks: ${JSON.stringify(missedTasks)}`)

      await this.sliMetrics.add({ entity: 'queue', name: 'not_processed_count', value: missedTasks.length })
    }
  }
}