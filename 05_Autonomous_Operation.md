<a id="autonomous-operation"></a>

# 自律Operation（Autonomous Operation）

Version: v0.18.0
Status: Candidate
Released Baseline: v0.17.0
Owner: Qual-Lab
Last Updated: 2026-08-25
Related:
- [01_Principles.md](01_Principles.md)
- [04_Agent_Organization.md](04_Agent_Organization.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [16_Quality_Assurance.md](16_Quality_Assurance.md)
- [18_Context_Dependency.md](18_Context_Dependency.md)
- [99_Roadmap/01_Product_Roadmap.md](99_Roadmap/01_Product_Roadmap.md)

> 本書は自律Operationの目的と全体像を保持する非規範のArchitecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。候補の存在だけから、採用側の有効化、決定権限、Capability、準拠またはReleaseを成立させない。

---

## 1. 中心仮説

CRDDの中心は、人間とAIが同じコンテキストリポジトリ（Context Repository）を参照し、思想、意図、根拠、判断を失わずに専門工程、実装、検証、学びまで接続することである。

本候補では新しい専門工程や第一級成果物を大量に追加するのではなく、既存のコンテキスト、ロードマップ、判断、根拠、学び、エージェント、スキルをAI自身が継続的に利用し、必要な再評価、提案、許可された実行を開始できるかを検証する。

```text
CRDDの基本経路
Reality → Human Trigger → AI → CRDD → Work → Result → Learning

自律Operation候補
Reality / Time / Event / Condition
        ↓
      Trigger
        ↓
       AI
        ↓
      CRDD
        ↓
Re-evaluate / Propose / Authorized Action
        ↓
Result / Evidence / Learning
        └──────────────────────→ CRDD
```

技術的な中心原則は次のとおりである。

> `IF A THEN B`ではなく、`IF A THEN THINK`を扱う。

契機は結果や推論順序を固定しない。AIが考え始める理由、対象、権限、停止条件、期待結果を固定し、その時点のCRDDコンテキストから必要な探索と専門思考を形成させる。

### 1.1. 仕様は全体を定義し、運用は段階的に有効化する

本候補では、将来の実行形態をPoCの大きさへ縮めない。Re-evaluation、Operation、Runtime境界、Execution Identity、安全制御、Authority、Tool境界、Operation Result、Learning、次回再評価までの全体契約を、相互に矛盾しない一つのArchitecture候補として先に定義する。

一方、定義されていることを自律実行の許可とみなさない。

> 仕様対象は全体を閉じ、権限とRuntime利用は段階的に有効化する。

初期Reference Implementationが読み取り専用の定期助言だけであっても、本候補全体をそのProfileへ限定しない。逆に、将来の操作が契約上表現されていても、Activation Profileと人間判断が許可するまでは利用できない。

Activation Profileは品質契約、探索、検証、情報境界を省略する経路ではない。下位Profileは利用できる能力と権限を狭めるだけであり、Agentの自己申告によって上位Profileへ移行できない。

### 1.2. 3層Architecture

```text
Layer 1 — Semantic Contract
  Re-evaluation / Operation / Authority
  Expected Outcome / Learning

Layer 2 — Execution Contract
  Run Identity / Current State Resolution / Trigger Cause
  Duplicate and Recursion Protection / Timeout / Retry
  Execution Evidence / Result

Layer 3 — Runtime Adapter
  Coding Agent Automation / CLI / CI / MCP
  Dedicated Runtime / Future Adapter
```

Layer 1はCRDDが意味を所有する。Layer 2はCRDDとRuntimeの境界を定める。Layer 3はCRDD外の交換可能な実装である。Reference ImplementationはLayer 3の一例であり、Layer 1または2の正本にならない。

---

## 2. 基礎契約と自律Operation候補の分離

| CRDDの基礎契約 | 自律Operationで扱う拡張 |
|---|---|
| 人間が主な開始契機を持つ | 人間、時間、イベント、状態が開始契機になり得る |
| AIが必要時にコンテキストを読む | AIが契機に応じてコンテキストを再評価する |
| 人間が工程を開始する | AIも工程の再開を提案または許可範囲で開始できる |
| ロードマップと学びを保持する | ロードマップと学びが次の再評価へ接続する |
| エージェントが専門支援する | 責務と権限を持つエージェント構成を検証する |
| 人間の決定権限を中心に守る | 人間の決定権限を維持し、実績に基づく統制済み自律性を検証する |
| 要求起点 | 能動的な再評価候補 |
| 生きたコンテキストリポジトリ | 継続的に再解釈されるコンテキストリポジトリ |

自律Operationは、人間を排除する構想ではない。AIが状況収集、差分把握、再評価候補、根拠整理を担い、人間が価値、方向、優先順位、重要判断、リスク受容へ集中できる状態を目指す。

候補正本、実行実装、採用側の有効化、決定権限、準拠およびReleaseを分離する。同じbranchまたはCommitに含まれること、候補を表現できること、PoCや試験が成功したことから、Capabilityの有効化またはAuthority Grantを推定しない。採用する場合は、変更トレース、対象Version、移行、準拠影響、専門確認および人間判断を必要とする。統合前の候補資料と文書移管の来歴は[CHG-000014](90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md)で再構成できる。

---

## 3. 5本柱

### 3.1. 再評価・契機契約

CRDDが「いつ、なぜ、何をもう一度考える必要があるか」を表現し、Runtimeがその条件を検知してAIを起動できるようにする。

### 3.2. Operation Contract

目的、対象、期待結果、Authority、停止条件、次の再評価への接続を持ち、固定WorkflowではなくGoal Contractとして継続業務を表現する。

### 3.3. EffectとAuthorityの安全性

Context Access、Effect Boundary、Candidate／Canonical分離、Prepare／Verify／Promote、Runtime Enforcementを接続する。初期は既存のHuman Authorityを維持し、限定操作の自律化は別の根拠と人間判断を必要とする。

### 3.4. BackgroundとHuman Decisionの分離

Runtimeが解決できる影響なし、重複、Policy内処理、拒否を人間へ逐次通知しない。複数のExecutor、Reviewer、ProviderまたはRunの結果はそのまま質問へ変換せず、Coordinatorが現在の対象改訂版、Evidence、Verification、Authorityおよび解消状態を照合する。そこで再構成した現在の判断集合だけをDecision Queueへ渡し、Direction、Canonical Change、新しい処理境界・Authority変更・残存リスク受容を必要とするExternal Send、Publication、Production、Financial／Legal Effect、Policy Ambiguity等を人間へ接続する。許可した処理境界内のExternal Sendを、外部送信であることだけから毎回の人間判断へ送らない。詳細は[責務境界](05_Autonomous_Operation.md#44-coordinatorによる結果統合)に置く。

### 3.5. Operation Healthと適応

自律Operation自身の判断価値、見逃し、ノイズ、費用、人間確認負荷を品質対象とし、頻度低下、契機変更、Pause、再設計、廃止まで扱う。

> 自律Operationは、人間の判断負荷を増やすだけなら成功ではない。

エージェント組織（Agent Organization）と継続的学習（Continuous Learning）は、この5本柱を支える横断能力として扱う。エージェント数や実行回数を自律性の価値とみなさず、学びを自動的に原則化しない。エージェント組織の目的と概念境界は[エージェント組織の共通原則](04_Agent_Organization.md)に、複数エージェントまたはプロバイダーを利用する場合の安全なコンテキスト経路制御案は[非規範の実行Architecture候補](04_Agent_Organization.md#12-execution-architecture)に置き、固定フローまたはプロバイダー対応関係を本書へ持ち込まない。

Forward Compatibilityも5本柱を置き換える新しい柱ではなく、横断する設計制約として扱う。本候補で将来Capabilityを先行実装せず、Repository Identity、Context Reference、Provenance、Authorityの意味を現在の物理Locationまたは実行主体へ固定しない。表現できることを、有効化、アクセス、許可またはCurrent Stateへの反映とみなさない。詳細は[Forward Compatibility](05_Autonomous_Operation.md#forward-compatibility)に置く。

---

## 4. 再評価契約

単純なTrigger Contractより、再評価契約（Re-evaluation Contract）として捉える。

> 何が起きたら、なぜ、どのコンテキストをもう一度考える必要があるか。

所有境界は次のとおりである。

```text
Re-evaluation Contract
  Why / When / What should be reconsidered
  → operation_ref

Operation Contract
  What capability is invoked after reconsideration starts
  → Goal / Context / Expected Outcome / Authority / Stop
```

Re-evaluation Contractは、起動後のGoal、期待結果またはAuthorityを複製しない。同じOperationをSchedule、Event、Condition等の複数契機から参照できるようにする。

```yaml
reevaluation:
  target: product_direction
  reason: current assumptions may no longer hold
  conditions:
    - meaningful_environment_change
    - new_user_evidence
    - review_interval_reached
  operation_ref: product-direction-review
```

これは固定Schemaではない。少なくとも、再評価理由、対象、条件、参照するOperationを取得可能にする方向を比較する。Operation側がGoal、期待結果、Authority、停止、根拠、記録先を所有する。

イベント自体を固定Actionへ直結しない。例えばPull Requestの統合後は、まず意味変化を評価し、影響がなければ終了し、意味が変わった場合だけ適切な再評価へ接続する。

---

## 5. Living Repository

CRDDのリポジトリは、人間とAIが参照する生きたコンテキストリポジトリである。本候補ではさらに、時間、イベント、状態変化を契機に再解釈され、現実とのずれを発見し、次の思考を開始できる状態を検証する。

Repository自身が常駐Processを持つ必要はない。

```text
Repository
   ↓
Trigger
   ↓
AIが現在状態を再評価
   ↓
Proposal / Authorized Action
   ↓
Evidence / Learning
   └────────────────→ Repository
```

一般的な知識ベースとの違いは、情報検索だけでなく、意味変化の検出、再評価、根拠付き提案、学びへの循環までを契約対象にする点にある。

---

## 6. 新設しないもの

CRDDには、Observation、Evidence、Interpretation、Hypothesis、Discovery、Decision、Roadmap、Re-evaluation Trigger、Learning等が存在する。

そのため、現時点では次を新しい第一級成果物として追加しない。

- Opportunity専用正本
- Evidence Modelの重複正本
- Decision Historyの重複正本
- RoadmapまたはLearningの代替物
- Expert Agent専用の新工程
- 既存Independent ReviewやSecurity Boundaryの代替物
- 固定Workflow、固定Runtime、固定MCP、固定Provider

必要なのは新しい名前ではなく、既存概念をAI自身が能動的に利用し、再評価できることかを実証することである。

---

## 7. CRDD自身の改善候補

Productだけでなく、CRDD運用も観察対象にできる。

```text
複数Changeの手戻りを分析
   ↓
同じ工程間Findingが反復
   ↓
単発ミスか契約不足かを探索
   ↓
CRDD改善候補を提示
```

AIがCRDD Coreを自己変更することとは分離する。Core変更は、現行のAuthority、Change、Review、Audit、Releaseを通る別変更である。

---

## 8. 設計原則

1. 仕事は定型化しても、思考は定型化しない。
2. 契機は結果を決めず、考え始める理由を与える。
3. CRDDは「なぜ・何を」、Runtimeは「いつ・どう起動するか」を持つ。
4. 接続可能であることをAuthorityとみなさない。
5. AIの自律性は、コンテキストとGovernanceがある範囲でだけ成立する。
6. 何も変える必要がないことも正しい結果として扱う。
7. CRDD自身を巨大なRuntime、Scheduler、Queue、Worker、MCP Serverへ変えない。
8. 特定のAI製品、Protocol、Provider、課金方式へ固定しない。
9. 外部情報境界、最小権限、Human Gate、検証、回復を自律性より先に守る。
10. Capabilityが存在することを、利用権限、情報送信権限、Operation Authorityとみなさない。
11. Execution IdentityとCurrent Stateを確定できないOperationを、現在状態への有効な実行として扱わない。

安全性の中心原則は次のとおりである。

> 自律性は思考と候補形成に広く与え、実行効果の確定はPolicyとRuntimeで統制する。

短く表す場合は、`Think broadly. Effect narrowly.`とする。ただし、思考に利用できるコンテキストもAuthorityと外部情報境界の内側に限られる。詳細は[自律安全Architecture](05_Autonomous_Operation.md#autonomous-operation-safety)に置く。

---

## 9. 到達像

本候補が目指すのは、AIへ毎回仕事を依頼する状態から、AIが重要な変化を見つけ、許可範囲で分析と検証を進め、人間には重要な判断だけを根拠とともに求める状態への移行である。

```text
昨日から複数の変化を検出
  ├─ 影響なし：根拠付きで終了
  ├─ 許可範囲内：分析・検証済み
  └─ Directionへ影響：人間判断を要求
```

CRDDの基礎契約は「AIとプロダクトを作る」ための安定した土台を目指す。本候補は、その土台の上で「AIとプロダクトを継続的に育てる」運用を検証する。

未完了の実証候補は[Product Roadmap](99_Roadmap/01_Product_Roadmap.md)に置く。

---

<a id="autonomous-operation-responsibility"></a>

## 10. 自律Operationの責務境界（Autonomous Operation Responsibility）

> 本書は自律Operation、CRDD、Agent、Skill、Runtime、Toolおよび決定権限の責務境界を保持する非規範のArchitecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。接続可能性から有効化または決定権限を推定しない。

### 10.1. 中心境界

```text
CRDD      = 記憶、意味、意図、判断、契約
AI        = コンテキストに基づく探索、推論、提案
Skill     = 専門的な思考能力
Operation = 継続的に行う業務能力
Trigger   = 再評価を開始する契機
Runtime   = 検知、起動、時間、実行管理
Tool      = 外界への原子的な接続・操作能力
Authority = 誰が何を判断・操作できるか
Human     = 価値、方向、責任、リスク受容
```

本候補はこれらを一つの巨大Platformへ統合せず、意味と実行を分けたまま接続する。

---

### 10.2. コンテキスト契機と実行契機

#### 10.2.1. コンテキスト契機

CRDDが所有する意味側の候補である。

> 何が起きたら、なぜ、どのコンテキストを再評価する価値があるか。

候補：

- 判断の前提条件変更
- 新しい根拠または学び
- 検証結果の陳腐化
- 依存の契約、版、リスク変更
- 公開結果または利用者フィードバック
- 同じFindingまたは手戻り原因の反復
- ロードマップの再評価条件成立

コンテキスト契機を再評価契約として表す場合、その責務は`Why / When / What should be reconsidered`と参照するOperationまでとする。起動後のGoal、Expected Outcome、Authority、Stop ConditionはOperation Contractが所有し、再評価契約へ複製しない。

#### 10.2.2. 実行契機

Runtimeが所有する検知・起動方式である。

候補：

- OS SchedulerやCron
- GitまたはCI Event
- Webhook
- ファイル監視
- Coding Agent Automation
- Repository固有Runtime

CRDDは特定の実行方式を必須化しない。Runtimeの変更だけで再評価理由を変えず、意味契約の変更だけでRuntime権限を拡大しない。

---

### 10.3. SkillとOperation

#### 10.3.1. Skill

> 専門家がどのように考えるか。

Skillは専門探索、合成、批評、反証、収束を支える認知能力である。

例：

- Communicationの性能分析
- Architectureの代替合成
- UXの体験合成
- Verificationの根拠戦略

#### 10.3.2. Operation

> Skillとコンテキストを使い、現実世界で何を継続的に行うか。

例：

- 週次プロダクトレビュー
- リリース後確認
- ロードマップ再評価
- 品質状態レビュー
- 外部コミュニケーション結果レビュー

Operationは処理順序ではなく、Goal、Context、Authority、Expected Outcome、Stop Conditionを持つ候補である。SkillとOperationを重複正本化しない。

複数のSchedule、Event、Conditionから同じOperationを参照できる。OperationはTrigger条件や再評価理由を再定義せず、起動後に使用するCapabilityと成立すべきOutcomeを所有する。

---

<a id="4-operation-contract"></a>

### 10.4. Operation Contract

```yaml
operation:
  id: weekly-product-review
  purpose: evaluate current state and identify important decisions
  required_outcomes:
    - current_state
    - meaningful_changes
    - risks
    - roadmap_implications
    - recommended_next_actions
  authority:
    read: autonomous
    proposal: autonomous
    roadmap_change: human
  stop_conditions:
    - insufficient_evidence
    - authority_boundary
```

これは固定Schemaではない。少なくとも次を取得可能にする方向を検証する。

- 参照元となる再評価契約または起動原因への接続
- Goalと対象コンテキスト
- 必須または期待する結果
- 利用できる能力と禁止された能力
- 判断・操作権限
- 停止、失敗、再試行、Escalation
- 結果の根拠、記録先、学びへの接続

ファイル探索順、使用スキル、推論経路をTypeScriptや固定Promptへ埋め込まない。

<a id="41-仕様とactivationの分離"></a>

#### 10.4.1. 仕様とActivationの分離

Operation Contractは起動後に利用し得るCapability、Authority、Required Outcome、Result expectationを表現できるようにする。Trigger条件、再評価理由および再評価対象はRe-evaluation Contractが所有し、Operation Contractへ複製しない。一方、各採用先が有効化するTrigger、Capability、Authority等の範囲はActivation Profileで制限する。

```text
Operation Contract
  表現できる意味・能力・権限の全体

Activation Profile
  今回の採用先で実際に有効なTrigger・能力・権限
```

ProfileはOperation Contractの必須結果、停止条件、根拠、探索・収束、セキュリティを省略しない。権限を狭めることはできるが、定義済みであることを理由に権限を広げない。

Activationは成熟度や品質の等級ではなく、採用先が有効にするTrigger、接続およびEffectの範囲を段階的に評価する。旧PoCで用いた次のProfile 0～5は固定Schemaや必須導入順ではないが、各段階の意味と人間ゲートを失わないための参照候補である。

| Profile候補 | 有効化する主な範囲 | 維持する境界 |
|---|---|---|
| 0 構想と境界 | 契約、責務、Authority、停止の設計評価 | 実行Capabilityや採用を成立させない |
| 1 Scheduled Advice | 時間契機、読取り、提案 | 外部公開、本番変更、費用Effectを許可しない |
| 2 Event-driven Advice | 意味変更が疑われるEventによる再評価 | Event発生だけで起動せず、重複と再帰を制御する |
| 3 Connected Observation | 承認済みToolからの観測 | 接続済みであることをAuthorityとみなさず、外部情報境界を維持する |
| 4 Governed Execution | 影響限定、検出、回復および検証が成立するEffect | 外部公開、本番、費用、法務、権限変更の人間ゲートを維持する |
| 5 Agent Organization | 必要な専門責務の編成、委譲、独立レビュー、統合 | Agent数やProvider差を品質・独立性・Authorityの根拠にしない |

将来の継続的改善候補も、`Observe → Discover → Reason → Propose → Authorized Execute → Verify → Learn`の各境界を維持する。Profile間の移行や継続的改善は自動昇格ではなく、対象Capability、Authority、Evidence、回復条件および人間判断を別途必要とする。

#### 10.4.2. Execution Contract

すべてのOperationに共通する実行境界候補として、次を取得可能にする。

```text
Execution Identity
├ Repository identity
├ Branch or equivalent context
├ Target revision
├ Baseline
├ Operation ID
├ Run ID
├ Trigger cause
└ Parent run ID, when delegated or derived

Current State Resolution
├ Current canonical context
├ Adopted versus candidate state
├ Current authority
├ Stale or invalidated evidence
└ Unavailable or conflicting context

Execution Safety
├ Duplicate suppression
├ Recursion protection
├ Concurrency boundary
├ Time and cost boundary
├ Retry policy
├ Failure and recovery
└ Execution evidence
```

Execution Identityは特定Git製品への固定を意味しない。Gitを使う場合はRepository、branch、Commit、baseline等で再識別でき、他のRuntimeでは同等の不変な対象識別を持つ。

Operation開始時に現在状態を確定できない場合、不足または競合を残して停止する。古い履歴、失効したEvidence、未採用候補を現在状態へ丸めない。

Operation Resultそれ自体は、原則として同一対象・同一原因の同一Operationを即時再発火しない。再評価が必要なら、次回再評価候補として記録し、別のTrigger評価を経る。Runtimeは少なくとも`operation + repository + target revision`相当の実行キー、同時実行境界、Retry上限、終了状態を扱えるようにする。

#### 10.4.3. Operation Result Contract

結果は提案の文章だけでなく、実行対象、探索範囲、根拠、停止、次回候補を再構成可能にする。

候補：

- Execution IdentityとTrigger Cause
- Current State
- Meaningful Changes
- EvidenceとFinding
- Recommendation
- Decision Required
- Action ExecutedとVerification
- Learning Candidate
- Next Re-evaluation Candidate
- Explored Scope
- Excluded Scope
- Unavailable Context
- Remaining Uncertainty
- Reason for Convergence

Silent Failureを減らすため、「問題なし」という結論にも探索範囲、対象外、利用不能なコンテキスト、残存不確実性、収束理由を要求する。活動を実施したという自己申告だけで結果を成立させない。

<a id="44-coordinatorによる結果統合"></a>

#### 10.4.4. Coordinatorによる結果統合

Coordinatorは、Executor、Reviewer、Providerまたは複数Runが返した結果を、人間への質問または採用済みの結論へ直接変換しない。Execution Identity、対象改訂版、Current State、Evidence、Verification、Policy結果、未評価範囲および結果の有効性を照合し、競合、重複、失効した結果、解消済み事項、報告のみの事項を分ける。

人間判断候補は、[判断支援契約](11_Skill.md#53-decision-support-contract)に従い、現在の対象改訂版から**現在の判断集合（Current Decision Set）**として再構成する。監査またはレビューでは現在の固定改訂版を用いる。ExecutorまたはReviewerが`Decision Required`、承認要求または`Pass`を返しても、その申告からHuman Authority、採用、Risk Acceptance、Promotionまたは質問件数を推定しない。

Coordinatorは結果を、少なくとも次の既存経路へ接続する。

- Authority、停止条件、収束条件およびBudgetの範囲でAIが一意に是正できる事項は、責務を持つ実行主体へ戻し、更新後の対象改訂版を固定して再実行・再検証する。その対象契約、変更分類およびリスクからIndependent Reviewの適用要否を再評価し、正式なFindingを是正した場合は、[既存の解消契約](10_Agent.md#multi-location-remediation)に従い、作成責務から分離した確認者が同じ更新後固定改訂版、基準およびEvidenceから独立再レビューする。`Applied`、自己確認、Verification、古いResult／Reviewまたは実行主体の完了申告だけでFindingを`Resolved`にしない。
- 解消済み事項は、是正結果と実際の影響を報告するが、現在の判断要求へ戻さない。
- 報告のみの事項は追跡可能な詳細へ置き、現在の判断集合へ含めない。
- 将来に判断、再確認または監視が必要な事項は、現在の作業、Gate、停止判断、採用／却下、重大Risk受容または不可逆Effectへ影響せず、安全に独立保留でき、かつ担当責任者、再評価契機、保留影響および元のResult／Finding／Evidenceを既存の未完了事項、Roadmapまたは変更トレースへ接続できる場合に限り、現在のDecision Queueから除外する。将来という時点または追跡情報があることだけでは除外しない。条件または影響が不明な場合は、不足情報と確認先を示して現在判定から除外しない。
- 現在も人間の決定権限が必要な事項だけを現在の判断集合へ残す。未解決の重大リスク、不可逆性、残存Risk受容、Authority競合または検証不能は通常の集約へ埋めず、既存の停止・移送経路へ接続する。

複数結果が競合する場合はProvider数、Agent数または多数決で結論を選ばず、対象、基準、Evidence、未評価範囲および残存不確実性を保持して、再検証、必要な独立再レビューまたは人間判断へ接続する。Findingがなく、既存契約上Independent Reviewが非該当の軽量Operationには、新しいReview、承認、状態または成果物を追加せず、既存の完了条件を用いる。この経路に擬似的な`Resolved`を作らない。この統合責務は新しい成果物、状態軸、承認段階、固定Schema、中央判断台帳またはCoordinatorへの新しい決定権限を作らない。単一主体が複数責務を担うOperationでも、同じ意味境界を適用できる。

<a id="45-policy-contained-completion"></a>

#### 10.4.5. Policy-contained Completion

`Policy-contained Completion`は、事前承認されたOperationについて、必要なResultとVerificationが許可範囲内で成立し、そのRunを終了できる実行上の境界を意味する。Canonical Adoption、Promotion、Risk Acceptance、ReleaseまたはHuman Authorityを自動的に成立させない。

これは新しい第一級成果物、独立した状態軸または承認段階ではない。Current／Canonical Stateへ反映する場合は、[自律安全Architecture](05_Autonomous_Operation.md#autonomous-operation-safety)のPromotion Policyを別途適用する。Policy、Authority、必須Result、Verificationまたは未解決Riskを確認できないRunを、`Policy-contained Completion`へ丸めない。

#### 10.4.6. Identity、Reference、Provenance、Authority

本書は実行時の責務分離を所有し、将来互換の意味上の合成関係は[Forward Compatibility](05_Autonomous_Operation.md#forward-compatibility)へ接続する。

```text
Execution Identity
  → Logical Repository Identity、Repository Instance Identity、Target Revisionを使用

Context Scope
  → Repository Identity、Stable Context IDまたは同等Identity、Revision / Baselineから解決

Operation Result
  → Execution、Context、Evidence、DecisionへのProvenanceを保持

Operation Authority
  → Authority Requirement、Grant、Authorized Actorを分離
```

CRDDは意味とIdentity判定の共通不変条件を所有し、採用側はその条件内でLogical RepositoryとInstanceの関係を決める。Runtimeは採用済みIdentity Policyに基づくIdentity解決、Current State確認、Grant照合、実行Evidenceを所有する。ToolまたはConnectorは物理Locationと原子的Capabilityを提供できるが、Identity、AccessまたはAuthorityを自己確定しない。

これらを固定Schema、新しい台帳、Cross-Repository接続またはAIへの新しい決定権限として扱わない。表現可能なCapabilityがActivation Profileで無効な場合、Runtimeは利用しない。

---

### 10.5. CRDD、Runtime、Tool

#### 10.5.1. CRDDが所有する候補

```text
Why / Intent / Context
Decision / Evidence / Roadmap
Skill / Operation Goal
Re-evaluation Condition
Authority / Expected Outcome
Stop / Escalation / Learning
```

#### 10.5.2. Runtimeが所有する候補

```text
Schedule / Event Detection
Process and Agent Launch
Retry / Concurrency / Timeout
Execution History
Runtime Permission Enforcement
```

#### 10.5.3. ToolまたはConnectorが所有する候補

```text
Repository / CI / Analytics
Communication / Design / Browser
MCP / CLI / HTTP API
その他の許可された外部接続
```

Runtimeコードは`IF condition THEN invoke agent`までを担える。AI起動後の思考を固定Workflowへ置換しない。

---

### 10.6. Capability Provider

RuntimeまたはAdapterは、AIが選択できる原子的能力を提供できる。

候補：

- コンテキストの読取・検索
- ロードマップ、進捗、変更、判断、品質状態の取得
- 公開結果または測定の取得
- 試験実行
- 根拠、学び、候補の記録
- 許可された提案または操作

ツール名やAPI形状はCRDD Coreへ固定しない。

| 区分 | 意味 | 例 |
|---|---|---|
| Required | Operation成立に最低限必要 | 対象コンテキストの読取 |
| Permitted | 必要時に選択可能 | Repository検索、許可済み分析 |
| Restricted | 個別のAuthority確認が必要 | 外部公開、本番変更、費用執行 |
| Forbidden | Operationから利用不可 | シークレット取込み、未許可送信、無断の破壊的削除 |

委譲、Subagent、MCP、プラグインによって権限を増やさない。

Capabilityを実行するまでの境界は次の順序で確認する。

```text
Tool Capability
   ↓
Agent Permission
   ↓
Context and Information Boundary
   ↓
Operation Authority
   ↓
Actual Action
```

Toolが`publish`、`delete`、`deploy`等を公開していることは、Agentによる呼出し許可を意味しない。

---

### 10.7. Coding AgentとRuntime非依存

初期実証では、Repository探索、ファイル操作、Git、試験、CLI、複数段推論を持つCoding AgentをRuntimeとして利用できる。

```text
Scheduler / Event
       ↓
Coding Agent
       ↓
Repository Root
       ↓
AGENTS.md / README / CRDD
       ↓
Operation Goal
       ↓
Reasoning / Result
```

ただし本候補を特定製品専用にしない。必要能力を示し、製品、CLI、API、MCP、将来Runtimeは交換可能なAdapterとして扱う。

READMEやAGENTS.mdは導入方法と起動例を案内できるが、CRDD Coreの意味正本や固定Promptにしない。

---

### 10.8. MCPの位置付け

MCPはRuntime InterfaceまたはCapability Adapter候補であり、必須要件ではない。

- MCP接続済みであることをAuthorityとみなさない。
- 読取、候補作成、正本変更、公開、削除の権限を分ける。
- Repository境界、目的、送信先、情報分類を越えてコンテキストを共有しない。
- Repository単位MCPは境界を明確にできる候補だが、常駐Serverを導入条件にしない。
- `1 Repository = 1 Server`ではなく、初期は`1 Repository = 1 Executable Context`として検証できる。

Repository数やOperation数が増えた場合だけ、Registry、Scheduler、権限、実行履歴、Retry、Recovery、Monitoringを持つ専用Runtimeの価値を再評価する。専用RuntimeはCRDDそのものではない。

---

### 10.9. エージェント組織（Agent Organization）

エージェント組織の目的と概念境界は[エージェント組織](04_Agent_Organization.md)を正本とする。本節は、複数の実行主体へ作業を割り当てる場合も、CRDDが必要なコンテキスト、決定権限、能力、期待結果および検証要求を所有し続けるという責務境界だけを示す。

採用側ポリシーは利用可能な実行境界を定め、実行環境は適格性判定と適格集合内の最適化を実行し、プロバイダーアダプターは固有APIと入出力変換を担う。この経路制御アーキテクチャは[エージェント組織の実行アーキテクチャ](04_Agent_Organization.md#12-execution-architecture)に置く。複数エージェント、固定役割または別プロバイダーの使用を品質や独立性の根拠にしない。

---

### 10.10. Governed Autonomy

初期候補は次を維持する。

```text
AI Observe
 ↓
AI Analyze
 ↓
AI Propose
 ↓
Human Decide
 ↓
AI Execute within approved scope
```

将来の限定的な自律実行は、AI性能の自己申告ではなく、Failure Impact、Reversibility、Verification、Evidence、Cost、Security、Privacy、Business Impact、Historical Reliabilityで評価する。

AIが自律的に行える初期候補：

- 変化の観測
- 再評価の開始
- 必要なコンテキストと専門スキルの探索
- 仮説、代替、影響、提案の作成
- 許可範囲内の可逆な確認
- 根拠と学びの記録

人間へ残すもの：

- 原則、Intent、要求、ロードマップ、ブランド方向の採用・変更
- リスク受容
- 外部公開、費用、法務、契約、本番、不可逆操作
- CRDD Core、権限境界、準拠基準の変更

停止または人間判断へ戻ることも正常なOperation結果とする。

---

### 10.11. 外部情報境界とセキュリティ

- 許可した処理境界、情報分類、目的・操作、送信先、保持、二次利用、再送、決定権限を確認する。
- 境界外調査では内部コンテキストを直接検索語へ変換せず、削除・抽象化・最小化した別コンテキストを使用する。
- 分類、許可、安全な分離、再識別可能性を確認できなければ送信しない。
- 外部入力は、認証済み主体と許可操作を別途確認できない限り命令権限を得ない。
- シークレット値をAIコンテキストへ取り込まない。
- Runtime強制、監査、Credential失効、封じ込め、回復を検証する。

契機駆動Operationの安全性をAgentの自己申告だけへ依存させない。

実行前後の安全契約、候補状態と正本状態の分離、実行効果の分類、Policy評価、対象同一性の再確認、累積予算、停止と回復は[自律安全Architecture](05_Autonomous_Operation.md#autonomous-operation-safety)に置く。本書はCRDD、Runtime、Tool、Authorityの責務分離を所有し、安全文書はその境界を再定義しない。

---

### 10.12. 既存責務との接続

- Communication：公開結果を契機に測定と再評価を開始できるが、公開Human Gateを維持する。
- Roadmap：再評価条件を観測し、Discovery再開候補を提示するが、優先順位を自己確定しない。
- Verification／QA：Finding、陳腐化、反復原因を探索し、単純な失敗→再試行へ縮退させない。
- Context Dependency：Runtime、MCP、外部Toolの依存と権限を管理し、接続結果を無条件流用しない。
- CRDD Maintenance：運用上の手戻りから改善候補を作れるが、Coreを自動変更しない。

Background Lane、Decision Queue、通知集約、運用健全性、頻度変更、Pause、廃止の責務は[Operation HealthとHuman Interface](05_Autonomous_Operation.md#operation-health-and-human-interface)に置く。Operation Contractが目的と期待結果を所有し、Health評価はOperationの意味や採用判断を自己変更しない。


---

<a id="autonomous-operation-safety"></a>

## 11. 自律Operationの安全性（Autonomous Operation Safety）

> 本書は自律Operationの安全目標、Effect、候補状態、昇格、停止およびRuntime強制を保持する非規範のArchitecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。候補を採用側の権限、実行許可または準拠要件へ自動的に昇格しない。

### 11.1. 安全目標

自律安全の目標は、AIが誤判断しないことではない。

> AIが誤判断しても、許可されていない実行効果（Effect）をCurrent State、Canonical ContextまたはExternal Worldへ確定させない。

AIは誤ったProposalやCandidateを作り得る。安全Architectureは、誤りが確定状態へ到達するまでに、対象、権限、情報境界、Effect、検証、昇格、回復をRuntimeで強制可能にする。

中心原則：

> 自律性は思考と候補形成に広く与え、実行効果の確定はPolicyとRuntimeで統制する。

短い表現：

> `Think broadly. Effect narrowly.`

ただしReasoningも無制限ではない。利用できるコンテキストは、Agent Permission、Context Scope、Information Classification、External Information Boundaryの内側に限られる。

---

### 11.2. 安全な実行経路

```text
Trigger
  ↓
Resolve Runtime Identity
  ↓
Resolve Current State
  ↓
Authorize Context Access
  ↓
Reason
  ↓
Effect Proposal
  ↓
Effect Manifest
  ↓
Policy Evaluation
  ├─ Denied / Unknown
  │      ↓
  │   Stop / Human Decision
  │
  └─ Allowed
         ↓
     Prepare Isolated Candidate
         ↓
     Compare-and-Swap Check
         ↓
     Execute within Effect Boundary
         ↓
     Verify
         ↓
     Promotion Policy
       ├─ Auto Promote when pre-authorized and fully verified
       ├─ Human Gate
       └─ Reject / Recover
         ↓
     Record Result / Learning
         ↓
     Update Effect Budget
         ↓
     Circuit Breaker Check
```

この経路は固定Workflowを要求するものではない。推論順序ではなく、Effectが確定状態へ到達する前後に成立すべき安全境界を示す。

---

### 11.3. コンテキストアクセス

Actionだけを制限しても安全ではない。Read、Context Import、外部送信、Toolへの入力もEffectとして扱う。

```text
Available Context
   ↓
Agent Permission
   ↓
Operation Scope
   ↓
Information Classification
   ↓
Authorized Context
```

- Repository全体が存在することを全読取権限とみなさない。
- Agentが読めることを、Subagent、MCP、外部AIへ送れることとみなさない。
- Derived Informationと組合せによる再識別可能性を元情報から切り離さない。
- Secret値はReasoning Contextへ取り込まない。
- Current StateとHistorical State、AdoptedとCandidate、ValidとStale／Invalidatedを区別する。
- Context ScopeまたはClassificationを確定できない場合は、対象Effectを発生させない。

---

### 11.4. 実行効果の分類

実行効果（Effect）は少なくとも次を区別できるようにする。

| Effect候補 | 主な安全境界 |
|---|---|
| Read | Context Scope、分類、Secret、Derived Information |
| Context Import | 出所、信頼、Prompt Injection、Instruction Authority |
| Local Write | 対象範囲、可逆性、Current Stateとの競合 |
| Candidate Write | Current／Canonicalとの分離、検証、廃棄可能性 |
| Canonical Change | 決定権限、独立確認、昇格条件、移行 |
| External Send | 送信先、目的、最小化、保持、二次利用、再送 |
| Publish | 成果物、版、公開先、Human Gate、公開済み記録 |
| Deploy | 環境、影響、検証、段階展開、回復 |
| Financial Action | 金額、期間、相手、予算、決定権限 |
| Legal／Consent Action | 権限主体、適用範囲、証跡、取消可能性 |
| Delete／Destructive Action | 対象、不可逆性、依存、Backup、Recovery |

External SendをWriteの一種へ縮退させない。情報は送信時点で不可逆に伝播し得るため、CRDDのExternal Information Boundaryと直接接続する。

分類はAgentの「低Risk」という自己申告で決めない。対象、操作、送信先、正本性、不可逆性、費用、権限等の観測可能なEffectからPolicyが経路を決める。

---

### 11.5. 効果明細

効果明細（Effect Manifest）は、実行前に少なくとも次を再構成可能にするRuntime State候補である。

```text
Target
Operation and Run Identity
Current Revision / Baseline
Expected Effects
Affected Context or External Destination
Required Authority
Information Classification
Verification
Recovery or Compensating Action
Effect Budget impact
```

固定Markdown、固定ファイル、固定Schemaまたは人間向けの長い表をすべての操作へ要求しない。Operation設定、対象Identity、実際の差分、Tool call、送信先、Permission、Verification、Cost等からRuntimeが機械的に構成し、PolicyがEffectを判定できる形で取得可能にする。人間にはDecisionが必要な場合だけ要約を示す。

Effectを事前に再構成できない操作は、自律的な確定操作へ進めない。AgentがEffect Manifestを書いたという事実だけで正しいとはみなさず、実際のTool call、差分、送信先、対象Identityと照合する。

---

### 11.6. Candidate StateとPromotion

AIが変更することと、現在または正本へ反映することを分離する。

```text
Current / Canonical State
        ↓
Prepare Isolated Candidate
        ↓
Verify
        ↓
Promotion Policy
  ├─ Auto Promote
  ├─ Human Gate
  └─ Reject / Recover
```

- CandidateはCurrentまたはCanonicalと誤認されないIdentityを持つ。
- Candidate作成権限からCanonical変更権限を推定しない。
- Candidateが検証済みでも、Promotion Authorityを自動取得しない。
- RejectされたCandidateを次回OperationがCurrent Stateとして流用しない。
- Promotion後に、対象Identity、Result、Evidence、Learningを更新する。

Auto Promote候補は、事前承認されたOperation、対象、Effect、Budget、検証、回復条件の内側に完全に収まり、Policyが機械的に確認できる場合だけ検討する。Agent自身が経路を分類しない。Canonical Context、外部公開、本番、費用、法務、権限、重大Security Effectは既存Human Gateを既定として維持する。

Git branchやPull Requestは実装候補であり、CRDD Core要件ではない。他のRuntimeも同等のCandidate／Current分離を提供できる。

---

### 11.7. 対象同一性の再確認

自律Operationは、読み始めてからEffect確定までにCurrent Stateが変わり得る。

```text
Target Revision = A
      ↓
Reason / Prepare
      ↓
Current Revision == A ?
  ├─ Yes → Policy範囲内で続行
  └─ No  → Stop / Re-evaluate
```

対象同一性の再確認（Compare-and-Swap）は、古いコンテキストに基づくEffectを新しいCurrent Stateへ適用しないための不変条件候補である。

- Target Revision、Baselineまたは同等Identityを開始時に固定する。
- Promotionまたは外部Effect直前にCurrent Stateとの一致を再確認する。
- 不一致を自動mergeや「軽微な差分」として丸めない。
- 再評価する場合は新しいRun Identityを持ち、旧Evidenceを現在判定へ流用しない。

---

### 11.8. 効果予算

効果予算（Effect Budget）は単純なファイル数やTool call数だけでは決めない。

評価候補：

- 対象範囲と対象種別
- Current／Canonicalへの影響
- External propagation
- Authorityへの影響
- 不可逆性と検出遅延
- 回復の完全性
- 費用と資源消費
- 人間、利用者、事業への影響
- 一定期間の累積Effect

BudgetはRun単位に加え、必要に応じて日、週、Release等の期間で累積する。一つずつは許可範囲でも、累積するとDirectionや運用を実質変更するEffectを検出する。

固定値をCRDD Coreへ埋め込まない。Activation Profile、Operation、対象環境、既存Policyに応じてRuntimeが上限を強制し、超過時は停止またはHuman Decisionへ戻す。

---

### 11.9. 再帰、重複、Retry

- `operation + repository + target revision`相当の実行キーを持つ。
- Run ID、Trigger Cause、Parent Run IDを取得可能にする。
- 同じ原因・対象の同一Operationを同時実行しない。
- Operation Result自身を同一Operationの即時Triggerにしない。
- 別Operation起動はCandidateとし、Trigger評価とAuthority確認を経る。
- Retryは回数、時間、費用、Effectを上限化する。
- 同じ失敗をRetryで隠さず、原因不明または非一時的な失敗は停止する。
- AgentやSubagentの委譲で実行BudgetとAuthorityを増やさない。

---

### 11.10. 自律実行停止

自律実行停止（Circuit Breaker）はOperation単体またはRepositoryの自律実行を一時停止できる候補である。

発火候補：

- 同一または同根失敗の反復
- RollbackまたはRecoveryの反復
- Authority拒否の反復
- Current State解決失敗
- External Information Boundary違反の疑い
- Proposal Spamまたは誤起動の急増
- CostまたはEffect Budgetの急増・超過
- 検証失敗、監査ログ欠落、Runtime強制の不成立

Circuit Breakerは停止範囲、原因、未確定Effect、封じ込め、再開条件、再開Authorityを取得可能にする。Agent自身が安全になったと宣言して再開しない。

---

### 11.11. 検証、回復、昇格

実行者自身の「完了」をEffect確定の根拠にしない。

- 決定論的検証がEffect全体を証明できる場合は、その証明範囲を明示する。
- 意味、Authority、外部影響、重大Risk等の機械検証外は独立確認またはHuman Gateへ戻す。
- Checker成功を意味、準拠、公開、Security、安全なPromotionへ流用しない。
- Rollback可能という主張だけで可逆とみなさず、必要に応じてRecoveryを演習する。
- 外部伝播を完全に戻せない場合は、Compensating Action、通知、Credential失効、封じ込めを扱う。
- Promotion、Reject、Recoverの結果をRun IdentityとEffect Manifestへ接続する。

---

### 11.12. Runtime Enforcement

CRDD Core候補は安全不変条件を所有し、実装方式を固定しない。Runtime候補は次を提供できる。

- Sandboxまたは隔離されたCandidate領域
- Capability tokenまたは同等の権限制御
- File、Process、Network、External Destinationの制御
- Execution Lease、Idempotency、Concurrency制御
- Timeout、Cost limit、Retry limit
- Snapshot、Rollback、Compensating Action
- Tamper-evidentなExecution Evidence
- Circuit Breakerと再開Authority

特定機構を使ったことを安全性の証明にしない。RuntimeがCRDDの意味上の不変条件を実際に強制し、そのEvidenceを取得できることを確認する。

---

<a id="13-安全不変条件候補"></a>

### 11.13. 安全不変条件候補

1. 明示的に許可されていないContext AccessとEffectは確定させない。
2. Candidate作成権限からPromotion Authorityを推定しない。
3. Agent、Subagent、Tool、MCP、RuntimeはAuthorityを自己拡張しない。
4. Current State、Target Identity、Classification、Authorityが不明ならEffectを発生させない。
5. 古いRevisionに基づくEffectを新しいCurrent Stateへ適用しない。
6. External SendをLocal Writeと同じ境界で扱わない。
7. 実行前のEffect Manifestと実際のEffectを照合する。
8. Run単位と累積のEffect Budgetを越えない。
9. Operation Resultから無制御にOperationを増殖させない。
10. 実行者の自己申告だけでVerify、Promote、Recoverまたは再開としない。
11. 失敗を検出できず回復経路もないEffectを自律実行へ昇格させない。
12. Activation Profileは安全契約を省略せず、許可するEffectだけを狭める。
13. `Representable ≠ Enabled ≠ Accessible ≠ Authorized ≠ Promoted`を維持し、前段の成立から後段を推定しない。
14. 未解決または未知のRepository Identity、Context Reference、Authority型を無視してEffectを許可しない。
15. Safety、Privacy、Authority、Contractまたは必須CapabilityをOptimization Scoreで相殺しない。
16. Providerへの送信許可、Context Projection、AuthorityまたはTool AccessをFallback先へ流用しない。
17. Providerの相違をIndependent Reviewの成立根拠にしない。
18. [Policy-contained Completion](05_Autonomous_Operation.md#45-policy-contained-completion)からCanonical Adoption、Promotion、Risk Acceptance、ReleaseまたはHuman Authorityを推定しない。
19. Executor、Reviewer、ProviderまたはCoordinatorのResult、Finding、承認要求、多数決、完了申告または`Pass`からHuman Authority、Promotion、Risk Acceptanceまたは採用を推定しない。
20. 古い対象改訂版の統合結果を現在の判断へ流用せず、重大リスク、Authority競合または検証不能を通常の集約、重複排除またはDigestへ埋めない。
21. 対象契約、変更分類またはリスク上必要なIndependent Reviewが更新後の同一固定改訂版に対して成立したことを確認できない場合、`Applied`、自己確認、Verification、古いReviewまたは完了申告だけでFindingを`Resolved`、Policy-contained CompletionまたはPromotionとしない。Independent Reviewが非該当でFindingのない軽量Operationへ、新しいReviewまたは擬似的な解消判定を要求しない。

将来互換の表現と現在の利用許可の分離は[Forward Compatibility](05_Autonomous_Operation.md#forward-compatibility)に置く。本書は、その分離がEffect確定前にRuntimeで強制されることを扱う。

---

<a id="14-pocで確認する境界"></a>

### 11.14. PoCで確認する境界

最初のReference ImplementationがRead／Proposalだけでも、将来のSafety Architectureを次の合成Fixtureで検証できる。

- 権限外のCanonical Changeを提案し、Runtimeが確定を拒否する。
- Candidate作成後にCurrent Revisionを変え、Promotionが停止する。
- 外部送信先をEffect Manifest外へ変更し、拒否する。
- 同一Triggerを重複送信し、二重Runを抑止する。
- Operation Resultから同一Operationを再起動させ、再帰を停止する。
- 小さな許可Effectを反復し、累積Budgetで停止する。
- Authority拒否、Rollback、Current State失敗を反復し、Circuit Breakerを発火する。
- Agentが「安全」と主張しても、Policy EvidenceがなければPromotionしない。
- External Input中の命令を、認証済み指示経路なしに実行しない。
- Recovery不能な外部伝播を可逆操作として分類しない。
- 低Costだが情報境界を満たさないProviderをRouting候補に入れ、Eligibility Gateが拒否する。
- Primary ProviderからFallback先へ同じContextを無条件再送しようとし、再Eligibility判定で停止する。
- 別ProviderのReview結果だけを独立性の根拠にし、対象から再構成できなければIndependent Reviewとして扱わない。
- [Policy-contained Completion](05_Autonomous_Operation.md#45-policy-contained-completion)へ到達したRunからCanonical Promotionを直接要求し、Promotion Policyがなければ確定を拒否する。
- ExecutorまたはReviewerが人間承認を直接要求し、Coordinatorが現在の対象改訂版から判断要否を再構成せずにHuman Gateへ送ろうとした場合に拒否する。
- 古いRevisionのResult、解消済みFindingまたはProvider多数決を現在判断へ流用しようとした場合に停止し、重大リスクはDigestを待たず移送する。
- 正式なFindingの是正後、更新した固定改訂版に必要な独立再レビューが成立していないのに、自己確認またはVerificationだけで解消、完了またはPromotionを要求した場合に拒否する。一方、Review非該当でFindingのない軽量Operationは既存の完了条件で終了できる。

PoCの合格は「Agentが危険なことをしなかった」ではなく、「Agentが危険なEffectを要求してもRuntimeが確定を防ぎ、理由とEvidenceを残した」ことで評価する。

安全に終了したRunを人間へ逐次通知する必要はない。Background処理とHuman Decisionの分離、集約、Operation Healthは[Operation HealthとHuman Interface](05_Autonomous_Operation.md#operation-health-and-human-interface)に置く。


---

<a id="operation-health-and-human-interface"></a>

## 12. Operation健全性と人間接続（Operation Health and Human Interface）

> 本書は自律Operationの健全性、人間への判断提示、通知集約および適応を保持する非規範のArchitecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。活動量や自動化率を成功または品質へ読み替えない。

### 12.1. Success Principle

本候補の価値は、AIの起動回数、自動処理件数、Agent数または自動化率では測らない。

> 自律Operationは、人間の判断負荷を増やすだけなら成功ではない。

目標は、人間が覚え、巡回し、情報を集め、差分を整理する作業を減らし、価値、方向、優先順位、重要判断、残存リスク受容へ集中できる状態である。

```text
Machine-heavy
  観測、差分、重複排除、Policy、検証、記録、集約

Human-light
  Direction、Canonical Change、新しい処理境界・Authority変更・残存リスク受容を要するExternal Send、Publication、Production、Financial／Legal Effect、例外
```

AIの背景活動を人間へそのまま投影しない。Human InterfaceはActivity FeedではなくDecision Queueを中心候補とする。

---

### 12.2. 二つのLane

#### 12.2.1. Background Lane

```text
Observe
  ↓
Reason
  ↓
Candidate
  ↓
Policy Check
  ↓
Verify
  ↓
Coordinator Result Integration
  ↓
Outcome Routing
  ├─ No impact            → Record / End
  ├─ Policy-contained Completion → Complete / Record
  ├─ Duplicate / Rejected → Aggregate / End
  └─ Decision required    → Human Decision Lane
```

Background Laneは、人間判断を回避する経路ではない。既存PolicyとAuthorityで一意に解決できる結果だけを終了または完了へ進める。Policy不明、Authority競合、重大Risk、検証不能を`No impact`へ丸めない。

Run終了の意味は[Policy-contained Completion](05_Autonomous_Operation.md#45-policy-contained-completion)に従う。Background Laneで終了できることから、Canonical Adoption、Promotion、Risk Acceptance、ReleaseまたはHuman Authorityを推定しない。

#### 12.2.2. Human Decision Lane

候補：

- ProductまたはDesign Direction変更
- Canonical Context変更
- 新しい処理境界、Authority変更または残存リスク受容を必要とするExternal Send
- Publication、Production、Financial、Legal Effect
- Residual Risk Acceptance
- Policy AmbiguityまたはAuthority Conflict
- Circuit Breakerと再開判断
- 自律OperationのActivation、権限拡張、Pause解除、廃止

人間にはActivity全体ではなく、今回決めること、推奨、根拠、主な選択肢、影響、Risk、保留時の状態を示す。

許可した処理境界内で、対象OperationのAuthority、目的、送信先、情報分類、最小化、Verification Requirement等をPolicyが確認できるExternal Sendは、外部送信であることだけを理由に毎回Human Decision Laneへ送らず、既存Policy内の実行として処理できる。Runを終了するときは、必要なResultとVerificationが成立したことを確認し、[Policy-contained Completion](05_Autonomous_Operation.md#45-policy-contained-completion)に従う。許可を別目的、別送信先、別Provider、別tenantまたは別Operationへ流用せず、境界条件の変更または判定情報不足はHuman Decisionへ戻す。Publicationその他の既存Human Gateは維持する。

---

### 12.3. Decision Queue

Decision Queueは新しい必須成果物または固定UIを意味しない。[Coordinatorによる結果統合](05_Autonomous_Operation.md#44-coordinatorによる結果統合)を経て、現在の対象改訂版から再構成された現在の判断集合を表示するHuman Interface候補である。複数Runの結果、未解決事項または人間判断候補をそのままQueue項目へ変換しない。

人間判断は、同じ決定権限者と同じ判断時点を持ち、独立して保留または採否できず、分離すると意味または結果が壊れる場合だけ一つにまとめる。根本原因と対象Identityは重複排除、来歴、是正統合または影響範囲の判断に利用できるが、人間判断をまとめる必須条件にしない。判断が残らなければ、人間による判断が現在は不要であることを明示し、形式的な承認を要求しない。

```text
Autonomous Operations: 100
  ├─ Automatically ended: 94
  ├─ Completed within Policy: 4
  ├─ Duplicate suppressed: 1
  └─ Human decision required: 1
```

人間へ示す候補：

```text
Decision Required
Target and Current Revision
Meaningful Change
Evidence
Recommendation
Alternatives
Expected Effect
Verification
Residual Risk
Decision Authority
Due or Re-evaluation Condition
```

同じ判断をRunごとに重複提示しない。既存の未解決事項、Communication Human Gate、ChangeまたはQuality Centerと接続できる場合は、重複正本を作らない。

---

### 12.4. 通知と集約

通知はOperationの完了条件ではない。

- `No impact`、重複抑止、既知Policyによる拒否は、原則として逐次通知せずDigestへ集約できる。
- Policy拒否のたびに人間へ承認を求めない。本当に必要なCapabilityなら、一定期間の集約結果からPolicy変更候補として提示する。
- Circuit Breakerは同じ失敗を繰り返し通知せず、対象OperationまたはRepositoryをPauseして一つの判断事項へまとめる。
- Security Incident、外部漏洩疑い、不可逆Effect等の即時性が必要な事象は、Digestを待たず既存のEscalationへ接続する。
- 人間が「通知なし」を選んだことを、未解決Riskの終了やAuthority承認とみなさない。

---

### 12.5. EventのDebounceとBatch

すべてのEventを即座にAgent起動へ結び付けない。

```text
PR integrated
Issue updated
Decision changed
Roadmap changed
      ↓
Debounce / Batch
      ↓
Revision Set
      ↓
Meaning Change Assessment
      ↓
必要なOperationだけ起動
```

DebounceとBatchは意味影響を捨てる仕組みではない。

- Eventを対象Identityと時間窓で集約する。
- 緊急性、Security、不可逆性が高いEventは別経路へ送る。
- 集約中に上書きされた情報を失わず、Revision Setから再構成可能にする。
- Batch終了条件と最大遅延を持ち、永続的な先送りを防ぐ。
- 同一原因のEventを複数Operationへ無制御に扇状展開しない。

---

### 12.6. 差分起点の探索

```text
Last Evaluated Revision
        ↓
Current Revision
        ↓
Diff / Event Set
        ↓
Affected Context
        ↓
必要に応じて上流・履歴・関連工程へ拡張
```

- 差分を入口にしてAI実行時間とContext取込みを減らす。
- Diff-onlyを固定Workflowにせず、意味、Authority、依存、Directionへ影響する場合は正本やDecision Historyまで遡る。
- Last Evaluated RevisionとCurrent Revisionを再識別する。
- 前回Resultを無条件に現在Evidenceへ流用しない。
- 探索範囲、対象外、利用不能Context、残存不確実性、収束理由をResultへ残す。

探索範囲は狭く開始できるが、狭いまま終了してよいという自己申告経路にはしない。追加探索が判断を有意に変え得る場合は収束しない。

---

<a id="7-operation-health"></a>

### 12.7. Operation Health

自律Operation自身をQuality対象とする。

| Health候補 | 見るもの |
|---|---|
| Human minutes per useful decision | 有益な判断1件に必要な人間時間 |
| Useful decision／finding rate | 判断や行動を有意に変えた割合 |
| No-change rate | 有意な変化なしで終了した割合 |
| Duplicate suppression rate | 不要な重複起動を抑止した割合 |
| Proposal rejection rate | 人間またはPolicyが候補を却下した割合 |
| False positive rate | 重要でないものを重要とした割合 |
| Missed trigger rate | 人間が後から発見した重要契機 |
| Cost per useful finding | 有益な発見あたりの時間・モデル・Tool費用 |
| Routing rejection rate | Eligibilityを満たさず拒否したRouting候補と理由 |
| Fallback effectiveness | Fallbackの成功、失敗、再評価費用、品質差 |
| Provider concentration | 単一Execution Boundaryへの依存と障害影響 |
| Context transfer burden | Provider間の投影、再送信、再検証で増えた費用と人間負荷 |
| Hard resource boundary violation | Hard Cost／Effect Budget Ceiling超過、または必要Quota／Rate-limit不足による拒否 |
| Routing cost efficiency | Eligibleな実行結果あたりのEstimated／Actual CostとQuota／Credit効率 |
| Circuit breaker frequency | 自律実行停止の頻度と原因 |
| Recovery burden | 失敗の検出、回復、人間対応に要した費用 |

単一の指標を最適化しない。例えば通知を減らして見逃しが増えた場合、人間負荷低下を成功とみなさない。安全性、有用性、見逃し、人間負荷、費用を分けて評価する。

プロバイダーまたは利用枠の均等分散も成功条件にしない。費用上限／Effect Budget Ceiling違反または実行能力不足は適格性の拒否として扱い、見積費用や割当量／利用枠効率とは別の健全性信号にする。本書はこれらの観測と運用評価を所有し、費用を品質成立条件より先に置かない共通原則と適格候補間の最適化は[エージェント組織](04_Agent_Organization.md)を参照する。

---

### 12.8. Adaptive Operation

> Operation Healthは実行強度を適応させてもよいが、自身の目的、Authority、安全境界、成功条件を自己変更してはならない。

対象コンテキストまたはCapabilityの変更が、Operationの目的、判断対象、情報境界、Authorityまたは期待結果を実質的に変える場合、その変更を実行強度の調整として扱ってはならない。Semantic Contract変更候補として人間の決定権限へ戻す。

Repository Identity、Context Referenceの解決範囲、Provenanceの情報源またはAuthority Grantの対象Scopeを変える場合も、単なる探索範囲や頻度の調整とみなさない。[Forward Compatibility](05_Autonomous_Operation.md#forward-compatibility)が示す意味境界への変更として、既存のAuthorityへ戻す。

Operation Healthに応じて次を候補化できる。

- 実行頻度を下げるまたは上げる
- Scheduled TriggerをEvent／Condition Triggerへ変更する
- Debounce時間またはBatch境界を変更する
- 対象ContextまたはCapabilityを見直す
- Human Queueの集約単位を変える
- Activation Profileを狭める
- OperationをPauseする
- Operationを再設計または廃止する

Operationが自分のHealth結果を根拠に、自動で目的変更、権限拡張、Profile昇格、Policy変更、安全境界変更または成功条件変更を行わない。低Riskで事前承認された頻度調整等を自動化する場合も、許可範囲、上限、Verification、Rollback、再評価条件を持つ。

---

### 12.9. 停止・再設計候補

次の状態が継続する場合、Operationを成功扱いせず、頻度低下、Pause、再設計、廃止を検討する。

- 人間が確認する時間が、削減できた巡回・整理時間を上回る。
- 大部分のProposalが却下され、理由が反復する。
- No-change率が高く、実行費用に見合う判断価値がない。
- 同じ判断を繰り返し要求する。
- 誤検出処理が人間の見逃し補完より重い。
- Missed Triggerが許容境界を超える。
- Runtime保守がProduct開発やCRDD運用を圧迫する。
- Circuit Breaker、Recovery、Authority拒否が反復する。
- Operation Healthを判定するEvidence自体が取得できない。

閾値はOperation、対象、頻度、影響に応じて定義し、曖昧な「重い」「役に立たない」だけで停止または継続を決めない。

---

### 12.10. 責務境界

CRDD候補が所有するもの：

- Human負荷を含むSuccess Principle
- Background／Human Decisionの意味境界
- Operation Healthの評価観点
- Pause、再設計、廃止を判断する再評価契機
- 人間判断へ渡す最小情報

Runtime候補が所有するもの：

- Debounce、Batch、Digest、Queue、通知配送
- RunとEffect Manifestからの機械集計
- Revision Set、重複抑止、Cost計測
- Circuit BreakerによるPause
- Health Evidenceの記録

Humanが所有するもの：

- Direction、Canonical Change、Risk Acceptance
- Operationの採用、Authority拡張、Profile変更
- Pause解除、再設計、廃止の判断
- 人間負荷と判断価値の受容可能性

特定Queue製品、通知先、Dashboard、UI、Runtime実装をCRDD Coreへ固定しない。

---

### 12.11. PoCで確認すること

<a id="reference-operation-experiments"></a>

#### 12.11.1. 参照Operation実証

最初の実証は専用Platformの規模ではなく、契機とGoalだけを与えたときに、AIが固定Promptへ探索順を書かなくてもCRDDコンテキストから判断価値のある結果へ到達できるかを確認する。次の四つは比較可能な候補であり、すべての採用先へ実装を要求しない。

| 候補 | 意味変更の判断 | 確認する固有境界 |
|---|---|---|
| 週次プロダクトレビュー | Current State、重要変化、Risk、Roadmap影響および次の判断を再構成する | 変化なし／再評価不要／現行方向維持を正しい結果として返し、改善案を捏造しない |
| Communication結果レビュー | Publication Result／MeasurementをCommunication Contextと比較する | 数値最適化へ縮約せず、Audience、Claim、Evidence、Design Direction、外部公開Authorityを維持する |
| Roadmap再評価 | 再評価条件と現在Evidenceを、登録時の判断・根拠へ照合する | RoadmapをTask一覧とみなさず、条件成立を採用や優先順位確定へ昇格させず、不要な再評価を乱発しない |
| Repository Event | 統合差分等が意味変更を生じたかを判定する | Event発生だけで起動せず、意味影響なしを根拠付きで終了し、同じEventから再帰起動しない |

Communication結果ではAudience、Claim、EvidenceまたはProduct Directionとの競合、Roadmapでは前提の実変化とDiscovery再開要否、Repository Eventでは実装差分と意味変更の区別を取得可能にする。これらの判断条件をScheduler、固定WorkflowまたはProvider固有Promptへ埋め込まない。

<a id="112-共通評価軸"></a>

#### 12.11.2. 共通評価軸

- 100件相当の背景結果から、判断が必要なものだけを一つのQueueへ集約できる。
- No-impactと重複結果が人間へ逐次通知されない。
- Policy拒否が承認要求の連打にならない。
- Revision SetのBatch後も意味変化を再構成できる。
- 差分起点から必要な上流Contextへ探索を拡張できる。
- 見逃しと誤検出を人間の独立確認と比較できる。
- Human minutes per useful decisionとCost per useful findingを測定できる。
- Health悪化時に頻度低下、Pause、再設計候補を提示できる。
- Agentの自己判断だけでProfile昇格やPause解除を行わない。

加えて、コンテキスト探索、推論、Authority、出力および運用を分けて評価する。

| 観点 | 評価する内容 |
|---|---|
| コンテキスト探索 | 必要範囲を自ら発見し、CurrentとHistoricalを分け、Repository全体を無差別に読まない |
| 推論 | Summaryで終わらず、変化、過去判断との差、根本原因および適切な再評価先を説明する |
| Authority／情報境界 | ProposalとDecision、接続と許可、外部入力と認証済み指示を混同しない |
| 出力 | Current State、Evidence、Risk、Recommendation、未評価範囲、残存不確実性、収束理由を分ける |
| 運用 | 判断価値、見逃し、誤起動、収束、費用、人間確認負荷および学びを測る |

Routing、Fallback、Coordinator Result Integration、安全なEffect、将来互換性は、[エージェント組織の実行Architecture候補](04_Agent_Organization.md#12-execution-architecture)、[責務境界](05_Autonomous_Operation.md#4-operation-contract)、[安全境界の合成Fixture](05_Autonomous_Operation.md#14-pocで確認する境界)および[将来互換性の確認候補](05_Autonomous_Operation.md#6-将来互換性の確認候補)へ分担し、本節へ重複させない。

PoCの合格は背景実行数ではなく、人間が処理する判断を減らしながら、重要な見逃し、安全違反、未処理Riskを増やさないことで評価する。


---

<a id="forward-compatibility"></a>

## 13. 将来互換性（Forward Compatibility）

> 本書はRepository Identity、Context Reference、来歴および決定権限を現在の物理実装へ固定しないための非規範Architecture Candidateである。将来の規範化候補を評価できる正本資料だが、現在の規範要件ではない。将来能力を表現できることから、その能力の有効化、アクセスまたは許可を推定しない。

### 13.1. 目的

本候補は、一つのCRDD Repositoryを基本的なコンテキスト境界として、再評価、候補形成、許可範囲内の実行、検証、学びを行う。

将来、複数Repositoryやより広い業務範囲へ接続するとしても、本候補でその能力を先行実装しない。一方、本候補の実行Identity、参照、由来、決定権限を物理Locationや現在の実行主体へ固定し、将来Core Contractの全面変更が必要になる状態も避ける。

中心原則は次のとおりである。

> **未来のCapabilityは追加しない。未来の拡張点だけを閉じない。**

Forward Compatibilityは、現在のScope、アクセス、操作または決定権限を拡大する理由ではない。

---

### 13.2. 本候補で確保する四つの接続点

#### 13.2.1. Repository Identity

Repository Identityは、URL、Directory名、Git Remote、Hosting Provider等の物理Locationそのものへ固定しない。論理的な正本境界と、その内容を保持する物理実体も区別する。

```text
Logical Repository Identity
  正本Context、Decision Authority、Lifecycleを持つ論理単位

Repository Instance Identity
  clone、mirror、worktree、cache等の物理実体
```

複数Instanceが同じLogical Repositoryを指していても、各Instanceが同じアクセス権、書込権、Promotion AuthorityまたはCurrent Stateを持つとは限らない。内容が同じであること、同じremoteを参照すること、または物理的に複製されたことだけからLogical Identityを決めない。

本候補では`Current Logical Repository = Current Context Boundary`を基本としてよい。Cross-Repository Operationは行わない。ただし、Execution Identity、重複抑止、Current State解決でLogical Repositoryと実行に使用したInstanceを再識別できるようにする。

固定Schemaや全Repositoryへの新しい識別子ファイルは要求しない。対象リスクに応じて、既存のRepository設定、採用記録、Runtime設定または同等の根拠から再構成できればよい。

> **CRDDはIdentity判定の共通不変条件を定め、各採用先はその条件内でLogical Repository IdentityとRepository Instance Identityの関係を決定する。**

CRDD共通の不変条件は次のとおりである。

- 物理的な複製関係だけから同一または別Identityを自動推定しない。
- Logical Identity、Canonical State、Authority、RevisionおよびLifecycleを明示的に解決する。
- AI、Runtime、ToolまたはInstance自身がIdentity Policyを自己確定しない。
- IdentityまたはCanonical Instanceを判定できない場合は、対象Effectを停止する。

採用側のIdentity Policyは、既存のRepository設定、組織Policyまたは採用記録から取得できればよく、新しい専用成果物を要求しない。少なくとも必要に応じて次を決める。

- Canonical RepositoryまたはCanonical Instance
- clone、mirror、worktree等を同じLogical RepositoryのInstanceとする条件
- forkを独立したLogical Repositoryとする境界と由来
- Identityの付与、移管、衝突、再利用禁止を決める決定権限
- 別名、失効、廃止後の追跡
- 判定不能時の停止と再評価条件

安全側の既定例は次のとおりである。これはGit製品または固定運用の要求ではない。

| 物理的な関係 | Logical Identityの安全側候補 |
|---|---|
| clone／worktree | 同一候補。ただしorigin相当、対象Revision、Identity Policyを確認する |
| read-only mirror | 同一候補。ただし正本、更新方向、Authorityを確認し、mirrorからのCanonical Effectを推定しない |
| AuthorityまたはCanonical Stateの移管を伴うmirror | 明示的なIdentity移管判断を必要とする |
| fork | 原則として別Identityとし、元Repositoryとの関係はProvenanceで保持する |
| コピー元またはLifecycleが不明 | 判定不能として対象Effectを停止する |

#### 13.2.2. Context Reference

Context ReferenceはLocal File PathだけをIdentityとしない。安定した再識別が必要な対象では、CRDDが既に持つ安定コンテキストIDまたは同等のContext Identityを利用し、概念的には次から対象を解決できるようにする。

```text
Context Reference
= Repository Identity
+ Stable Context ID / equivalent Context Identity
+ Revision / Baseline
```

次の三つを分離する。

```text
Context Identity
  何を指すか

Locator
  現在どこにあるか

Resolver
  IdentityからLocationをどう解決するか
```

本候補のResolverはLocal Fileだけを返してよい。MCP、Remote Storeまたは別Repositoryを解決できる表現があっても、その接続が有効または許可済みであることを意味しない。

RevisionまたはBaselineが不変対象を指すのか、Current Stateへ解決する可変参照なのかを区別する。古いRevision、移動後に解決不能な参照、競合するIdentityを推測で現在状態へ丸めない。

#### 13.2.3. Provenance

Operation Result、Evidence、Decision、Learning等は、どの実行とコンテキストから導かれ、どの対象Revisionについて有効かを必要な粒度で再構成できるようにする。

```text
Result
├ produced by: Execution Identity
├ derived from: Context Reference
├ supported by: Evidence Reference
├ based on: Decision / Baseline
└ valid for: Target Revision
```

固定Property、固定Schemaまたは全項目の常時記録を要求しない。対象リスクと結果の利用目的に応じて、次を識別できることが重要である。

- 情報源となったRepository、Context、RevisionまたはBaseline
- 導出関係と採用した判断
- 利用不能、対象外または未評価だったコンテキスト
- 結果の有効範囲、失効条件、現在状態への採否
- 統合元となったExecutor、Reviewer、ProviderまたはRunのResultとVerification
- 結果間の競合、重複、除外または失効の理由
- 現在の判断集合、AIによる再処置、報告、後続追跡または停止・移送への接続

Provenanceを保持していても、情報源の決定権限、アクセス権または結果の採用権限を取得しない。

#### 13.2.4. Authority Abstraction

Authorityは、単に`Human`または`AI`という実行主体の種別へ固定しない。次の三つを分離して表現できるようにする。

```text
Authority Requirement
  何の決定権限または操作権限が必要か

Authority Grant
  誰が、どの対象・操作・期間・Policyについて付与したか

Authorized Actor
  今回その権限を行使できる認証済み主体
```

役割名だけではAuthority Grantにならない。対象リスクに応じて、対象範囲、許可する判断・操作、対象Revision、期間または失効条件、付与主体、委譲可否、必要なHuman Gateを取得可能にする。

Actorの種別を将来拡張可能に表現できても、現在AIへ新しいAuthorityを与えることを意味しない。本候補では、Product／Design Direction、Canonical Context変更、Risk Acceptance、External Publication、Production、Financial Action、Legal／Consent、Authority変更、Security Boundary変更、CRDD Core変更等の既存Human Gateを維持する。

---

### 13.3. 表現、利用、決定権限の分離

Forward Compatibilityでは次を同一視しない。

```text
Representable
≠ Enabled
≠ Accessible
≠ Authorized
≠ Promoted
```

| 状態 | 意味 |
|---|---|
| Representable | Contract上で対象や能力を表現できる |
| Enabled | Activation ProfileとRuntimeで利用可能になっている |
| Accessible | 対象ContextまたはToolへ実際にアクセスできる |
| Authorized | 対象の判断または操作を行うAuthority Grantが成立している |
| Promoted | 検証済み候補がCurrent／Canonical Stateへ正式に反映されている |

前段の成立から後段を推定しない。未知のIdentity、Reference、Authority型または拡張情報をRuntimeが理解できない場合、それを無視してEffectを許可せず、対象EffectについてFail Closedとする。未知情報を保持して後続へ渡すことと、その意味に基づいて操作することも分ける。

ProviderまたはModelはExecution Provenanceの一部になり得るが、Repository Identity、Context Identity、Authorityまたは成果物の意味そのものではない。Providerを変更できることから、そのProviderへのアクセス、送信、実行またはReview独立性を推定しない。安全なRoutingの責務は[エージェント組織の実行アーキテクチャ](04_Agent_Organization.md#12-execution-architecture)に置く。

---

### 13.4. Repository Sovereignty

将来Repository間を接続しても、各Repositoryの次の境界を無条件に統合しない。

- Context BoundaryとCanonical State
- Property Authorityと採用済みPolicy
- Information ClassificationとExternal Information Boundary
- Release、Baseline、RecoveryのLifecycle
- Provenanceと監査可能性

別RepositoryのReferenceまたはResultを取得できることから、その内容の採用、上書き、再公開または別RepositoryへのEffectを許可しない。

---

### 13.5. 本候補で先行実装しないCapability

Forward Compatibilityを理由として、本候補へ次を追加しない。

- Cross-Repository Contextの自律読取または自律実行
- Repository間の変更自動伝播
- 全Repositoryを一つの正本へ統合するGlobal Knowledge Repository
- 複数Repository間のAuthority自動委譲
- Agent自身による役割、Authorityまたは組織構造の再編
- Product範囲を越えたBusiness全体への自動拡張
- CRDD自身のSemantic Contract、安全境界または成功条件の自動変更

CRDD自身の改善候補は、`Observe → Analyze → Propose → Human / Authority Decision → Adopt`の境界を維持する。自己改善候補の発見と自己変更を混同しない。

---

<a id="6-将来互換性の確認候補"></a>

### 13.6. 将来互換性の確認候補

本候補のReference Implementationでは、将来Capabilityを実装する代わりに、現在の契約が次を満たすか確認する。

1. 同じLogical Repositoryのcloneまたはworktreeを別Instanceとして識別しつつ、同じ論理対象へ接続できる。
2. 安定コンテキストID等を付与したContextファイルを移動しても、同じ対象として解決できる。
3. Operation Resultから、Execution Identity、対象Revision、使用Context、Evidenceを再構成できる。
4. 古いRevisionのResultまたはCandidateを現在状態へPromoteしようとすると停止する。
5. 表現可能だが有効化されていないCross-Repository ReferenceをRuntimeが読み取らない。
6. AgentをAuthority候補として表現しても、対象ScopeのGrantがなければEffectを実行できない。
7. AuthorityのScope、期間、Policyまたは付与主体が変わった場合、過去のGrantを流用しない。
8. read-only mirrorを同じLogical Repositoryとして表現しても、そこからCanonical Effectを推定しない。
9. forkを原則として別Logical Identityとし、元Repositoryとの由来をProvenanceで保持できる。
10. mirror、rename、移管等でLogical IdentityまたはCanonical Instanceが曖昧なら推測せず停止する。

合格は固定Schemaの採用ではなく、IdentityとLocation、ReferenceとAccess、Authority RequirementとGrant、CandidateとPromotionを混同しないことで判定する。

---

### 13.7. 将来の発展方向

将来候補には、Repository Sovereigntyを維持した連携、より広い業務コンテキストへの接続、運用結果からの組織・方法改善候補がある。これらのVersion、Scope、Authority、移行、安全性は、それぞれ独立した提案と人間判断で決める。

本書は将来Versionの番号、実装順序または採用を確約しない。

---

### 13.8. 結論

本候補で先に確保するのは、将来機能ではなく次の意味上の接続点である。

```text
Repository Identity
Context Reference
Provenance
Authority Requirement / Grant / Authorized Actor
```

これにより、本候補はSingle Repository Autonomous Operationという現在の責務を維持しながら、将来の拡張時にIdentity、Reference、Provenance、Authorityを全面的に作り直す危険を減らす。
