# 署名公開MCP E2Eの環境停止

## 結論

新しい取消Oracle候補の署名・配布検証は成立したが、実Provider E2EはProvider Process開始前から回復要求へ停止した。署名E2E完了およびPhase 5完了は未成立である。

## 固定候補と結果

| 項目 | 結果 |
|---|---|
| Source Commit | `45254e2bf9d20f8ff674840648a372d31155c44f` |
| Source Tree | `a914f1e5c27ec2d7e9937415ec2d55ec08fe2cf7` |
| Release Sequence | `2026093002` |
| Manifest Hash | `b5197d786f5b8221a85130495db379ed405e8f9e59c64f0891734b2e15820e0c` |
| 署名 | `SIGN_EXIT=0` |
| 候補自身の検証 | 暗号署名、Runtime Execution Identityおよび配布内容一致 |
| 実Provider E2E | revision 10、`blocked / project_runtime_public_mcp_verification_incomplete`、`REAL_PROVIDER_EXIT=2` |
| 結果参照 | Repository-local `.crdd/verification/project-runtime-public-real-providers-1790738408316/result.json` |
| 最初の正常経路 | Codex選定あり、Provider Process開始観測なし、`project_runtime_task_recovery_required` |
| 最終回復在庫 | `docker_task_recovery_inventory_available`、`manualRecoveryRequired: true` |

結果は16件の不一致を返したが、正常、取消、親Process喪失および再入場の各Scenarioが必要な開始観測へ到達していない。16件を独立した実装欠陥または前回Oracle不一致の再発と断定しない。

## 事後診断

- 制限外の読取り診断で、Docker Linux Engine接続先Pipeの不存在を確認した。Docker Engineの準備完了は確認できない。
- 同じ署名候補の回復在庫診断は`docker_task_runtime_state_generation_active_or_unknown`へ停止した。この観測を在庫空へ変換しない。
- Coverage試験Processの開始は12:22:17、E2E終了は12:20:08であり、その試験をE2Eの最初の停止原因とする時系列根拠はない。事後の共有Lock観測への影響は未確定である。
- Docker修復、回復記録の削除・改名、再E2Eおよび四経路E2Eはこの記録時点では実行していない。

## 次の確認

最初の停止に対応する耐久記録とDocker現在状態を確認し、exact Recovery Identityに結合した復旧を行う。回復在庫を安全に観測でき、Engine準備完了が成立した後で、同じ署名候補の実Provider E2Eを再実行する。

## 復旧の追跡

公開doctorから一件のexact Docker Task Recovery IDを取得した。同一Runtime記録へ版移行用の`--restart-origin-release-root`を誤って付けた最初のコマンドは、`docker_restart_handoff_invalid`、資源回収確認済みで停止した。実装変更ではなく起動引数を訂正し、同じRecovery IDで再入場した。

訂正後の再起動中、人間からDocker DesktopのIngest Server起動失敗が報告された。`sailor-ingest.sock`から`.stale`へのrenameがシステムから拒否されたとの表示である。これは人間が提示したエラー表示の記録であり、CRDDによる原因確定やcleanup成功の証明ではない。再起動は`docker_restart_effect_outcome_unknown`、`RESTART_EXIT=2`で停止し、資源回収は確認済みと返した。

## 外部Runtimeの通常更新と起動確認

人間がDocker Desktopの4.92以降への通常更新を承認した。インストール済み4.89.0.238018から、公式配布の4.93.0.240920へ全ユーザー向け方式を維持して上書き更新した。Factory Reset、アンインストール、WSL登録解除、永続データ削除および回復記録削除は実行していない。

- 公式InstallerのSHA-256: `c139124c9cf71477dc565c3c0ea5a18f90b93d68ebe9aaa848a065960416c0bc`。公式チェックサムと一致し、Authenticodeは`Valid`、署名主体はDocker Incであった。
- 公式Installerログは2026-09-30 13:06:53 JSTに`Installation succeeded`を記録した。
- 更新後13:07:55 JSTに一度通常起動した。直後はEngine Pipe不存在だったが、同じ起動の継続観測でDesktop 4.93.0、Linux Engine 29.8.1の`docker version`応答を取得し、`docker info`も29.8.1を返した。
- 参照元: [公式4.93リリースノート](https://docs.docker.com/desktop/release-notes/#4930)、[公式チェックサム](https://desktop.docker.com/win/main/amd64/240920/checksums.txt)。

通常更新後に起動可能となった事実を、CRDDの実装修正成果またはSocket障害の原因確定へ変換しない。外部Runtime障害の有力候補として保持する。Engine起動だけでは残存Recovery解消、Provider Effect、cleanupおよび署名E2E成立を証明しないため、同じ署名候補の公開doctorとexact Recovery確認を次の処置とする。

## 更新後のexact Recovery収束

通常の復旧入口は`docker_task_recovery_create_outcome_unknown`へ停止した。未受領のContainer作成要求に対し、Engine復旧や現在の不存在だけを過去要求の不成立へ読み替えなかった。既存再起動記録へ結合する入口も、不完全な記録に対し`docker_task_recovery_restart_unverified`を返した。

同じ署名候補、同じexact Recovery IDで検証付き再起動を一度継続した結果、`docker_restart_settled`、`RESTART_EXIT=0`、資源回収確認済みとなった。続けて`--recover-isolation <same exact ID> --after-recorded-docker-restart --json`を実行し、`recovered / docker_task_recovery_completed`、Exit Code 0を確認した。別呼出しの公開doctorは`docker_task_runtime_state_clean`、回復ID集合空、`manualRecoveryRequired: false`を返し、Engine 29.8.1も応答した。

この収束ではProvider要求とTask再実行を行っていない。残存記録を削除・成功へ手動編集する代わりに、既存の署名済み公開復旧入口で記録の検証と終了後観測を行った。次の実Provider E2Eは同じ署名候補と既存の送信同意を使用する別の検証実行であり、復旧成功をその合格根拠にはしない。

## 更新後の実Provider E2Eと取消単独診断

同じ署名候補の再実行（Run `04619585ae274dd4`）は`REAL_PROVIDER_EXIT=2`となり、残る問題は`cancellation_provider_boundary_mismatch`一件だった。通常二経路は期待する正本差分と人間の採用判断待ちへ到達し、親Process喪失後のexact Recoveryと最終在庫清掃を確認した。全体Passとは扱わない。

不一致Fieldを保存していなかったため、期待値を変更する前に、同じ署名Runtimeへ取消だけを発行するRepository-local診断を実行した。診断Runは`39a0df9821a24876`、結果SHA-256は`cd37bcd0e4d7cab626bd1af3ef2f04b89594a0d80815eb3cf823ac8037d5e702`である。結果は`.crdd/verification/project-runtime-cancellation-diagnostic-39a0df9821a24876/result.json`へ保存した。

| 観測項目 | 結果 |
|---|---|
| Provider開始後の取消／親EOF | 確認済み |
| Provider正常完了 | 未観測。Exit Status Classは`not_observed` |
| Process Tree終了 | 確認済み |
| Container／Network不存在 | ともに確認済み |
| 境界清掃 | 確認済み |
| 子Process join／最終回復在庫 | join済み、`docker_task_runtime_state_clean` |
| 正本Repository変更／Protocol違反／timeout | いずれもなし |

この実測は、取消されたProviderへ正常完了を必須とする検証条件の不整合を特定した。本番Runtimeの変更ではなく、取消時だけ正常完了またはProcess Tree終了確認を受理し、Identity相関、開始観測、Container／Network不存在および清掃確認を維持する検証側是正を行う。通常経路は正常完了必須のままとする。診断ToolのExit Code 2は全体E2E成功を主張しない固定値であり、診断実行失敗の判定には使わない。

是正後のFormatter、型、Lint、Capability Graphおよび既存Traceability検査は合格し、局所System試験32件も合格した。独立レビューおよび是正後の全経路E2Eはこの追記時点では未完了である。

独立レビューでは通常二経路と回復再入場の反証試験不足を一件検出した。正常完了未観測・Process Tree終了確認・全清掃確認を三経路へ個別に渡し、各経路が対応する境界不一致と`blocked`を返す試験を追加した。静的検査は再合格し、局所System試験は33件合格となった。独立確認者の再レビューはPass、確認者自身の局所試験も33件合格だった。このPassは検証条件と反証試験に限定し、是正後の全経路E2Eは別途実行する。
