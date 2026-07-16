# AGENTS.md

このRepositoryはCRDDで運用する。CRDD標準文書は`00_CRDD/`を正本とする。

## Authority and Context Selection

非自明な作業では、最初に次の基礎正本を読む。

```text
00_CRDD/00_00_Overview.md
00_CRDD/00_01_Principles.md
00_CRDD/00_02_Terminology.md
00_CRDD/00_03_Documentation.md
00_CRDD/00_10_Agent.md
00_CRDD/00_11_Skill.md
```

`Related` Headerは直接関係する正本への探索導線であり、実行時Read Setの上限ではない。Active Scope、Target Revision、実行主体、対象工程、Change / Release / Workflow、Auditの必要性に応じて次を追加する。

| Scope / Activity | Required Authority |
|---|---|
| Change Trigger、Impact、実装・検証・Closeの追跡 | `00_CRDD/00_12_Change.md` |
| Product Release、配布・有効化 | `00_CRDD/00_13_Release.md` |
| `07_Workflows`の反復可能な作業手順 | `00_CRDD/00_14_Workflow.md` |
| CRDD標準自体の変更・Version・Migration | `00_CRDD/00_19_Maintenance.md` |
| Discovery | `00_CRDD/00_21_Discovery.md` |
| UX | `00_CRDD/00_22_UX.md` |
| IA | `00_CRDD/00_23_IA.md` |
| UIまたはBehavior Specification | `00_CRDD/00_24_UI_Behavior_Specification.md`と、`00_25_UI.md`または`00_26_Behavior_Specification.md` |
| Architecture | `00_CRDD/00_27_Architecture.md` |
| Implementation | `00_CRDD/00_28_Implementation.md` |
| Verification | `00_CRDD/00_29_Verification.md` |
| 文書品質・参照・重複の監査 | `00_CRDD/00_51_Document_Audit.md` |
| CRDD準拠の評価 | `00_CRDD/00_52_Conformance_Audit.md` |
| 工程横断Gap / Impactの探索 | `00_CRDD/00_53_Gap_Impact_Audit.md` |

対象Scopeと無関係な全標準文書を毎回読み込む必要はない。ただし、対象工程のEntry、Source Context、Handoff先、本文から参照されるAuthorityを確認し、必要な正本を未読のまま推定で代替しない。

## Repository Structure Rules

- Repository構造、Artifact記法、Evidence、Decision / Rationale、Stable Context ID、Artifact Reference、Traceabilityは`00_CRDD/00_03_Documentation.md`に従う。
- Stable Context IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`だけに使用する。Document Number、`CHG-*`、Architecture、Decision、Evidence、Implementation、Test、Verificationへ流用しない。
- Evidenceは利用する成果物内または最も近い親Folderの`Evidence/`へ置く。Repository Rootに中央Evidence Folderを作らない。
- Decisionの結果は結果となるCanonical Artifactへ反映し、理由、Evidence、Alternative、Historyを同Artifactへ残す。Repository Rootに中央Decision Folderを作らない。
- `01_Discovery`は新しいEvidence、不確実性、Requirementの入口とする。`99_Roadmap`は採用済みだが未着手のRequirementやContextを参照する計画Viewとし、Roadmap項目へCRDD Stable Context IDを付与しない。
- Change Traceは`90_Release/Changes/CHG-*.md`へ置く。`CHG-*`はChange TraceのArtifact IDであり、Stable Context IDではない。
- `07_Workflows`にはRepository固有の反復可能な作業手順を置き、Change TraceやRelease Recordを置かない。
- `40_Develop`にはCode、Configuration、Migration、Build、Test等のImplementation Artifactを置き、CRDD管理用Markdownを置かない。

## Phase Execution and Handoff

Discovery、UX、IA、UI、Behavior Specification、Architecture、Implementation、Verificationを実行・監査する場合は、対象工程文書のProcess Contractを正本とする。Entry、Transformation、Required Responsibility Coverage、Exit、Phase Gate Criteria、Audit ChecklistをPrompt、Workflow、Agent定義で再定義しない。

UIとBehavior Specificationは直列ではない。`00_24_UI_Behavior_Specification.md`を共有Contractとして、`00_25_UI.md`と`00_26_Behavior_Specification.md`を相互参照しながら並行して進める。

工程完了を、ファイル作成、Artifactの高い完成度、Skill Run終了、Implementation完了、Test Passから推定しない。対象Scope全体のCoverage Stateを確認する。部分Handoffは、対象Scope、残るGap、Risk、Owner、Reopen条件を記録し、Human Authorityが明示承認した場合に限る。Handoffは受信工程のEntry Contractを満たさなければならない。

上流Contextの不足・矛盾・変更が判明した場合、下流Artifactで補完して確定せず、該当工程とHuman Authorityへ戻す。ImplementationまたはVerificationから得たLearning、Finding、Deviationは、責務を持つCanonical Contextと必要なChange Traceへ還元する。

## Action and Approval Boundary

- AIは指定されたAction AuthorityとActive Scopeの範囲内で、分析、Draft、編集、実装、Test、Auditを行える。
- AIはHuman Authorityが必要な意味、Priority、Scope、Risk受容、Phase Handoff、Release、Conformance Claimを自己承認しない。
- `00_CRDD`、Authority、Stable Context ID体系、Approved / Stable Canonical Artifact、Decision / Rationale、Acceptanceを変更する場合は、作業前にImpactとPlanを示し、ユーザーの指示またはHuman Approvalを確認する。
- 特定Folderだけを一律に保護対象とみなさない。Status、Property Authority、内容、Risk、変更Scopeで判断する。
- 既存の未関連変更を削除・巻き戻し・整形しない。文書統合や削除では情報移管、参照元、Template、README / Overview / CHANGELOGへの影響を確認する。

## Agent and Subagent Use

AgentまたはSubagentを使う場合は`00_CRDD/00_10_Agent.md`に従う。Guided Skillは`00_CRDD/00_11_Skill.md`と対象工程のSkill Adapterに従う。

Subagentへは限定Scope、Input、Target Revision、Expected Output、禁止Action、Evidence、Return条件を渡す。SubagentはProposal、Draft、Finding、Evidenceを返せるが、Human Decision、Phase Handoff、Risk受容、Release、Conformance Claimを自己承認しない。

Parent AgentはResult比較、Conflict解消、統合、Canonical Contextへの反映、Human Reviewへの接続に責任を持つ。Subagent Result、Summary、Test PassだけをVerifiedまたはApprovedとして扱わない。

## Completion and Audit

変更後は対象Scopeに応じて、文書Link / Anchor、用語、Authority、Coverage、Trace、Test、Verificationを確認する。

- 文書体系、README / Overview / CHANGELOG、Related、Header、Document Number、Stable Context ID、Traceabilityに影響する場合は`00_CRDD/00_51_Document_Audit.md`を使用する。
- CRDD準拠またはConformance Claimを評価する場合は`00_CRDD/00_52_Conformance_Audit.md`を使用する。
- 複数工程、共有Artifact、Consumer、Data、Releaseへ影響する場合は`00_CRDD/00_53_Gap_Impact_Audit.md`を使用する。
- Productの成立確認は`00_CRDD/00_29_Verification.md`に従い、Document AuditやConformance Auditで代替しない。
