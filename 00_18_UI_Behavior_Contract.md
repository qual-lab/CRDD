# CRDD UI and Behavior Contract

Version: v0.1.0
Status: Stable
Owner: Qual-Lab
Last Updated: 2026-07-16
Related:
- [00_02_CRDD_Core_Concepts_and_Terminology.md](00_02_CRDD_Core_Concepts_and_Terminology.md)
- [00_03_CRDD_Conformance.md](00_03_CRDD_Conformance.md)
- [00_04_CRDD_End_to_End_Context_Continuity.md](00_04_CRDD_End_to_End_Context_Continuity.md)
- [00_11_Information_Provenance.md](00_11_Information_Provenance.md)
- [00_12_Decision_Record.md](00_12_Decision_Record.md)
- [00_13_Human_AI_Responsibility.md](00_13_Human_AI_Responsibility.md)
- [00_16_Context_Transformation.md](00_16_Context_Transformation.md)
- [00_17_Discovery.md](00_17_Discovery.md)
- [00_30_Product_Documentation.md](00_30_Product_Documentation.md)
- [00_32_Testing_Quality.md](00_32_Testing_Quality.md)

---

本書で使用するCore Concept、Canonical Term、責務・Authorityの定義は、[`00_02_CRDD_Core_Concepts_and_Terminology.md`](00_02_CRDD_Core_Concepts_and_Terminology.md)を正本とし、本書では再定義しない。

# Purpose

本ドキュメントは、利用者に見えるInteractionと、システム内部のBehaviorを、意味の切れた別成果物ではなく、同じProduct Intentを実現する対のContractとして定義・Reviewするための規範を定める。

CRDDでは、UIを見た目の説明だけにしない。
SPECを内部処理の説明だけにしない。

```text
UI Contract
利用者に何が見え、何を理解し、何を操作でき、どのようなFeedbackを受けるか

Behavior Contract
どの条件・状態で処理が始まり、何が変化し、何が返り、失敗時にどう振る舞うか
```

両者は、UX OutcomeとIA Structureを、利用可能かつ検証可能なProduct Contractへ変換する。

---

# 1. Basic Principle

UI ContractとBehavior Contractは、以下の原則に従う。

```text
見えているActionには、対応するBehaviorが存在する。
発生し得る重要なBehaviorには、必要なUI Feedbackが存在する。
利用者に見えない内部状態を、UIが事実のように推測しない。
実装都合で、UIとBehaviorの意味を無言で分離しない。
正常系だけでなく、待機・空・失敗・権限・取消・回復を対で定義する。
UIとSPECの一致は、実装後ではなく設計時から確認する。
```

UI ContractとBehavior Contractは、完全な一方向工程ではない。

UIを具体化することで必要なStateやExceptionが発見されることがある。
Behaviorを具体化することで必要な表示、確認、Recovery Actionが発見されることがある。

したがって、両者は反復して確定する。

---

# 2. Contract Responsibilities

## 2.1. UI Contract Owns

UI Contractは、主に以下を正本化する。

```text
利用者が認識できる情報
情報の優先順位とGrouping
利用可能なAction
Actionの開始点
状態ごとの見せ方
処理中・完了・失敗のFeedback
ErrorからのRecovery導線
Confirmation、Cancel、UndoのInteraction
利用者向け文言
Accessibility上の意味と操作
Figma等のVisual Artifactとの対応
```

UI Contractは、特定のBackend方式、Database構造、通信方式を正本化しない。

## 2.2. Behavior Contract Owns

Behavior Contractは、主に以下を正本化する。

```text
TriggerとPrecondition
InputとValidation
DomainまたはSystem State
State Transition
処理結果とOutput
Business Rule
AuthorizationとPermission条件
Failure、Timeout、Conflict、Retry、Fallback
Cancellation、Rollback、Idempotency
外部SystemとのBehavior上の契約
Acceptance Criteria
```

Behavior Contractは、Visual Layout、色、Typography、具体的なComponent表現を正本化しない。

## 2.3. Shared Responsibility

以下は、UIとBehaviorの一方だけでは確定できないShared Contractである。

```text
利用者Actionと処理Triggerの対応
表示状態とSystem Stateの対応
完了と失敗の判定
利用者へ開示する情報の範囲
Permission不足時の扱い
Retry、Cancel、Undoの可否
二重実行・競合時の扱い
AI提案と人間承認の境界
Acceptance CriteriaとEvidence
```

Shared Responsibilityは、どちらか一方へ曖昧に委ねてはならない。

---

# 3. Pairing Unit

UI ContractとBehavior Contractの対応単位は、原則としてScreen単位ではなく、**Feature、Use Case、User Action、またはStateful Interaction単位**とする。

一つのBehaviorが複数画面から利用される場合がある。
一つの画面に複数Featureが存在する場合がある。

```text
悪い対応:
Screen A.md ⇄ Screen A Spec.md

推奨される対応:
Topicを承認するUI Contract
    ⇄ Topic Approval Behavior Contract

Topicを検索するUI Contract
    ⇄ Topic Search Behavior Contract
```

単純な対象では、UIとBehaviorを一つのArtifactへ統合してよい。
複雑な対象では、複数Artifactへ分割してよい。

ただし、どのUI ActionがどのBehaviorへ対応するかを説明できなければならない。

---

# 4. Minimum Paired Contract

重要なFeatureまたはInteractionでは、最低限以下を定義する。

| Concern | UI Contract | Behavior Contract |
|---|---|---|
| Purpose | 利用者が何を達成するか | Systemが何を成立させるか |
| Source Context | UX・IA・Decisionとの関係 | UX・IA・Decisionとの関係 |
| Trigger | 利用者が何を行うか | 処理を開始する条件 |
| Preconditions | 操作可能であることの見せ方 | 実行可能条件 |
| Input | 利用者が入力・選択するもの | 受け取る値とValidation |
| Processing | 待機中のFeedback | 実行中State、Timeout、Progress |
| Success | 完了表示と次Action | 完了条件、State更新、Output |
| Empty | 空である意味とAction | Dataが存在しない条件 |
| Error | MessageとRecovery | Error分類、Retry、Fallback |
| Permission | 操作可否・理由 | Authorization Rule |
| Cancel / Undo | 利用者が戻せる範囲 | Cancellation / Rollback Rule |
| Evidence | 何を見て成立を確認するか | Test・Log・Resultの確認方法 |

すべてを独立した表にする必要はない。
ただし、重要なConcernが片側にしか存在せず、もう片側の扱いが不明な状態は認めない。

---

# 5. State Correspondence

## 5.1. State Is a Contract, Not Decoration

Loading、Empty、Error等はUI上の装飾ではない。
System Behaviorと利用者判断を接続するContractである。

重要なFeatureでは、少なくとも以下の必要性を確認する。

```text
Initial
Ready
Loading / Processing
Partial
Success
Empty
Validation Error
System Error
Offline / Unavailable
Permission Denied
Disabled
Conflict / Stale
Cancelled
Recovering / Retrying
```

すべてのFeatureに全Stateを実装する必要はない。
存在しないStateは、存在しない理由を説明できることが望ましい。

## 5.2. Do Not Equate UI State and Internal State Blindly

UI Stateと内部Stateは一対一とは限らない。

```text
内部では複数の処理Stateがあっても、利用者には一つの「処理中」として見せる場合がある。
内部では成功していても、表示更新に失敗して利用者が完了を確認できない場合がある。
```

そのため、次を区別する。

```text
Domain / System State
内部で何が成立しているか

Presentation State
利用者に何を伝えるべきか

Assurance State
その結果が何によって確認されているか
```

## 5.3. Unknown Must Remain Unknown

UIは、Systemから確定情報を得ていない状態を、成功・失敗・未実行へ勝手に分類してはならない。

例:

```text
Request送信後に応答が失われた場合、
「失敗しました」と断定せず、結果不明・再確認が必要な状態として扱う。
```

---

# 6. Action and Trigger Contract

利用者が実行できる主要Actionには、以下を対応づける。

```text
Actionの目的
操作可能条件
Trigger
入力値
即時Feedback
二重操作の扱い
処理中の操作可否
Success条件
Failure条件
Cancel / Undo可否
次に利用者が取れるAction
```

## 6.1. Disabled versus Hidden

Permission不足、条件未達、Feature未対応等に対して、ActionをHiddenにするかDisabledにするかはUI判断だけで決めない。

以下を考慮する。

```text
利用者が機能の存在を知る必要があるか
利用できない理由を理解する必要があるか
情報開示自体がSecurity Riskにならないか
将来利用可能になるActionか
代替手段があるか
```

## 6.2. Destructive Action

削除、送信、公開、上書き、権限変更等の重要Actionでは、必要に応じて以下を定義する。

```text
事前確認
影響範囲の表示
取消可能期間
UndoまたはRollback
再実行時の挙動
Audit Evidence
```

Confirmationを置くだけでSafetyが成立したとみなしてはならない。

---

# 7. Async, Progress, Retry, and Cancellation

非同期処理では、UIとBehaviorの両方で以下を検討する。

```text
処理開始が確定した時点
進捗を取得できるか
処理中に画面を離れてよいか
再訪時に状態を復元できるか
Timeoutをどう判断するか
Retryが安全か
重複実行を防ぐ必要があるか
Cancelが可能か
Cancel後に何が残るか
Partial Successをどう扱うか
```

UIへProgressを表示する場合、実際には進捗を取得できないのに、確定的なPercentageを演出してはならない。

Retryを提供する場合、Behavior ContractではIdempotencyまたは重複影響を明示する。

---

# 8. Error and Recovery Contract

Error Contractは、Error Message一覧ではない。

重要なErrorについて、以下を定義する。

```text
どの条件で発生するか
Systemが何を保護するか
利用者へ何を伝えるか
どこまで技術情報を開示するか
利用者が自力で回復できるか
Retry、修正、問い合わせ等の次Action
入力や作業内容を保持するか
監査・Logに何を残すか
```

UIは、内部Error Codeをそのまま利用者へ表示することを正解としない。
Behavior Contractは、すべてを「予期しないエラー」として一括処理しない。

Errorは必要に応じて分類する。

```text
Validation
Authentication / Authorization
Conflict
Unavailable / Timeout
External Dependency
Data Integrity
Unsupported State
Unexpected Failure
```

---

# 9. Data, Content, and Wording

UIに表示されるDataと文言には、以下の対応が必要である。

```text
Data Source
表示可能条件
更新タイミング
Freshness
欠損時の扱い
Format
Localization
Privacy / Masking
利用者が誤解しないLabel
```

UI MockやFigma上に存在する値を、実Dataとして取得可能であると無言で仮定してはならない。

文言はUI Contractの責務だが、Behavior上の条件や結果と矛盾してはならない。

例:

```text
Behaviorが候補を生成しただけである場合、
UIは「承認済み」「確定しました」と表示してはならない。
```

---

# 10. AI Interaction Contract

AIを利用するFeatureでは、通常のAction／Behaviorに加えて以下を定義する。

```text
AIが行うこと
AIが行わないこと
Inputとして送る情報範囲
Outputの情報種別
Confidenceまたは不確実性の扱い
Evidence / Sourceの提示
人間によるReview・Approvalの要否
採用・不採用・修正Action
再生成時の扱い
Provider利用不可時のBehavior
AI出力を保存・公開・実行する条件
```

AIが生成した提案と、人間が承認した確定情報を、同じUI Stateまたは同じStatusで表示してはならない。

```text
AI Proposed
Human Reviewed
Approved
Executed
Verified
```

等の意味を必要に応じて分離する。

---

# 11. EARS and Formal Behavior Syntax

EARS等の構文は、主に以下を曖昧なく表現するために利用する。

```text
Trigger
Precondition
Behavior
State Transition
Exception
Acceptance Criteria
```

推奨利用領域は、Behavior Contract、SPEC、Acceptance Criteria、Test Designである。

UX Outcome、Experience Principle、IA Intent、Design Intentを、同じ構文へ圧縮してはならない。

例:

```text
When the user approves an AI-generated draft,
the system shall record the approver, approval time, and approved revision.
```

形式構文を使用する場合も、なぜそのBehaviorが必要かを示すSource Contextを失ってはならない。

---

# 12. Figma and Visual Artifact

Figma等のDesign Artifactは、Layout、Visual、Component、Interaction表現の正本になり得る。

ただし、FigmaだけでBehavior Contractが成立したとみなしてはならない。

Context Repositoryには、最低限以下を接続する。

```text
対象FeatureまたはUse Case
Figma Link
対象Frame / Component
Authorityを持つProperty
対応するBehavior Contract
Versionまたは確認時点
未反映・未確定事項
```

Prototype上で操作できることは、System Behaviorが確定または実装済みであることを意味しない。

---

# 13. Validation and Review Gate

UI／Behavior Contract Reviewでは、少なくとも以下を確認する。

## 13.1. Upstream Alignment

```text
UX Outcomeを実現しているか
IA上のObjectと責務を壊していないか
上流のPrinciple、Non-goal、Decisionを守っているか
```

## 13.2. Pair Consistency

```text
すべての主要ActionにBehaviorがあるか
すべての重要StateにUI表現があるか
Trigger、Condition、Resultが一致しているか
Error、Permission、Retry、Cancelが矛盾していないか
文言が実際の状態を正しく伝えているか
```

## 13.3. Verification Readiness

```text
Acceptance CriteriaがTest可能か
UIとBehaviorのどちらを何で検証するか明確か
実装済みと検証済みを区別できるか
必要なEvidenceが定義されているか
```

重大な不整合が残る場合、ArchitectureまたはImplementationへ正式にHandoffしてはならない。

---

# 14. Reverse and Legacy Application

Legacy／Brownfield環境では、UI、Code、実行結果からBehavior Contractを逆方向に復元してよい。

ただし、現在の挙動を意図された仕様と断定してはならない。

```text
Observed UI
Observed Runtime Behavior
Code / API / Data
Existing Document
Operator Knowledge
```

をEvidenceとして扱い、以下を分離する。

```text
Observed Behavior
Documented Behavior
Expected Behavior Candidate
Recovered Intent Candidate
Known Defect / Inconsistency
```

復元したContractは、人間による確認または追加Evidenceを得るまで、確定Contractとして扱わない。

---

# 15. Exceptions

## 15.1. UI-only Prototype

価値仮説や操作性を検証するPrototypeでは、完全なBehavior Contractを作らず、Simulated Behaviorを利用してよい。

ただし、以下を明示する。

```text
何が実Behaviorで、何がSimulationか
どの前提を検証するPrototypeか
実装時に未確定となるBehavior
```

## 15.2. Behavior without UI

Background Job、API、Batch、Automation等、直接UIを持たないBehaviorでは、UI Contractを必須としない。

ただし、人間が状態を確認・停止・回復・監査する必要がある場合、そのOperational Surfaceまたは管理UIの必要性を検討する。

## 15.3. Read-only Surface

操作を持たない表示専用Surfaceでも、Data Freshness、Empty、Error、Permission、表示根拠等のBehaviorとの対応は必要である。

---

# 16. Anti-patterns

## Visual Completion without Behavior

Figmaは完成しているが、Action、State、Error、Permission、Data Sourceが未定義である。

## Spec Completion without Human Interaction

処理仕様は完成しているが、利用者が結果を理解・修正・回復する方法が定義されていない。

## Happy-path-only Contract

正常終了だけを定義し、Loading、Empty、Error、Conflict、Cancelを実装時へ丸投げする。

## Hidden State Assumption

Systemが返していない状態をUIが推測し、確定表示する。

## Figma as Full Specification

見た目とPrototypeだけで、Behavior、Permission、Error、Data契約まで確定したとみなす。

## Implementation-driven Contract Rewrite

実装しやすさを理由に、UIまたはSPECを無言で変更し、UX・IAへの影響を残さない。

## Status Meaning Collapse

AI生成、保存済み、承認済み、実行済み、検証済みを一つの「完了」Statusで表す。

---

# 17. Minimum Rules

最低限、以下を守る。

```text
UIとBehaviorは同じFeatureまたはUse Caseへ対応づける
主要ActionにはTrigger、Condition、Resultを持たせる
重要Behaviorには利用者が必要とするFeedbackを持たせる
Loading、Empty、Error、Permission、Cancel、Recoveryを必要に応じて対で定義する
UI StateとSystem Stateを無条件に同一視しない
不明な実行結果を成功または失敗へ無言で確定しない
FigmaだけでBehaviorが確定したとみなさない
EARSは主にSPEC以降のBehaviorとAcceptanceへ利用する
実装前にUI／Behaviorの重大な不整合を解消する
実装後はFresh Evidenceにより両Contractを検証する
```

---

# 18. Final Principle

CRDDにおけるUIは、表面を整える工程ではない。
SPECは、内部処理を列挙する工程ではない。

UI Contractは、人間が製品を理解し、操作し、結果を判断するための契約である。
Behavior Contractは、その期待をSystemが条件と状態に基づいて成立させるための契約である。

```text
人間に見えることと、Systemで起きることを分離して設計する。
しかし、意味の上では切断しない。
```

この対のContractが成立して初めて、UXとIAは実装可能なProduct Contractへ変換される。
