# 同じProject Runtimeを、複数の入口から使う

成果物種別: Discovery Analysis
分析ID: `EXP-000015`

探索ID: `EXP-000015`
状態: 要求採用
主な情報源: v0.20.0、CHG-000064
判断する人: Qual-Lab
記録の性質: CHG-000064、MCP stdio／HTTP設計と検証記録から再構成
時系列根拠: v0.20.0とCHG-000064を起点とする。

## きっかけ

Project RuntimeをAIや外部Toolから使うにはMCPが必要だった。stdioだけでなくHTTPから状態を読みたい要求も出たが、入口を増やすたびに別の処理や結果形式を作ると、Project Runtimeの意味が分かれてしまう。

当時の前提はLocalhost上の利用であり、Remote公開や独立した認証基盤を作ることではなかった。必要だったのは、MCP Clientの接続方式が違っても、同じProject Runtimeの操作と結果を利用できることである。

| 利用側 | 必要な入口 | 共通でなければ困ること |
|---|---|---|
| Desktop AI Client | stdio MCP | Tool名、入力、結果、Error意味 |
| Local App／別Process | Streamable HTTP | Project Identity、権限、状態、取消 |
| Runtime保守 | 共通診断 | どのTransportで失敗したかとEffectの有無 |

## 本当の問題は何だったか

HTTPがないこと自体ではない。Transportごとに状態、権限判断、失敗分類を持つと、同じProjectへ異なる答えを返すことが問題だった。

```text
同じObjective
   ├─ stdio固有の解釈 ─→ Result A
   └─ HTTP固有の解釈 ─→ Result B
                         ↓
入口によってProjectの意味が変わる
```

## こうすれば解けると考えた

MCPを薄いTransport Adapterとし、stdioとlocalhost HTTPのどちらも同じ公開Application Contractへ接続することにした。Local利用ではRemote Serverの運用を要求しない。

| 方向 | 評価 | 採否 |
|---|---|---|
| HTTP用のProject APIを別実装する | 入口は早く作れるが、意味契約が二重化する | 不採用 |
| すべてのLocal入口をMCP Server経由にする | 一つに見えるが、Workbench等のLocal利用までServerへ依存する | 不採用 |
| MCPをTransportに限定し、共通Application Contractを使う | 入口差を保ちつつ仕事の意味を統一できる | 採用 |

stdioとHTTPで正常時だけ一致しても十分ではない。不正入力、判断待ち、回復要求、取消および終了後状態が同じ意味にならなければ、この仮説は成立しない。

## 選んだこと、選ばなかったこと

- stdioとlocalhost HTTPは同じ意味契約を使う。
- MCPはProject状態や更新権限の所有者にならない。
- v0.20ではRemote公開、汎用認証Server、複数Repository横断を扱わない。
- 入口が存在するだけで、上位Capability全体の完成を主張しない。

## 後から分かったこと

Local HTTPが成立すると、別Hostからの接続も同じ延長に見えた。しかしRemoteでは、暗号化、Credential、Workspaceの範囲、応答喪失後の再取得が必要になる。単にlisten先を広げるだけでは安全なRemote MCPにならない。

## 現在地と次への引き渡し

Local MCP／HTTPはv0.20.0で成立した。Remote利用は別の探索として扱い、人間とAIの入口を同じ契約へ揃える課題へ接続している。

## 採用した要求

`REQ-000006`: Localのstdio MCPとlocalhost HTTPはProject Runtimeの同じ公開Application Contractを利用し、Transport固有の状態、権限判断または結果意味を持ってはならない。
