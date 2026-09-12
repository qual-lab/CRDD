# Project Runtime端末資源観測の署名前検証

## 1. 結論

技術候補`003b72fc684ce1bb45ef334e9008a7b698f58f30`（Tree `39d0eab19de3207341f49575dd023051ca832e68`）について、標準入出力の`destroyed`を実際の`close`観測と同一視していた適用漏れを是正した。`stdin`、`stdout`、`stderr`およびChild Processは、実際に`close`した場合だけ遅延`error`の所有を終了する。`destroyed: true, closed: false`では、結果へ影響しない専用sinkを実`close`まで保持する。

また、Process-tree終了helperの開始または待機が永久保留し、fallback kill要求後も対象Childの`close`が到達しない複合状態を、共通の絶対期限内に`joined: false`へ閉じる。公開結果を構成する通常2経路、取消、親喪失回復および回復再入場の全利用側は、いずれも`joined: false`を成功へ昇格しない。

本記録は、前候補の独立再監査で検出したMajor 1件と、再合意時に追加された2条件に対する署名前技術候補の検証である。Major解消、署名適格、署名済み実Provider／実Docker E2Eまたはv0.19 Releaseは、更新した固定改訂版の独立再監査前には成立しない。

## 2. 監査合意と双方向の全数対応

前候補ではProcessの`exit`と`close`を分離したが、端末streamの`destroyed`と`closed`の状態母集団、および公開結果を構成する全利用側を合意事項から試験へ全数展開できていなかった。このため、個別修正を始めず、監査担当と次の具体化を行った。

| 合意ID | 状態・期待結果 | 実装上の所有者 | 反証試験 | 変更していない範囲 |
|---|---|---|---|---|
| `A-OPEN` | 未破棄・未closeのstreamはsinkを付けて破棄要求し、実`close`まで所有する | `observePublicMcpProcess`の端末資源終了処理 | 正常ChildのEOF／`close`、既存の入出力失敗試験 | Provider出力の解析と成功条件 |
| `A-DESTROYED-UNCLOSED` | `destroyed: true, closed: false`は終了済みと扱わず、複数の遅延`error`を実`close`まで吸収する | 同上 | 3 streamそれぞれの既存listener保持、複数遅延`error`、遅延`data`非採用、実`close`後の専用sinkだけの解除 | 既存listener、結果、Runtime Event |
| `A-CLOSED` | `closed: true`だけを端末資源の所有終了として扱う | 同上 | 実`close`後のlistener基準値復元 | 既存listener |
| `B-START-PENDING` | helper `started()`が永久保留でも共通絶対期限内に未joinを返す | Process-tree helper待機と終了観測 | `started()`永久保留、fallback kill成功、Child `close`欠落、遅延resolve後も結果不変 | helperの正常形と既存失敗分類 |
| `B-WAIT-PENDING` | helper `wait()`が永久保留でも同じ期限内に未joinを返す | 同上 | `wait()`永久保留、fallback kill成功、Child `close`欠落、遅延resolve後も結果不変 | 同上 |
| `C-NORMAL-1` | 通常経路1の`joined: false`は全体をblockedにする | 公開E2E結果builder | `normal_1_child_not_joined` | 経路Identityと正本差分 |
| `C-NORMAL-2` | 通常経路2の`joined: false`は全体をblockedにする | 同上 | `normal_2_child_not_joined` | 同上 |
| `C-CANCEL` | 取消経路の`joined: false`は全体をblockedにする | 同上 | `cancellation_child_not_joined` | 取消理由、Effect、Recovery |
| `C-PARENT-LOSS` | 親喪失経路の`joined: false`は回復成立にしない | 同上 | `recovery_parent_not_joined` | 回復Identity相関 |
| `C-REENTRY` | 回復再入場の`joined: false`は回復成立にしない | 同上 | `recovery_reentry_child_not_joined` | 回復Identity相関 |

固定候補前に、合意IDから実装・反証試験への未対応がないことと、追加した実装・試験がいずれかの合意IDへ戻れることを双方向に確認した。変更禁止範囲は、Provider選定、外部送信Authority、Recovery／正本採用、Client入力、MCP Transport、raw Provider出力非公開、Platform境界および署名Identityである。

## 3. 確認結果

| 確認 | 結果 |
|---|---|
| Process観測の集中契約試験 | 27件中27件成功、3.416秒 |
| 制限Process試験 | 1,628件中1,628件成功、失敗・取消・skip 0、282.316秒 |
| Windows実資源Gate | 7件中7件成功、3.647秒 |
| Coordinator決定論的確認 | 型、lint、format、Runtime／Project設計追跡を含め成功 |
| CRDD文書チェッカー | 412文書、2,895リンク、976アンカー、エラー0、警告0 |
| 差分形式 | `git diff --check`成功 |

## 4. Evidenceの置換関係

[Process終了観測の署名前検証](2026-09-04_Project_Runtime_Process_Close_Closure_Pre_Sign_Verification.md)は、記録時点で確認した`exit`先着、実`close`、共通期限およびhelper不成立形の履歴として保持する。ただし、同記録が独立再監査へ渡せる現在候補であるという主張は、端末stream状態と全利用側への適用漏れを検出したため成立しない。本記録がProcess・端末資源観測の現在Evidenceを置き換え、旧記録を当該Majorの解消根拠へ流用しない。

## 5. 次のGate

本記録を含む固定CommitへRepository全体Checkerを再実行し、本表の合意ID、実装、反証試験、変更禁止範囲および双方向の全数対応を独立再監査する。Critical 0件かつMajor 0件を確認した後だけ、監査合意の具体化と適用網羅をCRDDの汎用規則へ還元し、Runtime実行Identityの署名と署名済み最終E2Eへ進む。新しい非文書Findingを検出した場合は局所修正せず、契約母集団と利用側母集団を再確認して修正方針を固定し直す。

## 6. 独立再監査と規則への還元

固定Commit `74b7650e45e0f7f4071cf6e72149e1afd70f1f19`（Tree `3f039ccf3dbe3459eb525b04128fbeb46e25a74e`）の独立再監査は、Critical 0件、Major 0件、Minor 0件で`Pass`した。前回Major 2点を解消し、A／B／Cの全合意条件、実装、全利用側、反証試験、Evidenceの双方向対応、変更禁止範囲および公開Process観測の全参照を確認した。未評価は公式鍵署名、署名済み実Provider／実Docker E2E、およびv0.19で宣言していないLinux／macOSの追加保証である。

この結果から、監査との抽象的な方針合意だけでは具体適用の網羅を保証せず、期待状態、実装または適用先、反証、変更禁止範囲および根拠まで具体化した同じ条件集合と、固定候補の実差分による双方向確認が収束に有効だったと判断した。[エージェント](../../10_Agent.md#75-audit-aggregation-and-reconciliation)と[保守](../../19_Maintenance.md#31-tracked-change-execution-contract)へ、専用成果物を増やさず同じ原則を還元した。規則の独立文書レビューは初回Minor 1件を検出し、非コード是正にも適用できるよう「実装または適用先」「該当する全利用側」へ限定修正した。Commit `32d939b`の再確認はCritical 0件、Major 0件、Minor 0件で`Pass`した。

署名前Gateは通過した。次のGateはRuntime実行Identityの署名と署名済み最終E2Eである。
