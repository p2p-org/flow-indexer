import { Service, Inject } from 'typedi'
import express from 'express'
import { Logger } from 'pino'

import { ENTITY } from '@/models/processing_task.model'
import { BlockListenerService } from './service'

@Service()
export class BlockListenerController {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('expressApp') private readonly expressApp: express.Application,
    private listnerService: BlockListenerService
  ) {
    this.init()
  }

  init(): void {
    this.expressApp.get('/blocks/pause', (req, res) => {
      this.listnerService.pause()
      res.send('paused')
    })

    this.expressApp.get('/blocks/resume', (req, res) => {
      this.listnerService.resume()
      res.send('paused')
    })

    this.expressApp.get('/blocks/restart-unprocessed', (req, res) => {
      this.listnerService.restartUnprocessedTasks(ENTITY.BLOCK)
      res.send('restarted unprocessed')
    })

    this.expressApp.get('/blocks/process/:blockId', async (req, res) => {
      if (isNaN(Number(req.params.blockId))) return res.json({ error: 'blockId must be a number' })
      await this.listnerService.preloadOneBlock(Number(req.params.blockId))
      return res.json({ result: 'ok' })
    })


    this.expressApp.get('/blocks/process/:startBlockId/:endBlockId', async (req, res) => {
      if (isNaN(Number(req.params.startBlockId))) return res.json({ error: 'blockId must be a number' })
      await this.listnerService.preloadMultipleBlocks({
        fromBlock: Number(req.params.startBlockId),
        toBlock: Number(req.params.endBlockId),
        updateState: false
      })
      return res.json({ result: 'ok' })
    })



  }
}
