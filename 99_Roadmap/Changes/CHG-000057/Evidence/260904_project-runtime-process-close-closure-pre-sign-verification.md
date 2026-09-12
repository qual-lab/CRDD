# Project Runtime Process終了観測の署名前検証

## 1. 結論

技術候補`99b0b2f8a96e9634eedb8c78e69abf29b333aa15`（Tree `406ae2f791f6b7380ef0b3917fdf06ca49f87a7e`）について、Child Processの`exit`が先に観測されても`close`が到達しない場合に永久待機し得たProcess終了観測を是正し、決定論的確認はすべて成功した。

`close`だけをProcessと標準入出力の終了確認とし、独立した有限期限までに観測できなければ`joined: false`へ閉じる。直接の`kill()`要求またはProcess-tree終了helperの開始・終了だけを、対象Processの終了確認へ読み替えない。

これは前候補の独立再監査で残ったMajor 1件に対する署名前技術候補である。Major解消、署名済み実Provider／実Docker E2E、Project Runtime全体の`Pass`およびv0.19 Releaseは、更新した固定改訂版の独立再監査前には成立しない。

## 2. 監査合意と全数対応

最初の着手前合意では「`exit`と`close`を区別する」ことまで具体化したが、`exit`だけが到達し`close`が到達しない反証例を独立した試験へ対応させていなかった。このため、前候補の独立再監査は合意事項の適用漏れとしてMajor 1件を検出した。局所修正を開始せず、同じProcess観測契約について次を監査担当と再合意した。

| 合意した状態・不変条件 | 実装上の処置 | 反証試験 |
|---|---|---|
| 通常観測中 | Runtime Eventと標準入出力を所有し、一次期限まで待つ | 固定子Processの正常応答・EOF・`close` |
| 一次期限到達 | 入力を閉じ、猶予期間中は`close`を待つ | timeout後のProcess停止 |
| 猶予期間到達 | 対象がliveの場合だけfallback killを要求する | fallback killを終了確認へ昇格しない |
| 最終期限までに`close`到達 | 保有timerと結果用listenerを解除し、`joined: true`を返す | 正常`close`後に遅延kill・結果変更・listener残存がない |
| `exit`到達済みでも最終期限まで`close`未到達 | `joined: false`、終了結果なし、Process-tree確認なしで有限時間に返す | `exit`先着・`close`欠落 |
| 最終期限後の遅延通知 | 結果解析を再開せず、実際の`close`まで非結果化したerror sinkが資源を所有する | 遅延child errorと遅延`close`で結果不変・sink解放 |
| Process-tree helperの不成立 | 開始不能、待機期限、非0終了、signal、出力超過、helper `close`未観測をすべて未確認にする | helper不成立6形 |
| 共通最終期限 | helperの開始・待機・停止も同じ絶対期限の残時間だけを使う | helper不成立と対象Child `close`の組合せ |

変更禁止範囲は、Provider選定、外部送信Authority、Recovery／正本採用、Client入力、MCP Transport、raw Provider出力非公開および署名Identityとした。

## 3. 確認結果

| 確認 | 結果 |
|---|---|
| Process観測の集中契約試験 | 24件中24件成功 |
| 制限Process試験 | 1,625件中1,625件成功、失敗・取消・skip 0、257.122秒 |
| Windows実資源Gate | 7件中7件成功、3.307秒 |
| Coordinator決定論的確認 | 型、lint、format、Runtime／Project設計追跡を含め成功 |
| CRDD文書チェッカー | 411文書、2,891リンク、976アンカー、エラー0、警告0 |
| 差分形式 | `git diff --check`成功 |

## 4. Evidenceの置換関係

[E2E観測契約の署名前検証](2026-09-04_Project_Runtime_E2E_Observation_Closure_Pre_Sign_Verification.md)は、記録時点の固定改訂版と、そこで成立していたRuntime Event、回復Identity相関および診断streamの検証結果として保持する。ただし、同記録のProcess終了観測が独立再監査へ渡せる候補として成立したという現在状態は、その後のMajorによって否定された。本記録がProcess終了観測の現在Evidenceを置き換え、旧記録を当該Majorの解消根拠へ流用しない。

その後の独立再監査は、端末streamの`destroyed`と`closed`の状態母集団、および公開結果を構成する全利用側への適用漏れをMajorとして検出した。このため、本記録も当時の固定改訂版に対する履歴として保持し、現在のProcess・端末資源観測の根拠は[端末資源観測の署名前検証](2026-09-04_Project_Runtime_Terminal_Observation_Closure_Pre_Sign_Verification.md)が置き換える。

## 5. 次のGate

本記録を含む新しい固定CommitへRepository全体Checkerを一度再実行し、再合意した状態機械、絶対期限、error sink、helper不成立形、変更禁止範囲および全数対応を独立再監査する。Critical 0件かつMajor 0件を確認した後だけ、Runtime実行Identityの署名と署名済み最終E2Eへ進む。新しい非文書Findingを検出した場合は局所修正せず、契約母集団と利用側母集団を再確認して修正方針を固定し直す。
