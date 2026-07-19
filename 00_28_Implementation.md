# CRDD Implementation

Version: v0.4.1
Status: Stable
Owner: Qual-Lab
Skill ID: `skill.implementation.realize`
Last Updated: 2026-07-19
Related:
- [00_01_Principles.md](00_01_Principles.md)
- [00_02_Terminology.md](00_02_Terminology.md)
- [00_03_Documentation.md](00_03_Documentation.md)
- [00_10_Agent.md](00_10_Agent.md)
- [00_11_Skill.md](00_11_Skill.md)
- [00_12_Change.md](00_12_Change.md)
- [00_25_UI.md](00_25_UI.md)
- [00_26_Behavior_Specification.md](00_26_Behavior_Specification.md)
- [00_27_Architecture.md](00_27_Architecture.md)
- [00_29_Verification.md](00_29_Verification.md)
- [00_51_Document_Audit.md](00_51_Document_Audit.md)
- [00_52_Conformance_Audit.md](00_52_Conformance_Audit.md)
- [00_53_Gap_Impact_Audit.md](00_53_Gap_Impact_Audit.md)

---

> Implementationを適用するProjectでは、本書の`Phase Process Contract`をImplementation工程内の正本として使用する。

# 1. Purpose and Boundary

Implementationは、承認済みContext、Behavior Specification、Architecture、および該当するChange Traceを、Code、Configuration、Migration、Developer Test、Build Artifactへ変換する工程である。

```text
Architecture   = 実装が従うBoundary、Contract、Constraint、Ruleを定義する
Implementation = それらを実行可能Artifactへ具体化する
Verification   = 対象RevisionでContractが成立したか独立して確認する
```

動くCodeは上位ContractやArchitectureの代替ではない。実装中に不足、矛盾、成立不能、未承認変更を発見した場合は、Codeで暗黙解決せず、Observed Fact、Impact、Optionを該当Authorityへ戻す。

Implementation Exitは`Ready for Verification`であり、`Verified`または`Accepted`ではない。

---

# Phase Process Contract

本章はImplementation工程の入口、変換、責務Coverage、出口、Phase Gate、Auditの正本である。後続章は本ContractをArtifact、Developer Test、Skill実行へ具体化し、独自の完了条件を持たない。

## Phase Entry Contract

Implementationは対象Scopeについて次を受け取る。

- 該当するChange Traceと対象Revision / Baseline
- 承認済みUI Contract / Behavior Specification
- Architecture Boundary、Implementation / Coding Rule、禁止事項
- Data / Interface / Security / Operation Contract
- Compatibility / Migration / Rollback、Capacity / Resource Constraint
- Acceptance CriteriaとVerification Obligation
- Environment、Dependency、Build / Deployment条件
- Coverage Summary、Unresolved Gap、人間Review結果

部分Handoffの場合は、承認されたScope、未決事項、暫定制約、Risk、後続Owner、人間承認も必要である。Source間にConflictがある場合は、優先順位を推測して実装しない。

## Transformation Contract

承認済みContextを、Code、Configuration、Schema / Data Migration、Dependency / Build定義、Executable Rule、Developer Test、Generated / Package Artifact、Implementation Evidenceへ変換する。

ImplementationはBehavior、Acceptance、Authority、Data Meaning、Security Boundary、Compatibility / Capacity Behaviorを新しく決めない。変更が必要な場合は、該当するSPEC、UI、Architecture、ChangeまたはHuman Decisionへ戻す。

## Required Responsibility Coverage

対象Scopeについて次の責務を適用範囲で判定する。

| Responsibility | Implementationで明らかにすること |
|---|---|
| Scope and Trace | Change Trace、UI / SPEC、Architecture、Acceptance、変更対象へのTrace |
| Code and Boundary | Module、Dependency Direction、公開Interface、禁止Boundaryの遵守 |
| Configuration / Environment | Default、Environment差分、Secret参照、Feature / Runtime設定 |
| Data / Interface | Schema、Serialization、Validation、API / Event Contract、Source of Truthの遵守 |
| Behavior / Failure | Success、Failure、Recovery、Permission、Cancel、Fallback、Side Effect |
| Concurrency / Resource | Idempotency、Transaction、Timeout、Retry、Contention、Quota、Cleanup |
| Security / Privacy / AI | Guard、Data Minimization、Authority、Consent、External Action、Audit |
| Migration / Compatibility | Migration Code、Deploy順序、Rollback、既存Data / Consumer保護 |
| Dependency / Build | Version、Lock、License / Security Constraint、Build / Package、生成物 |
| Observability / Operation | Log、Metric、Trace、Alert用Signal、診断可能な状態 |
| Developer Test / Check | Unit / Component / Contract / Integration、Regression、Static / Build Check |
| Deviation and Handoff | Actual Impact、Known Limitation、Evidence、Verification Obligation、Unresolved Gap |

すべてを全変更へ機械的に要求しない。適用しない責務は`Not Applicable`として理由と人間確認を残す。主要Happy Pathの動作や一部Test Passだけで対象Scope全体を完了扱いしない。

## Scope and Coverage State

各Implementation Obligationを、`Complete for Scope`、`Partial — Human Authorized`、`Blocked`、`Not Started`、`Not Applicable`で追跡する。

ScopeにはCodeだけでなく、Configuration、Data、Migration、Generated Artifact、Dependency、Test、Consumer、Environmentを含める。変更していないLayerも、影響を受けるならCoverage対象である。

## Human Decisions

人間はScope変更、上位Contract変更、Architecture Boundary変更、重大Dependency追加、不可逆Migration、Security / Privacy Risk、Compatibility破壊、Cost / Schedule Trade-off、Risk受容、部分Handoffを決定する。

AIまたはImplementation担当は実装案、Rule案、Test、Deviation、Impactを提示できるが、これらを自己承認しない。

## Exit and Handoff

通常のVerification Handoffは、対象Scopeが`Complete for Scope`で、人間Reviewを通過し、Build / Static Checkと必要なDeveloper Testが成功し、[`00_29_Verification.md`](00_29_Verification.md#phase-entry-contract)の受信条件を満たす場合に限る。

Handoffでは、Target Scope / Revision、変更Artifact、適用したArchitecture Rule、Developer Test / Check結果、実行 / 再現方法、Environment、Migration / Rollback、Deviation、Known Limitation、Implementation Evidence、Verification Obligation、Coverage State、Unresolved Gapを渡す。

部分Handoffには、未実装・未確認Scope、Risk、暫定処置、受信先、後続Ownerの人間承認を必要とする。`Implemented`を`Verified`として渡さない。

## Phase Gate Criteria

- Change Trace、UI / SPEC、Architecture、AcceptanceへTraceできる
- Code、Configuration、Migration、Dependency、Developer Testが対象Scopeで整合している
- Architecture Boundary、Implementation Rule、Security / Data Contractを遵守している
- Success、Failure、Recovery、Permission、Concurrency、Observabilityを適用範囲で実装している
- Build、Static Check、必要なDeveloper Testが対象Revisionで成功している
- Compatibility、Migration、Rollback、Resource Constraintを適用範囲で実装・確認している
- Target Revision、Environment、実行方法、Deviation、Known Limitationが特定されている
- Scope変更、上位変更、Risk受容、部分Handoffを人間判断へ戻している

## Phase Audit Checklist

- Codeが上位ContractまたはArchitectureを無言で置換している
- Testを通すためにAcceptance、Guard、Contractを弱めている
- Codeだけを変更し、Configuration、Migration、Generated Artifact、Test、Consumer影響が追従していない
- Error、Permission、Recovery、Concurrency、Cleanup、Observabilityの実装漏れ
- 共有Component、Schema、API変更の既存Data / Consumer / Layer影響漏れ
- 実装固有Ruleが正本化されず、会話またはCode内だけに存在する
- Developer Test結果または実装者確認を独立Verificationとして扱っている
- Coverage Summary、Deviation、Known Limitation、Implementation Evidenceの欠落

---

# 2. Implementation Model

## 2.1. Rule Authority and Artifact Placement

Project固有のCoding RuleとImplementation RuleのCanonical Markdownは`06_Architecture`へ置く。ArchitectureはRuleの意味、適用Scope、理由、禁止事項、例外承認、検査方法を所有する。

`40_Develop`またはProjectの通常実装領域には、Source Code、Test Code、Configuration、Migration、Build / Package定義、Linter / Formatter / Compiler設定、Generated Artifactを置く。CRDD管理用Markdownの配置先にしない。

Implementation担当は不足Ruleの案とRationaleを`06_Architecture`の該当Artifactへ提案・追記してよい。ただし、Boundary、Technology、Dependency、Security、Data、Compatibility等を変えるRuleは、Architecture AuthorityとHuman Reviewなしに確定しない。

```text
Ruleの意味とAuthority = Architecture / Human
Code・Test・強制設定   = Implementation
適合性と成立の判定    = Verification / Human
```

Linter、Formatter、Type Checker、Static Analyzer、Build Check等の実行可能な強制手段はImplementation Artifactとして配置し、対応するArchitecture RuleへTraceする。

## 2.2. Scope, Impact, and Change Discipline

変更前に、直接変更するArtifactと、影響を受けるModule、Screen、Consumer、Data、Interface、Configuration、Migration、Test、Operationを特定する。共有Component、Schema、API、Ruleの変更は、局所変更として扱わない。

Mechanical MigrationとSemantic Changeを同じBatchへ無自覚に混在させない。混在する場合は差分、Review順序、Rollback、Verificationを分離して説明し、該当CHGのExpected / Actual Impactへ反映する。重複Logicを発見した場合は、意味上のAuthorityと影響を確認し、共通責務へ統合するか、分離理由を残す。

実装中にScope外変更が必要になった場合は、ついでに変更せずChange ScopeとImpactを更新する。

## 2.3. Code, Configuration, Build, and Runtime

CodeはArchitecture Boundary、Dependency Direction、Data / Interface Contract、Error / Logging Ruleに従う。ConfigurationはEnvironment差分、Default、Override、Secret参照、Feature FlagのAuthorityを明確にし、Codeと設定の組み合わせを再現可能にする。利用者・組織向けPreference / Policy / SettingのOption、Default、Precedence、変更効果は承認済みSPECを実現し、Implementationで新しく決めない。Technical ConfigurationはArchitectureのBoundaryとRuleに従う。

Dependencyは必要なVersionを宣言・固定し、Build / Packageが対象Revisionから再現できるようにする。Generated Code / ArtifactはSource、生成手順、更新条件を追跡し、手修正と再生成の競合を避ける。

Hot Reload対象外のProcess、Cache、Generated Code、Migration、Build Artifact等を変更した場合は、変更が反映された実RuntimeまたはBuild ArtifactでDeveloper Checkを行う。この確認は独立Verificationの代替ではない。

## 2.4. Behavior, State, Failure, and Resource Control

Happy Pathだけでなく、Boundary、Empty、Unknown、Failure、Permission、Conflict、Stale、Retry、Cancel、Concurrent Execution、Dependency停止を適用範囲で実装する。

Idempotency、Transaction、Lock、Queue、Timeout、Backoff、Cleanup、Graceful Shutdown、Partial Failure、Backpressureは、SPECとArchitectureが定めるBehavior / Recovery Contractに従う。実装しやすさを理由にAtomicityやRecovery Meaningを変更しない。

複数Layerをまたぐ変更では、DB、API、Event / IPC、UI、External Providerの実際のData FlowをDeveloper Testで確認する。特定LayerのUnit Testだけで全体成立を推測しない。

## 2.5. Migration, Compatibility, and Rollback

MigrationはSchema / Data変換だけでなく、Code、Configuration、Consumer、Deploy順序、Backfill、Feature Flag、Rollbackを一つの実行Sequenceとして扱う。

既存DataとConsumerを使ったDeveloper Testを行い、再実行、部分失敗、中断、旧新Version共存を適用範囲で確認する。破壊的変更やRollback不能が判明した場合は、暫定Codeで隠さずArchitecture / Change Trace / Human Decisionへ戻す。

## 2.6. Governance, Security, Privacy, and AI Enforcement

Consent、Permission、Data Boundary、External Action Authorityは、該当ScopeのUI表示だけでなく実行経路のGuardとして実装する。

- UI、API、Batch、Queue、Retry、Admin Pathで同じAuthorityを強制する
- 許可されたDataだけを取得・保存・送信する
- External DataとTrusted Instructionを構造的に分離する
- Action Scope、Target、Amount、Rate、Time、Costを実行時に検証する
- Source、Actor、Approval、Execution、ResultをAudit可能にする
- Guardの判定不能時BehaviorをSPEC / Architectureどおりに実装する

SecurityまたはPrivacy RuleをTestしにくいことを理由にGuardを省略したり、Default-on Boundaryを無断でFeature Flagから無効化したりしない。不足ContractはSPEC / Architectureへ戻す。

## 2.7. Developer Test and Independent Verification

Implementation担当は、変更を成立させるDeveloper TestをCodeとともに作成・更新する。

| Purpose | Implementation Responsibility |
|---|---|
| Logic and State | Unit / Component Test、Boundary / Failure / Regression |
| Contract | API / Event / Schema / Consumer Contract Test |
| Integration | 変更したLayer、Data Flow、External BoundaryのIntegration Test |
| Migration | 既存Data、再実行、Rollback、旧新共存のDeveloper Test |
| Executable Rule | Static Check、Build、Type / Security / Dependency Check |
| Runtime | 対象Build / ProcessでのDeveloper Smoke Check |

Testの技術形式だけではImplementationとVerificationを区別できない。同じE2EやIntegration Testでも、実装を支えるDeveloper Testと、対象Revisionに対する独立Acceptance / AssuranceではAuthorityとEvidenceが異なる。

VerificationはDeveloper Testを再実行・再利用してよいが、実装者の成功報告だけで成立判定しない。Implementation担当も、Acceptance / E2Eという名称だけを理由にTest作成をVerificationへ丸投げしない。

Test CodeはImplementation Artifactとして`40_Develop`またはProjectの通常Test配置へ置く。Test Purpose、対象Contract、Fixture、Environment、Revisionを追跡可能にする。

## 2.8. Trace, Evidence, Decision, and Deviation

ImplementationへCRDD標準Stable Context IDを新規発行しない。Source `REQ-*` / `UX-*` / `IA-*` / `UI-*` / `SPEC-*`、Architecture、Change Trace、VerificationとはArtifact Reference、Commit、Pull Request、Test Result等で接続する。

Implementation Evidenceは対象Revision、Environment、Command / Procedure、Result、Artifact Locationを識別できるようにし、対象Artifact内または最も近い親Folderの`Evidence/`へ置く。Verification EvidenceとはAuthorityとPurposeを区別する。

Architectureや上位Contractを変えるDecisionをImplementation Noteだけで確定しない。実装固有の選択、Deviation、Known Limitationは、結果となるCode / Configurationと、Change Trace、Pull Request、Canonical Architecture Artifact等の適切な既存Artifactへ理由、Impact、Evidence、Ownerを残す。

`40_Develop`へCRDD管理用Markdownを新設しない。

---

# 3. Guided Skill Adapter

## 3.1. Runtime Authority

`skill.implementation.realize`は、本書のPhase Process Contractを[`00_11_Skill.md`](00_11_Skill.md)のRun Lifecycle、Guided Interaction、Human Review、Handoffに従って実行するImplementation固有Adapterである。本書ではRun Status、Pause / Resume、共通Question Rule、Subagent Lifecycleを再定義しない。

## 3.2. Implementation-specific Progression

| Step | Transformation | Output |
|---|---|---|
| Load | Change Trace、UI / SPEC、Architecture、Rule、Target Revisionを対応づける | Implementation Coverage Queue |
| Impact | Direct Changeと影響Artifact、Data、Consumer、Testを特定する | Impacted Scope |
| Implement | Code、Configuration、Migration、Executable Ruleを具体化する | Implementation Artifact |
| Exercise | Developer Test、Static / Build Check、Runtime Checkを行う | Implementation Evidence |
| Reconcile | Deviation、Known Limitation、Actual Impactを正本へ戻す | Updated Context / Proposal |
| Handoff | Revision、Environment、Evidence、Verification Obligationを渡す | Ready for Verification |

ファイル数、差分量、Test数を進捗とみなさず、Required Responsibility Coverageと対象Scopeで判定する。

## 3.3. Stop, Return, and Escalation

次の場合は実装を停止または承認済みScopeへ限定し、該当Authorityへ戻す。

| Condition | Route |
|---|---|
| SPECとArchitectureが矛盾、Acceptanceが観測不能 | SPEC / Architecture / Human Decision |
| Architecture RuleまたはBoundaryが不足 | Architecture |
| 安全なMigration / Rollbackが成立しない | Architecture / Change Trace / Human Decision |
| Secret、Permission、Environmentが不足 | Environment Owner / Human Authority |
| Scope外の共有Component変更が必要 | Change Trace / Impact Review |
| Security / Privacy / Compatibilityを弱める必要がある | Relevant Authority / Human Decision |
| Resource / Cost制約でCapacity Behaviorを満たせない | Architecture / SPEC / Human Decision |
| 新しいBusiness Ruleが必要 | Discovery / SPEC / Human Decision |

暫定実装でConflictを隠さず、Observed Fact、Impact、Option、Recommendation、必要なHuman Decisionを返す。

## 3.4. Agent and Subagent Use

AgentまたはSubagentへ委譲する場合は[`00_10_Agent.md`](00_10_Agent.md)に従い、Module、Migration、Developer Test、Impact調査等の限定Scopeを渡す。

Parent Agentは変更Scope、禁止変更、Target Revision、Expected Output、Verification Obligationを明示し、結果をCanonical Contextへ統合して該当Change Traceへ接続する。Subagent Resultをそのまま`Verified`またはHuman Decisionにしない。

---

# 4. Review, Handoff View, and Feedback

## 4.1. Implementation-specific Human Review

人間Reviewでは少なくとも次を確認する。

- 上位ContractとArchitectureをCode都合で弱めていない
- 変更Scopeと共有Artifact、Data、ConsumerへのImpactが一致している
- Security、Migration、Compatibility、CapacityのRiskを隠していない
- Developer Testが変更したBehavior、Failure、Boundaryを扱っている
- Deviation、Known Limitation、未実装Scopeが明確である
- `Ready for Verification`を`Verified`としていない

## 4.2. Implementation Artifact / Handoff View

Artifactの分割方法は固定しないが、対象Scopeについて次を参照可能にする。

```text
Target Scope / Revision / Baseline
Source Change Trace / UI / SPEC / Architecture
Changed Code / Configuration / Migration / Dependency / Build
Implemented Obligation / Architecture Rule Applied
Developer Test / Static / Build / Runtime Check Result
Environment / Execution / Reproduction Method
Migration / Rollback / Compatibility
Deviation / Known Limitation / Actual Impact
Implementation Evidence
Verification Obligation
Coverage State / Unresolved Gap / Human Review
```

Verification HandoffはこのViewを縮小再掲して受信条件を減らさず、Canonical Artifactへの参照とCoverage State付きで渡す。

## 4.3. Feedback from Implementation

実装から得た成立条件、技術制約、Failure Mode、実測値、Dependency制約、Migration Riskは、Architecture、SPEC、UI、ChangeへFindingまたはProposalとして戻す。

Implementation担当に上位Artifactの編集権限があっても、意味上のAuthorityを代替しない。上位変更が承認されるまで、Codeを新しい正本として扱わない。

Verification Findingは原因に応じてImplementationへ戻る。修正後はTarget RevisionとImplementation Evidenceを更新し、以前のVerification Resultを自動的にPassへ変更しない。

---

# 5. Final Principle

Implementationは、設計をCodeへ写して終わる工程ではない。

上位Contractを守って実行可能Artifactへ変換し、実装から得た学びを正しいAuthorityへ戻し、独立して検証できる状態を作る。
