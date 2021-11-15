/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { warn, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

const directive = {
  inserted (el, binding, vnode, oldVnode) {
    if (vnode.tag === 'select') {
      // select标签
      // #6903
      if (oldVnode.elm && !oldVnode.elm._vOptions) {
        // dom渲染更新完毕后触发postpatch
        mergeVNodeHook(vnode, 'postpatch', () => {
          directive.componentUpdated(el, binding, vnode)
        })
      } else {
        // 设置选中的元素
        setSelected(el, binding, vnode.context)
      }
      // 选中的值
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      // textarea标签
      // 获取修饰符
      el._vModifiers = binding.modifiers
      // .lazy - 取代 input 监听 change 事件
      if (!binding.modifiers.lazy) {
        // 监听文本输入框的input事件，在拼写汉字（输入法）但汉字并未实际填充到文本框中（选词）时会触发input事件
        
        // compositionstart 事件触发于一段文字的输入之前
        el.addEventListener('compositionstart', onCompositionStart)
        // compositionend  当文本段落的组织已经完成或取消时，会触发该事件
        el.addEventListener('compositionend', onCompositionEnd)
        // Safari < 10.2 & UIWebView doesn't fire compositionend when
        // switching focus before confirming composition choice
        // this also fixes the issue where some browsers e.g. iOS Chrome
        // fires "change" instead of "input" on autocomplete.
        el.addEventListener('change', onCompositionEnd)
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },
  // 指令所在组件的 VNode 及其子 VNode 全部更新后调用。
  componentUpdated (el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      // 旧的值
      const prevOptions = el._vOptions
      // 当前值
      const curOptions = el._vOptions = [].map.call(el.options, getValue)
      // 检查2个值是否有变化
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // trigger change event if
        // no matching option found for at least one value
        // 是否需要重置值
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          // 通过自定义事件触发changge事件
          trigger(el, 'change')
        }
      }
    }
  }
}

function setSelected (el, binding, vm) {
  // 更新选中的元素状态
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}

function actuallySetSelected (el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  if (isMultiple && !Array.isArray(value)) {
    // 检查value值是否为数组
    process.env.NODE_ENV !== 'production' && warn(
      `<select multiple v-model="${binding.expression}"> ` +
      `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
      vm
    )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      // 多选的情况下
      // 检查options是否被选中
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        // 选中就修改selected
        option.selected = selected
      }
    } else {
      // 单选的情况
      if (looseEqual(getValue(option), value)) {
        // 选中了
        if (el.selectedIndex !== i) {
          // 标记选中的是第几个
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    // 没选中就标记为-1
    el.selectedIndex = -1
  }
}

function hasNoMatchingOption (value, options) {
  return options.every(o => !looseEqual(o, value))
}

// 获取options标签的value值
function getValue (option) {
  return '_value' in option
    ? option._value
    : option.value
}

// 正在输入中（输入中文的情况下）
function onCompositionStart (e) {
  // 添加标志位
  e.target.composing = true
}

// 输入完成
function onCompositionEnd (e) {
  // prevent triggering an input event for no reason
  if (!e.target.composing) return
  e.target.composing = false
  // 触发input事件
  trigger(e.target, 'input')
}

function trigger (el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

export default directive
