/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 修改Vue.options属性，从而影响后面所有的vue实例
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
