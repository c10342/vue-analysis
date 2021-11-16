
# Observer 类

## 源码

源码位于`src/core/observer/index.js`，第`32`行

```javascript
// Observer类通过递归把对象上面的所有属性都转化为响应式数据
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number;

  constructor(value: any) {
    this.value = value;
    this.dep = new Dep();
    this.vmCount = 0;
    // 添加一个标记，标识这个数据已经被转化为响应式数据了，避免重复操作
    def(value, "__ob__", this);
    if (Array.isArray(value)) {
      // value是数组时候的逻辑
      if (hasProto) {
        // 修改原型链的指向
        protoAugment(value, arrayMethods);
      } else {
        // 对象上面不存在__proto__，就直接挂在到数组上面
        copyAugment(value, arrayMethods, arrayKeys);
      }
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]);
    }
  }

  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}
```

## 分析

- Observer 类定义了三个属性和 2 个方法，分别是：

  - value 属性：监听的数据
  - dep 属性：依赖收集器（收集的是`Watcher`实例）
  - vmCount 属性：将这个对象作为根数据的次数
  - walk 方法：接受一个普通对象类型的参数，遍历该对象的`key-val`值，使用`defineReactive`函数将对象的`key-val`值变成响应式数据
  - observeArray 方法：接收一个数组参数，遍历数组，调用`observe`函数将数组的每一项都转化为响应式数据（前提是数组的每一项是对象或者是数组，普通数据类型不行）

- constructor 构造函数初始化流程：

  - 首先初始化`value`，`dep`和`vmCount`属性。

  ```javascript
  this.value = value;
  this.dep = new Dep();
  this.vmCount = 0;
  ```

  - 接着给`value`数据添加一个`__ob__`属性，该属性是不可遍历的，用来标识这个数据已经被转化为响应式数据了

  ```javascript
  def(value, "__ob__", this);
  ```

  - 如果数据是一个数组。如果数据存在`__proto__`，那么就修改数据的原型链的指向，指向我们改写数组方法后的对象。否则直接将改写的数组方法挂在到数据上。最后调用`observeArray`方法将数组的每一项都变成响应式数据

  ```javascript
  if (Array.isArray(value)) {
    // value是数组时候的逻辑
    if (hasProto) {
      // 修改原型链的指向
      protoAugment(value, arrayMethods);
    } else {
      // 对象上面不存在__proto__，就直接吧改写数组的方法挂在到数组上面
      copyAugment(value, arrayMethods, arrayKeys);
    }
    this.observeArray(value);
  }
  ```

  - 如果数据是一个普通对象，就调用`walk`将数据的`key-val`变成响应式数据