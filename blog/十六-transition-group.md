

# 原理分析

## render函数

`transition-group`组件是非抽象组件，它会渲染成一个真实的的元素，默认是span。然后定义了几个变量。prevchildren是用来存储上一次的节点，children是用来存储当前的子节点，然后获取默认插槽的内容，并存储在rawchildren中，把transition-group组件上提取出来的一些渲染数据保存到transitionData中

遍历rawchildren，检查每个子节点是否存在key值，如果存在key值，就把当前子节点存放到children数组中，然后给当前节点添加transition属性，值为`transition-group`组件提取出来的过渡动画数据，这点很关键，只有这样子才能实现列表的单个元素过渡动画，跟transition组件一样

然后就是遍历prevchildren，获取每一个Vnode，然后把transitionData赋值给Vnode的transition属性，这个是为了当他在enter和leave的钩子函数中有过渡动画。然后调用了原生DOM的getBoundingClientRect 方法获取到原生DOM的位置信息，并记录在pos属性中

最后调用h函数渲染出Vnode，标签名默认是span，孩子节点就是上面的children数组

实际上跟transition组件的实现是类似的，不同是transition-group组件会，拿到所有的子节点，循环遍历每一个子节点，并给每一个子节点添加`transition`属性，然后还会记录节点的位置信息，最终还是转化为单个元素的过渡动画

在render函数中，每次插入和删除元素的缓动动画是可以实现的。但是剩下的元素平移的过渡效果是实现不出来的，所以还需要在update钩子函数中实现move过渡效果

## update 函数

update钩子函数中，首先对prevchildren进行遍历，记录节点的新位置，然后计算节点的新位置和旧位置，如果差值不为0，说明这些节点是需要移动的，并把节点的moved属性标识为true，并且通过设置`transform`样式把需要移动的节点的位置偏移到之前的旧位置，目的是为了move缓动做准备

然后通过读取`document.body.offsetHeight`属性值，强制触发浏览器重绘，接着再次对prevchildren进行遍历，先给子节点添加moveclass过渡样式类（比如说这个样式类就是设置了transitions的过渡时间为1s），接着把子节点的`transform`样式设置为空，由于之前我们已经把这些节点偏移到旧的位置了，所以`transform`样式设置为空后，子节点会从旧的位置按照我们设置的moveclass过度样式类，也就是1s的缓动时间过渡偏移到它当前的位置，这样子就实现了move的过渡动画。最后会监听transitionEndEvent 过渡结束事件，做一些清理操作

# 源码

`src\platforms\web\runtime\components\transition-group.js`

```javascript
const props = extend({
  tag: String,
  moveClass: String
}, transitionProps)

delete props.mode

// 非抽象组件
export default {
  props,

  beforeMount() {
    // 重写_update方法
    const update = this._update
    this._update = (vnode, hydrating) => {
      const restoreActiveInstance = setActiveInstance(this)
      // force removing pass
      // __patch__第四个参数为true，确保了 updateChildren  阶段，是不会移动vnode节点的
      this.__patch__(
        this._vnode,
        this.kept,
        false, // hydrating
        true // removeOnly (!important, avoids unnecessary moves)
      )
      this._vnode = this.kept
      restoreActiveInstance()
      update.call(this, vnode, hydrating)
    }
  },

  // 如果只实现了render函数，每次插入和删除元素的动画是可以实现的，但是，当新增一个元素，插入动画是有的，但是剩余的元素平移过渡效果是看不出来的
  // 所以还需要update钩子函数
  render(h: Function) {
    // 渲染出来的节点，默认是span
    const tag: string = this.tag || this.$vnode.data.tag || 'span'
    const map: Object = Object.create(null)
    // 存储上一次的子节点
    const prevChildren: Array<VNode> = this.prevChildren = this.children
    // 包裹的原始子节点
    const rawChildren: Array<VNode> = this.$slots.default || []
    // 存储当前节点
    const children: Array<VNode> = this.children = []
    // 提取出来的渲染数据
    const transitionData: Object = extractTransitionData(this)
    // 遍历rawChildren，初始化children
    for (let i = 0; i < rawChildren.length; i++) {
      const c: VNode = rawChildren[i]
      if (c.tag) {
        // 要求元素必须要有key
        if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
          // 添加到children中
          children.push(c)
          map[c.key] = c
            // 将过渡数据添加到节点中，这个跟transition组件是一样的
          ;(c.data || (c.data = {})).transition = transitionData
        } else if (process.env.NODE_ENV !== 'production') {
          const opts: ?VNodeComponentOptions = c.componentOptions
          const name: string = opts ? (opts.Ctor.options.name || opts.tag || '') : c.tag
          warn(`<transition-group> children must be keyed: <${name}>`)
        }
      }
    }

    if (prevChildren) {
      const kept: Array<VNode> = []
      const removed: Array<VNode> = []
      for (let i = 0; i < prevChildren.length; i++) {
        const c: VNode = prevChildren[i]
        // 将过渡数据添加到节点中
        c.data.transition = transitionData
        // 获取原生dom的位置信息
        c.data.pos = c.elm.getBoundingClientRect()
        // 判断当前循环的旧节点是否在新节点的map集合中
        if (map[c.key]) {
          // 如果在，就放到kept中
          kept.push(c)
        } else {
          // 如果不在，就标识该节点被删除，放到removed中
          removed.push(c)
        }
      }
      this.kept = h(tag, null, kept)
      this.removed = removed
    }
    // 生成VNode
    return h(tag, null, children)
  },

  updated () {
    const children: Array<VNode> = this.prevChildren
    const moveClass: string = this.moveClass || ((this.name || 'v') + '-move')
    // 核心就是hasMove的判断
    if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
      return
    }

    // we divide the work into three loops to avoid mixing DOM reads and writes
    // in each iteration - which helps prevent layout thrashing.
    // 对孩子节点进行了三次循环
    // callPendingCbs 方法是在前一个过渡动画没执行完又再次执行到该方法的时候，会提前执行 _moveCb 和 _enterCb。
    children.forEach(callPendingCbs)
    // 记录节点新位置
    children.forEach(recordPosition)
    // 计算节点的新旧位置差值，如果差值不为0，说明这些节点是需要移动的，并且通过设置transform 把需要移动的节点位置又偏移到移动之前的旧位置，目的是为了做move缓动做准备
    children.forEach(applyTranslation)

    // force reflow to put everything in position
    // assign to this to avoid being removed in tree-shaking
    // 通过读取document.body.offsetHeight值强制触发浏览器重绘
    this._reflow = document.body.offsetHeight
    // 遍历子元素实现move过渡
    children.forEach((c: VNode) => {
      if (c.data.moved) {
        // 需要移动的元素都会有moved=true的标识
        const el: any = c.elm
        const s: any = el.style‘
          // 添加moveClass
          addTransitionClass(el, moveClass)
        // 把子节点的style.transform样式值设为空。由于在前面已经把这些需要移动的元素偏移到了旧的位置，所以当清空transform的样式值的时候，会根据我们设置moveClass进行过度，偏移会当前的目标位置，这样子就实现了move的过渡动画
        s.transform = s.WebkitTransform = s.transitionDuration = ''
        // 监听transitionEndEvent过渡结束事件，做一些清理操作
        el.addEventListener(transitionEndEvent, el._moveCb = function cb (e) {
          if (e && e.target !== el) {
            return
          }
          if (!e || /transform$/.test(e.propertyName)) {
            el.removeEventListener(transitionEndEvent, cb)
            el._moveCb = null
            removeTransitionClass(el, moveClass)
          }
        })
      }
    })
  },

  methods: {
    hasMove (el: any, moveClass: string): boolean {
      /* istanbul ignore if */
      // ie9或者不是在浏览器端，是没有过渡动画的
      if (!hasTransition) {
        return false
      }
      /* istanbul ignore if */
      if (this._hasMove) {
        return this._hasMove
      }
      // Detect whether an element with the move class applied has
      // CSS transitions. Since the element may be inside an entering
      // transition at this very moment, we make a clone of it and remove
      // all other transition classes applied to ensure only the move class
      // is applied.
      // 先克隆一个节点，是为了避免影响
      const clone: HTMLElement = el.cloneNode()
      if (el._transitionClasses) {
        // 移除过渡类
        el._transitionClasses.forEach((cls: string) => { removeClass(clone, cls) })
      }
      // 添加moveClass样式
      addClass(clone, moveClass)
      // 设置display为none
      clone.style.display = 'none'
      // 添加到组件根节点上
      this.$el.appendChild(clone)
      // 获取过渡相关信息
      const info: Object = getTransitionInfo(clone)
      // 删除
      this.$el.removeChild(clone)
      return (this._hasMove = info.hasTransform)
    }
  }
}

function callPendingCbs (c: VNode) {
  /* istanbul ignore if */
  if (c.elm._moveCb) {
    c.elm._moveCb()
  }
  /* istanbul ignore if */
  if (c.elm._enterCb) {
    c.elm._enterCb()
  }
}

function recordPosition (c: VNode) {
  c.data.newPos = c.elm.getBoundingClientRect()
}

function applyTranslation (c: VNode) {
  const oldPos = c.data.pos
  const newPos = c.data.newPos
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    c.data.moved = true
    const s = c.elm.style
    s.transform = s.WebkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
  }
}

```