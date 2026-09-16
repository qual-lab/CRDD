# SPEC-000020のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000020`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000020 変更・監査・試験・品質の閉包を評価する](../../../05_SPEC/Definitions/SPEC-000020/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

変更・監査・試験・品質の閉包を評価する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 変更候補を工程移行または公開判断へ進める時 |
| 事前条件 | 同じ変更改訂版、監査集合、是正、試験層、Evidenceを特定できる |
| Authority | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[変更候補] -> [レビュー／監査／試験を対応付け]
 -> [Pass／Finding／未実施／非該当] -> [残るGate]
```

- 振る舞い: 対象改訂版、指摘、是正、試験層、根拠、残るGateを同じ変更へ結合して現在状態を評価する。
- 成功条件: 未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 試験件数や一部監査完了から全体Passを推定しない。
- 副作用: 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 未実施・非該当・失敗・Passを区別し、人間判断が残る場合だけ提示する |
| 境界 | 未実施／非該当／失敗／Pass、現改訂版／旧改訂版を分け、一部結果を全体Passへ広げない |
| 失敗 | 試験件数や一部監査完了から全体Passを推定しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000015](../../../04_UI/Definitions/UI-000015/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [変更・監査・試験・品質の閉包のArchitecture定義](../../Definitions/ARCH-000003/architecture_definition.md) | Quality Centerと変更追跡 | 各レビューは所管範囲を評価し、人間が工程移行・採用・Releaseを決める | 評価記録は更新できるが、Pass表示から統合・Release Effectを自動発行しない。 | 試験件数や一部監査完了から全体Passを推定しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [変更・監査・試験・品質の閉包](../../Definitions/ARCH-000003/architecture_definition.md) | Same | レビュー件数や試験件数を品質へ読み替えず、同じ固定改訂版に対する必須確認がすべて終わった時だけ工程状態を更新する。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000015
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
