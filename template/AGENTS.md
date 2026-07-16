# AGENTS.md

このRepositoryはCRDDで運用する。
CRDD詳細は `00_CRDD/` を正本とする。

Repository structure rules:

- Stable IDは`REQ`、`UX`、`IA`、`UI`、`SPEC`だけに使用する。
- Evidenceファイルは利用する成果物に最も近い親Folderの`Evidence/`へ置く。Root直下にEvidence Folderを作らない。
- Decisionの結果はCanonical Artifactへ反映し、理由・Evidence・代替案・経緯を同じArtifactへ残す。Root直下にDecision Folderを作らない。
- `01_Discovery`は新しいEvidence・不確実性・`REQ-*`の入口、`99_Roadmap`は採用済みだが未着手の計画Viewとする。
- Change Context PackageとImplementation Planは`07_Workflows/Changes/`へ置く。
- `40_Develop`にはCode・Configuration・Test等のImplementation Artifactを置き、CRDD管理用Markdownを置かない。

非自明な変更では、作業前に以下を読むこと。

- `00_CRDD/00_01_CRDD_Principles.md`
- `00_CRDD/00_13_Human_AI_Responsibility.md`
- `00_CRDD/00_14_AI_Change_Control.md`

Discovery、UX、IA、UI、Behavior Specification、Architectureを実行・監査する場合は、対象工程文書の`Phase Process Contract`を正本として読むこと。各工程のEntry、変換、責務Coverage、Exit、Gate、Auditを別文書やAgent Promptで再定義しない。

工程完了を宣言する前に、対象Scope全体のCoverage Stateを確認する。一部Artifactが完成していても未網羅項目があれば完了扱いしない。部分Handoffは、対象Scope、Gap、Risk、後続Ownerを人間が明示承認した場合に限る。Handoffは受信工程の`Phase Entry Contract`を満たすこと。

Protected areas:
- `00_CRDD`
- `02_UX`
- 重要判断が反映されたApproved Canonical ArtifactとDecision / Rationale Section

Protected areasに影響する場合は、実装前にAI Work Planを出し、人間判断へ戻すこと。

## Subagent Use

Guided Skillに複数の独立成果物、大量Evidence、または独立Reviewが必要な場合、限定ScopeのSubagentへ委譲してよい。

Subagentを使う場合は `00_CRDD/00_50_Subagent_Orchestration.md` に従うこと。

SubagentはProposal / Findingを返せるが、Decision確定、Approved Contextへの昇格、Canonical Artifactの直接更新は行わない。

最終統合、Human Review提示、正本文書更新はParent Agentが行う。

CRDD文書体系、README / Overview / CHANGELOG、Related Link、Status、文書採番、安定ID、Traceabilityに影響する変更では、必要に応じて `00_CRDD/00_51_Document_Audit_Agent.md` に基づくCRDD Document Audit Agentを使う。
