/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

export function validateProp(
  // 属性名
  key: string,
  // 规范后的prop选项
  propOptions: Object,
  // 父组件传入的真实props数据
  propsData: Object,
  // 当前vm实例
  vm?: Component
): any {
  const prop = propOptions[key]
  // 父组件是否传入了该属性值，true就是没传入
  const absent = !hasOwn(propsData, key)
  // 父组件传入的真实值
  let value = propsData[key]
  // 判断是否存在boolean类型
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    if (absent && !hasOwn(prop, 'default')) {
      // 父组件没有传入，并且也没有默认值，设置为false
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // 空值或者属性值个属性名相等
      // type:[Boolean,String]
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        // booleanIndex < stringIndex,指boolean的优先级比string高
        // stringIndex < 0不存在string类型
        value = true
      }
    }
  }
  // 父组件没传入值就是undefined
  if (value === undefined) {
    // 获取默认值
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    // 默认值转化为响应式数据
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    // 校验属性值和要求的类型是否匹配
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // 没有默认值就返回undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    // 对象或者数组必须通过工厂函数返回
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // vm.$options.propsData[key]父组件没有传值
  // vm._props[key]有该属性的值，则就是默认值
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // 默认值是一个函数，并且type类型不是Function，说明是工厂函数，
  // 需要执行一下，获取返回来的值
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
//  * 校验父组件传来的真是属性是否与prop的type类型匹配
 */
function assertProp (
  prop: PropOptions,
  // props选项的key
  name: string,
  // 值
  value: any,
  vm: ?Component,
  // 父组件是否传入了该属性，true表示没有传入
  absent: boolean
) {
  if (prop.required && absent) {
    // 必填项，但是父组件没传
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    // 不是必填项，并且值不存在，此时是合法的
    return
  }
  let type = prop.type
  // 标识校验是否成功，用户没设置type就不用校验了
  // props:{name:true}这种写法也是要校验的
  let valid = !type || type === true
  // 保存期望类型的数组
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      // 先把type转化为数组统一处理
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
    //   {
    //     vaild:true,       // 表示是否校验成功
    //     expectedType：'Boolean'   // 表示被校验的类型
    // }
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  if (!valid && haveExpectedTypes) {
    // 校验未通过
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  // 自定义校验器
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

function assertType (value: any, type: Function, vm: ?Component): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    try {
      valid = value instanceof type
    } catch (e) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm);
      valid = false;
    }
  }
  return {
    valid,
    expectedType
  }
}

const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
function isExplicable (value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
