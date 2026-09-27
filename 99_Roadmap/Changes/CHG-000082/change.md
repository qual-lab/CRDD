# CROS WorkbenchのProduction実装

変更ID: `CHG-000082`
状態（Status）: `In Progress`
担当責任者: Qual-Lab
最終更新日: 2026-09-27

## 現在状態

| 項目 | 記載内容 |
|---|---|
| 現在の変更状態 | Phase 4を進行中。固定三Credential Profileを権限階層にせず明示Grantへ変換し、生Token非保存のCredential Core、不変Registryおよび任意構成のWorkbench管理Surfaceを接続した |
| 対象改訂版 | `v0.22.0` |
| 成立済み | G1〜G5のScreen Architecture、Direction A、5画面のSecondary展開、Production Shell、公式ロゴ、Project Context共通Reader、Topic／Meeting Record Reader、許可済みPortfolio Federation、Repository mode／CROS federation表示、作業ツリー読取り、選択Stage／Unstage／Commit／確認済み通常Push、拒否・通信断・結果不明・再観測、Role別Credential Core、Token非保存、永続Registry、Workbench Credential管理Surface |
| 未成立 | Topic／Meeting CRUDとOutcome移管、Owner Relation操作、Remote CROS Transport接続、全管理者喪失時のHost Recovery、AI依頼、`ERB-ST-022`を含むProduction Closure |
| Phase／Gate適用判断 | `Applicable`: 画面Shell、読取り投影、書込みEffect、Remote接続を分けて成立確認する必要がある |
| 現在Phase | `Phase 4 — Connection／AI Surface` |
| 現在Gate | `Passed: Phase 3`: Force Push 0、暗黙再送0、選択差分だけの処置、確認済み通常Pushおよび結果不明後の再観測を直接境界・故障注入・実Browserで確認した |
| 次のGate | User Accountを追加せず、Role Credentialから許可範囲だけのSessionを作り、Repository単体利用とRemote CROS利用を分離する |

## 契機 / 起点

| 項目 | 記載内容 |
|---|---|
| 種別 | v0.22 Product Capability実装 |
| 情報源 | Workbench Discovery、REQ-000040、UI／SPEC Detail Pilot、CHG-000081 |
| 理由 | 人間・AI・MCPが同じProject Contextを利用できる状態に加え、人間がProject、Topic、Meeting、Repository作業へ進む軽量な入口をProductionとして成立させる |
| 起点となる探索（EXP） | [EXP-000029](../../../01_Discovery/Analysis/EXP-000029/exploration.md)、[EXP-000030](../../../01_Discovery/Analysis/EXP-000030/exploration.md) |
| 対象要求（REQ） | [REQ-000040](../../../01_Discovery/Definitions/REQ-000040/requirement.md) |
| 不具合／監査是正の場合の逸脱契約 | N/A: 新Capabilityの実装である |
| ロードマップ参照 | [v0.22 CROS Workbenchの最小実装](../../01_Roadmap.md#12-v0220--project運営複数repository) |
| 情報源コンテキストの改訂版 | CHG-000081 Phase 6 Passed時点 |
| 人間による着手判断の参照 | 本対話でv0.22 Discovery、Direction A、公式ロゴ利用および実装継続を確認済み |

## 主な変更意図

Workbenchを、独自の正本やAuthorityを持たない薄い利用面として実装する。最初のProduction形態はTypeScriptのローカルWeb UIとし、localhost限定ServerからBrowserへ提供する。同じ画面契約を将来のRemote CROSでも再利用できるようにし、Electron等のDesktop包装は現在の成立条件へ含めない。

左上のブランド表示には、[CRDD公式ロゴ](../../../04_UI/assets/brand/crdd-brand-icon-512x512.jpg)を使用する。文字、仮図形、絵文字または類似アイコンで代替しない。

## 現在状態と構造変更

| 項目 | 変更前 | 変更後 |
|---|---|---|
| Workbench実体 | Visual FixtureとCanonical UI／SPEC Detailだけが存在する | `40_Develop/workbench`がProduction Web Surfaceを所有する |
| Application意味 | CROS、Project Operation、Version Control等に分散した公開契約がある | Workbench Adapterが既存公開契約を利用し、意味やAuthorityを作らない |
| 実行面 | FrameworkとProcess配置が未決 | localhost限定のTypeScript Server＋Browser UIを第一実装とする |
| Branding | Visual Fixtureが公式ロゴを参照する | Production Shellも同じ公式Asset Identityを使用する |
| Desktop包装 | 未定 | 対象外。OS統合上の必要性が実証された場合に別判断する |

詳細設計は[Workbench Architecture](../../../06_Architecture/Details/workbench/01_Architecture.md)を正本とする。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`99_Roadmap/Changes/CHG-000082/change.md`](./change.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`06_Architecture/07_Detail_Architecture_Map.md`](../../../06_Architecture/07_Detail_Architecture_Map.md)
- [`06_Architecture/Details/workbench/01_Architecture.md`](../../../06_Architecture/Details/workbench/01_Architecture.md)
- [`06_Architecture/Details/project-operation/01_Architecture.md`](../../../06_Architecture/Details/project-operation/01_Architecture.md)
- [`06_Architecture/Details/version-control/01_Architecture.md`](../../../06_Architecture/Details/version-control/01_Architecture.md)
- [`07_Quality/01_Quality_Center.md`](../../../07_Quality/01_Quality_Center.md)
- [`07_Quality/04_Quality_Integration.md`](../../../07_Quality/04_Quality_Integration.md)
- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Definitions/QA-000006/quality_definition.md`](../../../07_Quality/Definitions/QA-000006/quality_definition.md)
- [`07_Quality/Definitions/QA-000005/quality_definition.md`](../../../07_Quality/Definitions/QA-000005/quality_definition.md)
- [`07_Quality/Analysis/REQ/quality_analysis.md`](../../../07_Quality/Analysis/REQ/quality_analysis.md)
- [`07_Quality/Analysis/UX/quality_analysis.md`](../../../07_Quality/Analysis/UX/quality_analysis.md)
- [`07_Quality/Analysis/UI/quality_analysis.md`](../../../07_Quality/Analysis/UI/quality_analysis.md)
- [`07_Quality/Analysis/SPEC/quality_analysis.md`](../../../07_Quality/Analysis/SPEC/quality_analysis.md)
- [`07_Quality/Analysis/ARCH/quality_analysis.md`](../../../07_Quality/Analysis/ARCH/quality_analysis.md)
- [`07_Quality/Registry/test-catalog.json`](../../../07_Quality/Registry/test-catalog.json)
- [`40_Develop/workbench/package.json`](../../../40_Develop/workbench/package.json)
- [`40_Develop/workbench/package-lock.json`](../../../40_Develop/workbench/package-lock.json)
- [`40_Develop/workbench/tsconfig.json`](../../../40_Develop/workbench/tsconfig.json)
- [`40_Develop/workbench/symbol.json`](../../../40_Develop/workbench/symbol.json)
- [`40_Develop/workbench/bin/workbench.ts`](../../../40_Develop/workbench/bin/workbench.ts)
- [`40_Develop/workbench/src/index.ts`](../../../40_Develop/workbench/src/index.ts)
- [`40_Develop/workbench/src/project-surface.ts`](../../../40_Develop/workbench/src/project-surface.ts)
- [`40_Develop/workbench/src/workbench-server.ts`](../../../40_Develop/workbench/src/workbench-server.ts)
- [`40_Develop/workbench/tests/integration/project-surface.contract.test.ts`](../../../40_Develop/workbench/tests/integration/project-surface.contract.test.ts)
- [`40_Develop/workbench/tests/integration/workbench-server.contract.test.ts`](../../../40_Develop/workbench/tests/integration/workbench-server.contract.test.ts)
- [`40_Develop/cros/src/project-federation.ts`](../../../40_Develop/cros/src/project-federation.ts)
- [`40_Develop/cros/src/index.ts`](../../../40_Develop/cros/src/index.ts)
- [`40_Develop/cros/tests/integration/project-federation.contract.test.ts`](../../../40_Develop/cros/tests/integration/project-federation.contract.test.ts)
- [`40_Develop/cros/symbol.json`](../../../40_Develop/cros/symbol.json)
- [`40_Develop/project-operation/src/index.ts`](../../../40_Develop/project-operation/src/index.ts)
- [`40_Develop/project-operation/src/repository-project-context.ts`](../../../40_Develop/project-operation/src/repository-project-context.ts)
- [`40_Develop/project-operation/src/topic-meeting.ts`](../../../40_Develop/project-operation/src/topic-meeting.ts)
- [`40_Develop/project-operation/symbol.json`](../../../40_Develop/project-operation/symbol.json)
- [`40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/repository-project-context.contract.test.ts)
- [`40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts`](../../../40_Develop/project-operation/tests/integration/topic-meeting-record.contract.test.ts)
- [`40_Develop/version-control/src/change-publication.ts`](../../../40_Develop/version-control/src/change-publication.ts)
- [`40_Develop/version-control/src/git/change-publication-adapter.ts`](../../../40_Develop/version-control/src/git/change-publication-adapter.ts)
- [`40_Develop/version-control/src/index.ts`](../../../40_Develop/version-control/src/index.ts)
- [`40_Develop/version-control/symbol.json`](../../../40_Develop/version-control/symbol.json)
- [`40_Develop/version-control/tests/integration/change-publication.integration.test.ts`](../../../40_Develop/version-control/tests/integration/change-publication.integration.test.ts)
- [`40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts`](../../../40_Develop/version-control/tests/integration/consumer-closure.integration.test.ts)
- [`template/22_Topics/_Template/topic.md`](../../../template/22_Topics/_Template/topic.md)
- [`template/23_Meetings/_Template/meeting.md`](../../../template/23_Meetings/_Template/meeting.md)
- [`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)
- [`Evidence/260927-1733_phase1-production-shell.md`](./Evidence/260927-1733_phase1-production-shell.md)
- [`Evidence/260927-1748_phase2-project-context-reader.md`](./Evidence/260927-1748_phase2-project-context-reader.md)
- [`Evidence/260927-1759_topic-meeting-record-contract.md`](./Evidence/260927-1759_topic-meeting-record-contract.md)
- [`Evidence/260927-1812_phase2-read-only-project-surface.md`](./Evidence/260927-1812_phase2-read-only-project-surface.md)
- [`Evidence/260927-1836_phase3-change-publication-it.md`](./Evidence/260927-1836_phase3-change-publication-it.md)
- [`Evidence/260927-1845_phase3-repository-work.md`](./Evidence/260927-1845_phase3-repository-work.md)

</details>

## 想定する影響

- コンテキスト: Project／Portfolio、Topic／Meeting、Quality、正本Relation、AI依頼、Repository Worktree、接続設定
- 成果物: Workbench Architecture、Quality Analysis／Definition、Production Source、Test、Evidence
- 利用者 / 運用: Developer、Project Operator、PM、Management、Administratorが同じ入口を役割内で利用する
- データ / インターフェース / 移行: 既存CROS／Project Operation／Version Control公開契約を利用し、Workbench専用正本を追加しない
- セキュリティ / プライバシー / コスト: localhost既定、Repository／Session Authorityを再評価せず、非開示情報を推測しない。Desktop Runtime依存は追加しない

## 対象外 / 変更してはならないこと

- 対象外: Electron等のDesktop包装、Force Push、Merge、Rebase、通常Discard、Workbench内会話履歴の正本化、本格Trust Policy管理
- 変更してはならないこと: CROS／Project Operation／Version ControlのAuthority、Project ContextのOwner、非開示Sourceの存在秘匿、CHG-000081で固定したDirection Aと公式ロゴの使用

## 固定前の収束確認

| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |
|---|---|---|---|
| 非自明な変更としての収束確認 | Applicable | 新しい利用者入口、Process、HTTP境界およびRepository Effectを追加する | 各Phase Gateと独立レビュー |
| 変更する契約母集団 | Applicable | Workbench UI／SPEC Detail、関連Architecture、Quality、公開Application Contract | Phase 0／1で固定する |
| 既知の利用側母集団と対象別の予定処置 | Applicable | Local Browser、将来Remote CROS、Repository単体利用 | Screen／入口別のSystem試験で確認する |
| 安全上重要な層間搬送 | Applicable | UI操作から既存Application Contract、Version Control Effectへの搬送 | 書込みPhaseでEffect前後を確認する |
| 保護対象Effect／Recoveryの耐久Authority | Applicable | Commit／Push、Credential管理は既存Authorityだけを使う | Effect実装前に再照合する |
| 残存資源／Recovery／Authority義務を伴う取得transaction | Applicable | HTTP listener、Browser request、Git process、Remote session | Integration／System試験で確認する |
| 発火例／非発火例／境界例／情報不足例 | Applicable | Local／Remote、権限あり／なし、部分観測、結果不明を分ける | Screenごとの契約試験 |
| 定義・発火条件・判定不能・正式結果の分離 | Applicable | loading／empty／partial／restricted／unknown／failedを正常へ畳まない | UI stateとApplication結果の照合 |
| 固定前の実差分照合 | Applicable | Source追加前にArchitecture／Qualityを固定する | 各実装Phase開始前 |
| 根拠の主張軸（入口形態） | Applicable | Repository単体、Local CROS、Remote CROSで可用能力が異なる | Public Surface E2E |
| 根拠の主張軸（観測基盤） | Applicable | DOM、HTTP、Application Contract、Git／Remote境界を分ける | Verification Design |
| 根拠の主張軸（成果物Identity） | Applicable | UI／BHV／ARCH／QA／Source／Test／Evidenceを接続する | Reality Audit |
| 根拠の主張軸（lifecycle） | Applicable | Server開始、要求、Effect、結果、shutdown、資源0を分ける | Host E2E |
| 未解消の不一致 | OPEN | Production Skeletonは成立したが、既存Application Contractと実データの接続およびProduction全Profile STは未成立である | Phase 2とPhase 5で再評価する |

## 変更経路の計画

- 適用判定: `Applicable`: Architecture Detail、Quality、Development、Reality Auditを順に進める
- 計画した主な工程 / 共通責務: Reality Audit→Architecture Detail→Quality義務→Production Skeleton→読取り面→書込み面→Remote接続→E2E
- 選択理由: Canonical Detailを既存WIPへ合わせず、既存公開契約を利用する最小Surfaceとして実装するため
- 予定する検証: Formatter、型、Lint、単体／結合／System、実Browser visual profile、Repository Checker、独立レビュー
- 判断上重要だが選ばなかった主な経路と理由: Electron先行は包装と配布の責務を増やし、現時点の利用者成果に必要ないため採用しない

## Phase／Gateと途中拡張

### 適用判断

| 評価対象 | 判定 | 理由 |
|---|---|---|
| Phase／Gate | Applicable | 読取りSurfaceとRepository／Credential Effectを同時に完成扱いしないため |

### PhaseとGate

| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |
|---|---|---|---|---|---|
| Phase 0: Reality Audit／Production Boundary | 現行実装、再利用契約、配置、素材、対象外を固定する | CHG、Architecture Detail、Map | Current Reality照合、Repository Checkerの構造・Relation検査 | 第二正本・Authority生成0、利用する公開契約と実行面が一意 | Passed |
| Phase 1: Production Skeleton | localhost ServerとBrowser Shellを成立させる | `40_Develop/workbench` | 静的確認、Server lifecycle、Browser smoke、公式ロゴ読込 | 公開入口からDirection A Shellを表示し、shutdown後資源0 | Passed |
| Phase 2: Read-only Project Surface | Project／Portfolio／Topic／Meeting等を公開契約から表示する | Adapter、View Model、Screens | Contract／System／Accessibility | 欠測・制限・部分成功を保持して主要読取りFlowが成立 | Passed |
| Phase 3: Repository Work | Tree／Diff／Stage／Commit／通常Pushを接続する | Version Control Adapter、確認Flow | Effect前後、失敗、結果不明、回復 | Force Push 0、暗黙再送0、選択差分だけを処置 | Passed |
| Phase 4: Connection／AI Surface | Local／Remote接続、Role別Credential、AI依頼面を接続する | CROS／Runtime Adapter | Authority、Disclosure、Session lifecycle | User管理を追加せず、許可範囲だけで同じ契約を利用 | In Progress |
| Phase 5: Production Closure | 15 Screen範囲、Visual、E2E、Reality Auditを閉じる | 全Production Surface | 全回帰、実Browser、独立レビュー | Blocking Finding 0、未観測を明示しRelease判断へ引渡し可能 | Planned |

### 途中拡張の記録

| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |
|---|---|---|---|---|---|
| N/A: 現時点で途中拡張なし | CHG開始時点である | N/A | N/A | 新しい独立Intent検出時に評価する | N/A |

### 途中見直しの記録

| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |
|---|---|---|---|---|---|
| N/A: 現時点で途中見直しなし | N/A | N/A | N/A | UI／SPEC Detailと既存公開契約 | N/A |

## 変更影響の伝播確認

- 情報源の改訂版: CHG-000081 Phase 6 Passed
- 監査結果の参照: CHG-000081独立レビューFinding 0
- 上流 / 同層の正本更新: Workbench Architecture Detailを追加した
- 下流影響の再探索: Quality、Development、Test Catalog、Reality AuditをPhase順に更新する
- 再監査の結果: Phase 0固定候補で実施する
- 伝播例外: N/A: 例外なし

## 実装の参照

- [`40_Develop/workbench`](../../../40_Develop/workbench)
- 公開API: `startWorkbench`
- CLI: `node 40_Develop/workbench/bin/workbench.ts`

## 検証

- 検証義務: Workbench Architecture Detailの8導出キーを既存Quality目標へ接続し、Production境界を`ERB-IT-021`、Production DOMを`ERB-ST-022`へ分けた
- 検証設計: localhost直接境界ITと実Browser System／E2Eを分離した
- 結果参照: [Phase 1 Production Shell](./Evidence/260927-1733_phase1-production-shell.md)、[Phase 2 Project Context Reader](./Evidence/260927-1748_phase2-project-context-reader.md)、[Topic／Meeting Record Contract](./Evidence/260927-1759_topic-meeting-record-contract.md)、[Phase 2 Read-only Project Surface](./Evidence/260927-1812_phase2-read-only-project-surface.md)、[Phase 3 Change Publication IT](./Evidence/260927-1836_phase3-change-publication-it.md)、[Phase 3 Repository Work](./Evidence/260927-1845_phase3-repository-work.md)
- Quality Center: `RFD-IT-014`と`RFD-ST-015`を、Workbench→Version Control→実Git／bare Remote、実Browser確認、故障分類および再観測のEvidenceとして観測済みにした。`ERB-ST-022`はProduction全Profileが未観測のため維持する

## 実際の影響 / 逸脱

- 実際に通った工程 / 共通責務: Discovery、UX、IA、UI／SPEC、UI／SPEC Detail、Architectureへの伝播
- 計画との差: Desktop包装を追加せず、計画どおりlocalhost ServerとBrowser Shellだけを実装した
- 追加 / 削除した工程・検証と理由: Visual Previewの成立を流用せず、Workbench固有の`ERB-IT-021`と`ERB-ST-022`へ分離した
- 経路不足から生じた指摘事項: 初回Mobile smokeでNavigationが一行横Scrollになったため、320px相当では3列折返しへ是正した
- 最終的に有効だった検証: 固定Route IT、実Browser smoke、Repository Checker

## 正本コンテキストの更新

- Workbench実装構造: `06_Architecture/Details/workbench/01_Architecture.md`
- UI／Visual: `04_UI/Details/**`
- System Behavior: `05_SPEC/Details/**`
- 実装・試験: `40_Develop/workbench/**`（Phase 1以降）

## リリース

- 対象リリース: `v0.22.0`
- 収録リリース: 未収録
- 処置: 実装・検証・独立レビュー後に人間が判断する

## 既知の制限 / 残るリスク

- localhost Web SurfaceがDesktop固有操作なしで必要な利用体験を満たすかはProduction Dogfoodで確認する。
- 公式ロゴはRepository内の承認済みAssetを使用するが、配布Packageでの単一Ownerと収載方法はPhase 1で固定する。
- Credential、Git Push、外部AI依頼は読取り面より強いAuthority／Effectを持つため、後続Phaseへ分離する。

## 後続対応 / ロードマップ

Phase 2を閉じ、Phase 3でTree／Diff読取りとChange Publication Portの局所実境界を成立させた。次は同PortをWorkbench Application Portへ接続し、利用者確認、拒否・失敗・結果不明、再観測および終了後TreeまでをProduction Surfaceで閉じる。
