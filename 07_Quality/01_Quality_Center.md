# CRDD内部ツールの品質の現在状態

状態: Quality Design Ready — Reality Audit Pending（Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-22

## 設計集合

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 157 |
| Quality検証目標 | 13 |
| Local Item数 | 156 |

## 結論

Quality設計は13定義、156 Local Itemまで拡張した。Test Symbol Relationは122件に存在し、完成Evidenceへ算入できるのは118件である。残る4件は対象Relationを保持したまま非完成・非Evidenceと判定し、Relationなし34件と合わせて品質判定上の未観測38件とする。このうちv0.21.0のRelease対象はGroup Aに属する130件で、108件が観測済み、22件が未観測（Hybrid 12件、Manual 10件）であり、機械化可能な既知Gapは0件である。Project Operation、Workbench、CROS、複数Repositoryおよび利用者所有Trustに属する26件はv0.22.0へ移管した。移管範囲には既存PrototypeとのRelationが10件あるが、新Capabilityの完成Evidenceへ読み替えず、未観測16件と合わせてv0.22で実装・実境界・人間受入を再評価する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 36、UX 32、IA 22、UI 20、SPEC 29、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| Quality Analysis | 6工程の全入力を、Source固有条件付きで13検証目標へ接続し独立レビュー済み | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義、156 Local ItemをCanonical化済み | Test Relation 122件、完成Evidence算入118件、非完成Relation 4件、Relationなし34件。品質判定上は118件観測済み、38件未観測。v0.21対象130件は108件観測済み、Hybrid／Manual 22件未観測。v0.22移管26件はPrototype Relation 10件と未観測16件を区別し、完成済みへ読み替えない |
| Architecture詳細設計 | 18領域を適用判定済み | 実装OwnerのないCapability、現実との不一致およびTest未接続をReality Auditで処置する |
| Checker | Repository検査と全契約試験がPass | 1,705 file、963 Markdown、16,281 link、1,964 anchorをError 0／Warning 0で検査し、Checker契約試験363／363 Passを確認した |
| Reality Audit | In Review — Hybrid／Manual Evidence Pending | Checkerのskip Evidence誤算入と実境界未観測を是正し、v0.21に残るHybrid 12件とManual 10件を独立レビューと署名E2Eで処置する。v0.22移管26件は同版で再開する |

## 現在の品質投影

| 軸 | 現在状態 | この状態から主張しないこと |
|---|---|---|
| Designed | Canonical | 実装済みまたは試験可能とは主張しない |
| Implemented | 部分照合 | 未実装CapabilityをRelation追加だけで成立へ変えない |
| Executed | 独立レビュー是正後候補の自動回帰実行済み | Coordinatorは2015件中2010 Pass・失敗0・明示Skip 5、Checkerは363／363 Pass。自動回帰結果をv0.21未観測22 Local Itemの人間判断または実境界Evidenceへ数えない |
| Passed | 最終候補は未評価 | 新しいSource AとRuntime Identityに対する最終署名Recovery Matrixおよび4経路E2Eは未実施である。過去候補の結果を新候補へ流用しない |
| Evidence | 最終候補Evidence未収集 | 新しいSource A、manifest carrier BおよびRuntime Identityを固定した後に、対象改訂版、固定結果、件数および根拠HashをRelease Evidenceへ保存する |
| Reality Audit | In Review — 最終署名・残存Evidence待ち | Relationの存在や過去候補の署名E2E成功から、新候補または全Local ItemのImplemented／Passedを推定しない |

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
- [x] Designed、Implemented、Executed、PassedおよびEvidenceの状態を区別した
- [x] 未成立、停止、要再確認および観測不能を正常へ畳んでいない
- [x] Quality ReadyとReality Audit開始条件を過大表示していない
- [x] 重大な問題、残存Riskおよび人間判断の必要性を評価した
- [x] 現在状態から分析、定義、実行結果およびEvidenceへ辿れる
- [x] 過去版の詳細を第二の現在正本として複製していない
