import { invokeHook } from '@dcloudio/uni-core'
import { ON_LAUNCH, ON_SHOW } from '@dcloudio/uni-shared'
import { ComponentPublicInstance } from 'vue'

export function initAppLaunch(appVm: ComponentPublicInstance) {
  const args = {
    path: __uniConfig.entryPagePath,
    query: {},
    scene: 1001,
  }
  invokeHook(appVm, ON_LAUNCH, args)
  invokeHook(appVm, ON_SHOW, args)
}
