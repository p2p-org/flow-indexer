import { Container } from 'typedi'
import { BlockWriterService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default (): void => {

  const serviceInstance = Container.get(BlockWriterService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.BlocksWriter, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockWriter module initialized')
}