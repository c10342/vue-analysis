# 原理分析

首先 keep-alive，是一个抽象组件，它接受三个属性，分别是：include，exclude，max。

- include：被匹配的组件将会被缓存
- exclude：被匹配到的数组不会被缓存
- max：最大缓存数量，采用 lru 缓存策略，超出最大缓存数量时，最近最少使用的组件实例将会被淘汰销毁

然后在`created`生命周期函数中初始化`cache`和`keys`，`cache`是一个对象，用来存储需要缓存的组件。`keys`是一个数组，用来存储每个需要缓存的组件的`key`，就是对应`cache`对象的`key`值

在`mounted`生命周期函数中监听`include`和`exclude`值的变化，当他们发生变化时，找出那些已经被缓存了的组件，但是在新的匹配规则中已经不需要被缓存的组件，将其从`cache`对象中删除，并销毁组件，同时从`keys`数组中移除对应的`key`值

在`render`函数中：

1、获取默认插槽的第一个组件节点，keep-alive 只处理第一个子元素，

2、获取组件的 name 字段，如果 name 字段不存在就获取组件的 tag 名称

3、用`name`字段跟`include`和`exclude`中的匹配规则去进行匹配。如果跟`include`不匹配或者跟`exclude`匹配，说明是不需要进行缓存的，直接返回`VNode`。否则走下一步缓存

4、如果是需要缓存，首先获取组件的`key`值，如果 VNode 有 key 值，使用这个 key 值，如果没有 key 值，就使用实例的构造函数的 cid+组件标签名作为 key 值。

5、根据 key 值从`cache`对象中查找是否命中了缓存，如果是命中了，直接从缓存在拿出 VNode 组件的实例，并调整组件的 key 值在 keys 数组中的顺序，将其从原来的位置删除，放到数组的最后一位。

6、如果没有命中缓存，则缓存组件，并把组件的 key 值放置到 keys 数组中的最后一位。并且如果配置了 max 属性并且缓存长度超出了 max 值，则从 keys 数组中拿出第一个 key，因为每次组件命中缓存或者新增的组件的缓存，都会将组件的 key 放置到`keys`数组的最后一位，这样子最近最少使用的就会排在第一位，所以需要淘汰第一个 key 值对应的组件。根据这个 key 找出`cache`对象中缓存的组件，将其从`cache`对象中删除，并销毁组件，同时也需要将 key 值从`keys`数组中删除。

7、最后设置`keepAlive`标记位

# 源码

`src\core\components\keep-alive.js`

```javascript
function pruneCache(keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance;
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key];
    if (entry) {
      // 取出name值
      const name: ?string = entry.name;
      if (name && !filter(name)) {
        // 跟新的的匹配规则进行匹配，
        // 如果匹配，说明组件已经不需要被缓存，将其从this.cache删除，并销毁对应的组件
        pruneCacheEntry(cache, key, keys, _vnode);
      }
    }
  }
}

function pruneCacheEntry(
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key];
  if (entry && (!current || entry.tag !== current.tag)) {
    // 销毁没有在渲染状态的组件
    entry.componentInstance.$destroy();
  }
  cache[key] = null;
  remove(keys, key);
}

export default {
  name: "keep-alive",
  // 抽象组件，自身不会渲染dom元素，也不会出现在父级链中
  abstract: true,

  props: {
    // 只有被匹配的组件会被缓存
    include: patternTypes,
    // 匹配到的组件都不会被缓存
    exclude: patternTypes,
    // 缓存数量，已缓存组件中最久没有被访问的实例会被销毁掉
    max: [String, Number],
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this;
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache;
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        };
        keys.push(keyToCache);
        // 配置了max，并且缓存的长度超过了max的长度，则从缓存中删除第一个
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode);
        }
        this.vnodeToCache = null;
      }
    },
  },

  created() {
    // 存储需要缓存的组件
    //   this.cache = {
    //     'key1':'组件1',
    //     'key2':'组件2',
    //     // ...
    // }
    this.cache = Object.create(null);
    // 需要缓存的组件的key，也就是this.cache对象中的key值
    this.keys = [];
  },

  destroyed() {
    // 销毁没有再渲染状态的组件，同时清空this.cache
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys);
    }
  },

  mounted() {
    this.cacheVNode();
    // 监听include和exclude变化
    this.$watch("include", (val) => {
      pruneCache(this, (name) => matches(val, name));
    });
    this.$watch("exclude", (val) => {
      pruneCache(this, (name) => !matches(val, name));
    });
  },

  updated() {
    this.cacheVNode();
  },

  render() {
    const slot = this.$slots.default;
    // 获取默认插槽的第一个组件节点，keep-alive组件只处理第一个子元素
    const vnode: VNode = getFirstComponentChild(slot);
    const componentOptions: ?VNodeComponentOptions =
      vnode && vnode.componentOptions;
    if (componentOptions) {
      // 获取组件节点名称，
      // 优先获取组件的name字段，如果name不存在则获取组件的tag，tag即注册组件是的key
      const name: ?string = getComponentName(componentOptions);
      const { include, exclude } = this;
      // 如果name跟include不匹配或者name跟exclude字段匹配，说明不需要缓存
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode;
      }

      // 下面是需要缓存的
      const { cache, keys } = this;
      // 获取组件的key
      const key: ?string =
        vnode.key == null
          ? // same constructor may get registered as different local components
            // so cid alone is not enough (#3269)
            componentOptions.Ctor.cid +
            (componentOptions.tag ? `::${componentOptions.tag}` : "")
          : vnode.key;
      if (cache[key]) {
        // 命中缓存，直接冲缓存中拿vnode组件的实例
        vnode.componentInstance = cache[key].componentInstance;
        // 调整key的顺序，将其从原来的位置删除，防止到数组最后一位
        // 缓存淘汰策略LRU：
        remove(keys, key);
        keys.push(key);
      } else {
        // 没有命中缓存，则进行缓存设置
        // 延迟到update事件更新后进行缓存
        this.vnodeToCache = vnode;
        this.keyToCache = key;
      }
      // 设置keepAlive标志位
      vnode.data.keepAlive = true;
    }
    return vnode || (slot && slot[0]);
  },
};
```
