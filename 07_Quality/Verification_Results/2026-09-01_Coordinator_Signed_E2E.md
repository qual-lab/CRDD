# Coordinator署名版の4経路・復旧・実Task取消の検証結果

状態: 限定実測・限定独立確認完了。Runtime全体、v0.18およびReleaseは未完了
担当責任者: Qual-Lab
実測日: 2026-08-31～2026-09-01（日本時間）
最終更新日: 2026-09-01

## 結論

署名固定版`4f10201`で4経路4/4、復旧7/7が完了した。同版の公開Taskでは、対象Claudeコンテナが1個だけ`running`であることを観測した後、人間が実端末でCtrl+Cを1回入力し、SIGINTの到達、取消結果、通常の資源回収、候補未発行、終了後の対象資源不存在まで確認した。Provider内部の準備完了や処理開始を別途観測したものではなく、測定scriptによる合成signal送信でもない。子CLIの終了コード2は今回期待した取消の結果であり、測定側は`verified`だった。

この結果は、旧署名版で失敗した通常の取消後回収について、是正後の1回の成功を示す。過去の失敗や事後Recoveryを成功へ書き換えず、全タイミング・全Providerの取消成功率や全Runtimeの完成を主張しない。今回差分の限定独立確認は完了し、対象と限界を末尾に記録した。

## 対象と確認方法

| 項目 | 固定対象・境界 |
|---|---|
| 実装・署名配布・対象Repository | Commit `4f10201fdc8a0582174af368ec3c37e496defb84`、Tree `2b0f4bb4f18c71895a93c59fbb398e937e9e1490` |
| 実行環境 | Windows PowerShell `5.1.26100.9168`、Node.js `24.19.0`、Git object format `sha1` |
| 入口 | 同じ署名配布物の`node 40_Develop/coordinator/bin/launch.ts verify-routes`／`verify-recovery`と、`node 40_Develop/coordinator/bin/launch.ts automation task --request-stdin --json`への取消。測定後の文書更新を実測対象へ遡及しない |
| 署名結合 | 4経路の各結果に上記Commit／Tree、manifest SHA-256 `fa791db3c9e12ad49bb5e1d139c83e449d926218280227cc10eeae850a12b416`、package content root SHA-256 `c75410215f74a3be59269aa7883bd2d55053ec30b1fb472a2616350c155df1d0`を確認 |
| Controllerの同一性 | 現行ソースと署名配布copyのSHA-256はともに`2cc1d9a187132034fce42903464274bd7446e1d8279a1363a4429a56e0a5c941` |
| 実測の区別 | 4経路は実Provider、復旧matrixは固定検証Worker、今回の取消は実Taskと実Docker。別々の根拠として評価する |
| 許可 | 承認済みの限定検証、既存Subscription。追加の課金経路・購入・Runtime権限拡張は行わない |
| 保存記録 | 開始・結果・完了のID、時刻、結果SHA-256を照合。保存envelope自身はAuthorityでも実行版の証明でもない |

## 4経路と復旧

| 確認 | UTC時刻 | 観測結果 |
|---|---|---|
| 4経路 | 2026-08-31T14:54:25.847Z～15:00:56.635Z | `completed`／`signed_route_matrix_completed`、試行4・完了4、`cleanupConfirmed: true`、手動回復不要 |
| 復旧7シナリオ | 2026-08-31T15:00:56.857Z～15:01:11.102Z | `completed`／`signed_recovery_matrix_verified`、7/7、`cleanupConfirmed: true`、手動回復不要 |

復旧の異常シナリオでは期待された停止や回収不明からの新しい回復を確認するため、各途中状態がすべて`completed`だったという意味ではない。4経路の成功も、入口の実アプリIdentity、任意の実務Task、総合有用性の証明にはしない。

## 実Taskの取消

依頼は`cancellation-verification.txt`だけを対象とし、内容を`CANCEL`とLFに限定した。開始記録の`requestSha256`は`c0198f6ffea85c76ef12cd5a79ae0ad77679e2e83bfdf2d88c0ea1a6b0ceb7a8`である。

| 観測 | 結果（時刻はUTC、2026-08-31） |
|---|---|
| 開始 | 15:04:42.503Z |
| 対象Claudeコンテナ1個の`running`観測 | 15:05:06.733Z。Provider内部の準備完了・処理開始は未観測 |
| 最初のSIGINT | 15:05:09.299Z、人間による実端末のCtrl+C入力1回 |
| 終了 | 15:05:24.367Z |
| 測定の判定 | `verified`、`cancelObserved: true` |
| 子CLIの終了 | exit 2、signal `null`、launchError `null`。正常Taskの成功コードではなく、期待した取消結果 |
| 公開結果 | `coordinator_task_cancelled_after_provider_cleanup`、`cleanupConfirmed: true`、手動回復・Process再起動不要 |
| 候補・回復ID | `candidateDisposition: not_issued`、Host／Docker／候補／候補Storeの回復IDは`null`または空配列 |
| 測定上の障害 | `stdoutExceeded: false`、`observationFailed: false` |
| 終了後 | 測定対象のDocker container／networkは不存在、対象Repositoryは不変。親の別確認でも当該子Processは不存在 |

さらに同じ署名版の`inspectRuntimeOwnedDockerTaskRecoveryState`を新しい読取り専用入口から実行し、exit 0、`completed`／`docker_task_runtime_state_clean`、手動回復不要、Docker回復IDなし、active bindingなしを確認した。今回の公開結果には`effectStateUnknown`が出力されていないため、`false`という実測値へ補完しない。具体的な対象資源の不存在観測と、未出力フィールドは別の事実である。

同版の先行試行`public-cancellation-4f10201.result.json`は、signalが遅くTaskが通常完了したため、取消成功には数えない。発行された候補は正規の`candidate discard`で破棄済みと親が確認した。旧45ea2acの取消失敗と正規回復は[以前の結果](2026-08-31_Coordinator_Closure_Verification.md#public-task-cancellation-observation)に保持する。

## 根拠の再識別

以下はRepository-local `.crdd`内の非正本記録であり、Gitへ生出力を追加しない。再確認ではexactな記録とhashを照合し、欠落・不一致なら再識別不能として扱う。SHAだけから実測の正しさやAuthorityを推定しない。

| 記録 | Repository-relativeな所在とSHA-256 |
|---|---|
| 4経路 | `.crdd/verification-results/f702010c-2a01-4c54-a2f2-b0eb87ebd4a1/result.json` — `dc20e9e2b3e408bdf62a0dca41ba50500d1746694045e392bed01d3508a1b4ed` |
| 復旧 | `.crdd/verification-results/299fe3d7-8555-43d1-be70-831b97c55982/result.json` — `de1b37a972cdc21b8ea0fecfc6d9ea79d39da97a38d28fc095fd162786f5884b` |
| 実取消 | `.crdd/dogfooding/public-cancellation-4f10201-ready-retry.result.json` — `e5965e479b2145b24882949c87c84ca72d9e85841476b5c67c01ebaa6562389c` |
| 取消測定script | `.crdd/dogfooding/verify-public-task-cancellation.mjs` — `1af2413fa27513e0cd84595bd0171edcc0f8859047443d1c0f51caf2d670aba2` |

4経路と復旧の状態は`result.json`の`summary`内にあり、同じdirectoryの`started.json`／`complete.json`と照合する。envelopeの`repositoryRevisionIsExecutionVersion: false`と`authorityConferred: false`は保持し、Repository名や保存成功だけで署名配布の同一性を推定しない。実行担当の配布照合と、取消記録の`distributionCommit`／`distributionTree`を区別して確認する。

生記録にはHost label等を含むため転載せず、本書は判定、版、時刻、件数、限定した安全状態だけを記載する。Provider Home、Host絶対Path、認証情報、生のProvider出力は公開記録へ移さない。

再実行時は、同じ署名配布、依頼Hash、実行環境、対象Claudeコンテナ1個の`running`という観測条件および上記入口を照合する。この記録だけを新しいProvider送信や取消の許可にせず、実行時の承認範囲と既存Subscription条件を確認する。認証はProviderの正式機構を使い、秘密値を依頼、測定script、ログまたは本書へ保存しない。script全文を公開せず、再識別できない条件は推測して補わない。

## 検証義務の評価と残件

- この固定版では、4経路、固定Workerによる復旧、観測した時点の実Task取消と通常回収が成立した。旧版の実取消失敗を消さず、再発率や完全な原因同定へ一般化しない。
- 他の取消タイミング、全Provider、OS／端末環境、長時間運用の全件保証ではない。既存の決定論的試験と実測の範囲を分け、残る不確実性を完成監査で評価する。
- 45ea2acの実務・是正1往復は当該旧版の結果として保持し、新版で再実行したとは記載しない。
- 今回差分の限定独立確認は完了した。Runtime全体・工程強化・v0.18の完成評価、統合、Releaseは未完了。実測成功だけで採用・準拠・公開判断へ進めない。

現在状態は[Quality Center](../01_Quality_Center.md)、変更と残件は[CHG-000015](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md#完成監査後の限定是正)と[CHG-000017](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#完成監査の現在表示と検証記録の是正)へ接続する。

## 今回差分の独立確認

2026-09-01（日本時間）、作成担当から分離して次を確認した。実装はCommit `4f10201`、文書は同Commitを基準とする本記録を含む11文書の凍結差分が対象である。全Runtime・v0.18の一括完成判定を代替しない。

| 確認者と対象 | 結果・範囲 |
|---|---|
| Russell：Darwin作成のCREATE取消是正と試験 | Pass、指摘0。全5種類のCREATE、受領記録、実回収の利用側、後続操作の非発行、未受領・保存失敗・回収不明、非CREATEの既存順序を照合 |
| Darwin：Russell作成の命名是正4ファイル | Pass、指摘0。公開フィールド・Schema・処理順序不変と、実ファイル集合／検査集合の完全一致維持を確認 |
| Darwin：Wegener作成の結果・現在案内11文書 | 初回Minor 2件。起動パスの`bin/`抜けと、コンテナの`running`観測をProvider内部の準備完了と誤読し得る表現を検出。両担当と是正方針を整合し、親が2文書を是正。限定再確認Pass、2件解消・追加指摘0 |

文書の再確認対象SHA-256は、本書が`41feaa8e7ca7d04cae64b67f83fd3547d514034420a351f28aedb729479e32ea`、Quality Centerが`aa2238589834a936ad4094575ac9545bb8db8580c32540523b6b9c2e7340e0c3`。他9文書は初回凍結から不変と確認した。この節と確認済み状態の追記は再確認後の記録更新であり、これらのHashが追記後の本文も含むとは扱わない。

共通Checkerは2026-08-31T15:20:40.117Zに全体を実行し、388文書・2,688リンク・894アンカー・固定履歴24件、エラー／警告0だった。各確認者は共通結果を使用し、重複実行していない。今回の確認ではコード・試験・測定script・保存契約・結果・現在案内を対応づけ、Hash一致や試験件数だけから意味の正しさを推定していない。

追加2件は、新しい規則を必要とする不足ではなく、既存の参照先照合と「観測した状態を他の状態の証明にしない」規律の適用不足として同じCHG内で是正した。生記録・署名配布・実測値・判定条件は不変で、追加のProvider実行や署名は行っていない。現在、この限定是正について人間による判断は必要ない。記録追記後は参照・対象同一性・差分の軽量確認で閉じ、全体の未完了事項はQuality Centerと既存CHGで継続する。
