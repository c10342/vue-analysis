/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

// 在更新虚拟dom的时候会有不同的钩子函数
// 通过create，update，destroy钩子来实现自定义指令
export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}

function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 新旧vnode有一方涉及到了指令就会调用_update函数去处理
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

// 在渲染dom的钩子函数中执行指令的不同钩子函数
function _update(oldVnode, vnode) {
  // 判断旧节点是否为一个空节点，是，表明当前是节点新创建的节点
  const isCreate = oldVnode === emptyNode
  // 判断新节点是否为一个空节点，是，表明是即将要被销毁
  const isDestroy = vnode === emptyNode
  // 旧指令集合，normalizeDirectives统一格式化指令格式
//   {
//     'v-focus':{
//         name : 'focus' ,  // 指令的名称
//         value : '',       // 指令的值
//         arg:'',           // 指令的参数
//         modifiers:{},     // 指令的修饰符
//         def:{
//             inserted:fn
//         }
//     }
// }
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  // 新指令集合
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)
  // 需要触发inserted钩子函数的指令
  const dirsWithInsert = []
  // 需要触发componentUpdated钩子函数的指令
  const dirsWithPostpatch = []

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // 旧vnode的指令在新vnode中不存在，说明是首次绑定到元素上的一个新指令
      // 触发bind钩子函数
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        // 如果定义了inserted钩子函数，放进dirsWithInsert中
        dirsWithInsert.push(dir)
      }
    } else {
      // 旧vnode的指令在新vnode中存在，说明已经是绑定过了，需要执行更新指令
      dir.oldValue = oldDir.value
      dir.oldArg = oldDir.arg
      // 触发update钩子函数
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        // 如果定义了componentUpdated就保存到dirsWithPostpatch中
        dirsWithPostpatch.push(dir)
      }
    }
  }

  if (dirsWithInsert.length) {
    // 这里没有直接循环dirsWithInsert，然后触发inserted，而是新创建了一个函数
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    if (isCreate) {
      // 合并钩子函数，然后在dom渲染更新的insert钩子函数中调用callInsert函数，确保在插入到节点的时候触发指令的inserted钩子函数
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      callInsert()
    }
  }

  if (dirsWithPostpatch.length) {
    // 同理需要等待组件的vnode和其子vnode全部更新完毕后再执行componentUpdated钩子函数
    // 所以需要将dom渲染更新的postpatch钩子函数和指令的componentUpdated钩子函数进行合并触发
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    // 指令存在于旧的vnode，但是不存在于新的vnode
    // 说明指令被废弃，触发unbind钩子函数

    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
