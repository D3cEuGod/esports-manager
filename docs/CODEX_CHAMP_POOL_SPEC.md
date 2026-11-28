# Codex 说明：英雄池多样性、熟练度成长与新英雄接入

v2.1.14 由 Claude 完成了数据部分，这份说明交给 Codex 做内核部分。涉及 `src/engine.js`、`src/sim.js` 和 `tests/`。

## 一、已完成的数据改动（接口变更）

1. **`LEGENDS.champOverrides` 现在覆盖全部在册选手。** `build_web.py` 把 `data/pools/pools.json`（由 `data/pools/build_pools.py` 从 2023–2026 职业逐局数据生成）并入这张表，`data/legends/legends.json` 的手工条目优先。每条都有 `picks`（加权出场数，2025–26 计 1，2024 计 0.6，2023 计 0.4，次级联赛 ×0.6）和 `champs`（开档熟练度）。
   - 因此 `genChampPool` 对所有职业选手都走 override 分支。原来按 `meta × proAffinity` 给第 3–8 个英雄排名的逻辑，现在只对新秀和无数据选手生效。
   - `professionalPicks(p)` 现在返回四年加权出场，不再只是 `PRO_PLAYER_DATA` 的 2025–26 计数。`proAffinity`、`playerStyle` 和 `playerProfTier`（85+ 需要 picks ≥ 4）都会读到它。
   - `migrateSave` 里 `!s.legendsVer` 的一次性迁移会把 override 熟练度补进旧档。现在它对所有选手生效，但只影响 v2.1.8 之前的存档，而且只会往上补。如果不想让这些很老的存档被整体抬高，可以把这段限制在 `p.legend || p.tag==='Canyon'`。
2. **`src/champs.js` 补了 44 个英雄**（共 172 个）：`CHAMPS` 行、`CHAMP_TACTICS` 六项分和 `DDRAGON_MAP`（Nunu、Velkoz）。`PRO_PLAYER_DATA` 已用 `build_pro_profiles.py` 重新生成，这些英雄的真实出场已计入 `roles`，所以会进入 `PROFESSIONAL_HEROES`。
3. **Clearlove7 (2017)**：能力和潜力都改为 85（已在 v2.1.12/13 开档的存档因 `legendBaseRating` 已记为 87 不会再调，如需统一可在迁移里按 `legendBaseRating!==base` 再补一次差值），熟练度压到挖掘机 91、螳螂 88、猪妹 82……`tests/run.js` 中对应的断言已同步改为 85 / 87.5 / 86。
4. **平衡核对**：同一批 1500 组随机对阵、AI 自动 BP，用 `evalDraft(d).pA` 对比新旧英雄池：
   - 强队（首发均分高 2 分以上）的预测胜率从 77.1% 变为 76.2%。
   - 各赛区的平均预测胜率变化都在 ±0.9 个百分点以内。
   - 对照组的做法：删掉 override，再对每名选手调用 `genChampPool`。

## 二、待 Codex 实现

### 1. AI BP 过度追版本，导致选人雷同

现状有两处：
- `champFit` 中 `meta>0 ? meta*2.18*clamp(...)`。
- `aiDraftCandidates` 里版本 T0 额外 +1.1，ban 阶段 meta≥2 额外 +2.2。

一个 T0 英雄对任何熟练度 ≥45 的选手都比他自己的精通英雄分高，所以全联盟抢同一批英雄。建议如下：
- 版本加成乘以选手对该英雄的熟练度系数，例如 `clamp((pv-35)/50, 0, 1)`。不熟练的选手吃不到版本红利。
- 招牌（≥85）和精通（≥65）英雄额外加分，量级与 T0 加成相当，比如招牌 +1.2、精通 +0.5。
- 每支队伍给一个稳定的“风格偏好”：用 `hash(teamKey + season)` 选两个 tags。选人时同标签英雄 +0.3~0.5，让不同队伍的阵容思路有差别。

验收：
- 一个赛季的 AI 对局中，每个位置出场前 5 的英雄占比，从现在的 74–86% 降到 65% 左右。
- 强队胜率和赛区强度的变化不超过 2 个百分点（用上面的 pA 对照法）。

### 2. 熟练度越打越趋同

现状：
- `applyGameImpact` 每局固定 +3~11，没有递减。
- `evolveChampPool` 自发练习按 `meta*1.6*proAffinity` 排序，大家练的是同一批版本英雄。
- AI 定向特训也是从版本强势英雄里挑。

建议：
- 增长递减：`gain *= clamp((100-prev)/45, 0.25, 1)`。65 以上明显变慢，85 以上很慢。
- 精通以上数量上限按能力档位：88+ 为 7，84–87 为 6，78–83 为 6，其余为 5。超出时，新晋升的英雄挤掉最久没打的精通英雄（降到 60）。
- 自发练习和 AI 特训的候选：优先 `professionalPicks` 里已有出场、但当前熟练度低于出场排名应有水平的英雄（找回手感），再看风格标签，版本权重降到现在的一半左右。加一点按选手名的稳定随机，避免同位置的人都练同一个。
- `rememberChampProf` 的上限从 11 提到 12，和开档池一致。
- 以后接入子属性“英雄池”（见 `CODEX_SUBSTATS_SPEC.md`）时，用它做熟练度获得与遗忘速度的倍率，比如 0.7~1.3。

验收：
- 连续模拟 3 个赛季。同位置选手两两之间，精通以上英雄集合的平均 Jaccard 相似度，第 3 赛季末不超过开档时的 1.3 倍。
- 开档时，每人精通以上英雄的平均数量和招牌数量与第 3 赛季末相差不超过 1。

### 3. 新英雄接入内核名单

以下名单在 `engine.js` 和 `sim.js` 里写死了英雄名。新英雄目前不在任何名单中，按默认值参与模拟，不会报错。建议加入如下（请按内核含义复核）：

| 名单 | 建议加入 |
| --- | --- |
| `FRONTLINE_CHAMPS` | Shen, Sett, Rammus, Nunu & Willump（Dr. Mundo 已在名单内） |
| `RELIABLE_CONTROL` | Rammus, Nunu & Willump, Fiddlesticks, Sett, Shen, Qiyana, Vex, Lux, Veigar, Anivia, Warwick, Zilean |
| `HARD_SUPPORTS` | Sett, Shen |
| `PEEL_CHAMPS` | Zilean, Shen, Anivia |
| `ENGAGE_STARTERS` | Rammus, Nunu & Willump, Fiddlesticks, Sett, Shen, Qiyana, Vex, Warwick, Zaahen |
| `AOE_FOLLOWUPS` | Fiddlesticks, Qiyana, Vex, Aurelion Sol, Katarina |
| `PROJECTILE_PRESSURE` | Lux, Xerath, Vel'Koz, Heimerdinger, Akshan, Quinn |
| `IMMOBILE_MELEE_TOPS` | Dr. Mundo, Darius, Illaoi, Nasus, Garen |
| `RANGED_TOP_FLEX` | Quinn, Kayle, Akshan, Vladimir, Teemo |
| `MID_FLEX_POOL` | Irelia, Tryndamere, Vladimir, Sett |
| `MELEE_MID`（sim.js） | Qiyana, Zed, Talon, Katarina, Fizz, Kassadin, Ekko, Irelia, Tryndamere |
| `RANGED_X`（sim.js） | Akshan, Quinn, Teemo, Kayle, Heimerdinger |

新英雄的位置、标签和六项分写在 `src/champs.js` 的“补全正式服英雄”段。位置按 2023–2026 职业出场分布取，例如琪亚娜职业赛场主要打野（381 局打野，46 局中单）。

## 三、相关文件

- `data/pools/build_pools.py`、`data/pools/README.md`：生成规则和数据来源。
- `data/pools/pools.json`：生成结果。
- `src/champs.js`：英雄表和重新生成的职业数据。
