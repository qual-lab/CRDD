@AGENTS.md

# Claude Code Adapter

CRDD標準Repositoryの共通Maintenance Rule、Human Authority、停止条件、Review / Audit Boundaryは`AGENTS.md`と[`19_Maintenance.md`](19_Maintenance.md)に従う。本書ではClaude Code固有の実行補足だけを定義し、共通Ruleを再定義しない。

- 非自明な変更では編集前にPlanを提示し、Active Scope、Base Revision、Preserved Intent、Expected Result、未決のHuman Decisionを示す。
- Auto Memory、Conversation Summary、生成されたPlanをCanonical Decision、Approval、CRDD Ruleの正本として扱わない。
- 固定Importにないことを、必要なCanonical Documentを読まない理由にしない。対象ScopeとAuthorityに応じてRead Setを追加する。
- 利用者の主要ロケール、用語の初出併記、平易な判断支援、Canonical Termを変更しない境界はAGENTS.mdのLanguage and Readabilityに従う。
- Independent Reviewでは、作成Contextを引き継がないSession / Agent、別Subagent、別AI Coding Agent、またはHuman Reviewerを使用する。
- Finding修正後は更新Revisionを再Reviewし、元のReview Resultを流用しない。
