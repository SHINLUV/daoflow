# DaoFlow V2 · T09 独立验收 Round 1

## 结论

**总体：PASS_WITH_EXTERNAL_BLOCKERS；BUSINESS_UAT_PENDING。**

候选可在未配置私密服务的本地生产预览中，通过本轮独立浏览器复现首页、六境、问道交接及本地经典阅读。未发现应退回实现的可复现产品缺陷；先前 T08 的 R1 导航层级问题和 R2 移动性能门槛均在本轮复验中关闭。这个结论**不覆盖**真实数据、鉴权、迁移、模型和双用户安全闭环；这些均为 BLOCKED，不能由当前降级路径冒充通过。

## 独立性、冻结对象与环境

| 项目 | 记录 |
| --- | --- |
| reviewerId | `V`（T09 independent acceptor） |
| freshContext | 是；未参与此前开发或 T08 验证，以“实现可能错误”为起点独立操作。 |
| 验收时间 | 2026-09-09 16:48–16:58 Asia/Shanghai |
| 产品候选 commit | `6315e69e3944bc1157bf7eb4e8c718acc516d89b` |
| 验证账本 / HEAD | `4ed45ca6c637422a08403d9e8aa796a6f371e584`；`git status --porcelain` 为空。 |
| 运行对象 | `http://127.0.0.1:3200`，独立 HTTP GET 为 `200`。 |
| 浏览器与工具 | Windows Chromium，经 `npx --package @playwright/cli playwright-cli`；Lighthouse `13.4.1` mobile form factor。 |
| 测试数据 | 无私人数据；仅使用产品内置建议句“工作中找不到方向和意义。” |
| 代码/Git 变更 | 无。仅新增本报告及 `docs/redesign-v2/evidence/T09/6315e69/` 中验收证据。 |

已读的冻结输入及 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `00-HANDOFF.md` | `BD9EFDAF771F4D0DFAAAA9B97220A5F38FD98AD96AC2243F7C4971002AAF32BF` |
| `03-DESIGN-AND-TECH-SPEC.md` | `7D3CC9583B31BA6C1B93217F9A82394012096F9CC5BA2F9DB711B58EFF8EAE7A` |
| `06-TRACEABILITY.md` | `1744AD78080532E42B494591B4FF3B1F8E46BD4D9C3A048EAD63D7295251BFE0` |
| `07-INDEPENDENT-ACCEPTANCE.md` | `B8576D4ACCF33D1A360196C25A6D231DBAF453ED928759ADDB0EA98445B78AFB` |
| `DECISIONS.md` | `458A2AA6D2BA5C748BC93229593295E666993E5DDB04A84955BC3228E307A7B1` |
| `.ai-development/state.yaml` | `974F2517542306777968C85036EAA93097FBDCAFD6217297F8A1EF26E2369B99` |
| `evidence/T08/6315e69/command-summary.md` | `73C09406B5EBD3FCB8441043D3810960DBBBE49E66D4F05F99A8659D95487827` |

## 本轮实际执行命令

```powershell
git rev-parse HEAD
git rev-parse 6315e69
git rev-parse 4ed45ca
git status --porcelain
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3200
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 open http://127.0.0.1:3200 --headed
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 resize 1440 900
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 snapshot
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 click <读经典>
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 click <第8章>
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 resize 390 844
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 click <事业与创业>
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 click <工作中找不到方向和意义。>
npx --package @playwright/cli playwright-cli --session daoflow-t09-v-0849 click <问一问道>
npx lighthouse http://127.0.0.1:3200 --only-categories=performance --output=json --output-path=docs/redesign-v2/evidence/T09/6315e69/lighthouse-mobile-{1,2,3}.json --quiet --chrome-flags=--headless=new
ffprobe / ffmpeg（仅读取 T08 的 WebM，并将 0.00s、1.00s、1.90s 帧导入本轮证据目录供人工检查）
```

每一次 Playwright 点击前均重新取得 accessibility snapshot；结果以实际 URL、可访问名称和页面可见状态判断，并非复述 T08。

## 新证据与人工视觉检查

| 证据 | 检查结果 |
| --- | --- |
| `evidence/T09/6315e69/desktop-home-1440x900.png` (`FF1CD0D71B344BBD4B55352ADF797E057D0955CCDF37062FC16F767A7DB92490`) | **PASS**：纸色、青绿山水、HTML 中文标题、记录/问道分段、可用输入区与主按钮均在 1440×900 首屏内；无摄影拱形首页。 |
| `evidence/T09/6315e69/mobile-home-390x844.png` (`773772E682A2AC8BE275DC481AF9AADF1F11F9580DC8921510F273D16731F31F`) | **PASS**：三个主导航未折成两行；首屏可见模式切换、输入区和保存按钮，未见页面横向溢出。 |
| `evidence/T09/6315e69/motion-video-frames.png`（源视频：`output/playwright-production/visual-motion-DaoFlow-V2-v-1b755-s-and-releases-its-watchdog/video.webm`） | **PASS（既有视频的独立帧审阅）**：源为 VP8 800×450、2.04s、129285 bytes；三帧显示首页→经典目录→首页的可见路由切换，未见黑屏或永久遮罩。 |
| `evidence/T09/6315e69/lighthouse-mobile-{1,2,3}.json` | **PASS**：mobile scores `85/93/93`，中位数 **93**；CLS `0/0/0`。第 1、3 次报告写入后 Chrome 临时目录清理出现 Windows `EPERM`，但三份 JSON 都已解析，不能将其表述为三个零错误进程。 |

### 视觉评分（独立主观评分）

| 维度 | 分数 | 依据与扣分 |
| --- | ---: | --- |
| 层级与任务可见 | 19/20 | 首页记录/问道、输入和单主按钮清楚；移动顶部移除了品牌文字，识别略弱。 |
| 古风美术一致性 | 19/20 | 宣纸、青绿、朱砂印饰与六境插画风格统一；首图视觉占比仍略高。 |
| 中文排版 | 18/20 | 标题、正文、题签层级和可读性良好；手机标题与山水叠置处略紧。 |
| 强交互完成度 | 18/20 | 实点六境切换、建议填入、问道 handoff、章节翻页和可见转场；需配置的保存/收藏不可验。 |
| 手机与状态完成度 | 17/20 | 390px 首屏和“私人记录服务尚未配置”状态清晰；登录数据态、冲突态、搜索/导出成功态均未能独立执行。 |
| **合计** | **91/100** | 每项不低于 15；可运行视觉范围内无硬失败，视觉判定 **PASS**。 |

## 功能与追踪判定

| 需求 | 本轮实际动作和观察 | 判定 |
| --- | --- | --- |
| R01 / U01 | 首页 `记下此刻`/`问一问道`可切换；建议句点击后将文本填入 500 字问题面板，随后实际导航至 `/ask`。 | **PASS** |
| R02 / U02 | 实审 1440×900 与 390×844 截图；AI 山水图片已加载，六境均有可访问图片名称。 | **PASS** |
| R03 / U03 | 实点“事业与创业”后选中态、`行·第64章`、建议句切换；导航点“读经典”到 `/chapters`；审阅路由动效视频帧，未见遮罩卡死。减弱动态、键盘全流程和长任务记录未在本轮完成。 | **PASS（已实测子范围）**；未测项目不外推。 |
| R04 / U04 | `/journal` 正确显示“私人记录服务尚未配置，请稍后再试”，没有假成功；真实保存、刷新、编辑、回收、恢复无法执行。 | **BLOCKED** |
| R05 / U05 | 卷册区在无私密服务状态不提供可伪造内容；真实新建、归卷、归档、时间线不能执行。 | **BLOCKED** |
| R06 / U06 | 问道 handoff 与本地降级实测：`/ask` 展示问题→回应→可信第33章原文→反思问题→读原文，且明示“未配置登录与保存服务，本次回答不会进入历史”。真实 request/RPC/保存重试不可执行。 | **BLOCKED**（仅本地降级 UI 子路径 PASS） |
| R07 / U07 | 章节目录 1–81 与第8章原文、白话开关、收藏控件实测；收藏区明确显示“收藏需要数据库配置；本地经典仍可阅读”。真实收藏/批注持久化不可执行。 | **BLOCKED**（本地阅读子路径 PASS） |
| R08 / U08 | 进入 `/journal` 显示明确服务不可用降级，不伪称空数据。搜索、超过20条翻页、导出和回访条均依赖私密数据，未能执行。 | **BLOCKED** |
| R09 / U09 | 无 Docker Linux daemon / 隔离 Supabase / 双账户 / 真实 token；未执行迁移、RLS、RPC、越权与导出完整性。 | **BLOCKED** |
| R10 / U10 | 已观察收藏 API 在缺配置时返回 HTTP 503 且页面保留本地经典；未能执行真实 401/409、断网保存、跨标签登录和 lease/并发。 | **BLOCKED** |
| R11 / U11 | 目录实际列出 81 章；本地第8章与问道第33章原文/降级回应均可见，原文并非图片 OCR。真实模型路径未配置。 | **BLOCKED**（本地经典/降级子路径 PASS） |

## T08 两项修复复核

| 轮次 | 原失败 | 本轮独立复现 | 结果 |
| --- | --- | --- | --- |
| R1 | 六境装饰层截获顶部“读经典”导航。 | 在生产首页实际通过顶部“读经典”链接导航到 `http://127.0.0.1:3200/chapters`，之后可点第8章并加载原文。 | **PASS，FAIL 已关闭** |
| R2 | mobile Lighthouse `72/69/69`，低于 85。 | 本轮以 Lighthouse 13.4.1 mobile form factor 对运行中的候选独立记录 `85/93/93`，中位数 `93`，CLS 均 `0`。 | **PASS，FAIL 已关闭** |

## 强制保留的 BLOCKED 项

1. Docker Desktop Linux daemon 不可用，隔离 Supabase 不能启动；迁移 `003–006` 未实际执行。
2. 当前过程没有 Supabase 公共配置、anon/session、service role 或 OpenAI API Key；真实 Auth、双用户、RLS、受限 RPC、CAS/幂等、问道请求租约/保存重试、导出与真实模型路径均未验。
3. 不能以本地经典、503 UI、空卷册或问道 fallback 替代上述通过；它们仅证明了相应降级界面没有假成功。
4. 登录/私密数据前置缺失也使搜索、翻页、收藏/批注、卷册、回收恢复/永久删除、导出、真实错误与冲突状态无法形成业务闭环。

## 缺陷

本轮可运行范围内未发现新的可复现 `IMPLEMENTATION_BUG`，故无 FAIL 缺陷单。对所有 BLOCKED 项，在具备隔离 Supabase、两个虚构认证账户和模型/服务环境后，必须按 `07-INDEPENDENT-ACCEPTANCE.md` 重新执行；届时本报告中依赖私密服务的证据失效，不能直接升格为通过。

## 后续门禁

在真实双用户 Auth/RLS/RPC/迁移与模型路径验收前，状态应继续是 `PASS_WITH_EXTERNAL_BLOCKERS`，不可称生产上线、`PILOT_READY` 或业务验收。真实用户尚未试用，**BUSINESS_UAT_PENDING**。
