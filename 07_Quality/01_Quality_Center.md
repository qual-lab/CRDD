# CRDD内部ツールの品質の現在状態

状態: Quality Design Ready — Reality Audit Pending
担当責任者: Qual-Lab
最終更新日: 2026-10-06

現在注記: v0.21の最終署名照合は履歴Baselineとして完了している。v0.22の署名候補Commit `45254e2b`と是正済み検証Tool `1b756ac2`によるOrchestrator公開MCP実Provider E2Eは、Run `2e55c8cd2897464b`で合格した。通常二経路、取消、exact Recoveryおよび最終資源回収を確認し、再入場後は意図どおり人間の採用判断待ちで停止した。Workbench実Provider E2E、必要な四経路E2E、個別品質項目の照合および最終配布の再署名は残るため、Quality Readyへ昇格しない。

## Current Quality Projection

| 項目 | 現在値 | 根拠・次の処置 |
|---|---|---|
| 全体状態 | Quality Design Ready — Reality Audit Pending | Quality Readyへ昇格しない |
| 現在対象 | v0.22.0 | Project Operation、Workbench、CROS、複数Repository、AI Runtimeを段階的に照合する |
| 観測済み | 13 / 46 | v0.21からの移管母集団に対する進捗。既観測12件にShared Gateway非開示境界の`RFD-ST-004`を追加した。[新しい根拠と限界](../99_Roadmap/Changes/CHG-000082/Evidence/261002_shared-gateway-non-disclosure.md) |
| 未観測 | 33 / 46 | 同じ移管母集団の未観測。移管一覧を採用済みRelease Scopeと同一視せず、Trust項目の対応を再照合する。Native局所試験だけで024〜030を観測済みにしない |
| 既知Gap | ②と全体品質の未完了を分離 | 現候補の署名・production初期化2件、全Portable収集と失敗六件の限定是正後35件を確認した。PRL-IT-005／012は一部観測で、全義務Passへ増算しない。Workbench／必要なE2Eと全項目のEvidence適用は未完了。[最新の照合](../99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md) |
| 次Gate | 全製品E2Eと残る品質義務を別に確認する | ②の保存方式刷新は最終独立確認Passで完了。全Portable収集と是正後35件を別集合で保持し、全体Quality Readyにはしない。[②の完了根拠](../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定) |
| 現在人間判断 | なし（件数予算改訂を承認済み） | 秘密入力が必要な署名は外部対話端末で依頼する。署名操作の承認からRelease、未観測義務の免除または新Provider送信を推定しない。 |

## 設計集合

2026-10-07の現行Semantic集合は17意味、実装Relationあり17・自動Test Relationあり16・手動確認待ち1である。独立Trust Policy起動接続は将来範囲のため現行Requiredから除去した。実装追加によるMissing解消ではなく、実行・Evidence全体Passも主張しない。

過去の2026-10-06の現物再集計は13定義・176項目、試験Relationあり132項目・なし44項目、Symbol616件（ID重複0、未定義Local Item参照0）である。Semantic Coverageを再生成し、18意味のうち16は実装・自動試験の両Relation、1は実装・試験未観測、1は手動確認待ちとなった。いずれもRelationの数字であり、実行や品質項目の全体Pass件数ではない。[再集計と適用範囲](../99_Roadmap/Changes/CHG-000082/Evidence/261006_phase2-reality-audit.md)を参照する。

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 167 |
| Quality検証目標 | 13 |
| Local Item数 | 172 |

## 結論

Quality設計は13定義、172 Local Item。移管一覧の一意集合46件のうち、既観測12件に`RFD-ST-004`の公開Gateway非開示根拠を加えて13件を観測済み、33件を未観測とする。全体の旧投影119件観測済み・57件未観測と、そのRelation別内訳には表示不整合が見つかったため、**現在の全体集計は再照合中（OPEN）**である。v0.21の固定Baseline108／130と22未観測は履歴として維持する。108＋13＝121は算定候補であり、現在のRelation別Evidence適用を証明した全体件数とは表示しない。設計集合・過去結果は削除せず、[算定Owner](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)へ戻して再照合する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 41、UX 35、IA 23、UI 20、SPEC 30、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| UI／SPEC Detail | Covered: 20 SCR、20 PRT、32 Interaction、30 BHVを全数処置し、Source Definition由来の既存検証目標へ具体的観測条件として統合した | [UI／SPEC DetailのQuality分析](Analysis/Detail/quality_analysis.md) |
| Quality Analysis | 6工程の全入力を、Source固有条件付きで13検証目標へ接続し独立レビュー済み | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義、172 Local ItemをCanonical化済み | 移管母集団は13／46観測済み、33／46未観測。全体の現在件数とRelation別Evidence適用は再照合中。設計件数、Relation件数、履歴結果と現在成立を混在させない |
| Architecture詳細設計 | 18領域を適用判定済み | 実装OwnerのないCapability、現実との不一致およびTest未接続をReality Auditで処置する |
| Checker | 参照Evidenceの固定候補に対する履歴 | 参照Evidenceの採取当時の固定Treeでは、差分由来のFinding 0、Warning 0だった。Error 1件は、v0.22作業HEADが公開済みv0.21.0 tagと一致しないFeature Branch上の既知状態であり、v0.22のRelease候補固定時に再評価する。実行ごとに変わるファイル、Markdown、LinkおよびAnchorの件数はこの現在投影へ複製せず、[Phase 5 純粋CSR Runtime閉包検証](../99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)が示す固定Treeから再現する。Verification RunnerはWorkbenchを含むOwner、実行Profileおよび結合経路を全数照合し、当時40 Pass・失敗0・条件付きSkip 1だった。現在への全体適用は再照合中である |
| Reality Audit | v0.21限定結果の履歴 — 現在全体への適用は再照合中 | skipのEvidence誤算入と実境界未観測を是正し、v0.21に残るHybrid 12件とManual 10件を未観測のまま固定した。最終署名E2Eは`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続し、残る義務を一括してPassへ変更していない。移管母集団46件の現在処置は算定Ownerへ接続する |

## 品質軸の履歴と現在適用

以下は参照Evidenceの採取当時の記録である。「現在候補」「未実施」「未収集」は当時版に限り、現在状態は冒頭のCurrent Quality Projectionと[算定Owner](05_Current_Implementation_Reality_Audit.md#12-relation是正結果)を参照する。旧結果を現在全体のPassへ流用せず、現在への適用は再照合中として保持する。

| 軸 | 採取当時の状態（現在への適用は再照合中） | この状態から主張しないこと |
|---|---|---|
| Designed | Canonical | 実装済みまたは試験可能とは主張しない |
| Implemented | 部分照合 | 未実装CapabilityをRelation追加だけで成立へ変えない |
| Executed | v0.22現在候補の局所確認、Portable回帰および更新候補の三独立確認を実行済み／署名実境界は未完了 | Coordinator Portableは2,117件中2,112 Pass・明示Skip 5・Fail 0、Production Selection対象試験は35／35 Pass、Workbenchは21／21 Pass、Checkerは375／375 Pass。独立レビュー・文書監査・Gap影響監査はFinding 0。旧Manifest削除後に前提不成立となっていた署名拒否fixtureも現在のManifestでPassした。v0.21の署名Recovery Matrixと4経路E2Eは履歴Baselineであり、v0.22現在候補の成立根拠へ流用しない |
| Passed | 局所確認、Portable全体および更新候補の三独立確認はPass／Quality Readyは未成立 | 5件のSkipはHostまたは人間入力を必要とする明示的な条件付き実行である。Commit、再署名、署名拒否試験、直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2Eは未実施。履歴Baselineのv0.21 Source A、carrier BおよびRuntime Execution Identityをv0.22候補へ読み替えない |
| Evidence | 現在候補の局所確認とPortable回帰Evidenceを収集済み／Release Verification Evidenceは未収集 | [Phase 5 Workbench Production Selection契約](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md)に原因、要求契約の是正、局所反証およびPortable全回帰を保存した。[Phase 5 Workbench Repository結合とSelection更新](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md)以前は前候補の履歴であり、現在候補の全体Passへ流用しない |
| Reality Audit | Pending — 現在結果固定済み／残存Evidence待ち | v0.21履歴Baselineの最終署名結果だけを`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続した。v0.22現在候補は、再署名、署名候補の直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2EのEvidence待ちである。`RCM-ST-012`、`ERB-ST-009`、`ERB-ST-011`その他の未観測義務を、v0.21の4経路成功やDocker Engine利用可能という非発火からPassへ変更しない |

Coordinator／Orchestratorの17意味Pilotに加えて全Subsystemへ照合範囲を広げた。skip、fixture自己再現および外部実境界の自己申告を観測済みから除外し、v0.21対象では108件観測済み、22件未観測である。Quality Readyへ昇格せず、PT／LTは人間の明示許可がないため実行しない。

## 公開済みBaselineと参照

過去版の詳細な実行条件、結果、限界および改訂版は各Release／Change Evidenceを正本とし、本書へ複製しない。

| Baseline | 保持する要点 | 正本参照 |
|---|---|---|
| v0.20.1 | v0.20.0の公開状態伝播漏れを修正。Runtime実行集合はv0.20.0から変更していない | [CHG-000069](../99_Roadmap/Changes/CHG-000069/change.md) |
| v0.20.0 | 正式4経路4/4、Recovery Matrix 7/7、cleanup成立。Linux／macOSや任意規模・長時間負荷へ一般化しない | [v0.20.0固定結果](../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) |
| v0.19.0 | Orchestrator、取消、exact Recovery、fresh再入場の公開基準 | [v0.19.0最終署名E2E](../99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md) |
| v0.18.1 | Coordinator採用入口と署名Identityの公開基準 | [v0.18.1 Runtime Identity](../99_Roadmap/Releases/v0.18.1/Evidence/260901_coordinator-v0181-runtime-identity.md) |

公開前候補、不採用候補、是正往復および当時版の限定結果は、該当Change／ReleaseのEvidenceから確認する。Gitで再現できるInventoryや途中状態を、本書の永続的な第二正本にしない。

## 保持するリスクと追跡

- 配置漏れは、起動失敗だけでなく検査対象や署名対象からの脱落を起こし得る。
- 固定Evidence内の旧Pathを現在のSourceへ無条件に読み替えない。
- 実Provider、取消、Docker修復等で、fixtureや固定Workerだけでは証明できない範囲を隠さない。
- Quality設計の固定後も、実装・試験・Evidenceの現実照合が完了するまでQuality Readyとしない。

現在の方針は[品質方針](02_Quality_Strategy.md)、検証方法は[検証設計](03_Verification_Design.md)、全入力と検証項目の関係は[Quality Integration](04_Quality_Integration.md)、今後の照合方法は[現行実装との照合](05_Current_Implementation_Reality_Audit.md)を参照する。

## Checklist

- [x] 現在の品質状態と結論を履歴より先に示した
- [x] Canonical入力、検証目標およびLocal Itemの現在数を説明できる
- [x] 既存Canonical入力CoverageとUI／SPEC Detail由来の具体的観測条件を区別して全数接続した
- [x] Designed、Implemented、Executed、PassedおよびEvidenceの状態を区別した
- [x] 未成立、停止、要再確認および観測不能を正常へ畳んでいない
- [x] Quality ReadyとReality Audit開始条件を過大表示していない
- [x] 重大な問題、残存Riskおよび人間判断の必要性を評価した
- [x] 現在状態から分析、定義、実行結果およびEvidenceへ辿れる
- [x] 過去版の詳細を第二の現在正本として複製していない
