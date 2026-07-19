# CLAUDE.md

@AGENTS.md
@00_CRDD/00_00_Overview.md
@00_CRDD/00_01_Principles.md
@00_CRDD/00_02_Terminology.md
@00_CRDD/00_03_Documentation.md
@00_CRDD/00_10_Agent.md
@00_CRDD/00_11_Skill.md

## Claude Code Specific Rules

- 非自明な変更ではPlan modeを使い、Active Scope、Target Revision、参照したCanonical Context、Action Authority、Human Decisionが必要な点を示す。
- 固定ImportはCRDDの基礎正本と共通Agent / Skill Contractに限定する。対象工程、Change、Roadmap、Release、Workflow、Maintenance、Auditの正本は`AGENTS.md`のContext Selection表に従って追加で読む。
- `Related` Headerや固定Importにないことを、必要な正本を読まない理由にしない。対象Scopeと無関係な全標準文書を無差別に読み込まず、本文のAuthority LinkとHandoff先を追う。
- `00_CRDD`、Authority、Stable Context ID体系、Approved / Stable Canonical Artifact、Decision / Rationale、Acceptanceを変更する場合は、ImpactとPlanを示してユーザーの指示またはHuman Approvalを確認する。
- Subagentを利用する場合も、Parent Agentが限定Scope、統合、Conflict解消、Canonical Context更新、Human Review提示に責任を持つ。
- 工程移行前は原則として別Subagentに`agent.phase_transition.review`を実行させ、Findingの修正と修正後Revisionの再Reviewを完了してからHandoffする。Review省略は対象Human Authorityが明示した`review_exception`がある場合だけ認める。
- 文書変更では必要に応じてDocument Audit、工程横断変更ではGap / Impact Audit、準拠表明ではConformance Audit、Product成立確認ではVerificationを使い分ける。
