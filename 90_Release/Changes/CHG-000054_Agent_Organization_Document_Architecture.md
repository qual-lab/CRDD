# 変更トレース: エージェント組織の文書アーキテクチャ

変更ID: `CHG-000054`
- 状態: `Reopened`
- 決定権限者: Qual-Lab
- 最終更新日: 2026-08-29
- 対象version: v0.18.0 Candidate
- 変更分類: `normative`
- 移行要否: `migration_required: true`
- 概念正本: [`04_Agent_Organization.md`](../../04_Agent_Organization.md)
- 自律Operation Architecture: [`05_Autonomous_Operation.md`](../../05_Autonomous_Operation.md)
- 実装案内: [`tools/coordinator/README.md`](../../tools/coordinator/README.md)
- 統合台帳: [未リリース変更トレース統合台帳](README.md)

## 1. 結論

CRDDの中心概念であるエージェント組織（Agent Organization）を、特定Providerや`tools/coordinator`の実装から分離し、ルートの基礎正本へ集約した。READMEの「AIの開発チーム」「AIに専門性と実行を、人間にアイデア・判断・責任を」というVisionは、この概念の利用者向け入口であり独立したRelease価値ではないため、旧`CHG-000045`を本変更へ統合した。

文書責務は次へ固定する。

| 層 | 正本／入口 | 所有する意味 |
|---|---|---|
| 利用者向け入口 | `README.md`の英語／日本語節 | CRDDが目指すAI開発チーム、人間とAIの役割、採用時に何が変わるか |
| 概念・規範候補 | `04_Agent_Organization.md` §1～§11、§13～§15 | Role、Specialty、Delegation、Independence、Cost、Authority、Human boundary、Provider independence |
| 非規範実行Architecture | `04_Agent_Organization.md` §12 | Execution Slate、Eligibility、Optimization、Context Projection、Fallback、Execution provenance |
| 自律Operation Architecture | `05_Autonomous_Operation.md` | 再評価、Operation Contract、Effect、安全、健全性、将来互換 |
| Runtime実装 | `tools/coordinator/README.md` | build、run、Adapter、Docker、Native、State、Recovery、試験 |
| 準拠判定 | `52_Conformance_Audit.md`のAD-22 | エージェント組織を使用するときの横断基準 |

同じ概念を各文書で再定義せず、入口と実装は正本へ参照する。

## 2. 人間／AIの基本境界

```text
AI: Specialized execution / analysis / verification
Human: Idea / value / decision authority / accountability
```

人間がコードを書くことを開発の前提とせず、AIがUX、UI、Architecture、Implementation、TestおよびReview等の専門性を分担するHuman Coding-less Developmentを目指す。ただし、AIの能力、役割、利用可能性または自己申告から決定権限を推定しない。人間は重要判断、外部Effect、Risk Acceptance、受入および結果への責任を保持する。

この境界の上位目的を[`01_Principles.md`](../../01_Principles.md#2-purpose-and-core-belief)へ統合した。AIへの実行委譲は人間の思考代替ではなく、問い、違和感、仮説、価値判断および学びへ集中する余地を作る。AIは人間が自分の意見を育てる思考支援になり得るが、永続的な依存を目的にしない。個人やProjectで得た学びを、特定の優秀な個人へ依存しない再利用可能な組織能力へ変え、HumanとAIが自ら課題探索・要求形成、判断、実行および学びを回せる状態を成功条件とする。

## 3. エージェント組織の境界

- Agent Organizationは単純なparent／subagent関係、固定Workflowまたは常時Multi-Agentを意味しない。
- Role、Specialty、Capability、Work Assignment、Delegation、Independent Review、Execution SlateおよびCoordinatorを必要な範囲で編成する。
- RoleとAuthorityを分け、Executor、ReviewerまたはCoordinatorという役割だけからRepository、External Send、PromotionまたはFinancial Effectの権限を成立させない。
- 不要なAgentを起動せず、品質成立条件を満たすEligible Set内でCostを最適化する。Costのために独立ReviewやAuthorityを弱めない。
- Codex、Claude Codeおよび将来Providerから独立し、Coordinator Runtimeは概念を実装する一候補として扱う。
- Provider同士の直接spawn、無制限な再帰委譲、Authority cycle、Cost amplificationおよびAIへの無制限Authorityを非目標とする。

## 4. 採用した文書構造

初稿ではRoadmapと`tools/coordinator/README.md`へ概念、Policy、Architectureおよび実装が分散していた。監査結果に基づき次へ収束した。

1. Roadmapは未完了の方向・順序・到達点だけを所有し、概念正本にしない。
2. `tools/coordinator/README.md`からCost、Independent Review、Authority、人間境界等の上位意味を`04_Agent_Organization.md`へ移す。
3. 実行Architectureは概念正本の非規範§12へ置き、具体的なProcess、Docker、Provider CLI、StateおよびRecoveryはtoolsへ残す。
4. 自律Operationの旧分割文書を`05_Autonomous_Operation.md`へ統合し、空wrapperや番号埋め文書を残さない。
5. 用語集は短い定義と正本導線を所有し、特定versionのCurrent Stateを一般定義へ埋め込まない。
6. README、Overview、配布`template/AGENTS.md`、AuditおよびCHANGELOG候補を同じ責務方向へ更新する。

`04`へ`05`を全統合しない。`04`は「AIチームをどう編成・統治するか」、`05`は「そのチームがどう安全にOperationするか」を所有し、規範強度、変更頻度、採用単位およびレビュー範囲を分ける。

## 5. README Visionの統合

旧`CHG-000045`が所有した公開入口の意図を本変更へ統合する。

- CRDDは「Context Repositoryを使ったAI Coding」だけでなく、「AIの開発チームを成立させるための開発手法」であることを冒頭で示す。
- AIは専門性と実行・検証を担い、人間はアイデア、判断、責任へ集中する。
- AIは人間の思考を置き換えず、人間自身の仮説形成と学びを支援し、個人の学びを組織能力へ接続する。
- 通常のAI Codingとの差を、Context、判断履歴、専門工程および工程間依存をRepositoryで共有する点として示す。
- CRDD自身と実Projectでdogfoodingしていることを、将来Visionだけでなく現在の実践として示す。
- Runtimeの現在利用可能範囲、Trust／Provisioning／Recovery詳細をREADME冒頭へ展開せず、三層の導線で圧縮する。

このVisionは人間の責任をAIへ移さず、特定Provider、Runtime実装またはv0.18のRelease状態を概念へ固定しない。

## 6. 規範・準拠・移行

AD-22は、既存AD-04／07／08／11を再定義せず、エージェント組織に固有のRole／Authority分離、委譲、独立性、Cost、人間境界およびProvider非依存性を横断確認する。

採用側はv0.18を採用するとき、次を評価する。

- エージェント組織を使用するか。使用しない場合はAD-22の該当範囲を理由付きで非該当とする。
- Agent、Role、Authority、Delegation、Independent ReviewおよびHuman Decision Boundaryが既存Projectで重複・競合しないか。
- 旧Roadmap、独自Glossaryまたはtools READMEを概念正本として参照していないか。
- Runtimeを使用する場合、概念採用とRuntime有効化・Provider認証・External Sendを別判断として扱っているか。

移行を延期する場合は以前固定したv0.17.xを維持する。Candidate文書の存在、Checker合格またはRuntime実装だけで採用、準拠、統合、Stable化またはReleaseを成立させない。

## 7. 実装発展とEvidence

旧`CHG-000045`の旧filename、原文Hash、固定Git改訂版、統合理由およびEvidence有無は[統合台帳](README.md#consolidated-chg-000045)へ固定する。旧全文は固定Git改訂版から取得できる。

本変更の主要な監査発展は次である。

- 初稿: Roadmapを概念正本候補にし、概念重複とversion依存定義を残したためFail。
- 基礎配置是正: `04_Agent_Organization.md`へ移したが、AD-22、README三層導線、locale-first、規範分類および移行影響が不足。
- 規範是正: AD-22とCHANGELOG候補を追加したが、統合集合の最大分類、変更説明面およびChecker命名契約の後続追跡を追加是正。
- 責務是正: `04`／`05`／tools／Roadmapを分離し、旧自律Operation文書を`05`へ統合。
- 最終固定版`91d0709bf892646527a3f4396f2d7c5da444079d`: Security／Conformance、Document、Gap／Impact／利用導線監査がFinding 0でPass。

過去固定版のPassは当時版の履歴であり、本CHG統合改訂版の現在判定へ流用しない。

## 8. 現在の検証義務

1. 単一READMEの英語／日本語節、Overview、Terminology、`04`、`05`、tools README、AD-22、template、CHANGELOG候補の一方向導線を全数確認する。
2. 概念・Policyの重複定義、旧分割文書、空wrapper、Roadmap内の完了済み本文および用語集のversion固有Current Stateが0であることを確認する。
3. `04`の規範／非規範強度と参照元表示、`04`／`05`の採用単位、Runtime実装との差を確認する。
4. 旧`CHG-000045`が台帳から本CHGへ一意に到達し、IDを再利用していないことを確認する。
5. Repository全体Checker、Checker契約試験、関連package checkおよび`git diff --check`を実行する。
6. 最新固定改訂版へArchitecture、Security／Conformance、DocumentおよびGap／Impact監査を再実行する。

## 9. 対象外とRelease処置

本変更はCoordinator RuntimeのProvider Adapter、Docker、Native、Authority発行、Runtime State、Recoveryまたは実Provider送信を変更しない。それらは[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)が所有する。

Issue #30のclose、v0.18採用、統合、Stable化、tagまたはReleaseは人間の別判断である。本変更は未リリースであり、最新改訂版の全確認後にRelease統合へ引き渡す。現在、この統合方針について追加の人間判断は必要ない。
