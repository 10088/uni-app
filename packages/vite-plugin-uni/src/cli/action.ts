import { extend } from '@vue/shared'
import { RollupWatcher } from 'rollup'
import { BuildOptions, ServerOptions } from 'vite'
import { M } from '@dcloudio/uni-cli-shared'
import { CliOptions } from '.'
import { build, buildSSR } from './build'
import { createServer, createSSRServer } from './server'
import { initEnv } from './utils'

export async function runDev(options: CliOptions & ServerOptions) {
  extend(options, { watch: true, minify: false })
  initEnv('dev', options)
  try {
    if (options.platform === 'h5') {
      await (options.ssr ? createSSRServer(options) : createServer(options))
    } else {
      const watcher = (await build(options)) as RollupWatcher
      let isFirst = true
      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_START') {
          if (isFirst) {
            return (isFirst = false)
          }
          console.log(M['dev.watching.start'])
        } else if (event.code === 'BUNDLE_END') {
          event.result.close()
          console.log(M['dev.watching.end'])
        }
      })
    }
  } catch (e) {
    if (options.platform === 'h5') {
      console.error(`error when starting dev server:\n${e.stack || e}`)
    } else {
      console.error(`error during build:\n${e.stack || e}`)
    }
    process.exit(1)
  }
}

export async function runBuild(options: CliOptions & BuildOptions) {
  initEnv('build', options)
  try {
    await (options.ssr && options.platform === 'h5'
      ? buildSSR(options)
      : build(options))
    console.log(M['build.done'])
  } catch (e) {
    console.error(`error during build:\n${e.stack || e}`)
    process.exit(1)
  }
}
