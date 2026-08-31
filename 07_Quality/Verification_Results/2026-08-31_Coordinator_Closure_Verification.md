# Coordinator完成監査後の追加検証

状態: 残存資源の正規回復・追加是正後の全体試験成功。実取消の再測定と今回差分の独立確認は未完了
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 結論

署名固定版`45ea2ac`の実Provider是正1往復は、候補の内容確認・破棄まで成功し、独立再確認も通過した。開発版`48664a2`では本番と同じWindows子Process終了処理を試験へ接続した。ただし全体試験で検査対象一覧の移設漏れとGitローカル除外設定試験の間欠失敗を検出した。合格した限定試験だけで全体完了とはしない。

その後の是正版`2033dfe`は1,469件すべて成功した。さらに署名版`45ea2ac`の公開TaskへCtrl+Cが到達したが、通常の取消後回収は失敗した。残った資源は正規Recoveryで回収し、[今回の実測と限界](#public-task-cancellation-observation)へ記録した。競合是正後の再実測と最終配布判断は未完了である。

固定後の`npm run check`ではTrace・型・Lintが成功し、先行コミット由来の`docker-desktop-repair-record-store.contract.test.ts`の整形差分1件だけを検出した。整形のみを是正して再実行し、Trace（資源9・状態20・遷移21・不変条件10・検証対応10）、型2設定、Lint 323ファイル、Format 322ファイルがすべて成功した。この整形を全体試験の新たな実行とは数えない。

## 固定対象と結果

| 確認 | 対象・結果 | 限界・次の処置 |
|---|---|---|
| 実Provider是正1往復 | [45ea2acの固定根拠](../../90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md)。Claude実行→Codex確認→Claude是正→Codex承認、最終6 bytes確認・同じ候補の破棄まで成功 | 欠陥を仕込んだ1件。是正成功率、逆方向、実Provider取消を証明しない |
| 共有Process所有処理 | `48664a2`、関連64/64、型2設定、対象6ファイルのLint／Format成功 | 初回はsandbox内のtaskkillアクセス拒否で59/64。試験が生成したPIDだけを確認・回収し、通常権限で64/64。初回失敗を隠さない |
| 独立再確認 | `48664a2`の抽出6ファイルと是正Evidenceは追加指摘0 | 実装担当とは別の確認者。取消の公開Task全体は部分解消であり、OS通知・実Dockerを観測済みにしない |
| 全体試験・網羅率 | `48664a2`／Tree `e80b0cb0ea170ef8ff8c9ff3ee56aeb70041d0c6`、1,460件中1,458成功・2失敗・skip/取消0 | 移設前の`docker-effect-runtime.ts`を残した所有一覧と、`post-write Repository replacement`の置換未到達を検出 |
| 一覧是正後の全体試験 | 同じ親版から所有一覧1件を`docker-owned-process.ts`へ修正。1,460件中1,459成功・1失敗 | 一覧試験は解消。Gitローカル除外の別ケースで失敗し、原因調査中。成功するまでの無条件retryにしない |
| Gitローカル除外の限定確認 | 初回単体23/23、coverage付き23件×10回成功、一時フォルダ残存0 | 単体成功は全体失敗を取り消さない。書込み・close・Identity再確認の第一停止点を確認する |
| 是正後の全体試験・網羅率 | `2033dfe4815047ce251ff7c1e2a6e8f3d2c2fb5b`／Tree `4c4f77fab6b997110da85dc20632a4d4f21d9e54`、1,469/1,469、失敗・skip・取消0、107,550.5471ms | Task／Controller追加結合とclose前後のIdentity是正を含む。以前の間欠失敗は再発しなかったが、原因の完全同定とは区別する |

実行環境はWindows、Node.js `24.19.0`、作業Directoryは`40_Develop/coordinator`。`TEMP`／`TMP`はRepository Root直下の`.crdd/test-tmp`に限定した。全体試験は固定Fixtureによる検証であり、Provider通信やDocker修復を追加していない。初回の3 reporter同時使用ではNodeのテスト用streamに`MaxListenersExceededWarning`が出た。次回はTAP／LCOVの2 reporterとした。この警告を本番Runtimeの資源漏れの証拠とも、無問題の証拠とも扱わない。

## 分岐網羅率の測定範囲

最新の是正版は[2033dfeの計測値](../../90_Release/Changes/Evidence/CHG-000015_Closure_Coverage_2033dfe.json)。対象155ファイル、ロード151、重複7、未ロード4は初回と同じで、重複のない144ファイルの到達分岐は11,285／13,650、未到達2,365、約82.67%だった。全体率とNativeの値は引き続き未確定。以下の表は比較のため初回48664a2の測定を保持する。

[ファイル別の計測値](../../90_Release/Changes/Evidence/CHG-000015_Closure_Coverage_48664a2.json)は、全体試験が失敗した実行も含め、その実行で実際に到達した分岐を記録する。合格率とは別の観測である。

| 集合 | 測定値・扱い |
|---|---|
| 追跡対象のTypeScript | `src`／`bin`／`scripts`の155ファイル。試験・Fixture・依存packageを分母にしない |
| ロードされた対象 | 151ファイル、LCOVでは163レコード |
| 重複のないロード済み対象 | 144ファイル、到達11,271／13,640分岐、未到達2,369分岐、約82.63% |
| 同じPathの重複 | 7ファイルに19レコード。モックを含む同名観測があり、合計・最大値選択・単純重複削除を本番網羅率としない |
| 未ロード | `check-native-runtime-trace.ts`、`check-platform-access-coverage.ts`、`check-runtime-traceability.ts`の3 scriptと`candidate-store-lock-worker.ts` |
| Native／実Provider／OS通知 | このNode計測の対象外。未測定を0%または100%に補完しない |
| 本番全体の分岐網羅率 | 未確定。上記144ファイルの部分集合の率で代替しない |

未到達分岐をすべて不要・到達不能とは判定していない。Qual-Labが現在の検証義務へ照合し、特に取消、回収不明、書込み後のIdentity観測と未ロードWorkerの不足を処置する。現在の完成条件に影響する未確認事項は、率が高くても完成前に残す。依存・コード・試験集合の変更時に再計測する。

再実行は同じ固定版・Node版で行い、同名出力を上書きせず新しいRepository-local出力名を選ぶ。初回は次の引数でTAPとLCOVに加えstdoutへdot表示を出した。後続はdotの2引数だけを除いた。

```text
node --experimental-test-coverage --test-coverage-include=src/** --test-coverage-include=bin/** --test-coverage-include=scripts/** --test --test-reporter=dot --test-reporter=tap --test-reporter=lcov --test-reporter-destination=stdout --test-reporter-destination=<RepositoryRoot>/.crdd/test-tmp/<run>.tap --test-reporter-destination=<RepositoryRoot>/.crdd/test-tmp/<run>.lcov ./tests/*.test.ts
```

生のTAP／LCOVは`.crdd/test-tmp`の非正本出力として保持する。固定JSONには分子・分母・重複集合・未ロード集合とLCOVのSHA-256を残し、ログ全文を通常文書へ転載しない。

## 未完了の処置

- 取消: Task Runtime、Controller、本番共有Process終了、外周cleanupの接続試験は2033dfeで成功し、7a7d8a6で失効判定の是正を含め独立再確認Pass。その後の実TaskではCtrl+C到達を確認したが通常回収が失敗し、正規Recoveryで回収した。今回検出した競合の是正後再実測は未完了であり、部品の合格や事後回復で取消正常完了を補完しない。
- Git除外設定: 決定論的な時刻更新・mode変更の欠陥は是正し、2033dfeの全体試験は成功。初回の間欠失敗と完全に同原因だったとは断定せず、再発時は失敗時観測から追加調査する。
- 検証記録: 7a7d8a6までの独立再確認、今回の実取消失敗と正規回復、追加の競合是正後の全体試験成功を分離した。是正後の実取消・独立確認・最終配布確認は、結果取得後に現在状態へ反映する。
- 配布: `45ea2ac`の署名実測は変更前の実装に限定する。開発変更の都度再署名せず、最終候補が固まってから配布確認へ進む。

担当はQual-Lab。上記は[CHG-000015](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md#完成監査後の限定是正)と[CHG-000017](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#完成監査の現在表示と検証記録の是正)で追跡し、統合・リリース判断は別に残す。

## 追加切り分け

Gitローカル除外の限定coverage試験は、その後120実行・2,760試験まで再現せず終了し、一時物残存0だった。これ以上の反復だけでは原因を特定できないため、失敗時だけ固定理由、Filesystem操作、Identityと時刻を取得する試験観測へ切り替えた。本文やhost pathは記録しない。

Windowsは書込みhandleを閉じるまで最終書込み時刻の確定を保証しない。[Microsoft File Times](https://learn.microsoft.com/en-us/windows/win32/sysinfo/file-times)、[WriteFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile)。現行のexclude書込みはclose前の時刻をclose後にも要求するため、正常なOS更新を拒否し得る。この設計上の不一致と、上記2回の間欠失敗が同じ原因であることは分けて扱う。決定論的な時刻更新と、同名置換・同サイズ改竄・mode変更・close失敗の対照を使い、Rootや既存excludeの初期snapshotを取り直さずに是正する。

是正では、自己書込み後のclose前／close後それぞれの時刻更新を決定論的に再現し、旧実装の正常更新拒否を確認してから修正した。同時に、書込み後のhandleとPathのmodeだけを比較して最初のmodeからの変更を見逃す点も、旧実装の誤受理を確認して是正した。元のtype／device／inode／birthtime／mode／Path、期待size、close後の内容完全一致、rename直前の厳密照合を保持する。関連62/62、型2設定・Lint・Formatが成功し、一時物残存0。一般のIdentity比較やRoot／既存excludeのsnapshot更新には拡張していない。

Task取消の追加2ケースを含む7/7も成功した。開始・完了結果の本番projector、同じ回復handoff、Host回収準備→実領域の回収→receipt→finalizeを接続した。初回のFixture識別子形式不足と、取消受付・Process終了の観測順序を混同した試験期待は試験側で是正した。本番コードの意味変更はない。新2ケースの5反復も成功したが、反復回数を観点網羅の代わりにはしない。

OS取消の入口確認では、自動端末接続のstdin/stdoutがTTYであることを確認し、制御文字を送ったが、30秒内にSIGINT handlerへの到達を観測できなかった。待機期限後にlistenerを元件数へ戻し、試験Processは終了した。Provider・Docker・許可発行はない。この送信方法を利用者のCtrl+Cと等価とみなさず、端末からの配送は未確認のまま保持する。

## 固定版の独立再確認

`b3807b9a195a8d0836067594b35a40695b435d1f`／Tree `671e07acd32b9db15966c80a4eb8384bfd6e7920`を、各成果物の作成者と分離した3担当が確認した。共通Checkerは2026-08-31T14:11:15.067Z、387文書・2,677リンク・886アンカー・固定履歴24件、エラー／警告0。各担当による重複実行はしていない。

- Git除外設定の実装・安全性: Pass、追加指摘なし。時刻の可変期間と初期実体・mode・内容、rename前照合、未知のlockを削除しないことを確認。
- Task取消の結合: Minor 1件。Controllerの失効と二重取消がどちらも`blocked`となるため、戻り値を`{status: "blocked", reason: "invalid"}`まで完全一致で検査するよう是正。既存を含む7/7と対象Biomeは成功し、7a7d8a6で指摘解消・限定再確認Pass。
- 文書・不足影響・準拠: Minor 1件（DGI-02）。新しい結果追記後に未完了一覧へ残った「これから接続する」を、接続試験成功・独立再確認中・OS／実Docker未確認へ同期。E2の実測限界、E3の集計・未測定、ArchitectureのE4同期は整合。

全結果が揃うまで編集せず、2件の統合是正方針を全担当へ再提示して整合した。本番処理・過去結果・未確認の完成条件は変更していない。今回の追加指摘は、新しい規則不足ではなく、既存の「状態名だけで資源状態を推定しない」「結果更新と現在の処置一覧を同期する」の適用不足として同じ変更内で処置する。

是正版`7a7d8a67e6d6dcec2d8e7a08e77ca42da81b97e3`／Tree `cf90b85b85b7c440db635fc9d21f781f2e55310e`で、Task取消と文書の両担当が指摘解消・限定Pass、追加指摘0を確認した。DGI-02も解消した。Git除外設定の評価対象3ファイルはb3807b9から不変であり、担当確認に基づき限定Passを維持する。共通Checkerは2026-08-31T14:15:35.632Z、387文書・2,677リンク・886アンカー・固定履歴24件、エラー／警告0。全体1,469試験は2033dfeの結果、是正後の7試験は7a7d8a6の結果として区別する。OS通知・実Docker取消回収とRuntime全体の完成判定へ、この限定Passを拡張しない。

<a id="public-task-cancellation-observation"></a>

## 実TaskのCtrl+Cと正規回復

2026-08-31T14:29:28.760Z〜14:30:42.969Z、署名固定版`45ea2ac`の公開Taskを実端末から実行し、Ctrl+Cを1回入力して取消の到達を確認した。対象Repositoryは`fac0ef0`で変更なし、観測記録識別子は`public-cancellation-45ea2ac-fac0ef0`。ただし`cleanupConfirmed: false`となり、`created`状態のCodex containerが残った。Reviewerの準備へ進んだことは観測したが、signalの正確な時刻とDocker作成CLIのstdoutは取得できていないため、取消との前後関係および失敗原因を完全同定したとは扱わない。このrunは取消正常終了の合格ではない。

返された2件のDocker Recovery IDについて、2番目を正規入口で回復して`docker_task_recovery_completed`、その後に先頭を処置して`docker_task_recovery_finalization_completed`を確認した。対象のDocker label資源は0、exactなHost rootとmarkerは`ENOENT`、署名版の`inspectRuntimeOwnedDockerTaskRecoveryState`は`completed`／`docker_task_runtime_state_clean`、手動回復不要、回復IDなしだった。正常な取消後回収と、この事後の正規回復成功を区別する。

その後のHost ID単独の再試行は、既にmarkerが消えている状態で`host_recovery_failed`となった。これは新しい残存資源の根拠ではなく、先行するexact回収と状態観測を取り消さない。添付場所、Provider Home、実Host絶対Path、生のlabel情報は本記録へ転載しない。

現行Controllerの照合では、CREATE結果の待機後に取消を優先して受領情報を保存せず停止する経路を確認した。全5種類のCREATEについて、受領情報の欠落を再現する試験は旧処理で5/5失敗した。是正では、正常な作成結果を検証・保存してから取消へ進み、以降のコマンドを発行しない。非CREATEの取消優先順位、ID不正・保存失敗・未取得結果・回収不明の停止と回復義務を保持する。34例を追加し、関連3ファイル100/100、型2設定・Lint・整形を通過した。最初のsandbox実行は子Process終了の権限制約により96/100であり、今回の所有PID8件の不存在と一時領域5件の回収を確認して通常権限で実行した。これは有力なコード欠陥の反証・是正根拠であり、stdout未取得の今回runと同一原因だったことの完全証明ではない。全体試験は下表へ記録し、是正後の実取消再測定と独立確認は未完了として保持する。

並行した全体確認では、Checkerの208件中1件がsource追加と型検査の参照関係の変化に追従していなかった。物理ファイルと型検査対象を全数照合し、期待数をproduction 146→151、test 152→159、全TypeScript 310→321へ是正した。完全一致の検査は残し、その先で検出した既存命名違反15件と今回の試験識別子も是正した。公開キー・Schema・出力・実行順序は変えず、限定命名試験7/7を通過した。Nativeは旧build cacheに残った移設前の絶対Pathによる失敗を、新しいtarget directoryのfresh buildで切り分けた。ソース変更なしで34成功・2 ignoredとなり、ignoredを成功へ数えない。

追加是正後の開発確認は、基準`fac0ef0`に本節の変更を加えた作業Treeで行った。

| 確認 | 結果 | 限界 |
|---|---|---|
| Coordinator全体試験 | 1,503/1,503成功、失敗・取消・skipなし、141,791.3186ms | Provider・実Docker・OSからの取消配送はこの試験の対象外 |
| Checker全体試験 | 208/208成功、失敗・取消・skipなし、225,158.0395ms | 初回207/208の失敗は保持する |
| 設計対応・型・Lint・整形 | 資源9・状態20・遷移21・不変条件10・検証対応10、型2設定、Lint323・整形322ファイル成功 | 設計対応の静的成功を実資源回収の証明としない |

CoordinatorのTAPはRepository-localな非正本記録`closure-create-cancel-fac0ef0.tap`に保持し、SHA-256は`bb9a4287f6af5b3726e90b3c2f0de16d78f4e6db9570c3e8e5e41f9fce6cb4ae`。今回は分岐網羅率の再計測ではなく、前節の2033dfeの率を新しいsourceの率へ流用しない。是正後の実取消・最終配布E2Eと独立確認は未完了として保持する。
