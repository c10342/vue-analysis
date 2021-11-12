/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      // 取出name值
      const name: ?string = entry.name
      if (name && !filter(name)) {
        // 跟新的的匹配规则进行匹配，
        // 如果匹配，说明组件已经不需要被缓存，将其从this.cache删除，并销毁对应的组件
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    // 销毁没有在渲染状态的组件
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  // 抽象组件，自身不会渲染dom元素，也不会出现在父级链中
  abstract: true,

  props: {

    // 只有被匹配的组件会被缓存
    include: patternTypes,
    // 匹配到的组件都不会被缓存
    exclude: patternTypes,
    // 缓存数量，已缓存组件中最久没有被访问的实例会被销毁掉
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // 配置了max，并且缓存的长度超过了max的长度，则从缓存中删除第一个
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created() {
    // 存储需要缓存的组件
  //   this.cache = {
  //     'key1':'组件1',
  //     'key2':'组件2',
  //     // ...
  // }
    this.cache = Object.create(null)
    // 需要缓存的组件的key，也就是this.cache对象中的key值
    this.keys = []
  },

  destroyed() {
    // 销毁没有再渲染状态的组件，同时清空this.cache
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.cacheVNode()
    // 监听include和exclude变化
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render() {
    const slot = this.$slots.default
    // 获取默认插槽的第一个组件节点，keep-alive组件只处理第一个子元素
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // 获取组件节点名称，
      // 优先获取组件的name字段，如果name不存在则获取组件的tag，tag即注册组件是的key
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // 如果name跟include不匹配或者name跟exclude字段匹配，说明不需要缓存
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      // 下面是需要缓存的
      const { cache, keys } = this
      // 获取组件的key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {
        // 命中缓存，直接冲缓存中拿vnode组件的实例
        vnode.componentInstance = cache[key].componentInstance
        // 调整key的顺序，将其从原来的位置删除，防止到数组最后一位
        // 缓存淘汰策略LRU：
        remove(keys, key)
        keys.push(key)
      } else {
        // 没有命中缓存，则进行缓存设置
        // 延迟到update事件更新后进行缓存
        this.vnodeToCache = vnode
        this.keyToCache = key
      }
      // 设置keepAlive标志位
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
