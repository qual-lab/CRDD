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

### 要求前の検査と成功版差分の追加照合

2026-10-04に、成功した`45254e2b`から失敗した署名版`d36a9dec`までの通常Task経路を追加照合した。実行領域の検証処理と通常の作成計画には差分がなく、Docker Effect側の主な追加は助言専用Imageのinit条件だった。この条件は`workbench_advice`と専用Imageの両方一致を要求するため、今回の`isolated_task`へ適用されない。差分不存在だけで実環境の同一性や故障不存在を証明しない。

要求前の実経路は、実行領域のIdentity確認 → 作成計画の照合 → Docker CLI検証 → 専用設定Directory作成 → Command所有関係確認 → CLI再検証 → Process発行となる。作成意図はこの経路より先に記録される。今回のexact実行領域を読み取りで確認したところ、managementにはactive Task記録があり、`docker-cli-config`はなく、eventsも空だった。tmpにはClaude用領域がある。これは現在の残存状態であり、過去に設定Directoryが作られなかったことの確定証拠ではない。未知の残存や記録を変更・削除していない。

既存のAdapter由来fixtureから、Claude executor／Codex reviewer、通常Task、Codex互換Model `gpt-5.5`、mediumの作成計画を局所構築し、Effect Runtimeの実際の計画検証へ渡した。両方とも計画検証を通り、Process発行直前に固定停止した。CLI、FilesystemとProcessは差替えたため実Docker要求・Provider依頼は0件であり、今回の事故を再現した結果ではない。初回のfixture構成では選定根拠とeffortが不一致となりprepare前に拒否された。fixtureを修正後に上記を確認したもので、製品欠陥へ数えない。再実行用の非追跡診断は`.crdd/tmp/auth-create-plan-preflight-261004.mjs`。

次の優先対象は、Claude終了後に共有実行領域をCodexが再利用する際のIdentity／設定作成／Capabilityの状態差である。ただし、現在の記録には元の例外とProcess発行有無がないため、原因を確定していない。Docker自体の拒否や通信Timeoutも完全除外していない。保存済みexact回復待ちを無視して新Taskを発行せず、共有領域の状態変化を外部Effectなしで再構成する。Timeout延長、再起動、モデル変更、Recovery追加を是正として採用しない。

### 共有実行領域の再利用の局所確認

保存済みHost記録のRootおよび六つのChild Directoryについて、現在のdev／ino／birthtimeNs、Directory種別、Symbolic Linkではないことを読取りで比較した。すべて一致した。初回比較で`providerHome`という記録キーを実Directory名へ用いてENOENTとなったが、実名`provider-home`で再確認し一致した。観測コードの誤りを製品の消失へ数えない。この比較は現在の実体についての確認であり、失敗時点のProcess内Generation／Capabilityが有効だったことを証明しない。

現在のDocker CLIを、既存のAuthenticode／Filesystem Identity検証で読み取り確認した。成功し、所要時間は参考値1686msだった。Docker CLI自身のProcess、Container作成、再起動、Provider依頼は発行していない。当時の署名観測Timeoutをこの一回の現在値で否定しない。

Repository-localの自己生成領域で、実装の設定Directory作成・Identity検証・除去関数と、実Docker CLIの署名検証を用い、同じ管理ObjectへClaude通常TaskとCodex reviewer通常Taskを順に渡した。Docker ProcessとContainer観測は固定fixtureへ差替えた。清掃前の別Planは`docker_effect_plan_replaced`で拒否され、Claudeの清掃後はContext破棄と設定Directory除去が成立し、Codexの新規設定作成も通過した。設定Directoryは二回作成・二回除去、最後に自己生成した空領域の不存在まで確認した。実事故の再現ではなく、共有Objectと設定再作成だけでは恒常的に失敗しないことを確認した結果である。

今回の原因を共有領域再利用の一般的な欠陥と断定する根拠は得られていない。失敗時の実Plan、Process内Generation／Capability、CLI署名検査の結果、Docker Process発行の有無は元記録から復元できない。後から成功したfixtureや現在のFilesystem値で補完しない。次の実測では追加した一次診断を使用し、まずCommand Handle取得前後を区別する必要がある。未署名の診断を旧署名Runtimeの結果へ混ぜず、exact回復待ちを無視して新しいProvider Taskを発行しない。履歴だけでの原因確定はできておらず、是正案を採用した状態ではない。

### 通常回復の再確認と再起動判定の阻害条件

人間の再実行・継続指示を受け、署名候補d36a9decを再検証したうえで、元Taskが返したexact Docker回復ID二件だけを既存の通常回復で再確認した。Codexは`docker_task_recovery_create_outcome_unknown`、Claudeは`docker_task_recovery_host_inventory_incomplete`で引き続き停止した。前後の一覧は回復二件、active Home BindingはCodex一件、manual Recoveryありで変わらない。新しいProvider依頼、Docker再起動、記録の手動書換えまたは削除は発行していない。非上書きの原結果は`.crdd/verification/coordinator-retention-inventory-261004/artifacts/exact-recovery-recheck-1791121454825.json`。

既存の再起動判定を照合すると、全回復IDから導いたHome Binding集合と、active Home Binding集合の完全一致を要求している。今回の集合は前者がCodex／Claude、後者がCodexのみで一致しない。この入力では当該判定が必ず`docker_restart_scope_conflict`となる。Claudeの通常完了記録が残る一方でCodexが同じHost Rootを使用中とする構成が、通常回復と再起動の双方を妨げている。

これは回復を妨げる条件の特定であり、元のCodex認証確認用Containerの作成失敗の原因特定ではない。完成済みの履歴記録をactive資源と同じ扱いにする判定を見直す候補があるが、単純な一致条件の削除や集合包含への置換は採用しない。完了記録・非使用・共有Hostとの対応を検証した対象と未解決対象を分け、未知のactive対象を許さない必要がある。既存回復判定の変更と新しい署名Runtimeの検証が必要になるため、実装・再起動へ進む前に限定是正の採否を人間へ返す。全E2E再実行はまだ開始していない。

### 今回の残存資源の読取り確認

人間の指示により、回復からの再実行を前提にせず、実残存と完了確認不足を区別した。信頼確認済みDocker CLIを用い、今回のCodex／Claudeのexactな三Container名・二Network名と各所有ラベルで一覧照会した。計14照会はすべて終了コード0、標準エラーなしで完了し、対応資源は0件だった。観測不能を空一覧へ畳んでいない。原結果は`.crdd/verification/coordinator-retention-inventory-261004/artifacts/exact-e2e-residual-1791122131821.json`。実Container／Networkの削除・停止・再起動・Provider依頼は0件。

WindowsのProcess一覧を読み取り、前回の固定E2E起動ファイル名またはexactなHost RootをCommand Lineに持つnode／docker／cmd／PowerShellを照合した。一致Processは0件だった。Command Line本文は報告していない。この検索は指定された入口・Rootに結合できるProcessの現在観測であり、Command Lineに相関情報を持たない全子孫や、Docker daemon内部の過去要求の完結を証明しない。

Host Rootは残存している。直下六領域の読取り確認では、workspaceにDirectory二件、tmpにDirectory一件、managementに管理File二件があり、provider-home／events／projectionは空だった。下位の本文・秘密値は読んでおらず、Directory件数から全下位内容や非使用を推定しない。Hostの実残存とRuntime Stateの回復記録・active Leaseは別に保持する。

現時点で不足するのは、Codexの過去の作成要求がすでに終結し、後から資源を作成し得ないことの根拠と、共有Hostの回復管理を正式に閉じる条件である。現在の資源0件は確認できたが、意図記録のみ・Receiptなしを要求未発行と読み替えない。現行の通常回復はこの場合に再起動Fenceを要求するが、その再起動判定に前節の集合不一致がある。したがって、実在するContainerを清掃するためにRecoveryを増築する必要があるという説明ではない。正式終結の根拠をどう成立させるかが残件であり、手動で記録を削除・完了化せず、再起動も発行していない。

### 回復簡略化の独立した設計評価

人間は、過去の不明な作成結果を成功へ変更せず、現在の安全な新規実行と過去Attemptの終結を分離する方向の反証を求めた。ArchitectureとQualityの読み取り専用確認を統合した結果、方向は妥当だが、現在の観測だけでは実処置へ進めない。

今回の限定候補は、実行開始前に止まった認証確認用Containerの作成である。Codex Adapterは`create`と`start --attach`を分離し、Controllerは作成応答とReceipt記録の成功後だけ次命令へ進む。作成Planはnetworkなし、read-only root、read-only Provider Homeを使い、Workspaceを共有しない。これはSource上の確認であり、Docker daemonの遅延要求や既定動作の実境界保証を確認済みとはしない。

| 判断対象 | 評価結果 |
|---|---|
| 過去Attemptの終結 | 作成結果unknownと元Recovery Identityを保持し、退役を清掃成功と区別する案を検討する。 |
| 現在の新規受付 | 旧Ownerが今後startを発行できず、旧領域を再利用せず、遅延createがあっても処理を開始しないことが確認できた場合だけ、新Identityへ進める候補である。 |
| 残存清掃 | 遅延した停止Containerの出現可能性が残る場合はexactな清掃義務を保持する。`cleanupConfirmed:true`へ変更しない。 |
| 人間承認 | Attempt終結の判断権限であり、技術的な不存在・終了・無害性の証明を代替しない。 |
| 再起動 | 一律必須とはしない。安全性に必要な終了境界を他の方法で確認できない場合だけ、必要な停止範囲を特定する。既存操作はDocker Desktop再起動であり、Windows再起動とは異なる。 |

未確認は、旧Ownerと全子孫の終了境界、Docker createの遅延完了時の非実行保証・restart policy・bind mount資源確保の意味、共有Provider Homeの非競合である。現在のDocker資源0件と入口に結合したProcess0件だけでは補完しない。Provider開始後、Proxy起動後、write可能Mountまたは外部送信不明へ、この限定候補を一般化しない。

最小検証対象は、安全な退役後の新規受付、観測不能の拒否、照会後の遅延create、旧Owner生存時の拒否、Claude完了とCodex未解決が共有Hostへ結合する場合の区別、終結記録前後のProcess喪失・再入場・競合、Evidence／Candidate保持、および公開入口からのforward E2Eである。既存の「Receiptなしでは空一覧だけを清掃証明にしない」試験を単純反転せず、清掃完了と新規実行の安全性を別判定として反証する。

この確認は設計案の評価であり、採用、実装、署名、全体レビューPassまたはE2E合格ではない。手動削除、回復記録の上書き、Docker再起動、新しいProvider依頼は行っていない。次は未確認の必要保証だけを調べ、成立する最小案と実装範囲を確定する。

### 開発PCの旧実行状態リセットと記録方式の縮小

人間は、このPCの古いCoordinator実行状態をリセットし、認証情報、署名鍵、Repository成果物とEvidenceを保持する方針を承認した。棚卸し後に一時43フォルダの削除を指示し、続いて送信同意以外の旧記録削除と、Coordinator／RuntimeState全般の記録・回復方式の縮小を指示した。

| 処置 | 結果 |
|---|---|
| Coordinator一時作業領域 | 確認済み43フォルダを削除し、全対象の不存在を確認した。残存15ファイルは既知試験データ、実行管理記録、Git保存済み設計文書またはE2Eマーカーと分類した。 |
| RuntimeStateとHost回復記録 | 一覧に固定した355ファイルのうち送信同意2ファイルを除く353ファイルを削除した。空になった記録Directory44件も削除した。 |
| 保持対象 | 送信同意2ファイルは前後SHA-256一致。認証Home、署名鍵、Repository、検証Evidence、署名配布物は削除対象外。 |
| DockerとProcess | 処置前に検索対象のCoordinator Process0とCRDD名Container0を確認した。別用途のjarvis資源を変更せず、Docker再起動、停止、Provider依頼を発行していない。 |
| 署名Runtimeによる再確認 | 保存済みd36a9decの読取りInventoryは`docker_task_runtime_state_clean`、Recovery ID空、active Home Binding空、`manualRecoveryRequired:false`を返した。 |

これは人間が明示した開発PCの状態リセットであり、過去の不明な作成要求の結果を成功へ変更したものではない。旧Taskの通常回復成功、過去Effect不存在、追加診断の署名確認または全E2E合格を意味しない。過去の失敗結果と本Evidenceは保持する。削除前のフルパス一覧は非追跡の`.crdd/verification/coordinator-retention-inventory-261004/artifacts/coordinator-remaining-files-261004.md`にあり、現在存在するファイル一覧ではない。

次の変更は同じCHG-000082の途中見直しとして扱う。Coordinator／Runtime Dataの回復状態、診断履歴、終了記録、同意／設定および成果物を分類し、未解決の再入場情報は診断ログのローテーションと分ける。履歴を現在稼働の根拠にしない。終了後の既存清掃・利用側の確定接続を先に確認し、必要な現在状態の集約、終了履歴の圧縮、件数／容量／期間の上限、清掃契機と実装削減を設計する。Operationごとの多数File／Directoryを当然の完成形としない一方、単に一File化して取消・crash・競合・再入場保証を失わない。

変更分類は非自明な回復・保存Lifecycle変更。着手前整合確認、独立技術レビュー、文書確認とGap／Impact確認を適用する。CRDD準拠基準自体は現在の変更対象ではなく、現時点では準拠監査を追加しない。保持する条件は秘密値非記録、exact対象範囲、一次失敗の保持、未解決義務の非消去、Evidence／Candidateの保全、取消とProcess喪失後の安全な再入場である。採用するSchema、ローテーション値と移行方式は未確定であり、この記録だけで実装完了や採用済みとは表示しない。

## Checklist

- [x] 人間の指定どおり、Source是正より先に試験結果を収集した。
- [x] 通過、失敗、未実行、skip、起動方法の誤りを区別した。
- [x] 旧署名Runtimeと未署名の現在実装を区別した。
- [x] Provider開始前の停止とProvider実行の失敗を区別した。
- [x] 連鎖した指摘件数を独立欠陥件数に読み替えなかった。
- [ ] OPEN: 四経路、Reviewer、変更候補、Project Runtimeの未完了範囲が残る。端末の確認入力と正式結果保存をそろえて再実行する。
- [ ] OPEN: 全E2Eの収集が終わっていないため、是正対象の最終一覧と全体合格を確定しない。
