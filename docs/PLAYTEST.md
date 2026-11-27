# DeepSeek 测试玩家

测试程序为现有 AI 和模型各生成一个独立存档，采用相同的初始种子。每份档案连续经营两个电竞年，资格赛和各阶段参赛情况由实际胜负决定。模型在预算和规则内选择转会、首发、常规赛跳过或手打、选边、无畏征召、续约和休赛期特训。每年至少保留一场逐手 BP 和一场快模的验收样本。报告包含各年进度、赛果、选择、调用量，以及针对可玩性、乐趣和操作负担的复盘。

```sh
python build_web.py
node tests/playtest.js --years 2 --seed 20261126 --verify > playtest-report.json
```

默认使用模拟响应，可以离线运行。`--series 2` 可选作短跑。配置环境变量 `DEEPSEEK_API_KEY` 后，通过 `--live` 启用 API。`DEEPSEEK_MODEL` 可选，默认 `deepseek-flash`。模型只接收测试存档中玩家可见的游戏信息。

在管理平台创建密钥后，在项目目录打开 PowerShell。下面的命令通过掩码输入把密钥放在当前终端会话中，适合先验证一场。 [DeepSeek API 密钥管理](https://platform.deepseek.com/api_keys)

```powershell
$env:DEEPSEEK_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'DeepSeek API 密钥' -AsSecureString)).Password
node tests/playtest.js --live --series 1 --max-calls 50
```

```sh
node tests/playtest.js --live --team TES --years 2 --max-calls 5000 --seed 20261126 --verify > playtest-report.json
```

每次运行至多发起 5000 次请求，`--max-calls` 可设更低上限。达到上限后，剩余赛程使用合法的本地决策推进，并在报告计入 `budgetFallbacks`。真实 API 调用按 DeepSeek 的账户用量计费。 [DeepSeek API 定价](https://api-docs.deepseek.com/quick_start/pricing/)

## 专项测试

| 验收 | 命令 |
| --- | --- |
| 比赛内核、赛季结算、BP 胜率校准和强反制对照 | `node tests/run.js` |
| 新档、阵容、资料库、转会、BP、观战、跳过、回放、休赛期、存档和更新入口 | `node tests/features.js` |
| 注册验证码、会话、本地写入、双端同步、冲突和重连 | `node tests/cloud.js` |
| 两整年连续经营，按玩家视角统计活动和反馈 | `node tests/playtest.js --years 2` |

`--verify` 会把三套专项测试的结果一起写入报告，并提供给复盘环节。浏览器验收用独立的 Chromium 配置，在 390 和 1280 像素宽度下运行。云同步与 Tauri 存储桥接使用测试替身。`CHROME_BIN` 可指定本地 Chromium。实际 macOS、手机安装环境和线上邮件需要各自的设备或测试账号。
