# REQ-000010 Workbench・MCP・CLIの公開契約共有

成果物種別: Discovery Definition
要求ID: `REQ-000010`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Workbench、MCP、CLIおよびTS APIは同じ公開Application Contractを利用し、入口固有の正本、状態、権限判断または更新処理を作ってはならない。

## 対象と利用状況

人はWorkbench、AIはMCP、ScriptやCIはCLI／TS APIから、同じProjectの確認や定型操作を行う場面。

## 解く問題と望ましい変化

```text
現在: 入口ごとにLogic、Store、権限判断、結果形式を作ると、同じProject操作の正本と意味が分岐する。
    ↓
望ましい変化: 利用形態を選びながら、入力検証、Authority、結果、不足、取消、正本更新先が同じ公開契約で成立する。
```

## 採用理由と比較

Workbench専用Logicは第二正本を作り、全入口MCP統一はLocal利用をServer依存にするため、同じApplication ContractのAdapter群を採る。

## 成立条件

- TS API、CLI、MCP、Workbenchの代表操作が同じ公開契約へ接続する
- 入口ごとに同じAuthority、欠測、取消、結果意味を保持する
- 更新はWorkbench等の独自Storeでなく所有正本へ反映される

## 制約

- 非AIの定型処理へAI推論を強制しない
- 公開Application Contractへ内部Eventや管理都合を無制限に入れない

## 検証意図

同じ正常、拒否、部分結果、取消を複数入口から実行し、構造結果と正本Effectを比較する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 各入口の利用者、状況に合うSurface選択、同じ仕事へ迷わず到達する変化、入口固有の操作差をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000021](../../Analysis/EXP-000021/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
