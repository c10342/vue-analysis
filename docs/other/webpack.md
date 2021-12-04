# webpack构建流程

初始化options -> 开始编译 -> 从入口文件开始递归分析依赖的模块，对每个依赖模块进行处理 -> 对模块位置进行解析 -> 开始构建某个模块 -> 使用loader编译文件，生成ast树 -> 遍历ast，当遇见request的一些调用表达式的时候，收集依赖 -> 偶有依赖构建完成，开始优化 -> 输出到dist目录


# loader和plugins区别

loader是文件加载器，能够加载资源，并对资源进行处理，比如压缩，变异等

plugin给webpack提供了各种灵活功能，比如注入环境变量等

loader是运行在打包文件之前，plugin是正整个编译周期都起作用的

loader本质是一个函数，函数的this会作为上下文会被webpack绑定，因此loader不能是箭头函数，函数接受一个参数，就是webpack传递给loader文件的原内容，this是由webpack提供的对象，能够获取当前loader所需要的各种信息，函数中如果有异步操作，需要调用this.callback，同步函数直接return即可

plugin本质是一个具有apply的对象或者是函数。webpack是基于发布订阅模式的，在运行的时候会广播出很多时间，插件通过监听这些事件，就能够特定的阶段执行自己的插件任务。2个核心对象：compiler（new 的时候传入，或者调用函数的时候传入）包含webpack环境的所有配置，包括options，loader，plugin和webpack整个生命周期相关的钩子。compilation（监听钩子函数的回调参数）作为plugin内置事件回调函数的参数，包含了当前模块资源、编译生成的资源变化文件等信息，当检测到一个文件变化，一次新的compilation奖杯创建

# 热更新原理

启动阶段：

在编写未经过webpack打包的源代码后，webpack compile将源码和hrm runtime一起编译成bundle文件，传输给bundle server静态资源服务器

更新阶段：
当某一个文件或者模块发生变化时，webpack监听到文件变化，对文件重新打包，编译生成唯一的hash值，这个hash值用来作为下一次热更新的标识。根据变化的内容生成两个补丁文件，一个是manifest，包含hash和chunkid，用来说明变化的内容，另一个是chunk.js模块

由于socket服务器在hrm runtime和hrm server之间建立websocket链接，当文件发生变化改动时，服务端回向浏览器推送一条消息，消息包含了文件改动后生成的hash值，作为下次热更新的标识，浏览器接收到这条消息之前，在上一次的socket消息中已经记住了此时的hash标识，这时候会创建一个ajax去服务器请求获取变化内容的manifest文件，manifest文件包含重新build生成的hash值，以及变化的模块，浏览器根据manifest文件获取模块变化的内容，从而触发render流程，实现局部更新