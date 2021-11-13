/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol,
  isPromise,
  remove
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'
import { currentRenderingInstance } from 'core/instance/render'

function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  // 创建了一个占位的注释 VNode
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

// resolveAsyncComponent需要处理三种异步组件的创建方式

// 第一种
//   Vue.component('async-example', function (resolve, reject) {
//     // 这个特殊的 require 语法告诉 webpack
//     // 自动将编译后的代码分割成不同的块，
//     // 这些块将通过 Ajax 请求自动下载。
//     require(['./my-async-component'], resolve)
//  })

// 第二种
// Vue.component(
//   'async-webpack-example',
//   // 该 `import` 函数返回一个 `Promise` 对象。
//   () => import('./my-async-component')
// )

// 第三种
  // const AsyncComp = () => ({
  //   // 需要加载的组件。应当是一个 Promise
  //   component: import('./MyComp.vue'),
  //   // 加载中应当渲染的组件
  //   loading: LoadingComp,
  //   // 出错时渲染的组件
  //   error: ErrorComp,
  //   // 渲染加载中组件前的等待时间。默认：200ms。
  //   delay: 200,
  //   // 最长等待时间。超出此时间则渲染错误组件。默认：Infinity
  //   timeout: 3000
  // })
  // Vue.component('async-example', AsyncComp)

export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>
): Class<Component> | void {
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    // 组件加载失败后会，会执行forceRender（）强制更新
    // 然后会再次执行resolveAsyncComponent函数
    // 如果errorComp有定义就会返回errorComp错误组件
    return factory.errorComp
  }

  if (isDef(factory.resolved)) {
    // 加载成功后会把结果存储在factory.resolved中（resolve函数中）
    return factory.resolved
  }

  const owner = currentRenderingInstance
  if (owner && isDef(factory.owners) && factory.owners.indexOf(owner) === -1) {
    // already pending
    factory.owners.push(owner)
  }

  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    // 异步函数加载中
    return factory.loadingComp
  }

  if (owner && !isDef(factory.owners)) {
    const owners = factory.owners = [owner]
    let sync = true
    let timerLoading = null
    let timerTimeout = null

    ;(owner: any).$on('hook:destroyed', () => remove(owners, owner))

    const forceRender = (renderCompleted: boolean) => {
      for (let i = 0, l = owners.length; i < l; i++) {
        (owners[i]: any).$forceUpdate()
      }

      if (renderCompleted) {
        owners.length = 0
        if (timerLoading !== null) {
          clearTimeout(timerLoading)
          timerLoading = null
        }
        if (timerTimeout !== null) {
          clearTimeout(timerTimeout)
          timerTimeout = null
        }
      }
    }

    // once传入的是一个函数，并返回一个函数，利用闭包和标志位保证函数只会执行一次
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // ensureCtor是为了保证能找到异步组件js定义的组件对象，如果是一个普通对象，就是用vue.extend转换成一个组件的构造函数
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      if (!sync) {
        // 遍历factory.contexts，拿到每一个调用异步组件的实例的vm，执行vm.$forceUpdate()方法，强制更新
        forceRender(true)
      } else {
        owners.length = 0
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender(true)
      }
    })

    // 执行异步工厂函数，同时吧resolve和reject函数作为参数传入
    const res = factory(resolve, reject)

    // 第一种异步组件调用方式是不会进入到下面的if
    if (isObject(res)) {
      if (isPromise(res)) {
        // 第二种
        // promise异步组件
        // () => Promise
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
      } else if (isPromise(res.component)) {
        // 第三种
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          // 定义了error组件
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        if (isDef(res.loading)) {
          // 定义loading组件
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          // delay是否设置了等待时间
          if (res.delay === 0) {
            // loading是指加载完毕
            factory.loading = true
          } else {
            // 利用定时器
            timerLoading = setTimeout(() => {
              timerLoading = null
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender(false)
              }
            }, res.delay || 200)
          }
        }

        // timeout是否设置超时时间
        if (isDef(res.timeout)) {
          timerTimeout = setTimeout(() => {
            timerTimeout = null
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
