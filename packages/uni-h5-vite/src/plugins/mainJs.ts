import path from 'path'
import slash from 'slash'
import { defineUniMainJsPlugin } from '@dcloudio/uni-cli-shared'
import { isSsr, isSsrManifest } from '../utils'

export function uniMainJsPlugin() {
  return defineUniMainJsPlugin((opts) => {
    let pagesJsonJsPath = ''
    let isSSR = false
    return {
      name: 'vite:uni-h5-main-js',
      enforce: 'pre',
      configResolved(config) {
        pagesJsonJsPath = slash(
          path.resolve(process.env.UNI_INPUT_DIR, 'pages.json.js')
        )
        isSSR =
          isSsr(config.command, config) || isSsrManifest(config.command, config)
      },
      transform(code, id, ssr) {
        if (opts.filter(id)) {
          if (!isSSR) {
            code = code.includes('createSSRApp')
              ? createApp(code)
              : createLegacyApp(code)
          } else {
            code = ssr ? createSSRServerApp(code) : createSSRClientApp(code)
          }
          code = `import '${pagesJsonJsPath}';${code}`
          return {
            code,
            map: this.getCombinedSourcemap(),
          }
        }
      },
    }
  })
}

function createApp(code: string) {
  return `import { plugin as __plugin } from '@dcloudio/uni-h5';createApp().app.use(__plugin).mount("#app");${code.replace(
    'createSSRApp',
    'createVueApp as createSSRApp'
  )}`
}

function createLegacyApp(code: string) {
  return `import { plugin as __plugin } from '@dcloudio/uni-h5';function createApp(rootComponent,rootProps){return createVueApp(rootComponent, rootProps).use(__plugin)};${code.replace(
    'createApp',
    'createVueApp'
  )}`
}

function createSSRClientApp(code: string) {
  return `import { plugin as __plugin } from '@dcloudio/uni-h5';import { UNI_SSR, UNI_SSR_STORE } from '@dcloudio/uni-shared';const { app: __app, store: __store } = createApp();__app.use(__plugin);__store && window[UNI_SSR] && window[UNI_SSR][UNI_SSR_STORE] && __store.replaceState(window[UNI_SSR][UNI_SSR_STORE]);__app.router.isReady().then(() => __app.mount("#app"));${code}`
}

function createSSRServerApp(code: string) {
  return code
}
