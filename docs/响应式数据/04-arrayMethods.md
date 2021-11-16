

# arrayMethods 对象

在对数组进行数据劫持的时候，我们可以看见是用到了`arrayMethods`对象，然后将数组的`__proto__`指向`arrayMethods`，或者遍历`arrayMethods`，将`arrayMethods`对象上面的函数挂载到数组上面

```javascript
if (hasProto) {
  // 修改原型链的指向
  protoAugment(value, arrayMethods);
} else {
  // 对象上面不存在__proto__，就直接挂在到数组上面
  copyAugment(value, arrayMethods, arrayKeys);
}
```

```javascript
function protoAugment(target, src: Object) {
  target.__proto__ = src;
}
```

```javascript
function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}
```

## 源码

源码位于`src/core/observer/array.js`

```javascript
import { def } from "../util/index";

const arrayProto = Array.prototype;

// 创建一个对象作为拦截器
export const arrayMethods = Object.create(arrayProto);

// 需要重写数组的7个方法
const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];

methodsToPatch.forEach(function (method) {
  // 缓存原生方法
  const original = arrayProto[method];
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args);
    // 获取数组的__ob__，也就是observer类
    const ob = this.__ob__;
    let inserted;
    // push,unshift,splice会插入新对象
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    //通知更新
    ob.dep.notify();
    return result;
  });
});
```

## 分析

- 首先创建了一个对象作为拦截器，原型链指向`Array.prototype`

```javascript
const arrayProto = Array.prototype;

// 创建一个对象作为拦截器
export const arrayMethods = Object.create(arrayProto);
```

- 定义了一个数组，存储需要重写的数组方法

```javascript
// 需要重写数组的7个方法
const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
];
```

- 重写 7 个数组方法，流程如下：
  - 缓存原生数组方法
  - 给 arrayMethods 添加自定义的拦截方法
  - 自定义的拦截方法首先会调用原生的数组方法，对于`push,unshift,splice`这三个方法添加的数据也需要转化为响应式数据
  - 最终如果用户调用了改写后的函数，就会通知更新

```javascript
methodsToPatch.forEach(function (method) {
  // 缓存原生方法
  const original = arrayProto[method];
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args);
    // 获取数组的__ob__，也就是observer类
    const ob = this.__ob__;
    let inserted;
    // push,unshift,splice会插入新对象
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    //通知更新
    ob.dep.notify();
    return result;
  });
});
```

通过上面可以发现，当用户调用了`[].push`函数，实际上，使用的调用的是我们改写之后的`push`函数，也就是`arrayMethods`对象上面的`push`函数，对于`[].findIndex`，等其他数组函数，如果`arrayMethods`对象上面不存在`findIndex`函数，就会通过原型链一直往上面找。
