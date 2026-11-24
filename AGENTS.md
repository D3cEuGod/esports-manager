# 峡谷经理人（esports-manager）代理说明

## 规则：每次改进前先用 grill-me

在做任何改进、新功能、修 bug 或重构之前，先调用 **grill-me** 技能，按它的方式逐轮追问用户，直到双方对方案达成共识、用户确认后再动手。不要跳过这一步，也不要替用户做决定；能自己查到的事实（代码、数据、文件）自己去查。

grill-me 的位置：
- Claude Code：`~/.claude/skills/grill-me`
- Codex：`~/.codex/skills/grill-me`（以及 `~/.agents/skills/grill-me`）
- Antigravity：`~/.gemini/config/skills/grill-me`，仓库内也有一份 `.agents/skills/grill-me`

来源：github.com/mattpocock/skills（grilling / grill-me，MIT）。

## 项目背景

- 单文件 HTML 的英雄联盟（LoL）电竞经理游戏，浏览器直接打开 `dist/index.html` 就能玩。
- `src/`：`engine.js` 赛事规则与状态心态，`sim.js` 1v1/5v5 逐秒比赛模拟，`watch.js` 实时观战与回放画面，`ui.js` 界面，`champs.js` 英雄池，`style.css` 样式。
- `data/traits/traits.json`：选手历史特质（构建时生成 `src/traits.js`）。
- 测试：`node tests/run.js`（先运行一次构建生成 `src/data.js`）。
- `data/*.json`：各赛区选手名单。
- `build.sh` / `python build_web.py`（需要 Python 3）把 `data/` 和 `src/` 合成单文件 `dist/index.html`。改完代码或数据后运行 `./build.sh` 重新生成。
- 仓库：github.com/D3cEuGod/esports-manager（main 分支）。