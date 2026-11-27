# 峡谷经理人（esports-manager）代理说明

## 规则：每次改进前先用 grill-me

在做任何改进、新功能、修 bug 或重构之前，先调用 **grill-me** 技能，按它的方式逐轮追问用户，直到双方对方案达成共识、用户确认后再动手。不要跳过这一步，也不要替用户做决定；能自己查到的事实（代码、数据、文件）自己去查。

grill-me 的位置：
- Claude Code：`~/.claude/skills/grill-me`
- Codex：`~/.codex/skills/grill-me`（以及 `~/.agents/skills/grill-me`）
- Antigravity：`~/.gemini/config/skills/grill-me`，仓库内也有一份 `.agents/skills/grill-me`

来源：github.com/mattpocock/skills（grilling / grill-me，MIT）。

## 分工与模型调度

- **收集信息等工作都交给低消耗模型子代理去做**（如检索目录、扫描代码结构、收集名单与数据事实）；**高消耗模型只负责搭建游戏、分析数据、写代码**。
- **Codex 负责比赛内核**：`src/sim.js`、`src/engine.js`、`data/traits/`、`tests/`。
- **Claude 负责界面与前端**：`src/ui.js`、`src/watch.js`、`src/style.css`、`src/index.tpl.html`、打包脚本（`build_web.py` / `build.sh`）与桌面端（`src-tauri/`、`scripts/`）。
- 跨边界的改动（回放数据格式、`playGame` / `simSolo1v1` 返回字段、`watch.js` 读取的状态字段）要在 PR 描述里写明“接口变更”。接口清单见 `docs/CODEX_KERNEL_REVIEW.md`。

## 验收与发布

- 完成本地改动后，先构建并验证本次涉及的可玩流程。通过后提交该批改动，直接推送到 GitHub 的 `main`，发布对应 GitHub Release 并确认安装包可下载。用户明确要求暂缓发布时按当次要求执行。

## 项目背景

- 单文件 HTML 的英雄联盟（LoL）电竞经理游戏，浏览器直接打开 `dist/index.html` 就能玩。
- `src/`：`engine.js` 赛事规则与状态心态，`sim.js` 1v1/5v5 逐秒比赛模拟，`watch.js` 实时观战与回放画面，`ui.js` 界面，`champs.js` 英雄池，`style.css` 样式。
- `data/traits/traits.json`：选手历史特质（构建时生成 `src/traits.js`）。
- 测试：`node tests/run.js`（先运行一次构建生成 `src/data.js`）。
- `data/*.json`：各赛区选手名单。
- `build.sh` / `python build_web.py`（需要 Python 3）把 `data/` 和 `src/` 合成单文件 `dist/index.html`。改完代码或数据后运行 `./build.sh` 重新生成。
- 仓库：github.com/D3cEuGod/esports-manager（main 分支）。
