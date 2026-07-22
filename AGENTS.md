# CRDD Standard Repository AI Entry

このRepositoryはCRDD標準自身を管理する。Projectへ配布するStarter Ruleは`template/AGENTS.md`であり、本書はQual-Lab / CRDD公式RepositoryのMaintenance Adapterである。採用Repositoryへ同じIssue、Branch、Pull Request、Label、Agent構成を要求しない。

## Authority and Context Selection

CRDD標準のMaintenanceでは、最初に次を確認する。

- [`19_Maintenance.md`](19_Maintenance.md)
- 変更対象Propertyを所有するCanonical Document
- 対象Scope、Base Revision / Baseline、Expected Result、Preserved Intent / Non-goal
- Human Decision済みの範囲と未決事項
- Change Classification、Migration Need、必要なReview / Audit

IssueまたはTaskが存在する場合は、本文、Comment、Status、関連Pull Request、Base Revisionを確認する。明らかなEditorial Changeでは、Humanから与えられたTaskとCommit等から同じ情報を取得できれば、新しいIssueを機械的に要求しない。Issue、Label、Assignment、ProposalだけからExecution Authorization、Adoption、Releaseを推定しない。

`Related` HeaderはRead Setの上限ではない。Authority、直接参照、参照元、Template、README / Overview / CHANGELOG、Public Intake Adapter等、変更の意味と影響を判定するために必要なContextを追加で読む。

## Language and Readability

- 利用者への説明、質問、判断支援は、利用者の主要ロケールで行う。
- CRDD用語は初出時に「ローカル表示名（Canonical English Term）」で示し、同じ節で英語名を不必要に繰り返さない。
- 結論と要点を先に示し、並列事項、条件、選択肢、完了条件は箇条書きまたは表で分ける。
- 専門用語だけで説明を完結させず、Product、利用者、運用への影響を平易に説明する。
- Canonical Term、Stable Context ID、Agent ID、File名、Schema Key / Value、Codeは無断で翻訳または変更しない。
- 規範の強さを示す場合は、[Documentation](03_Documentation.md#48-normative-language)の日本語表示とBCP 14 Keywordの対応に従う。

## Decision and Action Boundary

Triage Disposition、Execution Authorization、Adoption / Integration Decision、Release Decisionを区別する。

AIは承認されたScopeで調査、比較、Draft、編集、検証、Finding提示を行えるが、次を自己決定しない。

- Protected Changeの採用または最終統合
- Authority、Conformance、Stable Context ID Semanticsの変更
- Risk AcceptanceまたはBreaking Changeの解除
- Pull Requestの最終承認
- Version、Release Scope、Releaseの確定

Scope外変更、Classificationの重大化、Authority競合、複数解釈可能なHuman Decision、未確認Migration、Baseline変更、Security / Privacy / Legal Risk、必要Access不足を検出した場合は、安全に得た結果と未決事項を残して停止または再Triageする。

## Change and Branch Boundary

Protectedまたは非自明な変更は、原則としてBranchとPull Requestを使用し、作成・変更担当から分離したReviewerへ渡す。Human Authorityが明示したRelease、緊急Correction、または限定操作は、Repository Rule、対象Scope、Base Revision、必要な記録に従って実行できる。

Pull Requestを使う場合も、MergeをReleaseとみなさない。統合後は`Integrated — Pending Release`、`Released`、`Close without Release`のいずれかを、対象VersionまたはRelease Plan Referenceとともに返す。

## Review, Audit, and Completion

Change Classification、Authority、影響範囲、Riskに応じて適用するReviewとAuditを選ぶ。すべての変更へ全Auditを機械的に要求しない。

- 文書構造、Link / Anchor、用語、Authority、重複、Header、Version、Related、直接Propagationは[`51_Document_Audit.md`](51_Document_Audit.md)
- CRDD Conformance CriteriaまたはClaim Eligibilityへの影響は[`52_Conformance_Audit.md`](52_Conformance_Audit.md)
- 複数正本、工程、Consumer、Migration、Relation横断Impactは[`53_Gap_Impact_Audit.md`](53_Gap_Impact_Audit.md)
- CRDD標準自身のVersion、Migration、Correction、Release Closureは[`19_Maintenance.md`](19_Maintenance.md)

非自明またはProtectedな変更ではIndependent Reviewを行う。Findingは責務を持つArtifactで修正し、更新Revisionを再Reviewする。Audit Run完了、FindingへのOwner付与、Pull Request作成だけをPassまたはAdoptionとみなさない。

完了時は、変更内容、理由、影響、Validation / Audit Result、Migration、残Risk、Human Decisionが必要な点、Release Dispositionを取得可能にする。既存の未関連変更、公開済みTag、過去CHANGELOGを無断で巻き戻しまたは書き換えない。
