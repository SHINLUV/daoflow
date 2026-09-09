# 视觉精修独立验收 Round 1 — FAIL

- reviewerId: polish_acceptance / browser session polish-v
- freshContext: true；未参与产品实现；以 Current implementation may be incorrect 开始。
- 时间：2026-09-09 17:42–17:49 Asia/Shanghai。
- sourceCommit: `888565ba7f46eba61577d923892d9002d6f2a72a`。启动前 `git status --porcelain` 为空，`git rev-parse HEAD` 与候选一致。
- 环境：Windows，http://127.0.0.1:3200，既有 production 服务，HeadlessChrome/152.0.0.0；独立 Playwright CLI session。
- 数据：仅虚构问题“独立验收虚构草稿，保留这段正文。”，未提交云端。
- 技能：完整读取 playwright/SKILL.md 与 CLI reference。没有修改代码、提交 Git 或启停服务。CLI 自动快照缓存位于 .playwright-cli，正式截图位于指定 output/playwright/polish-v。

文档 SHA256：

- 10-VISUAL-POLISH.md: 605B91742B0C0420598EE2F53E435EAB5F02C85B82F8DF83D719A6ACADAD15C3
- 03-DESIGN-AND-TECH-SPEC.md: 7D3CC9583B31BA6C1B93217F9A82394012096F9CC5BA2F9DB711B58EFF8EAE7A
- 07-INDEPENDENT-ACCEPTANCE.md: B8576D4ACCF33D1A360196C25A6D231DBAF453ED928759ADDB0EA98445B78AFB

## 本轮真实检查

| 范围 | 结果与证据 |
|---|---|
| 首页1440×900 / 390×844 | PASS：标题、两模式、输入、唯一主按钮均在首屏；手机按钮 y561 高48；home-1440.png、home-390.png |
| 320/390/768/1440/1920宽度 | PASS：documentElement.scrollWidth分别305/375/753/1425/1905，小于innerWidth，无页面水平溢出（15px为滚动条） |
| 桌面六境 | PASS：六幅单行、首幅约333px其余约184px；点击关系境后End选中无为境，Home回焦虑境，tabpanel匹配；realms-1440.png |
| 手机前后 | PASS：下一境选关系境，轨道scrollLeft269/clientWidth335/scrollWidth1591，上一境回焦虑境；下一画边缘可见，固定导航在底部；realms-390.png |
| 建议取消/Escape | 首次取消保留正文PASS；重复同一建议FAIL，详见PV-01 |
| 移动关闭动态 | PASS：开关转关，html data-dao-motion=off；过渡结束后document.getAnimations()中running为0；跨到第8章仍为关 |
| 经典对开 | PASS：水景与横排引文左右对开；classic-1440.png（截图包含六境与对开上部） |
| 第8章 | PASS：真实链接进入/chapters/8，唯一h1“第8章”，原文完整横排，查看白话可展开，390无溢出；chapter8-390.png |

浏览器操作命令前缀：`npx --package @playwright/cli playwright-cli -s=polish-v`；执行open、snapshot、click、press End/Home/Escape及run-code（仅浏览器测量、截图、点击与填写）。未运行Lighthouse。没有以本轮检查覆盖旧完整验收。

## 缺陷 PV-01

- 对应：R01/R03、S1/S4、本轮“原生dialog支持Escape及草稿保留”。
- 分类：IMPLEMENTATION_BUG；严重度P2；负责：总控首页/编辑器交互。
- 步骤：切换问道→填入虚构正文→点击“最近总是很焦虑，停不下来。”→出现替换框→Escape→再次点击同一建议。
- 预期：再次出现替换确认框，用户可重新决定。
- 实际：dialog count=0，正文未变，点击无可见结果；换另一建议立即正常弹框。
- 第二路径独立复现：点击“我想知道怎样和情绪待在一起。”→“保留原文”→再次点击同一建议，也无框且正文保留。
- 证据：dialog-390.png为首次确认；repeat-suggestion-no-dialog.png为保留后重复点击；运行结果`{"cancel":{"dialogs":0,"text":"独立验收虚构草稿，保留这段正文。"}}`。
- 复验：Escape与“保留原文”两路径各连续点击同一建议3次，每次都能重新打开；再验证确认替换生效且记录模式草稿不受影响。
- 验收脚本曾在Escape后等待已卸载dialog超时；调整为count后确认这是正常卸载。随后等待“保留原文”超时则对应上述重复建议缺陷，两者明确区分。

## 独立主观审美评分

| 维度 | 分数 | 具体扣分与建议 |
|---|---:|---|
| 层级与任务可见 | 18/20 | home-1440右侧题字与主标题视觉重量接近，题字再减约一成可突出任务；输入纸纹略抢占正文净区 |
| 古风一致性 | 19/20 | 六画和首页青绿纸色统一；realms-1440五幅水景山形相似，可再强化“择/流”的独有意象 |
| 中文排版 | 18/20 | realms-390标题最后“响。”落单行，建议适度缩小此处字号或主动分行；桌面六境说明末字换行显碎 |
| 强交互完成度 | 15/20 | PV-01重复建议取消后失效，需修复；画幅选择和键盘本身连贯 |
| 手机与状态完成度 | 18/20 | home-390动态控制文字较细小；realms-390画面在单屏占比高，建议略缩高让出处更快出现；本分仅覆盖本轮公共视觉状态 |
| 合计 | 88/100 | 达到审美分数阈值，不能抵消已复现交互缺陷 |

结论：**本轮FAIL，PV-01修复并新候选复验后才可通过。**

旧缺库Auth/RLS/真实模型验收继续BLOCKED，不属于这次展示修改范围，未重测、未改成PASS。第8章明确显示“收藏需要数据库配置；本地经典仍可阅读”，未出现假收藏成功。真实用户验收保持BUSINESS_UAT_PENDING。本报告不声称上线、真实私密闭环或性能验收完成。
