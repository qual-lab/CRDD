# REQ-000008 CROSなしで成立するRepository作業

成果物種別: Discovery Definition
要求ID: `REQ-000008`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

単一Repository内で完結するCRDDの作業は、CROS、Workbench、Shared Serverまたは別Repositoryを設定・利用しなくても開始し完了できなければならない。

## 対象と利用状況

Developerが一つのRepository内でCodex、Claude Code、CLI、標準Toolを使って日常作業を完了する場面。

## 解く問題と望ましい変化

```text
現在: CROSやWorkbenchの拡張が、単独Repositoryの仕事にもServer設定や横断構成を強制すると、既存の軽い利用を失う。
    ↓
望ましい変化: CROSが未設定、停止または不要でも、Repository内のContextとToolだけで同じ仕事を開始・完了できる。
```

## 採用理由と比較

全作業のCROS統一は障害点を増やし、Local別契約は意味を分岐させるため、Localを基準能力として横断時だけCROSを重ねる。

## 成立条件

- Repository取得後、別Serverなしで標準ToolとAI作業を開始できる
- CROS停止中もRepository内で完結する更新と検証を完了できる
- 横断入口とLocal入口で同じ操作の意味が変わらない

## 制約

- DeveloperへWorkspaceやFederationの理解を強制しない
- 別Repositoryを必要とする仕事までLocalだけで完結したと表示しない

## 検証意図

CROS未設定、停止、利用可能の各状態でRepository内代表作業を実行し、依存と結果差を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Developer、日常の単独Repository作業、追加基盤を意識せず仕事を続ける変化、横断が必要になる境界をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000019](../../Analysis/EXP-000019/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
