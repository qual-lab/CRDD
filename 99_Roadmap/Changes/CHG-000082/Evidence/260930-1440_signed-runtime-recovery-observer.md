# 実Provider検証の終了後Observer接続是正

## 結論

Run `a50af6470d4c45dd`は終了後の回復状態を観測できず、全体E2Eは未合格である。検証Toolが署名配布物ではなく作業Tree側の回復Observerを使用していたため、試験対象と終了後観測の所有者が一致していなかった。安全判定を弱めず、検証済み配布RootのObserverへ接続する。

## 固定した入力と結果

| 項目 | 記録 |
|---|---|
| 署名Runtime | Commit `45254e2bf9d20f8ff674840648a372d31155c44f` |
| 検証Tool | Commit `ec4d61ce77e2acf2d8ea09258227c6860ff3c477` |
| 結果 | `blocked / project_runtime_public_mcp_verification_incomplete`、Exit 2 |
| 問題 | `post_run_recovery_state_not_clean`一件 |
| 結果File | Repository-local `.crdd/verification/project-runtime-public-real-providers-1790744919677/result.json` |
| 結果SHA-256 | `66c14cfc02ba1487a9816715d7893d763bcef939c42dbca6d59023927d9519ba` |

通常二経路は期待するRepository差分と採用判断待ちへ到達した。取消時はProvider開始、Process Tree終了、Container／Network不存在および境界cleanupを確認した。親喪失からの再入場には回復Lifecycleの段階記録があったが、最終Observerは`docker_task_runtime_state_unavailable`を返した。このため全体cleanupや再入場成立は、このRunで証明済みとしない。

## 局所比較

同一File起動、同一Process、同一権限で二つのObserverを比較した。Provider要求、Docker再起動、資源削除および耐久記録の手動編集は実行していない。

| 呼出し元 | 結果 |
|---|---|
| 作業TreeのModule | `blocked / docker_task_runtime_state_unavailable` |
| 同じ署名配布物のModule | `completed / docker_task_runtime_state_clean`、回復ID集合空、手動回復不要 |

別の`node --input-type=module -e`起動では署名側もLock取得の観測不能となった。File起動で正常になったため、この試行を実際のE2Eと同等の起動条件または残存Lockの証明にしない。Docker Desktop 4.93.0、Linux Engine 29.8.1は別の読み取り観測で応答した。

## 是正の範囲

- 配布Identity検証後、同じ`distributionRoot`から固定した公開回復Moduleを取得する。
- Loader契約は既存のPackage検証Moduleと公開回復Moduleの二つだけを許可する。任意Module、内部Module、追加引数または変数のすり替えを許可しない。
- 通常経路の正常完了必須、取消時の終了観測、exact Recovery、Container／Network不存在および最終cleanupの条件は変更しない。
- 署名済みstagingは変更しない。検証ToolとLoader契約の変更を将来の正式配布へ含める場合は、署名Closureの再検証・再署名が必要である。

Formatter、型、Lint、Capability Graphおよび既存Traceability検査は合格した。公開Processの局所System試験は33／33合格した。独立再レビューはPassで、確認者自身の対象Graph試験も1／1合格した。Package Filesystem契約試験と公開Process試験の結合実行は158／158合格、失敗・Skipともに0で終了した。是正後の全体E2Eは別途実行し、これらの局所合格を流用しない。

同時にProject Contextの検証を、変化するQuality Owner本文の旧文言固定から、現在の七項目のexactな表一致へ修正した。固定fixtureで七項目と根拠の保持、必須行欠損の拒否を別に確認する。Package試験19／19合格、読み取り専用の独立レビューPass、確認者自身の対象試験6／6合格である。Qualityの観測済み件数を増やす変更ではない。

## 是正後の署名Runtime実測

同じ署名RuntimeとTool Commit `1b756ac2e2f503a21e38bfbd0dac9680582f6b71`で、Run `2e55c8cd2897464b`を実行した。2026-09-30 14:55:34 JSTに結果を保存し、`REAL_PROVIDER_EXIT=0`で終了した。結果は`completed / project_runtime_public_mcp_real_providers_cancellation_and_recovery_verified`、問題集合空、`cleanupConfirmed: true`、手動回復・Process再起動ともに不要、`effectState: settled`である。

結果はRepository-local `.crdd/verification/project-runtime-public-real-providers-1790747734484/result.json`、SHA-256は`e3f04503f69259d5975abd9749a0ade1fc4245ddeee1b35c5ddfa71270ac600c`である。通常二経路の正本差分、取消時のexact義務、親Process喪失後の同じ回復参照に結合した七段階のLifecycleと再入場、最終`docker_task_runtime_state_clean`を確認した。

通常経路と再入場は`project_runtime_acceptance_decision_required`という人間の採用判断待ちを期待する。結果Field `freshPublicMcpReentryCompleted`は`status === completed`だけを数えるため`false`であり、再入場未実行の意味ではない。実際の再入場応答はIdentity、期待する判断待ち状態、正常完了、境界清掃および子Process joinを検証条件で確認した。自動採用の完了やRelease Authorityを主張しない。

この実測は公開MCPの固定Scenarioに限定する。Workbenchの読取り助言／変更候補、四経路E2Eおよび39件のQuality義務全体は別に確認する。

## Checklist

- [x] 元の失敗結果を現在の正常観測で上書きしていない。
- [x] 試験対象RuntimeとObserverの所有者を照合した。
- [x] 観測不能を在庫空またはcleanup成功へ変換していない。
- [x] Provider要求を伴わない局所比較で接続不一致を再現した。
- [x] Runtime本体の安全判定を弱めていない。
- [x] 是正後の公開MCP全体E2Eを実行し、最終回復在庫まで確認した。
