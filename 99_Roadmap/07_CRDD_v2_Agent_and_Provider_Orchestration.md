# CRDD v2候補 — Agent & Provider Orchestration

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Subtitle: Safe Context Routing Across Execution Boundaries  
Related: [v2構想](01_CRDD_v2_Concept.md), [責務境界](02_CRDD_v2_Responsibility_Boundary.md), [Activation ProfileとReference Implementation](03_CRDD_v2_PoC_Plan.md), [自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md), [Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md), [Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md)

> 本書は非規範のAgent／Provider Orchestration候補である。現在のCRDD v0.17.0、Human Authority、Independent Review、External Information Boundary、準拠基準または採用側のProvider契約を変更しない。特定Provider、Model、Agent構成、固定Schemaまたは複数Agentの利用をCRDD準拠条件にしない。

---

## 1. 中心目的

> **CRDD Agent / Provider Orchestrationは、Provider非依存のContextを、Authority・Information Boundary・Capability・Verification Requirementを満たす実行主体へ安全にRoutingし、その実行結果とProvenanceをCRDDへ還流する仕組みである。**

主題はAI同士の会話、Agent数、特定Providerの組合せまたはCredit節約ではない。異なるTrust Boundary、能力、権限、Tool Accessを持つ実行主体へ、意味、制約、根拠、決定権限を失わずに作業を引き渡せるかを扱う。

```text
Provider-independent Context
  ↓
Safe Routing
  ↓
Eligible Execution Boundary
  ↓
Execution / Verification
  ↓
Result and Provenance
  ↓
CRDD Context
```

中心原則は次のとおりである。

> **Safety / Privacy / AuthorityはOptimization対象にしない。**  
> **Provider difference ≠ Review independence.**  
> **Providerへの送信許可 ≠ Fallback先への送信許可.**

---

## 2. Provider非依存Contextと実行特性

CRDDへ保持するIntent、Decision、Requirement、Constraint、Acceptance Criteria、Evidence、Authority、Result等の意味を、特定Providerだけが理解できるPrompt、会話履歴または独自状態へ固定しない。

一方、Provider非依存はAIが同質であることを意味しない。Model、Runtime、AgentまたはLocal Executionには、専門能力、Context Window、Tool Access、Latency、Reliability、Cost、Quota、Privacy特性等の差があり得る。

CRDD Coreは必要なCapability、Context、Authority、Expected Outcome、Verification Requirementを表現する。採用側PolicyとRuntimeは、その必要条件を満たす実行主体を選択する。Provider名またはModel名を成果物の意味、品質またはAuthorityの根拠にしない。

---

## 3. 責務境界

### 3.1. CRDDが所有するもの

- Operation Goal、必要Context、保持条件、期待結果
- Authority Requirementと禁止されたEffect
- Information Classificationと外部情報境界
- Required CapabilityとVerification Requirement
- Result、Evidence、Provenance、Human Decisionへの接続

### 3.2. 採用側Policyが所有するもの

- 許可するProvider、Model、tenant、region、処理目的
- 保持、削除、二次利用、学習利用、再委託の条件
- Capability根拠、Reliability基準、Hard Cost／Effect Budget Ceiling、Quota／Rate-limitの実行可能条件
- Fallback候補と再評価条件
- Human Gate、停止、例外、再開Authority

### 3.3. Runtime／Orchestratorが所有するもの

- Routing Requirementsの構成
- Eligibility Gateの実行と拒否理由
- Eligible Set内のOptimization
- Context ProjectionとPermissionの適用
- Execution、Retry、Loop、Fallback、Budget、Circuit Breaker
- 実行ProvenanceとRuntime Evidence

### 3.4. Provider Adapterが所有するもの

- Provider固有API、認証、選択済みModel指定の変換、入出力変換
- Provider固有のTool接続、制限、Error、Usage取得
- Provider応答をCRDDの判断またはAuthorityへ無断昇格させない境界

接続済み、利用可能、Credit残高あり、過去に成功した等の事実だけから、今回のEligibilityまたはAuthorityを推定しない。

---

## 4. Routing Architecture

```text
Operation Contract
  ↓
Work Assignment
  ↓
Routing Requirements
  ↓
Eligibility Gate
  ├ Authority
  ├ Information Boundary
  ├ Required Capability
  ├ Tool / Context Access
  ├ Security / Privacy / Contract
  ├ Verification Requirement
  ├ Hard Cost / Effect Budget Ceiling
  ├ Available Quota / Rate-limit Feasibility
  └ Required Execution Capacity
  ↓
Eligible Execution Set
  ↓
Optimization
  ├ Demonstrated Reliability
  ├ Task Fitness
  ├ Availability / Latency
  ├ Estimated Cost
  ├ Quota / Credit Efficiency
  └ Concentration / Availability Balance
  ↓
Agent Execution
  ↓
Operation Result
  ↓
Independent Verification
  ↓
Human Gate / Policy-contained Completion
```

EligibilityとOptimizationを一つのScoreへ統合しない。Security、Privacy、Authority、Contract、必要CapabilityまたはVerification Requirementを満たさない候補は、CostやAvailabilityが優れていてもEligible Setへ入れない。

`Policy-contained Completion`は、事前承認されたOperationについて、必要な結果と検証が許可範囲内で完了し、そのRunを終了できる状態を意味する。Canonical Adoption、Promotion、Risk Acceptance、ReleaseまたはHuman Authorityを自動的に成立させない。Current／Canonical Stateへ反映する場合は、[自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md)のPromotion Policyを別途適用する。

---

## 5. Eligibility Gate

EligibilityはProviderまたはModelの自己申告、ブランド、評判または一回の成功だけで決めない。対象Operationについて、必要に応じて次を確認する。

- 認証済み実行主体とAuthority Grant
- 対象Contextの情報分類と許可した処理境界
- tenant、region、保持、削除、二次利用、学習、再委託
- Required Capabilityを示す評価、実績または検証可能な根拠
- 必要なTool、Repository、Environmentへの最小Access
- Output、Evidence、Verificationの取得可能性
- 対象Revision、Hard Cost／Effect Budget Ceiling、停止・回復条件
- 実行に必要なAvailable Quota、Rate-limit、時間または計算資源

Capabilityを確認できない候補を「おそらく同等」としてFallbackへ使用しない。判定情報不足は低ScoreではなくIneligibleまたはHuman Decisionとする。

---

## 6. Optimization

Eligible Set内では、対象Operationと採用側Policyに従い次を比較できる。

- Demonstrated Reliabilityと過去の検証結果
- Task Fitnessと必要な専門能力
- Availability、Latency、Context Window、Tool Fitness
- Estimated CostとQuota／Credit Efficiency
- Provider集中、Availability Balance、Fallback頻度、運用上の回復性

Cost、QuotaまたはCreditの分散は、品質と安全を満たす候補間の運用最適化である。CRDDの目的、品質根拠、Provider採用理由またはSecurity例外にしない。

Optimization Policyが同じ条件でProviderを頻繁に切り替える場合は、hysteresis、最小保持期間、Debounce、Routing Budget等を候補化し、切替自体のCostとContext LossをOperation Healthで評価する。

---

## 7. Work／Result／Reviewの投影

新しいTask、Result、Reviewの意味正本を作らない。Runtimeは既存契約から実行用の投影を構成できる。

```text
Work Assignment View
  = Operation Contract + Agent Contractの実行用投影

Agent Result View
  = Operation Result Contractの実行主体別投影

Review Result View
  = Independent Review契約の確認者用投影
```

Work Assignmentは少なくとも、Goal、必要Context、保持条件、Acceptance Criteria、Authority、禁止操作、Required Evidence、停止条件を必要な粒度で取得可能にする。

Agent Resultは、実際の差分、Result、Evidence、Unresolved Items、Unavailable Context、Verificationを返す。自由形式の説明だけを完了根拠にしない。

Review Resultは、対象、基準、Finding、Evidence、必要な変更、人間判断事項、未評価範囲を返す。AI Reviewerの`Pass`を採用、Risk Acceptance、PromotionまたはHuman Authorityの代替にしない。

固定YAML、固定ファイルまたは全Agent会話の保存を要求しない。人間または後続Operationが、なぜその結果になったかを必要な粒度で再構成できる情報だけをCRDDへ還流する。

---

## 8. Agent RoleとIndependent Review

Planner、Executor、Reviewerは有力なOptional Orchestration Profileであり、CRDD全体の基本Roleまたは必須Flowではない。

```text
Optional Profile
  Planner
    ↓ Work Assignment
  Executor
    ↓ Result
  Reviewer
    ↓ Finding / Verification
  Human Gate or Policy-contained Completion
```

単純Operationでは同じ主体が複数責務を担える。工程移行、重大Risk、保護対象変更等でIndependent Reviewが必要な場合は、現行の独立性条件を維持する。

異なるProviderを使うこと自体は独立性の根拠ではない。同じProviderでも作成責務から分離し、対象と基準から結論を独立再構成できれば独立性が成立し得る。逆に別Providerでも、Executorの要約や結論を前提にするだけなら独立ではない。

---

## 9. Context ProjectionとTrust Boundary

各実行主体へRepository全体を既定で渡さない。Operationに必要な最小Contextを、対象Providerの許可した処理境界へ合わせて投影する。

Context Projectionでは必要に応じて次を取得可能にする。

- 情報源、対象Revision、選択理由、除外範囲
- 情報分類、許可目的、送信先、tenant、region
- 削除、抽象化、最小化、再識別可能性
- Granted Permission、使用可能Tool、禁止Effect
- 派生情報とProvider間の再送信境界

Provider Aが生成したResultをProvider Bへ渡す場合も、新しいExecution BoundaryへのContext Transferとして評価する。外部境界を跨ぐ場合は新しいExternal Sendとして扱う。Resultに内部Contextの派生情報、識別子、SecretまたはProvider固有命令が含まれ得ることを考慮する。

---

## 10. Fallback

FallbackはProvider名の差替えではなく、新しいExecution BoundaryへのRoutingである。

```text
Primary unavailable or ineligible
  ↓
Fallback Candidate
  ↓
Eligibility再評価
  ↓
Context再投影
  ↓
Capability / Authority / Verification再確認
  ↓
Execute or Stop
```

元Providerへの送信許可、Context Projection、Authority、Tool Access、過去の成功をFallback先へ流用しない。同一企業の別Modelでも、tenant、region、保持、Tool、Capabilityまたは契約条件が異なる場合は再評価する。

Fallbackに必要Capabilityがなく、Verificationで差を閉じられない場合は、品質を暗黙に下げず停止またはHuman Decisionへ戻す。

---

## 11. Loop Control

固定Iteration数だけを収束条件にしない。次を組み合わせる。

- Operation固有のConvergence Condition
- FindingとRequired Changeの解消状態
- Duplicateと同一提案の反復検出
- Time、Cost、Quota、EffectのBudget
- Hard Iteration Cap
- Circuit BreakerとHuman Decision条件

上限到達時に全会話を人間へ送らず、未解決差分、反復原因、影響、必要判断、推奨処置だけをDecision Queueへ集約する。Modelが申告するConfidenceは補助信号にできるが、Authority、必須Evidenceまたは安全条件の代替にしない。

---

## 12. Execution Provenance

ProviderまたはModelを成果物のIdentity、品質またはAuthorityにしない。一方、どのRuntime条件でResultが生成されたかは、再現、失効、比較、Fallback評価に必要な範囲で追跡する。

Execution ProvenanceはProvider Identityではなく、Eligibility判定済みExecution Boundaryと、そのPolicy Decisionを再構成可能にする。

概念候補：

```yaml
routing_policy_revision:
eligibility_policy_revision:
eligibility_decision_ref:
execution_boundary_ref:
selected_provider:
selected_model:
selection_reason:
context_projection_ref:
granted_permissions:
fallback_history:
verification_result:
cost:
quota_usage:
```

これは固定Propertyまたは固定Schemaを要求しない。対象リスクと利用目的に応じて別表現を使用できる。ただし、Execution BoundaryまたはEligibility DecisionがResultの有効性、情報境界、Capability、AuthorityまたはVerification Requirementに影響する場合、その対象Boundary、適用したPolicyおよび判定根拠を再構成可能でなければならない。

---

## 13. Operation Health

Routing自体もQuality対象とする。既存のOperation Healthへ、必要に応じて次を接続する。

- Provider／Model別のUseful ResultとVerification結果
- Routing rejectionと理由
- Fallback成功率、失敗率、再評価費用
- Provider集中度と単一障害点
- Context Projection量と再送信回数
- Cost／Quota per useful result
- Routing切替によるContext Loss、再試行、人間負荷
- 安価なRoutingによる品質低下または見逃し

Credit消費の均等化を目的にしない。あるProviderへ集中することが品質、安全、情報境界上の正しい結果なら、分散率を上げるために別Providerを使わない。

---

## 14. v0〜v1系列との境界

v0〜v1系列は、Provider非依存のContext、責務、Agent Contract、Acceptance Criteria、Result、Evidence、Human Gateを成立させる。Multi-Agent Orchestratorまたは複数Providerを必須にしない。

v2候補は、その土台を複数のExecution Boundaryへ安全にRouting、Fallback、Verifyし、ResultとProvenanceを還流するArchitectureを扱う。

特定Providerの組合せを使ったFlowはReference Use Caseとして実験できるが、CRDD Core、準拠条件または固定Profileにしない。

---

## 15. PoC仮説

1. Provider非依存Contextから、異なるExecution Boundaryへ意味を失わずWork Assignmentを構成できる。
2. Eligibility Gateにより、Costが低くてもAuthority、情報境界、Capabilityを満たさない候補を拒否できる。
3. 構造化されたRuntime Projectionは、Agent間の自由会話よりContext Lossと誤解を減らせる。
4. Provider差とIndependent Reviewを分離し、対象と基準からFindingを独立再構成できる。
5. Fallback時に送信許可とContextを流用せず、再Eligibility判定できる。
6. Eligible Set内のRoutingにより、品質と安全を維持しながらAvailability、Cost、Quota集中を改善できる。
7. Provider Routingが人間のAgent管理負荷、通知、再試行または判断時間を増やしていない。

PoCの成功はAgent数、Provider数、Routing回数またはCredit分散率で判定しない。安全条件を維持し、人間の判断価値と有益なResultを改善できたかで評価する。

---

## 16. 結論

```text
Context is provider-independent.
Execution may use provider-specific strengths.
Routing is constrained before it is optimized.
Important judgment and responsibility remain governed.
```

Agent & Provider Orchestrationは、特定AIへのLock-inを避けるだけでなく、異なる能力を安全に組み合わせるためのExecution Architecture候補である。CostとCreditの分散は、Eligibilityを満たす実行主体間で得られる運用上の副次効果として扱う。
