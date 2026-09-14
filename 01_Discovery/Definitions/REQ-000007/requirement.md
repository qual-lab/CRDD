# REQ-000007 出典と不完全性を保つProject View

成果物種別: Discovery Definition
要求ID: `REQ-000007`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Project Viewは、現在状態とともにPropertyごとの出典、改訂版または観測時点、欠測、制限、競合および古さを保持し、所有する正本へ戻れるようにしなければならない。

## 対象と利用状況

Developer、Project Operator、PMが、分散した正本からProjectの現在地と不足を確認し、次の判断へ進む場面。

## 解く問題と望ましい変化

```text
現在: 状態を人やAIが毎回組み立てると、出典、観測時点、読めなかった情報が失われ、完全な現在値と誤認する。
    ↓
望ましい変化: 現在状態をPropertyごとの出典、改訂版または観測時点、欠測、制限、競合、古さとともに理解し、正本へ戻れる。
```

## 採用理由と比較

文書統合は正本責務を壊し、都度AI回答は再探索と回答差が残るため、出典付きRead Modelを採り、Workbenchは価値実証対象とする。

## 成立条件

- 各表示PropertyからSource、RevisionまたはObserved Atへ到達できる
- missing、restricted、stale、conflictingを正常値や空値へ丸めない
- Project Viewは読取り専用で、変更操作は所有正本へ戻る

## 制約

- 要約だけでProject健全性やRelease可否を決めない
- Workbenchという画面方式の採用を要求自体へ固定しない

## 検証意図

完全、欠測、制限、古い、競合する情報源を投影し、利用者が不足を識別して根拠または判断対象へ進めるか観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Developer／Project Operator／PM、現在地確認の契機、再探索から根拠付き理解への変化、不完全性を信じる直前の危険をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000007](../../Analysis/EXP-000007/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
