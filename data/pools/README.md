# 选手初始英雄池

`pools.json` 是每名在册选手的开档英雄池，由 `build_pools.py` 从 Oracle's Elixir 2023–2026 职业比赛逐局数据生成。`build_web.py` 把它并入 `LEGENDS.champOverrides`，引擎的 `genChampPool` 在新开档时直接使用。`data/legends/legends.json` 里手工设定的英雄池（传奇选手、Canyon）优先。旧存档里已有的英雄池不受影响。

## 规则

- 出场按年份加权：2025、2026 年计 1，2024 年计 0.6，2023 年计 0.4。次级联赛（LDL、LCK CL、欧洲地区联赛等）再乘 0.6。只统计选手本位置的出场。
- 英雄按加权出场数排序，再按名次套用熟练度模板 89、86、79、73、67、62、58……按能力档位整体加减（88 以上 +3，84–87 +2，78–83 +1，70–77 不变，70 以下 −1）。顺序完全由选手真实打过什么决定，不看版本强度。
- 出场太少不能虚高：加权 10 局以上才可能到招牌（85+），6 局以上最高 84，3 局以上最高 72，1 局以上最高 58。能力 88 以上最多 3 个招牌，其余最多 2 个。
- 职业通用英雄：2025–26 年一级联赛中，本位置六成以上的常规首发都打过至少 2 局的英雄，该位置所有选手至少 45（熟练）。
- 每人最多 12 个英雄，最少 9 个。数据不足 20 局的选手，先用调研到的近期常用英雄，再用本位置最热门英雄（按选手名轮换，避免人人相同）补到 7 个，最高 72，不给招牌。
- 平衡：和旧生成器相比，各能力档位的招牌数基本不变，精通以上多 0.5–0.9 个，前五英雄均值高 0.6–1.4，各档位上调幅度接近。

## 复算

```sh
python data/pools/build_pools.py 2023.csv 2024.csv 2025.csv 2026.csv
python build_web.py
```

| 年份 | 来源 | SHA-256 |
| --- | --- | --- |
| 2023 | [Samuel-Kelly-hub/Esports-Results-Project@585fd47](https://github.com/Samuel-Kelly-hub/Esports-Results-Project/tree/585fd47690c59f579295efd7c867f96848340634/data)（Git LFS） | `91744b665cab2fe6a4ba2a5fa1647fbcd8a2268abbfd30461a2ecce95ba80662` |
| 2024 | 同上 | `09ae4db6d3b7b6ed8bea77a03f66da82dbbd932f395a9b4634e4a67c75b507f8` |
| 2025 | 见 `data/traits/PRO_PROFILES.md` | `90b48f02b94c8768c90b5c7925eb89d7823db6d4ba3a79df1b1b002a097bbdf8` |
| 2026 | 同上 | `fb65687c8a27f9b8ad54c5611a599947837d316c167393fa1bf3f7e896e4011e` |

`thin_research.json` 是数据不足选手的调研补充（2026-11-28，多数为低可信度的常识推断，只用作补位）。
