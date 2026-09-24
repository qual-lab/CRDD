# UIとSPECの引き渡し

状態: UI契約Ready。UI／SPEC対応レビューへの入力準備済み。UI工程Exitは未完了

この文書はUI側からUI／SPEC対応レビューへ渡す契約を所有する。UI／SPEC対応レビューの結果は[UI／SPEC対応](../05_SPEC/06_UI_SPEC_Correspondence.md)を正本とし、ここへ第二の結果を作らない。UI契約Readyは完全なUI工程ExitまたはArchitectureへの通常Handoffを意味しない。

## 1. 共通の正式入力

```text
UX定義 ─→ UX観点のUI分析 ─┐
                           ├─→ UI定義
IA定義 ─→ IA観点のUI分析 ─┘

UX定義 ─→ UX観点のSPEC分析 ─┐
                             ├─→ SPEC定義
IA定義 ─→ IA観点のSPEC分析 ─┘

UI定義 ───── pairs_with ───── SPEC定義
```

UIとSPECはいずれもREQを直接入力にしない。REQはUXを介して履歴上たどれる。どちらかがUX・IAの不足を見つけた場合、その場で補完せず上流を再開する。

## 2. 責任分担

| 同じ場面で必要なこと | UIが定義する | SPECが定義する |
|---|---|---|
| 操作開始 | 利用者に見える操作、入力補助、実行前Feedback | 発火条件、Authority、入力検証、Effect開始条件 |
| 処理中 | 待機、取消可否、進行状況の表現 | 処理状態、取消受付、競合、時間切れ |
| 完了 | 結果、根拠、次の操作 | 成功条件、出力、状態変更、Effect |
| 失敗 | 理由、影響、回復導線 | 失敗分類、状態保持、再試行・回復条件 |
| 権限差 | 表示／非表示、無効理由、Credential切替 | 認証・認可、開示可否、拒否結果 |
| 不完全性 | missing等を誤認させない表示 | 欠測・古さ・競合を返す条件と値 |

## 3. SPECへ渡すUI別情報

各UI定義は、[UIごとの適用範囲](03_Interaction_and_State_Model.md#uiごとの適用範囲)でそのUIに選ばれた状態だけを渡す。共通Variantの一覧を全UIの必須状態として扱わない。

- 対象となるUX／IAの組
- 利用者操作と操作前に見える情報
- 個別UIに適用すると判断した状態と、適用しない状態
- 必要なFeedbackと次の行動
- 表示してはならない情報
- UI側の検証意図

SPECはこれらを再定義せず、同じUX／IAから観測可能な条件、状態、振る舞い、結果、Effect、失敗、回復へ変換する。

## 4. UI側の引き渡し完了条件

- UIとSPECが同じUX／IAの組を扱う。
- UI上の操作にSPECの発火条件と結果がある。
- SPECの状態・失敗・回復にUIの認識可能なFeedbackがある。
- 片側だけの状態、Authority、Effect、欠測または例外を残さない。
- 上流の不足をUI／SPECの推測で埋めていない。
- `pairs_with`をUI定義から辿れる。

## 5. 未確認事項と戻り条件

- UI側のCanonical入力は全数処置したが、正式入力から継承した実利用上の未確認事項は各分析・定義に保持している。
- 表示面ごとのPrototype／実画面評価と人間によるUI工程Exit判断は未完了である。
- UI操作、表示状態またはFeedbackに対応するSPEC契約がない場合はSPECへ戻す。
- 上流の利用者成果または情報契約が不足する場合は、UIで推測せずUXまたはIAへ戻す。
- 対応レビューの判定は[UI／SPEC対応](../05_SPEC/06_UI_SPEC_Correspondence.md)へ記録する。

## 6. 補足分析

なし。

Definition対応のv0.21結果は[UI／SPEC対応](../05_SPEC/06_UI_SPEC_Correspondence.md)を維持する。新しいDetail対応は[UI／SPEC Detail対応](../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)で別に扱い、現在は`OPEN`である。

## Checklist

- [x] UIとSPECの共通正式入力を明示した
- [x] UIとSPECの責任境界を区別した
- [x] UI別に渡す操作・状態・Feedbackを明示した
- [x] Definition対応とDetail対応を区別した
- [x] SCR／PRT／InteractionとBHVのCoverageを明示した
- [x] 既存の引き渡し結果と新Detail契約のOPENを区別した
- [x] 共通Variantを全UIへ一律適用していない
- [x] UI側の引き渡し完了条件を明示した
- [x] 対応レビュー結果の正本をSPEC側の対応文書へ一本化した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] UI／SPEC独自の第三仕様を作っていない
- [x] 補足分析へ必須情報を退避していない
