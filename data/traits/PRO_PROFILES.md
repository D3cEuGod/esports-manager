# 职业选手英雄池与队友经历

游戏使用 Oracle’s Elixir 的 2025 和 2026 职业比赛快照。取 LPL、LCK、LEC、LCS、CBLOL、LCP 及其美洲合并赛制和国际赛事，范围为 2025 年 1 月 12 日至 2026 年 5 月 22 日。该快照与开档的赛季初名单对应。覆盖 41,690 条有效出场记录，匹配到 301 个游戏选手，找到 869 对至少同场五次的搭档。 [Oracle’s Elixir 数据下载](https://oracleselixir.com/tools/downloads)

- 初始英雄池按同位置职业出场次数和版本适配生成。重名或位置不一致的记录不用于个人档案。样本不足时按本位置的职业常用英雄生成。
- 2026 样本的分位置出场量用于筛出可进入 T0/T1 的候选。生僻选法仍可手动选择并通过比赛或专项训练成长。
- 同一场比赛同队的多次出场可计为搭档经历。常用语言单独由已知个例和游戏内国籍数据的保守默认推断。

## 复算

原始 CSV 从固定提交的公开镜像取得。仓库保留归总后的计数和生成代码。 [镜像提交](https://github.com/chrisvu1007/league-of-legends-match-predictor/tree/29838abc074d60a83c7a9638a456a2d366b5546d/data)

| 年份 | CSV 的 SHA-256 |
| --- | --- |
| 2025 | `90b48f02b94c8768c90b5c7925eb89d7823db6d4ba3a79df1b1b002a097bbdf8` |
| 2026 | `fb65687c8a27f9b8ad54c5611a599947837d316c167393fa1bf3f7e896e4011e` |

```sh
python data/traits/build_pro_profiles.py path/to/2025.csv path/to/2026.csv
python build_web.py
```
