# 事件循环

node的事件循环分成六个阶段

- 定时器检测阶段：执行settimeout、setinterval回调函数

- io事件回调阶段：执行延迟到下一个循环的io回调，即上一轮循环中未被执行的io回调

- 闲置阶段：仅系统内部使用

- 轮询阶段：检索新的io事件，执行与io相关的回调

- 检查阶段：setimmediate回调函数在这里执行

- 关闭事件回调阶段：一些关闭的回调函数，比如socket的关闭事件回调函数

每个阶段对应一个队列，当事件循环进入到某个阶段时，将会在该阶段执行回调，知道队列耗尽或者回调的最大数量以执行，那么将进入到下一个处理阶段。除了上述6个阶段还存在，process.nexttick，其不属于事件循环的任何一个阶段，他是在一次事件循环之后，下一次事件循环之前执行的

# require文件查找规则

- 查找缓存的模块

- 如果是内置模块，直接返回

- 如果是绝对路径/开头，则从根目录开始找

- 如果是./开头，这从房钱文件相对位置开始查找

- 如果文件没有后缀名。先从js、json按顺序查找

- 如果是目录，则根据package.json的main字段值确定目录下的入口文件，默认情况是index.js

- 如果是第三方模块，则会引入node_modules文件，如果不在当前仓库，则自动递归从上级递归查找，直到根目录