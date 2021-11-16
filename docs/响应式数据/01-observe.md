# observe 函数

## 源码

源码位于`src/core/observer/index.js`，第`109`行

```javascript
export function observe(value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}
```

## 分析

- 如果需要监听的数据不为对象或者是一个`vnode`对象，则退出函数

```javascript
if (!isObject(value) || value instanceof VNode) {
  return;
}
```

- 检查需要监听的数据对象上面是否有`__ob__`属性，并且`__ob__`属性值是`Observer`类示例，那么说明这个数据已经被监听过了，不需要在进行数据监听

```javascript
if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
  ob = value.__ob__;
}
```

- 如果数据是数组或者对象，并且不是 vue 实例，则初始化`Observer`类，进行数据监听

```javascript
if (
  shouldObserve &&
  !isServerRendering() &&
  (Array.isArray(value) || isPlainObject(value)) &&
  Object.isExtensible(value) &&
  !value._isVue
) {
  ob = new Observer(value);
}
```

- 最后该函数返回一个`Observer`类的实例