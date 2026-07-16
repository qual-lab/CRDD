# CRDD Gap Validation and Impact Analysis

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_10_Context_Repository.md](00_10_Context_Repository.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_14_AI_Change_Control.md](00_14_AI_Change_Control.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_18_UI_Behavior_Contract.md](00_18_UI_Behavior_Contract.md)
- [00_19_Context_Traceability.md](00_19_Context_Traceability.md)
- [00_23_Phase_Gate_Approval.md](00_23_Phase_Gate_Approval.md)
- [00_24_Change_Context_Package.md](00_24_Change_Context_Package.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)

---

# Purpose

本ドキュメントは、CRDDにおけるCross-layer Gap ValidationとImpact Analysisの目的、検査範囲、判定方法、責任、記録、終了条件を定義する。

CRDDでは、上流Context、専門成果物、実装、検証結果が個別に正しく見えても、相互の接続が崩れていれば、一気通貫したものづくりは成立しない。

```text
Originは変わったが、UXが更新されていない
UXは変わったが、IAが古い構造のままである
UIにActionがあるが、対応するBehaviorが存在しない
REQは変更されたが、ArchitectureとCodeが追従していない
実装は動くが、承認済みContractとは異なる
Testは通るが、現在のAcceptance Criteriaを検証していない
新しいEvidenceが得られたが、元の仮説が更新されていない
```

Cross-layer Gap Validationは、このような層間の不一致、欠落、古い前提、未検証状態を検出する。

Impact Analysisは、あるContextまたはArtifactの変更によって、どのContext、Contract、Artifact、Gate、Release、Test、利用者体験へ再確認が必要になるかを特定する。

本標準の目的は、すべての変更で全Repositoryを機械的に再検証することではない。

```text
変更点からRelationをたどる
影響候補を広く検出する
実際に影響するかを判断する
変更、影響なし、延期、Risk受容を明示する
必要な範囲だけを再設計、再承認、再検証する
```

これにより、CRDDは上流から下流への意味の連続性を、変更後も維持する。

---

# 1. Basic Principle

Cross-layer Gap ValidationとImpact Analysisは、以下の原則に従う。

```text
変更されたArtifactだけを見て完了としない。
上流から下流、下流から上流の両方向を確認する。
Relationを影響候補の発見に使い、Relationだけで影響を断定しない。
不一致を自動修正せず、意味と責任を確認する。
影響なしという判断にも理由を残す。
未決、仮説、Recovered Contextを確定事項として扱わない。
検査範囲はRisk、変更内容、共通性、Variant、Release影響に応じて調整する。
AIは候補抽出、比較、分類、推奨を行えるが、重要な価値判断とRisk受容を自己承認しない。
Gapを隠したままGateを通過しない。
Gap解消後は、正本Context、Trace、Evidence、Gate状態を更新する。
```

Gapが見つかることは失敗ではない。

Gap Validationの価値は、実装後やRelease後に発覚する不整合を、より早い段階で可視化することにある。

---

# 2. Gap and Impact Are Different

## 2.1. Gap

Gapは、期待されるContext、Contract、Relation、Artifact、Evidenceの間に存在する不一致、欠落、未反映、古い状態である。

例:

```text
UX-000004をrealizesするUI Contractが存在しない
UI-000021に対応するREQが存在しない
REQ-000044の内容と実装挙動が異なる
承認済みRevisionと参照中のFigma Versionが異なる
Acceptance Criteriaはあるが、verified_by Relationがない
```

## 2.2. Impact

Impactは、変更によって他のContextまたはDelivery対象へ影響が及ぶ可能性である。

例:

```text
UX Outcome変更により、複数のIA Structureを再確認する必要がある
共通UI Contract変更により、複数FeatureとVariantへ影響する
REQ変更により、API、Data Migration、Test、Release Noteへ影響する
Implementation制約により、上流Contractの再判断が必要になる
```

Impact Candidateは、Gapが確定したことを意味しない。

影響候補を確認した結果、次のいずれかになる。

```text
実影響あり
影響なし
既存Contract内で吸収可能
次Releaseへ延期
Riskを受容して現状維持
上流判断へ差し戻し
```

---

# 3. Validation Scope

Cross-layer Gap Validationは、次の対象間で実施する。

```text
Origin / Problem
UX
Feature / Use Case / User Action
IA
UI Contract
Behavior Requirement / SPEC
Architecture
Implementation / Configuration
Test
Evidence
Decision
Gate / Change Package / Release
```

すべての変更で全層を検査する必要はない。

対象Scopeは、変更されたContext、Relation、共通性、Risk、Variant、Release状態から決定する。

## 3.1. Standard Validation Directions

```text
Origin / Problem → UX
UX → IA
UX / IA → Feature / Use Case
IA → UI
IA → REQ
UI ⇄ REQ
REQ → Architecture
Architecture → Implementation
UI / REQ → Test / Evidence
Implementation / Evidence → UX / IA / UI / REQ / Architecture
Change Package → Gate / Release / Roadmap
```

矢印は固定工程順ではない。

変更または新Evidenceが下流から発生した場合は、逆方向に確認する。

---

# 4. Standard Gap Types

## 4.1. Continuity Gap

上流Contextの意味が、下流へ具体化されていない、または下流から遡れない状態。

```text
UX Outcomeはあるが、実現するFeatureまたはUIが不明
UI変更の理由をOriginまたはDecisionへ遡れない
```

## 4.2. Coverage Gap

必要なContext、状態、例外、Variant、Test等が欠落している状態。

```text
SuccessはあるがError Stateがない
主要Use CaseのAcceptance Criteriaがない
Brand / Permission / Offline差分が未定義
```

## 4.3. Consistency Gap

複数のContextまたはArtifactが、同じ対象について異なる内容を示している状態。

```text
UIでは取消可能だが、REQでは取消不可
FigmaではActionが表示されるが、Permission Ruleでは利用不可
文書と実装でDefault値が異なる
```

## 4.4. Revision Gap

参照しているVersion、Revision、Baselineが揃っていない状態。

```text
UIはRevision 4だが、Review済みREQはRevision 2
TestがSupersededされたAcceptance Criteriaを検証している
```

## 4.5. Provenance Gap

事実、解釈、仮説、AI推定、Recovered Contextの由来またはConfidenceが不明な状態。

```text
Legacy解析で推定したIntentが、確定Whyとして扱われている
市場仮説がEvidenceなしにRequirementへ昇格している
```

## 4.6. Contract Gap

UI ContractとBehavior Contractの対応が不足または矛盾している状態。

```text
ActionにTriggerがない
Behavior FailureにUI Feedbackがない
UI StateとSystem Stateが誤って同一視されている
```

## 4.7. Implementation Gap

承認済みContract、Architecture、Implementationの間に差がある状態。

```text
Codeは動くが、承認されていないFallbackを実装している
Architecture Boundaryを越えて直接参照している
```

## 4.8. Verification Gap

成立条件と、TestまたはEvidenceの間に不足がある状態。

```text
REQはあるがTestがない
Testはあるが、現在のRevisionを検証していない
Pass結果はあるが、Evidenceの取得条件が不明
```

## 4.9. Feedback Gap

実装、検証、運用から得た学びが、上流Contextへ戻っていない状態。

```text
Technical Spikeで制約が判明したがArchitectureだけに残っている
利用者検証でUX仮説が反証されたがUX Contextが更新されていない
```

---

# 5. Impact Dimensions

Impact Analysisでは、少なくとも以下の観点を確認する。

| Dimension | Review Question |
|---|---|
| `Intent` | Origin、Principle、UX Outcomeを変えるか |
| `Scope` | Feature、Use Case、Screen、Actor、Release範囲が変わるか |
| `Information Structure` | Object、分類、Navigation、責務が変わるか |
| `Interaction` | Action、Feedback、State、Error、Permissionが変わるか |
| `Behavior` | Condition、Rule、State Transition、Outputが変わるか |
| `Architecture` | API、Data、Boundary、Security、Integrationが変わるか |
| `Implementation` | Code、Configuration、Migration、Buildが変わるか |
| `Shared Element` | 共通Component、共通Rule、共通Serviceへ波及するか |
| `Variant` | Brand、Display、Role、Platform、Localeへ波及するか |
| `Compatibility` | 既存Data、API、利用者運用、Migrationへ影響するか |
| `Quality` | Performance、Accessibility、Safety、Securityへ影響するか |
| `Verification` | Test、Evidence、Review Scopeを更新する必要があるか |
| `Delivery` | Gate、Release、Schedule、Cost、Ownerへ影響するか |
| `Learning` | Decision、Roadmap、Knowledgeへ戻すべき学びがあるか |

---

# 6. Validation Trigger

以下のいずれかに該当する場合、Gap ValidationまたはImpact Analysisを実施する。

```text
Origin、Problem、UX Outcome、Principleが変更された
IA Object、責務、Navigationが変更された
UI ContractまたはBehavior Requirementが変更された
共通Component、共通Rule、Architecture Boundaryが変更された
新しいFeature、Use Case、Variant、Permissionが追加された
既存Contextが廃止、統合、置換された
承認後に重要な変更が追加された
Legacy解析で新しいEvidenceが見つかった
Prototype、Test、実装、運用で想定外の結果が得られた
Gateを通過または再開しようとしている
Change PackageをCloseしようとしている
Release Scopeを固定しようとしている
```

軽微な表記修正等では省略してよい。

省略判断は、意味、Contract、Relation、Behavior、Verificationへ影響しないことを説明できる場合に限る。

---

# 7. Standard Validation Flow

```text
1. Triggerを特定する
2. Active Scope / Revision / Baselineを確定する
3. Context Packageを構成する
4. Changed Entity / Relation / Artifactを特定する
5. Relation Graphを上下流・横断方向へ探索する
6. Gap / Impact Candidateを抽出する
7. 人間とAIで実影響を判定する
8. Dispositionを決定する
9. 必要な変更、再Review、再検証を実行する
10. Trace、Gate、Package、Evidenceを更新して閉じる
```

## 7.1. Identify Change

変更前後を比較し、単なる文言差分ではなく、意味の差分を抽出する。

```text
追加された意味
削除された意味
変更された条件
変更された対象
変更された優先順位
新しく置かれたAssumption
解消または追加されたOpen Question
変更されたAuthorityまたはBaseline
```

## 7.2. Traverse Relations

`00_19_Context_Traceability.md`のRelationを利用して、影響候補を探索する。

例:

```text
UX-000004 changed
↓ realizes / supports
FTR-000012
IA-000008
UI-000021
REQ-000044
↓ implemented_by / verified_by
ARC-000017
TST-000032
EVD-000019
```

Relation Graphは候補抽出のために利用する。

Relationがあるから必ず変更する、Relationがないから影響がない、と機械的に断定してはならない。

Relation欠落そのものがGapである可能性も確認する。

## 7.3. Determine Actual Impact

各候補について、以下のいずれかを判定する。

| Disposition | Meaning |
|---|---|
| `Update Required` | Context、Artifact、Contract、Test等の変更が必要 |
| `Review Required` | 変更要否を専門Ownerが確認する必要がある |
| `No Impact` | 意味上の影響がない。理由を記録する |
| `Covered by Existing Contract` | 現行ContractまたはRule内で成立する |
| `Deferred` | 今回は変更せず、後続Change／Releaseへ送る |
| `Accepted Risk` | Gapを理解したうえで人間が一時的に受容する |
| `Upstream Decision Required` | 下流では決められず、上流判断へ戻す |
| `Out of Scope` | 今回のChange Scope外。追跡要否を判断する |

## 7.4. Resolve and Revalidate

修正後は、単に対象Artifactを更新するだけでなく、Gapが解消したことを再確認する。

```text
Relationが更新されたか
参照Revisionが揃ったか
UI / Behaviorが整合したか
ImplementationがContractを満たすか
Testが現在のAcceptance Criteriaを検証するか
Gate再評価が必要か
Learningが正本Contextへ戻ったか
```

---

# 8. Layer-specific Review Questions

## 8.1. Origin / Problem → UX

```text
誰のどの問題を扱うかが変わっていないか
Desired Outcomeが現在のProblemを解決する方向か
人間の原始的な思いが過度に一般化されていないか
仮説がEvidenceなしに確定していないか
```

## 8.2. UX → IA

```text
主要Objectと責務がUX Outcomeを支えられるか
利用者の理解単位とSystem都合の分類が混同されていないか
重要な行動、状態、履歴、Navigationが欠落していないか
IA都合でUX Principleを弱めていないか
```

## 8.3. IA → UI

```text
重要なObject、関係、状態が利用者に認識可能か
主要Actionの開始点と結果が分かるか
GroupingとNavigationがIAの責務を表現しているか
一つの画面へ異なる責務を無理に押し込めていないか
```

## 8.4. IA → Behavior Requirement

```text
ObjectのLifecycleとState Transitionが定義されているか
責務境界に対応するRuleとPermissionがあるか
IA上の分類とREQ上のConditionが矛盾していないか
```

## 8.5. UI ⇄ Behavior Requirement

```text
主要ActionにTriggerとResultがあるか
重要Behaviorに必要なFeedbackがあるか
Loading、Empty、Error、Permission、Conflictを対で扱っているか
Cancel、Undo、Retry、二重実行の扱いが一致するか
UI StateとSystem Stateを誤って同一視していないか
```

## 8.6. Requirement → Architecture

```text
Architectureがすべての重要RuleとQuality Attributeを成立させられるか
技術制約によってContractが無言で変更されていないか
Data、Security、Integration、Failure Boundaryが定義されているか
Implementation固有の都合を恒久的なRequirementへしていないか
```

## 8.7. Architecture → Implementation

```text
実装が承認済みBoundaryとDependencyを守っているか
Configuration、Migration、Error Handlingが設計と一致するか
未承認のFallbackや例外処理が追加されていないか
```

## 8.8. UI / Requirement → Test / Evidence

```text
Acceptance Criteriaごとに検証方法があるか
主要State、Failure、Permission、Recoveryを確認できるか
Testが現行Revisionと対象Variantを検証しているか
Evidenceが再現可能で、取得条件を説明できるか
```

## 8.9. Implementation / Evidence → Upstream

```text
発見した制約は実装固有か、Contract不足か、UX仮説の誤りか
新しい学びをどのContextへ戻すべきか
DecisionまたはRoadmap更新が必要か
既存GateをReopenする必要があるか
```

---

# 9. Impact Level

Impact Candidateには、必要に応じて以下のLevelを付与する。

| Level | Meaning |
|---|---|
| `L0 None` | 意味、Contract、実装、検証への影響なし |
| `L1 Local` | 単一ContextまたはArtifact内で完結する |
| `L2 Cross-artifact` | 同一専門層または複数Artifactへ影響する |
| `L3 Cross-layer` | UX、IA、UI、REQ、Architecture等の複数層へ影響する |
| `L4 Baseline / Release` | 承認済みBaseline、共通Contract、複数Feature、Releaseへ影響する |
| `L5 Critical` | Origin、Safety、Security、法令、重大品質、不可逆Data等へ影響する |

Levelは工数の大きさだけを意味しない。

小さなCode変更でも、安全、権限、不可逆処理へ影響する場合は高Levelとなる。

## 9.1. Review Scope Guidance

```text
L0:
Validation省略可。省略理由を簡潔に残す。

L1:
対象Artifactと直接Relationを確認する。

L2:
同一層の利用先、共通要素、関連Testを確認する。

L3:
上下流Context、UI / Behavior、Architecture、Verificationを横断確認する。

L4:
Gate、Baseline、Release Scope、Variant、Migrationを再評価する。

L5:
作業停止を含め、人間Authorityによる明示判断と独立Reviewを行う。
```

---

# 10. Finding Status

GapまたはImpact Findingには、以下のStatusを使用する。

| Status | Meaning |
|---|---|
| `Candidate` | AI、Tool、人間が検出した未確認候補 |
| `Under Review` | 実影響を確認中 |
| `Confirmed` | 実際のGapまたはImpactとして確認済み |
| `False Positive` | 候補だったが影響なし |
| `Accepted` | 人間がRiskまたは差異を明示的に受容 |
| `Deferred` | 後続Change／Releaseへ送った |
| `Resolved` | 必要な変更と再検証が完了 |
| `Superseded` | 後続Findingまたは変更に置き換えられた |

`False Positive`と`No Impact`も記録価値を持つ。

同じ候補をAIが繰り返し提示する場合、過去判断を参照して精度改善に利用できる。

---

# 11. Minimum Gap / Impact Record

重要なFindingでは、最低限以下を記録する。

```yaml
finding:
  id: GAP-000123
  change: CHG-000045
  type: ContractGap
  status: Confirmed
  impact_level: L3
  source:
    - UI-000021
  affected_candidate:
    - REQ-000044
    - TST-000032
  description: >
    UIでは取消可能と表示しているが、
    Behavior RequirementにCancellation Ruleが存在しない。
  preserved_intent:
    - UX-000004
  disposition: Update Required
  owner: Human
  gate_effect:
    - G4 Reopened
  evidence:
    - EVD-000019
  resolution:
    - REQ-000044 revision 4
    - TST-000032 revision 2
```

専用の`GAP` IDを常に必須とする必要はない。

軽微なFindingはChange Package内の一覧で管理してよい。
複数Change、Gate、Releaseをまたいで追跡する価値がある場合は安定IDを付与する。

---

# 12. Integration with Change Package

Gap ValidationとImpact Analysisは、原則としてChange Package内で実行する。

Change Packageには、少なくとも以下を含める。

```text
Changed Context
Impact Candidate
Confirmed Impact
No Impact判断
Required Update
Deferred Scope
Accepted Risk
Affected Gate
Required Verification
Closure Evidence
```

## 12.1. Before Implementation

実装開始前に、以下を確認する。

```text
上流Intentと対象Contractが特定されている
変更境界と変更禁止範囲が明確である
主要なCross-layer Impact Candidateが確認されている
再Review、Migration、Testの必要性が分かっている
```

## 12.2. Before Close

Change PackageをCloseする前に、以下を確認する。

```text
Confirmed Gapが未処理で残っていない
Deferred Scopeが追跡可能である
Accepted Riskに人間判断がある
正本ContextとRelationが更新されている
必要なGateが再評価されている
Fresh Evidenceが存在する
学びが適切なContextへPromotionされている
```

Merge、Build成功、Ticket完了だけではClose条件を満たさない。

---

# 13. Integration with Phase Gate

GapまたはImpactは、Phase Gateの評価Inputとなる。

以下の場合、関連Gateを`Reopened`へ戻すことを検討する。

```text
承認済みContextの意味が変更された
UI / Behavior ContractにConfirmed Gapがある
Architectureが上流Contractを満たせない
Acceptance CriteriaまたはVerification範囲が変更された
新Evidenceにより重要なAssumptionが反証された
BaselineまたはRelease Scopeへ波及する
```

すべてのGapでGateをReopenする必要はない。

軽微な差異で、既存Exit Criteriaと承認判断へ影響しない場合は、理由を残して既存Gateを維持してよい。

---

# 14. AI and Human Responsibility

## AI May

```text
Context、Artifact、Revisionの差分を抽出する
Relation Graphから影響候補を探索する
UIとREQ、REQとTest等の対応不足を検出する
古い参照、未接続Context、未検証Requirementを検出する
Gap Type、Impact Level、Review Scopeを提案する
既存Decisionと過去Findingを参照する
Change PackageとReview Checklistを更新する
解消後の再検証候補を提示する
```

## AI Must Not

```text
影響候補を実影響として無条件に確定する
上流Intentを推測して自動修正する
専門Ownerの判断なしにContractを弱める
重要なRiskを自動受容する
Gapを隠すためにRelationやEvidenceを生成する
Test Passだけを根拠にProduct Outcome達成を宣言する
```

## Human Owns

```text
価値、Scope、Priorityの判断
重要なGapの確定
影響なし、延期、Risk受容の判断
上流Intentと下流制約のTrade-off
Gateの最終承認
Releaseへ含める範囲
```

専門判断が必要な場合、該当するUX、IA、UI、SPEC、Architecture、Security等のOwnerへEscalationする。

---

# 15. Legacy / Brownfield Application

LegacyまたはBrownfield環境では、既存文書、Code、実行挙動、運用実態が一致しないことを前提とする。

以下を分離する。

```text
Documented Behavior
Implemented Behavior
Observed Runtime Behavior
Operational Practice
Expected Behavior Candidate
Recovered Intent Candidate
```

差異を検出した場合、現在動いているCodeを自動的に正本としない。

また、古い文書を自動的に正本としない。

```text
何が事実として観察されたか
何が過去の意図として推定されるか
現在何を正しいContractとするか
既存互換性をどこまで守るか
どの差異を不具合、仕様、Debt、未知として扱うか
```

を人間が判断する。

LegacyのGap Validationでは、すべてのGapを一度に解消する必要はない。

以下を優先する。

```text
Safety / Security / Data Risk
現在の重大不具合
変更予定Scope
共通Component / Shared Service
運用依存が大きい挙動
将来変更を阻害する不明確なBoundary
```

未解消GapはDebtまたはDeferred Scopeとして追跡する。

---

# 16. Compact Operation

小規模な変更では、独立したGap Reportを作らなくてよい。

Change PackageまたはPull Request Summary等に、最低限以下を残す。

```text
Changed Context
確認した上下流
影響あり／なし
変更したContractまたはArtifact
再実施したVerification
残した未決事項
```

例:

```text
Changed:
REQ-000044

Reviewed:
UI-000021
ARC-000017
TST-000032

Impact:
UI変更なし。既存UI Contract内で成立。
API ValidationとTest更新が必要。

Resolved:
ARC-000017 revision 3
TST-000032 revision 2

Evidence:
EVD-000019
```

規模を小さくすることは、Traceをなくすことを意味しない。

---

# 17. Anti-patterns

## 17.1. Changed File List Only

変更ファイル一覧だけをImpact Analysisとみなす。

ファイル差分は、意味的影響範囲と一致しない。

## 17.2. Relation Equals Impact

Relationがある対象をすべて変更対象とみなす。

Relationは候補探索に使い、実影響を判断する。

## 17.3. No Relation Equals No Impact

Relationが登録されていないため、影響なしと判断する。

Relation欠落自体がGapである可能性がある。

## 17.4. Update Everything

不安だからすべての文書、画面、Testを更新する。

過剰な同期作業は運用を破綻させ、形骸化を招く。
Risk-basedに範囲を選ぶ。

## 17.5. Fix Downstream Silently

実装都合でREQ、UI、UXの意味を無言で変更する。

上流判断へ戻す。

## 17.6. Pass Means Aligned

Testが通ったため、UXから実装まで整合していると判断する。

Test対象自体が古い可能性を確認する。

## 17.7. Ignore No-impact Decisions

影響なしの判断を記録しない。

同じ確認を繰り返し、判断理由が失われる。

## 17.8. Close with Deferred Gaps Hidden

未解消GapをTicket外へ追い出し、追跡先なしでChange Packageを閉じる。

Deferred Scope、Owner、後続ChangeまたはReleaseを明示する。

---

# 18. Completion Criteria

Gap ValidationまたはImpact Analysisは、対象Scopeについて以下を満たしたとき完了とする。

```text
変更点と対象Revisionが特定されている
必要な上下流・横断Relationを確認した
Impact Candidateを実影響、影響なし、延期等へ分類した
Confirmed GapにDispositionとOwnerがある
必要なContext、Contract、Artifact、Testを更新した
正本とRelationのRevisionが整合している
必要なGateを再評価した
Fresh Evidenceで解消状態を確認した
Deferred ScopeとAccepted Riskが追跡可能である
学びを適切なContextへ戻した
```

完全なGapゼロを常に要求するものではない。

残るGap、Risk、不確実性が明示され、人間がその扱いを判断し、追跡可能であることを求める。

---

# Summary

CRDDのCross-layer Gap ValidationとImpact Analysisは、変更されたファイルを探すための仕組みではない。

```text
上流の思いが下流へ残っているか
下流の現実が上流Contextへ戻っているか
専門層の間でContractが切れていないか
変更後も現在の正本と検証が整合しているか
```

を確認するための仕組みである。

Relation、AI、Toolは影響候補を広く発見する。

人間は、実際に何を変えるか、何を変えないか、どのRiskを受容するかを判断する。

これによりCRDDは、Contextを一度つなぐだけでなく、変更を重ねてもそのつながりを維持する。
