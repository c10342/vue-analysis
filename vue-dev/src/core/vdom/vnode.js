/* @flow */

/**
 * VNode类型
 * 注释节点
 * 文本节点
 * 元素节点
 * 组件节点
 * 函数式组件节点
 * 克隆节点
 */
export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    // 节点标签名
    this.tag = tag
    // 节点对象，包含一些数据信息，key，slot，props等
    this.data = data
    // 子节点，一个数组
    this.children = children
    // 文本节点
    this.text = text
    // 真实dom节点
    this.elm = elm
    // 节点的名字空间
    this.ns = undefined
    // 组件节点对应的vue实例
    this.context = context
    // fnContext，fnOptions是针对函数式组件节点的
    // 函数式组件对应的vue实例
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    // key值
    this.key = data && data.key
    // componentOptions和componentInstance是针对组件节点的
    // options选项
    this.componentOptions = componentOptions
    // 节点对应的组件实例
    this.componentInstance = undefined
    // 父节点
    this.parent = undefined
    // 是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false
    this.raw = false
    // 静态节点标记
    this.isStatic = false
    // 是否作为节点插入
    this.isRootInsert = true
    // 是否为注释节点
    this.isComment = false
    // 是否为克隆节点
    this.isCloned = false
    // 是否有v-once指令
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建注释节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  // 表示注释信息
  node.text = text
  // 标识为注释节点
  node.isComment = true
  return node
}

// 创建文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// 创建克隆节点，做模板编译优化时使用
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  // 把已有属性赋值到新节点中，唯一区别就是isCloned为true
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
