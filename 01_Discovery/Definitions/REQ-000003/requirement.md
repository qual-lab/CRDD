# REQ-000003 Objectiveから統合までのProject Lifecycle

成果物種別: Discovery Definition
要求ID: `REQ-000003`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Project Runtimeは、Objective、Milestone、Task間関係、判断待ち、再計画および統合結果を耐久的なProject Lifecycleとして管理し、Taskの部分成功を上位達成へ読み替えてはならない。

## 対象と利用状況

一つのObjectiveやMilestoneを複数Task、人間判断、再計画、統合を通して進めるProject Operatorの場面。

## 解く問題と望ましい変化

```text
現在: 個別Taskの成功だけでは、競合や判断待ちを含む上位Objectiveの達成と、停止後の再開点を説明できない。
    ↓
望ましい変化: Objective、Task関係、判断待ち、再計画、統合、受入を耐久的なProject Lifecycleとして管理し、同じ仕事へ戻れる。
```

## 採用理由と比較

Coordinatorへの機能追加ではProjectの意味がProvider実行へ従属し、外部管理ToolではCRDDの候補・判断・回復と意味がずれるため、独立Application Coreを採る。

## 成立条件

- Objectiveから導いたTaskと関係、Milestoneを同じProject Identityで追跡する
- 判断待ちや競合を成功へ丸めず、人間判断を同じLifecycleへ戻す
- 全Task成功だけでなく統合結果と受入条件が成立した時だけ上位達成を表示する

## 制約

- Project Runtimeへ一般的なProject管理製品の全責務を持たせない
- 人間が決める内容をRuntimeが補完しない

## 検証意図

分岐Task、部分成功、競合、判断待ち、再計画、統合拒否、停止後再開を与え、上位状態と再入場点を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Project Operator、Objectiveを進める状況、部分結果を誤認せず次の判断へ進む変化、Lifecycleの状態と不足をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000008](../../Analysis/EXP-000008/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
