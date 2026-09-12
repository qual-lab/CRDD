# 新配置の署名済み4経路・復旧E2E

対象変更: [CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)
実測日: 2026-08-31（Asia/Tokyo）
状態: 実測完了。Runtime全体の完成監査・統合・リリース判断は別途

## 結論

署名固定版`45ea2ac`の共通起動入口で実Providerの4経路が4/4完了した。復旧試験は初回に起動用PowerShellの環境引継ぎミスで停止し、残った1件を既存の回復入口で回収した後、同じ配布物で7シナリオが完了した。失敗した実行を成功へ書き換えず、[保存結果3件](CHG-000015_Signed_E2E_45ea2ac.json)に保持する。

| 指定した依頼元 | 実行担当 | 独立レビュー担当 | 結果 |
|---|---|---|---|
| Codex | Claude Code | Codex | 完了 |
| Claude Code | Codex | Claude Code | 完了 |
| Codex | Codex | Claude Code | 完了 |
| Claude Code | Claude Code | Codex | 完了 |

4経路の再試行・是正は0。全候補の内容完全一致と破棄、資源回収、手動回復不要、正本Repository非変更を確認した。全経路で既存同意を再利用した。依頼元は要求Profileであり、実アプリのIdentity認証ではない。同一Providerの実行経路でも、レビューは実行担当と異なるProviderである。

## 固定対象と実行条件

- Commit: `45ea2acd5cac21ce0b5cb3256f2cb0656ec8b37a`
- Tree: `082d8b2499477cc5f711b2a8508f48ab31d0fe0e`
- Release Sequence: `2026083109`
- manifestのRuntime識別hash: `86460fc19ffc3bc916bfaa1effd3f073b7ae3e5f322f074f7571e994033b570a`
- package content root: `72fd5ec72f9adbf7d2e02a62eac573400cc845d1568283c4b5c2decdb3a7704b`
- Node.js: `24.19.0`、Windows、検証した絶対Pathの実行ファイルを使用
- 配布候補: Repository-local `.crdd/release-staging/final-45ea2ac`
- 起動入口: 同候補の`40_Develop/coordinator/bin/launch.ts`から`verify-routes`／`verify-recovery`
- 実行対象: 許可された固定検証Taskと専用Provider Home。既存Subscriptionだけを使い、API keyへの切替や追加購入は行わない

4経路は13:05:06.972Z～13:12:35.474Zの448.502秒。再実行した復旧試験は13:15:10.379Z～13:15:25.114Zの14.735秒。いずれも保存処理が観測した開始から結果確定までであり、Process生成からclose、人間の受入時間、AI推論時間とは区別する。4経路の外部端末出力は終了0を示した。復旧再実行は保存結果の`completed`と`signed_recovery_matrix_verified`を照合した。

## 復旧試験の初回停止と是正

初回は`cleanup_observation_unknown_then_recover`で停止した。元の端末結果は`signed_recovery_matrix_cleanup_unknown_recovery_failed`であり、限定保存の理由表示は許可集合外のため`unknown`となった。単一の回復IDは保存され、原因が不明な状態を完了扱いしていない。

起動用PowerShellが署名準備用の`TEMP`／`TMP`をRepository-local `.crdd/test-tmp`に変更したまま復旧試験へ引き継いだ。親はその場所を探す一方、試験用の子ProcessはOS由来のユーザー一時領域へ記録を作るため、回復記録の場所が一致しなかった。正確なIDに対応するDirectoryがOS側に存在し、Repository側に存在しないことを確認した。

同じ署名版の`automation doctor --recover-isolation <保存したexact ID> --json`を既定環境から実行し、`docker_probe_recovery_completed`、`hostCleanupCompleted: true`、回復IDなし、手動回復不要を確認した。別候補の削除やDocker Desktop修復は行わなかった。起動用PowerShellから環境上書きを除き、共通入口から復旧試験だけを再実行した。配布物の改変・再署名・4経路の再実行はしていない。

再実行では時間切れ、出力上限、不正出力、非ゼロ終了、取消、回収観測不明からの新しいProcessによる回復、親Process消失後の回復を確認した。固定Workerによる試験であり、Provider認証・Provider通信を使った障害試験ではない。最終結果は資源回収確認済み・手動回復不要である。

## 記録の同一性と限界

3件とも開始・結果・完了記録のID、種別、開始時刻と、結果byte列のSHA-256を照合した。添付JSONはそれらをJSONとして正規化した写しであり、`sourceResultSha256`は元の結果fileのbyte列を指す。添付file全体のhashではない。署名済みEvidenceや回復を許すAuthorityには昇格しない。

| 記録 | 元の結果fileのSHA-256 |
|---|---|
| 4経路完了 | `4bd4a5c3a4836166c07436f6886b0a03a99e86ed731bd9eb46e852c87927eb02` |
| 復旧再実行完了 | `ecdbe3398e73401a23703e8c77465f43ae7ce89d2235982ed0ef590ffa8189b2` |

- 限定保存では取得していないfieldを`null`／`unknown`で保持する。これらを0、false、検証済みへ補正しない。
- 固定Task各経路1回の結果であり、任意Task、実Providerの取消・是正、全障害組合せ、長期安定性を保証しない。
- 同じ共通入口の`automation task --request-stdin --json`による通常入力搬送は、別の[実務測定](CHG-000055_Utility_45ea2ac.md)で確認する。
- 起動失敗の今回の原因は運用側の環境引継ぎである。既存の起動手順を使用するだけでなく、段階固有の環境変更を次段へ漏らさない点を同じCHGの学びとして保持する。新しい汎用Security機構は追加しない。
- 完成監査、採用・統合、リリース判断は別に残る。担当はQual-Labと親Coordinator、追跡先は対象CHGと[未完了作業](../../../99_Roadmap/01_Product_Roadmap.md)。
