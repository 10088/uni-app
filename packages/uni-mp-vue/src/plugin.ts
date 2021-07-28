import { App } from 'vue'

import { initApp } from '@dcloudio/uni-vue'

export default {
  install(app: App) {
    initApp(app)
    const oldMount = app.mount
    app.mount = function mount(rootContainer: any) {
      const instance = oldMount.call(app, rootContainer)
      // @ts-ignore
      createMiniProgramApp(instance)
      return instance
    }
  },
}
