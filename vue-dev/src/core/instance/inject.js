/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 把shouldObserve 置为false，
    // 目的是为了告诉defineReactive函数仅仅把键值对加到当前实例，不需要转化为响应式
    // 这也响应了的文档的，provide 和 inject 绑定并不是可响应的
    // 当然，如果传入了一个可监听的对象，那么该对象的属性还是可响应的
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    // 恢复shouldObserve为true
    toggleObserving(true)
  }
}

// var Parent = {
//   provide: {
//     foo: 'bar'
//   },
//   // ...
// }
// const Child = {
//   inject: {
//     foo: {
//       from: 'bar',
//       default: () => [1, 2, 3]
//     }
//   }
// }
// 一直往上面找父组件，看看是否有对应的key，找不到就看是否有默认值，没有就报错
// inject 还支持字符串数组，但是会在init的合并属性的时候规范化
// 规范如下：
// const Child = {
//   inject: {
//     foo: {
//       from: 'foo',
//       default: 'xxx'  //如果有默认的值就有default属性
//     }
//   }
// }
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // 存储inject选项数据的key以及对应的值
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      // 获取提供的源属性
      const provideKey = inject[key].from
      let source = vm
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      if (!source) {
        // 没找到父级组件有对应的key，看看是否有默认值
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 没有默认值就报错
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
