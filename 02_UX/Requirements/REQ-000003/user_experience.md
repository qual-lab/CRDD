# REQ-000003の利用者体験分析

状態: Candidate
要求: `REQ-000003` Objectiveから統合までのProject Lifecycle
探索元: [Project Runtime](../../../01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md)

## 1. なぜこの要求を体験として扱うのか

人間が内部Taskを一つずつ起動・監視しても、Projectの目的が成立したかは分からない。利用者が委ねたいのはTask実行ではなく、Objectiveを受け入れ可能な結果へ進める一連の仕事である。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Task数、Agent log、個別結果から進捗を組み立て直す | Milestoneの成立状態、判断待ち、統合結果をProjectの仕事として理解する |
| 内部処理の節目ごとに再指示する | 許可済みの目標範囲では進行を委ね、判断が必要な時だけ戻される |

## 3. UXへの処置

新しい画面操作を成果にせず、`UX-000009@1`「Milestoneを委ねる」へ変換する。Taskの成功数ではなく、受入、統合、品質および判断状態を区別できることを中心に置く。

## 4. 重要場面、失敗、品質期待

- 依頼時にObjective、受入条件および委ねる範囲を理解できる。
- 進行中は内部Taskを読まなくても、現在地と次の判断要否が分かる。
- 部分Task成功をMilestone完成と表示しない。
- 失敗時は、失われた仕事、保持された結果、再開条件を区別する。

## 5. 下流への引き渡し

IAはObjective、Milestone、Task、Integration、QualityおよびDecisionの関係を分ける。SPECとArchitectureは各状態の成立条件と再開契約を具体化し、総合試験はTask数でなく一連の委任体験を確認する。
