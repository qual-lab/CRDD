# SPEC-000021のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000021`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000021 外部送信の同意範囲を検証して送信する](../../../05_SPEC/Definitions/SPEC-000021/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

外部送信の同意範囲を検証して送信する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 情報を外部へ送る時 |
| 事前条件 | 送信先、目的、情報分類、対象範囲、同意の有効性を確認できる |
| Authority | 送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[送信候補] -> [同意検証]
  ├ valid -> [送信Effect発行] -> [送信済み]
  └ invalid／unknown -> [Effect 0]
```

- 振る舞い: 送信先、目的、情報分類、対象範囲、同意状態を検証し、許可された最小情報だけを送る。
- 成功条件: 送信前検査と送信Effectを区別し、利用した同意範囲を結果へ結合する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。
- 副作用: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 送信前検査と送信Effectを区別し、利用した同意範囲を結果へ結合する |
| 境界 | 同意範囲内／範囲外、有効／期限切れ／不明を分け、範囲外では送信Effectを発行しない |
| 失敗 | 期限切れ・範囲変更・不明な同意ではEffect 0で停止する |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する」と矛盾する結果を返さない |
| 対応UI | [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [外部送信・結果帰還・候補採用のArchitecture定義](../../Definitions/ARCH-000015/architecture_definition.md) | 外部送信Controller | 送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない | 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。 | 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [外部送信・結果帰還・候補採用](../../Definitions/ARCH-000015/architecture_definition.md) | Same | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000016
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
