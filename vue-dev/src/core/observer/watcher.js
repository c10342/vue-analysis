/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      // 深度观测对象
      this.deep = !!options.deep
      this.user = !!options.user
      // lazy为true表明是一个计算属性
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    // 记录计算属性的返回值是否有变化，计算属性的缓存就是通过这个属性来判断的
    // true就是计算属性依赖的数据发生变化
    this.dirty = this.lazy // for lazy watchers
    // deps，newDeps 表示watcher实例持有的dep实例数组
    // 因为每次数据变化都会重新render，那么数据就被给再次出发getters，所以需要2个dep实例数组
    // newDeps 表示新添加的dep实例数组
    // deps表示上一次添加的dep实例数组
    this.deps = []
    this.newDeps = []
    // depIds，newDepIds表示deps，newDeps的id
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // watche的时候是表达式路径字符串，computed的时候是个函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 通过闭包，返回一个函数，该函数是根据表达式路径获取vm的值
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 如果是compute先不读取值，等到真正被是用到了在读取
    // 如果是普通的watcher，需要立刻读取值，这样才能让数据收集到依赖,
    // watcher需要立刻读取值是因为，有可能用户只设置值，不读取值，那这样子数据就收集不到依赖，从而无法进行监听数据的改变
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 添加一个全局唯一的对象
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 获取一下数据，触发getter，然后这个依赖就会被收集进去了
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        // 用户设置的watcher监听
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // 实现深度监听，把对象内部所有值递归读一遍
      // 那么这个实例就会被加入到对象内所有数据的依赖列表中
      if (this.deep) {
        traverse(value)
      }
      // 恢复到上一个状态
      popTarget()
      // 清除无关的依赖，比如v-if相关的依赖
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 
   * 把watcher添加到dep中，watcher的depIds也记录着自己添加到了那些dep中
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 确保不会重复添加
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 重新渲染的时候需要对比新旧deps依赖，移除不在需要的依赖
   * v-if的情况，满足a就会渲染a，此时改变条件，a不渲染，渲染b，如果没有移除a依赖，那么，修改b的数据后，也会通知a的回调，造成浪费
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        // 旧deps有的，新的deps没有，说明这个依赖不在需要了，则删除
        dep.removeSub(this)
      }
    }
    // 交换depIds和newDepIds
    // newDeps和deps也需要交换
    // 然后清空newDeps和newDepIds
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      // 计算属性
      // 标识计算属性依赖的数据发生了变化
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // 新旧值不等，新值是对象，deep模式的情况下，执行回调
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate() {
    // 重新计算
    this.value = this.get()
    // 从新计算完成之后，需要把标志位置为true，否则就没有缓存效果了
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 把当前实例从依赖的数据列表中移除
   * 
   * 比如：观察了数据a和数据b，那么它就依赖了数据a和数据b，那么这个watcher实例就存在于数据a和数据b的依赖管理器depA和depB中，同时watcher实例的deps属性中也记录了这两个依赖管理器，即this.deps=[depA,depB]，
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 移除_watchers上面的自己
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        // 通知依赖的数据，把自己给移除掉
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
