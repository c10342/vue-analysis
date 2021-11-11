/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  // 每个vue实例都有一个唯一标识
  Vue.cid = 0
  let cid = 1

  // 类继承，作用是创建一个继承自vue类的子类，参数接收的是组件选项的对象
  // extendOptions：用户传入的组件选项参数
  Vue.extend = function (extendOptions: Object): Function {
    // 用户传入的一个包含组件选项的对象参数
    extendOptions = extendOptions || {}
    // 父类，即基础的vue类
    const Super = this
    // 父类id，无论是基础vue类还是继承的vue类，都有一个唯一标识
    const SuperId = Super.cid
    // 缓存池，用于缓存创建出来的类
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 缓存池
    if (cachedCtors[SuperId]) {
      // 这一步是为了vue性能考虑，反复调用其实返回的是同一个结果
      // 已经创建过的不需要在创建
      return cachedCtors[SuperId]
    }
    // 获取组件选项的name字段
    const name = extendOptions.name || Super.options.name
    // 校验组件名是否合法
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 创建一个vue类的子类，这个类即将要继承基础vue类
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 将父类的原型继承到子类
    Sub.prototype = Object.create(Super.prototype)
    // 修正constructor的指向
    Sub.prototype.constructor = Sub
    // id自增，保证唯一标识
    Sub.cid = cid++
    // 父类的options和传入的子类options进行合并
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // 将父类保存到子类的super字段中，确保子类能拿到父类
    Sub['super'] = Super

    // 初始化props
    if (Sub.options.props) {
      // 初始化props其实就是代理到原型的_props属性
      initProps(Sub)
    }
    // 初始化computed
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 将父类的一些属性添加到子类中
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // 'component',
    // 'directive',
    // 'filter'
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // 方便组件进行递归调用
    if (name) {
      Sub.options.components[name] = Sub
    }

    // 新增子类独有属性
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // 放入缓存池
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    // 将props代理到原型上面的_props
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
