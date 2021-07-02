import { hasOwn } from '@vue/shared'
import {
  formatLog,
  NAVBAR_HEIGHT,
  ON_REACH_BOTTOM_DISTANCE,
} from '@dcloudio/uni-shared'
import { initEntry } from '../app/initEntry'
import { initRouteOptions } from './routeOptions'
import { createWebview, initWebview } from '../webview'
import { createPage } from './define'
import { PageNodeOptions } from '../dom/Page'
import { getStatusbarHeight } from '../../../helpers/statusBar'
import tabBar from '../app/tabBar'
import { addCurrentPage } from './getCurrentPages'
import { initPageInternalInstance } from '@dcloudio/uni-core'
import { ComponentPublicInstance } from 'vue'

export type OpenType =
  | 'navigateTo'
  | 'redirectTo'
  | 'reLaunch'
  | 'switchTab'
  | 'navigateBack'
  | 'preloadPage'

interface RegisterPageOptions {
  url: string
  path: string
  query: Record<string, string>
  openType: OpenType
  webview?: PlusWebviewWebviewObject
  vm?: ComponentPublicInstance // nvue vm instance
  // eventChannel: unknown
}

export function registerPage({
  url,
  path,
  query,
  openType,
  webview,
  vm,
}: RegisterPageOptions) {
  // fast 模式，nvue 首页时，会在nvue中主动调用registerPage并传入首页webview，此时初始化一下首页（因为此时可能还未调用registerApp）
  if (webview) {
    initEntry()
  }
  // TODO preloadWebview

  const routeOptions = initRouteOptions(path, openType)

  if (!webview) {
    webview = createWebview({ path, routeOptions, query })
  } else {
    webview = plus.webview.getWebviewById(webview.id)
    ;(webview as any).nvue = routeOptions.meta.isNVue
  }

  routeOptions.meta.id = parseInt(webview.id!)

  const isTabBar = !!routeOptions.meta.isTabBar
  if (isTabBar) {
    tabBar.append(webview)
  }

  if (__DEV__) {
    console.log(formatLog('registerPage', path, webview.id))
  }

  initWebview(webview, path, query, routeOptions.meta)

  const route = path.substr(1)

  ;(webview as any).__uniapp_route = route

  const pageInstance = initPageInternalInstance(url, query, routeOptions.meta)

  if (!(webview as any).nvue) {
    createPage(
      parseInt(webview.id!),
      route,
      query,
      pageInstance,
      initPageOptions(routeOptions)
    )
  } else {
    vm && addCurrentPage(vm)
  }
  return webview
}

function initPageOptions({ meta }: UniApp.UniRoute): PageNodeOptions {
  const statusbarHeight = getStatusbarHeight()
  return {
    version: 1,
    locale: '',
    disableScroll: meta.disableScroll === true,
    onPageScroll: false,
    onPageReachBottom: false,
    onReachBottomDistance: hasOwn(meta, 'onReachBottomDistance')
      ? meta.onReachBottomDistance!
      : ON_REACH_BOTTOM_DISTANCE,
    statusbarHeight,
    windowTop:
      meta.navigationBar.type === 'float' ? statusbarHeight + NAVBAR_HEIGHT : 0,
    windowBottom:
      tabBar.indexOf(meta.route) >= 0 && tabBar.cover ? tabBar.height : 0,
  }
}