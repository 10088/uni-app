import { App } from 'vue'

import { isFunction } from '@vue/shared'

import { applyOptions } from './componentOptions'
import { set, hasHook, callHook } from './componentInstance'
import { errorHandler } from './appConfig'
export function initApp(app: App) {
  const appConfig = app._context.config
  if (isFunction((app._component as any).onError)) {
    appConfig.errorHandler = errorHandler
  }
  const globalProperties = appConfig.globalProperties
  if (__PLATFORM__ !== 'h5' && __PLATFORM__ !== 'app') {
    // 小程序，待重构，不再挂靠全局
    globalProperties.$hasHook = hasHook
    globalProperties.$callHook = callHook
  }
  if (__VUE_OPTIONS_API__) {
    globalProperties.$set = set
    globalProperties.$applyOptions = applyOptions
  }
}