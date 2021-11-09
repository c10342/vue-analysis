/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
// 三个阶段：模板解析节点->优化阶段->代码生成阶段
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 模板解析节点：使用正则等方式解析template模板中的指令 class style等数据，行程ast
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化阶段，遍历ast，找出静态节点，并打上标记
    optimize(ast, options)
  }
  // 代码生成阶段，将ast转化为渲染函数
  const code = generate(ast, options)
  return {
    // 抽象语法树
    ast,
    // 渲染函数
    render: code.render,
    // 静态渲染函数
    staticRenderFns: code.staticRenderFns
  }
})
