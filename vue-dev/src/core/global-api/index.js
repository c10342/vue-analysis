/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    // 禁止覆盖掉config对象
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // 挂载utils对象，非公共的全局api，需要避免去使用，因为是不稳定的
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 全局api
  // 往对象中添加一个新的响应式属性字段
  Vue.set = set
  // 删除对象中的响应式属性字段
  Vue.delete = del
  // 等待下次dom更新
  Vue.nextTick = nextTick

  // 2.6 新增的api，创建一个新的响应式数据
  Vue.observable = (obj)=> {
    observe(obj)
    return obj
  }
  // 父类构造器的options，每个vue实例都会和这个options参数进行合并
  // 这样子每个vue实例就会有全局设置的东西，指令，组件等资源
  Vue.options = Object.create(null)

  // 挂载下面的api
  // 'component',
  // 'directive',
  // 'filter'
//   Vue.options.components = {}
// Vue.options.directives = {}
// Vue.options.filters = {}
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // 基类
  Vue.options._base = Vue
  // 把内置组件扩展到Vue.options.components，keep-alive，这也是为什么不需要注册的原因
  extend(Vue.options.components, builtInComponents)
  // Vue.use
  initUse(Vue)
  // Vue.mixin
  initMixin(Vue)
  // Vue.extend
  initExtend(Vue)
  // Vue.component,vue.directive, Vue.filter
  initAssetRegisters(Vue)
}
