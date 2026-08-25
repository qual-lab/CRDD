# 変更トレース: Agent Organization文書Architecture

- 変更ID: `CHG-000054`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Agent Organizationの基礎正本候補、Agent／Provider Orchestration Architecture、Coordinator Runtime実装README、用語集、Audit接続、配布ひな型およびv0.18候補入口
- 対象version: v0.18.0 Candidate
- 変更分類: `addition`（v0.18.0 Candidateへの基礎正本追加とConcept／Architecture／Implementationの責務分離。Released Baseline、Runtime動作またはReleaseは変更しない）
- 移行要否: `migration_required: false`
- 関連正本: [Agent Organization](../../04_Agent_Organization.md)、[Agent & Provider Orchestration](../../99_Roadmap/07_CRDD_v0_18_Agent_and_Provider_Orchestration.md)、[文書化](../../03_Documentation.md)、[Agent契約](../../10_Agent.md)

## 結論

`tools/coordinator/README.md`をAgent Organization、Cost、Independent ReviewまたはAuthorityの意味正本にしない。Agent Organizationをルートの`04_Agent_Organization.md`へ基礎正本候補として集約し、既存Agent & Provider Orchestrationを未完了の実行Architecture候補、`tools/coordinator`を現在の実装と強制方法へ限定する。

Authority、Human Authority、Independent Reviewおよび品質の既存決定権限は維持する。新しいAgent Organization文書はそれらを組織概念へ適用するCandidate基礎正本であり、文書のCandidate状態だけからReleased Baseline、準拠表明、特定Provider、固定Role、固定FlowまたはRuntime必須条件を成立させない。

## 着手前整合

- 受付: Agent Organizationを一つのMDへ分かりやすく集約し、Concept／Policy／ArchitectureをImplementation READMEから分離したいという人間判断。
- 基準改訂版: `5cea6d4`。Coordinator Runtimeのstatus-only独立確認、Document Audit、Gap／Impact AuditおよびConformance AuditはFinding 0で`Pass`。
- 変更する契約母集団: Agent Organizationの定義、概念責務、Architecture責務、Implementation READMEの責務表示、正式用語の境界表示。
- 既知の利用側母集団: Overview、Terminology、README日英v0.18候補入口、v0.18 Concept、Responsibility Boundary、PoC Profile 5、Operation Health、Agent & Provider Orchestration、Coordinator Runtime README、Conformance Audit、`template/AGENTS.md`、`template/CLAUDE.md`。
- 保持する意図: Human Authority、RoleとAuthorityの分離、Provider／Runtime非依存、不要なMulti-Agentの非必須、CostはEligible Set内だけで最適化、Provider差とReview独立性の分離、CoordinatorはHuman Authorityを取得しない。
- 目指さないこと: Runtime feature、固定Workflow、固定Provider mapping、新しいSchema、`Execution Slate`の正式用語化、専用Audit、Release、Migration。
- 必須確認: Agent／Architecture独立レビュー、Document Audit、Gap／Impact Audit、Conformance Audit。
- 非該当: 実装・Security・Release・Migration監査。コード、実行契約、Released Baselineまたは配布物を変更しないため。
- 経路変更: 初稿Audit後、人間の決定権限者がAgent OrganizationをFoundation帯の`04_Agent_Organization.md`へ置く方針を決定した。これにより、非規範Roadmap候補の新設からCandidate基礎正本の追加へ変更分類と利用側を再計算した。
- 停止条件: Released Baselineの変更、v0.18採用または準拠表明の確定、既存Runtime動作変更、Human Authority変更、または人間判断なしに一意化できない概念競合を検出した場合。

着手前整合確認の結果は`着手可`。用語・表現は日本語を主要表示とし、初出で正式英語名を併記する。Agent Organizationは複数文書で独立概念として使用され、固有の責務境界を持つため、同じ変更で用語集へ登録する。

## 専門探索と収束

判断を変え得る不確実性は、概念の配置、非規範／規範の強さ、既存Orchestration文書との重複、およびtools READMEに残すべき実装上の安全制約であった。

比較した案は次のとおりである。

1. `tools/coordinator/README.md`を中心のまま維持する案は、実装READMEを上流Contextや判断理由の暗黙正本にしないという文書化契約に反するため不採用。
2. `07 Agent & Provider Orchestration`だけを拡張する案は、Agent OrganizationのWhy／WhatとRouting／EligibilityのHowを同じ文書へ残し、将来別Runtimeから参照しにくいため不採用。
3. `99_Roadmap`へ概念本文を置く案は、未完了作業の登録簿を第二の正本にするため不採用。初稿ではこの案を採ったが、Document Audit、Gap／Impact AuditおよびConformance Auditの指摘により撤回した。
4. `00`–`09`のFoundation帯に`04_Agent_Organization.md`をCandidate基礎正本として置き、07を未完了Architecture候補、tools READMEをImplementationへ分ける案は、概念の抽象度と文書責務を一致させるため採用。

反証として、概念文書がAgent契約、Independent ReviewまたはAuthorityを再定義する危険と、実装READMEから安全条件を削りすぎる危険を確認した。前者は既存Coreを最終正本として直接参照し、後者は実装が強制する具体条件をREADMEへ保持しつつ意味正本ではないと明示して回避する。

専用のAgent Organization Auditを追加する案も確認したが、Agent契約と品質保証のIndependent Review、Document Audit、Conformance AuditおよびGap／Impact Auditで現在の適用条件、判定、根拠を扱えるため不採用とした。既存Auditで表現できない固有契約が生じた場合だけ再評価する。

## 代表例と境界

- 発火例: 複数Agent／ProviderへWorkを割り当てる場合、Agent Organizationの概念、07のEligibility／Routing、Runtimeの具体強制を順に参照する。
- 非発火例: 単一Agentで成立する通常Workへ、Agent Organizationを理由にCoordinator、別ProviderまたはIndependent Reviewを追加しない。
- 境界例: Cost／Credit分散はEligible Set内で比較できるが、Authority、Safety、Privacy、CapabilityまたはVerificationを弱めない。
- 判定情報不足例: AgentのCapability、独立性、Authorityまたは情報境界を確認できない場合、低Cost候補として選ばず既存の停止／Human Decisionへ戻す。

## 変更と確認

予定編集は、Foundation正本候補の新設、Terminology登録、Overview、README日英入口、v0.18候補文書、Conformance Audit、配布ひな型およびtools READMEの参照・責務更新、Roadmap内の重複削減である。Coordinator Runtimeのコード、試験、Threat Model、現在Gate、CHANGELOG、Issue #30、Release metadataおよび過去CHG履歴は変更しない。

初回固定前に、予定した契約母集団、利用側母集団、代表例、変更禁止範囲と実際の差分を照合する。固定改訂版へRepository全体Checkerを一度実行し、その共通結果を独立レビューと必須監査へ渡す。指摘事項があれば全監査結果を統合してから修正し、新しい固定改訂版を再確認する。

初稿のRepository全体CheckerはMarkdown 388件、local link 2211件、anchor 588件、Related block 26件、versioned document 26件、remediation row 74件を確認し、error 0／warning 0である。コード、Runtime契約、Threat Modelおよび試験の差分はない。

初稿固定改訂版`722fe6e`に対するAgent／Architecture独立レビューはFinding 0で`Pass`だった。一方、同じ固定改訂版に対するDocument Audit、Gap／Impact AuditおよびConformance Auditは、Roadmapを概念正本候補にしたこと、Responsibility Boundary／Orchestration／Operation Healthに概念重複を残したこと、再利用可能な用語定義へ具体versionを埋め込んだことを指摘し、`Fail`となった。この結果を統合し、Foundation正本候補への移設、利用側全数更新、重複縮約およびversion非依存化を一つの是正として実施する。初稿の監査結果を修正版の合格根拠へ流用しない。

是正後の固定前Repository全体CheckerはMarkdown 389件、local link 2234件、anchor 588件、Related block 27件、versioned document 27件、remediation row 74件を確認し、error 0／warning 0である。`09_CRDD_v0_18_Agent_Organization.md`は概念本文を持たない一時索引へ縮約し、CHG-000054の必須確認完了後に別の未完了作業がなければ削除する。

現在、人間による追加判断は必要ない。基礎正本候補の作成と責務分離は人間が承認済みだが、v0.18採用、統合またはReleaseは別判断である。
