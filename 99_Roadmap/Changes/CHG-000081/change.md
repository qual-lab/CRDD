# UI／SPEC Detail工程契約

変更ID: `CHG-000081`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.22.0`
変更分類: `design_completeness_contract_extension`

## 現在状態

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | UI／SPEC Detail工程契約の独立レビューがFinding 0で完了し、v0.22 Discoveryへ引き渡し可能 |
| 対象改訂版 | v0.21.0を基準版とするv0.22作業ブランチ |
| 成立済み | UI／SPEC Definition、N:N対応レビュー、可視Checklist、Architecture／Qualityへの引き渡し |
| 未成立 | v0.22 Discoveryによる課題・仮説の再構成、Workbench Pilot後の契約固定 |
| Phase／Gate適用判断 | `Applicable`: 規則、ひな型、自己適用、独立レビューを分けて確認する |
| 現在Phase | `Phase 4 — v0.22 Discovery Handoff` |
| 現在Gate | `Finding 0 Passed` |
| 次のGate | WIPを正解とせず、v0.22の課題・仮説・対象外をDiscoveryで再構成できる |

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

WorkbenchのWIP、画面案または既存実装を正解として逆算しない。まず一般工程契約をDraft化し、v0.21成果物へ適用評価した後、独立レビューを通過させる。その後にv0.22の各アイテムをDiscoveryで再構成し、WorkbenchをPilotとして契約を検証する。

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

- [`24_UI_Behavior_Specification.md`](../../../24_UI_Behavior_Specification.md)
- [`03_Documentation.md`](../../../03_Documentation.md)
- [`25_UI.md`](../../../25_UI.md)
- [`26_Behavior_Specification.md`](../../../26_Behavior_Specification.md)
- [`04_UI/01_User_Interface.md`](../../../04_UI/01_User_Interface.md)
- [`04_UI/05_UI_SPEC_Handoff.md`](../../../04_UI/05_UI_SPEC_Handoff.md)
- [`04_UI/Details/01_UI_Detail.md`](../../../04_UI/Details/01_UI_Detail.md)
- [`05_SPEC/01_Behavior_Specification.md`](../../../05_SPEC/01_Behavior_Specification.md)
- [`05_SPEC/06_UI_SPEC_Correspondence.md`](../../../05_SPEC/06_UI_SPEC_Correspondence.md)
- [`05_SPEC/Details/01_SPEC_Detail.md`](../../../05_SPEC/Details/01_SPEC_Detail.md)
- [`05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md`](../../../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)
- [`06_Architecture/01_Architecture.md`](../../../06_Architecture/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`16_Quality_Assurance.md`](../../../16_Quality_Assurance.md)
- [`27_Architecture.md`](../../../27_Architecture.md)
- [`40_Develop/checker/src/profiles/current-profile.ts`](../../../40_Develop/checker/src/profiles/current-profile.ts)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- [`40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts`](../../../40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts)
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

- 対象外: Workbenchの要求、画面構成、Visual Direction、実装の確定
- 変更してはならないこと: v0.21 Releaseの成立状態、既存`UI-*`／`SPEC-*`の意味、WIPをCanonical入力へ昇格しない境界

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 複数工程、ひな型、既存成果物へ影響する | 独立レビュー前に再確認 |
| 変更する契約母集団 | Applicable | UI／SPEC正本、ひな型、UI 20件、SPEC 29件 | 適用台帳で全数確認 |
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
| 未解消の不一致 | OPEN | Detail ID体系と成果物粒度はPilot前のDraftである | Workbench Pilot後にContract Freeze |

## 変更経路の計画

- 適用判定: `Applicable`
- 計画した主な工程 / 共通責務: UI、SPEC、対応レビュー、Architecture／Quality引き渡し、文書監査、不足影響監査
- 選択理由: Definitionと実装の間にある設計責務を正本化するため
- 予定する検証: Checker、リンク確認、全Definition適用評価、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Product Discoveryは本契約を固定してから別途開始する。WIP Reality AuditはCanonical Design成立後まで実施しない

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
| Phase 4 | v0.22 Discovery Handoff | v0.22未完了項目 | WIP非依存と入力境界確認 | Discoveryが解決案を前提にせず開始できる | In Progress |
| Phase 5 | Workbench Pilot後の契約固定 | Detail Contract | Dogfood結果と人間判断 | ID・粒度・Visual工程を固定できる | Planned |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| 全回帰で既存の型付き命名違反を検出 | 本変更の固定候補を検証するために必要な回帰基盤の一意な是正であり、Coordinatorの試験意味は変更しない | 検証基盤の定数名を現行規則へ一致させる | 全回帰PassをGateへ追加する | N/A: 意味を変えない一意なRename | `PORTABLE_TEST_DIRECTORIES`を`portableTestDirectories`へ変更 |
| 独立レビューでDetailの下流Relation不足を検出 | Definition→Detail→Architecture／Qualityを閉じる同じIntentの不足である | 文書原則、採用側入口、Architecture／Qualityひな型、現在Quality投影 | Relation保存と負の契約試験をPhase 3 Gateへ追加する | N/A: 既存Definitionの意味は変更しない | 是正済み。再レビュー待ち |
| 全回帰で新ひな型と基準版成果物のChecklist境界不足を検出 | 新契約のひな型とv0.21基準版成果物を同時に検証する同じIntentのFixture不足である | Checker契約試験のFixture入力境界 | 両Checklist契約を別々に検証し、全回帰Passを要求する | N/A: 製品成果物とCheckerの合否条件は変更しない | 評価済み成果物から基準版項目を取得し、新ひな型項目との混在を解消 |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| 文書監査 | 9ファイルにEOF余白、Areaひな型に空Listが残った | Phase 3で表記是正後に再レビュー | `git diff --check`、文書監査 | Detail契約の意味 | 是正済み。再レビュー待ち |
| 不足影響監査 | Definitionだけを正式入力とする原則とDetail引き渡しの関係、Architecture／QualityのRelation欄、Checkerの負の契約試験が不足した | Phase 3で工程間契約と機械検査を補強して再レビュー | Checker局所試験、全回帰、不足影響監査 | UI／SPEC DefinitionのCanonicalな意味 | 是正済み。再レビュー待ち |
| 独立文書再レビュー | 現行Quality Integrationへ新節を追加した際に、既存§4の次をひな型側と同じ§6としていた | Phase 3で現行文書の見出しだけを§5へ是正して再レビュー | 見出し連続性、Repository Checker、文書監査 | 節本文、ひな型§1〜§6、他の工程契約 | 是正・再レビュー完了。Finding 0 |

## 判断 / 承認の参照

- `area.md`は画面一覧ではなくArea固有のデザインガイドラインを所有する。
- Product全体のVisual BaselineとArea固有の適用・例外を分ける。
- WIPはDiscoveryやDefinitionの入力にせず、Canonical Design後のReality Auditで参照する。
- Visual TasteとProduct Personalityの採用は人間の決定権限とする。

## 検証

- 検証義務: 正本、ひな型、自己適用成果物の一致と全数処置
- 検証設計: Checker、文書監査、不足影響監査、独立レビュー
- 決定論的確認:
  - Repository Checker: Error 0／Warning 0
  - Format／Typecheck／Lint: Pass
  - Checker回帰: 367件Pass／0件Fail
  - レビュー是正局所試験: 12件Pass／0件Fail
  - `git diff --cached --check`: Pass
  - UI Definition適用台帳: 20件
  - SPEC Definition適用台帳: 29件
- 独立レビュー対象: staged diff hash `c8af8a4a014806017a5b0a22ef8534561c5112af`
- 独立レビュー結果:
  - 文書監査: Pass／Finding 0
  - 不足影響・工程契約監査: Pass／Finding 0
- Quality Center: Detail Contract固定後にRequired Verificationへの導出を追加する

## リリース

- 対象リリース: v0.22.0
- 収録リリース: 未確定
- 処置: 独立レビューとWorkbench Pilotを経て人間が採用判断する

## 既知の制限 / 残るリスク

- SCR／PRT／CMP／BHVはPilot前の仮ID体系であり、現時点で全既存成果物へ発行しない。
- Visual Source形式はPilotで比較し、Screenshotだけを正本にしない。
- v0.21成果物の`OPEN`は過去Releaseの失敗を意味せず、新契約に対する未実施を示す。

## 後続対応 / ロードマップ

独立レビュー通過後、v0.22の各アイテムをDiscoveryで再構成する。WorkbenchはDetail ContractのDogfood対象候補だが、Discovery前にSolutionとして確定しない。
