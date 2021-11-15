/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  // vue初始化的时候主要有：合并配置，初始化生命周期，初始化事件中心，初始化渲染，初始化data，props，computed，watcher等
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // 唯一标识
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      // 开启性能追踪
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 标识是vue实例，避免被数据劫持
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 组件的合并策略
      initInternalComponent(vm, options)
    } else {
      // 用户传递的options，当前构造函数的options，父级构造函数的options
      // 合并配置之后挂载到$options
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
      // 合并之后
      // vm.$options = {
      //   components: { },
      //   created: [
      //     function created() {
      //       console.log('parent created')
      //     }
      //   ],
      //   directives: { },
      //   filters: { },
      //   _base: function Vue(options) {
      //     // ...
      //   },
      //   el: "#app",
      //   render: function (h) {
      //     //...
      //   }
      // }
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 这个initProxy是代理vm上面的数据，数据被设置之后，会做相应的检查，不符合要求的会报错警告
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 初始化生命周期：挂载一些属性，$parent,$root,$children等
    initLifecycle(vm)
    // 初始化事件相关：将父组件向子组件注册的事件注册到子组件的实例中
    initEvents(vm)
    // 初始化渲染相关的：$slots，$scopedSlots，createElement，$attrs，$listeners等数据
    initRender(vm)
    // 调用生命周期函数
    callHook(vm, 'beforeCreate')
    // 初始化inject
    initInjections(vm) // resolve injections before data/props
    // 初始化data，props，methods，computed，watch
    initState(vm)
    // 初始化provide
    initProvide(vm) // resolve provide after data/props
    // 调用生命周期
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 如果传入了el参数
    if (vm.$options.el) {
      // 挂载dom
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
