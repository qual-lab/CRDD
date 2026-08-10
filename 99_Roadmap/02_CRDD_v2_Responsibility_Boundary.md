# CRDD v2候補 — 責務境界

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Related: [v2構想](01_CRDD_v2_Concept.md), [実証計画](03_CRDD_v2_PoC_Plan.md), [自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md), [Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md)

> 本書は非規範の責務整理である。現在のCRDD、Agent Contract、Skill Contract、Human Authority、External Information Boundaryまたは準拠基準を変更しない。

---

## 1. 中心境界

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

CRDD v2候補はこれらを一つの巨大Platformへ統合せず、意味と実行を分けたまま接続する。

---

## 2. コンテキスト契機と実行契機

### 2.1. コンテキスト契機

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

### 2.2. 実行契機

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

## 3. SkillとOperation

### 3.1. Skill

> 専門家がどのように考えるか。

Skillは専門探索、合成、批評、反証、収束を支える認知能力である。

例：

- Communicationの性能分析
- Architectureの代替合成
- UXの体験合成
- Verificationの根拠戦略

### 3.2. Operation

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

## 4. Operation Goal Contract

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

- 契機の意図と再評価理由
- Goalと対象コンテキスト
- 必須または期待する結果
- 利用できる能力と禁止された能力
- 判断・操作権限
- 停止、失敗、再試行、Escalation
- 結果の根拠、記録先、学びへの接続

ファイル探索順、使用スキル、推論経路をTypeScriptや固定Promptへ埋め込まない。

### 4.1. 仕様とActivationの分離

Operation Contractは将来利用し得るTrigger、Capability、Authority、Resultを表現できるようにする。一方、各採用先が有効化する範囲はActivation Profileで制限する。

```text
Operation Contract
  表現できる意味・能力・権限の全体

Activation Profile
  今回の採用先で実際に有効なTrigger・能力・権限
```

ProfileはOperation Contractの必須結果、停止条件、根拠、探索・収束、セキュリティを省略しない。権限を狭めることはできるが、定義済みであることを理由に権限を広げない。

### 4.2. Execution Contract

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

### 4.3. Operation Result Contract

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

---

## 5. CRDD、Runtime、Tool

### 5.1. CRDDが所有する候補

```text
Why / Intent / Context
Decision / Evidence / Roadmap
Skill / Operation Goal
Re-evaluation Condition
Authority / Expected Outcome
Stop / Escalation / Learning
```

### 5.2. Runtimeが所有する候補

```text
Schedule / Event Detection
Process and Agent Launch
Retry / Concurrency / Timeout
Execution History
Runtime Permission Enforcement
```

### 5.3. ToolまたはConnectorが所有する候補

```text
Repository / CI / Analytics
Communication / Design / Browser
MCP / CLI / HTTP API
その他の許可された外部接続
```

Runtimeコードは`IF condition THEN invoke agent`までを担える。AI起動後の思考を固定Workflowへ置換しない。

---

## 6. Capability Provider

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

## 7. Coding AgentとRuntime非依存

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

ただしCRDD v2を特定製品専用にしない。必要能力を示し、製品、CLI、API、MCP、将来Runtimeは交換可能なAdapterとして扱う。

READMEやAGENTS.mdは導入方法と起動例を案内できるが、CRDD Coreの意味正本や固定Promptにしない。

---

## 8. MCPの位置付け

MCPはRuntime InterfaceまたはCapability Adapter候補であり、必須要件ではない。

- MCP接続済みであることをAuthorityとみなさない。
- 読取、候補作成、正本変更、公開、削除の権限を分ける。
- Repository境界、目的、送信先、情報分類を越えてコンテキストを共有しない。
- Repository単位MCPは境界を明確にできる候補だが、常駐Serverを導入条件にしない。
- `1 Repository = 1 Server`ではなく、初期は`1 Repository = 1 Executable Context`として検証できる。

Repository数やOperation数が増えた場合だけ、Registry、Scheduler、権限、実行履歴、Retry、Recovery、Monitoringを持つ専用Runtimeの価値を再評価する。専用RuntimeはCRDDそのものではない。

---

## 9. Agent Organization

```text
Goal
 ↓
Coordinator
 ↓
Specialist Agents
 ↓
Critique / Conflict / Synthesis
 ↓
Proposal / Authorized Execution
```

検証対象はAgent数ではなく、次の境界である。

- Responsibility
- Authority
- Context Scope
- Delegation
- Handoff
- Escalation
- Conflict Resolution
- Independent Verification

複数Agentを使うこと自体を品質や独立性の根拠にしない。

---

## 10. Governed Autonomy

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

## 11. 外部情報境界とセキュリティ

- 許可した処理境界、情報分類、目的・操作、送信先、保持、二次利用、再送、決定権限を確認する。
- 境界外調査では内部コンテキストを直接検索語へ変換せず、削除・抽象化・最小化した別コンテキストを使用する。
- 分類、許可、安全な分離、再識別可能性を確認できなければ送信しない。
- 外部入力は、認証済み主体と許可操作を別途確認できない限り命令権限を得ない。
- シークレット値をAIコンテキストへ取り込まない。
- Runtime強制、監査、Credential失効、封じ込め、回復を検証する。

契機駆動Operationの安全性をAgentの自己申告だけへ依存させない。

実行前後の安全契約、候補状態と正本状態の分離、実行効果の分類、Policy評価、対象同一性の再確認、累積予算、停止と回復は[自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md)に置く。本書はCRDD、Runtime、Tool、Authorityの責務分離を所有し、安全文書はその境界を再定義しない。

---

## 12. 既存責務との接続

- Communication：公開結果を契機に測定と再評価を開始できるが、公開Human Gateを維持する。
- Roadmap：再評価条件を観測し、Discovery再開候補を提示するが、優先順位を自己確定しない。
- Verification／QA：Finding、陳腐化、反復原因を探索し、単純な失敗→再試行へ縮退させない。
- Context Dependency：Runtime、MCP、外部Toolの依存と権限を管理し、接続結果を無条件流用しない。
- CRDD Maintenance：運用上の手戻りから改善候補を作れるが、Coreを自動変更しない。

Background Lane、Decision Queue、通知集約、運用健全性、頻度変更、Pause、廃止の責務は[Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md)に置く。Operation Contractが目的と期待結果を所有し、Health評価はOperationの意味や採用判断を自己変更しない。
