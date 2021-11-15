/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

// 默认属性描述符
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // 给实例添加一个_watchers，用来存储当前实例的所有watcher实例
  // vue2并不会对所有数据进行拦截检测，不然数据越多，绑定的依赖就越多，会造成内存开销很大
  // 所以vue2将监测粒度上升到组件层面，所以新增了一个_watchers属性
  // 当一个数据发生变化时，会通知到组件，由组件内部使用虚拟dom进行数据对比
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

function initProps(vm: Component, propsOptions: Object) {
  // 父组件传进来的props数据
  const propsData = vm.$options.propsData || {}
  // 所有设置了props变量的属性都会保存一份到_props中
  const props = vm._props = {}
  // 缓存props对象中的key，更新的时候只需要遍历keys就可以拿到所有props的key
  const keys = vm.$options._propKeys = []
  // 判断当前组件是否为根组件
  const isRoot = !vm.$parent
  // 不是根组件不需要将数据转化为响应式
  // 根组件的props代理发生在vue.extend中
  if (!isRoot) {
    toggleObserving(false)
  }
  // 遍历props的键值对
  for (const key in propsOptions) {
    // 将建名添加到keys中
    keys.push(key)
    // 校验值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 检查key是否为html的保留属性
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 将key-value添加到_props
      defineReactive(props, key, value, () => {
        // 禁止组件修改props值
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // 如果key不在当前实例的vm上
    if (!(key in vm)) {
      // 将数据到this上面
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  // 获取data对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    // data必须是一个对象,否则警告
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // 检查是否跟methods有重名的
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      // 检查是否跟props有重名的
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 将不以_或者$开头的属性代理到this上面
      proxy(vm, `_data`, key)
    }
  }
  // 转化为响应式数据
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 服务端渲染
  const isSSR = isServerRendering()
  // 遍历computed每一项
  for (const key in computed) {
    const userDef = computed[key]
    // 如果是函数，则该函数默认是getter；不是函数说明是一个对象，则获取对象上面的get函数
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      // 取值器不存在，报错
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // 不是服务端渲染的情况下，创建一个watcher实例，并保存到watchers中
      // computed实际上就是通过watcher实现的，第四个参数是关键{ lazy: true }
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 如果属性名已经在props，data，methods中，说明重名了
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 非服务端环境才有缓存效果
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    // 函数的情况下默认函数就是取值器
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    // 不是函数的情况下，就将它作为对象处理
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
    sharedPropertyDefinition.set === noop) {
    // 用户没设置set情况下，给一个默认的，一旦用户设置了值，就报错
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 将计算属性绑定到this上面
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  // 返回一个computed的get函数
  return function computedGetter () {
    // 获取对应computed的watcher实例
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        // 如果依赖的数据发生了变化，通过调用watcher的update函数，吧dirty的值变为true，需要重洗计算值
        watcher.evaluate()
      }
      if (Dep.target) {
        // 依赖收集
        watcher.depend()
      }
      // 计算出来的值存储在value中
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        // methods里面的必须是函数
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        // 检查methods中的方法是否跟props中的重名
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // isReserved函数是用来判断字符串是否以_或$开头。
      if ((key in vm) && isReserved(key)) {
        // 如果实例中有对应的key值，并且以_或者$开头的，提示命名不规范
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 将方法代理到this上面
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// watch的使用形式可以是数组
// watch:{
//   e: [
//     'handle1',
//     function handle2 (val, oldVal) {  },
//     {
//       handler: function handle3 (val, oldVal) {  },
//     }
//   ],
//   // methods选项中的方法名
//   b: 'someMethod',
// }
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  // 被监听的属性表达式
  expOrFn: string | Function,
  // watch选项的每一项值
  handler: any,
  // 用于传递给vm.$watch的选项对象
  options?: Object
) {
  if (isPlainObject(handler)) {
    //   watch: {
    //     c: {
    //         handler: function (val, oldVal) { /* ... */ },
    // 		deep: true
    //     }
    // }
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
  //   watch: {
  //     // methods选项中的方法名
  //     b: 'someMethod',
  // }
    handler = vm[handler]
  }
  // 既不是对象，也不是字符串，则认为是函数
  // expOrFn:表达式
  // handler：回调函数
  // options：侦听选项
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    // 禁止给$data重新赋值
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // $props只能是只读，不可设置
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 挂载$data和$props属性到this上面
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 实例函数
  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      // 传入的回调函数是一个对象
    //   vm.$watch(
    //     'a.b.c',
    //     {
    //         handler: function (val, oldVal) { /* ... */ },
    //         deep: true
    //     }
    // )
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // user字段是用来区分用户创建的watcher和vue内部创建的watcher实例
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      // immediate会立刻触发回调函数
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 取消观察函数
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
