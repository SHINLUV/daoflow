# DaoFlow V2 视觉精修 · 2026-09-09

用户已授权：在现有成品上研究模板、开源组件与动态案例，实施高级感精修。本次保留 V2 产品范围、路由、私密数据契约和全部既有 BLOCKED，只调整展示与交互。

## 研究与来源

| 来源 | 核验与借鉴 | 落地 |
| --- | --- | --- |
| [Motion](https://github.com/motiondivision/motion) / [官方滚动案例](https://motion.dev/docs/react-scroll-animations) | 官方提供视口触发、分层视差、阅读进度等机制；[MIT 许可](https://github.com/motiondivision/motion/blob/main/LICENSE.md) 已核验 | 借鉴视口触发与小幅分层的机制，以 IntersectionObserver、requestAnimationFrame 和 CSS 自行实现；使用项目原有框架，不增加动画依赖 |
| [MotionSites Heritage Grove](https://motionsites.ai/?prompt=heritage-grove) | 本轮通过 MCP 获取完整参考说明；青绿山水、纸色天空、精细字图层次。它是设计提示模板，未核实第三方影片的再分发许可 | 只借构图，正式页面继续使用 A01–A13 自有生成资产；没有复制其占位链接、商业文案、影片或单文件架构 |
| [React Bits](https://github.com/DavidHDev/react-bits) | 搜索交互组件库并核对 [MIT + Commons Clause](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md)，不能把该库笼统标作无限制 MIT | 本轮未复制组件代码/资产；选用适合纸面产品的自定义轻量实现 |

## 变更和文件所有权

- 总控：首页题字/净区、纸笺装裱、细线标签、经典对开页、进入视口轻移、桌面有限指针视差、阅读纸面与公共导航。所有 API、数据库与业务保存契约不变。
- A：SixRealms.tsx 和 realms.module.css，桌面六画单行展开、手机横滑和前后按钮、键盘 roving tabs。
- 冻结后交全新 V 验证，仅准写报告与证据，禁止改产品。

## 视觉与行为标准

首屏保持标题、两模式、输入、单主按钮可见；右侧竖题字仅宽屏展示。六境仍以明确选择驱动建议，增加键盘左右/Home/End，手机横滑仅作用于画幅轨道。经典区为水景与横排引文对开，所有内容在 JavaScript 加载前可见。动态关闭和系统减少动态要停止背景位移/进入效果；输入聚焦时停止视差。修复 header backdrop-filter 导致移动 fixed 导航被错误定位的隐患。原生 dialog 支持 Escape、焦点约束及草稿保留。

## 回归范围

生产构建、单元、lint、现有生产 E2E；320/390/768/1440/1920 视口、六境一行与键盘、手机导航位置、建议替换/取消、减弱动态、三轮移动 Lighthouse；独立检查另写 polish-round-1.md。旧验收报告保留，只作为历史，不能替代本轮结果。
