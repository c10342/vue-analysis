
bfc，即块级格式化上下文，他是页面中的一块渲染区域，并有自己的渲染规则：
- 内部盒子会在垂直方向上一个接着一个放置
- bfc内的相邻盒子margin会发生重叠
- bfc区域不会与浮动元素区域重叠
- 计算bfc高度时，浮动子元素也参与计算
- bfc就是页面上的一个隔离的独立容器，容器里面的子元素不会影响到外面的元素，外面的元素也不能影响到里面的元素

触发条件

浮动元素

overflow不为visible

display：inline-block，flex，inline-flex等值

position：fix  absolute