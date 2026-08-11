# 変更トレース: Coordinator Runtime 1.0

変更トレースID: `CHG-000015`
状態: `Draft`
担当責任者: Qual-Lab
最終更新日: 2026-08-11
対象系列: Coordinator Runtime 1.x
対象バージョン: 1.0 Candidate
変更分類: `additive`（非規範Reference Implementation候補）
リリースレベル: 未確定
`migration_required`: `false`（Runtimeを未採用のCRDD利用側。将来の配布・採用判断は別途評価）

正本規則: [変更](../../12_Change.md)

## 1. 人間による判断と目的

Qual-Labの人間の決定権限者は、v0.18.0 Architecture Candidateに基づき、Codex Coordinator AgentとClaude Code Executorを接続する`Coordinator Runtime 1.0`の実装方針を承認した。目標は簡易なProvider呼出しスクリプトまたは使い捨てPoCではなく、復旧、Authority、独立Review、Current Decision Setおよび運用診断を備えるローカルWorkflow Runtimeである。

主目的は、CRDDの文言、物理配置または複数版の互換分岐をRuntime Coreへ埋め込まず、CRDD更新時の変更を明示的なProfile不一致と採用側Migrationへ分離することである。Runtime 1.0は一つの対象Profileだけを扱い、対象外版を推測して実行しない。

この判断は、v0.18.0 Architecture Candidateの規範採用、v0.18.0 Release、Runtimeの有効化、Provider認証、外部送信、push、merge、公開または費用執行の承認ではない。

## 2. 所有境界

| 主体 | 所有する責務 | 所有しない責務 |
|---|---|---|
| Coordinator Runtime | Operation状態、Authority／Capability判定、Repository／Candidate Revision Identity、Provider起動、Result検証、停止・再開、完了条件 | 目的、Risk Acceptance、採用、Release、人間の決定権限 |
| Codex Coordinator Agent | 計画候補、Operation Packet候補、Result統合候補、Current Decision Set候補 | 実効Authority、状態確定、Provider起動、完了確定 |
| Claude Code Executor | 確定Packet内の実装、検証結果候補、未解決事項の返却 | 対象拡張、自己承認、Review、push、merge、公開 |
| 独立Codex Reviewer | 固定対象と基準からのReview再構成 | Executor要約の承認、Human Authority、Promotion |
| Repository Adapter | ローカルGit Identity、dirty検査、隔離workspace、diff、許可パスGuard | commit、push、merge、rebase、tag、Release |
| Execution Environment | Credential、Egress、Filesystem、Processの強制境界 | CRDD判断、成果物の意味、完了判定 |

## 3. Runtime 1.0の範囲

- 対応Repository BackendはローカルGitだけとする。
- 実行モードは`read_only`と`isolated_worktree`だけとする。
- 書き込みOperationは既存dirty変更を自動取込みせず、HEAD Commit／Treeから隔離workspaceを作る。
- 読み取り専用Operationでdirty内容を対象にする場合はWorkspace Snapshot Identityを固定する。
- Executorの未コミット成果はCandidate Revision Identityとして固定し、Verification、ReviewおよびCurrent Decision Setを同Identityへ結び付ける。
- Providerの生Prompt、生応答、完全なstdout／stderr、Credential、Session TokenまたはConversation全文を既定で永続化しない。
- Immutable Event Logを履歴正本とし、ProjectionとSnapshotだけを再生成可能にする。
- Codex Coordinator、Claude Code Executor、独立Codex Reviewerの一構成だけを正式サポートする。

## 4. 1.0へ含めないもの

- `existing_worktree`への直接書込み
- commit、push、merge、rebase、tagまたはRelease操作
- 汎用Migration Engineまたは複数CRDD版の同時互換
- Provider Role交換、動的Routingまたは複数Provider最適化
- Scheduler、MCP Server、自律的なタスク発見
- 外部Effect Adapter、公開、対象者接触または費用執行
- Provider Raw Logの保存
- Git以外のRepository Backend
- `template/tools/coordinator/`への配布

## 5. 初回実装Gate

Protocol、Operation StoreまたはProvider Adapterを作り込む前に、Codex CLIとClaude Code CLIが次の隔離条件で起動、終了および必要時に再開できるかを診断する。

- Operation専用Home、workspace、tmpおよびProvider state／cacheだけへProvider子プロセスが書き込める。
- `events/`、`projection/`および`management/`のRuntime管理情報はCoordinator Runtimeだけが書き込める。
- Credential StoreはCredential Broker／Adapterだけが必要最小限で読み、Provider子プロセスへStoreのPathを見せない。
- Git認証環境、Credential Helper、SSH AgentおよびProvider固有Repository連携をProvider子プロセスへ継承しない。
- 許可Provider endpoint以外へのEgressを拒否できる。強制できない場合はCapability結果へ残し、対象Operationを開始しない。
- 生stdout／stderrを永続化せず、正規化・秘匿化した診断結果だけを返せる。
- CLIの自動更新、Telemetry、timeout、cancel、Session再開および子プロセスの終了挙動を確認できる。

Gate失敗時は後続のStore、Protocolまたは実Provider実行へ進まず、Execution Environmentの阻害結果として返す。CLIの導入、認証または外部接続を自動実行しない。

## 6. Filesystem権限

| 主体 | 書込み | 読取り |
|---|---|---|
| Coordinator Runtime | `events/`、`projection/`、`management/` | Operation全体の許可済み情報 |
| Repository Adapter | 隔離workspaceと作成・破棄に必要なGit metadata | 固定Repository入力、Git metadata |
| Provider子プロセス | `workspace/`、`provider-home/`、`tmp/` | 確定Packetが許可した入力だけ |
| Credential Broker／Adapter | 原則書込みなし | Credential Storeの必要最小限 |

Provider子プロセスはCredential Store、`events/`、`projection/`、`management/`、元RepositoryのGit metadata、通常のUser Home、他Operation、他Repositoryまたは未許可の一時領域へアクセスできないようにする。

## 7. Identityと正規化

Repository IdentityはHEAD Commit／Treeと、必要時のWorkspace Snapshotを分離する。Candidate Revision Identityは少なくとも`base_commit`、`base_tree`、`patch_hash`、`content_manifest_hash`および`allowed_paths_hash`を持つ。

Hash入力はProtocolで、改行、Unicode／文字コード、パス区切り、ファイル順、実行権限、staged／unstaged、untracked、symlink、submoduleおよび除外対象を一意化する。Repositoryの元Path表記とFilesystemのcase sensitivityを保持し、一律に小文字化しない。case-insensitive環境で異なるPathが同じ比較Pathへ衝突する場合は拒否する。

## 8. 変更経路と確認

| 段階 | 主対象 | 完了条件 |
|---|---|---|
| 成立性Gate | `doctor`、Execution Environment、Fake Probe | 専用Home、Credential、Egress、Filesystem、Processの成立／阻害をSecretなしで再現可能 |
| Protocol | Schema、Identity正規化、状態不変条件 | 不正状態、対象ずれ、Hash衝突を決定論的に拒否 |
| Runtime Core | Event Log、Projection、Lease、Idempotency | クラッシュ復旧と二重実行防止を故障注入で確認 |
| Repository Adapter | read-only／isolated、diff、Guard | 許可外変更、dirty混入、metadata改変を成功扱いにしない |
| Provider経路 | 固定Role Adapter、Review、是正 | Result正規化、旧Review不流用、上限到達時の安全停止 |
| 運用確認 | CLI、実Repository E2E、復旧手順 | 人間のコピペなしで許可範囲の一連処理を再現可能 |

独立確認は、実装範囲に応じたAgent／Architecture Review、Security／Authority観点、技術検証および文書監査を行う。CRDD規範または準拠基準を変更しない限り、準拠監査を機械的に追加しない。

## 9. 現在状態

初回実装Gateの安全是正を適用した。現在の`doctor`は受動事前診断であり、Provider、認証、NetworkまたはRepository変更を実行しない。PATH／PATHEXTはFilesystem APIで調べ、絶対Path、生出力またはVersionを保持しない。Node、Git／Repository Identity、Operation領域、Providerごとの発見・認証・active probe・自動更新・Telemetry・Session再開・timeout・cancel・process tree終了、Filesystem、Credential環境、Credential Store隔離およびEgressを個別状態として返す。実観測で全項目が`confirmed`となるまで全体は`blocked`である。

受動事前診断に加え、Windows上のDocker Desktop／Linux containerをRuntime 1.0の唯一のExecution Environment backendとして選定し、固定Digest imageによるFake Provider隔離Probeを追加した。実測ではOperation専用の`workspace/`、`provider-home/`、`tmp/`だけへの書込み、Runtime管理領域の非公開、Credential環境名の非継承、専用Home／tmpおよびNetwork完全遮断が成立した。Codex／Claude Code、認証またはRepository変更は実行していない。

現在の観測では、Provider endpoint限定Egress、Claude Code CLI、両Providerの認証／active probe、自動更新、Telemetry、Session再開、timeout、cancelおよびprocess tree終了が未成立である。Fake Providerの`--network=none`成功はProvider用Egress allowlistの代替ではない。この結果はProvider CLIの利用許可、認証または実Operation許可へ変換しない。Gateの停止条件に従い、Protocol、Operation Storeまたは実Provider Adapterへは進めない。

Architecture事前レビューは`Pass`だが、本実装候補の安全是正は`Applied`であり、独立再確認前に`Resolved`または成立性Gate完成と扱わない。Provider CLIの導入・認証、実Provider実行、Repository変更、Runtime配布およびReleaseは未実施である。

## 10. 初回固定候補の監査履歴

初回固定候補Commit `993e13ab9734f52f0c1feaf88eac83a30c653871`、Tree `5f7ed1a6dce140b5d6b25a67f9545b1367f356d8`に対して、Coordinator局所試験6件、Checker試験143件、全体Checker Error 0／Warning 0を共通入力とし、次の独立確認を行った。

| 確認 | 実績 | 主な指摘 |
|---|---|---|
| Agent／Architecture／Security Review | `Fail` | 隔離前Provider起動、Ready条件の自己申告、Path／生出力、Windows active起動境界 |
| Document Audit | `Fail` | 文書の必須Gate母集団が状態計算へ未接続 |
| Gap／Impact＋Conformance境界監査 | `Fail` | 隔離前Provider起動、所有不明directoryの再帰削除 |

一件でも`Fail`を含むため、この固定候補と監査集合全体は`Invalidated`であり、現在の合否、指摘解消、後続実装またはReleaseの根拠へ流用しない。Providerを起動しない受動診断、全必須項目のfail-closed集約、Runtimeが当該runで作成した一時childだけのcleanup、Path／Raw出力非保持および将来Active Probe受入条件へ是正を適用した。各処置は`Applied`であり、新しい固定版への局所試験、全体Checkerおよび同じ独立確認集合が完了するまで`Resolved`としない。

## 11. 第2固定候補の監査履歴

第2固定候補Commit `4bb37614f703f440fbde7a456f0703914163cb7d`、Tree `5026594985b7ee2eb666bdbc893b51dcd464ff5a`に対して、Coordinator局所試験10件、Checker試験143件、全体Checker Error 0／Warning 0を共通入力とし、同じ独立確認集合を再実行した。

| 確認 | 実績 | 主な結果 |
|---|---|---|
| Agent／Architecture／Security Review | `Pass` | 初回3指摘の解消、Provider非起動とfail-closedを確認 |
| Document Audit | `Pass` | 必須Gate母集団、文書伝播および履歴境界を確認 |
| Gap／Impact＋Conformance境界監査 | `Fail` | 一時childの所有をPath／prefixだけで判定する是正不完全を検出 |

監査集合全体は`Invalidated`であり、個別の`Pass`を現在判定へ流用しない。残った`GCI-COORD-002-R1`に対し、module-privateな所有Capabilityと作成時のFilesystem実体Identityを保持し、削除直前に同一object、`dev`／`ino`／`birthtimeNs`、親境界、実Path、prefix、directory種別および非linkを全数照合する局所是正を適用した。偽owned object、公開Path改変、同名replacement、link置換および二重cleanupは削除せず停止する。処置は`Applied`であり、新固定版の独立再確認前に`Resolved`としない。

このIdentity照合はProviderを起動しない現在の受動事前診断に対する境界であり、敵対的な同時置換への完全防御を意味しない。将来Active Probeでは、Provider process tree終了とtemporary parentへのOSアクセス遮断を成立させたうえでcleanup競合を再評価する。

## 12. Docker Fake Provider隔離Gate

本節より前の受動事前診断と安全cleanupの固定版はCommit `0e63c80e3d07e2d149d42e06e4d936f009af2b88`、Tree `fdbc3548d98847c87c992b8f2b37ba6dc134cb7f`であり、固定後Evidence commitは`276770146a91913188c223345837607675a74192`である。現在記録は[`CHG-000015_Current_Review_Record_0e63c80.md`](Evidence/CHG-000015_Current_Review_Record_0e63c80.md)に保持する。当時のCoordinator試験14件と3独立確認の`Pass`は受動診断とHost一時child cleanupの指摘解消には有効な履歴であるが、その後に追加したDocker backend／Fake Probe差分には適用不能であり、現在の合否、解消、Runtime完成またはRelease根拠へ流用しない。

公式要件と実機状態を確認した結果、Runtime 1.0のProvider実行基盤をWindows上のDocker Desktop／Linux containerへ限定した。通常WSLディストリビューションは導入されておらず、Claude CodeのWindowsネイティブ経路はGit Bashに依存するため、CodexとClaudeへ同じFilesystem、Credential、EgressおよびProcess境界を強制する基盤として採用しない。Host CLIへのfallback、複数backend互換または自動導入は追加しない。

Docker Fake Provider Probeは次を適用する。

- Probe imageを`python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`へ固定し、可変tagまたは自動pullを使用しない。
- root filesystemをread-only、Linux Capabilityを全削除し、`no-new-privileges`、PID上限、非root UIDおよび`--network=none`を適用する。
- `workspace/`、`provider-home/`、`tmp/`だけをbind mountし、Runtime管理領域、通常Home、Credential StoreまたはDocker socketをmountしない。
- Fake Providerの正規化済みJSONだけを64 KiB上限で受け取り、生stdout／stderr、Host PathまたはCredential値をEvidenceへ保存しない。
- Docker commandは固定install rootの`docker.exe`、Docker Incの有効なAuthenticode署名を確認して選択したSHA-256 `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`および実体Identityへ照合し、shellを介さず引数配列で渡す。このRuntime PolicyはQual-Labが所有し、Docker Desktop更新時は自動追随せず再評価する。
- Docker CLIはHostのContext／Credentialを読ませず、Docker DesktopのローカルLinux Engine named pipeへ固定する。Remote Contextまたは別Engineへfallbackしない。
- mount元3領域はfactory発行のprivate CapabilityとFilesystem実体Identityでcreate前、start前および終了後に照合する。
- Probe containerは`docker create`で得たcontainer IDを一次Identityとし、同じIDの名前、label、image、mount、Network、Capability、Security、PID、userおよびentrypoint／commandをinspectしてから起動する。cleanupは同じIDだけを対象にし、ID不存在と同名／同label残留なしを確認する。
- container不存在を確認できない場合はHost mount元を保持し、明示的なFake Probe専用recoveryだけを許可する。recoveryは固定一時親、所有記録、実体Identity、推測困難なtokenおよびcontainer inspectを再確認し、未知containerを削除しない。

局所試験16件は、固定Digestと最小権限引数、管理領域の非mount、全assertion成立時だけの`confirmed`、不正／過大／失敗出力の拒否、および既存passive／cleanup境界を確認した。実Docker Probeも合格し、FilesystemとFake Probe内Credential Path隔離を`confirmed`、Network完全遮断を観測した。Provider endpoint限定Egressは未実装なので全体Gateは`blocked`であり、本処置は`Applied`に留める。新固定版の全体Checkerと独立確認前に`Resolved`または実Provider利用可能と扱わない。

上記初回Docker差分の固定候補Commit `cfe2f3de6cf5c776d6e29c1ed315cec15e6a35cf`、Tree `67bc77b6e779243120b631e08da9bb9944b80c99`へ、Coordinator試験16件、Checker試験143件、全体Checker Error 0／Warning 0および実Docker Probe Passを共通入力として3独立確認を実行した。Agent／Architecture／Security ReviewはDocker CLI trust、mount／container所有およびcleanup復旧を`Fail`、Document Auditは旧Current Recordとの現在性境界を`Fail`、Gap／Impact＋Conformance境界監査はProbe Evidence、構造化fail-closedおよびcontainer所有を`Fail`とした。この監査集合全体は`Invalidated`であり、個別結果と実Probeを現在判定、解消、後続実装またはReleaseへ流用しない。

固定CLI trust、private mount Capability、container IDと全Security属性の照合、構造化された失敗、container不存在確認前のHost領域保持および限定recoveryへ局所是正を適用した。処置は`Applied`であり、修正版の固定、clean treeでの実Probe、固定後Evidence、全体Checkerおよび同じ3独立確認が完了するまで`Resolved`としない。実Probeの固定後Evidenceは、対象Commit／Tree、UTC時刻、engine、承認Docker CLIとimage digestの安全な要約、隔離条件、正規化結果、全体`blocked`理由、cleanup結果および未評価範囲を保持し、生出力、Host絶対PathまたはCredentialを保存しない。

修正版の固定実装はCommit `06f1314c32b10b119fb6bddc742204cc7f70021b`、Tree `35a82ee2856e9851087c80ef7215d071fc77dc9d`である。clean treeでの実測結果は[`CHG-000015_Docker_Isolation_Probe_06f1314.md`](Evidence/CHG-000015_Docker_Isolation_Probe_06f1314.md)へ固定した。この実測と処置は`Self-checked`／`Applied`であり、同じ監査集合の独立再確認前に`Resolved`へ上げない。Evidence追加後の監査対象Identityと実装固定Identityを分離し、両者間で実行コード、Docker CLI Policy、image digestおよび隔離条件が変わっていないことを再確認する。

Evidence追加後の固定候補Commit `24466498e34a027c426fd5318c89741c5356c32e`、Tree `737c6058c80f9248a89110ce9407f99e797784b0`へ、Coordinator試験21件、Checker試験143件、全体Checker Error 0／Warning 0および実Docker Probe Passを共通入力として再監査した。Agent／Architecture／Security Reviewはcleanup例外時のHost領域保持を`Fail`、Document Auditはcontainer不存在を名前とlabelのAND検索で確認していた点を`Fail`、Gap／Impact＋Conformance境界監査はcleanup例外の構造化不足を`Fail`とした。個別結果はいずれも履歴として保持するが、この監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。

同根原因に対し、container削除後の完全ID・完全名・完全ownership labelを別々に照会する不存在Oracle、Docker cleanup例外の構造化`blocked`化、Operation root外のHost recovery marker、Docker送信後のHost-only回収拒否、部分Host cleanupからの再開およびroot不存在後のmarker消費を適用した。Docker cleanup、3軸不存在、Host root、外部markerの順序を満たさない場合は領域を保持して停止する。処置は`Applied`であり、新固定版の局所試験、clean tree実Probe、固定Evidence、全体Checkerおよび同じ3独立確認が完了するまで`Resolved`としない。

局所是正の固定実装はCommit `ef46cac379ac466b55fd144605cf3eb4dfbd45a9`、Tree `588d1dede634034123263b0da1a4537e95ed44e5`である。clean treeの実Docker Probe、3軸不存在、Probe container／Host Operation root／外部markerの残存0、および全体`blocked`は[`CHG-000015_Docker_Cleanup_Recovery_ef46cac.md`](Evidence/CHG-000015_Docker_Cleanup_Recovery_ef46cac.md)へ固定した。この実測と24件の局所試験は`Self-checked`であり、固定後Evidenceを含む新しい監査対象Identityへの独立確認前にFindingを`Resolved`としない。

Evidence固定候補Commit `f956648046d5a71978b2e4364fde64a776a82a48`、Tree `e50a2cc52abefbcc7523a3c7e646b488fa3a5312`へ同じ3独立確認を実行した。Agent／Architecture／Security ReviewはHost cleanupの所有母集団から`events`／`projection`が漏れていた点を`Fail`、Document Auditは同じ6 child母集団と未知entry拒否の不足を`Fail`、Gap／Impact＋Conformance境界監査は公開状態変更APIにより3軸不存在Oracleを迂回できる点を`Fail`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。

全6 childの一意な所有母集団、root直下未知entry拒否、既知child部分不在だけを許す共通検証器、および3軸Oracleへ結び付いたmodule-private／one-shotの不存在Capabilityを適用する。Docker不存在を自己申告するnamed exportは廃止し、通常実行と明示recoveryを同じCapability条件へ揃える。本処置は`Applied`であり、新固定版の局所試験、clean tree実Probe、固定Evidence、全体Checkerおよび3独立確認が完了するまで`Resolved`としない。

局所是正の固定実装はCommit `5f9aff0caf72b03f36f85249ba964c4895dda85f`、Tree `cf74699059dca92c90dbf598d7ce7b7f2c6f41ac`である。28件の局所試験とclean treeの実Docker Probeにより、全6 childの所有母集団、未知entry 0、container ID／name／ownership labelの独立残留0、Host Operation root 0および外部recovery marker 0を確認した。安全な正規化結果は[`CHG-000015_Docker_Absence_Capability_5f9aff0.md`](Evidence/CHG-000015_Docker_Absence_Capability_5f9aff0.md)へ固定する。この実測と処置は`Self-checked`／`Applied`であり、Evidenceを含む新固定版への同じ3独立確認が完了するまで`Resolved`、Runtime完成または実Provider利用可能と扱わない。

Evidence固定候補Commit `c72c6ef8461a9053c41b78ecb7c32748cbbd6697`、Tree `7d7d7fcb9e8006f92c884b6bded597d7f20aeb19`へ、Coordinator試験28件、Checker試験143件、全体Checker Error 0／Warning 0、clean tree実Docker Probeおよび残留container／Operation root／marker各0を共通入力として同じ3独立確認を実行した。Agent／Architecture／Security ReviewはHost markerの現在Hashを再信頼する経路を`Fail`、Document Auditは不存在確定後のHost cleanup失敗で古いDocker recovery IDを返す経路を`Fail`、Gap／Impact＋Conformance境界監査は明示Docker recoveryが既知childの部分欠落を許容しない経路を`Fail`とした。個別結果は履歴として保持するが、この監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。

同じ回復状態機械に対し、受動診断はfactoryがprivateに固定した初期Host記録Hashだけを信頼し、markerを再Hashして新tokenを生成しないよう是正する。Docker送信後は3軸不存在確認前のDocker tokenと、one-shot Capabilityによるmarker更新後のHost tokenを分離し、Host cleanup失敗時も更新後Host tokenを返す。明示Docker recoveryはroot直下が既知6 childの部分集合であることと存在childのIdentityを確認し、container不存在なら既知childの部分欠落をHost recoveryへ引き継ぎ、container残存時だけmount 3件と`management/`を必須化する。Host回復Schema、Hash検証および原子的状態遷移は共通実装へ一意化する。処置は`Applied`であり、新固定版の局所試験、clean tree実Probe、固定Evidence、全体Checkerおよび3独立確認が完了するまで`Resolved`としない。

回復Lifecycle是正の固定実装はCommit `efce510d44668bce763951b6491702c767ac4e6e`、Tree `899d518d66bc615a856c315f68c9ab9014eaadd3`である。31件の局所試験、Checker試験143件、Evidence追加前の全体Checker Error 0／Warning 0、およびclean treeの実Docker Probeにより、Fake Provider隔離、3軸不存在、Host cleanup、回復要求なし、container／Operation root／marker残留各0を確認した。安全な正規化結果は[`CHG-000015_Recovery_Lifecycle_efce510.md`](Evidence/CHG-000015_Recovery_Lifecycle_efce510.md)へ固定する。この実測と処置は`Self-checked`／`Applied`であり、Evidenceを含む新固定版への3独立確認が完了するまでFindingを`Resolved`とせず、Runtime完成または実Provider利用可能と扱わない。

Evidence固定候補Commit `15a674eed0caa079090852693d83deecdf0732b6`、Tree `142a04b135fcca4944c4cdee54d85d9579c01f41`へ、Coordinator試験31件、Checker試験143件、全体Checker Error 0／Warning 0、clean tree実Docker Probeおよび残留container／Operation root／marker各0を共通入力として同じ3独立確認を実行した。Agent／Architecture／Security ReviewはDocker回復記録作成と送信前取消がともに失敗した場合に有効な回復IDを返せない経路を`Fail`、Document AuditとGap／Impact＋Conformance境界監査は共通moduleの汎用状態遷移exportが3軸不存在Capabilityを迂回できる点を`Fail`とした。個別結果は履歴として保持するが、この監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。これらは今回の構造是正によって新たに発生した指摘である。

Host回復の共通moduleをtoken、Schema、Hashおよび読取り検証の一意な所有元に限定し、汎用状態遷移exportを廃止する。Docker隔離module内では開始、送信前取消および3軸不存在Capability確認後の不存在確定だけを固定操作として原子的に実行する。Docker回復記録作成と送信前取消がともに失敗した場合は、実行不能な内部Host tokenを`recoveryId`として返さず、`docker_submission_rollback_failed`、`manualRecoveryRequired: true`、`recoveryId: null`およびOperation領域保持を返す。この分岐は自動回復成功を意味しない。OwnerはQual-Labとし、createが送信されていないことを安全に立証できる専用回復経路を実装するか、人間の決定権限者が固定事実に基づいて理由付き安全終了するまで未解決として追跡する。再評価契機までは後続Gate、Protocol、Store、Provider Adapterおよび実Operationを開始しない。本処置は`Applied`であり、新固定版の局所試験、clean tree実Probe、固定Evidence、全体Checkerおよび3独立確認が完了するまで`Resolved`としない。

局所是正の固定実装はCommit `81492676faca3e0dea94781c011c150922068555`、Tree `f12a69826800da2cddde10ea594e8432430f57fa`である。Coordinator試験32件、Checker試験143件、全体Checker Error 0／Warning 0、clean worktree、残留Operation root 0およびHost recovery marker 0を確認した。安全な正規化結果と実Docker Probeの環境阻害は[`CHG-000015_Recovery_Authority_8149267.md`](Evidence/CHG-000015_Recovery_Authority_8149267.md)へ固定する。現在環境ではDocker DesktopローカルLinux Engineを確認できないため、実Fake Provider隔離とDocker側残留は未評価であり、旧Probe Passを流用しない。この処置は`Self-checked`／`Applied`であり、Evidenceを含む新固定版への3独立確認が完了するまでFindingを`Resolved`とせず、二重失敗の専用回復、Runtime完成または実Provider利用可能と扱わない。

Evidence固定候補Commit `2d5501d4526c0d7fd13702c8a6eb706f396fdfd0`、Tree `ddf155e17c1339798541c111629f008c13b0834c`へ、Coordinator試験32件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として同じ3独立確認を実行した。Agent／Architecture／Security Reviewは`Pass`、Document AuditはREADMEの全例外が回復IDを返すように読める表現をMinor `DOC-COORD-007`として`Conditional`、Gap／Impact＋Conformance境界監査は`Pass`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。DOC-COORD-007は今回の修正によって発生した指摘である。

READMEの例外処理説明を、安全な`blocked`へ常に正規化し、安全に再開できる場合だけ回復IDを返す契約へ限定する。`recoveryId: null`と`manualRecoveryRequired: true`になる二重失敗の説明、コード、Threat Model、Evidence、token段階および未解決追跡は変更しない。本処置は`Applied`であり、新固定版の全体Checkerおよび3独立確認が完了するまで`Resolved`としない。

最終固定候補Commit `4905e905661b4e9541ee4e9f5813ab2987d2250f`、Tree `4a02dc29cc686e1c5a15adc9262b242274980e31`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_4905e90.md`](Evidence/CHG-000015_Current_Review_Record_4905e90.md)へ記録する。回復Authority境界とDOC-COORD-007はこの固定範囲で独立確認済みである。一方、rollback二重失敗の専用自動回復、実Docker Fake Provider隔離、Provider Egress／認証／lifecycle、Protocol、Store、Adapterおよび実Operationは未解決または未評価であり、全体Gateは`blocked`を維持する。Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開へ状態を上げない。

### Provider隔離Profile契約の実装候補

実書込みOperationに必要な実隔離を進めるため、Provider隔離Profileの検証契約を追加する。ProfileはCRDD版ごとに複製せず、Runtime契約名と`contractRevision: 1`で識別する。破壊的なRuntime契約変更が実際に発生した場合だけ明示Migrationを設計し、未知の将来互換性や複数Readerを先行実装しない。

Profileが保持するのは、対応Provider、許可済みAuthority Registryを選ぶGrant参照候補、Credential BrokerのGrant参照候補、および要求HTTPS Origin集合である。Credential値、Secret相当field、用途外namespace、wildcard、HTTP、任意Path付きURLまたは未対応Providerはfail closedにする。構造検証結果はAuthority確認待ちの`candidate`であり、正規化結果を安定したSHA-256へ固定するが、このHashは候補同一性だけを示し、Authority、Credential隔離、Egress強制、Provider利用可能性またはOperation許可を成立させない。

Runtime 1.0の正式な書込みBackendはDockerだけとし、`fake`を試験専用、Host／Git Bash／通常WSL／`local-restricted`を非fallbackとする。後続の実装対象は、信頼済み正本を確認するAuthority Grant Verifier、Operation専用内部NetworkとProvider endpoint Proxy、短期Credentialを扱うBroker、および各実測Capabilityを同じProfile Hash、OperationおよびScopeへ結び付けるGateである。VerifierはGrantの存在、決定権限者、有効期間、取消・置換、Provider、要求Origin、Credential参照およびScopeを確認し、Provider起動直前にも再確認する。現在はVerifier、ProxyとBrokerが未実装であり、実Providerを起動せず、全体Gate、Protocol、Store、Adapterおよび実Operationを`blocked`のまま維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と独立確認前に`Resolved`、Runtime完成、採用、準拠、移行またはReleaseと扱わない。

固定候補Commit `0bbad9e4388d461e8d8d57cc9439f170d405c963`、Tree `43ff80005e01cba939a04b36423b2b265cf42545`へ、Coordinator試験38件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security Reviewは生Credentialを参照値として保持できる点と未来の未発効Authorityを受理する点を`Fail`、Document Auditは未来Authorityの受理を`Fail`、Gap／Impact＋Conformance境界監査はProfile本文だけで人間承認を自己申告できる点を`Fail`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。いずれも今回のProfile契約追加で新たに検出された指摘である。

自己申告の`approvedBy`、`approvedAt`および`expiresAt`をProfileから除き、Authorityを用途限定のRegistry／Grant参照候補へ変更する。Credential参照もBroker／Grantの用途別namespaceへ限定し、Provider token形または相互namespace流用を拒否する。構造検証成功は`accepted`ではなく`candidate`／`authority_verification_required`とし、`authority_grant_verification`を必須Capabilityへ追加する。要求Origins、Profile HashおよびRegistry参照をAuthority証明として扱わず、将来Verifierの正本確認前は全体を`blocked`に保つ。本処置は`Applied`であり、新固定版の局所試験、全体Checkerおよび3独立確認が完了するまで各Findingを`Resolved`としない。

Profile契約是正の固定実装はCommit `8555422174537781c2a224d6ceacbb75dd368f83`、Tree `ff267b4a5001016d1182d6e282c0e2bf45626e1d`である。Coordinator試験41件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力とした3独立確認は、すべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_8555422.md`](Evidence/CHG-000015_Current_Review_Record_8555422.md)へ記録する。0bbad9eで検出したProfile Authority／Credential境界の指摘はこの固定範囲で独立確認済みである。一方、Authority Registry／Verifier、Credential Broker、Provider endpoint Proxy、Egress強制、実Provider、実OperationおよびRuntime完成は未実装または未評価であり、全体Gateは`blocked`を維持する。採用、準拠、移行、Stable、Releaseまたは公開へ状態を上げない。

### Provider Egress Proxy Policy候補

次の実装段階として、構造検証済みProfile候補からProvider Egress ProxyのPolicy候補を作る決定論的Coreを追加する。Policyは`candidate`／`authority_verification_required`のまま、`CONNECT`、完全一致hostnameおよびport 443だけを候補とする。別method／port／hostname、IP literal、userinfo、末尾dot、不正Authorityを拒否し、DNS結果にprivate、loopback、link-local、documentation、multicastその他の非public addressが一件でもあれば拒否する。

Topology候補はProviderをOperation専用internal Docker Networkだけへ置き、Proxyだけをinternal Networkと専用Egress Networkへ接続する。Docker socket、Host Network、Providerの直接外部接続、別OperationおよびHost fallbackを許可しない。現在環境の`doctor --isolation`は`local_docker_desktop_linux_engine_required`で停止しており、Proxy process、Docker Network lifecycle、Authority Capability結合、DNS／TLS実測および実Egressは未実装である。Policy／Topology候補またはfixture試験を実通信許可へ流用せず、`execution.egress`、全体Gate、Provider、Protocol、Store、Adapterおよび実Operationを`blocked`に保つ。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と独立確認前に`Resolved`、Runtime完成、採用、準拠、移行またはReleaseと扱わない。

固定候補Commit `e35411ca0d0830546e684acd80b1c10d4043525f`、Tree `e9e0c94bbac732c38506ed71eedb69b77fa4a289`へ、Coordinator試験46件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security Reviewは、自己構築したProfile検証結果をPolicy候補へ昇格できる点とspecial-purpose address判定の不足をMajor、CONNECT portの非canonical表記をMinorとして`Fail`とした。Document AuditはProfile Identity未結合をMajor、IPv6 special-purpose判定不足をMinorとして`Fail`とした。Gap／Impact＋Conformance境界監査は同じProfile Identity未結合をMajor、special-purpose address判定不足をMinorとして`Fail`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。いずれもEgress Policy候補追加で新たに検出した指摘である。

Policy compilerの入力を生Profileへ限定し、内部Validatorが生成した正規ProfileとHashだけをPolicy候補へ結び付ける。caller supplied validation result、HashまたはProfile objectはshape違反として拒否し、不正Originを含む例外も固定理由の`blocked`へ閉じる。CONNECT authorityは正規hostnameと文字列`443`の完全一致へ限定する。DNS addressはIANA IPv4／IPv6 Special-Purpose Address Registryの固定snapshotに基づき32／128 bitへ正規化し、最長prefix一致と`Globally Reachable`を評価する。IPv4-mapped IPv6はIPv4へ還元し、compatible／site-local／multicast、Registryの空欄／`N/A`、parse不整合またはspecial address混在を拒否する。Registry名、更新日、確認日、採用列、更新契機およびsnapshot SHA-256を取得可能にし、自動更新で信頼境界を変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の局所試験、全体Checkerおよび3独立確認が完了するまで`AG-EGRESS-001`、`AG-EGRESS-002`、`AG-EGRESS-003`、`DOC-COORD-009`、`DOC-COORD-010`ならびに同根Gap Findingを`Resolved`としない。Policy候補をAuthority、Egress強制、実Providerまたは実Operationへ昇格せず、全体Gateは`blocked`を維持する。

是正候補Commit `07f996189f8e0b54339c5307864dd7c06933d000`、Tree `8a73d335686ed0546623954b4a7fa9c25fb44fe0`へ、Coordinator試験48件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security Reviewは、Special-purpose非一致IPv6を既定許可し、旧`3ffe::/16`等の予約範囲とNAT64埋込みIPv4を十分に判定できない点をMajorとして`Fail`とした。Document Auditは既存指摘の解消と文書伝播を`Pass`とした。Gap／Impact＋Conformance境界監査は、Special-purpose属性、現在の割当状態および埋込みaddressの実体を分離できていない同根原因を`GCI-COORD-011` Majorとして`Fail`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。Agent Findingは既存`AG-EGRESS-002`の是正不完全、Gap Findingは今回の修正による新規候補である。

IPv6判定へIANA IPv6 Global Unicast Address Spaceの`ALLOCATED` prefix snapshotとIPv6 Address Spaceの予約境界を追加する。Special-purpose最長一致を先行させ、`false`／空欄／`N/A`をAllocationで再許可しない。special-purposeに一致しないIPv6は明示的な`ALLOCATED` prefixだけを候補とし、未割当、`RESERVED`または判定不能を拒否する。IPv4-mapped IPv6と`64:ff9b::/96`は埋込みIPv4をIPv4 special-purpose規則へ還元し、compatible IPv6は拒否する。MetadataはIPv4 special-purpose非一致、IPv6 allocation非一致、matched unknownの既定値を分離し、全metadataと全prefix entryを覆う正規化snapshot Hashとentry件数を取得可能にする。本処置は`Applied`／`Self-checked`であり、新固定版の局所試験、全体Checkerおよび3独立確認が完了するまで`AG-EGRESS-002`と`GCI-COORD-011`を`Resolved`としない。Policy／Topologyは候補のまま、Authority Verifier、Proxy、Network、DNS／TLSおよび実Egressは未実装であり、全体Gateは`blocked`を維持する。
