/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      // 检查是否已经被安装过了，防止重复安装
      return this
    }

    // 获取剩下的参数
    const args = toArray(arguments, 1)
    // 同时将vue插入到第一个位置
    // 因为后续调用install的时候，vue参数必须作为第一个
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // 如果提供了一个install方法的对象
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 传入的是一个函数
      plugin.apply(null, args)
    }
    // 添加到插件列表
    installedPlugins.push(plugin)
    return this
  }
}
