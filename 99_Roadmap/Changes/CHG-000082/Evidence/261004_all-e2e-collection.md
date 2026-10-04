# 是正前のE2E全体確認 — 途中結果

成果物種別: 検証結果
対象変更: [CHG-000082](../change.md)
確認日: 2026-10-04
担当責任者: Qual-Lab

## 結論

是正を先行せず、現在の試験を実行して失敗と未実行を収集した。MCP／Shared Server、CROS、実Browser、Recovery Matrix、WorkbenchのCodex・Claude助言は通過した。一方、実Taskの送信確認が時間切れになった経路と、Provider開始前に停止したProject Runtimeが残る。全E2E完了または全体合格ではない。

製品Sourceと試験期待値の是正は行っていない。以前二回観測した表示GETの`ECONNRESET`は、今回の両助言では再現しなかった。未修正の間欠的失敗として保持し、解消済みとしない。

## 対象と限界

- 検証側はHEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`と既存未Commit状態。署名実行側は保存済みCommit `d36a9dec73250705019ab97e7a3c1cfd85b09292`。最新の未署名Recovery実装まで実境界検証済みとは主張しない。
- 固定Taskの既承認範囲を維持し、採用、Commit、Push、Docker再起動、旧残存削除、秘密値の記録、API Keyへのfallbackは行っていない。
- 実行時の送信確認は迂回しない。確認期限を過ぎた端末の入力は再利用せず、再実行時は新しい端末の当該確認だけを完了する。
- 型・Lint・Formatter、局所／統合試験、実Browser、署名実Provider試験を区別する。試験件数をQuality Local Itemの観測済み件数へ直接加算しない。

## 実行一覧

| 対象 | 結果 | 判定の限界 |
|---|---|---|
| Workbench／MCP／CROS／CoordinatorのFormatter・型・Lint | 12確認すべて成功。 | 実Provider成立の証明ではない。 |
| Workbench公開統合試験 | 33件中31成功、2失敗。 | Repositoryの現在投影に対する固定期待値が不一致。後述の是正候補とする。 |
| MCP公開Transport／Shared Server | 17件成功、失敗・skipなし。 | 試験が所有する接続・終了境界の結果。 |
| CROS Session／Context／Result | 6件成功、失敗・skipなし。 | Fixtureによる試験であり、実AIの結果ではない。 |
| Workbench実Browser | 1件成功。15画面、27表示条件を確認。 | 全体実行65246ms。終了処理最大1806ms、Process Tree観測最大665ms、終了Fallback 0回。 |
| Coordinator System契約試験 | 正式packageの作業Directoryで185件中181成功、1失敗、3skip。 | 失敗は新規Host AdapterのSource許可一覧との不一致。skipを成功へ含めない。 |
| 署名四経路 | forward／reverse／same-codex／same-claudeすべて終了コード2。 | 経路別の正式理由が保存できていないため、全件を同じ原因へ断定しない。再実行と結果保存が必要。 |
| 署名Reviewer境界 | 1経路開始、完了0。送信確認の時間切れ。 | `coordinator_task_external_send_confirmation_timeout`。Provider検証の失敗とは区別する。 |
| 署名Recovery Matrix | 7場面の全体判定成功。 | 固定Workerによる故障・取消・再入場の確認。実Provider送信の確認ではない。 |
| Project Runtime公開MCP実Provider | 全体未成立。通常二経路は`project_runtime_replan_required`で停止。 | Provider選択・Process開始は未観測。取消・親Process喪失・再入場の14指摘は連鎖した未成立であり、14個の独立欠陥ではない。 |
| Workbench Codex助言 | 成功。参照先一致、Provider終了とcleanupを確認。 | 今回の表示GETは成功。以前の通信断を解消済みとはしない。 |
| Workbench Claude助言 | 成功。参照先一致、Provider終了とcleanupを確認。 | 同上。 |
| Workbench Codex変更候補 | 候補完成前に送信確認が時間切れ。 | 候補IDなし。Executor終了、Listener終了、Docker一覧clean、追跡内容不変を確認。候補破棄の結果記録はない。 |
| Workbench Claude変更候補 | 未実行。 | 前の候補で明示的な終了確認の必要条件を満たせず、バッチが後続開始を止めた。安全条件を弱めて進めない。 |

## 是正候補と再確認対象

| 分類 | 観測 | 次の確認 |
|---|---|---|
| 試験期待値の不一致 | `project-surface.contract.test.ts:53`は未観測件数`29 / 40`を期待するが現在値は`33 / 46`。`workbench-server.contract.test.ts:367`は旧次Gate文章を期待する。 | 現在投影への追従方法を確認する。製品不良と断定せず、期待値だけを無条件更新しない。 |
| Source契約試験の不一致 | `interaction-boundary-regression.contract.test.ts:2509`の許可一覧に`host-recovery-namespace-windows-adapter.ts`と`host-terminal-windows-adapter.ts`がない。 | 未Commit実装の責務と許可範囲を確認してから処置する。 |
| 未解消の間欠的失敗 | 以前の二実行でGETの`ECONNRESET`、今回の両助言は成功。 | 失敗条件と成功条件を比較する。今回の成功だけでタイムアウト延長や自動再送を採用しない。 |
| 実行前の確認待ち | ReviewerとCodex候補の送信確認が時間切れ。 | 人間が端末を操作できる時点で新しい確認を提示し、未完了経路を再実行する。製品Sourceの是正対象件数へ混ぜない。 |
| Project Runtimeの連鎖した未成立 | Provider開始前に再計画要求となり、後続の取消・再入場条件に到達していない。 | 実行時の正式入力・許可・Task結果から最初の停止原因を確認する。実装修正は全体収集後に判断する。 |
| 結果保存の不足 | 四経路の終了コードはあるが経路別理由を保存できていない。 | 正式結果を保存できる検証入口で再実行する。欠落した理由を推測で埋めない。 |

作業Directoryを誤った試験実行と、起動コマンドを誤った収集Toolの失敗は、正しい起動で再実行済みであり、製品欠陥へ数えない。初回Coordinator試験の追加失敗は最終再実行で再現せず、独立欠陥の確定根拠としない。

## 原記録と次の進め方

### 最初の経路の再実行

人間の再開指示を受け、外部対話端末でforward経路を一件だけ再実行した。今回は正式結果を`.crdd/verification/e2e-signed-case-results-261004/forward.json`へ保存した。結果は`blocked`、理由は`coordinator_task_external_send_confirmation_timeout`。`cleanupConfirmed: true`、`manualRecoveryRequired: false`、`processRestartRequired: false`、`effectStateUnknown: false`、`canonicalRepositoryChanged: false`であり、回復IDの各一覧も空だった。これはforwardの理由を確認できた結果であり、前回の残る三経路の理由を同じと断定する根拠にはしない。

送信確認入力が完了せず、E2E成立条件まで到達していない。確認画面が人間に表示されていたかは未確認のため、人間の拒否や製品Providerの故障に読み替えない。同じ時間切れを連続させず、端末の表示状況を確認するまで次の実Taskを起動しない。製品の是正は行っていない。

### 確認入力後の実失敗

人間は前の画面が表示されたが未入力だったと回答した。新しい端末で再実行し、今回は入力完了を確認した。正式結果は`.crdd/verification/e2e-signed-case-results-261004-input-ready/forward.json`へ非上書き保存した。

結果は`coordinator_task_provider_failed`、`cleanupConfirmed: false`、`manualRecoveryRequired: true`。`canonicalRepositoryChanged: false`であり、Repository内容の変更はない。公開結果の`effectStateUnknown: false`だけでcleanup成立とは判定しない。

- 実際の経路は、front Codex → executor Claude → reviewer Codex。開始前の利用者説明にあった「Codex実行／Claudeレビュー」は不正確だったため、正式な経路選定と観測を優先する。
- ClaudeはProcess開始、終了コード0、Process Tree終了、Container／Network不存在、cleanup成功まで観測した。
- Codex Reviewerは構成通知後、Container作成・Process開始・終了後不存在が未確認となった。レビュー内容の失敗ではなく、その開始境界の失敗を是正候補として保持する。
- `WriteStream`のerror／close Listenerが各12個となる`MaxListenersExceededWarning`も観測した。警告だけを失敗原因や実Leakの証明にしない。
- 今回のHost回復ID一件とDocker回復ID二件が返った。旧三件と同一視せず、exactな返却参照を原結果で保持する。

既存の通常回収をCodex側の今回のexact Docker回復IDに一度実行したが、`docker_task_recovery_create_outcome_unknown`で停止した。原結果は同Directoryの`exact-recovery.json`。追加のAI依頼、Docker再起動、永続データ削除は行っていない。回復一覧は二件・手動回復要求を保持しているため、新しいProvider試験は開始しない。

製品是正や復旧機能の拡張は行わず、既存の検証付きDocker再起動を今回の回復IDへ結合して一度行うか、人間へ確認した。他のDocker処理の中断可能性を示し、承認前には実行しない。

### 既存手順による回復の停止

人間は今回の検証付きDocker再起動を承認した。実行結果は`docker_restart_scope_conflict`、`restartCompleted: false`、`taskRecoveryCompleted: false`、`cleanupConfirmed: true`。再起動は発行されていない。原結果は`approved-restart.json`へ保存した。

同じ試験のClaude側exact回復IDも既存の通常回収で一度確認したが、`docker_task_recovery_host_inventory_incomplete`で停止した。原結果は`exact-claude-recovery.json`。Docker回復一覧は引き続き二件、active Home BindingはCodex側一件、手動回復要求あり。Scope比較またはHost観測の条件を緩めず、IDの手動再生成、状態記録の書換え、名前に基づく削除、追加再起動は行っていない。

残るProvider E2Eはこの共有実行基盤の回復待ちにより実行できない。全E2E完了を主張せず、最初のProvider開始境界の失敗、通常回収の二種類の停止、再起動のScope拒否、Listener警告を別の観測として保持する。これらを独立欠陥数へ機械的に加算せず、因果と根本原因は未確定とする。

最新の進行条件: 製品是正前の全体収集という指定を維持しているが、現行手順で安全に続行できないため、今回の実行阻害だけを先に是正して残りの収集へ戻すか、人間判断へ返す。旧三件の清掃、汎用Recovery、ACL移行またはその他の機能追加を是正範囲に含める提案ではない。

原記録はRepository-localのGit非追跡領域へ保存した。

- `.crdd/verification/e2e-static-collection-261004/`
- `.crdd/verification/e2e-local-collection-261004/`内の各logおよび`coordinator-system-package-root.tap`
- `.crdd/verification/e2e-signed-core-collection-261004/progress.json`
- `.crdd/verification/144359d8-d916-4228-b6a6-f78bb1a46143/result.json`（Reviewer）
- `.crdd/verification/5ed92d8c-2dd7-41ae-9d37-b6d1c2fbcd01/result.json`（Recovery Matrix）
- `.crdd/verification/project-runtime-public-real-providers-1791116046674/result.json`
- `.crdd/tmp/workbench-e2e-collection-261004-<case>.result.json`と`*.settlement.json`（失敗caseには成功resultなし）

旧Host残存三件は保持し、この収集で処置していない。確認入力後の実失敗による今回の回復待ちを未解決のまま新しい実Taskを開始しない。既存の通常回収・承認済み再起動でも続行できず、是正順序の限定変更について人間判断へ返す。全経路の成功・失敗・未到達をそろえた後に、根本原因ごとの是正計画を提示する原則は維持し、追加のRecovery設計は先行しない。

原記録の保持要否はPhase 5の結果確認時または2026-10-11に再評価する。参照中の記録や物理残存を名前・経過時間だけで削除しない。

## 作成境界の診断を限定補強した結果

人間は、全E2Eの再実行やRecovery拡張より先に、認証確認用Containerの作成境界を局所診断する方針を承認した。Timeout延長、Docker再起動、Provider／Model変更、Fallback追加は原因が示されるまで行わない。

既存記録の比較では、Claudeの終了・清掃後、Codexの認証確認用Containerについて作成意図の記録だけがあり、作成応答の記録とReviewerのProcess開始はない。意図の記録は要求発行の証明ではなく、Docker拒否、通信Timeout、要求前の例外のいずれかを現在の記録だけでは確定できない。途中で成功した基準版との比較でも、通常Taskの作成Planと設定期限に原因と断定できる変更は確認できていない。

現在実装では、最初の失敗の段階・固定理由・安全な例外分類と、Command Handle取得／応答観測／Receipt記録を、後続の清掃結果とは別に境界通知へ保持する。例外本文、Secret、PathまたはProvider本文は保存しない。Handle取得をDocker受理、応答観測を耐久記録と同一視しない。通知はbest-effortであり、Process喪失時の保存保証や追加Authorityを与えない。従来の公開結果、取消・清掃・回復条件は変更していない。

検証結果:

- Formatter、型検査、Lint、Runtime Capability Graphと既存Traceability確認はPass。
- Controllerと実Process検証Toolの対象契約試験は129件Pass、失敗・skipは0件。外部Docker／Providerを使わない局所確認である。
- 独立確認の2指摘を是正し、更新版の対象限定再レビューはPass。開始失敗後の終了例外による一次原因の上書きと、配列を文字列へ変換して受理するParserの穴を確認した。

事故原因は未確定。現在の診断追加は未署名であり、既存署名Runtimeの実環境成立を意味しない。今回のexact回復待ちも未解消のため、新しいProvider試験は開始していない。次は既存記録と要求前の実行経路を照合し、追加の外部Effectを発行せずに再現できる範囲を先に確認する。今回の結果からRecovery拡張やTimeout変更を採用しない。

## Checklist

- [x] 人間の指定どおり、Source是正より先に試験結果を収集した。
- [x] 通過、失敗、未実行、skip、起動方法の誤りを区別した。
- [x] 旧署名Runtimeと未署名の現在実装を区別した。
- [x] Provider開始前の停止とProvider実行の失敗を区別した。
- [x] 連鎖した指摘件数を独立欠陥件数に読み替えなかった。
- [ ] OPEN: 四経路、Reviewer、変更候補、Project Runtimeの未完了範囲が残る。端末の確認入力と正式結果保存をそろえて再実行する。
- [ ] OPEN: 全E2Eの収集が終わっていないため、是正対象の最終一覧と全体合格を確定しない。
