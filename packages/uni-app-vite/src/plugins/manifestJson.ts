import { Plugin } from 'vite'

import {
  defineUniManifestJsonPlugin,
  normalizeAppManifestJson,
} from '@dcloudio/uni-cli-shared'

export function uniManifestJsonPlugin(): Plugin {
  let manifestJson: Record<string, any>
  return defineUniManifestJsonPlugin((opts) => {
    return {
      name: 'vite:uni-app-manifest-json',
      enforce: 'pre',
      transform(code, id) {
        if (!opts.filter(id)) {
          return
        }
        manifestJson = normalizeAppManifestJson(JSON.parse(code))
        return ''
      },
      generateBundle() {
        // 生成一个空的app-config.js，兼容基座已有规范
        this.emitFile({
          fileName: `app-config.js`,
          type: 'asset',
          source: '(function(){})();',
        })
        this.emitFile({
          fileName: `manifest.json`,
          type: 'asset',
          source: JSON.stringify(manifestJson, null, 2),
        })
      },
    }
  })
}
