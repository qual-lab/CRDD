# 変更トレース: Agent Organization文書Architecture

- 変更ID: `CHG-000054`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Agent Organizationの概念正本候補、Agent／Provider Orchestration Architecture、Coordinator Runtime実装README、用語集およびv0.18候補入口
- 対象version: v0.18.0 Candidate
- 変更分類: `clarification`（非規範Concept／Architecture／Implementationの責務分離。Released Baseline、準拠、Runtime動作は変更しない）
- 移行要否: `migration_required: false`
- 関連正本: [Agent Organization候補](../../99_Roadmap/09_CRDD_v0_18_Agent_Organization.md)、[Agent & Provider Orchestration](../../99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)、[文書化](../../03_Documentation.md)、[Agent契約](../../10_Agent.md)

## 結論

`tools/coordinator/README.md`をAgent Organization、Cost、Independent ReviewまたはAuthorityの意味正本にしない。v0.18非規範Concept候補としてAgent Organizationを一文書へ集約し、既存Agent & Provider Orchestrationを実行Architecture、`tools/coordinator`を現在の実装と強制方法へ限定する。

Authority、Human Authority、Independent Reviewおよび品質の規範正本は既存Core契約を維持する。新しいAgent Organization文書はそれらを組織概念へ適用する非規範候補であり、Released Baseline、準拠基準、特定Provider、固定Role、固定FlowまたはRuntime必須条件を追加しない。

## 着手前整合

- 受付: Agent Organizationを一つのMDへ分かりやすく集約し、Concept／Policy／ArchitectureをImplementation READMEから分離したいという人間判断。
- 基準改訂版: `5cea6d4`。Coordinator Runtimeのstatus-only独立確認、Document Audit、Gap／Impact AuditおよびConformance AuditはFinding 0で`Pass`。
- 変更する契約母集団: Agent Organizationの定義、概念責務、Architecture責務、Implementation READMEの責務表示、正式用語の境界表示。
- 既知の利用側母集団: README日英v0.18候補入口、v0.18 Concept、Responsibility Boundary、PoC Profile 5、Agent & Provider Orchestration、Coordinator Runtime README、Terminology。
- 保持する意図: Human Authority、RoleとAuthorityの分離、Provider／Runtime非依存、不要なMulti-Agentの非必須、CostはEligible Set内だけで最適化、Provider差とReview独立性の分離、CoordinatorはHuman Authorityを取得しない。
- 目指さないこと: Runtime feature、固定Workflow、固定Provider mapping、新しいSchema、`Execution Slate`の正式用語化、新しい準拠基準、Release、Migration。
- 必須確認: Agent／Architecture独立レビュー、Document Audit、Gap／Impact Audit、Conformance Audit。
- 非該当: 実装・Security・Release・Migration監査。コード、実行契約、Released Baselineまたは配布物を変更しないため。
- 停止条件: Root規範文書の意味変更、v0.18準拠条件化、既存Runtime動作変更、Authority変更、または人間判断なしに一意化できない概念競合を検出した場合。

着手前整合確認の結果は`着手可`。用語・表現は日本語を主要表示とし、初出で正式英語名を併記する。Agent Organizationは複数文書で独立概念として使用され、固有の責務境界を持つため、同じ変更で用語集へ登録する。

## 専門探索と収束

判断を変え得る不確実性は、概念の配置、非規範／規範の強さ、既存Orchestration文書との重複、およびtools READMEに残すべき実装上の安全制約であった。

比較した案は次のとおりである。

1. `tools/coordinator/README.md`を中心のまま維持する案は、実装READMEを上流Contextや判断理由の暗黙正本にしないという文書化契約に反するため不採用。
2. `07 Agent & Provider Orchestration`だけを拡張する案は、Agent OrganizationのWhy／WhatとRouting／EligibilityのHowを同じ文書へ残し、将来別Runtimeから参照しにくいため不採用。
3. 新しいRoot規範文書へ昇格する案は、v0.18候補の採用、準拠およびReleased Baseline変更を先取りするため不採用。
4. v0.18非規範Concept候補を新設し、07をArchitecture、tools READMEをImplementationへ分ける案は、現在の候補強度を維持しながら責務を一意にできるため採用。

反証として、概念文書がAgent契約、Independent ReviewまたはAuthorityを再定義する危険と、実装READMEから安全条件を削りすぎる危険を確認した。前者は既存Coreを最終正本として直接参照し、後者は実装が強制する具体条件をREADMEへ保持しつつ意味正本ではないと明示して回避する。

残存不確実性は、v0.18採用時にAgent OrganizationをRoot規範へ昇格するか、07と統合するかである。これは現在の非規範候補整理を妨げず、v0.18採用判断時に再評価する。

## 代表例と境界

- 発火例: 複数Agent／ProviderへWorkを割り当てる場合、Agent Organizationの概念、07のEligibility／Routing、Runtimeの具体強制を順に参照する。
- 非発火例: 単一Agentで成立する通常Workへ、Agent Organizationを理由にCoordinator、別ProviderまたはIndependent Reviewを追加しない。
- 境界例: Cost／Credit分散はEligible Set内で比較できるが、Authority、Safety、Privacy、CapabilityまたはVerificationを弱めない。
- 判定情報不足例: AgentのCapability、独立性、Authorityまたは情報境界を確認できない場合、低Cost候補として選ばず既存の停止／Human Decisionへ戻す。

## 変更と確認

予定編集は、Concept候補の新設、Terminology登録、v0.18候補4文書とREADME日英入口の参照更新、07とtools READMEへの責務境界追加である。Coordinator Runtimeのコード、試験、Threat Model、現在Gate、CHANGELOG、Issue #30、Release metadataおよび過去CHG履歴は変更しない。

初回固定前に、予定した契約母集団、利用側母集団、代表例、変更禁止範囲と実際の差分を照合する。固定改訂版へRepository全体Checkerを一度実行し、その共通結果を独立レビューと必須監査へ渡す。指摘事項があれば全監査結果を統合してから修正し、新しい固定改訂版を再確認する。

初稿のRepository全体CheckerはMarkdown 388件、local link 2211件、anchor 588件、Related block 26件、versioned document 26件、remediation row 74件を確認し、error 0／warning 0である。コード、Runtime契約、Threat Modelおよび試験の差分はない。

現在、人間による追加判断は必要ない。概念正本候補の作成と責務分離は人間が承認済みだが、v0.18採用、統合、Releaseまたは将来の規範昇格は別判断である。
