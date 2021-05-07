//#if _NODE_JS_
// 目前这几个接口主要是 uniCloud 使用了
// 目前采用 polyfill 解决 xhr 和 storage
/* eslint-disable no-restricted-globals */
require('localstorage-polyfill')
global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest
export * from './network/request'
export * from './storage/storage'
export * from './device/getSystemInfoSync'
//#else
export * from './base/canIUse'

export * from './context/createInnerAudioContext'

export * from './device/makePhoneCall'
export * from './device/getSystemInfo'
export * from './device/getSystemInfoSync'
export * from './device/network'
export * from './device/accelerometer'
export * from './device/compass'
export * from './device/vibrate'

export * from './storage/storage'

export * from './file/getFileInfo'
export * from './file/openDocument'

export * from './keyboard/keyboard'

export * from './media/getImageInfo'
export * from './media/getVideoInfo'
export * from './media/chooseFile'
export * from './media/chooseImage'
export * from './media/chooseVideo'

export * from './network/request'
export * from './network/downloadFile'
export * from './network/uploadFile'
export * from './network/socket'

export * from './location/getLocation'

export * from './route/navigateBack'
export * from './route/navigateTo'
export * from './route/redirectTo'
export * from './route/reLaunch'
export * from './route/switchTab'

export * from './ui/popup/showModal'
export * from './ui/popup/showToast'
export * from './ui/loadFontFace'
export * from './ui/navigationBar'
export * from './ui/pageScrollTo'
export * from './ui/startPullDownRefresh'
export * from './ui/stopPullDownRefresh'
export * from './ui/tabBar'

export {
  upx2px,
  addInterceptor,
  removeInterceptor,
  promiseInterceptor,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  createIntersectionObserver,
  createSelectorQuery,
  createVideoContext,
  createMapContext,
  onTabBarMidButtonTap,
} from '@dcloudio/uni-api'
//#endif
