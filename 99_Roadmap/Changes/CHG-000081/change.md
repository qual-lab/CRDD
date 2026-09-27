# UI／SPEC Detail工程契約

変更ID: `CHG-000081`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.22.0`
変更分類: `design_completeness_contract_extension`

## 現在状態

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | Workbench PilotのG1〜G5、Visual実測、新MeaningのArchitecture／Qualityまでの伝播およびPhase 6独立レビューを完了し、Detail Contract固定候補を成立させた |
| 対象改訂版 | v0.21.0を基準版とするv0.22作業ブランチ |
| 成立済み | UI／SPEC Definition、N:N対応レビュー、可視Checklist、Architecture／Qualityへの引き渡し |
| 未成立 | 未実装CapabilityのReality Audit／実装／Evidence、反復根拠に基づくCMP発行 |
| Phase／Gate適用判断 | `Applicable`: 規則、ひな型、自己適用、独立レビューを分けて確認する |
| 現在Phase | `Phase 6 — Detail Contract Freeze Passed` |
| 現在Gate | `Detail Contract固定候補／独立レビューFinding 0` |
| 次のGate | 未実装Capabilityを未観測のままReality Audit／実装へ渡し、Secondary Screenの実装反復からPattern／CMP昇格の根拠を評価する |

## 契機 / 起点

| 項目 | 記載内容 |
|---|---|
| 種別 | v0.21自己適用から得た工程契約の不足 |
| 情報源 | v0.21 UI／SPEC成果物、v0.22 Design Completeness構想、人間によるArea Design Guide判断 |
| 理由 | Definitionから実装可能な画面、視覚表現および詳細挙動へ落とすCanonicalな層がない |
| 起点となる探索（EXP） | N/A: 本変更はCRDD工程契約の自己適用是正であり、v0.22プロダクトDiscoveryの代替ではない |
| 対象要求（REQ） | N/A: Workbench要求を先取りせず、工程契約だけを変更する |
| 不具合／監査是正の場合の逸脱契約 | UI／SPEC DefinitionからArchitectureへ渡す間の具体化責務が横断文書へ分散している |
| ロードマップ参照 | [v0.22](../../01_Roadmap.md) |
| 情報源コンテキストの改訂版 | v0.21.0 Release |
| 人間による着手判断の参照 | 本変更の会話上の着手指示 |

## 主な変更意図

UI／SPECへ`Analysis → Definition → Detail`を導入し、UI Area、Logical Screen、Screen Part、Reusable Component、Visual BaselineおよびDetailed Behaviorを、Definitionの意味を失わず具体化できるようにする。

WorkbenchのWIP、画面案または既存実装を正解として逆算しない。一般工程契約をDraft化し、v0.21成果物への適用評価と独立レビューを完了した後、v0.22 Discoveryで採用した意味だけをWorkbench Pilotへ入力した。PilotではG1〜G5を順に通過し、Direction A、画面構成およびDetail Relationを契約固定候補として検証した。これらはPilot Designの採用であり、Production実装完成の主張ではない。

## 現在状態と構造変更

| 項目 | 変更前 | 変更後 |
|---|---|---|
| UI | Analysis → UI Definition | Analysis → UI Definition → UI Detail |
| SPEC | Analysis → SPEC Definition | Analysis → SPEC Definition → SPEC Detail |
| UI／SPEC対応 | `UI-*` ⇄ `SPEC-*` | Definition対応に加え、`SCR／PRT／Interaction` ⇄ `BHV-*`を確認 |
| 視覚設計 | 横断文書内で方針と成果物を扱う | Screen Inventory後にHeroを選び、複数案から人間がVisual Baselineを決める |
| Area | 表示面の分類 | 画面一覧だけでなくArea固有のデザインガイドラインを所有する |
| v0.21成果物 | Definition完了を当時の契約で評価 | Release成立は維持し、新Detail契約への適用状態を別に全数評価する |

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`04_UI/Details/Visual/workbench-hero/direction-a.html`](../../../04_UI/Details/Visual/workbench-hero/direction-a.html)
- [`04_UI/Details/Visual/workbench-hero/direction-a.png`](../../../04_UI/Details/Visual/workbench-hero/direction-a.png)
- [`04_UI/Details/Visual/workbench-hero/project-portfolio.html`](../../../04_UI/Details/Visual/workbench-hero/project-portfolio.html)
- [`04_UI/Details/Visual/workbench-hero/project-portfolio.png`](../../../04_UI/Details/Visual/workbench-hero/project-portfolio.png)
- [`04_UI/Details/Visual/workbench-hero/repository-worktree.html`](../../../04_UI/Details/Visual/workbench-hero/repository-worktree.html)
- [`04_UI/Details/Visual/workbench-hero/repository-worktree.png`](../../../04_UI/Details/Visual/workbench-hero/repository-worktree.png)
- [`04_UI/Details/Visual/workbench-hero/topic-detail.html`](../../../04_UI/Details/Visual/workbench-hero/topic-detail.html)
- [`04_UI/Details/Visual/workbench-hero/topic-detail.png`](../../../04_UI/Details/Visual/workbench-hero/topic-detail.png)
- [`04_UI/Definitions/UI-000006/ui_definition.md`](../../../04_UI/Definitions/UI-000006/ui_definition.md)
- [`04_UI/Definitions/UI-000008/ui_definition.md`](../../../04_UI/Definitions/UI-000008/ui_definition.md)
- [`04_UI/Definitions/UI-000009/ui_definition.md`](../../../04_UI/Definitions/UI-000009/ui_definition.md)
- [`04_UI/Details/05_Workbench_Secondary_Expansion.md`](../../../04_UI/Details/05_Workbench_Secondary_Expansion.md)
- [`04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md`](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md)
- [`04_UI/Details/Areas/project-context/SCR-000006/screen.md`](../../../04_UI/Details/Areas/project-context/SCR-000006/screen.md)
- [`04_UI/Details/Areas/project-context/SCR-000009/screen.md`](../../../04_UI/Details/Areas/project-context/SCR-000009/screen.md)
- [`05_SPEC/Definitions/SPEC-000012/spec_definition.md`](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md)
- [`05_SPEC/Definitions/SPEC-000013/spec_definition.md`](../../../05_SPEC/Definitions/SPEC-000013/spec_definition.md)
- [`05_SPEC/Details/BHV-000012/behavior.md`](../../../05_SPEC/Details/BHV-000012/behavior.md)
- [`05_SPEC/Details/BHV-000013/behavior.md`](../../../05_SPEC/Details/BHV-000013/behavior.md)
- [`05_SPEC/Details/BHV-000031/behavior.md`](../../../05_SPEC/Details/BHV-000031/behavior.md)
- [`06_Architecture/02_Component_and_Responsibility_Model.md`](../../../06_Architecture/02_Component_and_Responsibility_Model.md)
- [`06_Architecture/08_UI_SPEC_Detail_Traceability.md`](../../../06_Architecture/08_UI_SPEC_Detail_Traceability.md)
- [`06_Architecture/Analysis/SPEC-000012/architecture_analysis.md`](../../../06_Architecture/Analysis/SPEC-000012/architecture_analysis.md)
- [`06_Architecture/Analysis/SPEC-000013/architecture_analysis.md`](../../../06_Architecture/Analysis/SPEC-000013/architecture_analysis.md)
- [`06_Architecture/Analysis/SPEC-000031/architecture_analysis.md`](../../../06_Architecture/Analysis/SPEC-000031/architecture_analysis.md)
- [`06_Architecture/Analysis/UI-000008/architecture_analysis.md`](../../../06_Architecture/Analysis/UI-000008/architecture_analysis.md)
- [`06_Architecture/Analysis/UI-000009/architecture_analysis.md`](../../../06_Architecture/Analysis/UI-000009/architecture_analysis.md)
- [`06_Architecture/Definitions/ARCH-000006/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000006/architecture_definition.md)
- [`06_Architecture/Definitions/ARCH-000009/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000009/architecture_definition.md)
- [`06_Architecture/Definitions/ARCH-000013/architecture_definition.md`](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md)
- [`06_Architecture/Details/crdd-domain-library/01_Architecture.md`](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md)
- [`06_Architecture/Details/cros/01_Architecture.md`](../../../06_Architecture/Details/cros/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`07_Quality/03_Verification_Design.md`](../../../07_Quality/03_Verification_Design.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Analysis/Detail/quality_analysis.md`](../../../07_Quality/Analysis/Detail/quality_analysis.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Definitions/QA-000007/quality_definition.md`](../../../07_Quality/Definitions/QA-000007/quality_definition.md)
- [`40_Develop/visual-preview/src/browser-zoom-verifier.ts`](../../../40_Develop/visual-preview/src/browser-zoom-verifier.ts)
- [`99_Roadmap/Changes/CHG-000081/Evidence/260927-1323_visual-browser-zoom.md`](Evidence/260927-1323_visual-browser-zoom.md)
- [`24_UI_Behavior_Specification.md`](../../../24_UI_Behavior_Specification.md)
- [`03_Documentation.md`](../../../03_Documentation.md)
- [`15_Progress.md`](../../../15_Progress.md)
- [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)
- [`01_Discovery/Analysis/EXP-000029/consumer_comparison.md`](../../../01_Discovery/Analysis/EXP-000029/consumer_comparison.md)
- [`01_Discovery/Analysis/EXP-000029/capability_map.md`](../../../01_Discovery/Analysis/EXP-000029/capability_map.md)
- [`01_Discovery/Analysis/EXP-000032/exploration.md`](../../../01_Discovery/Analysis/EXP-000032/exploration.md)
- [`01_Discovery/Definitions/REQ-000039/requirement.md`](../../../01_Discovery/Definitions/REQ-000039/requirement.md)
- [`01_Discovery/Analysis/EXP-000033/exploration.md`](../../../01_Discovery/Analysis/EXP-000033/exploration.md)
- [`01_Discovery/Definitions/REQ-000040/requirement.md`](../../../01_Discovery/Definitions/REQ-000040/requirement.md)
- [`02_UX/01_User_Experience.md`](../../../02_UX/01_User_Experience.md)
- [`02_UX/02_Personas.md`](../../../02_UX/02_Personas.md)
- [`02_UX/03_Experience_Map.md`](../../../02_UX/03_Experience_Map.md)
- [`02_UX/04_Service_Blueprint.md`](../../../02_UX/04_Service_Blueprint.md)
- [`02_UX/05_Quality_Expectations.md`](../../../02_UX/05_Quality_Expectations.md)
- [`02_UX/Analysis/REQ-000039/ux_analysis.md`](../../../02_UX/Analysis/REQ-000039/ux_analysis.md)
- [`02_UX/Analysis/REQ-000040/ux_analysis.md`](../../../02_UX/Analysis/REQ-000040/ux_analysis.md)
- [`02_UX/Definitions/UX-000033/ux_definition.md`](../../../02_UX/Definitions/UX-000033/ux_definition.md)
- [`02_UX/Definitions/UX-000034/ux_definition.md`](../../../02_UX/Definitions/UX-000034/ux_definition.md)
- [`03_IA/01_Information_Architecture.md`](../../../03_IA/01_Information_Architecture.md)
- [`03_IA/Analysis/UX-000033/ia_analysis.md`](../../../03_IA/Analysis/UX-000033/ia_analysis.md)
- [`03_IA/Analysis/UX-000034/ia_analysis.md`](../../../03_IA/Analysis/UX-000034/ia_analysis.md)
- [`03_IA/Definitions/IA-000006/ia_definition.md`](../../../03_IA/Definitions/IA-000006/ia_definition.md)
- [`03_IA/Definitions/IA-000007/ia_definition.md`](../../../03_IA/Definitions/IA-000007/ia_definition.md)
- [`03_IA/Definitions/IA-000010/ia_definition.md`](../../../03_IA/Definitions/IA-000010/ia_definition.md)
- [`03_IA/Definitions/IA-000023/ia_definition.md`](../../../03_IA/Definitions/IA-000023/ia_definition.md)
- [`AGENTS.md`](../../../AGENTS.md)
- [`CLAUDE.md`](../../../CLAUDE.md)
- [`25_UI.md`](../../../25_UI.md)
- [`26_Behavior_Specification.md`](../../../26_Behavior_Specification.md)
- [`04_UI/01_User_Interface.md`](../../../04_UI/01_User_Interface.md)
- [`04_UI/05_UI_SPEC_Handoff.md`](../../../04_UI/05_UI_SPEC_Handoff.md)
- [`04_UI/Details/01_UI_Detail.md`](../../../04_UI/Details/01_UI_Detail.md)
- [`04_UI/Details/02_Workbench_Screen_Architecture.md`](../../../04_UI/Details/02_Workbench_Screen_Architecture.md)
- [`04_UI/Details/03_Workbench_Hero_Selection.md`](../../../04_UI/Details/03_Workbench_Hero_Selection.md)
- [`04_UI/Details/04_Workbench_Visual_Exploration.md`](../../../04_UI/Details/04_Workbench_Visual_Exploration.md)
- [`05_SPEC/01_Behavior_Specification.md`](../../../05_SPEC/01_Behavior_Specification.md)
- [`05_SPEC/06_UI_SPEC_Correspondence.md`](../../../05_SPEC/06_UI_SPEC_Correspondence.md)
- [`05_SPEC/Details/01_SPEC_Detail.md`](../../../05_SPEC/Details/01_SPEC_Detail.md)
- [`05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md`](../../../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)
- [`06_Architecture/01_Architecture.md`](../../../06_Architecture/01_Architecture.md)
- [`06_Architecture/Details/runtime-data/01_Architecture.md`](../../../06_Architecture/Details/runtime-data/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`16_Quality_Assurance.md`](../../../16_Quality_Assurance.md)
- [`27_Architecture.md`](../../../27_Architecture.md)
- [`40_Develop/checker/src/profiles/current-profile.ts`](../../../40_Develop/checker/src/profiles/current-profile.ts)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts)
- [`40_Develop/runtime-data/src/core/runtime-data-contract.ts`](../../../40_Develop/runtime-data/src/core/runtime-data-contract.ts)
- [`40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts`](../../../40_Develop/runtime-data/tests/unit/runtime-data-contract.contract.test.ts)
- [`00_Overview.md`](../../../00_Overview.md)
- [`04_UI/Details/Visual/workbench-hero/workbench-hero.css`](../../../04_UI/Details/Visual/workbench-hero/workbench-hero.css)
- [`04_UI/Details/Visual/workbench-hero/visual-baseline.md`](../../../04_UI/Details/Visual/workbench-hero/visual-baseline.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/Details/visual-preview/01_Architecture.md`](../../../06_Architecture/Details/visual-preview/01_Architecture.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`40_Develop/checker/template-tools-tsconfig.json`](../../../40_Develop/checker/template-tools-tsconfig.json)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](../../../40_Develop/verification-runner/src/catalog/test-catalog.ts)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts)
- [`40_Develop/visual-preview/bin/visual-preview.ts`](../../../40_Develop/visual-preview/bin/visual-preview.ts)
- [`40_Develop/visual-preview/package.json`](../../../40_Develop/visual-preview/package.json)
- [`40_Develop/visual-preview/package-lock.json`](../../../40_Develop/visual-preview/package-lock.json)
- [`40_Develop/visual-preview/src/index.ts`](../../../40_Develop/visual-preview/src/index.ts)
- [`40_Develop/visual-preview/src/preview-server.ts`](../../../40_Develop/visual-preview/src/preview-server.ts)
- [`40_Develop/visual-preview/symbol.json`](../../../40_Develop/visual-preview/symbol.json)
- [`40_Develop/visual-preview/tsconfig.json`](../../../40_Develop/visual-preview/tsconfig.json)
- [`40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts`](../../../40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts)
- [`40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts`](../../../40_Develop/visual-preview/tests/integration/browser-lifecycle.contract.test.ts)
- [`template/tools/crdd-visual-preview.ts`](../../../template/tools/crdd-visual-preview.ts)
- [`template/04_UI/01_User_Interface.md`](../../../template/04_UI/01_User_Interface.md)
- [`template/04_UI/05_UI_SPEC_Handoff.md`](../../../template/04_UI/05_UI_SPEC_Handoff.md)
- [`template/04_UI/Details/01_UI_Detail.md`](../../../template/04_UI/Details/01_UI_Detail.md)
- [`template/04_UI/Details/Areas/AREA-NAME/area.md`](../../../template/04_UI/Details/Areas/AREA-NAME/area.md)
- [`template/04_UI/Details/Areas/AREA-NAME/SCR-XXXXXX/screen.md`](../../../template/04_UI/Details/Areas/AREA-NAME/SCR-XXXXXX/screen.md)
- [`template/04_UI/Details/Components/CMP-XXXXXX/component.md`](../../../template/04_UI/Details/Components/CMP-XXXXXX/component.md)
- [`template/04_UI/Details/Visual/visual_baseline.md`](../../../template/04_UI/Details/Visual/visual_baseline.md)
- [`template/05_SPEC/01_Behavior_Specification.md`](../../../template/05_SPEC/01_Behavior_Specification.md)
- [`template/05_SPEC/06_UI_SPEC_Correspondence.md`](../../../template/05_SPEC/06_UI_SPEC_Correspondence.md)
- [`template/05_SPEC/Details/01_SPEC_Detail.md`](../../../template/05_SPEC/Details/01_SPEC_Detail.md)
- [`template/05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md`](../../../template/05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)
- [`template/05_SPEC/Details/BHV-XXXXXX/behavior.md`](../../../template/05_SPEC/Details/BHV-XXXXXX/behavior.md)
- [`template/06_Architecture/01_Architecture.md`](../../../template/06_Architecture/01_Architecture.md)
- [`template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md`](../../../template/06_Architecture/Definitions/ARCH-XXXXXX/architecture_definition.md)
- [`template/06_Architecture/Details/area/01_Architecture.md`](../../../template/06_Architecture/Details/area/01_Architecture.md)
- [`template/07_Quality/01_Quality_Center.md`](../../../template/07_Quality/01_Quality_Center.md)
- [`template/07_Quality/04_Quality_Integration.md`](../../../template/07_Quality/04_Quality_Integration.md)
- [`template/07_Quality/Analysis/PHASE/quality_analysis.md`](../../../template/07_Quality/Analysis/PHASE/quality_analysis.md)
- [`template/AGENTS.md`](../../../template/AGENTS.md)
- [`template/CLAUDE.md`](../../../template/CLAUDE.md)
- [`template/PROJECT_CONTEXT.md`](../../../template/PROJECT_CONTEXT.md)
- [`.crdd/config/repository-manifest.json`](../../../.crdd/config/repository-manifest.json)
- [`template/.crdd/config/repository-manifest.example.json`](../../../template/.crdd/config/repository-manifest.example.json)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000081/change.md`](change.md)

</details>

## 想定する影響

- コンテキスト: UI、SPEC、UI／SPEC対応、Architecture、Quality
- 成果物: UI／SPEC正本、ひな型、CRDD自己適用成果物
- 利用者 / 運用: 画面と詳細挙動をDefinitionから再現しやすくする
- データ / インターフェース / 移行: v0.21 Definitionは維持し、Detail適用台帳で移行状態を追跡する
- セキュリティ / プライバシー / コスト: 新しい外部Effectなし。成果物数増加はID発行基準とApplicability評価で抑制する

## 対象外 / 変更してはならないこと

- 着手時の対象外: Workbenchの要求、画面構成およびVisual Directionの先取り
- 現在も対象外: Workbench Production実装の完成、未実装Capabilityの成立主張、CMPの根拠なき発行
- 現在の対象: v0.22 Discoveryで採用済みの意味を用いたWorkbench Pilotの画面構成、Direction AおよびUI／SPEC Detail Contractの固定可否
- 変更してはならないこと: v0.21 Releaseの成立状態、既存`UI-*`／`SPEC-*`の意味、WIPをCanonical入力へ昇格しない境界

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 複数工程、ひな型、既存成果物へ影響する | 独立レビュー前に再確認 |
| 変更する契約母集団 | Applicable | UI／SPEC正本、ひな型、UI 20件、現在のSPEC 30件 | 適用台帳で全数確認 |
| 既知の利用側母集団と対象別の予定処置 | Applicable | Architecture、Quality、採用Repository | 引き渡し契約とひな型を更新 |
| 安全上重要な層間搬送 | N/A | UI／SPECの設計コンテキストだけを変更し、Runtime搬送を変更しない | Scope変更時に再評価 |
| 保護対象Effect／Recoveryの耐久Authority | N/A | 外部EffectやAuthorityを変更しない | Scope変更時に再評価 |
| 残存資源／Recovery／Authority義務を伴う取得transaction | N/A | 実行資源を取得しない | Scope変更時に再評価 |
| 発火例／非発火例／境界例／情報不足例 | Applicable | SCR、PRT、CMP、BHVの発行とN/A／OPENを区別する | ひな型と自己適用で確認 |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | Definition、Detail、Prototype、Baselineを混同しない | 独立レビューで確認 |
| 固定前の実差分照合 | Applicable | 正本、ひな型、自己適用成果物を同じ候補で確認する | Checker前に再確認 |
| 根拠の主張軸（入口形態） | N/A | 公開Runtime入口を変更しない | Scope変更時に再評価 |
| 根拠の主張軸（観測基盤） | Applicable | Markdown構造、視覚Source、Renderを区別する | Pilotで再評価 |
| 根拠の主張軸（成果物Identity） | Applicable | UI／SPECとSCR／PRT／CMP／BHVの境界を定義する | Pilotで再評価 |
| 根拠の主張軸（lifecycle） | Applicable | Draft、Human Decision、Baseline、Expansion、Componentizationを区別する | Pilotで再評価 |
| 未解消の不一致 | N/A | 現在の未解消事項はない。初回のロゴ配信、終了後観測および現在状態の競合を是正し、Browser Lifecycleを`ERB-IT-020`へ分離した。Quality算術の再集計後、最終文書／不足影響レビューはFinding 0 | Detail Contract固定候補として次Gateへ渡す。Production完成、Quality ReadyまたはRelease採用は主張しない |

## 変更経路の計画

- 適用判定: `Applicable`
- 計画した主な工程 / 共通責務: UI、SPEC、対応レビュー、Architecture／Quality引き渡し、文書監査、不足影響監査
- 選択理由: Definitionと実装の間にある設計責務を正本化するため
- 予定する検証: Checker、リンク確認、全Definition適用評価、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Product DiscoveryはPhase 5で実施済みであり、未採用WIPから意味を逆輸入しない。Production Reality AuditはCanonical Detail固定後まで実施しない

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | 工程契約、自己適用、独立レビュー、Pilot後の固定を分離する |

### PhaseとGate

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 1 | Detail契約とひな型 | 正本、ひな型 | 構造・リンク・Checklist | 必須意味を保存できる | Passed |
| Phase 2 | v0.21成果物への適用評価 | UI 20件、SPEC 29件、対応成果物 | 全数Coverage | 全件がApplicable／N/A／OPENへ処置される | Passed |
| Phase 3 | 独立レビュー | Phase 1〜2固定候補 | 文書・不足影響・工程契約レビュー | Finding 0 | Passed |
| Phase 4 | v0.21 Detail Migration and Downstream Propagation | 20 UI、29 SPEC、Architecture、Quality、Checker | Detail全数Coverageと下流Relation | 発行済みIDが全下流工程へ接続されFinding 0になる | Passed |
| Phase 5 | v0.22 Discovery Handoff | v0.22未完了項目 | WIP非依存と入力境界確認 | Discoveryが解決案を前提にせず開始できる | Passed |
| Phase 6 | Workbench Pilot後の契約固定 | Detail Contract | G1〜G5、Dogfood結果、人間判断、独立レビュー | ID・粒度・Visual工程を固定できる | Passed — 最終独立レビューFinding 0 |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| 全回帰で既存の型付き命名違反を検出 | 本変更の固定候補を検証するために必要な回帰基盤の一意な是正であり、Coordinatorの試験意味は変更しない | 検証基盤の定数名を現行規則へ一致させる | 全回帰PassをGateへ追加する | N/A: 意味を変えない一意なRename | `PORTABLE_TEST_DIRECTORIES`を`portableTestDirectories`へ変更 |
| 独立レビューでDetailの下流Relation不足を検出 | Definition→Detail→Architecture／Qualityを閉じる同じIntentの不足である | 31 Interaction RelationのArchitecture／Quality Owner、中央投影、局所Owner投影、Checker | Relation tupleの完全一致と同数差し替え負例をPhase 4 Gateへ追加する | N/A: 既存Definitionの意味は変更しない | Architectureは`Single` 30件／`Joint` 1件、Qualityは`Single` 28件／`Shared` 2件／`Joint` 1件として是正し、再レビューPass |
| 独立レビューで配布ひな型の固定母集団を検出 | 公式自己適用の件数を採用Repositoryへ要求しないことは同じDetail契約の配布境界である | UI／SPEC引き渡しひな型とChecker Checklist契約 | 件数非依存の全数確認が1件・複数件の母集団で成立することをPhase 4 Gateへ追加する | N/A: 公式v0.21の20 SCR／20 PRT／29 BHV／31 Relationは変更しない | ひな型を対象改訂版の実母集団へ一般化し、公式件数は現行本文に維持して再レビューPass |
| 独立再レビューでCheckerの期待値自己導出を検出 | Canonical DefinitionからDetailと下流工程まで一方向に伝播させる同じIntentの検査不足である | Definition対応、UI Detail台帳、SPEC Detail台帳を期待値OwnerとするRelation閉包検査 | 派生成果物を同時に誤変更しても受理せず、重複行をSet化で隠さないことをPhase 4 Gateへ追加する | N/A: 発行済みID、Relation、Ownerの意味は変更しない | Canonical台帳から期待tupleを導出し、協調誤変更、同数差し替え、誤Area、重複行の反例を追加して再レビューPass |
| 全回帰で新ひな型と基準版成果物のChecklist境界不足を検出 | 新契約のひな型とv0.21基準版成果物を同時に検証する同じIntentのFixture不足である | Checker契約試験のFixture入力境界 | 両Checklist契約を別々に検証し、全回帰Passを要求する | N/A: 製品成果物とCheckerの合否条件は変更しない | 評価済み成果物から基準版項目を取得し、新ひな型項目との混在を解消 |
| v0.22 DiscoveryでConsumer共通のProject Context交換契約を確認 | UI／SPEC DetailをWorkbenchで検証する前に、比較対象となる共通入力を成立させる同じPhase 5の目的である | Repositoryルート投影、進捗・配置規則、AI入口、ひな型、Checker | Project Contextを第二の正本にせず、3 Identity、五場面、可視Checklistを決定論的に確認できることをPhase 5 Gateへ追加する | N/A: 既に採用したREQ-000038を正式なRepository成果物へ一意に反映する | `PROJECT_CONTEXT.md`をCurrent Projectionとして正式化し、Repository IDはv0.22の試行値として暫定採用 |
| v0.22候補範囲と10月3日の目標日を照合 | Phase 5で個別要求を採用しても、Releaseとして閉じる利用者成果と後続へ分離する能力が未確定だった | Repository内の仕事、Project横断の仕事、AI利用構成、実行自動化のScope比較 | Scope確定前に追加の下流展開を止め、完成条件と日程Riskを同時に判断することをPhase 5 Gateへ追加する | Qual-LabがRepository内＋Project横断＋AI利用構成をv0.22の完成範囲として選択した | [EXP-000034](../../../01_Discovery/Analysis/EXP-000034/exploration.md)でB+を採用し、自律Operationを後続へ分離 |
| Project横断の二つの利用目的を再確認 | FederationとPortfolioを一つの横断機能へ畳むと、RepositoryとProjectの単位およびAuthorityが混ざる | 同一Logical ProjectのRepository Federation、複数Logical Projectの読み取り専用Portfolio | Federation後のLogical Project ContextだけをPortfolio比較へ使い、Project間の自動判断を対象外とすることをPhase 5 Gateへ追加する | Qual-Labが二つともv0.22に含むことを確認した | [EXP-000035](../../../01_Discovery/Analysis/EXP-000035/exploration.md)で既存REQ-000013／017／024／038を維持 |
| Remote認可をRole別共有Credentialへ簡素化 | 接続申請と個人別CredentialはUser管理Workflowとなり、v0.22の導入・管理負担を増やす | 三Role、Role別共有Credential、Bearer Secret、発行・保存・失効・ローテーション | User／Principalを作らず、Secret非保存と非開示を守ることをPhase 5 Gateへ追加する | Qual-LabがRole別Credentialをv0.22の最小方式として採用した | [EXP-000036](../../../01_Discovery/Analysis/EXP-000036/exploration.md)と[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md)へ固定 |
| Remote認可のReset経路を追加 | Administrator Credential喪失または認可状態破損時に、通常のRemote認証だけでは管理へ戻れない | Administrator Recovery、Full Access Reset、Bootstrap再発行、耐久Recovery記録 | Serverローカル対話CLI、人間確認、Product Data非削除および再入場をPhase 5 Gateへ追加する | Qual-Labがv0.22にReset機構を含めると判断した | REQ-000041へ通常ローテーションと緊急Recoveryを分けて反映 |
| 本格Trust Policyをv0.22から分離 | 既存RuntimeやCROS認可へ信頼方針管理を直接組み込むと、現在必要なProject運営とRemote接続に対して過剰になる | v0.22では信頼要素分離と既存署名検証を維持し、Trust Policy管理は将来の独立Capabilityへ移す | v0.22 GateからTrust Policy管理を外し、将来導入時にAdapter経由で局所反映する境界を追加する | Qual-Labが現在版には入れないと判断した | [EXP-000028](../../../01_Discovery/Analysis/EXP-000028/exploration.md)へ版境界と将来の所有形を記録 |
| Repository CapabilityをAdapterで組織固有実装へ接続 | Registryだけでは標準能力と組織固有Commandの関係が曖昧になり、中核改造か任意Shell登録へ寄りやすい | Capability Contract、明示Adapter、Repository単体利用、CROS投影 | 同じ能力契約を標準・組織固有Adapterで満たし、Directory走査と任意Code読込みを許さないことをPhase 5 Gateへ追加する | Qual-LabがAdapter分離による組織固有改造を確認した | [EXP-000025](../../../01_Discovery/Analysis/EXP-000025/exploration.md)と[REQ-000014](../../../01_Discovery/Definitions/REQ-000014/requirement.md)へ反映 |
| AI Runtimeを追加可能な安定Profileへ分離 | Model名と実行環境を中核へ直接結合すると、新Modelや組織固有構成のたびに改修が必要になる | 仕事Profile、Provider Adapter、Model、推論設定、ローカル／Server設定Owner | Claude Code等の実行環境とgpt-6-astra等のModelを分け、Profileを設定追加できることをPhase 5 Gateへ追加する | Qual-LabがProfile方式と追加可能性を確認した | [EXP-000026](../../../01_Discovery/Analysis/EXP-000026/exploration.md)と[REQ-000016](../../../01_Discovery/Definitions/REQ-000016/requirement.md)へ反映 |
| 正式投影への自己適用でManifest v1にRepository IDがないことを確認 | REQ-000038のProject／Repository Identity分離を成立させる同じIntentの実装不足である | Runtime Data Architecture、Manifest v2、配布例、契約試験 | Project IDと異なるRepository IDを必須化し、固定Role階層をProject固有の投影責任として扱えることをPhase 5 Gateへ追加する | `qual-lab.crdd-standard`をv0.22で暫定採用し、正式固定は契約固定時に再評価する | v1を推測移行せず拒否するv2契約を追加し、公式RepositoryのローカルManifestへ暫定IDを自己適用 |
| WorkbenchのVisual工程を飛ばして下流伝播へ進みかけた | Visual DesignをUI Detailの構成要素ではなく後続装飾として扱える余地がGateとChecklistに残っていた | G1 Screen ArchitectureからG5 Expansionまでの順序、Evidence、進行禁止、N/A条件 | Workbench PilotではG1〜G5を可視Checklistで評価し、G4は人間判断、G5前は下流へ通常引き渡ししない | Qual-LabがGateだけでなくAI間で揺れないChecklist化を要求した | `25_UI.md`とUI Detail／Visual Baselineひな型を強化し、Workbenchで自己適用する |
| `AI Work`がWorkbench固有のAI機能・履歴所有に見える | Workbenchの責務はProject Contextを既存AI Runtimeへ渡す依頼面であり、CodexやClaude Codeの代替または会話履歴の正本ではない | AIへの依頼、現在Session、Provider側履歴、共有成果物への反映 | 表示名を`AIへの依頼`へ改め、会話全文を正本化せず、継続結果だけを既存Owner Artifactへ反映する境界をG1へ追加する | Qual-LabがAI履歴の所有に違和感を示し、依頼面としての整理を採用した | G2でProject Workspace内Panel、Side Panel、独立表示、Context付き外部AI入口を比較する |
| 一覧・Tree・履歴の大量化がG1で未評価だった | Screen Inventoryだけでは全件取得・全件描画をAIが暗黙採用でき、実利用時の重さと権限境界が後発する | Project、Topic、Meeting、Quality、Relation、Runtime、Repository、CredentialのCollection表示 | 大量化し得る表示面、検索・絞り込み・継続読込・遅延展開・仮想表示・内容分割をG1で必須評価し、取得契約をSPEC Detailへ渡す | Qual-Labが一覧を一気に表示した場合の重さとページング考慮を確認した | `25_UI.md`、UI Detailひな型、Workbench G1成果物へRule／Format／Checklistを反映した |
| G4でDirection AとFont統一を採用 | HeroだけでVisual Tasteを決めると、作業・Git・Portfolioで成立しない基調や書体混在を固定し得る | Decision Rail、Noto Sans CJK系Font Stack、3 Secondary Screen、Pattern／CMP評価 | 同じViewportでTopic Detail、Repository Worktree、Project Portfolioへ展開し、反復と例外をG5で確認する | Qual-LabがAのテイストとFont統一を選択した | G5を通過し、Pattern候補を記録。CMPはBehavior／Accessibility Contract不足のため理由付き保留 |
| Workbench左上のBrand表示を確定 | Visual Fixtureは文字`C`で代替Markを描画しており、収載済みの公式ロゴ原本と一致していなかった | Direction AとSecondary 3画面の左上Brand表示、Visual Baseline、再描画Evidence | 公式ロゴ画像をRepository内Pathから読み、画像byteや図柄を改変せず全展開画面で使用する | Qual-Labが左上にアイコンを表示する場合はロゴ画像を使うと判断した | `crdd-brand-icon-512x512.jpg`へ置換し、`04_UI`を公開Rootとする再描画と15条件の画像読込確認を実施 |
| G5後の確認で8〜11pxの文字と未構造のDesign Principleを検出 | Font Familyの統一とVisual Tasteの選定だけでは、可読性、操作可能性、Contrast、拡大および内容増加の成立を保証できなかった | G3候補適格性、Type Scale、Contrast、Target Size、Spacing、状態識別、狭幅、Keyboard Focus | G3前に各案の原則適合を必須化し、G5でSecondary Screenへ再適用する | Qual-LabがHeroを作ってもDesign Principle未適用では意味がないと指摘した | Rule、Template、Checker Checklistへ還元し、Workbenchを12px下限／14px本文とTokenへ是正。5画面を320〜1920 CSS pxで実測し、文字Contrast、操作対象、横OverflowおよびFocus順の未処置0件を確認。実Browser Zoomも別の15条件として全数PASSで閉じた |
| `file://`がBrowser検証境界で拒否され、実Zoom／Breakpoint境界を再現できない | Visual確認を特定BrowserのLocal File許可へ依存すると、G5の検証手段を別実行者が再現できない | `visual-preview`専用Subsystem、localhost読取り専用配信、専用Chrome Profileによる実Zoom観測、薄い配布CLI、直接境界IT／System検証 | 実Browser確認前にRoot越境、Link、書込みMethod、外部BindおよびListener残存を拒否する。Visual検証では通常Browser Profileや拡張を使わず、操作所有のProcessとProfileだけを使用・清掃する | Qual-Labが汎用Verification Runnerへの統合より、Visual確認だけへ絞った単純なToolを採用した | `40_Develop/visual-preview`と`template/tools/crdd-visual-preview.ts`を追加し、Architecture、Quality、Test CatalogおよびSymbol Relationへ接続。旧900px境界の横Overflowを是正後、5画面の狭幅40条件に加え、100%／200%／400%の実Browser Zoom 15条件を確認し、未処置0件で閉じた |
| Phase 5で採用したPush、Topic／Meeting Lifecycle、Role Credential RecoveryのMeaningをDetailへ反映 | Discovery採用だけでPhase 6を固定すると、v0.21由来のUI／SPEC Detailと新しいv0.22 Meaningが分断される | 1 BHV、2 Screen Detail、UI／SPEC対応レビュー、Architecture Analysis／Definition／Detail、Quality Analysis／Definition／Integration | 新MeaningをUI／SPECからQuality Local Itemまで一方向に伝播し、対応レビューとQuality ClosureをCheckerで全数確認する | N/A: 採用済みREQ／UX／UI／SPECの意味を下流へ伝える一意な処置 | `BHV-000031`、`RFD-IT-014`、`RFD-ST-015`、`RFD-ST-016`を追加し、Topic／MeetingとCredentialの既存Detailを拡張。Quality 164 Local Itemと167工程入力のClosureを確認した |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| 文書監査 | 9ファイルにEOF余白、Areaひな型に空Listが残った | Phase 3で表記是正後に再レビュー | `git diff --check`、文書監査 | Detail契約の意味 | 是正済み。再レビュー待ち |
| 不足影響監査 | Definitionだけを正式入力とする原則とDetail引き渡しの関係、Architecture／QualityのRelation欄、Checkerの負の契約試験が不足した | Phase 3で工程間契約と機械検査を補強して再レビュー | Checker局所試験、全回帰、不足影響監査 | UI／SPEC DefinitionのCanonicalな意味 | 是正済み。再レビュー待ち |
| 独立文書再レビュー | 現行Quality Integrationへ新節を追加した際に、既存§4の次をひな型側と同じ§6としていた | Phase 3で現行文書の見出しだけを§5へ是正して再レビュー | 見出し連続性、Repository Checker、文書監査 | 節本文、ひな型§1〜§6、他の工程契約 | 是正・再レビュー完了。Finding 0 |
| Phase 4独立レビュー | 端点のSCR／PRT／BHVを個別に下流接続すればInteraction Relationも復元できると判断していた | 31 Relationを一次キーとしてArchitecture／Qualityの統合責務と局所Ownerを明示する | exact tuple検査、誤BHV／誤ARCH／誤QAの同数差し替え試験、全回帰、文書・不足影響再レビュー | 20 SCR、20 PRT、29 BHV、31 Relation、Definition意味、v0.22非先取り境界 | 是正・再レビュー完了。Finding 0 |
| Phase 4独立再レビュー | Screenと対応表の申告から期待Relationを作ると、両方を同時に誤変更した場合に自己整合で通過し得た | UI／SPEC Definition対応とUI／SPEC Detail台帳から期待Relationを決定論的に導出する | 協調誤BHV、台帳の同数差し替え、誤Interaction、誤Area、重複行、全回帰、文書再レビュー | 発行済みIDと31 Relation、Architecture／Quality Owner、v0.22非先取り境界 | 是正・再レビュー完了。Finding 0 |
| Phase 4不足影響再レビュー | 共通Owner集合が複数でも`Single`と表示し、Owner数とMode名が一致しなかった | Owner集合を維持したまま`Single`／`Shared`／`Joint`をOwner集合の形で区別する | 複数共通Ownerの正例、全回帰、不足影響再レビュー | 31 Relation、BHV、ARCH／QA Owner集合、局所Owner、Definition意味 | 是正・再レビュー完了。Finding 0 |
| Phase 6初回独立レビュー | HTMLのロゴ参照がPreview Root外となり、壊れた画像とalt表示を画像成功としていた | `04_UI`を公開Rootとし、画像完了・自然寸法・失敗数をVisual Oracleへ追加する | 公開CLIから5画面×3倍率を再実行し、公式ロゴ表示画面の画像成功と全15条件の失敗0を確認する | 公式ロゴ原本、Direction A、他のVisual構成 | 4画面を再描画し、公式ロゴ画面12条件でloaded 1／failed 0、Direction B 3条件で0／0を確認 |
| Phase 6初回独立レビュー | cleanupを一時Root不存在だけで代表し、正常終了、Fallback、Process Tree、DevToolsおよびPreview Listenerを区別していなかった | 資源別の終了後観測と現在候補の入力ManifestをERB-ST-019へ追加する | 正常終了受理、強制Fallback、Process Tree、DevTools、Profile、Preview Listenerおよび一時Rootを全条件で確認する | 通常Profile非利用、外部Network 0、他Browser非操作 | 15条件で正常終了受理、Process Tree 0、DevTools 0、Profile 0、Preview Listener 0を確認。入力SHA-256とBrowser版をEvidenceへ固定 |
| Phase 6初回独立レビュー | G1／G2時点のOPENと初期計画が、G3〜G5およびPhase 5／6の現在状態と同じ欄に残っていた | Gate時点の履歴と現在状態を分け、30 BHV／32 Relationを工程入口まで反映する | 01→02→03→04→05、UI／SPEC入口、CHGを順読し、状態逆行と現在件数の競合0を確認する | 当時未通過だった事実、v0.21の29 BHV／31 Relation | G1／G2を時点記録として明記し、解決済み判断と現在30 BHV／32 Relationへ更新 |
| Phase 6独立再レビュー | Listener／Process局所反例試験を実Browser STへ直接Traceし、Quality RelationとCHG影響一覧へ未収載だった | Browser Lifecycle観測を独立した直接境界IT `ERB-IT-020`として追加し、実Browser STの完成根拠と分離する | Local Item段階、Test Symbol、Catalog、Reality算術、全回帰および実Browser 15条件を再確認する | `ERB-ST-019`のSystem/E2E境界と15条件Evidence | `ERB-IT-020`、Test Symbol、Catalog、Reality投影および影響一覧へ接続し、局所IT単独で実Browser STを完成扱いしない |

## 判断 / 承認の参照

- `area.md`は画面一覧ではなくArea固有のデザインガイドラインを所有する。
- Product全体のVisual BaselineとArea固有の適用・例外を分ける。
- WIPはDiscoveryやDefinitionの入力にせず、Canonical Design後のReality Auditで参照する。
- Visual TasteとProduct Personalityの採用は人間の決定権限とする。

## 検証

- 検証義務: 正本、ひな型、自己適用成果物の一致と全数処置
- 検証設計: Checker、文書監査、不足影響監査、独立レビュー
- 決定論的確認:
  - Repository Checker: 構造・Coverage Error 0／Warning 0。featureブランチのため既知の`stable-release-tag-identity-mismatch` 1件
  - Format／Typecheck／Lint: Pass
  - Checker回帰: 375件Pass／0件Fail
  - Project Context局所契約試験: 3件Pass／0件Fail
  - Runtime Data契約試験: 36件Pass／0件Fail
  - Relation閉包の対象試験: 7件Pass／0件Fail
  - `git diff --check`: Pass
  - UI Definition適用台帳: 20件
  - SPEC Definition適用台帳: 30件
- Phase 6独立レビュー対象: G1〜G5成果物、Visual Preview実装、新Meaning伝播、Quality Closureおよび現行差分の全件
- 独立レビュー結果:
  - Phase 3文書監査: Pass／Finding 0
  - Phase 3不足影響・工程契約監査: Pass／Finding 0
  - Phase 4初回文書監査: Fail／Major 2件。配布ひな型の固定母集団とRelation閉包不足を是正済み
  - Phase 4初回不足影響・工程契約監査: Fail／Major 2件。Relation単位の下流Ownerと負例不足を是正済み
  - Phase 4最終文書再レビュー: Pass／Finding 0
  - Phase 4最終不足影響・工程契約再レビュー: Pass／Finding 0
  - Phase 6初回独立レビュー: Fail。ロゴ配信／画像Oracle、Browser終了後観測、工程状態・件数の現在性を是正した
  - Phase 6独立再レビュー: Fail。局所Browser Lifecycle試験を`ERB-IT-020`へ分離し、Quality Relationと影響一覧へ接続した
  - Phase 6最終独立文書再レビュー: Pass／Finding 0
  - Phase 6最終不足影響・工程契約再レビュー: Pass／Finding 0
- Quality Center: UI／SPEC Detailと新しいv0.22 MeaningからRequired Verificationへの導出を反映済み。未実装CapabilityのEvidenceは未観測のまま保持する

## リリース

- 対象リリース: v0.22.0
- 収録リリース: 未確定
- 処置: 独立レビューとWorkbench Pilotを経て人間が採用判断する

## 既知の制限 / 残るリスク

- SCR／PRT／BHVは現在のCanonical成果物へ20 SCR、20 PRT、30 BHV、32 Relationとして発行した。CMPは実画面の反復根拠とBehavior／Accessibility Contractが不足するため理由付き未発行とし、実装後に再評価する。
- Visual Source形式はPilotで比較し、Screenshotだけを正本にしない。
- v0.21成果物のDetail伝播は過去Releaseの成立条件を変更せず、新契約へ現在のCanonical Contextを移行する。

## 後続対応 / ロードマップ

Phase 6の独立レビューはFinding 0で通過し、UI／SPEC Detail Contract固定候補が成立した。Workbenchはv0.22 Discoveryの採用済み意味を用いたDogfood対象であり、Pilot DesignとProduction実装を区別する。次のGateでは、未実装Capabilityを未観測のまま保持してReality Audit／実装へ進み、Secondary Screenの実装反復からPattern／CMP昇格の根拠を評価する。PilotだけからProduction完成を主張しない。
