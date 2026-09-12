# 固定開発版の逆方向・順方向実測

## 結論

2026-08-31の2件比較は、順方向1件が完了、逆方向1件が停止した。全体は`measurement_tasks_not_completed`、終了コード2。両Taskの後片付けを確認し、手動回復・Process再起動・正本Repositoryの変更は不要だった。

| 経路 | 観測結果 | 所要時間 |
|---|---|---|
| Claude Front → Codex実装 → Claudeレビュー | 候補取得後、レビュー段階で`provider_turn_limit_exceeded` | 292,567.9224 ms |
| Codex Front → Claude実装 → Codexレビュー | 一回で承認、指摘0、是正なし、候補破棄済み | 294,956.9300 ms |

Frontは指定した経路Profileであり、実アプリのIdentity認証ではない。実呼出しは計4回。既存の初期送信同意を再利用し、API key、有料APIへの切替、追加購入は行わなかった。

## 固定対象と再識別

- Repository: `qual-lab/CRDD`、Git object format: `sha1`
- Commit: `56af5a1563526796c53ee4fc01e58a04a6fed6d9`
- Tree: `81f6e42bb0a851627a6577345a5cf7bd6a0afb0d`
- 開発package SHA-256: `dab46272a8a8ba038b81e64b0cae43dfebe88573fff3d55b7505c3184b81ca44`
- 別途検証したnative配布物のmanifest SHA-256: `ab73966a659717c28dbb379b5ba2477d3b884925b049658c52bb5b642649605e`
- Node.js: `24.19.0`
- 入力: 固定版の`createSignedGeneralTaskVerificationRequest`が生成する`reverse`、`forward`の順。対象は既存BASE markerからOKへの限定置換。
- 入力JSON SHA-256: `c11e540cd49e7925d51069e78cc92d57918511d1772a848fbf2f6ed4560e7302`
- 実行入口: 固定開発配布物内の`tools/coordinator/scripts/measure-development-providers.ts`。最大2Task・8回呼出し・Task再試行なし。
- 結果: Repository-local `.crdd/dogfooding/development-measurement-result-1788146089362-56228.json`
- 結果SHA-256: `370722f1d35e3aec4c406d17f081c980b2281668fb79aabddd9209d0b75005b6`
- 結果生成時刻: 2026-08-31 12:14:49 JST。別々の開始・終了時刻は未保存で、表は同じrunの単調時計による所要時間。

Runtimeは固定開発版とRepository Identityを実行中も検証した。生のProvider本文、tool履歴、credentialはこの記録へ保存しない。上記の結果JSONはGit管理外であり、将来削除された場合は同じ入力・固定対象で再実測が必要になる。旧結果は現在版の実行根拠へ流用しない。

## 証明できた範囲と限界

この入口は一般Taskと候補破棄までを確認し、正式署名Runnerのexact byte検証は呼ばない。したがって順方向の成功は、末尾LF・byte長・SHA-256の完全一致や正式4経路E2Eの成功ではない。

逆方向の理由は、この版ではCLIの`error_max_turns`と、成功Envelope内の回数が上限を超える場合を区別しない。前回の署名版の一般的な結果形式エラーと同一原因とも断定できない。残った情報から実際のturn数やtoolの反復内容は再構成できない。

実体照合は326回、累計475,313.7104 msと報告された。ただしこれは保護検証の累積時間であり、Task時間との単純加算や、全件を安全に削除可能という判断には使わない。有用性評価と重複削減の後続調査へ接続する。

## 実測後の照合と是正

読み取り専用の独立した着手前確認で、固定Task第3条件がReviewerにもLF・byte数・SHA-256を要求する一方、既存ArchitectureはReviewerの可視内容確認とRunnerの機械確認を分けていることを確認した。Claude Reviewerの許可ツールはRead・Glob・Grepで、Bashやdigest計算ツールはない。責務衝突はsource上で確認できるが、今回の上限停止の直接原因は未確定である。

是正対象は固定Task生成元と失敗理由の分類。受理集合、上限6、モデル、read-only、課金・権限境界は維持する。CLIの停止報告と成功結果の回数不整合を分離し、生の値は公開しない。回帰試験では実Task → Reviewer Packet → argv上限・許可ツールを照合し、Reviewer承認後でも不正byte・metadataをRunnerが拒否することを確認する。

試験をRepository Rootから実行した際、一般Task試験の子Process用fixture参照3箇所が起動Directoryに依存して失敗した。同じ経路Matrix試験のfixture参照5箇所とCLI参照1箇所も照合し、参照元moduleから絶対化してroot／packageの双方から再実行する。経路Matrixの肯定fixtureと子Process probeが持つ旧改訂番号も、生成元の契約定数参照へ統一する。不正改訂版を拒否する否定試験は維持する。Runtimeの新能力や新規CHGには分解しない。

## 是正の検証境界

対象は`56af5a1`を基準とする本記録と同じコミット内の修正。Runtimeの受理集合、最大6turn、モデル、権限、署名検証および候補のbyte検証は変更しない。検証用一時領域はRepository Root直下の`.crdd/dogfooding`へ固定する。

- 全Coordinator試験: `npm test --prefix tools/coordinator`。Runtime修正と契約定数の接続を含む1,399件が成功。実Providerは起動しない。
- 開発E2E契約試験: `npm run development-e2e:verify --prefix tools/coordinator`。234件が成功。正式署名・実Provider・実OS対話の成功とは区別する。
- 状態／資源対応、型検査、静的検査、整形: `npm run check --prefix tools/coordinator`。成功。9資源、20状態、21遷移、10不変条件、10検証対応を確認。
- 全体成功後に残った経路Matrix試験のCLI参照1箇所を絶対化し、`node --test tools/coordinator/tests/signed-route-matrix-verification.contract.test.ts`をRepository Rootから、同じ試験をpackage Rootから再実行して各15/15成功。Runtime sourceは全体成功時から変更していない。
- Repository全体Checker: `node tools/checker/crdd-check.ts --json --summary`。368文書、2,335リンク、766アンカーを確認し、エラー・警告0。

機械確認は実測後の修正を対象とし、上記の固定開発版による実測結果そのものを上書きしない。生の試験stdoutは恒久保存せず、対象コミットの試験と上記コマンドから再生成する。現在のレビュー停止が解消したかは、修正版の実Provider測定で別に確認する。

次の解除条件は、修正版の機械確認、同じ上限での再実測、最新固定対象の正式4経路・復旧検証、およびE2E収束後の最終独立監査である。担当責任者はCHG-000015と同じQual-Lab。現在の未完了を次版へ移さない。
