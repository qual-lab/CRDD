# v0.19 Project Runtime確認済み回復の収束に関する署名前検証

状態: Pre-sign Candidate Verification Completed
担当責任者: Qual-Lab
実施日: 2026-09-03

## 結論

Docker回復完了後の確認済み状態を、Project StateとRuntime Stateの双方から再構成できる耐久プロトコルへ改めた技術候補を固定した。MCP公開結果についても、状態機械上到達可能な進捗と外側のObjective結果が一致する場合だけ返す。決定論的な全試験とWindows実資源Gateは合格した。

これは署名前の技術候補に対する結果であり、実Docker資源、認証済みMCP Client、実Provider実行中取消、Runtime実行Identityの署名またはv0.19 Releaseの成立を意味しない。

## 対象

- 対象変更: [CHG-000057](../../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)
- 技術候補Commit: `3125d9d93ada0b92005c09b12b8a1739c7ee1ad0`
- 技術候補Tree: `4a59a85568a340d123ad347e2fb4f470e9526e67`
- 対象範囲: Docker完了Receipt、確認用Tombstone、Project側の耐久確認、Queue settlement、MCP Projectionの到達可能性とObjective相関

## 結果

| 確認 | 結果 |
|---|---|
| Coordinator `npm run check` | 成功。Runtime設計追跡9資源・20状態・21遷移、Project Runtime設計追跡9 Interface・10永続Record・14資源・4 Lock・7 Authority・9 Effect・7状態機械・54遷移／対応・32不変条件・16失敗注入点・23検証接続を受理 |
| 関連する契約・結合試験 | 165件成功 |
| 入れ子入力のdescriptor-safe境界試験 | 1件成功。accessorとProxyを実行せず拒否 |
| 設計追跡契約試験 | 13件成功 |
| 制限Process試験全体 | 1,561件中1,561件成功、失敗・取消・skip 0、416.334秒 |
| Windows実資源Gate | Native Process権限を持つ環境で7件中7件成功、約5.2秒 |
| CRDD Checker | 本Evidenceと参照更新を含む403文書、2,868リンク、970アンカー、Error 0、Warning 0 |
| 差分・履歴整合 | `git diff --check`成功。既存の[署名前検証](2026-09-03_Project_Runtime_Pre_Sign_Verification.md)は記録時Commitのblobへ復元し、今回の結果で上書きしていない |

Windows実資源Gateは制限されたSandbox内では7件すべてで子孫Processの終了観測が成立せず、同じ候補をNative Process権限で実行すると7件すべて成立した。前者を候補の成功へ読み替えず、実OS資源の合否は後者を根拠とする。Sandbox内の失敗は、試験対象が要求するProcess制御権限と実行環境の差として保持する。

## 確認した意味

- Receiptと確認用Tombstoneの作成・除去は、同じ内容と対象に限って中断後に再開する。
- Project StateはRepository Binding、Project、Milestone、Task、attempt、Operation、settlement世代、Runtime Rootの4 hash、Receipt committed pairのhashとidentityを確認済み情報として耐久化する。
- Project側の確認済みreadback後に一時Tombstoneを回収し、時刻やLRUではなく完了した意味遷移によって有限寿命を保証する。
- 65件を超える連続回復、旧Receipt再投入、作成・除去の片側中断でも、正常な利用が上限へ蓄積せず、別対象を誤って確認または削除しない。
- MCP公開Projectionは到達可能なMilestoneと件数だけを受理し、外側Objectiveの完了・取消・人間判断・回復状態との矛盾をEffect 0で拒否する。

## 残る最終確認

固定候補の独立レビューと必要な監査を先に完了し、その後に次を同じRuntime実行Identityで確認する。

1. 認証済みの公開MCP Clientから実Providerへ到達する代表経路。
2. 実Providerの実行中取消と、終了後の資源・Authority・Recovery状態。
3. 利用可能な実Docker資源によるRecovery settlement。Docker Desktopが利用不能な場合は未成立として保持し、決定論的試験で代替したと表示しない。

これらと独立確認が完了するまで、Project Runtime全体、公開MCPまたはv0.19 Releaseを`Pass`と表示しない。
