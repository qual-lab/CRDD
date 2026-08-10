# CRDD v2候補 — Operation HealthとHuman Interface

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Related: [v2構想](01_CRDD_v2_Concept.md), [責務境界](02_CRDD_v2_Responsibility_Boundary.md), [Activation ProfileとReference Implementation](03_CRDD_v2_PoC_Plan.md), [自律安全Architecture](04_CRDD_v2_Autonomous_Safety_Architecture.md), [Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md), [Agent & Provider Orchestration](07_CRDD_v2_Agent_and_Provider_Orchestration.md)

> 本書は非規範の運用・人間接続候補である。現在のCRDD、Human Authority、Communication、Quality Assurance、準拠基準または採用側の通知・判断手順を変更しない。

---

## 1. Success Principle

v2候補の価値は、AIの起動回数、自動処理件数、Agent数または自動化率では測らない。

> 自律Operationは、人間の判断負荷を増やすだけなら成功ではない。

目標は、人間が覚え、巡回し、情報を集め、差分を整理する作業を減らし、価値、方向、優先順位、重要判断、残存リスク受容へ集中できる状態である。

```text
Machine-heavy
  観測、差分、重複排除、Policy、検証、記録、集約

Human-light
  Direction、Canonical Change、External Effect、Residual Risk、例外
```

AIの背景活動を人間へそのまま投影しない。Human InterfaceはActivity FeedではなくDecision Queueを中心候補とする。

---

## 2. 二つのLane

### 2.1. Background Lane

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
Outcome Routing
  ├─ No impact            → Record / End
  ├─ Policy-contained     → Complete / Record
  ├─ Duplicate / Rejected → Aggregate / End
  └─ Decision required    → Human Decision Lane
```

Background Laneは、人間判断を回避する経路ではない。既存PolicyとAuthorityで一意に解決できる結果だけを終了または完了へ進める。Policy不明、Authority競合、重大Risk、検証不能を`No impact`へ丸めない。

### 2.2. Human Decision Lane

候補：

- ProductまたはDesign Direction変更
- Canonical Context変更
- External Send、Publication、Production、Financial、Legal Effect
- Residual Risk Acceptance
- Policy AmbiguityまたはAuthority Conflict
- Circuit Breakerと再開判断
- 自律OperationのActivation、権限拡張、Pause解除、廃止

人間にはActivity全体ではなく、今回決めること、推奨、根拠、主な選択肢、影響、Risk、保留時の状態を示す。

---

## 3. Decision Queue

Decision Queueは新しい必須成果物または固定UIを意味しない。複数Runから生じた人間判断を、同じ根本原因、決定権限者、判断時点、対象Identityに応じて集約できるHuman Interface候補である。

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

## 4. 通知と集約

通知はOperationの完了条件ではない。

- `No impact`、重複抑止、既知Policyによる拒否は、原則として逐次通知せずDigestへ集約できる。
- Policy拒否のたびに人間へ承認を求めない。本当に必要なCapabilityなら、一定期間の集約結果からPolicy変更候補として提示する。
- Circuit Breakerは同じ失敗を繰り返し通知せず、対象OperationまたはRepositoryをPauseして一つの判断事項へまとめる。
- Security Incident、外部漏洩疑い、不可逆Effect等の即時性が必要な事象は、Digestを待たず既存のEscalationへ接続する。
- 人間が「通知なし」を選んだことを、未解決Riskの終了やAuthority承認とみなさない。

---

## 5. EventのDebounceとBatch

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

## 6. 差分起点の探索

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

## 7. Operation Health

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

ProviderまたはCreditの均等分散も成功条件にしない。Hard Cost／Effect Budget Ceiling違反または実行Capacity不足はEligibilityの拒否として扱い、Estimated CostやQuota／Credit Efficiencyとは別のHealth信号にする。Eligibilityを満たす候補間でCost／Quota集中を改善できても、品質、安全性、情報境界、見逃しまたは人間負荷が悪化するRoutingを採用しない。詳細は[Agent & Provider Orchestration](07_CRDD_v2_Agent_and_Provider_Orchestration.md)に置く。

---

## 8. Adaptive Operation

> Operation Healthは実行強度を適応させてもよいが、自身の目的、Authority、安全境界、成功条件を自己変更してはならない。

対象コンテキストまたはCapabilityの変更が、Operationの目的、判断対象、情報境界、Authorityまたは期待結果を実質的に変える場合、その変更を実行強度の調整として扱ってはならない。Semantic Contract変更候補として人間の決定権限へ戻す。

Repository Identity、Context Referenceの解決範囲、Provenanceの情報源またはAuthority Grantの対象Scopeを変える場合も、単なる探索範囲や頻度の調整とみなさない。[Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md)が示す意味境界への変更として、既存のAuthorityへ戻す。

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

## 9. 停止・再設計候補

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

## 10. 責務境界

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

## 11. PoCで確認すること

- 100件相当の背景結果から、判断が必要なものだけを一つのQueueへ集約できる。
- No-impactと重複結果が人間へ逐次通知されない。
- Policy拒否が承認要求の連打にならない。
- Revision SetのBatch後も意味変化を再構成できる。
- 差分起点から必要な上流Contextへ探索を拡張できる。
- 見逃しと誤検出を人間の独立確認と比較できる。
- Human minutes per useful decisionとCost per useful findingを測定できる。
- Health悪化時に頻度低下、Pause、再設計候補を提示できる。
- Agentの自己判断だけでProfile昇格やPause解除を行わない。

PoCの合格は背景実行数ではなく、人間が処理する判断を減らしながら、重要な見逃し、安全違反、未処理Riskを増やさないことで評価する。
