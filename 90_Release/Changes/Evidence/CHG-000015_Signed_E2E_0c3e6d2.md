# Docker復旧後の署名済み4経路・復旧E2E

対象変更: [CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)
実測日: 2026-08-31（Asia/Tokyo）
状態: 実測完了／独立確認・Runtime全体の完成判断は別途

## 結論

固定候補`0c3e6d2`で実Providerの4経路が4/4、固定Workerによる復旧試験が7/7で完了した。4経路の再試行・是正は0。既存の送信許可を再利用し、承認コードの追加入力はなかった。全候補の内容完全一致、検証後の破棄、cleanup、Recovery残件なし、正本Repository変更なしを結果で確認した。実行前後のGit worktreeもcleanだった。

| 指定した依頼元 | 実行担当 | 独立レビュー担当 | 結果 |
|---|---|---|---|
| Codex | Claude Code | Codex | 完了 |
| Claude Code | Codex | Claude Code | 完了 |
| Codex | Codex | Claude Code | 完了 |
| Claude Code | Claude Code | Codex | 完了 |

依頼元は要求Profileであり、実アプリのIdentityを認証した結果ではない。実行・レビューは実Providerを利用した。Codexは固定Linux Runtimeとの既存の互換性条件により`gpt-5.5`、Claudeは`opus`、速度はnormal。API key／従量APIへのfallbackや追加購入は行っていない。

## 固定対象と実行条件

- Commit: `0c3e6d22ca6ed5bf6497b1235c72e020b317df5f`
- Tree: `cfb5c7d232609993ce7c017ff2d2585705cbbdcd`
- Release Sequence: `2026083105`
- manifestのRuntime識別hash: `e981fd0cd4300f355ae061f25edc6b784b8fd247c8eb240961f340a6a4a58663`
- package content root: `be3c297f291c621078accda46bb4ba4f91a3b92baa5d898c62716453d55295ca`
- Node.js: `24.19.0`、検証した絶対Pathの実行ファイルを使用
- 配布候補: Repository-local `.crdd/release-staging/final-0c3e6d2`
- 作業Directory: 検証済みCRDD Repository Root
- 実行入口: 同候補の`tools/coordinator/scripts/verify-signed-recovery-matrix.ts`と`verify-signed-route-matrix.ts`。ともに追加引数なし、exit 0
- 検証入力: README・固定検証テキストの読取り投影、BASEからOKへの限定置換、独立レビュー、候補の完全一致検査と破棄
- Git外の入力: 署名manifest、Hashとbyte長で結合したWorker／Supervisor、固定Docker image、専用Provider Home、既存同意。認証値は記録しない

復旧試験は15:02:37～15:02:59の約22.12秒、4経路は15:02:59～15:11:01の約482.48秒。所有する子Processの開始からcloseまでを計測した。人間の受入までの時間、内部工程別の時間、Human Active Timeではない。

復旧試験はtimeout、出力超過、不正出力、非ゼロ終了、取消、cleanup観測不明からのfresh recovery、親Process消失からのfresh recoveryを確認した。固定Workerのみで、Provider認証・Provider通信は使用しない。

## Docker修復との関係

先行するDocker修復では、起動環境の`ProgramData`不足と、修復記録をTask inventoryが未知項目として拒否する接続漏れを是正した。公式Docker DesktopをOS由来環境で別操作として起動し、署名版`b468ddc`で同じ復旧IDの現在状態と明示終了を確認した。その後、上記の最新固定版で通常Taskが完了した。

旧修復の11記録と退避Directoryは削除していない。過去の起動成否が不明という履歴も残し、現在のEngine回復と混同しない。旧操作を再発行していない。修正版native launcherの環境は実子Process試験で確認したが、今回の復旧を最初から破損させ直し、全修復工程を最新Runtimeだけで再実行した証明ではない。

## 完全結果と同一性

| 記録 | ファイルのSHA-256 |
|---|---|
| [4経路結果](CHG-000015_Signed_Route_Matrix_0c3e6d2.json) | `a1ea26003453c85bbf577cd77e841cea06d3c1a7d2da93a95718ae8d58fb2bfe` |
| [選定・許可の記録](CHG-000015_Signed_Route_Selection_0c3e6d2.txt) | `a741f8ecb5ff923fe82d2b93d16c56bc13534e7041b5b4c09c4f6cbc321e1d7a` |
| [復旧結果](CHG-000015_Signed_Recovery_Matrix_0c3e6d2.json) | `79c4e396048dc1f0468495c20cc512d58a563c7987eabc2a933a5c1cedc1c5ee` |
| [署名manifest](CHG-000015_Signed_Manifest_0c3e6d2.json) | `9d040cd90b892a771e5094530a155872f3e90719bfdf2cfe4ffe16af6f412426` |

上表は保存したファイル全体のbyte列を対象とし、Runtimeが識別に使用するmanifestHashとは別である。manifestの保存版だけは末尾LFを1 byte追加した。元ファイルのSHA-256は`19a14b1a03102d38606f8e36d4e663a37aa9d21a8847228fea566dd646e11bb3`で、署名payloadや値の変更はない。他の3記録は元出力とbyte一致した。復旧試験のstderrは0 bytesだったため追加しない。後続の記録更新でこの実測対象のCommit／Treeを読み替えない。

## 限界と後続処置

- 固定Task各経路1回の成功であり、任意Task、全障害組合せ、長期安定性、Docker自体の再故障不存在を保証しない。
- 今回は是正0であり、実Providerの是正Loopはこの結果だけでは再実証していない。
- 約8分という値から性能改善や有用性全体の成立を推定しない。実務自己適用・比較測定は既存の評価へ接続する。
- 今回のDocker是正の独立確認、Runtime全体の完成監査、v0.18の残件・統合・Release判断を区別する。担当責任者はQual-Lab、追跡先は対象CHGと[未完了作業](../../../99_Roadmap/01_Product_Roadmap.md)。
