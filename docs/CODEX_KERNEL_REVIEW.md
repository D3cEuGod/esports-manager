# 给 Codex：比赛内核检查与接手说明

> 用法：把本文件全文粘贴给 Codex（或让 Codex 读取 `docs/CODEX_KERNEL_REVIEW.md`）。

## 你的角色

你是《峡谷经理人》（esports-manager）的**比赛内核负责人**。从现在起：

- **你（Codex）负责内核**：`src/sim.js`、`src/engine.js`、`data/traits/`（含特质数据的生成方法）、`tests/`。
- **Claude 负责界面与前端**：`src/ui.js`、`src/watch.js`、`src/style.css`、`src/index.tpl.html`、`build_web.py` / `build.sh` 的打包部分、`src-tauri/` 与 `scripts/`。
- 跨边界的改动（例如回放数据格式、`playGame` 返回字段）先在 PR 描述里写清楚“接口变更”，让另一方同步。

仓库规则：动手前先按 `AGENTS.md` 调用 **grill-me** 技能和用户对齐方案；回复用户用中文。

## 第一项任务：完整检查现有内核

请通读并检查以下文件，输出一份**问题清单**（按严重程度排序：bug → 数值失衡 → 性能 → 可读性），每条写明文件与行号、复现方式、建议修法。先出清单、和用户确认后再改。

### 1. `src/sim.js`

**1v1 SOLO（中路对线状态机，1 秒一步）**
- 入口：`simSolo1v1(teamA, teamB, pickA, pickB, opts)` → `createSolo` + 循环 `soloStep` + `soloResult`。
- 四种胜利条件：一血、100 补刀、一塔、10:00 起缩圈（12:00 前必分胜负）。`soloAllIn` 的 `forced` 分支是缩圈强制决斗。
- 返回值必须保持：`{teamA, teamB, A, B, winner, winReason, dur, frames, log, rec?}`。
- 检查点：胜因分布是否合理（目前约 一血 55% / 补刀 25% / 火圈 14% / 一塔 6%），英雄克制（`isRanged`、`archetype`）是否生效，选手能力差距是否体现。

**5v5 召唤师峡谷（分阶段，DT = 3 秒一步）**
- 入口：`playGame(d, opts)` → `createGame5` + 循环 `step5` + `game5Result`。
- 宏观阶段 `phaseAdj`、战力 `champPow` / `teamPow`、资源 `objTimers` / `takeObj`（小龙、峡谷先锋、虚空巢虫、男爵、远古龙、魂）、团战、推塔、回城出装（`ITEMS` / `BUILDS`）。
- 校准常数：`SIM5 = {TD, FN, SK, IT, LV, SPD, ENC, DT}`。
- `playGame` 返回字段**不得删改**：`w, dur, kA, kB, turA, turB, dragA, dragB, baronA, baronB, goldDiff, mvp, mvpTag, pA, sa, sb, events, bans, picks, blue, first, impacts`。
- 硬性不变量（测试里有）：`sum(sa.k)===kA`、`sum(sb.k)===kB`、`sum(sa.d)===kB`、`sum(sb.d)===kA`，每名选手 `0 <= a <= 本队击杀 - k`。
- 胜率要和 `evalDraft(d).pA` 校准：500 局五分位平均偏差 < 6%（目前 4.6%）。
- 性能：快速模拟每局 < 5 ms（目前测试里平均约 4 ms，P95 约 6 ms，余量偏小）。

**回放存储**：`pushReplay` / `findReplay` / `toggleKeepReplay` / `pushReplayTrim`。最近 10 局保留关键帧，最多 10 局永久保留，更早的只留比分与 KDA。

### 2. `src/engine.js`（与比赛结果相关的部分）

- BP 与阵容评估：`draftPower`、`styleEdge`、`evalDraft`（`pA = sigmoid(diff/5.2)`）。
- 状态 / 心态：五档状态、五档心态，每局最多跨一档；`settleSeriesMental`（连胜/连败放大、决赛加成、0.3×res 回归）。
- 本场实际能力：`matchRating(p, role, ctx)` = `effRating` + 心态档 × 2.0 × 压力 + 国际赛 `big`×0.5 + 淘汰赛 `ko`×0.5。
- 选手特质：`playerTraits`、`traitTags`、`initialForm`（读 `TRAITS[tag].base`）。
- 赛后联动：`applyGameImpact`（状态波动、英雄熟练度成长）。

### 3. `data/traits/traits.json`（选手历史特质）

- 来源：Leaguepedia Cargo API `ScoreboardPlayers`，2023–2026 共 198 个赛事、约 12 万条选手单局记录。
- 单局表现 = 胜负 ±0.6 + 0.4 × 按位置标准化的 log((K+A+1)/(D+1))。
- 字段：`big` 国际赛相对联赛加成，`ko` 淘汰赛相对常规赛/小组赛加成，`stab` 状态波动倍率，`res` 抗压（败后 vs 胜后），`base` 近期状态基线；`n / ni / nk` 为样本量。已按样本量收缩并扣除赛区均值与“强队结构性偏差”。
- 用户要求的手感：Chovy 大赛软脚、Faker 大赛爆发。请复核这些标签在数据上站得住，并检查是否有明显误判的选手。

## 已知待查问题（优先看）

1. **BLG 统治力过强**。用户执教 TES，跑 6 个赛季（每季 7 个冠军）统计：
   - 基线提交 `91e2b43`（旧模拟）：BLG 约拿 64% 冠军；
   - 新模拟 + 关闭特质：约 71%；
   - 新模拟 + 特质全权：约 89%（MSI 几乎全拿）；
   - 现在特质与心态按半权计入：约 79%。
   单次 6 季的波动很大，要多跑几组种子再下结论。可能的原因：阵容强度差（BLG 约 89，其他强队约 85）经过 `sigmoid(diff/5.2)` 与 BO5 叠加后被放大；连胜带来的心态上升形成正反馈；BLG 多名选手有大赛爆发特质。目标是强队仍是热门，但 MSI / 世界赛冠军分布更接近真实（多支队伍都有机会）。
2. 5v5 的 P95 耗时约 6 ms，单局平均离 5 ms 上限只有约 1 ms 余量。
3. 1v1 缩圈局最长 645 s，确认 12:00 前必分胜负在所有分支都成立。

## 不能破坏的接口（前端依赖）

前端 `src/watch.js` 直接读取以下内容，改动前请先和 Claude / 用户沟通：

- 实时观战：`createSolo(...,{record:true})` / `soloStep(g)`，`createGame5(d,{record:true})` / `step5(G)`；读取 `g.F.A/B`、`g.t`、`g.log`、`g.over`、`g.winner`、`g.wave`、`g.tw`、`g.fx`、`g.fxT`，以及 `G.t`、`G.champs`、`G.towers`、`G.front`、`G.obj`、`G.team`、`G.feed`、`G.gs`、`G.fx`、`G.over`、`G.winner`、`G.d`。
- 常量与工具：`SIM_RATE5`（1x = 每秒 15 秒游戏时间）、`SIM_RATE1`、`MAP5`、`ITEMS` / `ITEM_CN` / `itemIconUrl`、`buildTowers`、`fmtSec`。
- 回放格式（`recordOf` / `soloResult().rec`）：5v5 为 `{v, dur, blue, champs, teams, f, st, ev, feed, gs}`，`f` 每 3 秒一帧，`st` 每 12 秒一帧，`ev` 事件码 `K/B/S/T/R/O/F`；1v1 为 `{v, start, f, items, sum2}`，由 `soloFrameAt` 解码。改格式时请提升 `SIM_VER`，并保证旧存档回放能读或能安全降级。

## 约束

- 零外部运行时依赖，原生 JS；`python build_web.py` 仍要产出单文件 `dist/index.html`。
- Windows / Mac / 手机 / Tauri v2 都要能跑。
- 改完运行：`python build_web.py && node tests/run.js`（测试涵盖 1v1 100 局、5v5 300 局、500 局校准、状态心态、回放、完整赛季），全部通过才能提交。
- 统计赛季冠军分布可参考：在 `tests/harness.js` 的 `load()` 之后循环 `newGame('TES')` → `simUntilUser(true)` → `advanceEvent()`，统计 `curEvent().res.champ`。
