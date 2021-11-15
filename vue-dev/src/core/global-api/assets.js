/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

  // 'component',
  // 'directive',
  // 'filter'
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        // 获取资源
        return this.options[type + 's'][id]
      } else {
        // 注册指令
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          // 如果对象中不存在name属性，就是用id所谓name属性
          definition.name = definition.name || id
          // Vue.extend() 创建子组件，返回子类构造器
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 添加到options全局配置
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
