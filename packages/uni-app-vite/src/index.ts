import {
  initProvide,
  uniViteInjectPlugin,
  uniCssScopedPlugin,
  getAppStyleIsolation,
  parseManifestJsonOnce,
} from '@dcloudio/uni-cli-shared'
import { UniAppPlugin } from './plugin'
import { uniTemplatePlugin } from './plugins/template'
import { uniMainJsPlugin } from './plugins/mainJs'
import { uniManifestJsonPlugin } from './plugins/manifestJson'
import { uniPagesJsonPlugin } from './plugins/pagesJson'
import { uniResolveIdPlugin } from './plugins/resolveId'

function initUniCssScopedPluginOptions() {
  const styleIsolation = getAppStyleIsolation(
    parseManifestJsonOnce(process.env.UNI_INPUT_DIR)
  )
  if (styleIsolation === 'shared') {
    return
  }
  if (styleIsolation === 'isolated') {
    // isolated: 对所有非 App.vue 增加 scoped
    return {}
  }
  // apply-shared: 仅对非页面组件增加 scoped
  return { exclude: /mpType=page/ }
}

const plugins = [
  uniResolveIdPlugin(),
  uniTemplatePlugin(),
  uniMainJsPlugin(),
  uniManifestJsonPlugin(),
  uniPagesJsonPlugin(),
  uniViteInjectPlugin(initProvide()),
  UniAppPlugin,
]

const uniCssScopedPluginOptions = initUniCssScopedPluginOptions()
if (uniCssScopedPluginOptions) {
  plugins.unshift(uniCssScopedPlugin(uniCssScopedPluginOptions))
}

export default plugins
