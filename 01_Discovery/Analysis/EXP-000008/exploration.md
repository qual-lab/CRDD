# 一つのTaskではなく、Projectの仕事として進める

成果物種別: Discovery Analysis
分析ID: `EXP-000008`

探索ID: `EXP-000008`
状態: 要求採用
主な情報源: v0.19.0、CHG-000057
判断する人: Qual-Lab
記録の性質: CHG-000057、v0.19の設計・検証記録から再構成
時系列根拠: v0.19.0とCHG-000057を起点とする。

## きっかけ

Coordinatorは限定された一つの仕事を安全に実行できた。しかし実際の開発では、一つの目標から複数のTaskが生まれ、途中で人の判断を待ち、結果をまとめ、必要なら計画を直す。Taskが成功しただけでは、目標やMilestoneが達成されたとは言えなかった。

利用者が実際に委ねたい単位は「この一ファイルを直す」だけではなく、「このMilestoneを完了させたい」である。一方、AI実行が返すのは個々のTask結果であり、複数結果の競合、判断待ち、再試行、統合後の受入は別に扱う必要があった。

| 既にあったもの | 足りなかった接続 |
|---|---|
| 限定Taskの実行と独立確認 | ObjectiveからTaskを導くこと |
| 候補成果物と実行結果 | 複数結果を統合して受け入れること |
| 失敗時の回復 | Projectとしてどこから再開するか |
| 人間への判断要求 | 判断結果を同じMilestoneへ戻すこと |

## 本当の問題は何だったか

足りなかったのはTask数を増やす仕組みではない。目標、Task同士の関係、判断待ち、再計画、結果の統合をProjectの状態として持ち、止まっても同じ仕事へ戻れる仕組みだった。

```text
Objective
   ↓ 分解
複数Task ──→ 個別成功
   │             │
   ├─ 競合       │ 個別成功だけでは
   ├─ 判断待ち   │ Objective達成を証明しない
   └─ 再計画     ▼
        ─────→ 統合・受入・Milestone判断
```

## こうすれば解けると考えた

Project Runtimeを、目標を実行可能な仕事へ分け、その進行と判断待ちを管理するApplication Coreとして置くことにした。実際にAIを動かす処理はCoordinatorへ依頼し、MCPはその入口に留める。

| 仮説 | 評価 | 採否 |
|---|---|---|
| Coordinatorへ複数Task機能を足す | 実装は近いが、Projectの意味がProvider実行へ従属する | 不採用 |
| 外部Project管理Toolを正本にする | 可視化は得られるが、CRDDの判断・候補・回復と意味が一致しない | 不採用 |
| Project Lifecycleを独立Coreにする | ObjectiveとTask実行を分離し、人間判断と統合を所有できる | 採用 |

この方向は、Project RuntimeがProject管理全般を抱え込む、Task成功を上位成功へ読み替える、または停止後に同じObjectiveと判断へ戻れない場合に失敗である。

## 選んだこと、選ばなかったこと

- Objective、Milestone、Task Graph、判断待ち、再計画、統合結果を扱う。
- 一部のTask成功から上位目標の成功を推定しない。
- 専用のProject管理製品や巨大な組織Runtimeは作らない。
- 人間が決める内容をRuntimeが補完しない。

## 後から分かったこと

Project RuntimeをCoordinatorの中に置いたままでは、Projectの意味とAI実行の都合が結び付いた。v0.20ではProject Runtimeを独立させ、Coordinatorを実行Portの実装側へ移した。また、状態を持つだけでなく、人が「今どうなっているか」を理解できる投影が必要だと分かった。

## 現在地と次への引き渡し

最小Project Runtimeはv0.19.0で成立した。現在は、複数Repositoryを含むProjectの理解、状態投影、TopicやMeetingとの接続、Workbenchからの利用へ探索が進んでいる。

## 採用した要求

`REQ-000003`: Project Runtimeは、Objective、Milestone、Task間関係、判断待ち、再計画および統合結果を耐久的なProject Lifecycleとして管理し、Taskの部分成功を上位達成へ読み替えてはならない。
