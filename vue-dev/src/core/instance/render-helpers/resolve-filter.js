/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * 获取过滤器
 */
export function resolveFilter (id: string): Function {
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
