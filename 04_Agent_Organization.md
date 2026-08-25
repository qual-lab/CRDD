<a id="agent-organization"></a>

# エージェント組織（Agent Organization）

Version: v0.18.0
Status: Candidate
Released Baseline: v0.17.0
Owner: Qual-Lab
Last Updated: 2026-08-25
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [10_Agent.md](10_Agent.md)
- [16_Quality_Assurance.md](16_Quality_Assurance.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [52_Conformance_Audit.md](52_Conformance_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)
- [Agent & Provider Orchestration](99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)

---

> この文書で分かること（非規範の案内）
>
> - CRDDがAIを一つの万能主体ではなく組織として扱う理由
> - Role、Specialty、Capability、Authorityをどう分けるか
> - 委譲、独立レビュー、費用、結果統合をどう扱うか
> - Coordinator Runtimeや特定Providerと概念をどう分離するか

本書は、エージェント組織の目的、概念境界および共通原則を所有する基礎正本である。現在の状態は`Candidate`であり、公開済み基準、準拠表明、採用側の基準版またはRuntime利用可能性を自動的に変更しない。

---

## 1. 目的

エージェント組織は、AIを単一の万能主体として扱う代わりに、対象Workに必要な専門性、責務、Capability、決定権限の境界および検証を組み合わせ、結果を同じ目的と前提へ統合するCRDDの横断概念である。

```text
Human
  ├ Idea / Value / Direction
  ├ Decision Authority
  └ Accountability
        ↓
Agent Organization
  ├ Specialized Execution
  ├ Critique / Verification
  └ Result Integration
        ↓
Human Decision / Policy-contained Completion
```

Agent数を増やすこと、別Providerを使うこと、会話を再帰的に続けること自体を目的にしない。一つの主体で成立するWorkへ、不要な委譲、Reviewまたは固定組織を追加しない。

---

## 2. 人間とAIの責務

CRDDでは、AIが許可範囲内の探索、整理、比較、設計、実装、検証および結果統合を担える。人間は価値、方向、採否、Risk Acceptance、公開、Releaseその他のHuman Authorityと最終責任を保持する。

AIが有力案を提示し、実装し、独立レビューで`Pass`を返しても、それだけから採用、Promotion、Risk AcceptanceまたはHuman Authorityを成立させない。Coordinatorも例外ではない。

---

## 3. 概念モデル

```text
Agent Organization
├ Work Goal and Preserved Intent
├ Role and Responsibility
├ Specialty and Required Capability
├ Work Assignment and Context Scope
├ Delegation and Handoff
├ Verification and Independent Review
├ Result Integration and Escalation
└ Authority and Human Boundary
```

これは固定Schemaまたは必須成果物一覧ではない。同じ意味を既存のOperation Contract、Agent Contract、Work Assignment、Result、Reviewおよび現在の判断集合から取得できる場合、新しい中央台帳へ複製しない。

---

## 4. Role、Specialty、Capability

Roleは対象Work内の責務を示す。Specialtyは適用する専門観点、CapabilityはそのWorkを実行または検証するために必要な能力や接続条件を示す。

```text
Role ≠ Specialty ≠ Capability ≠ Authority
```

ExecutorというRoleを持つことからRepository変更Authorityを推定しない。ReviewerというRoleを持つことからPromotion Authorityを推定しない。特定ModelまたはProviderの名称から専門品質、独立性、CapabilityまたはAuthorityを推定しない。

Planner、Executor、Reviewer、Coordinatorは有力な任意Roleであり、CRDD全体の基本Roleや固定Flowではない。一つの主体が複数責務を持てる場合も、どの責務を担ったかと、独立性が必要な責務を分ける。

---

## 5. Work Assignment、Delegation、Handoff

Work Assignmentは、Goal、必要Context、保持条件、Acceptance Criteria、Authority、禁止操作、Required Evidenceおよび停止条件を、受け手に必要な粒度で投影する。

Delegationは作業責務の移譲であり、親または呼出元が持たないAuthority、情報アクセス、Tool AccessまたはEffectを子へ追加する経路ではない。委譲先のAgent、Model、ProviderまたはRuntimeが変わる場合も、Context、Authority、情報境界およびVerification Requirementを暗黙に流用しない。

Handoffは自由形式の会話履歴だけに依存せず、対象Revision、情報源、保持条件、実際のResult、Evidence、未解決事項、未評価範囲および次の責務を再構成可能にする。

---

## 6. 編成候補と選択

Coordinatorまたは採用側Runtimeは、Workを一つ以上の実行編成候補へ投影できる。候補には、担当Role、必要な実行境界、委譲、検証、結果統合およびHuman Gateを含められる。

これは新しい正式用語、固定Schemaまたは永続成果物を導入するものではない。候補選択の実行Architecture、Eligibility Gate、Eligible Set内のOptimization、FallbackおよびContext Projectionは[Agent & Provider Orchestration](99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)を参照する。同文書は未完了Architecture候補であり、本書の概念を再定義しない。

---

## 7. Independent Review

複数Agentや別Providerの使用をIndependent Reviewの根拠にしない。独立性は、作成責務から分離し、対象と基準とEvidenceから結論を独立に再構成できることで確認する。

別ProviderでもExecutorの要約または結論を前提にするだけなら独立ではない。同じProviderでも、責務とContextが分離され、現在の固定改訂版を基準から評価できれば独立性が成立し得る。

Independent Reviewの適用条件、確認者の能力根拠、結果および工程移行は[Agent契約](10_Agent.md)と[品質保証](16_Quality_Assurance.md)を正本とする。本書は新しいReview段階を追加しない。

---

## 8. Cost、Quota、Credit

不要なAgent、委譲、再試行または上位Modelを起動しない。具体化済みで低リスクのWorkは、必要品質を満たす低Cost候補で処理できる。難易度、曖昧性、失敗影響、専門性または検証要求が高い場合だけ、より高い能力や推論量を候補化する。

ただしCost、QuotaまたはCreditはSafety、Privacy、Authority、必要Capability、Verification Requirementまたは品質成立条件を弱める理由にしない。Cost／Credit分散はEligible Set内の運用最適化であり、エージェント組織の目的、Provider採用理由または独立性の根拠ではない。

選定は対象Workに対して説明可能でなければならない。Provider、Model、推論量、速度および委譲経路を使う場合は、採用理由と、より高価な候補を使う必要性または使わない理由をExecution Provenanceから再構成可能にする。

---

## 9. AuthorityとSecurity

エージェント組織はAuthorityの配布機構ではない。Role、接続可能性、認証済みSession、Capabilityの存在および過去の成功から、今回のAuthorityを推定しない。

```text
Available ≠ Enabled ≠ Accessible ≠ Authorized ≠ Promoted
```

子Agentまたは委譲先へ渡せるAuthorityは、親の許可範囲と対象OperationのGrantを超えない。外部送信、Repository変更、Promotion、push、merge、Release、Publication、Financial Effectその他のEffectは、対象AuthorityとRuntime Enforcementが成立する場合だけ処置できる。

Authorityの一般規則は[原則](01_Principles.md)と[Agent契約](10_Agent.md)、実行境界のRoutingは[Agent & Provider Orchestration](99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)、現在のCoordinator Runtimeによる強制方法は[`tools/coordinator`](tools/coordinator/README.md)を参照する。実装READMEを概念またはAuthorityの正本にしない。

---

## 10. Coordinatorと結果統合

Coordinatorは、対象Workに必要な編成候補を評価し、許可された実行主体へWorkを割り当て、Result、Evidence、Verification、Policy結果および未解決事項を現在の対象改訂版へ統合する責務である。

ExecutorまたはReviewerが返した質問、承認要求、完了申告または`Pass`を、そのまま人間の判断事項へ変換しない。Coordinatorは現在の判断集合を再構成し、AIが一意に処置できる事項、解消済み事項、報告だけの事項および安全に独立保留できる将来事項を除いたうえで、現在も人間の決定権限が必要な事項だけを返す。

Coordinatorは概念上の責務であり、特定製品、常駐Service、親子Process、Provider同士の直接Invocationまたは専用Runtimeを必須にしない。

---

## 11. Provider／Runtime非依存性

エージェント組織は特定Providerの組合せへ固定しない。Provider間の相互補完はReference Use Caseになり得るが、同一Providerだけで成立するWork、単一Agentだけで成立するWorkまたは将来Providerも同じ概念境界で扱える。

```text
Agent Organization Concept
        ↓
Agent & Provider Orchestration Architecture
        ↓
Coordinator Runtime / Other Runtime
        ↓
Provider Adapter and Execution Environment
```

現在のCoordinator Runtimeはこの概念を実装する一候補であり、エージェント組織そのものではない。Runtime実装の変更から、概念、Human AuthorityまたはCRDD準拠条件の変更を推定しない。

---

## 12. 目的としないこと（Non-goals）

本書は次を目的にしない。

- 常時Multi-Agentまたは常時Cross-providerにする
- 固定Planner／Executor／Reviewer Flowを要求する
- Agent数、Provider数、会話量、Routing回数またはCredit分散率を品質指標にする
- Provider差をIndependent Reviewとみなす
- AIへ無制限Authority、自己拡張またはHuman Authorityを与える
- Provider同士の直接spawn、循環委譲または無制限再帰を要求する
- CostのためにSafety、Privacy、AuthorityまたはVerificationを弱める
- `tools/coordinator`をCRDD概念の正本にする
- 本書のCandidate状態だけから準拠基準、Released BaselineまたはRuntime利用可能性を成立させる

---

## 13. 文書責務

| 層 | 所有するもの | 所有しないもの |
|---|---|---|
| 本書 | エージェント組織の目的、概念境界、Role／Specialty／Delegation／統合の関係 | Runtime command、Provider argv、Docker、永続Schema |
| [Agent & Provider Orchestration](99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md) | Routing、Eligibility、Optimization、Projection、Fallback、Execution Provenanceの未完了Architecture候補 | Human Authorityの再定義、特定Runtimeの実装手順 |
| [`tools/coordinator`](tools/coordinator/README.md) | 現在のCoordinator Runtimeによる実装、強制、Build、Run、Recovery、Test | エージェント組織、Authority、Independent ReviewまたはCost原則の意味正本 |
| 現行Core契約 | Human Authority、Agent Contract、Independent Review、Quality、External Information Boundary | 特定Runtimeの実装詳細 |

他文書はエージェント組織を再定義せず、必要な短い説明と本書への参照を置く。

---

## 14. ReviewとAudit

個々のAgentの委譲、統合およびIndependent Reviewは[Agent契約](10_Agent.md)、品質状態と工程移行は[品質保証](16_Quality_Assurance.md)に従う。

本書と利用側の文書構造、用語、参照および責務重複は[Document Audit](51_Document_Audit.md)、CRDD基準と準拠表明への影響は[Conformance Audit](52_Conformance_Audit.md)、複数正本、工程、Runtimeまたは採用側への波及は[Gap／Impact Audit](53_Gap_Impact_Audit.md)で確認する。エージェント組織の名称だけを理由に専用Auditを追加しない。既存Auditで表現できない固有の適用条件、合否判定または根拠契約が生じた場合に限り、独立したAudit契約を検討する。
