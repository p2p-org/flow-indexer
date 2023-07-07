import { ConfirmChannel, ConsumeMessage } from 'amqplib'
import AmqpConnectionManager from 'amqp-connection-manager'
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'
import { environment } from '@/environment'
import { logger } from '@/loaders/logger'

export const QUEUES = {
  BlocksSensor: environment.RABBITMQ_QUEUE_BLOCK_SENSOR,
  BlocksProcessor: environment.RABBITMQ_QUEUE_BLOCK_PROCESSOR,
  BlocksWriter: environment.RABBITMQ_QUEUE_BLOCK_WRITER,
}

export type TaskMessage = {
  entity_id: number
  collect_uid: string
}

export type QueueProcessor = {
  processQueueMessage: (msg: TaskMessage) => Promise<void>
}

export type Rabbit = {
  send: (queue: string, message: TaskMessage) => Promise<void>
  process: (queue: string, processor: QueueProcessor) => Promise<void>
}

export const RabbitMQ = async (connectionString: string): Promise<Rabbit> => {

  const connection: IAmqpConnectionManager = await AmqpConnectionManager.connect(connectionString)

  connection.on('connect', () => {
    logger.info({ event: 'RabbitMQ.connection', message: 'Successfully connected' })
  })
  connection.on('close', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection closed', error })
  })
  connection.on('error', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection error', error })
  })
  connection.on('disconnect', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection disconnected', error })
  })
  connection.on('blocked', (reason: string) => {
    logger.warn({ event: 'RabbitMQ.connection', message: `Connection blocked: ${reason}` })
  })
  connection.on('unblocked', () => {
    logger.warn({ event: 'RabbitMQ.connection', message: `Connection unblocked` })
  })

  const channelWrapper = connection.createChannel({
    json: true,
    setup: function (channel: ConfirmChannel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      // Note that `this` here is the channelWrapper instance.
      return Promise.all([
        channel.assertQueue(QUEUES.BlocksSensor, { durable: true }),
        channel.assertQueue(QUEUES.BlocksProcessor, { durable: true }),
        channel.prefetch(1),
      ])
    },
  })

  return {
    send: async (queue: string, message: TaskMessage) => {
      //logger.debug({ event: 'RabbitMQ.send', queue, message, buffer: Buffer.from(JSON.stringify(message)) })
      //console.log(queue, message);
      await channelWrapper.sendToQueue(queue, message)
    },
    process: async (queue: string, processor: QueueProcessor) => {
      console.log(queue);
      const consumer =
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            const message = JSON.parse(msg.content.toString()) //as TaskMessage<T>
            try {
              await processor.processQueueMessage(message)
              //logger.debug({ event: 'memory', message: Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024)) })
              channelWrapper.ack(msg)
            } catch (error: any) {
              logger.error({ event: 'RabbitMQ.process', error: error.message })

              //TODO: ?
              channelWrapper.ack(msg);
            }
          }
        }
      await channelWrapper.consume(queue, consumer)
    },
  }
}
