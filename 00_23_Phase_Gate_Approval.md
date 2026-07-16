# CRDD Phase Gate and Approval

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

# Purpose

本ドキュメントは、CRDDにおいて、各専門層またはDelivery段階を次へ進める際のPhase Gate、承認条件、停止条件、再開条件を定義する。

CRDDでは、文書が作成されたことだけをもって、次工程へ進めてはならない。

また、すべての情報が完全になるまで進行を止めることも求めない。

Phase Gateは、以下を人間とAIが確認するための判断境界である。

```text
何が確定しているか
何が仮説または未決か
何を守る必要があるか
次の活動へ渡せる状態か
どのRiskを受容して進むか
誰がその判断に責任を持つか
```

本標準は、CRDDを固定的なWaterfallへ変えるものではない。

Phase Gateは、上流から下流への意味の連続性を維持しながら、反復、並行作業、Prototype、Technical Spike、部分実装を安全に進めるために利用する。

---

# 1. Basic Principle

CRDDのPhase Gateは、以下の原則に従う。

```text
Gateは文書完成判定ではなく、次の判断へ進めるかの判定である。
Gateは工程全体ではなく、特定のScopeとRevisionへ適用する。
承認は永続的な固定ではなく、その時点のEvidenceに基づく判断である。
未決事項があっても、影響と扱いが明確なら進めてよい。
重大な不確実性を隠したまま進めてはならない。
AIは準備、評価、提案、検証を行えるが、重要な価値判断を自己承認しない。
新しいEvidenceや上流変更があれば、承認済みGateを再開できる。
Gateを通過しても、Context Feedback Loopは終了しない。
```

Gateを通過することは、以下を意味しない。

```text
上流Contextが永久に変更禁止になる
すべての詳細が確定した
将来の手戻りが発生しない
実装案が唯一の正解になった
Riskがゼロになった
```

Gateを通過することは、以下を意味する。

```text
対象Scopeについて、次の活動を始めるためのContextが存在する
守るべきIntentと未決事項が明示されている
進行によって発生するRiskを理解している
必要な人間判断が完了している
次の検証方法が定義されている
```

---

# 2. Gate Is Scoped and Revisioned

Phase Gateは、Project全体へ一括適用することを基本としない。

原則として、以下のいずれかの単位へ適用する。

```text
Feature
Use Case
Change Package
Release Scope
Architecture Decision
Prototype / Experiment
Legacy Reconstruction Scope
```

例:

```text
Gate Type: UI / Behavior Contract Accepted
Scope:
- FTR-000012
- UC-000012
- UI-000021
- REQ-000044
Revision: 3
```

同じProject内でも、Featureごとに異なるGate状態を持ってよい。

```text
Feature A: Implementation Verified
Feature B: UI / Behavior Contract In Review
Feature C: Discovery Framed
```

## 2.1. Approval Is Version-Specific

承認は、対象Contextの特定Revisionに対して行う。

承認後に意味のある変更が入った場合、過去の承認を暗黙に流用してはならない。

以下のいずれかを行う。

```text
軽微変更として既存Gateを維持する
影響範囲だけ再Reviewする
GateをReopenedへ戻す
新しいGate Revisionを作成する
```

判定理由を追跡可能にする。

---

# 3. Gate Components

各Gateは、最低限以下の要素を持つ。

| Item | Meaning |
|---|---|
| `Gate Type` | 何を判断するGateか |
| `Scope` | 対象Feature、Use Case、Context ID、Change等 |
| `Revision` | どのRevisionを評価したか |
| `Entry Context` | Gate Reviewを開始するために必要なInput |
| `Review Questions` | 人間とAIが確認する論点 |
| `Exit Criteria` | 次へ進めるための条件 |
| `Stop Conditions` | 進行を止める条件 |
| `Open Questions` | 未決事項と影響 |
| `Evidence` | 判断を支える根拠、検証結果、Artifact |
| `Approver` | 最終判断者 |
| `Conditions` | 条件付き承認時に残す義務 |
| `Reopen Triggers` | Gateを再評価する条件 |
| `Result` | 承認、条件付き承認、却下等の結果 |

Gateのためだけに重い文書を追加する必要はない。

ただし、後から以下を説明できなければならない。

```text
何をReviewしたか
何を根拠に進めたか
何が未決だったか
誰が判断したか
どの条件で再確認が必要か
```

---

# 4. Standard Gate Status

以下を標準Statusとする。

| Status | Meaning |
|---|---|
| `Not Evaluated` | Gate評価をまだ開始していない |
| `Ready for Review` | Entry Contextが揃い、Review可能 |
| `In Review` | 人間またはAIが評価中 |
| `Approved` | Exit Criteriaを満たし、次へ進める |
| `Conditionally Approved` | 条件を追跡する前提で進める |
| `Rejected` | 現状では次へ進めない |
| `Reopened` | 承認後の変更または新Evidenceにより再評価が必要 |
| `Superseded` | 後続Gate Revisionに置き換えられた |

## 4.1. Conditionally Approved

`Conditionally Approved`は、未決事項を隠して進むためのStatusではない。

以下を必須とする。

```text
未達条件
進めてよい範囲
進めてはいけない範囲
Risk
解消方法
Owner
確認期限または次の確認地点
未解消時の影響
```

条件が長期間放置される場合、Gateを`Reopened`または`Rejected`へ戻す。

## 4.2. Rejected Is Not Failure

`Rejected`は、作業者や提案の失敗を意味しない。

以下のような状態を正しく検知した結果である。

```text
Whyが不明確
Evidenceが不足
UXとIAが矛盾
UIとBehaviorが対応していない
技術制約によりIntentを満たせない
検証結果がAcceptance Criteriaを満たさない
重大Riskの受容判断がない
```

拒否理由と次に必要な行動を明示する。

---

# 5. Canonical Product Lifecycle Gates

Product Lifecycle Profileでは、以下を標準Gate候補とする。

すべてを必ず独立した会議や文書として実施する必要はない。

小規模なScopeでは複数Gateを統合してよい。

```text
G0 Discovery Framed
G1 Origin / Problem Accepted
G2 UX Direction Accepted
G3 IA Coherence Accepted
G4 UI / Behavior Contract Accepted
G5 Delivery Plan Accepted
G6 Implementation Verified
G7 Outcome / Learning Reviewed
```

Gate番号は標準的な並びを示すだけであり、固定工程順やIDとしての利用を必須としない。

---

# 6. G0: Discovery Framed

## Purpose

原始的な思い、観察、要求、課題候補を、次の判断へ進められるContextとして整理できているか確認する。

## Entry Context

```text
人間の発言、メモ、資料、観察、問い合わせ等のRaw Context
関連する既存ContextまたはEvidence
分かっている制約
```

## Review Questions

```text
なぜ今このTopicを扱うのか
誰のどんな状況に関係するか
事実、解釈、仮説、解決案が区別されているか
元の言葉や思いが失われていないか
次に何を調べる、決める、試すべきか
```

## Exit Criteria

```text
Origin CandidateまたはTriggerが記録されている
Problem CandidateまたはOpportunityが説明できる
EvidenceとHypothesisが区別されている
重要な不明点が明示されている
次のRouteが選択されている
```

## Stop Conditions

```text
AIがWhyを創作している
発言者の意図が大きく変形されている
事実と推測が混在している
次に何を判断するか不明
```

## Standard Routes

```text
Research
Decision
UX Discovery
IA Modeling
Prototype
Technical Spike
Existing Context Update
Roadmap Candidate
No Action / Archive
```

---

# 7. G1: Origin / Problem Accepted

## Purpose

何を守り、誰の何を解決し、なぜProductまたはChangeとして扱うのかを、人間が確認する。

## Entry Context

```text
Origin / Intent
ProblemまたはOpportunity
主要Evidence
対象User / Actor
Desired Outcome候補
Non-goal候補
```

## Review Questions

```text
本当に扱う価値がある問題か
症状ではなく問題を捉えているか
Solutionありきになっていないか
誰の価値を優先するか
何を犠牲にしてはならないか
今回扱わないものは何か
```

## Exit Criteria

```text
Human OwnerがOrigin / Intentを確認している
ProblemまたはOpportunityが説明できる
主要Evidenceと不確実性が明示されている
対象User / Actorが特定されている
Desired Outcomeの方向が説明できる
重要なNon-goalまたはScope境界がある
```

## Stop Conditions

```text
作る理由が実装案だけで説明されている
解決対象が誰か不明
Evidenceのない仮説が事実として扱われている
Human Ownerが意味づけを確認していない
```

## Approval Authority

Origin、Intent、優先する価値、Non-goalの最終承認は人間が行う。

AIは承認してはならない。

---

# 8. G2: UX Direction Accepted

## Purpose

ProductまたはFeatureによって、利用者をどの状態へ変えるかを確認する。

## Entry Context

```text
承認または確認されたOrigin / Problem
対象User / Actor
Current Situation
Desired Outcome
UX Hypothesis
主要Constraint
```

## Review Questions

```text
利用前後の変化が説明できるか
単なる機能一覧ではなくOutcomeになっているか
利用者の行動、認識、感情のどこを変えるか
成功と失敗をどう観察するか
避けるべき体験は何か
上流Intentを正しく受け継いでいるか
```

## Exit Criteria

```text
主要UX OutcomeまたはExperience Principleが存在する
Current / Desiredの差が説明できる
成功を観察する方法が定義または仮説化されている
重要なPain、Risk、Anti-experienceが明示されている
Origin / ProblemとのRelationを追跡できる
Human OwnerがUXの方向を確認している
```

## Stop Conditions

```text
UXが画面案または機能案だけで表現されている
誰の変化か不明
上流Problemと無関係な体験目標になっている
評価方法がなく、抽象語だけで終わっている
```

---

# 9. G3: IA Coherence Accepted

## Purpose

UX Outcomeを成立させるための概念、情報、行動、責務、Navigationが一貫しているか確認する。

## Entry Context

```text
UX Outcome / Principle
主要Feature / Use Case候補
対象Domainの概念
既存IAまたはLegacy Structure
Constraint
```

## Review Questions

```text
利用者が理解すべき主要Objectは何か
概念の責務と境界が明確か
同じものを複数名称で扱っていないか
一覧、詳細、履歴、状態の関係が一貫しているか
Navigationや情報優先度がUXを支えているか
将来の変更へ耐えられる構造か
```

## Exit Criteria

```text
主要Object / Entity / Conceptが定義されている
責務と関係が説明できる
主要Use Caseと情報構造の対応が確認できる
Navigationまたは情報到達構造が説明できる
未決の構造問題と影響が明示されている
UX ContextとのRelationを追跡できる
```

## Stop Conditions

```text
画面一覧だけでIAを代用している
同一概念が矛盾した意味で使われている
FeatureごとにObject定義が分裂している
UX上重要な情報へ到達できない
```

## Approval Authority

重要な概念境界、Navigation責務、共通Objectの変更は、人間または権限を委任された専門Ownerが承認する。

---

# 10. G4: UI / Behavior Contract Accepted

## Purpose

同じFeature、Use Case、User Actionについて、人間に見える契約とSystemの振る舞いの契約が整合しているか確認する。

## Entry Context

```text
対象Feature / Use Case / User Action
UX Context
IA Context
UI Contract
Behavior Requirement / SPEC
State / Error / Permission条件
Prototypeまたは必要なVisual Artifact
```

## Review Questions

```text
利用者が何を認識し、何を操作できるか
操作前後に何が見えるか
SystemはどのConditionで何を行うか
UI StateとSystem Stateが対応しているか
Loading / Empty / Error / Permission / Disabledが定義されているか
AI提案、承認、実行、検証を混同していないか
Acceptance Criteriaが検証可能か
```

## Exit Criteria

```text
UI ContractとBehavior Requirementが同じ対象へ接続されている
主要ActionごとにTrigger、Feedback、Resultが対応している
主要StateとTransitionが説明できる
Error / Exception / Permission条件が定義されている
未対応のUIまたはBehaviorが明示されている
Acceptance Criteriaまたは検証方法が存在する
UX / IAとのRelationを追跡できる
```

## Stop Conditions

```text
UIに存在する操作のBehaviorが未定義
System StateがUIから認識できない
SPECに存在する重要状態をUIが表現していない
Figmaの見た目だけで仕様確定とみなしている
曖昧なBehaviorを実装者判断へ丸投げしている
```

## Approval Authority

重要な画面責務、利用者へのFeedback、状態遷移、権限、Acceptance Criteriaの変更は、人間が承認する。

機械的な整合確認はAIまたはToolが実行してよい。

---

# 11. G5: Delivery Plan Accepted

## Purpose

承認済みまたは条件付きのProduct Contractを、現在の技術、制約、体制で安全に実現できる計画へ変換できているか確認する。

## Entry Context

```text
対象UI / Behavior Contract
Architecture Context
既存Code / System / Integration
Implementation Plan
Task / Dependency
Migration / Compatibility方針
Verification Plan
```

## Review Questions

```text
上流IntentとContractを満たせるか
変更境界とNon-goalが明確か
依存関係と実施順が妥当か
Security、Data、Migration、Compatibilityへの影響は何か
PrototypeまたはTechnical Spikeが必要か
どのEvidenceで完了を確認するか
中断、再開、切戻しが可能か
```

## Exit Criteria

```text
Implementation ScopeとBoundaryが定義されている
主要DependencyとRiskが明示されている
上流ContractとのTraceがある
Taskが検証可能な単位へ分解されている
Test / Validation Planがある
Migration / Rollbackが必要な場合は方針がある
重要なArchitecture Decisionが人間承認されている
```

## Stop Conditions

```text
実装計画が上流Contractを参照していない
AIまたは実装者が無断でScopeを変更している
重大なSecurity / Data Riskが未評価
完了条件が「コードを書いた」だけ
切戻し不能な変更の判断がない
```

## Approval Authority

以下は人間承認を必須とする。

```text
主要Architecture変更
DB SchemaまたはData Migration
Security / Governance境界
外部Interfaceの破壊的変更
重要なScope / Cost / Schedule Trade-off
上流Intentを弱める代替案
```

---

# 12. G6: Implementation Verified

## Purpose

実装が存在することではなく、対象Contractを満たし、Fresh Evidenceによって成立が確認されているかを判定する。

## Entry Context

```text
実装差分
対象UI / Behavior / Architecture Contract
Test Result
Static Analysis / Build Result
Manual Verification Evidence
Known Limitation
```

## Review Questions

```text
実装は対象Requirementを満たしているか
対象外の変更を含んでいないか
Testは実際に実行されたか
重要なUI StateとExceptionを確認したか
既存機能へのRegressionはないか
Known Limitationを隠していないか
Contextと実装が同期しているか
```

## Exit Criteria

```text
対象Contractごとの検証Evidenceがある
必要なTest / Build / Reviewが成功している
重要なFailure Caseが確認されている
実装差分とContext差分が説明できる
Known Limitationと残Riskが明示されている
独立ReviewまたはFresh Context Reviewが必要な場合は完了している
Human Acceptanceが必要なScopeでは承認済み
```

## Stop Conditions

```text
AIまたは実装者の自己申告しかEvidenceがない
Testを作成したが実行していない
古いEvidenceを流用している
Requirementと実装の対応が不明
重大なErrorまたはRegressionを既知のまま隠している
```

## Fresh Evidence Rule

完了宣言には、対象Revisionに対して新しく取得したEvidenceを使用する。

以下だけでは完了Evidenceにならない。

```text
以前のBuild成功
変更前のScreenshot
AIの「問題ありません」という説明
実行していないTest Code
未確認のMock Result
```

---

# 13. G7: Outcome / Learning Reviewed

## Purpose

ProductまたはChangeが意図した価値を生んだか、何を学び、どのContextへ戻すかを確認する。

## Entry Context

```text
実装・Release結果
User Feedback
利用状況
Quality / Incident Evidence
UX Outcome仮説
Known Limitation
新しいConstraintまたは発見
```

## Review Questions

```text
意図したOutcomeは支持されたか
どの仮説が支持または反証されたか
想定外の価値または問題は何か
UX、IA、UI、SPEC、Architectureのどこを更新すべきか
一般化してCRDDへFeedbackすべき知見はあるか
次のChangeまたはRoadmap候補は何か
```

## Exit Criteria

```text
結果と解釈が区別されている
主要な学びが記録されている
更新対象Contextが明示されている
必要なDecisionまたはRoadmap候補が作成されている
残課題が追跡可能である
完了とみなさない事項が明示されている
```

## Stop Conditions

```text
Releaseしたことだけで成功とみなしている
User Outcomeを確認せず内部指標だけで結論づけている
失敗や制約をContextへ戻していない
新しいEvidenceを既存思想へ無理に合わせている
```

---

# 14. Gate Applicability

すべての活動へ、すべてのGateを適用する必要はない。

適用Gateは、Scope、Risk、変更種別、CRDD Profileによって決める。

## 14.1. Example Applicability Matrix

| Activity | Typical Gates |
|---|---|
| Idea / Concept Exploration | G0, G1, 必要に応じてG2 |
| UX / IA Redesign | G1, G2, G3, G7 |
| New UI Feature | G1〜G7 |
| Small Behavior Change | G4〜G7 |
| Internal Refactoring | G5, G6, 必要に応じてG7 |
| Security Change | G1, G4, G5, G6, G7 |
| Prototype | G0, G1, 目的に応じた限定Gate, G7 |
| Legacy Reverse Engineering | G0, 復元対象に応じたG1〜G5, G6 / G7 |
| Documentation-only Correction | 必要な差分Reviewのみ |

## 14.2. Gate Tailoring

Gateを統合、省略、順序変更する場合、以下を説明できなければならない。

```text
なぜTailoringするか
省略しても失われない責務は何か
Riskは何か
代替確認方法は何か
誰がTailoringを承認したか
```

小規模であることだけを理由に、価値判断や重大Risk Reviewを省略してはならない。

---

# 15. Approval Authority

Gateごとに、以下の役割を区別する。

| Role | Responsibility |
|---|---|
| `Author` | Context、Design、Plan、Implementation等を作成する |
| `Reviewer` | 矛盾、欠落、Risk、品質を確認する |
| `Approver` | 進める、止める、条件付きで進める判断を行う |
| `Evidence Provider` | Test、Research、Observation等の根拠を提供する |
| `Owner` | 対象Contextまたは結果へ継続的な責任を持つ |

同一人物が複数Roleを兼務してよい。

ただし、高Riskな変更では、AuthorとReviewerを可能な範囲で分離する。

## 15.1. Human Approval Required

以下は、人間の明示承認を必要とする。

```text
Origin / Intent / Product Principle
対象Userと優先する価値
Non-goalと重要Scope
UX Direction
重大なIA責務変更
重要なUI / Behavior Contract
Security / Governance / Privacy
破壊的Data / Interface変更
Roadmap優先順位
Releaseまたは運用上の重大Risk受容
```

## 15.2. AI Role

AIはGateにおいて、以下を行ってよい。

```text
Entry Context不足の検知
RelationとTraceの確認
Review Questionへの回答案
矛盾、欠落、Riskの指摘
Exit Criteriaの機械的評価
Gate Resultの推奨
Gate Recordの草案作成
Evidenceの収集と要約
再開条件の検知
```

AIは、重要なGateを自分で作成し、自分でReviewし、自分で最終承認したことにしてはならない。

## 15.3. Automated Quality Gate

以下のような機械的判定は、自動Gateとして運用してよい。

```text
Build成功
Schema Validation
Link切れ検査
Required Field検査
Trace欠落検査
Test Pass
Lint / Type Check
Artifact Version一致
```

自動Gateの成功は、人間の価値判断やUX受入を代替しない。

---

# 16. Evidence Standard

Gate判断に利用するEvidenceは、以下を満たすことが望ましい。

```text
対象ScopeとRevisionが分かる
取得日時が分かる
取得方法が分かる
事実と解釈が区別されている
再確認可能または再現可能である
制約と限界が明示されている
```

## 16.1. Valid Evidence Examples

```text
User Interview Record
Observation
Prototype Review Result
Figma Prototype
Usability Finding
API / Schema Validation
Build / Test Log
Screenshot / Video
Runtime Log
Migration Dry Run
Security Review
Manual Acceptance Result
Production Metric
Incident Record
```

## 16.2. Evidence Strength

すべてのEvidenceを同じ強さとして扱わない。

例:

```text
AI推定 < 関係者証言 < 実際の操作観察 < 再現可能な実行結果
```

ただし、Evidenceの強さはDomainと判断対象によって異なる。

単純な順位だけで機械決定せず、ProvenanceとLimitを明示する。

---

# 17. Reopen Rule

承認済みGateは、以下の場合に再開する。

```text
上流Origin / UX / IA / Contractが変更された
前提またはHypothesisが反証された
新しいEvidenceが重大な矛盾を示した
実装制約により承認済みIntentを満たせない
Security / Privacy / Legal Riskが判明した
対象Scopeが大きく追加された
Conditional Approvalの条件が期限内に解消されない
検証でRegressionまたは未達が判明した
Legacy解析で新しい事実が見つかった
```

再開時は、すべてを最初からReviewする必要はない。

Impact Analysisに基づき、影響するGateとContextだけを再評価する。

```text
変更Context
↓
Relation / Traceをたどる
↓
影響Gateを特定する
↓
必要範囲だけReopened
```

---

# 18. Legacy / Brownfield Application

LegacyまたはBrownfield環境では、完全なContextや信頼できる正本が最初から存在することをGate条件にしない。

Gateは、以下を確認するために利用する。

```text
現在確認できた事実は何か
どの情報源をEvidenceとしたか
どこまでが推定か
Recovered ContextのConfidenceはどの程度か
次の解析または変更へ進めるRiskを理解しているか
```

例:

```text
Observed Behavior: 実行環境で確認済み
Recovered Requirement: 複数Evidenceから推定
Recovered Intent Candidate: 関係者未確認
Gate Result: Conditionally Approved
Condition: Product Owner確認前に仕様変更へ利用しない
```

Legacyでは、最初のGate目的を「正解の承認」ではなく、**不確実性を保ったまま安全に復元を進めること**へ調整してよい。

---

# 19. Compact, Standard, and Extended Operation

## 19.1. Compact

個人開発、小さな変更、低Risk Scopeでは、複数Gateを一つのReview Noteへ統合してよい。

```text
Context / Intent
UI / Behavior
Plan
Verification
Human Decision
```

ただし、重要な人間判断とVerification Evidenceは省略しない。

## 19.2. Standard

FeatureまたはChange Package単位で、該当Gateを個別に記録する。

```text
Gate Status
Scope
Criteria
Findings
Decision
Evidence
```

## 19.3. Extended

複数Team、高Risk、企業向け、Security、Regulated Domainでは、以下を追加してよい。

```text
Role / Authority Matrix
Formal Sign-off
Approval History
Independent Review
Compliance Evidence
Waiver Management
Release Baseline連携
```

CRDD Coreは、特定の会議体や承認システムを強制しない。

必要な判断と責任が追跡可能であることを求める。

---

# 20. Standard Gate Record

Gate Recordは、Markdownまたは機械可読Registryで管理してよい。

以下を標準例とする。

```yaml
gate_id: GATE-000012
gate_type: UI_BEHAVIOR_CONTRACT
scope:
  - FTR-000012
  - UC-000012
  - UI-000021
  - REQ-000044
revision: 3
status: CONDITIONALLY_APPROVED
entry_context:
  - UX-000004
  - IA-000008
review_questions:
  - UI actionとBehaviorが対応しているか
  - Error / Permission状態が定義されているか
findings:
  - Retry behaviorは定義済み
  - Offline表示は未決
conditions:
  - id: COND-001
    description: Offline時のUI / Behaviorを実装開始前に確定する
    owner: Human
    due_before: G5
approver: Human
reviewed_at: 2026-07-16
evidence:
  - ART-000031
  - EVD-000017
reopen_triggers:
  - Permission model change
  - IA object responsibility change
```

このSchemaは実装例であり、Gate Resultの意味責務を示す。

---

# 21. Relation to Decision Log

すべてのGate Resultに、独立したDecision Logを作る必要はない。

以下の場合は、`95_Decisions`へDecisionを残す。

```text
複数案から重要な選択を行った
上流IntentまたはNon-goalを変更した
重大Riskを受容した
Gateを条件付きで進める理由が重要
Architecture / Security / Governance方針を決めた
過去の承認を撤回または置換した
```

Gate Recordは「進める状態か」を記録する。

Decision Logは「なぜその重要判断をしたか」を記録する。

両者を混同しない。

---

# 22. Anti-patterns

以下をCRDDのPhase Gate運用として認めない。

## 22.1. Document Completion Gate

```text
テンプレートが全部埋まったため承認する
```

文書量ではなく、意味、判断、Risk、次の検証可能性を確認する。

## 22.2. Hidden Uncertainty

```text
未決事項を残したまま、Approvedとして扱う
```

未決事項が進行へ影響する場合は、Conditionally ApprovedまたはRejectedとする。

## 22.3. AI Self-Approval

```text
AIが作成、Review、承認をすべて完了したことにする
```

重要判断には人間承認を必要とする。

## 22.4. Permanent Freeze

```text
一度承認したため、上流Contextを二度と変更しない
```

新Evidenceに基づく変更と再開を許容する。

## 22.5. Approval Without Scope

```text
UI承認済み
仕様承認済み
```

何のFeature、Use Case、Revisionを承認したか不明な承認は無効とする。

## 22.6. Implementation Equals Acceptance

```text
実装が完了したためGate通過
```

Contractに対するFresh Evidenceが必要である。

## 22.7. Conditional Approval Without Tracking

```text
細かい点は後で決める前提で進める
```

Condition、Owner、解消地点、未解消時の影響を記録する。

## 22.8. Review Meeting as Ceremony

```text
会議を開催したためGateを通過した
```

会議の有無ではなく、Criteriaと判断結果を記録する。

---

# 23. Minimum Compliance

Phase Gateを利用する場合、最低限以下を満たす。

```text
Gateの対象Scopeを明示する
対象Revisionまたは時点を識別する
次へ進める条件を説明できる
未決事項とRiskを隠さない
人間承認が必要な判断をAIだけで確定しない
判断を支えるEvidenceを残す
条件付き承認を追跡する
重大変更時にGateを再開する
完了時にFresh Evidenceを確認する
```

すべてのGate名称、番号、テンプレートを使用する必要はない。

上記の判断責務が実質的に満たされていることを求める。

---

# 24. Final Principle

CRDDにおけるPhase Gateは、作業を止めるための関門ではない。

人間の思いを下流へ渡すたびに、意味が失われていないかを確かめ、次の専門家、AI、実装へ安全に委ねるための判断境界である。

```text
完全になるまで止めるのではない。
不確実性を隠したまま進めるのでもない。

何が分かり、何が分からず、
何を守り、どのRiskを受け入れ、
誰が判断したかを残して進む。
```

Phase Gateによって、CRDDは文書体系から、判断可能で再開可能な実行方法へ変わる。
