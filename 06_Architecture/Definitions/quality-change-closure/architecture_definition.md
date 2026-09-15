# 変更・監査・試験・品質の閉包のArchitecture定義

成果物種別: Architecture定義
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。

| 区分 | 内容 |
|---|---|
| 状態Owner | Quality Centerと変更追跡 |
| 所有する責務 | 同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合 |
| 所有しない責務 | 各監査の専門判断、リスク受容、Release判断 |
| 主な外部境界 | CHG、監査結果、試験結果、Quality Center |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000015](../../Analysis/UI-000015/architecture_analysis.md) | 監査・変更・試験・品質の追跡 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000020](../../Analysis/SPEC-000020/architecture_analysis.md) | 変更・監査・試験・品質の閉包を評価する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000015 | UI | Quality Centerと変更追跡 | UI契約はAuthorityを発行しない。利用者操作: 指摘を見る／根拠を開く／次Gateへ進む | UI契約はEffectを定義しない。表示上の状態差: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。導線: 固定版→監査集合→統合方針→是正→再固定→判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 同じ改訂版上で指摘、是正、試験、品質状態を辿れる。 → 結果と次の行動を認識する |
| SPEC-000020 | SPEC | Quality Centerと変更追跡 | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める | 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。 | 試験件数や一部監査完了から全体Passを推定しない。 | [変更候補] -> [レビュー／監査／試験を対応付け] -> [Pass／Finding／未実施／非該当] -> [残るGate] |

## 5. 構造と依存方向

```text
[Quality Centerと変更追跡]
└─ [SPEC-000020: 変更・監査・試験・品質の閉包を評価する]
   [変更候補] -> [レビュー／監査／試験を対応付け] -> [Pass／Finding／未実施／非該当] -> [残るGate]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000015 | Quality Centerと変更追跡 | UI契約はAuthorityを発行しない。利用者操作: 指摘を見る／根拠を開く／次Gateへ進む | UI契約はEffectを定義しない。表示上の状態差: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。導線: 固定版→監査集合→統合方針→是正→再固定→判断 |
| SPEC-000020 | Quality Centerと変更追跡 | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める | 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000020: 試験件数や一部監査完了から全体Passを推定しない。Effect: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000015 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000020 | 試験件数や一部監査完了から全体Passを推定しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のQuality Centerと監査集合 | Quality Center／変更追跡 | Quality Centerと変更追跡 | 保持・再編 | [CHG-000073 §5](../../../99_Roadmap/Changes/CHG-000073/change.md#5-独立レビューと構造是正) | 工程別Definitionの再構築確認へ接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「同じ改訂版に対する指摘、是正、試験Evidence、未確認範囲、現在Gateの統合」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 候補固定→必須確認→結果統合→是正または人間判断→品質状態更新を段階的な結合試験で確認する。
- 別改訂版の結果混入、必須監査の途中縮小、部分Passの全体Pass化を理由別に反証する。
- 外部TaskのRecoveryは非該当。確認中断時は未確認範囲を保持する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../../07_Quality/01_Quality_Center.md)
- [現行照合先](../../../16_Quality_Assurance.md)
