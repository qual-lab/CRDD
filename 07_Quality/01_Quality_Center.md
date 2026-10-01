# CRDD内部ツールの品質の現在状態

状態: Quality Design Ready — Reality Audit Pending
担当責任者: Qual-Lab
最終更新日: 2026-10-02

現在注記: v0.21の最終署名照合は履歴Baselineとして完了している。v0.22の署名候補Commit `45254e2b`と是正済み検証Tool `1b756ac2`によるProject Runtime公開MCP実Provider E2Eは、Run `2e55c8cd2897464b`で合格した。通常二経路、取消、exact Recoveryおよび最終資源回収を確認し、再入場後は意図どおり人間の採用判断待ちで停止した。Workbench実Provider E2E、必要な四経路E2E、個別品質項目の照合および最終配布の再署名は残るため、Quality Readyへ昇格しない。

## Current Quality Projection

| 項目 | 現在値 | 根拠・次の処置 |
|---|---|---|
| 全体状態 | Quality Design Ready — Reality Audit Pending | Quality Readyへ昇格しない |
| 現在対象 | v0.22.0 | Project Operation、Workbench、CROS、複数Repository、AI Runtimeを段階的に照合する |
| 観測済み | 11 / 46 | v0.22対象範囲のうち、Production Workbenchの実Browser Visual GateまでEvidenceへ接続済み |
| 未観測 | 35 / 46 | 起動時Tool制限024と実Host／公開CLIの追加6項目025～030を含む。局所試験またはRelationだけで観測済みへ変更しない |
| 既知Gap | Phase 5 Release Verification進行中 | Project Runtime公開MCP E2Eと最終回復在庫確認は合格した。Workbench Codex助言は、選択モデルが要求するCode Modeを無効化した起動不整合で停止した。6.1 Sol／6 Lunaと対応CLI・Hostへの移行、助言専用の最小起動制限は承認済みである。Native試験の旧SIGSEGVはRust最終リンクの境界へ切り分け、是正後の専用CLIとbwrapの起動およびNativeリンク処理の局所反証を確認した。実Host正常計算は固定候補で個別実測したが、QAの保証範囲を広く解釈したTrace不足を検出した。024を維持し、実Host／公開CLIの6義務025～030を追加した。追加候補は未実行で、禁止能力・故障・公開取消・新モデル実行は未確認である。必要な四経路、個別品質項目および最終配布の照合も未完了であり、46項目の網羅を限定合格から推定しない |
| 次Gate | 現在は新しい実Taskを停止。残存Hostのexact対象・回収Authorityと通信断の原因層を確認し、再開条件成立後にWorkbench実Provider E2E、必要な四経路E2E、個別品質項目の照合、最終配布固定と署名照合を行う | [CHG-000082](../99_Roadmap/Changes/CHG-000082/change.md)、[候補通信診断と終了待ち](../99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md#候補d36a9decの署名通信切断の切り分けと終了待ちの不足) |
| 現在人間判断 | 回復参照を提示できないHost残存の保守契約を同じCHGで補強するか、Qual-Labの判断待ち | 検討対象は候補の設計・実装・局所反証・独立確認であり、契約採用や既存Rootの回収承認とは分ける。Root削除、Token手動生成、Provider再送、Docker再起動は含まない。判断前は新実Taskの停止を維持する。[補強候補](../99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md#回復参照を提示できないhost残存の正式な引継ぎ) |

## 設計集合

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 167 |
| Quality検証目標 | 13 |
| Local Item数 | 176 |

## 結論

Quality設計は13定義、176 Local Itemまで拡張した。Test Symbol Relationは132件に存在し、完成Evidenceへ算入できるのは118件、対象指示としてRelationを保持するが非完成・非Evidenceと判定するものは14件である。Relationを持たない44件のうち`ERB-ST-019`だけは実Browser Evidenceで観測済みであり、現在の観測済みは119件、未観測は57件（非完成Relation 14件、EvidenceのないRelationなし43件）である。このうちv0.21.0のRelease対象はGroup Aに属する130件で、108件が観測済み、22件が未観測（Hybrid 12件、Manual 10件）であり、機械化可能な既知Gapは0件である。Project Operation、Workbench、CROS、複数Repository、利用者所有TrustおよびVisual Previewに属する46件はv0.22.0へ移管し、`ERB-IT-020`、`ERB-ST-019`、`ERB-IT-021`、`ERB-ST-022`、`ERB-UT-023`、`PPR-IT-002`、`PPR-IT-019`、`CPR-IT-008`、`CPR-UT-009`、`RFD-IT-014`、`RFD-ST-015`の11件を観測済み、残り35件を未観測とする。局所成立を新Capability全体の完成Evidenceへ読み替えない。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 41、UX 35、IA 23、UI 20、SPEC 30、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| UI／SPEC Detail | Covered: 20 SCR、20 PRT、32 Interaction、30 BHVを全数処置し、Source Definition由来の既存検証目標へ具体的観測条件として統合した | [UI／SPEC DetailのQuality分析](Analysis/Detail/quality_analysis.md) |
| Quality Analysis | 6工程の全入力を、Source固有条件付きで13検証目標へ接続し独立レビュー済み | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義、176 Local ItemをCanonical化済み | Test Relationによる完成Evidence 118件とRelation外の実Browser Evidence 1件を合わせて119件観測済み、57件未観測。v0.21対象130件は108件観測済み・22件未観測、v0.22対象46件は11件観測済み・35件未観測であり、各Release群と全体の母集合を混在させない |
| Architecture詳細設計 | 18領域を適用判定済み | 実装OwnerのないCapability、現実との不一致およびTest未接続をReality Auditで処置する |
| Checker | Repository構造検査と全契約試験が成立 | 現在候補の固定Treeに対するRepository検査は、今回差分由来のFinding 0、Warning 0である。Error 1件は、v0.22作業HEADが公開済みv0.21.0 tagと一致しないFeature Branch上の既知状態であり、v0.22のRelease候補固定時に再評価する。実行ごとに変わるファイル、Markdown、LinkおよびAnchorの件数はこの現在投影へ複製せず、[Phase 5 純粋CSR Runtime閉包検証](../99_Roadmap/Changes/CHG-000082/Evidence/260928-2354_phase5-pure-csr-runtime-closure.md)が示す固定Treeから再現する。Verification RunnerはWorkbenchを含むOwner、実行Profileおよび結合経路を全数照合し、40 Pass・失敗0・条件付きSkip 1である |
| Reality Audit | 現在結果固定済み — Hybrid／Manual Evidence Pending | skipのEvidence誤算入と実境界未観測を是正し、v0.21に残るHybrid 12件とManual 10件を未観測のまま固定した。最終署名E2Eは`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続し、残る義務を一括してPassへ変更していない。v0.22対象46件は同版で再開する |

## 現在の品質投影

| 軸 | 現在状態 | この状態から主張しないこと |
|---|---|---|
| Designed | Canonical | 実装済みまたは試験可能とは主張しない |
| Implemented | 部分照合 | 未実装CapabilityをRelation追加だけで成立へ変えない |
| Executed | v0.22現在候補の局所確認、Portable回帰および更新候補の三独立確認を実行済み／署名実境界は未完了 | Coordinator Portableは2,117件中2,112 Pass・明示Skip 5・Fail 0、Production Selection対象試験は35／35 Pass、Workbenchは21／21 Pass、Checkerは375／375 Pass。独立レビュー・文書監査・Gap影響監査はFinding 0。旧Manifest削除後に前提不成立となっていた署名拒否fixtureも現在のManifestでPassした。v0.21の署名Recovery Matrixと4経路E2Eは履歴Baselineであり、v0.22現在候補の成立根拠へ流用しない |
| Passed | 局所確認、Portable全体および更新候補の三独立確認はPass／Quality Readyは未成立 | 5件のSkipはHostまたは人間入力を必要とする明示的な条件付き実行である。Commit、再署名、署名拒否試験、直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2Eは未実施。履歴Baselineのv0.21 Source A、carrier BおよびRuntime Execution Identityをv0.22候補へ読み替えない |
| Evidence | 現在候補の局所確認とPortable回帰Evidenceを収集済み／Release Verification Evidenceは未収集 | [Phase 5 Workbench Production Selection契約](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1428_phase5-production-selection-contract.md)に原因、要求契約の是正、局所反証およびPortable全回帰を保存した。[Phase 5 Workbench Repository結合とSelection更新](../99_Roadmap/Changes/CHG-000082/Evidence/260929-1305_phase5-workbench-selection-binding.md)以前は前候補の履歴であり、現在候補の全体Passへ流用しない |
| Reality Audit | Pending — 現在結果固定済み／残存Evidence待ち | v0.21履歴Baselineの最終署名結果だけを`AIT-ST-010`と`ERB-IT-014`の限定範囲へ接続した。v0.22現在候補は、再署名、署名候補の直接起動、Codex／Claude実Provider E2Eおよび必要な四経路E2EのEvidence待ちである。`RCM-ST-012`、`ERB-ST-009`、`ERB-ST-011`その他の未観測義務を、v0.21の4経路成功やDocker Engine利用可能という非発火からPassへ変更しない |

Coordinator／Project Runtimeの17意味Pilotに加えて全Subsystemへ照合範囲を広げた。skip、fixture自己再現および外部実境界の自己申告を観測済みから除外し、v0.21対象では108件観測済み、22件未観測である。Quality Readyへ昇格せず、PT／LTは人間の明示許可がないため実行しない。

## 公開済みBaselineと参照

過去版の詳細な実行条件、結果、限界および改訂版は各Release／Change Evidenceを正本とし、本書へ複製しない。

| Baseline | 保持する要点 | 正本参照 |
|---|---|---|
| v0.20.1 | v0.20.0の公開状態伝播漏れを修正。Runtime実行集合はv0.20.0から変更していない | [CHG-000069](../99_Roadmap/Changes/CHG-000069/change.md) |
| v0.20.0 | 正式4経路4/4、Recovery Matrix 7/7、cleanup成立。Linux／macOSや任意規模・長時間負荷へ一般化しない | [v0.20.0固定結果](../99_Roadmap/Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) |
| v0.19.0 | Project Runtime、取消、exact Recovery、fresh再入場の公開基準 | [v0.19.0最終署名E2E](../99_Roadmap/Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md) |
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
