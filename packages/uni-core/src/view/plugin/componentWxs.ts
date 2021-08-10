import { ComponentInternalInstance, ComponentPublicInstance } from 'vue'
import {
  isFunction,
  isPlainObject,
  parseStringStyle,
  stringifyStyle,
} from '@vue/shared'
import { resolveOwnerVm } from '@dcloudio/uni-shared'
// import { normalizeEvent, findUniTarget } from './componentEvents'

interface WxsElement extends HTMLElement {
  __wxsStyle: Record<string, string | number>
  __wxsAddClass: string[]
  __wxsRemoveClass: string[]
  __wxsState: Record<string, any>
  __wxsClassChanged: boolean
  __wxsStyleChanged: boolean
  __vueParentComponent: ComponentInternalInstance // vue3 引擎内部，需要开放该属性
  __wxsComponentDescriptor: ComponentDescriptor
}

interface ComponentDescriptorVm {
  _$id?: string
  $el: WxsElement
  $emit: (event: string, ...args: any[]) => void
  $forceUpdate: () => void
}

export class ComponentDescriptor {
  private $vm: ComponentDescriptorVm
  private $el: WxsElement
  private $bindClass: boolean = false
  private $bindStyle: boolean = false
  constructor(vm: ComponentDescriptorVm) {
    this.$vm = vm
    this.$el = vm.$el
    if (this.$el.getAttribute) {
      this.$bindClass = !!this.$el.getAttribute('class')
      this.$bindStyle = !!this.$el.getAttribute('style')
    }
  }

  selectComponent(selector: string) {
    if (!this.$el || !selector) {
      return
    }
    const el = this.$el.querySelector(selector) as WxsElement
    return (
      el &&
      el.__vueParentComponent &&
      createComponentDescriptor(el.__vueParentComponent.proxy!, false)
    )
  }

  selectAllComponents(selector: string) {
    if (!this.$el || !selector) {
      return []
    }
    const descriptors = []
    const els = this.$el.querySelectorAll(selector)
    for (let i = 0; i < els.length; i++) {
      const el = els[i] as WxsElement
      el.__vueParentComponent &&
        descriptors.push(
          createComponentDescriptor(el.__vueParentComponent.proxy!, false)
        )
    }
    return descriptors
  }

  forceUpdate(type: 'class' | 'style') {
    if (type === 'class') {
      if (this.$bindClass) {
        // 组件已绑定class，通过vue内核更新
        this.$el.__wxsClassChanged = true
        this.$vm.$forceUpdate()
      } else {
        this.updateWxsClass()
      }
    } else if (type === 'style') {
      if (this.$bindStyle) {
        // 组件已绑定style，通过vue内核更新
        this.$el.__wxsStyleChanged = true
        this.$vm.$forceUpdate()
      } else {
        this.updateWxsStyle()
      }
    }
  }
  updateWxsClass() {
    const { __wxsAddClass } = this.$el
    if (__wxsAddClass.length) {
      this.$el.className = __wxsAddClass.join(' ')
    }
  }
  updateWxsStyle() {
    const { __wxsStyle } = this.$el
    if (__wxsStyle) {
      this.$el.setAttribute('style', stringifyStyle(__wxsStyle))
    }
  }
  setStyle(style: string | Record<string, string | number>) {
    if (!this.$el || !style) {
      return this
    }
    if (typeof style === 'string') {
      style = parseStringStyle(style)
    }
    if (isPlainObject(style)) {
      this.$el.__wxsStyle = style
      this.forceUpdate('style')
    }
    return this
  }

  addClass(clazz: string) {
    if (!this.$el || !clazz) {
      return this
    }
    const __wxsAddClass =
      this.$el.__wxsAddClass || (this.$el.__wxsAddClass = [])
    if (__wxsAddClass.indexOf(clazz) === -1) {
      __wxsAddClass.push(clazz)
      this.forceUpdate('class')
    }
    return this
  }

  removeClass(clazz: string) {
    if (!this.$el || !clazz) {
      return this
    }
    const { __wxsAddClass } = this.$el
    if (__wxsAddClass) {
      const index = __wxsAddClass.indexOf(clazz)
      if (index > -1) {
        __wxsAddClass.splice(index, 1)
      }
    }
    const __wxsRemoveClass =
      this.$el.__wxsRemoveClass || (this.$el.__wxsRemoveClass = [])
    if (__wxsRemoveClass.indexOf(clazz) === -1) {
      __wxsRemoveClass.push(clazz)
      this.forceUpdate('class')
    }
    return this
  }

  hasClass(cls: string) {
    return this.$el && this.$el.classList.contains(cls)
  }

  getDataset() {
    return this.$el && this.$el.dataset
  }

  callMethod(funcName: string, args = {}) {
    const func = (this.$vm as any)[funcName]
    if (isFunction(func)) {
      func(JSON.parse(JSON.stringify(args)))
    } else if ((this.$vm as any)._$id) {
      UniViewJSBridge.publishHandler('onWxsInvokeCallMethod', {
        cid: (this.$vm as any)._$id,
        method: funcName,
        args,
      })
    }
  }

  requestAnimationFrame(callback: FrameRequestCallback) {
    return window.requestAnimationFrame(callback)
  }

  getState() {
    return this.$el && (this.$el.__wxsState || (this.$el.__wxsState = {}))
  }

  triggerEvent(eventName: string, detail = {}) {
    // TODO options
    return this.$vm.$emit(eventName, detail), this
  }

  getComputedStyle(names?: string[]) {
    if (this.$el) {
      const styles = window.getComputedStyle(this.$el)
      if (names && names.length) {
        return names.reduce<Record<string, any>>((res, n) => {
          res[n] = styles[n as keyof CSSStyleDeclaration]
          return res
        }, {})
      }
      return styles
    }
    return {}
  }

  setTimeout(handler: TimerHandler, timeout?: number) {
    return window.setTimeout(handler, timeout)
  }

  clearTimeout(handle?: number) {
    return window.clearTimeout(handle)
  }

  getBoundingClientRect() {
    return this.$el.getBoundingClientRect()
  }
}

function createComponentDescriptor(
  vm: ComponentDescriptorVm,
  isOwnerInstance = true
) {
  if (isOwnerInstance && vm) {
    if (__PLATFORM__ === 'h5') {
      vm = resolveOwnerVm((vm as ComponentPublicInstance).$)!
    }
    // TODO App
  }
  if (vm && vm.$el) {
    if (!vm.$el.__wxsComponentDescriptor) {
      vm.$el.__wxsComponentDescriptor = new ComponentDescriptor(vm)
    }
    return vm.$el.__wxsComponentDescriptor
  }
}

export function getComponentDescriptor(
  instance: ComponentPublicInstance,
  isOwnerInstance: boolean
) {
  return createComponentDescriptor(instance, isOwnerInstance)
}
