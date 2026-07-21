# CRDD Conformance Audit

Version: v0.5.0
Status: Stable
Owner: Qual-Lab
Agent ID: `agent.conformance.audit`
Last Updated: 2026-07-21
Related:
- [01_Principles.md](01_Principles.md)
- [02_Terminology.md](02_Terminology.md)
- [03_Documentation.md](03_Documentation.md)
- [10_Agent.md](10_Agent.md)
- [11_Skill.md](11_Skill.md)
- [12_Change.md](12_Change.md)
- [13_Release.md](13_Release.md)
- [28_Implementation.md](28_Implementation.md)
- [29_Verification.md](29_Verification.md)
- [51_Document_Audit.md](51_Document_Audit.md)
- [53_Gap_Impact_Audit.md](53_Gap_Impact_Audit.md)

---

# 1. Purpose and Boundary

本書は、Project、Product、または組織的な開発活動がCRDDへの準拠を表明できるかを判定するCriteria、適用Profile、Evidence、Claimと、それらを実行するConformance Audit Contractを定義する。

本書はConformance Criteriaと評価の正本であり、原則、用語、Artifact規定、工程Contract、Agent実行規定、品質規定は再定義しない。各Criteriaの詳細は参照先のAuthorityを正本とし、本書は次を保持する。

```text
Criteria ID
Applicable Profile
Conformance Assertion
Authority
Required Evidence
Evaluation Result
```

規範強度語彙は[`03_Documentation.md`](03_Documentation.md#48-normative-language)を正本とする。

Conformance AuditはCriteria ResultとClaim Eligibilityを返す読取専用Reviewである。外部へ準拠を表明するClaimは、対象ScopeとRevisionに責任を持つHumanまたは組織AuthorityがAudit Resultを確認して記録する。Audit Agentが自分の評価だけでClaimを発行しない。

---

# 2. Conformance Model

CRDDは成熟度Levelではなく、Coreと適用Profileで準拠を判定する。

| Set | Applicability |
|---|---|
| CRDD Core | CRDD準拠を表明するすべての活動 |
| Product Lifecycle Profile | OriginからUX、IA、UI、SPEC、Architecture、Implementation、Verificationまでを扱う活動 |
| Agentic Delivery Profile | AI Agentが設計、実装、Test、Review、修正を主体的に行う活動 |

ProfileはCoreへ追加して適用する。Profileだけを満たしてもCore未準拠ならCRDD準拠ではない。両Profileに該当する活動は両方を適用する。

Profile Applicabilityは対象活動の実態で決め、都合の悪いCriteriaを避けるためにProfileを外してはならない。Audit実行者は適用Profileと理由を提示し、Claim Ownerが対象Scopeとともに確認する。特定Toolや文書名が異なっても、同等のAuthority、Artifact、Evidence、Lifecycleを示せる場合はCriteriaを評価できる。

---

# 3. Evaluation Contract

各適用Criteriaは、対象ScopeとRevisionを固定して評価する。

| Field | Meaning |
|---|---|
| Criteria | 本書のCriteria ID |
| Scope | 評価対象Project、Product、Change、Release等 |
| Revision | 評価した正本RevisionまたはBaseline |
| Criteria Revision | 評価に使用したCRDD Versionまたは本書Revision |
| Authority | Criteria詳細の参照先 |
| Evidence | 判定を再確認できるArtifact、履歴、Result、Record |
| Result | `Conformant`、`Non-conformant`、`Not Evaluated`、`Not Applicable` |
| Finding | 不足、矛盾、Risk、改善事項 |
| Reviewer | 評価主体 |
| Reviewed At | 評価時点 |

`Not Applicable`はProfile Criteriaの条件または対象Scopeに明確に適用されない場合だけ使用し、理由を必要とする。Core Criteriaへ原則として使用せず、適用Criteriaの未評価、Evidence不足、担当不在を`Not Applicable`で回避してはならない。

Evidenceは対象ScopeとRevisionへの適用性、Authority、取得時点、既知Limitを説明できなければならない。古いAudit ResultやArtifactの存在だけを現行Revisionの根拠として再利用しない。

専用監査文書は必須ではない。ただし準拠を表明する場合、各適用CriteriaのEvidenceへ到達できなければならない。

`C-*`、`PL-*`、`AD-*`は本書内のCriteria Keyであり、Project Contextへ付与するCRDD標準Stable Context IDではない。

---

# 4. CRDD Core Criteria

| ID | Conformance Assertion | Authority | Required Evidence |
|---|---|---|---|
| C-01 | Origin、対象Actor、Intent、守る価値、Non-goalを再確認できる | [Principles](01_Principles.md)、対象Discovery / UX Artifact | Origin / Intentを持つCanonical ArtifactとRevision |
| C-02 | Repository LevelでProperty Authority、正本位置、状態、履歴、探索経路を人間とAIが識別できる | [Documentation](03_Documentation.md) | Repository構造、Property Authority、Status、Revision、History、Index |
| C-03 | Observation、Evidence、Interpretation、AI推定、Hypothesis、Decisionを区別し、Provenanceを追跡できる | [Terminology](02_Terminology.md)、[Documentation](03_Documentation.md) | Source、取得条件、Revision / 時点、Provenance、Limitation |
| C-04 | 重要Decisionの結果、理由、Authority、Evidence、影響を結果Artifactから追跡できる | [Documentation](03_Documentation.md) | Canonical ArtifactのDecision / Rationaleと関連Evidence |
| C-05 | 価値判断、重要Decision、Approval、Risk受容、最終責任をHuman Authorityが保持する | [Principles](01_Principles.md) | Human Review / Approval、Authority、未承認AI Draftの区別 |
| C-06 | 重要Contextの変更理由、影響、承認、置換履歴を確認できる | [Documentation](03_Documentation.md)、[Change](12_Change.md) | Change Trace、Impact、Approval、History、Supersedes |
| C-07 | Artifact LevelでContextのSource、意味、理由、関連先を読み取れる | [Documentation](03_Documentation.md) | Common Artifact Contract、明示的Relation、Semantic Separation |
| C-08 | 現在のImplementationやToolをOriginそのものとせず、別実現手段を再評価できる | [Principles](01_Principles.md) | Preserved Intent、Constraint、Alternative、Implementation Relation |
| C-09 | Verification、運用、失敗、Reviewから得たLearningを必要な上流Contextへ戻せる | [Principles](01_Principles.md)、[Verification](29_Verification.md) | Verification Result、Learning、更新ArtifactまたはProposal |
| C-10 | C-01からC-09の適用結果と根拠を説明できる | 本書 | Criteria別EvaluationとEvidence Reference |

---

# 5. Product Lifecycle Profile Criteria

| ID | Conformance Assertion | Authority | Required Evidence |
|---|---|---|---|
| PL-01 | OriginからVerification / Learningまで、対象Scopeに必要な専門責務が意味を失わず接続される | [Principles](01_Principles.md)、[Discovery](21_Discovery.md)、[UX](22_UX.md)、[IA](23_IA.md)、[UI](25_UI.md)、[SPEC](26_Behavior_Specification.md)、[Architecture](27_Architecture.md)、[Implementation](28_Implementation.md)、[Verification](29_Verification.md)、[Gap / Impact Audit](53_Gap_Impact_Audit.md) | Source Context、Coverage、Handoff、Gap / Impact Finding、Verification |
| PL-02 | 各主要ArtifactがSource、Preserved Intent、Decision / Definition、Downstream Obligation、Verificationを取得可能にする | [Documentation](03_Documentation.md) | Common Artifact Contractを満たすArtifactまたはIndex |
| PL-03 | Context間の関係を単なる関連Linkではなく意味のあるRelationとして説明できる | [Documentation](03_Documentation.md) | Context / Relation Indexまたは同等のTrace |
| PL-04 | Discovery、UX、IA、UI、SPECの責務Coverageと工程間Handoffを対象Scope全体で説明できる | [Discovery](21_Discovery.md)、[UX](22_UX.md)、[IA](23_IA.md)、[UI](25_UI.md)、[SPEC](26_Behavior_Specification.md)のPhase Process Contract | Coverage State、Unresolved Gap、Human Review、Handoff |
| PL-05 | UI ContractとBehavior SpecificationがAction、State、Failure、Recovery、Permission等で整合する | [UI / Behavior Pair](24_UI_Behavior_Specification.md)、UI / SPEC Phase Contract | Pair Review、対応表、例外理由 |
| PL-06 | 各通常工程境界では、送信Exitと受信Entryを対象Revisionに対して独立Reviewし、移行に影響するFindingを責務工程で修正・再ReviewしたうえでHuman Authorityが判断する。Review省略または未解消Findingを伴う移行は明示的なHuman-directed Review Exceptionとして通常Passと区別する | [Transformation Handoff Invariants](01_Principles.md#62-transformation-invariants)、[Independent Review](10_Agent.md#7-independent-review)、[Skill](11_Skill.md)、各工程の`Phase Gate Criteria` | Phase Transition Review Result、Reviewed Revision、Finding / Remediation / Re-review、Approval Record、Review Exception（該当時） |
| PL-07 | 完了を実装動作だけでなく、Acceptance、UI / SPEC、UX Intent、Origin、Learningに対して検証する | [Implementation](28_Implementation.md)、[Verification](29_Verification.md)、各Phase Gate Criteria | Target Revision、Fresh Evidence、Verification Result、未達条件、Learning |
| PL-08 | 外部Consumer、既存Data、Migration、容量制約があるScopeでは、観測可能なCompatibility / Capacity Behaviorと、それを成立させるArchitecture、移行、検証を接続する | [SPEC](26_Behavior_Specification.md)、[Architecture](27_Architecture.md)、[Implementation](28_Implementation.md)、[Verification](29_Verification.md) | Consumer Contract、Version / Migration Plan、Capacity Assumption、Rollback、Compatibility / Load Evidence |
| PL-09 | AI、個人Data、外部Actionを含むScopeでは、Purpose、Consent、Trust、Human Control、Security Boundary、Privacy、Costを上流から実行・検証まで接続する | [Principles](01_Principles.md)、[Discovery](21_Discovery.md)、[UX](22_UX.md)、[IA](23_IA.md)、[UI](25_UI.md)、[SPEC](26_Behavior_Specification.md)、[Architecture](27_Architecture.md)、[Implementation](28_Implementation.md)、[Verification](29_Verification.md) | Purpose / Data Boundary、Consent Behavior、Trust Surface、Authority、Security / Privacy Design、Cost Guardrail、Fresh Verification |
| PL-10 | 分析から生じる調整NeedをUXで抽出・分類し、利用者またはAuthorityが変更するものはIAのConfiguration Model、UIのSettings / Control Surface、SPECのConfiguration / Policy Behaviorへ、それ以外は固定Rule、自動適応、導出値、Technical Configuration、保留等の適切なObligationへ接続し、成立方式、実装、検証まで意味を失わない | [UX](22_UX.md)、[IA](23_IA.md)、[UI / Behavior Pair](24_UI_Behavior_Specification.md)、[UI](25_UI.md)、[SPEC](26_Behavior_Specification.md)、[Architecture](27_Architecture.md)、[Implementation](28_Implementation.md)、[Verification](29_Verification.md) | Control / Adaptation Need、Candidate Disposition、Configuration Candidate / Model、Downstream Obligation、UI / SPEC Pair、Default / Effective Value、Authority、Technical Configuration、変更・Reset / Recovery Contract、Fresh Verification |
| PL-11 | 採用済みDeferred Workを単一のRoadmap Main Viewで管理し、必要時だけDetail Fileへ分ける。ItemはSource Context、Owner、Start Condition、再評価Triggerを持ち、着手時は現行ContextとImpactを再確認した`CHG-*`へ接続する。完了時はDetail固有情報をCanonical Artifactと適用されるCHG、Implementation、Verificationへ反映し、非適用理由または結果参照をMain Viewへ戻してDetail Fileを削除する。登録待ちは対象Itemへ限定し、無関係なRouteを停止しない | [Discovery](21_Discovery.md#63-roadmap-item-contract)、[Change](12_Change.md) | Roadmap Main View / Item、必要なDetail Reference、Human Deferral / Start Decision、Source Context、Owner、Start Condition、Re-evaluation Trigger、適用されるCHG / Result / Verification ReferenceまたはNot Applicable理由、Detail Cleanup Evidence |
| PL-12 | Human Decision、Constraint、Learning、Evidence、Findingの確定・変更時にTriggered Propagation Checkの要否を評価し、発火時は上流・同層のOpen Question、Unresolved Gap、Assumption、Decision、Constraintを探索する。必要な正本更新後は更新Revisionから下流Impactを再探索し、再監査する。未完了の伝播はHuman-directed `propagation_exception`として通常Passと区別する | [Transformation Invariants](01_Principles.md#62-transformation-invariants)、[Gap / Impact Audit](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure)、各工程の`Phase Gate Criteria` | Source Revision、Trigger Evaluation / No Impact理由、Gap / Impact Audit Result、探索Relation / Candidate / Disposition、Canonical Artifact Update、Downstream Re-scan、Re-audit Result、Propagation Exception（該当時） |

---

# 6. Agentic Delivery Profile Criteria

| ID | Conformance Assertion | Authority | Required Evidence |
|---|---|---|---|
| AD-01 | AI Agentが行動前にScope、Revision、関連Context、Decision、Rule、Constraint、責任者、判断Authority、Action Authority、Escalation先を確認する | [Agent](10_Agent.md)、[Skill](11_Skill.md) | Read Context、Active Scope、Target Revision、Owner / Invoker、Authority / Action Boundary、Escalation Target |
| AD-02 | 重大または複数工程の変更前にGoal、In / Out Scope、Dependency、Risk、Verificationを明示する | [Agent](10_Agent.md)、[Skill](11_Skill.md) | AI Work Planまたは同等のExecution Contract |
| AD-03 | AI変更をReview、中断、再開、切戻し可能な単位で実行し、停止時も変更済みArtifact、未検証状態、Side Effect、Rollback要否を返す | [Agent](10_Agent.md)、[Skill](11_Skill.md) | Boundary、Checkpoint、Partial Result、Rollback、Handoff |
| AD-04 | 重要変更と工程移行候補を生成・実装と分離した観点でReviewする。AIによる工程移行Reviewは別Review Subagent、Clean Session / Agent、または人間Reviewerへ委譲し、Finding修正後は更新Revisionを再Reviewして、Audit Run完了をTarget Passへ流用しない | [Agent](10_Agent.md) | Delegation Contract、Independent Review、Finding、Remediation、Re-review Result、Residual Risk |
| AD-05 | Artifact生成、Code動作、Test Pass、Agent Resultだけから工程完了を推測せず、変更後のFresh Evidenceと工程Criteriaを確認する | [Agent](10_Agent.md)、[Implementation](28_Implementation.md)、[Verification](29_Verification.md) | Test、Build、Static Check、Runtime / Visual Result、Phase Coverage / Gate Evidence |
| AD-06 | 実装で変化した仕様、制約、既知制限、運用、Learningを関連Contextへ戻し、該当する変更のImpact Traceを更新する | [Skill](11_Skill.md)、[Change](12_Change.md) | Context Update、Change Trace、Proposal、Decision Candidate、Learning |
| AD-07 | 特定Agent、LLM、IDE、SDD Tool、Subagent構成をCRDD準拠条件としない | [Principles](01_Principles.md) | Tool固有機能に依存しないAuthority / Artifact / Evidence |
| AD-08 | AgentまたはSubagentへ渡すContextとAccessを必要最小限にし、委譲によって権限を拡張しない | [Agent](10_Agent.md)、[Principles](01_Principles.md) | Access Boundary、Redaction、Credential / Environment制約、Delegation Contract |
| AD-09 | 並行または長時間作業ではAction直前と統合前にScope、Authority、Base Revisionの変化を確認する | [Agent](10_Agent.md) | Revision Recheck、Conflict確認、Rebase / Re-review / Escalation記録 |
| AD-10 | Agent ResultがOutcome、Trace、Open Question、ConditionまたはResume Point、Handoff、未検証状態を区別し、Outcomeを工程Statusへ流用しない | [Agent](10_Agent.md) | Agent Result、Result Outcome、Condition / Resume Point、Trace、Handoff |
| AD-11 | Subagent利用時にParent AgentがResult比較、Conflict解消、統合、Promotion、Human Reviewへの接続を担う | [Agent](10_Agent.md) | Delegation Contract、Parent Integration、Conflict Record、Promotion / Review Evidence |
| AD-12 | Skill RunのOwner / Executor、Status、Current Step、Next Route、Produced Artifact Statusを分離し、Run完了を工程完了へ流用しない | [Skill](11_Skill.md) | Skill Run Record、Run Owner / Executor、Run Status、Current Step、Route、Artifact Status |
| AD-13 | Skill DefinitionがEntry、Input、Authority Boundary、専門責務、Exit、Stop、Confirmation、Handoffを工程正本への参照として定義し、工程Contractを複製しない | [Skill](11_Skill.md)、各工程文書 | Skill Definition Contract、Process Authority参照、Authority Boundary、Entry / Exit / Handoff |
| AD-14 | Guided Interactionが既知Contextの再質問、固定Questionnaire、未回答箇所のAI補完を避け、Source、AI変換、未決事項を区別する | [Skill](11_Skill.md) | Adaptive Queue、Raw Voice / Evidence、Transformation Summary、Open Question |
| AD-15 | Paused、Blocked、またはFailedとなったSkill RunがInput Revision、完了済み内容、未検証変更、Side Effect、Rollback要否、再開地点を保持する | [Skill](11_Skill.md)、[Agent](10_Agent.md) | Resume Snapshot、Partial Result、Revision、Next Action |
| AD-16 | Skill Handoffが対象Scope / Revision、Coverage、Unresolved Gap、Preserved Intent、Obligation、受信側Entry、Phase Transition Review Result、必要なHuman AuthorizationまたはReview Exceptionを保持する | [Skill](11_Skill.md)、[Independent Review](10_Agent.md#7-independent-review)、[Transformation Handoff Invariants](01_Principles.md#62-transformation-invariants) | Handoff Record、Coverage Summary、Unresolved Gap、Transition Review / Reviewed Revision、Human Authorization、Receiving Entry Evidence、Review Exception（該当時） |
| AD-17 | Canonical Contextの意味、Scope、責任、Default、Priority、Risk受容、下流Contractを変える問いでは、Agent / Skillや質問Labelを問わずDecision Support Contractを適用し、影響、Trade-off、評価基準とEvidenceに基づくRecommendation、Confidence / Uncertainty、推奨が変わる条件、保留影響をRiskとRuntime Scaleに応じて判断可能な言葉で提示する | [Agent](10_Agent.md)、[Skill](11_Skill.md) | Decision Support Summary、Recommendation / Alternative / Rationale / Evidence / Confidence / Revisit Condition |
| AD-18 | Agent / SkillがHuman Decision、Constraint、Learning、Evidence、Findingを確定・変更した場合、Triggered Propagation Checkの要否を必ず評価し、発火時は工程移行を待たず`agent.gap_impact.audit`または同等の独立ReviewerへRouteする。正本Remediationと再監査の結果をRun / Agent ResultおよびHandoffへ接続する | [Agent](10_Agent.md#74-triggered-propagation-check)、[Skill](11_Skill.md)、[Gap / Impact Audit](53_Gap_Impact_Audit.md#43-mandatory-propagation-trigger-and-closure) | Agent Result / Skill Run、Trigger Evaluation / No Impact理由、Propagation Route、Audit Result、Remediation / Re-audit、Handoff Result、Propagation Exception（該当時） |

---

# 7. Conformance Claims

| Claim | Required Criteria |
|---|---|
| `CRDD Core Conformant` | C-01〜C-10 |
| `CRDD Product Lifecycle Profile Conformant` | C-01〜C-10、PL-01〜PL-12 |
| `CRDD Agentic Delivery Profile Conformant` | C-01〜C-10、AD-01〜AD-18 |
| `CRDD Product Lifecycle + Agentic Delivery Conformant` | C-01〜C-10、PL-01〜PL-12、AD-01〜AD-18 |

「CRDD準拠」とだけ表明する場合は、少なくとも`CRDD Core Conformant`でなければならない。

`CRDD-Inspired`はConformance Claimではなく、Coreの全Criteriaを満たさない、または未評価である活動がCRDDの一部を採用していることを示す説明である。

Requested ClaimのEligibilityは次で判定する。

| Eligibility | Condition |
|---|---|
| `Eligible` | Required Criteriaがすべて`Conformant`、またはProfile内の条件付きCriteriaが理由付き`Not Applicable`である |
| `Not Eligible` | Required Criteriaに`Non-conformant`がある、Core Criteriaを適用外にしている、または必要Profileを評価対象から外している |
| `Undetermined` | Required Criteriaに`Not Evaluated`、Blocking条件、Evidence不足がある |

Document Auditの`Conditional` StatusやHuman-approved Deviationがあっても、未達のRequired CriteriaをConformantへ変換しない。条件付き運用を記録する場合も、Requested Claimが`Eligible`でなければ準拠表明しない。

特定のFolder番号、GitHub、Markdown、AI、Agent、LLM、Subagent、Design Toolの採用だけでは準拠根拠にならない。代替方式を使用してよいが、適用CriteriaとEvidenceを満たす必要がある。

---

# 8. Deviation and Review

Required Criteriaを満たさない状態を、Deviationの記録だけでConformantにしてはならない。未準拠Criteria、Risk、改善計画、Ownerを記録し、`CRDD-Inspired`または該当しないClaimを使用する。

少なくとも次の変化があれば、影響するCriteriaを再評価する。

```text
CRDD導入または適用Profile変更
重要Phase、Baseline、Releaseの開始・完了
Repository構造またはProperty Authorityの大幅変更
AI Agent、Delivery方式、主要Toolの変更
重大事故、手戻り、Intentとの不整合
Criteria AuthorityとなるCRDD文書の変更
```

準拠は固定認定ではなく、対象ScopeとRevisionに対する評価結果である。

---

# 9. Conformance Audit Execution Boundary

Conformance Audit Agentは、対象ScopeとRevisionについて適用Criteriaを評価し、Evidence、Finding、Claim Eligibility、再評価条件を返す専門Review Agentである。

Subagentとして実行する標準Agent IDは`agent.conformance.audit`とする。Parent Agentは、Requested Claim、Claim Owner、Target Scope / Revision、Criteria Revision、適用Profile候補、利用可能Evidence、既知Deviation、Expected Output、Read-only、Return先を[`10_Agent.md`](10_Agent.md)のDelegation Contractへ指定する。Subagentは本書のConformance Reportを返し、Canonical Artifact、Criteria、Claimを変更しない。

Document Auditは文書品質、Phase Auditは工程条件、Gap / Impact AuditはRelation横断影響、VerificationはProduct / Implementationの成立をそれぞれ正本とする。Conformance AuditはそれらのResultをEvidenceとして利用できるが、内容を再定義・自己承認しない。

Audit AgentはCanonical Artifactを直接変更せず、Criteria Resultを都合よく補完せず、Human AuthorityのClaim発行、Deviation受容、Risk受容を代行しない。Criteria不成立はFindingとしてParent AgentとClaim Ownerへ渡す。

RemediationはConformance Audit Runの外で行い、変更後Revisionに対して影響Criteriaを`agent.conformance.audit`または同等以上の独立Reviewerが再評価する。Audit Run完了、`Conditional`、到達可能なClaim候補の提示を、Requested ClaimのEligibilityまたはPhase Transition ReviewのPassとして扱わない。

---

# 10. Required Input and Read Set

最低限、次をInputとして受け取る。

```text
Audit Goal
Target Scope
Target Revision / Baseline
Applicable CRDD / Criteria Revision
Requested Conformance Claim
Claim Owner / Human or Organizational Authority
ProjectのContext Repositoryと対象Artifact
利用可能なEvidence / Verification Result
既存のDeviation、Finding、Conformance Result
```

Conformance Audit Agentは、最初に[`01_Principles.md`](01_Principles.md)のConformance Boundary、本書のConformance ModelとEvaluation Contract、[`51_Document_Audit.md`](51_Document_Audit.md)のAudit Status / Finding Fields / Report View / Severityを読む。

その後、適用CriteriaのAuthority列に示された文書と、Evidenceが存在するProject Artifactだけを対象Scopeに応じて読む。Repository全体を無制限に読み、未指定Scopeの準拠まで推定してはならない。

---

# 11. Audit Procedure

```text
1. Target ScopeとRevisionを固定する
2. Coreと適用Profileを判定する
3. 適用するC / PL / AD Criteriaを列挙する
4. 各Criteriaの参照Authorityを読む
5. Project ArtifactからRequired Evidenceを収集する
6. CriteriaごとにResultと根拠を記録する
7. Non-conformant、Not Evaluated、根拠不足をFindingへ変換する
8. Requested ClaimのEligibilityを判定する
9. 到達可能なClaim候補またはCRDD-Inspiredを提示する
10. Deviation、Owner、再評価Trigger、Recommended Handoffを返す
```

ファイル、Folder、Template、Tool、AI、Agentが存在するだけでCriteriaを`Conformant`にしてはならない。Artifactの一部完成から対象Scope全体を推定せず、Evidenceが現行Revisionへ適用できるかを確認する。

`Not Applicable`には適用外理由を必要とする。Evidence不足、未読、未評価、担当不在を`Not Applicable`として処理してはならない。

Document AuditのStatusは次のように使用する。Requested Claimが`Eligible`で全評価が完了した場合は`Pass`、`Not Eligible`なら`Fail`、`Undetermined`なら原則`Blocked`とする。`Conditional`はAudit ScopeやRemediation条件を表すために使えても、Conformance Claimの適格性を意味しない。

---

# 12. Output Contract

Report全体のStatus、Summary、Finding形式、Severity、Open Questions、Recommended Handoffは[`51_Document_Audit.md`](51_Document_Audit.md#3-output)を再利用し、本書へ複製しない。

Conformance Auditでは、Reportへ次を追加する。

```yaml
audit_type: conformance
target_scope: <project / product / change / release>
target_revision: <revision / baseline>
criteria_revision: <CRDD version or conformance criteria revision>
requested_claim: <claim or null>
claim_owner: <human or organizational authority>
applicable_profiles:
  - core
criteria_results:
  - criterion_id: C-01
    result: Conformant
    authority:
      - 01_Principles.md
    evidence:
      - <artifact / anchor / revision>
    finding_ids: []
claim_eligibility: Eligible
eligible_claim: CRDD Core Conformant
claim_record: <external claim artifact reference or null>
reviewed_at: <date-time>
reviewer: <human or agent reference>
```

Criteria Resultは`Conformant`、`Non-conformant`、`Not Evaluated`、`Not Applicable`を使用する。Finding Severityとは別の軸であり、Criteria ResultをSeverityへ置き換えない。

Findingは`criterion_id`を追加Fieldとして持ち、その他のFieldとSeverityは[`51_Document_Audit.md`](51_Document_Audit.md#32-finding-fields)に従う。

Conformance Result、Finding、EvidenceへCRDD標準Stable Context IDを新規発行しない。Audit Reportは対象Claim、Change Trace、Release Artifactから参照可能にし、Evidenceは対象Artifact内または最も近い親Folderの`Evidence/`へ置く。Root直下へ中央Conformance Folderを作らない。

---

# 13. Audit Completion and Claim Handoff

次を満たしたとき、Conformance Auditを完了できる。

```text
Target ScopeとRevisionが固定されている
評価に使用したCRDD / Criteria Revisionが固定されている
適用Profileと全適用Criteriaが列挙されている
全適用CriteriaにResultがある
Conformant Resultに再確認可能なEvidenceがある
Non-conformant / Not EvaluatedにFindingまたはBlocking理由がある
Not Applicableに適用外理由がある
Requested ClaimのEligibilityと理由が明示されている
Deviation、Open Question、再評価TriggerがHandoffされている
```

Audit完了はConformantまたはClaim発行を意味しない。`Not Eligible`または`Undetermined`を正しく返したReportも完了したAuditである。

Claim Ownerは`Eligible` Result、対象Scope / Revision、適用Profile、Evidence、既知Limit、再評価Triggerを確認してClaimを記録する。対象RevisionまたはCriteria Authorityが変わった場合、既存Claimを自動継承せず影響Criteriaを再評価する。

---

# 14. Final Principle

Conformance Auditは、CRDDらしく見えることではなく、対象ScopeとRevisionが適用CriteriaをEvidenceで満たすかを評価する。

Audit ResultとClaim発行を分けることで、Agentによる自己認定を防ぎ、準拠表明の責任を明確にする。
