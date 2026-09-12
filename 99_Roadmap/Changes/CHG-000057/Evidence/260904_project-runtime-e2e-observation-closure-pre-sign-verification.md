# Project Runtime E2E観測契約の署名前検証

## 1. 結論

技術候補`c574e13e032e1471d0893e9a7f523e7b2717661e`（Tree `fa41eb2f723131822250fdb1c5506cffb1b79239`）について、実回復E2Eが依存するRuntime Event、Process終了、回復Identity相関および診断出力の観測契約を一体で是正し、決定論的確認はすべて成功した。

これは独立再監査へ渡せる署名前候補の成立を示す。Critical／Majorの解消、署名済み実Provider／実Docker E2E、Project Runtime全体の`Pass`およびv0.19 Releaseはまだ成立していない。

## 2. 独立監査との着手前整合

前候補`37b629f25a7dcac1847e602f73e8dddc2bf43224`の独立監査はCritical 0件、Major 3件、Minor 0件だった。個別修正を開始せず、3件を「公開E2E観測契約の伝播未完」としてまとめ、次を修正前に監査担当と合意した。

- Runtime EventはProducer別の固定prefixと閉じたSchemaを持ち、不正な既知prefixをProtocol違反、無関係な行を非Eventとして扱う。
- Event parserはUTF-8のchunk分割、CRLF、byte上限および改行前EOFを一回の増分処理で判定し、生の標準エラー文字列を操作Triggerへ渡さない。
- Parent Process喪失はWindowsの固定Process-tree終了helperとChild Processの`close`観測へ結合し、直接`kill()`を終了確認へ読み替えない。
- 7段階の回復EventはProject、Milestone、Queue、Task、Operation、Recovery IDおよび世代を利用側結果と相関する。
- 回復診断はstream単位の永続ownerが直列化し、callback成功、callback失敗、stream error、stream close、timeout、利用不能および同期例外を区別する。
- Provider選定、外部送信Authority、Recovery／採用意味、Client入力、Transport、raw Provider出力非公開を変更しない。

監査担当から、既知prefix不正後の操作停止、Process `exit`と`close`の区別、Queue／Taskのexact相関、timeout後の遅延callback／error、旧Evidenceの誤主張の明示的な置換を追加条件として受け、同じ修正契約へ統合してから編集した。

## 3. 実装と反証

- Runtime Eventを固定Schemaで検証し、既知prefixの不正・未完了、prefix外の埋込みJSON、役割／Provider差、余分・重複・順序違反を操作へ昇格しない。
- UTF-8 decoderによる増分処理でchunk分割とCRLFを一度だけ復元し、EOF時の未完了既知EventをProtocol違反にする。
- Windows Process tree停止を既存の制限環境、固定`taskkill.exe`、固定引数および所有Process handleへ接続し、helperの正常終了と対象Childの`close`を分けて観測する。
- 回復EventのQueue IDを公開MCP結果のQueue IDへ、最初の5段階のTask IDを同じ非Authority相関anchorへexactに結合する。Queue、Task、OperationまたはTrigger Operationの一件差は回復成立を偽にする。
- 診断streamの複数writeを直列化し、callback error、stream error／close、timeout、同期throw、disposeを閉じた結果へ変換する。timeout後の遅延callbackと遅延errorは二重完了や未処理errorへ流さない。診断失敗は回復Authorityまたは回復失敗を生成しない。

## 4. 確認結果

| 確認 | 結果 |
|---|---|
| E2E観測・公開Runtimeの集中契約試験 | 22件中22件成功 |
| Windows Process-tree終了helperの固定境界 | 1件中1件成功 |
| 制限Process試験 | 1,615件中1,615件成功、失敗・取消・skip 0、309.883秒 |
| Windows実資源Gate | 7件中7件成功、3.889秒 |
| Coordinator決定論的確認 | 型、lint、format、Runtime／Project設計追跡を含め成功 |
| CRDD文書チェッカー | 409文書、2,886リンク、976アンカー、エラー0、警告0 |
| 差分形式 | `git diff --check`成功 |

## 5. 旧記録の扱い

[実回復E2Eの署名前検証](2026-09-04_Project_Runtime_Recovery_E2E_Pre_Sign_Verification.md)は、記録時点のGit履歴として保持する。ただし同記録の「Queue／Taskまでexactに相関した」「診断streamの各終端を区別した」という現在候補に関する主張は、その後の独立監査で未成立と判明したため、本記録が置き換える。旧記録を現在候補の最上位Evidenceまたは解消根拠へ流用しない。

## 6. 次のGate

本記録を含む固定CommitへRepository全体Checkerを再実行し、合意済みの変更契約、Major 3件、変更禁止範囲、利用側相関および新規回帰を独立再監査する。Critical 0件かつMajor 0件を確認した後だけ、Runtime Execution Identityの署名と署名済み最終E2Eへ進む。新しい非文書Findingを検出した場合は局所修正せず、契約母集団と利用側母集団を再確認して修正方針を固定し直す。
