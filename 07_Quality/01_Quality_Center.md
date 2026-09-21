# CRDD内部ツールの品質の現在状態

状態: Quality Design Ready — Reality Audit Pending（Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-21

## 設計集合

| 項目 | 件数 |
|---|---:|
| Canonical入力 | 157 |
| Quality検証目標 | 13 |
| Local Item数 | 154 |

## 結論

v0.21.0のQuality設計は13定義、154 Local Itemまで拡張した。全SubsystemのTest Symbolと再照合した現在値は、一意なLocal Item 154件中99件が観測済み、55件が未観測である。未観測55件は自動22件、Hybrid 14件、Manual 19件であり、既存試験への正当なRelation不足、試験不足、実装不足、工程Evidenceおよび人間受入待ちをまだ分離中である。既知Gapを閉じる前に全回帰を実行しても完全性を証明しないため、全回帰と署名E2EはGap Closure後へ保留する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| Canonical入力 | REQ 36、UX 32、IA 22、UI 20、SPEC 29、ARCH 18を全件Mapping済み | [Quality Integration](04_Quality_Integration.md) |
| Quality Analysis | 6工程の全入力を、Source固有条件付きで13検証目標へ接続し独立レビュー済み | Reality Auditではこの設計集合を変更せず、現行実装との対応を照合する |
| Quality Definitions | 13定義、154 Local ItemをCanonical化済み | 99件観測済み、55件未観測。定義済みであることを実装済み・試験済みへ読み替えない |
| Architecture詳細設計 | 18領域を適用判定済み | 実装OwnerのないCapability、現実との不一致およびTest未接続をReality Auditで処置する |
| Checker | 現在候補に対する構造・関係検査を実行 | Quality固定後にChecker安定化へ進み、責務分離後に再検証する |
| Reality Audit | In Progress — Blocked by Known Gaps | Coordinator／Project Runtime Pilotに加えて全Subsystemを照合し、55件の未観測Local ItemとRuntime Trustの実装不足を処置する |

## 現在の品質投影

| 軸 | 現在状態 | この状態から主張しないこと |
|---|---|---|
| Designed | Canonical | 実装済みまたは試験可能とは主張しない |
| Implemented | 部分照合 | Runtime Trust等の未実装CapabilityをRelation追加だけで成立へ変えない |
| Executed | 部分実行 | 局所試験結果を未観測55 Local Itemの実行結果へ数えない |
| Passed | 未評価 | 過去版のPassをv0.21.0候補へ流用しない |
| Evidence | 未収集 | 現在候補の対象改訂版・実行条件・結果を持つEvidenceがあるとは主張しない |
| Reality Audit | In Progress | Relationの存在だけからImplemented／Passedを推定しない |

Coordinator／Project Runtimeの17意味Pilotに加えて全Subsystemへ照合範囲を広げた。17意味では自動観測15件、Runtime Trustの実装・Test不足1件、手動UAT待ち1件である。全Local Itemでは99件観測済み、55件未観測であり、Quality Readyへ昇格しない。PT／LTは人間の明示許可がないため実行しない。

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
