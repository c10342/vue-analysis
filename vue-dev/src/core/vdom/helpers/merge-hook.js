/* @flow */

import VNode from '../vnode'
import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

export function mergeVNodeHook (def: Object, hookKey: string, hook: Function) {
  // def需要是一个vnode对象
  if (def instanceof VNode) {
    def = def.data.hook || (def.data.hook = {})
  }
  let invoker
  // 保存旧的生命周期函数
  const oldHook = def[hookKey]

  function wrappedHook () {
    hook.apply(this, arguments)
    // important: remove merged hook to ensure it's called only once
    // and prevent memory leak
    // 调用完hook之后，必须要移除掉，保证只触发一次
    remove(invoker.fns, wrappedHook)
  }

  if (isUndef(oldHook)) {
    // 旧的生命周期函数不存在的情况下
    invoker = createFnInvoker([wrappedHook])
  } else {
    /* istanbul ignore if */
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // 已经合并过了，也就是有fns的情况下
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    } else {
      // existing plain hook
      // 创建一个新的hook
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }
  // 标识符，标记已经合并过了
  invoker.merged = true
  def[hookKey] = invoker
}
