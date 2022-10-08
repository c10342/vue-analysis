# 原理分析

## 虚拟 DOM

通过一个 js 对象来描述 DOM 节点。虚拟 DOM 包含真实 DOM 节点所需要的一系列属性，比如`tag`表示节点标签，`text`表示节点中包含文本，`children`表示该节点包含的子节点等等。

**VNode 类型**

- 注释节点
- 文本节点
- 元素节点
- 组件节点
- 函数式组件节点
- 克隆节点

## patch 过程

流程：

- 新的 vnode 不存在但是老的 vnode 存在，销毁老节点

- 新 vnode 存在但是老的 vnode 不存在，创建元素

- 新 vnode 存在并且旧的 vnode 也存在，如果旧 vnode 是真实元素，表示首次渲染，创建节点并插入，否则调用 patchVnode 函数进行精细化对比

核心：以新的 VNode 为基准，改造旧的 VNode，使之成为跟新的 VNode 一样，这就是 patch 过程要干的事情

三件事：

- 创建节点：新的 VNode 有而旧的 VNode 没有，就在旧的 VNode 中创建

- 删除节点：新的 VNode 没有而旧的 VNode 有，就从旧的 VNode 中删除

- 更新节点：新的 VNode 和旧的 VNode 都有，以新 VNode 为基准，更新旧的 VNode

## 创建节点

- 根据`tag`判断是否为元素节点，是就创建元素节点，不是就走下一步

- 根据`isComment`判断是否为注释节点，是就创建注释节点，不是就走下一步

- 既不是注释节点，也不是元素节点，那就认为是文本节点。创建文本节点

## 更新节点（patchVNode）

1、新旧节点完全是一样的（`===`比较），就退出程序

2、新旧节点都是静态节点，退出程序

3、如果新 VNode 是文本节点，并且跟旧的 VNode 的文本内容不一样，那么无论旧的 VNode 节点是什么，用新 VNode 的文本替换真实 DOM 的内容

4、如果新 VNode 有子节点
1、如果新旧 VNode 都有子节点，调用`updateChildren`函数更新知子节点
2、只有新 Vnode 有子节点，旧 VNode 没有子节点
1、如果旧的 VNode 有文本节点，清空文本节点，再把新 Vnode 的子节点添加到真实 DOM 中
2、如果旧的 VNode 没有文本节点，吧新 Vnode 的子节点添加到真实 DOM 中

5、只有旧节点有子节点，并且新 VNode 也没有子节点的情况，清空 DOM 中的子节点

6、新旧 VNode 都没有子节点，但是旧 Vnode 有文本节点，清空 DOM 中的文本节点

## 更新孩子节点（updateChildren）

1、准备 4 个指针，分别指向新孩子节点的第一个位置和最后一个位置，旧孩子节点的第一个位置和最后一个位置

2、以新前，新后，旧前，旧后的方式开始对比节点

3、如果旧前指向的节点不存在，旧前指针自增，对比下一个

4、如果旧后指向的节点不存在，旧后指针自减，对比下一个

5、新前和旧前对比，如果相同，就把 2 个节点进行`patchVNode`更新，新前，旧前和新前指针自增，对比下一个

6、新后与旧后对比，如果相同，就把 2 个节点进行`patchVNode`更新，新后，旧后和新前指针自减，对比下一个

7、新后与旧前对比，如果相同，先把 2 个节点进行`patchVNode`更新，然后把旧前指针指向的节点移动到所有未处理的旧孩子节点的后面，旧前指针自增，新后指针自减

8、新前与旧后对比，如果相同，先把 2 个节点进行`patchVNode`更新，然后把旧后指针指向的节点移动到所有未处理的旧孩子节点的前面，新前指针自增，旧后指针自减

10、如果都不属于之前的几种情况，就进行常规的循环对比
1、首先获取旧前指针和旧后指针之间的旧孩子节点的 key 值和下标索引值，以`key-val`的形式存储，key 是节点的 key 值，val 是节点的下标索引。然后将其缓存起来
2、查找当前循环的节点，也就是新前指针所指向的节点，在旧孩子节点中的下标索值。如果新前节点存在 key 值，则通过 key 值在前面缓存的 key-val 键值对中查找对应的下标索引。如果新前节点不存在 key 值，则通过循环，将新前节点跟旧前和旧后指针之间的节点，通过调用`sameVnode`方法进行对比，如果新前节点跟旧孩子节点中的节点相同则返回下标索引
3、如果下标索引不存在，则说明是新增的节点
4、如果下标索引号存在，则还要调用`sameVnode`方法判断当前循环的节点，跟下标索引所对应的旧孩子节点是否为同一个节点，如果一样，则调用`patchVnode`方法更新节点，然后移动节点。否则就是 key 值相同，但是为不同元素，默认为新增节点
5、新前指针自增

11、循环结束后：
1、如果旧的孩子节点比新的孩子节点先循环完毕，那么，新孩子节点剩下的节点就是需要新增的节点，把新前的指针和新后的指针之间的节点插入到 DOM 中
2、如果新孩子节点比旧孩子节点先循环完毕，那么旧孩子节点剩下的节点都是需要删除的节点，把旧前指针和旧后指针之间的节点都删除了

但是我觉得这段代码还可以进行优化。针对常规循坏对比中，没有 key 值的情况进行优化。因为在没有 key 值的情况下，获取当前循环的节点在旧孩子节点中的下标索引，是通过`for`循环进行对比的，里面就是通过调用`sameVnode`方法判断当前循环的节点跟旧孩子节点中的节点是否有相同，找到相同的则返回下标索引号，找不到相同的就返回了`undefined`，在找到下标索引的情况下，在原来的逻辑中，又调用了一次`sameVnode`方法来判断当前循环的节点跟下标索引所指向的旧孩子节点是否相同，其实这一步是多余的，因为通过`for`循环找出来的下标索引号所对应的旧孩子节点肯定是跟当前循环的节点是相同节点的，所以可以直接跳过调用`sameVnode`这一步，直接调用`patchVnode`方法进行更新即可。

所以我们可以记录一下获取下标索引号的方式，如果是通过 key 值获取的方式，则走正常的逻辑。如果是通过`for`循环获取下标索引号的方式，则在找到下标索引号的情况下，直接调用`patchVnode`进行更新节点即可

# 源码

`src\core\vdom\patch.js`

```javascript
// 1、新节点不存在，老节点存在，调用destroy，销毁老节点
// 2、oldvnode是真实元素，表示首次渲染，创建节点，并插入
// 3、如果oldvnode不是真实元素，标识更新阶段，执行patchvnode
return function patch(oldVnode, vnode, hydrating, removeOnly) {
  if (isUndef(vnode)) {
    // 新的vnode不存在但是老的vnode存在，销毁老节点
    if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
    return;
  }

  let isInitialPatch = false;
  const insertedVnodeQueue = [];

  if (isUndef(oldVnode)) {
    // 新vnode存在但是老的vnode不存在，创建元素
    isInitialPatch = true;
    createElm(vnode, insertedVnodeQueue);
  } else {
    // 新vnode存在并且就的vnode也存在
    const isRealElement = isDef(oldVnode.nodeType);
    if (!isRealElement && sameVnode(oldVnode, vnode)) {
      // patch existing root node
      // 新老节点相同，调用patchvnode精细化对比
      patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
    } else {
      if (isRealElement) {
        // 是真实元素，渲染根组件
        // mounting to a real element
        // check if this is server-rendered content and if we can perform
        // a successful hydration.
        if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
          oldVnode.removeAttribute(SSR_ATTR);
          hydrating = true;
        }
        // either not server-rendered, or hydration failed.
        // create an empty node and replace it
        oldVnode = emptyNodeAt(oldVnode);
      }

      // replacing existing element
      // 获取老节点的真实元素
      const oldElm = oldVnode.elm;
      // 获取老节点的父元素
      const parentElm = nodeOps.parentNode(oldElm);

      // create new node
      // 基于新vnode创建整个dom树，并插入
      createElm(
        vnode,
        insertedVnodeQueue,
        // extremely rare edge case: do not insert if old element is in a
        // leaving transition. Only happens when combining transition +
        // keep-alive + HOCs. (#4590)
        oldElm._leaveCb ? null : parentElm,
        nodeOps.nextSibling(oldElm)
      );

      // update parent placeholder node element, recursively
      if (isDef(vnode.parent)) {
        let ancestor = vnode.parent;
        const patchable = isPatchable(vnode);
        while (ancestor) {
          for (let i = 0; i < cbs.destroy.length; ++i) {
            cbs.destroy[i](ancestor);
          }
          ancestor.elm = vnode.elm;
          if (patchable) {
            for (let i = 0; i < cbs.create.length; ++i) {
              cbs.create[i](emptyNode, ancestor);
            }
            // #6513
            // invoke insert hooks that may have been merged by create hooks.
            // e.g. for directives that uses the "inserted" hook.
            const insert = ancestor.data.hook.insert;
            if (insert.merged) {
              // start at index 1 to avoid re-invoking component mounted hook
              for (let i = 1; i < insert.fns.length; i++) {
                insert.fns[i]();
              }
            }
          } else {
            registerRef(ancestor);
          }
          ancestor = ancestor.parent;
        }
      }

      // destroy old node
      // 移除老节点
      if (isDef(parentElm)) {
        removeVnodes([oldVnode], 0, 0);
      } else if (isDef(oldVnode.tag)) {
        invokeDestroyHook(oldVnode);
      }
    }
  }

  invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
  return vnode.elm;
};
```

```javascript
/**
 * 更新节点
 */
function patchVnode(
  oldVnode,
  vnode,
  insertedVnodeQueue,
  ownerArray,
  index,
  removeOnly
) {
  // 新旧节点完全一样直接退出
  if (oldVnode === vnode) {
    return;
  }

  if (isDef(vnode.elm) && isDef(ownerArray)) {
    // clone reused vnode
    vnode = ownerArray[index] = cloneVNode(vnode);
  }

  const elm = (vnode.elm = oldVnode.elm);

  if (isTrue(oldVnode.isAsyncPlaceholder)) {
    if (isDef(vnode.asyncFactory.resolved)) {
      hydrate(oldVnode.elm, vnode, insertedVnodeQueue);
    } else {
      vnode.isAsyncPlaceholder = true;
    }
    return;
  }

  // 判断是否为静态节点
  if (
    isTrue(vnode.isStatic) &&
    isTrue(oldVnode.isStatic) &&
    vnode.key === oldVnode.key &&
    (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
  ) {
    vnode.componentInstance = oldVnode.componentInstance;
    return;
  }

  let i;
  const data = vnode.data;
  if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
    i(oldVnode, vnode);
  }

  const oldCh = oldVnode.children;
  const ch = vnode.children;
  if (isDef(data) && isPatchable(vnode)) {
    for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
    if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode);
  }
  if (isUndef(vnode.text)) {
    // 新节点没有text属性的情况
    if (isDef(oldCh) && isDef(ch)) {
      // 新旧vnode的子节点都存在的情况
      // 新旧vnode的子节点不同在就更新子节点
      if (oldCh !== ch)
        updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly);
    } else if (isDef(ch)) {
      // 只有新vnode有子节点
      if (process.env.NODE_ENV !== "production") {
        checkDuplicateKeys(ch);
      }
      /**
       * 判断旧vnode是否有文本
       * 没有：把vnode的子节点添加到真实dom中
       * 有：清空文本，再把vnode子节点添加到真实dom中
       */
      if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, "");
      addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
    } else if (isDef(oldCh)) {
      // 只有就vnode有子节点的情况下
      // 清空dom中的子节点
      removeVnodes(oldCh, 0, oldCh.length - 1);
    } else if (isDef(oldVnode.text)) {
      // 新旧vnode都没子节点，但是旧vnode有文本节点
      // 清空，旧vnode的文本
      nodeOps.setTextContent(elm, "");
    }
  } else if (oldVnode.text !== vnode.text) {
    // 新vnode有文本属性，并且新旧vnode的文本属性不一样
    // 用新vnode的text替换真实dom的文本
    nodeOps.setTextContent(elm, vnode.text);
  }
  if (isDef(data)) {
    if (isDef((i = data.hook)) && isDef((i = i.postpatch))) i(oldVnode, vnode);
  }
}
```

```javascript
function updateChildren(
  parentElm,
  oldCh,
  newCh,
  insertedVnodeQueue,
  removeOnly
) {
  // 四个指针oldStartIdx，newStartIdx，oldEndIdx，newEndIdx
  let oldStartIdx = 0; // 旧vnode第一个位置
  let newStartIdx = 0; // 新vnode第一个位置
  let oldEndIdx = oldCh.length - 1; // 旧vnode最后一个位置
  let oldStartVnode = oldCh[0]; // 旧vnode未处理节点的第一个
  let oldEndVnode = oldCh[oldEndIdx]; // 旧vnode未处理节点的最后一个
  let newEndIdx = newCh.length - 1; // 新vnode最后一个位置
  let newStartVnode = newCh[0]; // 新vnode未处理节点的第一个
  let newEndVnode = newCh[newEndIdx]; // 新vnode未处理节点的最后一个
  let oldKeyToIdx, idxInOld, vnodeToMove, refElm;

  // removeOnly is a special flag used only by <transition-group>
  // to ensure removed elements stay in correct relative positions
  // during leaving transitions
  const canMove = !removeOnly;

  if (process.env.NODE_ENV !== "production") {
    checkDuplicateKeys(newCh);
  }
  // 以新前、新后、旧前、旧后的方式开始对比
  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (isUndef(oldStartVnode)) {
      // oldStartVnode不存在的情况
      // 跳过开始下一个
      oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
    } else if (isUndef(oldEndVnode)) {
      // oldEndVnode不存在同理
      oldEndVnode = oldCh[--oldEndIdx];
    } else if (sameVnode(oldStartVnode, newStartVnode)) {
      // 新前-旧前
      patchVnode(
        oldStartVnode,
        newStartVnode,
        insertedVnodeQueue,
        newCh,
        newStartIdx
      );
      oldStartVnode = oldCh[++oldStartIdx];
      newStartVnode = newCh[++newStartIdx];
    } else if (sameVnode(oldEndVnode, newEndVnode)) {
      // 新后-旧后
      patchVnode(
        oldEndVnode,
        newEndVnode,
        insertedVnodeQueue,
        newCh,
        newEndIdx
      );
      oldEndVnode = oldCh[--oldEndIdx];
      newEndVnode = newCh[--newEndIdx];
    } else if (sameVnode(oldStartVnode, newEndVnode)) {
      // Vnode moved right
      // 旧前-新后，先更新后移动
      patchVnode(
        oldStartVnode,
        newEndVnode,
        insertedVnodeQueue,
        newCh,
        newEndIdx
      );
      // 把旧前节点移动到oldChilren中所有未处理节点之后
      canMove &&
        nodeOps.insertBefore(
          parentElm,
          oldStartVnode.elm,
          nodeOps.nextSibling(oldEndVnode.elm)
        );
      oldStartVnode = oldCh[++oldStartIdx];
      newEndVnode = newCh[--newEndIdx];
    } else if (sameVnode(oldEndVnode, newStartVnode)) {
      // Vnode moved left
      // 旧后-新前
      patchVnode(
        oldEndVnode,
        newStartVnode,
        insertedVnodeQueue,
        newCh,
        newStartIdx
      );
      // 把旧后节点移动到oldChilren中所有未处理节点之前
      canMove &&
        nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
      oldEndVnode = oldCh[--oldEndIdx];
      newStartVnode = newCh[++newStartIdx];
    } else {
      // 不属于以上四种情况，常规循环对比
      // 获取旧孩子节点的key值跟下标索引值的对应关系，oldKeyToIdx会被缓存
      if (isUndef(oldKeyToIdx))
        oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
      // 根据key值找索引
      // 如果新前存在key值，则根据key值，去查找，旧孩子节点中是否存在相同的key值节点，并拿到下标索引值
      // 如果key值不存在，则通过for循环去查找新前节点在旧孩子节点中是否存在相同的节点，并拿到下标索引值
      idxInOld = isDef(newStartVnode.key)
        ? oldKeyToIdx[newStartVnode.key]
        : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
      if (isUndef(idxInOld)) {
        // 如果找不到新前在旧孩子节点的下标索引值，说明是新增的节点
        // 在旧vnode中找不到新vnode的子节点，则新增
        createElm(
          newStartVnode,
          insertedVnodeQueue,
          parentElm,
          oldStartVnode.elm,
          false,
          newCh,
          newStartIdx
        );
      } else {
        // 如果找到了新前在旧孩子节点的下标索引值，还需要进一步判断是否为相同的节点
        vnodeToMove = oldCh[idxInOld];
        if (sameVnode(vnodeToMove, newStartVnode)) {
          // 如果两个节点是相同节点
          // 调用patchVnode更新节点
          patchVnode(
            vnodeToMove,
            newStartVnode,
            insertedVnodeQueue,
            newCh,
            newStartIdx
          );
          oldCh[idxInOld] = undefined;
          // canMove标识是否需要移动节点
          canMove &&
            nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVnode.elm);
        } else {
          // key值相同，但是不同元素，默认为新增
          createElm(
            newStartVnode,
            insertedVnodeQueue,
            parentElm,
            oldStartVnode.elm,
            false,
            newCh,
            newStartIdx
          );
        }
      }
      newStartVnode = newCh[++newStartIdx];
    }
  }
  if (oldStartIdx > oldEndIdx) {
    /**
     * 如果oldChildren比newChildren先循环完毕，
     * 那么newChildren里面剩余的节点都是需要新增的节点，
     * 把[newStartIdx, newEndIdx]之间的所有节点都插入到DOM中
     */
    refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm;
    addVnodes(
      parentElm,
      refElm,
      newCh,
      newStartIdx,
      newEndIdx,
      insertedVnodeQueue
    );
  } else if (newStartIdx > newEndIdx) {
    /**
     * 如果newChildren比oldChildren先循环完毕，
     * 那么oldChildren里面剩余的节点都是需要删除的节点，
     * 把[oldStartIdx, oldEndIdx]之间的所有节点都删除
     */
    removeVnodes(oldCh, oldStartIdx, oldEndIdx);
  }
}
```
