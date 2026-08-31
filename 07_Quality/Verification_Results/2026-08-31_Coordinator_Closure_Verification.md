# Coordinator完成監査後の追加検証

状態: 是正・追加確認中。Runtime全体の合格ではない
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 結論

署名固定版`45ea2ac`の実Provider是正1往復は、候補の内容確認・破棄まで成功し、独立再確認も通過した。開発版`48664a2`では本番と同じWindows子Process終了処理を試験へ接続した。ただし全体試験で検査対象一覧の移設漏れとGitローカル除外設定試験の間欠失敗を検出した。合格した限定試験だけで全体完了とはしない。

## 固定対象と結果

| 確認 | 対象・結果 | 限界・次の処置 |
|---|---|---|
| 実Provider是正1往復 | [45ea2acの固定根拠](../../90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md)。Claude実行→Codex確認→Claude是正→Codex承認、最終6 bytes確認・同じ候補の破棄まで成功 | 欠陥を仕込んだ1件。是正成功率、逆方向、実Provider取消を証明しない |
| 共有Process所有処理 | `48664a2`、関連64/64、型2設定、対象6ファイルのLint／Format成功 | 初回はsandbox内のtaskkillアクセス拒否で59/64。試験が生成したPIDだけを確認・回収し、通常権限で64/64。初回失敗を隠さない |
| 独立再確認 | `48664a2`の抽出6ファイルと是正Evidenceは追加指摘0 | 実装担当とは別の確認者。取消の公開Task全体は部分解消であり、OS通知・実Dockerを観測済みにしない |
| 全体試験・網羅率 | `48664a2`／Tree `e80b0cb0ea170ef8ff8c9ff3ee56aeb70041d0c6`、1,460件中1,458成功・2失敗・skip/取消0 | 移設前の`docker-effect-runtime.ts`を残した所有一覧と、`post-write Repository replacement`の置換未到達を検出 |
| 一覧是正後の全体試験 | 同じ親版から所有一覧1件を`docker-owned-process.ts`へ修正。1,460件中1,459成功・1失敗 | 一覧試験は解消。Gitローカル除外の別ケースで失敗し、原因調査中。成功するまでの無条件retryにしない |
| Gitローカル除外の限定確認 | 初回単体23/23、coverage付き23件×10回成功、一時フォルダ残存0 | 単体成功は全体失敗を取り消さない。書込み・close・Identity再確認の第一停止点を確認する |

実行環境はWindows、Node.js `24.19.0`、作業Directoryは`40_Develop/coordinator`。`TEMP`／`TMP`はRepository Root直下の`.crdd/test-tmp`に限定した。全体試験は固定Fixtureによる検証であり、Provider通信やDocker修復を追加していない。初回の3 reporter同時使用ではNodeのテスト用streamに`MaxListenersExceededWarning`が出た。次回はTAP／LCOVの2 reporterとした。この警告を本番Runtimeの資源漏れの証拠とも、無問題の証拠とも扱わない。

## 分岐網羅率の測定範囲

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

- 取消: Task Runtime、Controller、本番共有Process終了、外周cleanupを同じ試験で接続する。OSからのCtrl+C配送と実Docker回収はそれでも別の確認であり、直接listener呼出しで代替したとは主張しない。
- Git除外設定: 全体実行での失敗点を特定する。期待値やIdentity検証を緩和しない。
- 検証記録: 是正後の固定対象で全体試験と計測を更新し、必要な独立再確認を行う。
- 配布: `45ea2ac`の署名実測は変更前の実装に限定する。開発変更の都度再署名せず、最終候補が固まってから配布確認へ進む。

担当はQual-Lab。上記は[CHG-000015](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md#完成監査後の限定是正)と[CHG-000017](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#完成監査の現在表示と検証記録の是正)で追跡し、統合・リリース判断は別に残す。

## 追加切り分け

Gitローカル除外の限定coverage試験は、その後120実行・2,760試験まで再現せず終了し、一時物残存0だった。これ以上の反復だけでは原因を特定できないため、失敗時だけ固定理由、Filesystem操作、Identityと時刻を取得する試験観測へ切り替えた。本文やhost pathは記録しない。

Windowsは書込みhandleを閉じるまで最終書込み時刻の確定を保証しない。[Microsoft File Times](https://learn.microsoft.com/en-us/windows/win32/sysinfo/file-times)、[WriteFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile)。現行のexclude書込みはclose前の時刻をclose後にも要求するため、正常なOS更新を拒否し得る。この設計上の不一致と、上記2回の間欠失敗が同じ原因であることは分けて扱う。決定論的な時刻更新と、同名置換・同サイズ改竄・mode変更・close失敗の対照を使い、Rootや既存excludeの初期snapshotを取り直さずに是正する。

是正では、自己書込み後のclose前／close後それぞれの時刻更新を決定論的に再現し、旧実装の正常更新拒否を確認してから修正した。同時に、書込み後のhandleとPathのmodeだけを比較して最初のmodeからの変更を見逃す点も、旧実装の誤受理を確認して是正した。元のtype／device／inode／birthtime／mode／Path、期待size、close後の内容完全一致、rename直前の厳密照合を保持する。関連62/62、型2設定・Lint・Formatが成功し、一時物残存0。一般のIdentity比較やRoot／既存excludeのsnapshot更新には拡張していない。

Task取消の追加2ケースを含む7/7も成功した。開始・完了結果の本番projector、同じ回復handoff、Host回収準備→実領域の回収→receipt→finalizeを接続した。初回のFixture識別子形式不足と、取消受付・Process終了の観測順序を混同した試験期待は試験側で是正した。本番コードの意味変更はない。新2ケースの5反復も成功したが、反復回数を観点網羅の代わりにはしない。

OS取消の入口確認では、自動端末接続のstdin/stdoutがTTYであることを確認し、制御文字を送ったが、30秒内にSIGINT handlerへの到達を観測できなかった。待機期限後にlistenerを元件数へ戻し、試験Processは終了した。Provider・Docker・許可発行はない。この送信方法を利用者のCtrl+Cと等価とみなさず、端末からの配送は未確認のまま保持する。
