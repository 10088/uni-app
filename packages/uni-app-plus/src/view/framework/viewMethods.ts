import { extend } from '@vue/shared'
import {
  API_LOAD_FONT_FACE,
  API_PAGE_SCROLL_TO,
  SelectorQueryRequest,
} from '@dcloudio/uni-api'
import {
  subscribeViewMethod,
  registerViewMethod,
  getCurrentPageId,
} from '@dcloudio/uni-core'
import { ComponentPublicInstance } from 'vue'
import { requestComponentInfo } from '../../../../uni-h5/src/platform'
import {
  addIntersectionObserver,
  removeIntersectionObserver,
} from '../../../../uni-h5/src/platform'

import { loadFontFace } from './dom/font'
import { onPageReady, pageScrollTo } from './dom/page'

const pageVm = { $el: document.body } as ComponentPublicInstance

export function initViewMethods() {
  const pageId = getCurrentPageId()
  subscribeViewMethod(pageId, (fn: Function) => {
    return (...args: any[]) => {
      onPageReady(() => {
        fn.apply(null, args)
      })
    }
  })
  registerViewMethod<{ reqs: Array<SelectorQueryRequest> }>(
    pageId,
    'requestComponentInfo',
    (args, publish) => {
      requestComponentInfo(pageVm, args.reqs, publish)
    }
  )
  registerViewMethod(pageId, 'addIntersectionObserver', (args) => {
    addIntersectionObserver(
      extend({}, args, {
        callback(res: any) {
          UniViewJSBridge.publishHandler(args.eventName, res)
        },
      })
    )
  })
  registerViewMethod(pageId, 'removeIntersectionObserver', (args) => {
    removeIntersectionObserver(args)
  })
  registerViewMethod(pageId, API_PAGE_SCROLL_TO, pageScrollTo)
  registerViewMethod(pageId, API_LOAD_FONT_FACE, loadFontFace)
}
