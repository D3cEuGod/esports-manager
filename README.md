# 峡谷经理人 · 英雄联盟电竞经理

一个以 2026 赛季英雄联盟职业赛事为背景的跨平台电竞经理游戏（支持 **Windows / macOS / 手机** 独立客户端架构与 **单文件网页版**，支持账号登录多端云同步进度）。

## 运行方式

### 1. 网页单文件版（零安装即开即玩）
直接用浏览器打开 `dist/index.html` 即可开始游戏，离线可用。

### 2. Tauri v2 独立桌面软件（支持 Pin 到任务栏 / 后续移植 macOS 与手机）
需要 Node.js、Python 3、Rust 工具链（Windows 需 MSVC + Windows SDK）：
```bash
npm install
npm run build:desktop   # 自动构建 dist/index.html 并编译独立客户端
```
- 客户端将游戏存档独立持久化在系统应用数据目录（`save.json`），清浏览器缓存不丢档。
- 工程采用 Tauri v2 标准 `lib.rs` 跨端入口（`#[cfg_attr(mobile, tauri::mobile_entry_point)]`），在 macOS 上可直接运行 `npm run build:desktop` 打包 `.app`/`.dmg`，后续可通过 `npx tauri android init` / `npx tauri ios init` 打包手机端。

## 多平台账号登录与云存档同步（Supabase）

内置零依赖 **Supabase Auth + 云存档同步引擎**（已默认内置云服务，玩家打开软件直接注册/登录即可跨 Windows、Mac 与手机同步进度，也支持离线游客模式与冲突对比防误覆盖）。

如需自行部署独立的 Supabase 后端：
1. 前往 [supabase.com](https://supabase.com) 免费创建一个项目。
2. 在 Supabase Dashboard → **SQL Editor** 中运行本仓库的 [`supabase/schema.sql`](supabase/schema.sql) 创建带行级安全（RLS）的 `user_saves` 表。
3. 在 Authentication → Providers → Email 中关闭 Confirm email（实现注册即登录），并将 Project URL 与 publishable/anon key 写入 `src/cloud.js` 的 `CLOUD_DEFAULT_CFG` 后重新构建。

## 核心特性

- **LoL 海克斯科技风格 BP**：固定左蓝右红、3+2 独立顶置 Ban 栏、Ban（警示猩红）与 Pick（海克斯鎏金青）强区分、Riot Data Dragon 原生英雄头像（离线自动降级海克斯徽章）、教练组建议、无畏征召锁定池与摇摆位实时互换。
- **实时观战的召唤师峡谷模拟**：5v5 逐 3 秒推进（三路兵线、全部防御塔与水晶、野区、巢虫/先锋、元素龙与龙魂、男爵、远古龙，对线 → 中期 → 后期宏观决策，开团/保护/消耗/抓单标签驱动团战），Canvas 小地图实时观战（1x/2x/4x/8x、暂停、跳过直看结算、Tab 看装备经济、经济差曲线、解说战报）；赛前峡谷 1v1 中路对线同样可实时观看。严格对账的 5 人 K/D/A。
- **状态与心态**：各分五档，按比赛结果逐局变化（每局最多跨一档），国际赛/淘汰赛/决胜局压力越大心态影响越明显；每位选手带有依据历年比赛数据研究的特质（大赛爆发/软脚、大心脏、稳定性、抗压），赛前情报面板可查看。
- **比赛回放**：自动保留最近 10 局完整回放，另可永久保留 10 局。
- **完整 2026 赛季体系**：LPL 第一/二/三赛段、全球先锋赛（First Stand）、MSI、EWC、LPL 世界赛资格赛、全球总决赛、转会窗口与休赛期；LPL 外援上限 2 人全闭环校验。
- **跨平台存储**：桌面/移动端写本地独立文件，网页版回退 `localStorage`，兼容 JSON 导入导出与旧版存档平滑迁移。

## 目录结构

```text
src/                前端源码（engine.js 赛事与规则、sim.js 1v1/5v5 逐秒模拟、watch.js 观战与回放画面、champs.js 英雄池、cloud.js 跨端存储与云同步、ui.js 界面、style.css 样式）
data/*.json         六大赛区约 320 名 2026 赛季选手名单
data/traits/        选手历史特质研究数据（大赛/淘汰赛/稳定性/抗压）
tests/              Node 测试：node tests/run.js（1v1、5v5 不变量与性能、胜率校准、完整赛季）
src-tauri/          Tauri v2 跨平台原生客户端外壳（Rust 原子存档服务 + 图标资源）
supabase/           Supabase 云存档建表与 RLS 安全策略 SQL
build_web.py        将 data/ 与 src/ 打包为单文件 dist/index.html（兼容 Win/Mac/Linux）
build.sh            Bash 快捷构建脚本
```
