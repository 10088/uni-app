import os from 'os'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import {
  createLogger,
  createServer as createViteServer,
  ServerOptions,
} from 'vite'
import express from 'express'
import { hasOwn } from '@vue/shared'
import { parseManifestJson } from '@dcloudio/uni-cli-shared'
import { CliOptions } from '.'
import { cleanOptions } from './utils'

export async function createServer(options: CliOptions & ServerOptions) {
  const server = await createViteServer({
    root: process.env.VITE_ROOT_DIR,
    logLevel: options.logLevel,
    clearScreen: options.clearScreen,
    server: cleanOptions(options) as ServerOptions,
  })
  await server.listen()
}

export async function createSSRServer(options: CliOptions & ServerOptions) {
  const app = express()
  /**
   * @type {import('vite').ViteDevServer}
   */
  const vite = await createViteServer({
    root: process.env.VITE_ROOT_DIR,
    logLevel: options.logLevel,
    clearScreen: options.clearScreen,
    server: {
      middlewareMode: true,
      watch: {
        // During tests we edit the files too fast and sometimes chokidar
        // misses change events, so enforce polling for consistency
        usePolling: true,
        interval: 100,
      },
    },
  })
  // use vite's connect instance as middleware
  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    try {
      const { h5 } = parseManifestJson(process.env.UNI_INPUT_DIR)
      const base = (h5 && h5.router && h5.router.base) || ''
      const url = req.originalUrl.replace(base, '')
      const template = await vite.transformIndexHtml(
        url,
        fs.readFileSync(
          path.resolve(process.env.VITE_ROOT_DIR!, 'index.html'),
          'utf-8'
        )
      )
      const render = (
        await vite.ssrLoadModule(
          path.resolve(process.env.UNI_INPUT_DIR, 'entry-server.js')
        )
      ).render

      const [appHtml, preloadLinks, appContext] = await render(url)

      const html = template
        .replace(`<!--preload-links-->`, preloadLinks)
        .replace(`<!--app-html-->`, appHtml)
        .replace(`<!--app-context-->`, appContext)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite && vite.ssrFixStacktrace(e)
      res.status(500).end(e.stack)
    }
  })

  const logger = createLogger(options.logLevel)
  const serverOptions = vite.config.server || {}
  const protocol = (
    hasOwn(options, 'https') ? options.https : serverOptions.https
  )
    ? 'https'
    : 'http'
  let port = options.port || serverOptions.port || 3000
  const hostname = options.host

  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      const interfaces = os.networkInterfaces()
      Object.keys(interfaces).forEach((key) =>
        (interfaces[key] || [])
          .filter((details) => details.family === 'IPv4')
          .map((detail) => {
            return {
              type: detail.address.includes('127.0.0.1')
                ? 'Local:   '
                : 'Network: ',
              host: detail.address,
            }
          })
          .forEach(({ type, host }) => {
            const url = `${protocol}://${host}:${chalk.bold(port)}${
              vite.config.base
            }`
            logger.info(`  > ${type} ${chalk.cyan(url)}`)
          })
      )
      resolve(server)
    }
    const onError = (e: Error & { code?: string }) => {
      if (e.code === 'EADDRINUSE') {
        if (options.strictPort) {
          server.off('error', onError)
          reject(new Error(`Port ${port} is already in use`))
        } else {
          logger.info(`Port ${port} is in use, trying another one...`)
          app.listen(++port, hostname!, onSuccess)
        }
      } else {
        server.off('error', onError)
        reject(e)
      }
    }
    const server = app.listen(port, hostname!, onSuccess).on('error', onError)
  })
}
