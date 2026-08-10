# CRDD v2候補 — 自律安全Architecture

Status: Concept / Future Candidate  
Target: CRDD v2.x Candidate  
Related: [v2構想](01_CRDD_v2_Concept.md), [責務境界](02_CRDD_v2_Responsibility_Boundary.md), [Activation ProfileとReference Implementation](03_CRDD_v2_PoC_Plan.md), [Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md), [Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md), [Agent & Provider Orchestration](07_CRDD_v2_Agent_and_Provider_Orchestration.md)

> 本書は非規範の安全Architecture候補である。現在のCRDD v0.17.0、Human Authority、External Information Boundary、Agent Contract、準拠基準または採用側の権限を変更しない。用語、状態、成果物、Policy、Runtime機構は、独立した変更・検証・人間判断を経るまでCRDD標準ではない。

---

## 1. 安全目標

自律安全の目標は、AIが誤判断しないことではない。

> AIが誤判断しても、許可されていない実行効果（Effect）をCurrent State、Canonical ContextまたはExternal Worldへ確定させない。

AIは誤ったProposalやCandidateを作り得る。安全Architectureは、誤りが確定状態へ到達するまでに、対象、権限、情報境界、Effect、検証、昇格、回復をRuntimeで強制可能にする。

中心原則：

> 自律性は思考と候補形成に広く与え、実行効果の確定はPolicyとRuntimeで統制する。

短い表現：

> `Think broadly. Effect narrowly.`

ただしReasoningも無制限ではない。利用できるコンテキストは、Agent Permission、Context Scope、Information Classification、External Information Boundaryの内側に限られる。

---

## 2. 安全な実行経路

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

## 3. コンテキストアクセス

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

## 4. 実行効果の分類

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

External SendをWriteの一種へ縮退させない。情報は送信時点で不可逆に伝播し得るため、v0.17.0のExternal Information Boundaryと直接接続する。

分類はAgentの「低Risk」という自己申告で決めない。対象、操作、送信先、正本性、不可逆性、費用、権限等の観測可能なEffectからPolicyが経路を決める。

---

## 5. 効果明細

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

## 6. Candidate StateとPromotion

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

## 7. 対象同一性の再確認

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

## 8. 効果予算

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

## 9. 再帰、重複、Retry

- `operation + repository + target revision`相当の実行キーを持つ。
- Run ID、Trigger Cause、Parent Run IDを取得可能にする。
- 同じ原因・対象の同一Operationを同時実行しない。
- Operation Result自身を同一Operationの即時Triggerにしない。
- 別Operation起動はCandidateとし、Trigger評価とAuthority確認を経る。
- Retryは回数、時間、費用、Effectを上限化する。
- 同じ失敗をRetryで隠さず、原因不明または非一時的な失敗は停止する。
- AgentやSubagentの委譲で実行BudgetとAuthorityを増やさない。

---

## 10. 自律実行停止

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

## 11. 検証、回復、昇格

実行者自身の「完了」をEffect確定の根拠にしない。

- 決定論的検証がEffect全体を証明できる場合は、その証明範囲を明示する。
- 意味、Authority、外部影響、重大Risk等の機械検証外は独立確認またはHuman Gateへ戻す。
- Checker成功を意味、準拠、公開、Security、安全なPromotionへ流用しない。
- Rollback可能という主張だけで可逆とみなさず、必要に応じてRecoveryを演習する。
- 外部伝播を完全に戻せない場合は、Compensating Action、通知、Credential失効、封じ込めを扱う。
- Promotion、Reject、Recoverの結果をRun IdentityとEffect Manifestへ接続する。

---

## 12. Runtime Enforcement

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

## 13. 安全不変条件候補

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
18. [Policy-contained Completion](02_CRDD_v2_Responsibility_Boundary.md#45-policy-contained-completion)からCanonical Adoption、Promotion、Risk Acceptance、ReleaseまたはHuman Authorityを推定しない。
19. Executor、Reviewer、ProviderまたはCoordinatorのResult、Finding、承認要求、多数決、完了申告または`Pass`からHuman Authority、Promotion、Risk Acceptanceまたは採用を推定しない。
20. 古い対象改訂版の統合結果を現在の判断へ流用せず、重大リスク、Authority競合または検証不能を通常の集約、重複排除またはDigestへ埋めない。
21. 対象契約、変更分類またはリスク上必要なIndependent Reviewが更新後の同一固定改訂版に対して成立したことを確認できない場合、`Applied`、自己確認、Verification、古いReviewまたは完了申告だけでFindingを`Resolved`、Policy-contained CompletionまたはPromotionとしない。Independent Reviewが非該当でFindingのない軽量Operationへ、新しいReviewまたは擬似的な解消判定を要求しない。

将来互換の表現と現在の利用許可の分離は[Forward Compatibility](06_CRDD_v2_Forward_Compatibility.md)に置く。本書は、その分離がEffect確定前にRuntimeで強制されることを扱う。

---

## 14. PoCで確認する境界

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
- [Policy-contained Completion](02_CRDD_v2_Responsibility_Boundary.md#45-policy-contained-completion)へ到達したRunからCanonical Promotionを直接要求し、Promotion Policyがなければ確定を拒否する。
- ExecutorまたはReviewerが人間承認を直接要求し、Coordinatorが現在の対象改訂版から判断要否を再構成せずにHuman Gateへ送ろうとした場合に拒否する。
- 古いRevisionのResult、解消済みFindingまたはProvider多数決を現在判断へ流用しようとした場合に停止し、重大リスクはDigestを待たず移送する。
- 正式なFindingの是正後、更新した固定改訂版に必要な独立再レビューが成立していないのに、自己確認またはVerificationだけで解消、完了またはPromotionを要求した場合に拒否する。一方、Review非該当でFindingのない軽量Operationは既存の完了条件で終了できる。

PoCの合格は「Agentが危険なことをしなかった」ではなく、「Agentが危険なEffectを要求してもRuntimeが確定を防ぎ、理由とEvidenceを残した」ことで評価する。

安全に終了したRunを人間へ逐次通知する必要はない。Background処理とHuman Decisionの分離、集約、Operation Healthは[Operation HealthとHuman Interface](05_CRDD_v2_Operation_Health_and_Human_Interface.md)に置く。
