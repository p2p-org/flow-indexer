import { Container } from 'typedi'
import { BlockListenerService } from './service'
import { BlockListenerController } from './controller'
import { environment, NODE_ENV } from '@/environment'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default (): void => {

  const serviceInstance = Container.get(BlockListenerService)
  Container.get(BlockListenerController)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.BlocksSensor, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockListener module initialized')
}