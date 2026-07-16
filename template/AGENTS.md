# AGENTS.md

このRepositoryはCRDDで運用する。
CRDD詳細は `00_CRDD/` を正本とする。

非自明な変更では、作業前に以下を読むこと。

- `00_CRDD/00_01_CRDD_Principles.md`
- `00_CRDD/00_13_Human_AI_Responsibility.md`
- `00_CRDD/00_14_AI_Change_Control.md`

Protected areas:
- `00_CRDD`
- `02_UX`
- `95_Decisions`

Protected areasに影響する場合は、実装前にAI Work Planを出し、人間判断へ戻すこと。

## Subagent Use

Guided Skillに複数の独立成果物、大量Evidence、または独立Reviewが必要な場合、限定ScopeのSubagentへ委譲してよい。

Subagentを使う場合は `00_CRDD/00_50_Subagent_Orchestration.md` に従うこと。

SubagentはProposal / Findingを返せるが、Decision確定、Approved Contextへの昇格、Canonical Artifactの直接更新は行わない。

最終統合、Human Review提示、正本文書更新はParent Agentが行う。

CRDD文書体系、README / Overview / CHANGELOG、Related Link、Status、採番、Traceabilityに影響する変更では、必要に応じて `00_CRDD/00_51_Document_Audit_Agent.md` に基づくCRDD Document Audit Agentを使う。
