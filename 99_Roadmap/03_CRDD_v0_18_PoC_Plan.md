# CRDD v0.18.0 Architecture Candidate — Activation ProfileとReference Implementation

Status: Concept / Non-normative PoC Candidate
Target: CRDD v0.18.0 Architecture Candidate
Related: [v0.18.0候補構想](01_CRDD_v0_18_Concept.md), [責務境界](02_CRDD_v0_18_Responsibility_Boundary.md), [自律安全Architecture](04_CRDD_v0_18_Autonomous_Safety_Architecture.md), [Operation HealthとHuman Interface](05_CRDD_v0_18_Operation_Health_and_Human_Interface.md), [Forward Compatibility](06_CRDD_v0_18_Forward_Compatibility.md), [Agent & Provider Orchestration](07_CRDD_v0_18_Agent_and_Provider_Orchestration.md), [実装残件台帳](08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

> 本書は非規範の実証計画である。v0.18.0 Architecture Candidate全体の仕様を最初のPoCへ限定しない。PoCの成功、Coding Agentの実行、試験合格または本書の存在だけで、本候補の規範採用、Authority拡張、現行標準変更を意味しない。

---

## 1. Core Architectureと最初のActivationを分ける

本Architecture Candidateは、Re-evaluation、Operation、Runtime境界、Execution Identity、安全制御、Authority、Tool境界、Result、Learning、次回再評価を全体として定義する。

最初の実運用は、その全体から許可する能力と権限を限定したActivation Profileである。

```yaml
activation:
  profile: scheduled-advice
  trigger:
    type: scheduled
  permissions:
    repository_read: true
    repository_write: false
    external_access: false
  execution:
    max_parallel: 1
  human_gate:
    required: true
```

これは固定Schemaではない。また、`scheduled-advice`をすべての採用先の必須開始点にしない。CommunicationやRoadmap等、異なるOperationから開始できるが、有効化する権限、情報境界、停止、検証を同じ契約で説明できなければならない。

Activation Profileは探索深度や品質をAgentに選ばせる仕組みではない。Profileが制限するのはTrigger、Capability、Authority、外部接続、実行並列性等であり、Operationの収束条件や必須結果を免除しない。

---

## 2. 最小Reference Implementation

最初から専用Server、常駐MCP Server、専用Runtimeを作らない。

```text
CRDD Repository
+ Re-evaluation Contract candidate
+ Operation Contract candidate
+ README / AGENTS guidance
+ Coding Agent Automation
```

最小Loopは次で十分である。

```text
Trigger
  ↓
Coding Agent
  ↓
CRDD
  ↓
AI Reasoning
  ↓
Proposal
```

最初に検証するのはRuntime性能ではない。

> 契機だけを与えたとき、AIは固定Promptへ探索順を書かなくても、CRDDコンテキストを使って有益な仕事を開始できるか。

---

## 3. PoC 1 — 週次プロダクトレビュー

最初の実証候補とする。

```text
毎週月曜09:00
   ↓
Coding Agent Automation
   ↓
Repositoryを開く
   ↓
CRDDの現在状態を再評価
   ↓
現在地・重要変化・リスク・Roadmap影響・次の判断を提示
```

Operation候補：

```yaml
operation:
  id: weekly-product-review
  purpose: evaluate current product state and identify decisions requiring attention
  required_outcomes:
    - current_state
    - meaningful_changes
    - risks
    - roadmap_implications
    - recommended_next_actions
  authority:
    read: autonomous
    proposal: autonomous
    canonical_change: human
  stop_conditions:
    - insufficient_evidence
    - authority_boundary
```

固定Promptには読むファイル、探索順、必ず出す改善案を書かない。AIは必要に応じてRoadmap、Progress、Changes、Decision、Verification、Quality State、Communication Result、Dependencies、Learningへ遡る。

正しい出力には次も含む。

```text
No meaningful change.
No re-evaluation required.
Current direction remains valid.
```

何も変える必要がない場合に、無理に改善案を作らない。

---

## 4. PoC 2 — Communication結果レビュー

```text
時間契機または公開結果追加
   ↓
Publication Result / Measurement
   ↓
Communication Contextと照合
   ↓
仮説と差分を再評価
   ↓
次の候補を作成
   ↓
Human Review
```

確認すること：

- 単純な数値最適化にならないか
- Audience、Claim、Evidence、Design Directionを維持できるか
- 過去結果からLearning候補を作れるか
- Product DirectionやRoadmapとの競合を検出できるか
- 公開権限を分析権限から推定しないか

---

## 5. PoC 3 — Roadmap再評価

```text
時間または状態契機
   ↓
Roadmapの再評価条件
   ↓
Repository / 許可された外部Evidence
   ↓
条件成立候補
   ↓
登録時DecisionとEvidenceへ遡る
   ↓
Discovery再開候補
   ↓
Human Decision
```

確認すること：

- Roadmap項目を単なるTaskとして扱わないか
- 登録時の判断と根拠まで辿れるか
- 前提が実際に変わったかを評価できるか
- 不要な再評価を乱発しないか
- 再評価条件成立を採用や優先順位確定と混同しないか

---

## 6. PoC 4 — Repository Event

```text
Pull Request integrated
   ↓
Meaning Change Assessment
   ├─ 意味影響なし → 根拠付き終了
   └─ 意味影響あり
          ↓
      Affected Context
          ↓
      Re-evaluation Operation candidate
```

確認すること：

- Event発生だけで不要なOperationを起動しないか
- 実装差分と意味変更を区別できるか
- Change、Architecture、Verification等へ正しく接続できるか
- 同じEventから再帰的に自分を起動しないか

---

## 7. 仮説と評価項目

### 7.1. コンテキスト探索

- 必要なコンテキストを自分で発見できるか
- 固定Promptへコンテキスト一覧を書かなくても成立するか
- Repository全体を無差別に読む必要がないか
- Current ContextとHistorical Contextを区別できるか

### 7.2. 推論

- Summaryだけで終わらないか
- 状況変化を検出できるか
- 過去Decisionと現在Evidenceを比較できるか
- 根本原因へ遡れるか
- 適切な再評価先を提案できるか

### 7.3. Authority

- ProposalとDecisionを混同しないか
- Human Authority Contextを無断変更しないか
- External Information Boundaryを守れるか
- MCPやConnector接続を権限と誤認しないか

### 7.4. 出力

- 人間が短時間で判断できるか
- Current State、Evidence、Risk、Recommendationが分離されるか
- 何もする必要がない結論を返せるか
- 重要な不確実性と停止理由を隠さないか
- Explored Scope、Excluded Scope、Unavailable Context、Remaining Uncertainty、Reason for Convergenceを説明できるか

### 7.5. 運用

| 観点 | 評価する内容 |
|---|---|
| 判断価値 | 人間の判断を変えた、早めた、重要な未知を明確にした割合 |
| 見逃し | 人間が後から発見した重要な再評価契機 |
| 誤起動 | 判断価値のない重複・過剰な起動 |
| 収束 | 再帰Loop、同一提案反復、終了不能の有無 |
| 権限 | 無断操作、誤った権限推定、Human Gate回避の有無 |
| 情報境界 | 未許可送信、再識別可能なQuery、外部入力の命令化の有無 |
| 根拠 | 提案から観測、判断、結果を再構成できるか |
| 運用費用 | 実行時間、モデル／Tool費用、人間確認負荷 |
| 学び | 採否や結果が次回の探索品質を改善したか |

安全性と有用性を分けて測定する。有用な提案があっても権限や情報境界を破ったOperationを成功扱いにしない。

Operation Healthの評価、Decision Queue、通知集約、頻度変更、Pause、廃止条件は[Operation HealthとHuman Interface](05_CRDD_v0_18_Operation_Health_and_Human_Interface.md)を使用する。PoCではRun数や自動処理数を成功指標にしない。

### 7.6. Forward Compatibility

[Forward Compatibility](06_CRDD_v0_18_Forward_Compatibility.md)の将来Capabilityは先行実装せず、次の境界だけを合成Fixtureで確認する。

- 同じLogical Repositoryのcloneまたはworktreeを別Instanceとして識別しつつ、同じ論理対象へ接続できるか
- 安定コンテキストID等を付与したContextファイルを移動しても、同じ対象として解決できるか
- Operation ResultからExecution Identity、対象Revision、使用Context、Evidenceを再構成できるか
- 古いRevisionのResultまたはCandidateを現在状態へPromoteしようとすると停止するか
- 表現可能だが無効なCross-Repository ReferenceをRuntimeが読み取らないか
- AgentをAuthority候補として表現しても、対象ScopeのGrantなしにEffectを実行しないか
- AuthorityのScope、期間、Policyまたは付与主体の変更後に、過去のGrantを流用しないか
- read-only mirrorを同じLogical Repositoryとして表現しても、そこからCanonical Effectを推定しないか
- forkを原則として別Logical Identityとし、元Repositoryとの関係をProvenanceで保持できるか
- mirror、rename、移管等でLogical IdentityまたはCanonical Instanceを判定不能なら停止するか

固定Schemaの実装数ではなく、IdentityとLocation、ReferenceとAccess、Authority RequirementとGrant、CandidateとPromotionを混同しないことを評価する。

### 7.7. Agent／Provider Routing

[Agent & Provider Orchestration](07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)のProvider数またはRouting数ではなく、次を合成Fixtureで確認する。

- Authority、Information Boundary、CapabilityまたはVerification Requirementを満たさないProviderを、低CostでもEligibility Gateが拒否するか
- Eligible Set内でだけReliability、Fitness、Availability、Cost、Quotaを比較するか
- Fallback先について送信許可、Context Projection、Tool Access、Capabilityを再評価するか
- Provider AのResultをProvider Bへ渡す際、新しいContext Transferとして処理境界を評価し、外部境界を跨ぐ場合はExternal Sendとして扱うか
- Planner／Executor／Reviewerを固定Flowにせず、必要な責務だけを構成できるか
- 別ProviderのReviewerがExecutorの結論を流用せず、対象と基準からFindingを独立再構成できるか
- Routing Policy、Eligibility Policy revision、Eligibility Decision、Execution Boundary、Context Projection、Permission、Fallback、Verification、Costを必要な粒度で再構成できるか
- [Policy-contained Completion](02_CRDD_v0_18_Responsibility_Boundary.md#45-policy-contained-completion)がRun終了だけを成立させ、Promotion PolicyなしにCanonical State、Risk AcceptanceまたはHuman Authorityを成立させないか
- Hard Cost／Effect Budget Ceilingまたは実行に必要なQuota／Rate-limitを満たさない候補を不適格とし、Eligible Set内だけでEstimated CostとQuota Efficiencyを比較するか
- RoutingがCostを下げても品質、見逃し、人間負荷またはRecovery burdenを悪化させていないか

### 7.8. Coordinator Result Integration

[Coordinatorによる結果統合](02_CRDD_v0_18_Responsibility_Boundary.md#44-coordinatorによる結果統合)を、固定Agent構成ではなく次の合成Fixtureで確認する。

- 判断が残らないExecutor Resultを報告またはPolicy内完了へ接続し、形式承認を要求しないか
- Executorが直接承認を要求しても、その要求をAuthorityとして採用せず現在の判断集合を再構成するか
- ExecutorとReviewerが競合するとき、多数決せず対象、基準、Evidenceおよび未評価範囲を保持して再検証または判断へ接続するか
- 正式なFindingをExecutorが是正した場合、更新後の対象改訂版を固定して再実行・再検証し、作成責務から分離した確認者が同じ固定改訂版、基準およびEvidenceから独立再レビューするまで、自己確認、Verification、古いReviewまたは完了申告だけで`Resolved`、Policy-contained CompletionまたはPromotionへ進めないか
- Findingがなく、既存契約上Independent Reviewが非該当の軽量Operationには、新しいReview、承認、状態または成果物を追加せず、擬似的な`Resolved`を作らずに既存の完了条件へ進めるか
- 複数結果から現在判断が0件なら人間判断不要と明示し、独立して保留できる2件は分け、異なる原因でも不可分な1件はまとめるか
- 将来判断が現在の作業、Gate、停止判断、採用／却下、重大Risk受容または不可逆Effectへ影響せず、安全に独立保留でき、かつ担当責任者、再評価契機、保留影響および元Evidenceへ追跡できる場合だけ、現在のDecision Queueから除外するか
- 将来判断の保留条件または現在影響が不明な場合は、不足情報と確認先を示し、`Not Applicable`、報告のみまたは非表示へ落とさず現在判定から除外しないか
- 現在の作業またはGateを阻害する判断、停止判断、未解決の重大リスク、残存Risk受容、不可逆Effect、Authority競合または検証不能をDecision Queueの詳細へ埋めず、元Evidenceを保持して現在の判断集合または既存の停止・移送経路へ接続するか
- 差戻し後の新しい改訂版で再検証し、古いResultと古いReviewを履歴として保持しつつ現在判定へ流用せず、反復時はBudget、Circuit Breakerまたは構造是正へ接続するか

---

## 8. 避けるべき失敗

### 8.1. Workflow Automation化

```text
Aを読む → Bを読む → 固定Prompt → Cを生成
```

思考順序をコードへ固定し、CRDDのコンテキスト推論を失わせない。

### 8.2. Trigger乱発

Eventが起きたことではなく、意味を再評価する可能性があることを起動根拠にする。不要なCredit消費、Noise、重複Review、人間の認知負荷を測る。

### 8.3. Proposal Spam

AIが毎回改善案を作る状態を失敗とする。影響なし、再評価不要、現行判断維持を正しい結果として許容する。

### 8.4. コンテキストの過剰共有

便利さを理由にRepository全体を外部AIへ送らない。必要なコンテキスト、目的、送信先、Authorityに基づき、現行の外部情報境界を適用する。

### 8.5. CRDD Coreの肥大化

Scheduler、Queue、Retry、Worker、MCP Server実装をCRDD Coreへ入れない。CRDDはMeaning、Context、Contract、Authority、Trigger Intent、Expected Outcomeを所有する。

### 8.6. 自律性の自己拡張

PoCの成功や過去の一回承認から、新しい判断・操作権限を推定しない。Authority拡張は別の人間判断と検証対象にする。

---

## 9. Activation Profile候補

以下は本候補の品質成熟度や工程省略を表すLevelではない。採用先が有効化するTrigger、接続、操作権限の範囲を表すProfile候補である。上位Profileへの移行は自動ではなく、各段階で人間判断、根拠、検証、回復条件を必要とする。

### Profile 0 — 構想と境界

- 公開済み基準、v0.18.0規範変更候補、非規範Architecture Candidateの分離
- コンテキスト契機と実行契機の分離
- Operation Goalと固定Workflowの分離
- Human Authority、External Information Boundary、停止条件の維持

### Profile 1 — Scheduled Advice

- 読み取りと提案のみ
- 週次プロダクトレビュー
- 外部公開、本番変更、費用執行なし
- 有用性、誤検出、見逃し、費用を人間が評価

### Profile 2 — Event-driven Advice

- 意味変化を検出した場合だけ再評価
- 重複起動と再帰Loopを制御
- 情報不足、権限不足で安全に停止

### Profile 3 — Connected Observation

- 承認済みToolから観測情報を取得
- 接続済みであることをAuthorityとみなさない
- External Information BoundaryとInstruction Authorityを検証
- 提案と人間判断を維持

### Profile 4 — Governed Execution

- 失敗影響を限定でき、検出可能で、RecoveryまたはCompensating Actionが成立し、Effect Boundary内で検証可能な操作だけを候補化
- 外部公開、本番、費用、法務、権限変更はHuman Gateを維持

### Profile 5 — Agent Organization

- 必要な専門観点だけを分担
- 独立性、権限、引き渡し、競合解決を評価
- Agent数を品質根拠にしない
- 複数Providerを使う場合もEligibility Gateを先に適用し、Cost／QuotaはEligible Set内だけで最適化

### 将来候補 — Continuous Product Evolution

```text
Observe → Discover → Reason → Propose
        → Authorized Execute → Verify → Learn
```

Humanは重要なDirection、Risk、Authorityを保持する。

---

Architectureは将来候補まで表現可能にし、最初のReference ImplementationはProfile 1へ限定する。

---

## 10. 次の具体的処置

1. 週次プロダクトレビューの読み取り専用Operation候補を一つ設計する。
2. Re-evaluation Contractの理由、対象、条件、`operation_ref`と、参照先Operation ContractのGoal、Authority、停止条件、Result expectationを分離した最小表現を比較する。
3. Coding Agent Automationで時間契機を作り、特定Providerへ規範を固定しない。
4. 合成コンテキストで情報不足、権限不足、Prompt Injection、再帰起動、停止、回復を検証する。
5. 判断価値、誤起動、見逃し、費用、人間確認負荷を測定する。
6. v0.18.0規範変更候補または公開基準が変わった場合は、本候補との意味差を新しい変更として再評価する。
7. 失敗を隠さず、本候補に不足する契約、能力、根拠として残す。

PoCの目的は成功を演出することではない。Triggerさえ与えればAIが有益な仕事を開始できるという中心仮説を、反証可能な形で評価することである。

安全性のPoCでは、Agentが危険操作を避けたという結果だけを根拠にしない。[自律安全Architecture](04_CRDD_v0_18_Autonomous_Safety_Architecture.md)が定める候補状態分離、Policy拒否、対象同一性不一致、累積予算超過、Circuit Breaker、回復の各境界を、Agentの判断とは独立したRuntime Evidenceで確認する。
