# UIとSPECの引き渡し

状態: v0.22.0更新中（最新の権限分担のDefinition・横断投影は限定伝播・限定独立レビュー済み・残指摘0。Detail以降は未追従、全体Readyは未主張）

この文書はUI側からUI／SPEC対応レビューへ渡す契約を所有する。UI／SPEC対応レビューの結果は[UI／SPEC対応](../05_SPEC/06_UI_SPEC_Correspondence.md)を正本とし、ここへ第二の結果を作らない。UI契約Readyは完全なUI工程ExitまたはArchitectureへの通常Handoffを意味しない。

最新の権限分担のDefinition・現行1組対応・横断投影は限定伝播・限定独立レビュー済み・残指摘0。SCR-000008／BHV-000012・Area・Workbench候補は最新分担へ未追従。前判断の限定Passと下記の全数記録は履歴であり、新判断の完成根拠にしない。

更新前固定版の履歴: 以下の全数処置・入力準備済みの記述は更新前の範囲を表す。UI-000008の現在契約はDefinitionを優先する。鍵交換2操作のSCR-000008／BHV-000012とDetail対応は基準Commit `69f8d463`で限定独立レビュー済み。過去32組のPassを流用しない。採用済み入口の具体表示・案内・実画面評価・人間によるUI工程Exitは未完了で、全体Readyを主張しない。

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

UI-000008の最新引渡しは[固定8操作分担](Definitions/UI-000008/ui_definition.md#管理操作の固定分担)と操作・Feedbackを参照する。managerの業務管理、administratorだけの管理者Role・詳細権限と鍵操作、manager自身の変更前認可→明示更新→次要求反映、登録≠公開・解除≠削除をSPEC-000012へ対応付ける。鍵3操作・MCP鍵0・Host交換2の既存境界は維持する。現行対応の判定はSPEC側の最新節だけに記録し、Detail以降の完了を推定しない。

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

更新前固定版の履歴: Definition対応のv0.21固定時点では29 BHV／31 Relationを[UI／SPEC対応](../05_SPEC/06_UI_SPEC_Correspondence.md)で確認した。今回のUI-000008／SPEC-000012更新前のv0.22固定版ではBHV-000031とRelationを1件追加し、30 BHV／32 Relationを[UI／SPEC Detail対応](../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)で双方向に全件確認して`Pass`とした。前判断のDetail限定対応は確認済み。更新前固定版のDefinition対応と横断投影は限定独立レビュー済みであり、この過去Passを現在の引き渡し完了へ読み替えない。

## Checklist

チェック済み項目は今回更新前の固定版の確認記録である。

- [x] UIとSPECの共通正式入力を明示した
- [x] UIとSPECの責任境界を区別した
- [x] UI別に渡す操作・状態・Feedbackを明示した
- [x] Definition対応とDetail対応を区別した
- [x] SCR／PRT／InteractionとBHVのCoverageを明示した
- [x] 既存のDefinition引き渡し結果と新Detail移行結果を区別した
- [x] 対象改訂版で発行済みのSCR／PRT／BHVとDetail Relationを全件確認した
- [x] 共通Variantを全UIへ一律適用していない
- [x] UI側の引き渡し完了条件を明示した
- [x] 対応レビュー結果の正本をSPEC側の対応文書へ一本化した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] UI／SPEC独自の第三仕様を作っていない
- [x] 補足分析へ必須情報を退避していない
- OPEN: 最新の権限分担のDefinition・現行1組対応・横断投影は限定伝播・限定独立レビュー済み・残指摘0。SCR-000008／BHV-000012・Area・Workbench候補は最新分担へ未追従。採用済み入口の具体表示・案内・実画面評価・工程ExitとArchitecture／Quality以降は未完了。旧完成記録を新版へ流用しない。
