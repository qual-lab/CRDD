# 人が見る入口と、AIが使う入口を同じ仕事へつなぐ

成果物種別: Discovery Analysis
探索ID: `EXP-000021`
状態: 要求採用
主な情報源: 現行MCP、Project Runtime、Workbench構想
判断する人: Qual-Lab
記録の性質: Workbench／MCP構想、現行Project RuntimeおよびUX対話から再構成
時系列根拠: 2026-09-13に固定したv0.21構想群で、Repository Federationを利用する入口の依存順とした。

## きっかけ

人はWorkbenchで状態を軽く確認したい。AIや外部ToolはMCPやCLIから同じ情報を使いたい。それぞれ便利な入口を作るだけなら簡単だが、画面とAIが別の状態や別の更新処理を持つ危険があった。

想定している利用者は同じではない。DeveloperはRepositoryとCoding Agentを中心に使い、Project Operatorは現在地や判断待ちを一覧し、Chat Agentは複数Contextを質問・操作する。それでも、同じProject操作の意味まで入口ごとに変える必要はない。

## 本当の問題

入口が複数あることではない。入口ごとにProjectの意味、権限判断、結果形式を作ると、どれが正しいか分からなくなることだった。MCPのTool一覧からProject設計を始めるのも順序が逆である。

## 置いた仮説

Project Runtimeが公開する一つのApplication Contractを先に決め、Workbench、MCP、CLIをその利用者にする。

<a id="workbench-mcp-as-is-to-be"></a>

```text
Workbench ─ TS API ───────────┐
AI ─────── MCP ───────────────┼→ 同じProject Runtimeの公開契約
CLI／外部Tool ─ CLI／TS API ──┘
```

Local Workbenchまで必ずMCP経由にするとServerが必要になるため、同じ契約を直接使えるTS APIも残す。

| 方向 | 利点 | 問題 | 採否 |
|---|---|---|---|
| Workbench内へ専用LogicとStoreを作る | UI開発は独立できる | 第二の正本と更新権限が生まれる | 不採用 |
| すべての入口をMCP経由に統一する | Protocolは一つになる | Local UIやLibraryまでServer運用へ依存する | 不採用 |
| 同じApplication ContractをTS API、CLI、MCPから使う | 利用形態を選べ、意味を一つに保てる | 公開契約の所有範囲を狭く保つ必要がある | 採用 |

同じ型名を使うだけでは成立しない。入力検証、Authority、結果、不足、取消、正本更新先まで一致することが反証条件となる。

## 守ること

- MCPは要求を運ぶが、Projectの意味は所有しない。
- Workbenchは独自Databaseや独自の更新権限を持たない。
- 非AIの定型処理へAI推論を強制しない。
- 共通契約を、何でも入る巨大な箱にしない。

## 現在の判断

WorkbenchとMCPは別の入口として持ち、仕事の意味だけを共有する。Workbenchが本当に人の負担を減らすかは、実際の利用で確かめる。

## 次工程で確かめること

同じ代表操作をTS API、MCP、Workbenchから行い、結果、権限、不足の表示、正本の更新先が一致するか確認する。

<a id="workbench-mcp-sipoc"></a>

| 入力元 | 入力 | 処理 | 出力 | 利用者 |
|---|---|---|---|---|
| Repository、Project Runtime、CROS | Projectと限定された要求 | 入口で検証し、同じ公開契約へ渡す | 出典・改訂版・不足を含む結果 | Workbench、AI、CLI、外部Tool |

## 採用した要求

`REQ-000010`: Workbench、MCP、CLIおよびTS APIは同じ公開Application Contractを利用し、入口固有の正本、状態、権限判断または更新処理を作ってはならない。
