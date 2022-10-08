# 原理分析

1、在 vnode patch 过程中，会有很多的钩子函数，transition 组件就是借助了 create，activate 和 remove 钩子函数来执行过渡动画

2、过渡动画提供了 2 个时机，一个是 create 和 activate 钩子函数提供 entering 进入动画，一个是 remove 钩子函数提供 leaving 动画

3、transition 组件只是在 render 阶段获取一些数据，并且返回了 vnode，并没有任何和动画相关的逻辑

render 函数

首先在 transition 组件的 render 函数中，先获取默认的插槽的子节点，如果不存在就返回，如果节点的长度大于一就会警告报错，因为 transition 组件只能包裹一个元素。然后检查 mode 是否合法，mode 支持`in-out`和`out-in`。然后如果组件的根节点是 transition，并且外面包裹组件的容器也是 transition，就要跳过。然后获取第一个非抽象的节点，如果不存在就退出。存在就给子节点添加一个 key 值，接着再从组件实例上面提取出过度所需要的数据，并保存在`data.transition`字段中。到此就完成了过度数据的处理和搜集

在进入阶段。首先根据 transition 组件上面的 name 属性生成一个用来描述各个阶段的 class 名称对象，比如`v-enter`，`v-enter-to`等类名。然后定义过度的类名，startclass 定义的是过度的开始状态，在元素被插入是生效，在下一帧移除。activeclass 定义过度的状态，在整个过度过程中作用，在元素被插入时生效，在 transition/animation 完成之后移除。toclass 定义的是过度结束的状态，在元素被出入一帧后生效，与此同时 startclass 被删除，在 transition/animation 完成之后移除。然后还定义了一些钩子函数，beforeEnterHook 是过度开始前执行的，enterHook 是元素插入后或者 v-show 显示切换后执行的，afterEnterHook 是过度动画执行完成之后执行的。

然后就是合并 vnode patch 过程中的 insert 钩子函数。当组件被插入之后，就会执行我们定义的`enterHook`了

接着就是开始执行过度动画，首先执行 beforeEnterHook 钩子函数，然后给 DOM 元素添加开始状态类名和过度状态类名，紧接着借助 requestAnimationFrame 或者 setTimeout，在下一帧之后移除开始状态的类名，在过度没有被取消的情况下，给 DOM 元素添加结束状态的类名。最后如果用户是通过 enterHook 钩子函数控制动画的，就通过定时器来执行`afterEnterHook`钩子函数，如果是通过 css 来控制过度的，就监听`transitionEndEvent`或者`animationEndEvent`事件来移除结束状态类名和过度状态类名

在离开阶段，实际上跟进入阶段的实现几乎是一个镜像过程。不同的是从 data 中解析出来的样式类名和钩子函数，在离开过度动画执行完毕之后，会把节点从 DOM 中移除

所以总结起来 vue 的过度实现可以分为一下几个步骤：
1、检测目标元素是否应用了 css 过度动画，如果是，就在合适的时机添加或者删除 css 类名
2、如果提供了钩子函数，这些钩子函数将会在合适的时机被调用
3、如果没有检测到钩子函数或者 css 过度动画，DOM 操作会立即执行


# 源码

`src\platforms\web\runtime\components\transition.js`

```javascript
// Provides transition support for a single element/component.
// supports transition mode (out-in / in-out)

export const transitionProps = {
  // 动画名称,默认是v
  name: String,
  // 是否首次渲染
  appear: Boolean,
  // 是否取消css动画
  css: Boolean,
  // in-out或out-in二选一
  mode: String,
  // 显示声明监听animation或transition
  type: String,
  // 默认`${name}-enter`
  enterClass: String,
  // 默认`${name}-leave`
  leaveClass: String,
  // 默认`${name}-enter-to`
  enterToClass: String,
  // 默认`${name}-leave-to`
  leaveToClass: String,
  // 默认`${name}-enter-active`
  enterActiveClass: String,
  // 默认`${name}-leave-active`
  leaveActiveClass: String,
  // 首次渲染时进入
  appearClass: String,
  // 首次渲染时持续
  appearActiveClass: String,
  // 首次渲染时离开
  appearToClass: String,
  // 动画时长
  duration: [Number, String, Object]
}

// in case the child is also an abstract component, e.g. <keep-alive>
// we want to recursively retrieve the real component to be rendered
function getRealChild (vnode: ?VNode): ?VNode {
  const compOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
  if (compOptions && compOptions.Ctor.options.abstract) {
    return getRealChild(getFirstComponentChild(compOptions.children))
  } else {
    return vnode
  }
}

export function extractTransitionData (comp: Component): Object {
  const data = {}
  const options: ComponentOptions = comp.$options
  // 获取用户传入的props属性
  for (const key in options.propsData) {
    data[key] = comp[key]
  }
  // events.
  // extract listeners and pass them directly to the transition methods
  // 注册在transition组件上面的钩子方法
  const listeners: ?Object = options._parentListeners
  for (const key in listeners) {
    data[camelize(key)] = listeners[key]
  }
  return data
}

function placeholder (h: Function, rawChild: VNode): ?VNode {
  if (/\d-keep-alive$/.test(rawChild.tag)) {
    return h('keep-alive', {
      props: rawChild.componentOptions.propsData
    })
  }
}

function hasParentTransition (vnode: VNode): ?boolean {
  while ((vnode = vnode.parent)) {
    if (vnode.data.transition) {
      return true
    }
  }
}

function isSameChild (child: VNode, oldChild: VNode): boolean {
  return oldChild.key === child.key && oldChild.tag === child.tag
}

const isNotTextNode = (c: VNode) => c.tag || isAsyncPlaceholder(c)

const isVShowDirective = d => d.name === 'show'

// 作用是在合适的实际进行css类名的添加/删除或者执行js钩子来达到执行动画的目的
// 通过vnode patch过程中，在create，activate和remove 钩子函数中执行过度动画逻辑
// 过渡动画提供了2个时机，一个是create和activate的时候提供entering进入动画，一个是remove的时候提供leaving动画
// transition只是在render阶段获取一些数据，并且返回了vnode，并没有任何和动画相关的逻辑

// vue实现过度分为以下几个步骤：
// 1、检测是否应用了css过度或者动画，如果是就在切当的时机添加/删除css类名
// 2、如果过度组件提供了js钩子函数，这些钩子函数将会在适当的时机被执行
// 3、如果没有找到js钩子函数或者也没检测到css过度动画，dom操作（添加/删除）在下一帧立刻执行

// 所以真正执行动画的是我们写的css或者js钩子函数，而transition组件只是帮我们管理这里css的删除和添加，以及钩子函数执行的时机
export default {
  name: 'transition',
  props: transitionProps,
  abstract: true,

  render (h: Function) {
    // 获取默认插槽
    let children: any = this.$slots.default
    if (!children) {
      return
    }

    // filter out text nodes (possible whitespaces)
    // 文本节点需要去除空格
    children = children.filter(isNotTextNode)
    /* istanbul ignore if */
    if (!children.length) {
      return
    }

    // warn multiple elements
    // 过渡动画节点超出1个的时候，报错警告
    if (process.env.NODE_ENV !== 'production' && children.length > 1) {
      // transition组件只可能包裹一个元素
      warn(
        '<transition> can only be used on a single element. Use ' +
        '<transition-group> for lists.',
        this.$parent
      )
    }

    // 处理mode，只支持in-out和out-in
    const mode: string = this.mode

    // warn invalid mode
    if (process.env.NODE_ENV !== 'production' &&
      mode && mode !== 'in-out' && mode !== 'out-in'
    ) {
      warn(
        'invalid <transition> mode: ' + mode,
        this.$parent
      )
    }

    // 子节点对应的`Vnode`
    const rawChild: VNode = children[0]

    // if this is a component root node and the component's
    // parent container node also has transition, skip.
    if (hasParentTransition(this.$vnode)) {
      // 组件根节点是transition，并且外面包裹组件的容器是transition，要跳过
      return rawChild
    }

    // apply transition data to child
    // use getRealChild() to ignore abstract components e.g. keep-alive
    // 获取第一个非抽象子节点
    const child: ?VNode = getRealChild(rawChild)
    /* istanbul ignore if */
    if (!child) {
      // 不存在非抽象直接点就退出
      return rawChild
    }

    if (this._leaving) {
      return placeholder(h, rawChild)
    }

    // ensure a key that is unique to the vnode type and to this transition
    // component instance. This key will be used to remove pending leaving nodes
    // during entering.
    const id: string = `__transition-${this._uid}-`
    // 添加key属性
    child.key = child.key == null
      ? child.isComment
        ? id + 'comment'
        : id + child.tag
      : isPrimitive(child.key)
        ? (String(child.key).indexOf(id) === 0 ? child.key : id + child.key)
        : child.key

    // 将props和钩子函数赋给子节点的transition属性，表示是一个经过transition组件渲染的VNode
    const data: Object = (child.data || (child.data = {})).transition = extractTransitionData(this)
    const oldRawChild: VNode = this._vnode
    const oldChild: VNode = getRealChild(oldRawChild)

    // mark v-show
    // so that the transition module can hand over the control to the directive
    // child是用的是v-shoe指令，child.data.show也需要设置为true
    if (child.data.directives && child.data.directives.some(isVShowDirective)) {
      child.data.show = true
    }

    if (
      oldChild &&
      oldChild.data &&
      !isSameChild(child, oldChild) &&
      !isAsyncPlaceholder(oldChild) &&
      // #6687 component root is a comment node
      !(oldChild.componentInstance && oldChild.componentInstance._vnode.isComment)
    ) {
      // replace old child transition data with fresh one
      // important for dynamic transitions!
      const oldData: Object = oldChild.data.transition = extend({}, data)
      // handle transition mode
      if (mode === 'out-in') {
        // return placeholder node and queue update when leave finishes
        this._leaving = true
        mergeVNodeHook(oldData, 'afterLeave', () => {
          this._leaving = false
          this.$forceUpdate()
        })
        return placeholder(h, rawChild)
      } else if (mode === 'in-out') {
        if (isAsyncPlaceholder(child)) {
          return oldRawChild
        }
        let delayedLeave
        const performLeave = () => { delayedLeave() }
        mergeVNodeHook(data, 'afterEnter', performLeave)
        mergeVNodeHook(data, 'enterCancelled', performLeave)
        mergeVNodeHook(oldData, 'delayLeave', leave => { delayedLeave = leave })
      }
    }

    return rawChild
  }
}

```