import { Container, Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { BlockWriterDatabaseHelper } from './helpers/database'
import { SliMetrics } from '@/loaders/sli_metrics'
import { environment } from '@/environment'

@Service()
export class BlockWriterService {

  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,
    private readonly databaseHelper: BlockWriterDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }


  public async processQueueMessage(message: any): Promise<void> {
    const { entity_id: blockId, collect_uid } = message

    const metadata = {
      block_process_uid: uuidv4(),
      processing_timestamp: new Date(),
    }
    await this.tasksRepository.increaseAttempts(ENTITY.BLOCK, blockId)

    await this.knex.transaction(async (trx) => {
      const taskRecord = await this.tasksRepository.readTaskAndLockRow(ENTITY.BLOCK, blockId, trx)

      if (!taskRecord) {
        await trx.rollback()
        this.logger.warn({
          event: 'Queue.processTaskMessage',
          blockId,
          warning: 'Task record not found. Skip processing',
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        await trx.rollback()
        this.logger.warn({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          warning: `Block  ${blockId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      //check that block wasn't processed already
      if (await this.databaseHelper.getBlockById(blockId)) {
        this.logger.info({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          message: `Block ${blockId} already present in the database`,
        })

        await this.tasksRepository.setTaskRecordAsProcessed(taskRecord, trx)
        await trx.commit()
        return
      }


      for (const transaction of message['transactions']) {
        await this.databaseHelper.saveTransaction(trx, transaction)
      }
      for (const event of message['events']) {
        await this.databaseHelper.saveEvent(trx, event)
      }
      await this.databaseHelper.saveBlock(trx, message['block'])

      await this.sliMetrics.add(
        { entity: 'block', entity_id: blockId, name: 'process_time_ms', value: Date.now() - taskRecord.start_timestamp.getTime() })

      const blockTime = new Date(message['block']['block_time'])
      await this.sliMetrics.add(
        { entity: 'block', entity_id: blockId, name: 'delay_time_ms', value: Date.now() - blockTime.getTime() })


      //const memorySize = Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024))
      //await this.sliMetrics.add({ entity: 'block', entity_id: blockId, name: 'memory_usage_mb', value: memorySize })


      await this.tasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      await trx.commit()

      this.logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: `Block ${blockId} has been processed and committed`,
        ...metadata,
        collect_uid,
      })

      //processedBlockGauge.set(blockId)
      //if (!newTasks.length) return

    }).catch((error: Error) => {
      this.logger.error({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        error: error.message,
        data: {
          ...metadata,
          collect_uid,
        },
      })
      throw error
    })
  }

}
