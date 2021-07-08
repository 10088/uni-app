import path from 'path'
import { Plugin } from 'vite'

import {
  defineUniPagesJsonPlugin,
  normalizeAppPagesJson,
  normalizeAppConfigService,
  normalizePagesJson,
  parseManifestJsonOnce,
} from '@dcloudio/uni-cli-shared'

export function uniPagesJsonPlugin(): Plugin {
  let pagesJson: UniApp.PagesJson
  return defineUniPagesJsonPlugin((opts) => {
    return {
      name: 'vite:uni-app-pages-json',
      enforce: 'pre',
      transform(code, id) {
        if (!opts.filter(id)) {
          return
        }
        this.addWatchFile(path.resolve(process.env.UNI_INPUT_DIR, 'pages.json'))
        pagesJson = normalizePagesJson(code, process.env.UNI_PLATFORM)
        // TODO subpackages
        pagesJson.pages.forEach((page) => {
          this.addWatchFile(
            path.resolve(process.env.UNI_INPUT_DIR, page.path + '.vue')
          )
        })
        return (
          `import './manifest.json.js'\n` + normalizeAppPagesJson(pagesJson)
        )
      },
      generateBundle() {
        this.emitFile({
          fileName: `app-config-service.js`,
          type: 'asset',
          source: normalizeAppConfigService(
            pagesJson,
            parseManifestJsonOnce(process.env.UNI_INPUT_DIR)
          ),
        })
      },
    }
  })
}
