/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
  expression: string,
  tokens: Array<string | { '@binding': string }>
}

// let text = "我叫{{name}}，我今年{{age}}岁了"
// let res = parseText(text)
// res = {
//     expression:"我叫"+_s(name)+"，我今年"+_s(age)+"岁了",
//     tokens:[
//         "我叫",
//         {'@binding': name },
//         "，我今年"
//         {'@binding': age },
//     	"岁了"
//     ]
// }
export function parseText (
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  const tokens = []
  const rawTokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index, tokenValue
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      // 先把{前面的文本放入tokens中
      rawTokens.push(tokenValue = text.slice(lastIndex, index))
      tokens.push(JSON.stringify(tokenValue))
    }
    // 取出{{}}中间的变量
    const exp = parseFilters(match[1].trim())
    // 把变量改成_s(exp)的形式
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    // 跳过}}，下一轮从}}后面开始
    lastIndex = index + match[0].length
  }
  // 当剩下的text不能再被正则匹配上的时候，表示所有变量已经处理完毕
  // 此时如果lastIndex < text.length，表示在最后一个变量后面还有文本
  if (lastIndex < text.length) {
    rawTokens.push(tokenValue = text.slice(lastIndex))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  }
}
