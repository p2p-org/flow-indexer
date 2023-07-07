import BlockListener from './BlockListener'
import BlockWriter from './BlockWriter'
import Monitoring from './Monitoring'

export const ModulesLoader = async (): Promise<void> => {
  BlockListener()
  BlockWriter()
  Monitoring()
}
