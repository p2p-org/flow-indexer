import { Container, Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { BlockListenerDatabaseHelper } from './helpers/database'

import { environment } from '@/environment'

export const sleep = async (time: number): Promise<number> => {
  return new Promise((res) => setTimeout(res, time))
}

@Service()
export class BlockListenerService {
  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false
  lastReceviedBlockId = 0

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly databaseHelper: BlockListenerDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) {}

  public async processQueueMessage(message: any): Promise<void> {
    const { entity_id: blockId, collect_uid } = message
    this.newBlock(blockId)
  }

  private async newBlock(blockId: number): Promise<void> {
    this.lastReceviedBlockId = blockId
    if (this.messagesBeingProcessed || this.isPaused) return
    //this.logger.debug({ event: 'BlocksListener.preload newFinalizedBlock', newFinalizedBlockId: blockId })
    const lastBlockIdInProcessingState = await this.databaseHelper.findLastEntityId(ENTITY.BLOCK)
    //this.logger.debug({ event: 'BlocksListener.preload', lastBlockIdInProcessingTasks })

    await this.preloadMultipleBlocks({ fromBlock: lastBlockIdInProcessingState + 1, toBlock: blockId, updateState: true })
  }

  public getLastRPCBlockId(): number {
    return this.lastReceviedBlockId
  }

  public async preloadMultipleBlocks(args: { fromBlock: number; toBlock: number; updateState: boolean }): Promise<void> {
    if (this.messagesBeingProcessed) return
    this.messagesBeingProcessed = true

    const { fromBlock, toBlock, updateState } = args

    if (fromBlock > toBlock) {
      this.logger.error(`Incorrect from and to blocks: fromBlock=${fromBlock} is more than toBlock=${toBlock}`)
      this.messagesBeingProcessed = false
      return
    }

    if (fromBlock < toBlock) this.logger.info(`Create series of block tasks from ${fromBlock} to ${toBlock}`)
    if (fromBlock == toBlock) this.logger.info(`Create block task ${fromBlock}`)

    let tasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []

    for (let id = fromBlock; id <= toBlock; id++) {
      if (this.gracefulShutdownFlag) {
        break
      }

      while (this.isPaused) {
        await sleep(500)
      }

      const task = this.createTask(id)
      tasks.push(task)

      if (id % environment.BATCH_INSERT_CHUNK_SIZE === 0) {
        await this.ingestTasksChunk(tasks, updateState)
        tasks = []
        await sleep(500)
      }
    }

    if (tasks.length) {
      await this.ingestTasksChunk(tasks, updateState)
      await sleep(500)
    }

    this.messagesBeingProcessed = false
  }

  private async ingestTasksChunk(tasks: ProcessingTaskModel<ENTITY.BLOCK>[], updateState: boolean): Promise<void> {
    try {
      for (let task of tasks) {
        if (await this.tasksRepository.addProcessingTask(task)) {
          await this.sendTaskToToRabbit(ENTITY.BLOCK, {
            entity_id: task.entity_id,
            collect_uid: task.collect_uid,
          })
        } else {
          this.logger.warn(`Block ${task.entity_id} already processed`)
        }
      }

      const updatedLastInsertRecord: ProcessingStateModel<ENTITY> = {
        entity: ENTITY.BLOCK,
        entity_id: tasks.at(-1)!.entity_id,
      }

      if (updateState) await this.databaseHelper.updateLastTaskEntityId(updatedLastInsertRecord)

      /*
      this.logger.debug({
        event: 'BlocksListener.ingestTasksChunk',
        message: 'blocks preloader sendToRabbitAndDb blocks',
        from: tasks[0].entity_id,
        to: tasks[tasks.length - 1].entity_id,
      })
      */
      //console.log('ingestTasksChunk ingested')
    } catch (error: any) {
      this.logger.error({
        event: 'BlocksListener.ingestTasksChunk',
        error: error.message,
      })
    }
  }

  private createTask(id: number): ProcessingTaskModel<ENTITY.BLOCK> {
    const task: ProcessingTaskModel<ENTITY.BLOCK> = {
      entity: ENTITY.BLOCK,
      entity_id: id,
      status: PROCESSING_STATUS.NOT_PROCESSED,
      collect_uid: uuidv4(),
      start_timestamp: new Date(),
      attempts: 0,
      data: {},
    }
    return task
  }

  private async sendTaskToToRabbit(entity: ENTITY, record: { collect_uid: string; entity_id: number }): Promise<void> {
    const rabbitMQ: Rabbit = Container.get('rabbitMQ')
    await rabbitMQ.send(QUEUES.BlocksProcessor, {
      entity_id: record.entity_id,
      collect_uid: record.collect_uid,
    })
  }

  public pause(): void {
    this.logger.info('preloader paused')
    this.isPaused = true
  }

  public resume(): void {
    this.logger.info('preloader resumed')
    this.isPaused = false
  }

  public async preloadOneBlock(blockId: number): Promise<void> {
    this.logger.debug({ event: 'BlocksListener.preloadOneBlock', blockId })
    this.preloadMultipleBlocks({ fromBlock: blockId, toBlock: blockId, updateState: false })
  }

  public async restartUnprocessedTasks(entity: ENTITY): Promise<void> {
    let lastEntityId = 0
    while (true) {
      const records = await this.tasksRepository.getUnprocessedTasks(entity, lastEntityId)
      if (!records || !records.length) {
        return
      }

      for (const record of records) {
        await this.sendTaskToToRabbit(entity, record)
        lastEntityId = record.entity_id || 0
      }

      this.logger.info({
        event: 'BlocksListener.restartUnprocessedTasks',
        message: `Preloaded ${environment.BATCH_INSERT_CHUNK_SIZE} tasks to 
                rabbit queue for processing ${entity}. Last entity id: ${lastEntityId}`,
      })

      await sleep(5000)
    }
  }
}
