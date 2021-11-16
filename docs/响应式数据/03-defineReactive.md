
# defineReactive 函数

## 源码

源码位于`src/core/observer/index.js`，第`134`行

```javascript
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 实例化一个依赖管理器
  const dep = new Dep();
  // 获取描述符对象
  const property = Object.getOwnPropertyDescriptor(obj, key);
  // 不可配置的情况，数据被冻结了
  if (property && property.configurable === false) {
    return;
  }

  const getter = property && property.get;
  const setter = property && property.set;
  if ((!getter || setter) && arguments.length === 2) {
    // 参数只给了obj和key的情况
    val = obj[key];
  }

  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    // 可遍历
    enumerable: true,
    // 可操作性
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        // getter中收集依赖
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      const value = getter ? getter.call(obj) : val;
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      if (process.env.NODE_ENV !== "production" && customSetter) {
        customSetter();
      }
      if (getter && !setter) return;
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = !shallow && observe(newVal);
      // setter中通知更新
      dep.notify();
    },
  });
}
```

## 分析

- 首先实例化一个`Dep`用来收集依赖

```javascript
// 实例化一个依赖管理器
const dep = new Dep();
```

- 获取数据的描述符对象，如果是不可配置的，则退出函数

```javascript
// 获取描述符对象
const property = Object.getOwnPropertyDescriptor(obj, key);
// 不可配置的情况，数据被冻结了
if (property && property.configurable === false) {
  return;
}
```

此处可作为优化手段。如果页面上的某个数据列表，只是单纯展示，不需要修改内容，则使用`Object.free()`将数据冻结，这样子就可以避免 vue 去监听改数据的变化

- 根据`shallow`标识（是否为浅层监听，true 表示浅层监听，不会去递归监听对象的值），来决定是否需要调用`observe`函数递归监听对象的每一项。

```javascript
let childOb = !shallow && observe(val);
```

- 使用`Object.defineProperty()`对数据进行监听。并且在`getter`中收集依赖，在`setter`中触发更新

```javascript
Object.defineProperty(obj, key, {
  // 可遍历
  enumerable: true,
  // 可操作性
  configurable: true,
  get: function reactiveGetter() {
    const value = getter ? getter.call(obj) : val;
    if (Dep.target) {
      // getter中收集依赖
      dep.depend();
      if (childOb) {
        childOb.dep.depend();
        if (Array.isArray(value)) {
          dependArray(value);
        }
      }
    }
    return value;
  },
  set: function reactiveSetter(newVal) {
    const value = getter ? getter.call(obj) : val;
    if (newVal === value || (newVal !== newVal && value !== value)) {
      return;
    }
    if (process.env.NODE_ENV !== "production" && customSetter) {
      customSetter();
    }
    if (getter && !setter) return;
    if (setter) {
      setter.call(obj, newVal);
    } else {
      val = newVal;
    }
    childOb = !shallow && observe(newVal);
    // setter中通知更新
    dep.notify();
  },
});
```

在这里，我们所知的依赖就是`Watcher`实例，`Dep.target`是全局的唯一对象，也是指`Watcher`实例。当`new Watcher`的初始化的时候，首先会把`this`挂载到`Dep.target`中，然后根据传入的表达式读取一次数据（computed 计算属性除外），此时就会触发数据的`getter`，并且`Dep.target`也存在值，就会把`Dep.target`指向的`Watcher`实例作为依赖收集到`Dep`中，完成一次依赖收集

此处也可以作项目开发中优化的手段，对于不需要进行数据响应的数据，直接挂在到`this`下即可，不要写在`data`函数返回的对象中，因为`data`函数返回来的数据会被变成响应式数据

对于需要频繁读取响应式数据的，比如`this.name`，可以先把数据缓存下来，使用缓存的数据，因为`this.name`触发`getter`函数的逻辑
