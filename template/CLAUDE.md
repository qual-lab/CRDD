# CLAUDE.md

@AGENTS.md
@00_CRDD/00_01_CRDD_Principles.md
@00_CRDD/00_13_Human_AI_Responsibility.md
@00_CRDD/00_14_AI_Change_Control.md
@00_CRDD/00_50_Subagent_Orchestration.md
@00_CRDD/00_51_Document_Audit_Agent.md

## Claude Code Specific Rule

非自明な変更ではPlan modeを使う。
00_CRDD、02_UX、重要判断が反映されたApproved Canonical Artifactを変更する場合は、必ず人間承認を求める。
Subagentを利用する場合も、Parent Agentが統合責任を持ち、Canonical Artifactの更新とHuman Review提示を行う。
CRDD文書体系、README / Overview / CHANGELOG、Related Link、Status、文書採番、安定ID、Traceabilityに影響する変更では、必要に応じてCRDD Document Audit Agentを使う。
