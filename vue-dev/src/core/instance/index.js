

// vue的定义

import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// vue是一个函数，通过new去实例化
function Vue (options) {
  // 一定要通过new去实例化vue
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// 按功能把扩展分散到多个模块中去实现，es6的class是难以实现的

// 添加_init方法
initMixin(Vue)
// 添加$data和$props属性，$set，$delete和$watch函数
stateMixin(Vue)
// 添加$on，$once，$off，$emit函数
eventsMixin(Vue)
// 添加_update，$forceUpdate，$destroy函数
lifecycleMixin(Vue)
// 添加$nextTick，_render函数
renderMixin(Vue)

export default Vue
