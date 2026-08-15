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

最終固定候補Commit `c21b99a0024e136173e66f2b1e1a46971e34b999`、Tree `ad3a2791760f16288e51b314b0f8a371dd2ebe70`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_c21b99a.md`](Evidence/CHG-000015_Current_Review_Record_c21b99a.md)へ記録する。`AG-EGRESS-001`／`002`／`003`、`DOC-COORD-009`／`010`、`GCI-COORD-009`／`010`／`011`は、Profile／Policy候補Coreとaddress分類の固定範囲で独立確認済みである。一方、Authority Verifier、Credential Broker、実Proxy、Docker Network、DNS／TLS強制、実Provider、実OperationおよびRuntime完成は未実装または未評価であり、全体Gateは`blocked`を維持する。採用、準拠、移行、Stable、Releaseまたは公開へ状態を上げない。

### Authority Grant Verifier Core候補

Egress Policy候補が要求するAuthority結合の次段として、Authority Registry候補とGrantの決定論的照合Coreを追加する。RegistryはCRDD版別JSONへ分けず、Runtime契約名と`contractRevision: 1`、Registry ID／revision、UTC観測時刻、Grant集合および固定Hashで識別する。Grantはactive状態、有効期間、Provider、要求Origin、Credential Grant参照、Operation ID、Scope IDおよびProfile Hashを保持し、Profile候補と完全一致する場合だけ照合候補を返す。未来の観測時刻、未発効・失効・取消・置換、重複Grant参照、非UTC時刻、余分fieldまたは結合差はfail closedにする。

このCoreが返すのは`candidate`であり、Registry入力やそのHashを人間承認、信頼済み正本またはAuthority Capabilityへ昇格させない。Runtime所有のTrust Anchor Loader、信頼設定の所有権と更新経路、Provider起動直前の期限・取消・置換再確認は未実装である。`doctor`はCore候補の存在とRuntime Capability未発行を表示し、Proxy、Credential Brokerおよび実Providerとともに全体Gateを`blocked`に保つ。本処置は`Applied`かつ`Self-checked`であり、新固定版の機械確認と独立レビュー／監査が完了するまで、Verifier実装完了、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定候補Commit `5e4cf5c13787cb7324730388a086cdd4d7540fc5`、Tree `e938a34a0b69af219ffed169b91568c1c07bb48a`へ、Coordinator試験57件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security Reviewは、未信頼Registry候補の処理量境界がない点を`AG-AUTH-REG-001` Minor、評価時刻が暗黙型変換を受理する点を`AG-AUTH-REG-002` Minorとして`Fail`とした。Document AuditとGap／Impact＋Conformance境界監査は`Pass`であった。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在の合否、解消、後続実装またはRelease根拠へ流用しない。2件はいずれもVerifier Core追加によって確認対象になった新しい対象範囲である。

ProfileとRegistryで共通する上限は一つの実装契約へ集約し、識別子64文字、Origin 16件、各Origin 256文字とする。Registry固有上限はGrant 64件、正規化後canonical UTF-8 131072 byteとする。raw件数と文字列長をURL解析、正規化、並べ替えおよびHashより前に検査し、canonical byte数をHash直前に検査する。評価時刻は有効な`Date`または`YYYY-MM-DDTHH:mm:ss.sssZ`と完全一致するUTC文字列だけを受理する。境界値、1超過、巨大値、循環入力、ProfileからPolicyへの利用側、非正規時刻を局所試験へ追加し、例外ではなく固定理由の`blocked`へ閉じる。将来Trust Anchor LoaderにはParse前の読込みbyte上限とRuntime所有時計による起動直前再確認を要求する。本処置は`Applied`／`Self-checked`であり、新固定版の独立再確認前に2件を`Resolved`としない。`candidate`、Capability未発行、Trust Anchor Loader／起動直前再確認未実装、全体Gate `blocked`、非規範／Release非先取りを維持する。

是正版Commit `fdd179080203b3f8dc71a6aa01911bfe3b3beac7`、Tree `b3fabdde4836c57387dde1948d88be5bbb713811`へ、Coordinator試験62件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security Reviewは、accessorが検査後に別値を返して未検査値を正規Profile／Registry／Hashへ混入できる点を`AG-AUTH-REG-003` Majorとして`Fail`とした。Document AuditとGap／Impact＋Conformance境界監査は`Pass`であった。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり現在判定へ不流用とする。本件は初回固定版から存在した見落としである。

ProfileとAuthority Verifierへ共通plain-data snapshot境界を追加する。Proxyを反射処理前に拒否し、recordは期待する列挙可能own data descriptor、arrayは上限確認済みlengthと連続したown data indexだけから一度snapshotする。accessor、symbol、custom prototype、hole、余分または非canonical indexを拒否し、nested値を含む固定snapshot以外を正規化、比較、Hashへ使わない。top／nested／array getter、Proxy trap、hole、symbol、custom prototype、元入力の事後変更、通常／null-prototype／freeze済み入力およびProfile→Policy／Authority経路を局所試験へ追加する。本処置は`Applied`／`Self-checked`であり、新固定版の3独立確認前に`AG-AUTH-REG-003`を`Resolved`としない。既存budget、canonical UTC、`candidate`、Capability未発行、Gate `blocked`およびRelease非先取りを維持する。

是正版Commit `c81330d04be3f4bef137068b845a74c12291778b`、Tree `d8526b00119c6ac1d55d87b95c3749f80fa531a4`へ、Coordinator試験69件、Checker試験143件、全体Checker Error 0／Warning 0およびclean worktreeを共通入力として3独立確認を実行した。Agent／Architecture／Security ReviewとDocument Auditは`Pass`、Gap／Impact＋Conformance境界監査は、READMEが評価Context全体をJSON相当plain dataへ限定する一方で`context.now`に有効な`Date`を受理する契約との不一致を`GCI-AUTH-REG-012` Minorとして`Fail`とした。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり現在判定へ不流用とする。本件は今回のsnapshot説明修正によって発生した指摘である。

READMEの説明を、Profile、Registryおよび評価Contextのrecord／array構造に適用するplain-data境界と、`context.now`だけに許可する型付き値の例外へ分離する。`now`はContext recordから一度取得した有効な`Date`またはcanonical UTC文字列だけを受理し、canonical UTC文字列へ変換して評価する。本処置は`Applied`／`Self-checked`であり、新固定版の3独立確認前に`GCI-AUTH-REG-012`を`Resolved`としない。コード、Threat Model、試験、snapshot helper、`candidate`、Capability未発行、Gate `blocked`およびRelease非先取りは変更しない。

最終固定版Commit `61c9404d816778ac484c82825540248e00d163c7`、Tree `de204588db69a3c1a7e845c1a17fbcb38f3ed083`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_61c9404.md`](Evidence/CHG-000015_Current_Review_Record_61c9404.md)へ記録する。`AG-AUTH-REG-001`、`AG-AUTH-REG-002`、`AG-AUTH-REG-003`および`GCI-AUTH-REG-012`はAuthority Grant Verifier Core候補と直接利用側の固定範囲で独立確認済みである。一方、Trust Anchor Loader、起動直前再確認、Authority Capability、Proxy、Broker、実Providerおよび実Operationは未実装または未評価であり、全体Gateは`blocked`を維持する。本結果をRuntime完成、利用許可、採用、準拠、移行、Stable、Releaseまたは公開へ流用しない。

### Trust Anchor Loader Core候補

Authority Registryの信頼入口を次段へ進めるため、上限付きcanonical byte loaderとTrust Policy候補照合を追加する。Registry byte列は131072 byte以下に制限してからstrict UTF-8、BOMなし、canonical JSON完全一致、Registry契約および正規化後Hashを確認する。Trust Policy候補はRuntime契約名と`contractRevision: 1`、Policy ID／revision／状態、Registry ID／revision／Hashだけを持ち、用途外field、accessor、Proxy、非active状態またはIdentity差をfail closedにする。CRDD版別JSON、未知Readerまたは互換Migrationを追加しない。

本Coreへcallerが渡したPolicyは、Runtime所有Policyの導入、所有権、取消、有効化またはAuthorityを成立させない。結果は`candidate`、Capability未発行とし、実ファイル／Transport Adapter、Policyの配布・取消、Runtime所有時計による起動直前再確認、Proxy、Brokerおよび実Providerが未実装の間は全体Gateを`blocked`に保つ。doctorはcanonical byte loader Core候補とRuntime Trust Policy未有効化を別々に表示する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にTrust Anchor Loader完成、Authority成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定版Commit `5d1d3373f21041aad0a5eddf0c31af69b396770e`、Tree `69a5d95ff18fd730a5fdb33242144d359cdba578`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_5d1d337.md`](Evidence/CHG-000015_Current_Review_Record_5d1d337.md)へ記録する。Parse前budget、Runtime所有copy、canonical Registry byte境界、Trust Policy候補照合およびcaller Policy非Authority境界はTrust Anchor Loader Core候補と直接利用側の固定範囲で独立確認済みである。一方、Runtime所有Trust Policyの永続正本、取得／所有／配布／取消／有効化、file／IPC／Transport Adapter、起動直前再確認およびAuthority Capabilityは未実装で、全体Gateは`blocked`を維持する。本結果をRuntime完成、利用許可、採用、準拠、移行、Stable、Releaseまたは公開へ流用しない。

### 起動直前Authority再確認Core候補

Trust Policyの具体的な正本・配布方式を自己決定せずに進められる次段として、Runtimeプロセス時計を用いる起動直前再確認Core候補を追加する。呼出側ContextはOperation IDとScope IDだけを持ち、時刻field、accessor、Proxyまたは余分fieldを受理しない。Coreは同一呼出し内でcanonical Registry byte、Trust Policy候補、Profile、Grant、Operation、Scope、有効期間およびIdentityを再検証し、Trust Policy ID／revision／Hash、Registry Identity、Grant revision、Profile Hash、確認時刻および有効期限を固定した候補を返す。失効、未発効、取消・置換、Trust Policy不一致またはRegistry Identity差は`blocked`へ閉じる。

この候補はAuthority Capabilityではなく、Provider起動へ再利用可能な許可でもない。Runtime所有Trust Policyの永続正本、取得／所有／配布／取消／有効化、file／IPC／Transport Adapter、Provider起動直前の同一制御経路への結合、ProxyおよびCredential Brokerは未実装のままとする。`doctor`は再確認Core候補とProvider起動結合未実装を分けて表示し、全体Gateを`blocked`に保つ。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前に起動直前再確認完成、Authority成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定版Commit `15fdcb2b84db68fb991f32e4da9ba76f0f5732f7`、Tree `05eb6eec43dca984ecec0e6bec5b57e631ec61eb`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_15fdcb2.md`](Evidence/CHG-000015_Current_Review_Record_15fdcb2.md)へ記録する。Runtime時計、同一呼出し再検証、候補Identity結合、失効／取消／置換のfail closedおよびCapability非発行境界は、このCore候補と直接利用側の固定範囲で独立確認済みである。

次段階では、Runtime所有Trust Policy／Authority Registryの正本取得方式と導入・更新・取消AuthorityをQual-Labが決定する。推奨はRuntime管理領域内の固定ローカルfile bundleを1.0の唯一の正式取得方式とし、IPC／Network Transportを1.0後へ送ることである。判断前にAuthority Capability、Provider起動結合、Proxy、Brokerまたは実Operationを開始しない。全体Gateは`blocked`を維持し、本結果をRuntime完成、利用許可、採用、準拠、移行、Stable、Releaseまたは公開へ流用しない。

### Runtime所有Authority File Bundle Core候補

Qual-Labは、Runtime 1.0の正式なAuthority取得方式をRuntime管理領域内の固定ローカルFile Bundleに限定し、IPC／Network Transportを1.0後へ送る方針を決定した。この判断は実装範囲を固定するものであり、Authority Capability、Provider起動、採用、準拠またはReleaseの承認ではない。

Bundleは`bundle.json`、`trust-policy.json`、`authority-registry.json`の固定3ファイルで構成する。Manifestは`crdd-coordinator/authority-file-bundle`、`contractRevision: 1`、Bundle ID／revision／状態、前版Bundle Hash、Trust Policy HashおよびRegistry Hashだけを持つ。Manifestは4096 byte、Trust Policyは4096 byte、Registryは131072 byteを上限とし、strict UTF-8、BOMなし、末尾空白を含まないcanonical JSON完全一致を要求する。初版は前版Hashを`null`、後続版は64桁Hashとし、activeなManifestとPolicyおよび3ファイル間のHash一致だけを候補へ固定する。accessor、Proxy、余分field、非canonical byte、inactive状態またはHash差は固定理由の`blocked`へ閉じる。

本CoreはPathを読み取らず、Runtime管理root、所有主体／ACL、link／reparse禁止、実体Identity、同一snapshot、原子的置換または単調な有効化・取消を成立させない。これらを実装するRuntime所有Path AdapterとProvider起動直前の再読取りが未実装である間、結果は`candidate`、Capability未発行、全体Gate `blocked`とする。`doctor`はFile Bundle Core候補とPath／ACL／activation未実装を分けて表示する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にAuthority取得完成、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定版Commit `a639d87aa334bf11d5ec8d603850a2b64d3b5549`、Tree `aeb794060cb435f7a8f5611521b0608025c23511`への3独立確認はすべて`Pass`、Finding 0で完了した。固定結果は[`CHG-000015_Current_Review_Record_a639d87.md`](Evidence/CHG-000015_Current_Review_Record_a639d87.md)へ記録する。固定3ファイル、byte／canonical／Hash／状態境界、PrelaunchへのBundle Identity結合、Capability非発行およびGate `blocked`はCore候補と直接利用側の固定範囲で独立確認済みである。

次段階では、Windows正式配置のmachine-wide root、導入／更新主体、Runtime読取り主体およびACLモデルをQual-Labが決定する。推奨は`%ProgramData%\Qual-Lab\CRDD\Coordinator\authority\active`を固定root、`NT SERVICE\CRDDCoordinator`をread-only Runtime主体とし、`SYSTEM`／`Administrators`だけへ書込みを許可する方式である。判断前にPath Adapter、Authority Capability、Provider起動結合、Proxy、Brokerまたは実Operationを開始しない。全体Gateは`blocked`を維持し、本結果をRuntime完成、利用許可、採用、準拠、移行、Stable、Releaseまたは公開へ流用しない。

### Runtime Root選択・明示activation Core候補

Qual-Labは、Windows固有のmachine-wide rootをRuntime 1.0のArchitectureへ固定しない方針を決定した。直前の`%ProgramData%`／Windows service案は検討履歴として保持するが、現在案へ不流用とする。既定Root候補は`<repository>/.crdd-runtime/`とし、特定の場所へ移す場合の指定契約を`--runtime-root`または`CRDD_COORDINATOR_ROOT`による絶対Pathとする。優先順はCLI、環境、Repository既定とし、OS別の暗黙保存先を設けない。serverでは同じ契約へ永続Volumeを指定できる。現在のCLI optionおよび環境読取りは未接続である。この判断は保存場所の選択方式を固定するもので、機能の有効化、Authority Capability、Provider起動、採用またはReleaseの承認ではない。

機能は既定で無効とする。Directoryの存在、override、ignored状態またはRepository内設定だけでは有効化せず、明示的なenable要求とRuntime所有activation記録を要求する。`disable`は新規Operation停止とし、データ削除は別の明示操作へ分離する。`.crdd-runtime/**`はGitの追跡状態に関係なくCandidate Revision、Operation入力およびProvider mountへ含めない。ignoreは誤commit防止の補助であり、安全性の主根拠にしない。

Root選択Core候補はabsolute Pathの構文、CLI／環境／既定の優先順および明示enable intentだけを検査し、絶対PathをdoctorやEvidenceへ保持しない。accessor、Proxy、相対Path、NUL、過大Pathまたは未知activationを固定理由の`blocked`へ閉じる。CoreはFilesystemへ触れず、Root作成、tracked／exclude状態、realpath／link、Provider非到達、所有主体／権限、同時所有、activation記録またはCapabilityを成立させない。`doctor`は既定無効、明示enable必須およびPath Adapter／activation記録未実装を表示し、全体Gateを`blocked`に保つ。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にRuntime Root実装完了、機能有効、Authority成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定`17603adcbfc06eaccbde0cdbce05acf8d8f13750`／Tree`b453b759ed04692693e221bd69ac041533ac0797`に対するAgent／Architecture／Security Reviewは`Pass`、Gap／Impact＋Conformance Auditは`Pass`、Document Auditは`Fail`であった。Document Auditは`DOC-ROOT-001`として、CLI／環境接続未実装、Operation入力除外、無効化と削除の分離および双方の未実装がCore説明契約と`doctor`試験へ完全に伝播していないことを検出した。この監査集合全体は`Invalidated`であり、各Passを現在判定へ流用しない。Findingは今回変更で新たに発生した伝播漏れとして記録する。

局所処置として、説明契約へCLI／環境接続未実装、Operation入力除外、無効化の意味と未実装、無効化による非削除、明示データ削除未実装を追加し、Core試験と`doctor`試験で全項目を固定した。Threat ModelもOperation入力除外および無効化／削除分離を、Path／Operation統合、無効化、削除が未実装である境界とともに保持する。本処置は`Applied`／`Self-checked`であり、新しいCommit／Treeに対する機械確認と3独立再確認前に`Resolved`としない。

最終固定Commit `fdab76962460bfa9c59f6a9c5678f0b7a098e5cc`／Tree `129d703d8930a19227ce6391c6ef2db64cb80867`へのAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding 0で完了した。結果は[`CHG-000015_Current_Review_Record_fdab769.md`](Evidence/CHG-000015_Current_Review_Record_fdab769.md)へ記録する。`DOC-ROOT-001`はRoot選択Core候補と直接利用側の固定範囲で解消した。一方、CLI／環境接続、Path／Operation除外の実強制、activation、無効化、削除、Capabilityおよび実Operationは未実装で、全体Gateは`blocked`を維持する。

### Git local exclude Core候補

Qual-Labは、明示enable時に選択RootがRepository内ならRepository Adapterがroot相対の完全一致entryを`.git/info/exclude`へ冪等に追加し、tracked `.gitignore`を自動変更しない方式を承認した。Repository外overrideにはGit excludeを追加しない。書込みまたは書込み後確認に失敗した場合はactivationを`blocked`にする。ignoreは誤commit防止の補助であり、Candidate Revision、Operation入力またはProvider mount除外のSecurity境界にしない。この判断はGit metadata更新方式を固定するもので、機能有効化、Authority Capability、実Operation、採用またはReleaseの承認ではない。

local exclude Core候補は、Root選択入力をplain-data境界で再検証し、明示enable候補だけを受理する。Repository内Rootにはroot相対でanchoredなdirectory patternを生成し、space、glob記号、`#`および`!`をescapeする。Repository外Rootはexclude不要、Repository root自体およびRepository直下の`.git`配下はRootとして不許可とし、制御文字を含むPathも拒否する。結果へ絶対Pathを含めず、Git metadata書込みまたはCapabilityを発行しない。`doctor`は`.git/info/exclude`、tracked `.gitignore`非変更、冪等書込み、書込み後確認、失敗時block、Git directory解決／metadata書込み未実装を表示する。

実Repository AdapterはRepository Identity、Git directoryの配置と実体、non-link／non-reparse、既存exclude内容、同時更新および書込み後のexact entryを確認する必要がある。通常Repository、linked worktree、submodule等のGit directory形態をどこまでRuntime 1.0で正式対応するかは、このCore候補では決定しない。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にlocal exclude処置完了、activation成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

固定Commit `f4b839a6c559d8a14e282092f0397369ac9d4445`／Tree `fdb4511119cc8c58b0ce23b9c3734640126bb8ef`へのAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding 0で完了した。結果は[`CHG-000015_Current_Review_Record_f4b839a.md`](Evidence/CHG-000015_Current_Review_Record_f4b839a.md)へ記録する。local exclude Core候補と直接利用側の固定範囲は独立確認済みである。一方、Git directory解決、metadata書込み、activationおよび実Operationは未実装で、全体Gateは`blocked`を維持する。

### Repository Git layout Core候補

Qual-LabはRuntime 1.0の対象候補を通常worktree、linked worktreeおよび対象Repository自身がsubmodule等の`.git` file形式であるworktreeとし、bare Repositoryを非対応とする方針を承認した。親RepositoryがCRDD submoduleを参照するだけの場合や、CRDD-Communication等の別Repositoryを読取り依存として参照する場合は、その依存Repositoryを変更しない。別Repositoryを変更対象にする場合は個別に有効化し、Root、activation、local exclude、Candidate RevisionおよびOperationを分離する。Runtime RootのRepository間共有と複数Repositoryへの同時書込みOperationは1.0の対象外とする。

この決定をFilesystem解決Core候補へ反映した。`.git` directory、上限付き`.git` fileおよび`commondir`からcommon Git directoryを解決し、bare、欠落、不正control file、Git marker linkおよび既存exclude境界linkを`blocked`へ閉じる。結果へ絶対Pathを保持せず、参照中のsubmoduleまたは別Repositoryへ処置を広げず、Git metadata書込みまたはCapabilityを発行しない。READMEの導入説明には、対象Repository単位、参照だけのsubmodule／別Repository非変更、個別有効化、Root非共有および複数Repository同時書込み非対応を追加した。

Repository Identity、親Path chain、case／Unicode alias、Git extension、実Git解決結果との照合、metadataの同時・原子的・冪等書込みおよび事後確認は未実装である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にRepository Adapter完成、activation成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

linked worktreeでは`info/exclude`がcommon Git directoryに属し、同じRepositoryの他worktreeへも同じpatternが適用される。既定`/.crdd-runtime/`以外のRepository内custom Rootをlinked worktreeで許可するか、共有影響を避けて拒否するかは実書込み前のCurrent Decision Setとして保持する。判断前にmetadata書込み、activationまたは実Operationを開始しない。

固定Commit `9977fc25d0621be2e637487708f27d377edab60f`／Tree `43bf4b7fdd5291ac241a511ffc53bda14f88440e`へのAgent／Architecture／Security Reviewは`AG-REPO-LAYOUT-001` Majorにより`Fail`、Document AuditとGap／Impact＋Conformance Auditは`Pass`であった。個別結果は履歴として保持するが監査集合全体は`Invalidated`であり、個別Passを現在判定、解消、後続実装またはRelease根拠へ流用しない。Findingは初回固定版から存在した見落としで、control fileの上限確認と実読取りが別openであり、directoryのlstatとrealpathも同じ実体Identityへ結合していなかった。

局所処置として、`.git` file、`commondir`および`HEAD`を同一handleから最大値+1 byteまでbounded readし、Path／handleの読取り前後に種別、`dev`、`ino`、`birthtimeNs`、size、`mtimeNs`および`ctimeNs`を照合する。Repository root、Git directory、common Git directoryおよび確認対象entryのIdentityを子確認前後と最終候補返却前にも再照合する。上限超過、short read、grow／shrink、置換、linkまたはclose失敗をPath／生内容なしの`blocked`へ閉じる。この処置はCore自身の読取り安定性に限定し、完全Repository Identity、parent chain、metadata書込みAuthorityまたはCapabilityを成立させない。処置は`Applied`／`Self-checked`であり、新固定版の独立再確認前に`Resolved`としない。

固定Commit `dfa1e5b022b9b5457389e63e0f3085f37511896f`／Tree `111a48438cddba9de805b0c36979909b6db3504b`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_dfa1e5b.md`](Evidence/CHG-000015_Current_Review_Record_dfa1e5b.md)とし、`AG-REPO-LAYOUT-001`は同固定範囲で`Resolved`と判定する。READMEの導入説明における通常Repository、参照submodule、対象自身のgitfile worktreeおよび別CRDD-Communication Repositoryの分離も直接確認済みである。

この解消はGit layout読取りCore候補に限定する。metadata書込み、activation、Capability、実Operation、Runtime完成、採用、準拠、移行、StableまたはReleaseを成立させない。次の人間判断はlinked worktreeで既定Root以外のRepository内custom Rootをcommon `info/exclude`へ追加するかに限定し、推奨、代替および保留時影響は現在記録のCurrent Decision Setへ保持する。

Qual-Labは、linked worktreeでは既定`<repository>/.crdd-runtime/`だけをRepository内Rootとしてcommon `info/exclude`へ追加可能とし、Repository内custom Rootを拒否する推奨案を承認した。custom配置が必要な場合はRepository外overrideを使用し、Git excludeを追加しない。この決定は共有ignoreの影響を既定名だけに限定するもので、metadata書込み、activation、Capability、実Operation、採用またはReleaseの承認ではない。

local exclude Core候補は、Repository内Rootの場合に既存Filesystem解決Coreを再実行し、呼出側のworktree種別自己申告を受理しない。linked worktreeの既定Rootは従来の完全一致entry候補を返し、Repository内custom Rootは`linked_worktree_repository_custom_root_rejected`で`blocked`、Repository外overrideはexclude不要の候補へ閉じる。contractと`doctor`はこの3境界を公開する。処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前に`Resolved`、metadata書込み可能、activation成立またはRuntime完成としない。

固定Commit `1da5108e82393211f54c7fa715638cf952ffbc74`／Tree `e11e3148abe3531d063e6a4b8410ea28b0343b29`へのAgent／Architecture／Security Reviewは`AG-LINKED-ROOT-001` Minorにより`Fail`、Document Auditは`DOC-LINKED-ROOT-001` Minorにより`Conditional`、Gap／Impact＋Conformance Auditは`GCI-ROOT-LINKED-001` Minorにより`Fail`であった。3件は同じ原因を指す。個別の発生分類はAgentが初回見落とし、DocumentとGapが修正起因として記録した。個別結果を履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定、解消、後続実装またはRelease根拠へ流用しない。

原因はlinked worktreeの許可対象を実際のRoot位置ではなくoverride指定元で判定したことで、CLIまたは環境から既定`<repository>/.crdd-runtime/`を明示した場合も誤って拒否した点にある。処置として、`runtime-root-profile.mjs`が所有する既存の既定Directory定数とRepository相対Pathを完全一致で比較する。無指定、CLI同値指定および環境同値指定は同じ`/.crdd-runtime/`候補を返し、真のRepository内custom Rootは拒否、Repository外overrideはexclude不要候補を維持する。処置は`Applied`／`Self-checked`であり、新固定版の3独立再確認前に`Resolved`としない。

固定Commit `b0856c99d45b43e995cb76d1e0b5b7ee938bcfe7`／Tree `3911b781c8170a802841657ed00c778d65133f0b`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_b0856c9.md`](Evidence/CHG-000015_Current_Review_Record_b0856c9.md)とし、`AG-LINKED-ROOT-001`、`DOC-LINKED-ROOT-001`および`GCI-ROOT-LINKED-001`は同固定範囲で`Resolved`と判定する。

この解消はlinked worktree Root方針の候補判定に限定する。metadata書込み、activation、Capability、実Operation、Runtime完成、採用、準拠、移行、StableまたはReleaseを成立させない。追加の人間判断はなく、次段階の条件と停止境界は現在記録のCurrent Decision Setへ保持する。

### 限定Repository parserとlocal exclude書込みAdapter候補

実書込み前の着手前整合確認により、従来Threat Modelが要求した「Gitの最終解決結果との照合」を外部Git CLIで行う場合、実行ファイルの絶対Path、実体Identity、承認Hashおよび更新時再承認が別のTrust Anchor判断を必要とすることを確認した。Qual-Labは、Windows固有管理やOS別Git配置を増やさないため、Runtime 1.0では外部Git CLIをAuthorityとして起動せず、内蔵の限定Filesystem parserを正式なmetadata配置Authorityとする方針を承認した。短所として、Gitとして有効でも未知format、extension、設定includeまたは特殊worktree構成を保守的に拒否する。Git CLI方式への自動fallbackは設けない。この判断はmetadata配置方式を固定するもので、activation、Capability、実Operation、採用またはReleaseの承認ではない。

限定parserは通常worktree、linked worktreeおよび対象自身がsubmodule等の`.git` file形式であるworktreeだけを対象とする。`.git`、`commondir`、`HEAD`およびcommon `config`を上限付き同一handleから読み、Path／handle／parent graphの実体Identityを前後照合する。`config`はRepository format version 0、非bare、`extensions`、`include`、`includeIf`および`core.worktree`なしだけを受理する。未知構文、重複Authority key、未対応format／extensionは`repository_git_config_unsupported`へ閉じる。結果へPathまたはconfig内容を保持しない。

local exclude書込みAdapter候補は、Root選択、限定layout、linked worktree既定Root制約およびexact entryを同一呼出しで再検証する。Repository外overrideはGit metadataへ触れない。Repository内ではcommon Git directoryの既存`info` directoryだけを対象とし、tracked `.gitignore`、参照submodule、別Repositoryまたは複数Repositoryへ処置を広げない。既存`exclude`は131072 byte上限、non-linkおよびIdentity前後一致を要求する。完全一致entryがなければ固定lockを排他的に作成し、既存内容を保持して同期後に置換し、再読取りbyte一致とexact entryを確認する。既存lock、link、上限超過、Identity変化、同時更新、short write、close失敗、置換または事後確認失敗はPath／生内容なしの`blocked`へ閉じ、未知lockを推測削除しない。

本処置は限定parserとmetadata書込みCore候補までである。同一権限Host主体による検査直後の敵対的置換、case／Unicode alias、parent chain、owner／ACL、crash durability、CLI／環境override接続、activation、Candidate Revision／Operation／Provider除外の実強制、Capabilityまたは実Operationを成立させない。既存Git `info` directoryがない場合は推測作成せず`blocked`とする。`doctor`は限定parser／metadata書込み候補とactivation結合未実装を分離し、全体Gateを`blocked`に保つ。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前にAdapter完成、activation成立、Runtime完成、採用、準拠、移行またはReleaseとして扱わない。

### 限定gitfile境界とThreat Model現在状態の訂正

固定Commit `6ffeefbde632ca661423ba573f60a87110781c67`／Tree `3bda2f522886798dbe07c24298c88659aa14b576`に対する監査は、Agent／Architecture／Security Reviewが`Fail`（`AG-REPO-PARSER-001` Major）、Document Auditが`Pass`（Finding 0）、Gap／Impact＋Conformance Auditが`Fail`（`GCI-GIT-METADATA-001` Major）であった。3結果は個別履歴として保持するが、監査集合全体は`Invalidated`とし、現固定版の合否または解消判定へ流用しない。両Findingは初回見落としであり、現在処置は`Applied`／`Self-checked`、新固定版の3独立再確認前は未`Resolved`とする。

`AG-REPO-PARSER-001`への処置として、common configの`core.bare`は欠落またはGitが受理し得る別の偽値表記を許さず、重複しない明示的な`false`だけを受理する。`core.worktree`拒否を維持するため、Runtime 1.0の対象候補は通常worktree、linked worktreeおよび`.git` fileを使うが`core.worktree`を持たない限定worktreeへ訂正する。標準submodule自身は現版で`repository_git_config_unsupported`へ閉じる。一方、親RepositoryがCRDD submoduleを参照するだけの場合に依存Repositoryを変更しないという人間意図は維持する。上記の過去節で「対象Repository自身がsubmodule等」とした記録は当時の判断履歴として改変しないが、この現在訂正により対応範囲としては失効し、新しい合否へ使用しない。READMEの導入説明、Threat Model、公開contract、`doctor`および試験をこの境界へ揃える。

限定parserが確認するのはmetadata配置graph／config候補であり、完全なRepository Identityではない。このため公開contractは`repositoryIdentityVerification: not_implemented`を維持し、`metadataPlacementLayoutVerification: implemented_narrow_parser_candidate`として別軸へ分離する。`GCI-GIT-METADATA-001`への処置として、Threat Modelに残っていた「実Adapterが今後書く」「Gitの最終解決結果と照合する」「metadata書込みAuthorityは未実装」という旧現在表現を訂正する。構文候補生成は非書込み、限定parserによる配置確認は実装済み候補、local exclude書込みAdapter候補は実際に排他lock、同期、置換および事後確認を行い、activation結合、完全なRepository IdentityおよびCapabilityは未実装とする。外部Git CLIの最終照合またはfallbackを再導入しない。

この訂正はbounded stable read、既存内容保持、未知lock非削除、`fsync`後の置換、再読取りbyte／exact entry確認、置換後失敗の書込み済み`blocked`、linked worktree既定Root制約、Repository外override非書込み、参照submodule／別Repository非変更、Path／生内容非保持を変更しない。activation、Candidate Revision／Operation／Provider除外の実強制、Capability、実Operation、Runtime完成、採用、準拠、移行、StableまたはReleaseも成立させない。

固定Commit `2f0b634617ea6c4a9baa8bbd7a244cc6bfba7ebe`／Tree `387ca0d827c067717d6d9ef734d841d858142916`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_2f0b634.md`](Evidence/CHG-000015_Current_Review_Record_2f0b634.md)とする。`AG-REPO-PARSER-001`および`GCI-GIT-METADATA-001`は限定parser／metadata書込みAdapter候補と直接利用側の固定範囲で`Resolved`と判定する。

この解消は完全なRepository Identity、Path／ACL、crash durability、activation、Candidate Revision／Operation／Provider除外の実強制、Capabilityまたは実Operationを成立させない。旧`6ffeefb`以前の結果は履歴としてのみ保持し、現在判定へ流用しない。次段階と人間判断の再開条件は現在記録のCurrent Decision Setへ保持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### Runtime Root Path Identity Core候補

固定Commit `2f0b634617ea6c4a9baa8bbd7a244cc6bfba7ebe`／Tree `387ca0d827c067717d6d9ef734d841d858142916`の3独立確認とEvidence closure後、Current Decision Setに従い、追加の人間判断なしでRuntime Root Path Identity Core候補へ進む。旧確認結果は限定Repository parser／metadata書込みAdapter候補の履歴として保持し、本差分の合否へ流用しない。

Path Identity Core候補はRoot選択Coreを再実行し、明示enable要求を含む同じ選択候補だけを受理する。既に存在するRepository、選択Rootおよび直近parentを、事前`lstat`、`realpath`解決先、事後`lstat`および最終候補返却前の再照合へ結合する。non-link directoryであり、`dev`、`ino`および`birthtimeNs`が安定し、Rootの実体parentが選択parentと一致し、lexical PathとrealpathのRepository内外分類が一致する場合だけ`candidate`とする。既定Rootは選択parentがRepository rootと同一実体で、leafが正確に`.crdd-runtime`の場合に限る。欠落、Repository root同値、Root／parent／Repositoryの置換、link／junction、containment差または安定Identityを取得できないFilesystemはPath／生errorなしの`blocked`へ閉じる。

結果は選択元、Repository既定／内部custom／外部overrideの安全な分類、および`pathObjectIdentityVerification: implemented_candidate`だけを返し、絶対Path、`dev`、`ino`または再利用可能なdescriptorを公開しない。`ownerAclVerification`、`fullParentChainVerification`、local exclude結合およびactivation結合は`not_implemented`であり、Root作成／削除、権限変更、exclude更新、CapabilityまたはOperationを実行しない。OS名だけで対応済みとせず、安定Identityが得られないFilesystemはunsupportedとしてfail closedにする。case／Unicode alias、network／removable Filesystem、完全Repository Identity、所有主体／DACL／modeおよび全parent chainは未評価・未実装範囲に残す。

専用試験はRepository既定、CLI内部custom、環境外部override、CLI優先と既定同値、欠落、Repository root同値、Root link、Root／parent／Repository置換、安定Identity欠落、accessor／ProxyおよびPath非出力を確認する。`doctor`はRoot選択Core候補とPath Identity Core候補を分離表示し、Path Adapter、owner／ACL、activationおよびCapability未実装を維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前に`Resolved`、Path Adapter完成、機能有効、Runtime完成、採用、準拠、移行、StableまたはReleaseとして扱わない。

固定Commit `524d1569bc995cc1319979136802dd3035e7d152`／Tree `e78e5e12613a44c823e5d4f0b5873d13b2e1c532`に対する監査は、Agent／Architecture／Security Reviewが`Fail`（`AG-ROOT-PATH-001` Major）、Document Auditが`Pass`（Finding 0）、Gap／Impact＋Conformance Auditが`Pass`（Finding 0）であった。個別結果は履歴として保持するが、監査集合全体は`Invalidated`とし、現在判定、解消、後続実装またはRelease根拠へ流用しない。Findingは初回から存在した見落としであり、現在処置は`Applied`／`Self-checked`、新固定版の3独立再確認前は未`Resolved`とする。

原因はRepositoryからRootへの一方向だけで包含を分類し、Repositoryと相互に分離したRootと、Repositoryを内包する祖先Rootを同じ外部状態へまとめた点にある。処置として、`classifyContainment(repository, root)`を同一、Repository内、Repositoryを内包、相互非包含の4状態へ固定する。lexical Pathとrealpathの状態完全一致を要求し、既定／内部customはRepository内だけ、外部overrideは相互非包含だけを許可する。同一またはRepositoryを内包するRootは指定元にかかわらず`blocked`とする。外部Rootの直近parentがRepositoryとの共通祖先であること自体は拒否せず、Root自身の相互非包含を判定する。

専用試験へ外部siblingの正例、Repositoryの直接parent／上位祖先Rootの拒否、lexical相互非包含からrealpathでRepository包含へ変わるalias差、およびその逆の拒否を追加する。既存のIdentity時間結合、Root／parent直接関係、安定Identity欠落fail closed、Path／Identity非出力、Root選択正本、owner／ACL／全parent chain／local exclude／activation未実装、Capability未発行およびGate `blocked`は変更しない。本処置は新固定版の機械確認と3独立確認前に`Resolved`、Runtime完成、採用、準拠、移行、StableまたはReleaseとして扱わない。

固定Commit `014546c625fca6d08b10325b110e7f95786218ee`／Tree `fee44ec90f41b2265ece9fc567fc53e5329c6abb`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_014546c.md`](Evidence/CHG-000015_Current_Review_Record_014546c.md)とする。`AG-ROOT-PATH-001`はPath Identity Core候補と直接利用側の固定範囲で`Resolved`と判定する。

この解消はowner／ACL、全parent chain、特殊Filesystem、CLI／環境override実接続、local exclude／File Bundle Path Adapter結合、activation、Capabilityまたは実Operationを成立させない。旧`524d156`以前の結果は履歴としてのみ保持し、現在判定へ流用しない。次段階と人間判断の再開条件は現在記録のCurrent Decision Setへ保持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### CLI／環境override診断接続とlocal exclude前後再検証

Evidence commit `bc83a61ae89c44e224ff96d7ee130d9389972634`のCurrent Decision Setに従い、追加の人間判断なしでCLI／環境overrideをRoot選択とPath Identityへ接続する。旧`014546c`の3独立確認はPath Identity Core候補の履歴としてのみ保持し、本差分の合否へ流用しない。

`coordinator doctor`は引数をFilesystemまたはrecovery処置前に一度だけ厳密解析し、未知／重複option、値欠落、余剰tokenを拒否する。`--recover-isolation`は`--json`以外の`--isolation`、`--enable-runtime`および`--runtime-root`と排他的にする。`--runtime-root`単独を黙って無視せず、`--enable-runtime`を要求する。環境`CRDD_COORDINATOR_ROOT`は非opt-in時にRoot検査へ渡さず、opt-in時だけCLIより低い優先度で固定する。`--enable-runtime`は有効化ではなく、既存RootのPath Identity診断を要求する候補である。

`doctor`はcwd、明示要求およびoverride候補を最小のplain dataとして固定し、Root Identity結果を`runtime.root`の`blocked` checkへ接続する。Path Identityが成立してもactivation記録が未実装であるため全体Gateを開かず、結果へ絶対Path、Filesystem Identityまたはraw errorを保持しない。非opt-in時に禁止するのはRuntime Rootの`lstat`／`realpath`／作成／書込みであり、既存doctorのOperation一時領域と受動診断まで無処置とするものではない。

local excludeの構文候補生成は非書込みのまま維持する。適用Adapter候補は内部／外部Rootの双方でPath Identity候補を確認し、内部RootではGit layout確認後かつ書込み直前、さらにmetadata処置後にも同じraw入力を再検証する。外部overrideはIdentity成立後だけexclude不要候補とする。事後再検証失敗では実際の`gitMetadataWriteIssued`を保持して`blocked`とし、暗黙rollbackしない。これはIdentity descriptorの移送または再利用可能Capabilityではなく、検査間の最終同名置換を完全防御する時間的結合、owner／ACL、全parent chain、特殊Filesystem、activation、Candidate Revision／Operation／Provider除外の実強制または実Operationを成立させない。

CLI grammar、CLI／環境優先順、非opt-in、既存／欠落／外部Root、Path非出力、local exclude直前／直後再検証および書込み済み失敗を局所試験で固定する。本処置は`Applied`／`Self-checked`であり、新固定版の全体CheckerとAgent／Architecture／Security Review、Document Audit、Gap／Impact＋Conformance Auditが完了するまで`Resolved`、Runtime有効、Capability発行、採用、準拠、移行、StableまたはReleaseとして扱わない。

固定Commit `8b3931acbda1f1f8bff8fd3f3e33f472571a0ad6`、Tree `6444d9e15e2eeb36dea1ac67b32bbeca332524c4`に対する3独立確認は、Agent／Architecture／Security Reviewが`AG-ROOT-CLI-001` Major、Document Auditが同根の`DOC-ROOT-CLI-001` Major、Gap／Impact＋Conformance Auditが別根の`GCI-ROOT-INTEGRATION-001` Majorにより、すべて`Fail`であった。3結果は個別履歴として保持するが監査集合全体は`Invalidated`であり、現在判定、解消、後続工程またはReleaseへ流用しない。前2件は本固定版の初回走査で検出し、後者は今回追加した複数回再検証が初回Identityへ結合されない修正起因Findingとして分類する。

前2件への処置として、`doctor`のネストしたRuntime Root要求をOperation領域作成、Repository診断またはProvider探索より前にexact plain-data snapshotへ固定する。`cliOverride`、`environmentOverride`および`activationIntent`の3つのown enumerable data propertyをすべて要求し、overrideは`null`または上限内かつ制御文字を含まない絶対Path、intentは`explicit_enable_request`だけを受理する。accessor、Proxy、symbol、独自prototype、欠落／余分fieldまたは不正値はgetterを実行せず`doctor_options_invalid`へ閉じ、固定後はraw objectを再読しない。

`GCI-ROOT-INTEGRATION-001`への処置として、local exclude専用のPath Identity統合処置を追加する。一回の適用Runで最初に確認したRepository、選択Root、直近parent、lexical／realpath包含分類、選択元および位置分類を固定し、Git layout確認後、書込み直前、書込み後、または外部overrideの完了直前を必ず同じ初回snapshotへ照合する。別の正常directoryへの同名置換を新しい基準として採用しない。書込み前の不一致はmetadataを書かず、書込み後の不一致は`gitMetadataWriteIssued`の実績を保持して`blocked`とし、暗黙rollbackしない。汎用callback、Identity descriptor、tokenまたはCapabilityを公開しない。

ネスト入力、Repository／parent／Rootの書込み前後置換、外部override、Path／Identity非出力および既存回帰を局所試験へ追加する。この処置は`Applied`／`Self-checked`であり、新固定版の全体Checkerと同じ3独立確認が完了するまで各Findingを`Resolved`としない。同一権限Hostによる各Filesystem呼出し間の最終race、owner／ACL、全parent chain、特殊Filesystem、activation、Candidate Revision／Operation／Provider除外の実強制、Capabilityまたは実Operationは未実装のままであり、全体Gate、採用、準拠、移行、StableおよびReleaseは`blocked`を維持する。

固定Commit `c4af67a2c070985c0511e68539239afe5d54abd4`／Tree `a00269b14f7d7bbfd838df28d744c688c91f6158`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_c4af67a.md`](Evidence/CHG-000015_Current_Review_Record_c4af67a.md)とする。`AG-ROOT-CLI-001`、`DOC-ROOT-CLI-001`および`GCI-ROOT-INTEGRATION-001`はネスト入力snapshotと初回Root Identityへのlocal exclude適用Run結合の固定範囲で`Resolved`と判定する。

この解消はowner／ACL、全parent chain、特殊Filesystem、activation、Authority File Bundleの実Path Adapter、Candidate Revision／Operation／Provider除外の実強制、Capabilityまたは実Operationを成立させない。旧`8b3931a`以前の結果は履歴としてのみ保持し、現在判定へ流用しない。次段階と人間判断の再開条件は現在記録のCurrent Decision Setへ保持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 永続activationと共有Authority Rootの決定

Qual-Labは、Runtime 1.0のactivationをRepository単位の永続状態とし、診断用`doctor --enable-runtime`とは別の専用`activate`操作で実行する方針を承認した。Runtime Rootは従来どおり既定`<repository>/.crdd-runtime/`または明示overrideを使用し、Authority BundleはRepository内Runtime Rootから物理的に分離した共有可能なAuthority Rootへ置く。Authority RootにはWindows／macOS／Linux固有の暗黙既定値を設けず、CLIまたは環境から絶対Pathを明示する。同じ契約をserver volumeにも使用する。

Runtime Root内の固定`activation.json`候補は、Repository／Root Identity、Bundle／Policy／RegistryのID、revisionおよびHash、activation revision／前版Hash、状態とcanonical UTC時刻を結合する。Bundle Identityが変わった場合は古いactivationを自動追随させず、再activationを要求する。`disable`は新規Operationを停止し、進行中Operationを安全なcancel／recovery契約へ渡す永続遷移とする。保存データを削除せず、deleteは別の明示的な不可逆操作として今回実装しない。

Authority RootはRuntime主体だけが書込み可能でProviderから到達不能という共通保護結果を要求し、Windows DACL、POSIX owner／modeおよびserver volume policyはPlatform Adapterの実装差とする。安定Identity、owner／ACLまたはFilesystem特性を確認できない場合は`blocked`へ閉じる。Root作成はPlatform Adapterが安全な権限を強制できる場合に限り、外部事前Provisionも同じ結果を検証する。OS名だけで成立を推定しない。

この段落のAuthority Root writerおよびRoot作成方針は、後続のクロスプラットフォームRoot保護に関するQual-Lab承認によって`superseded`となり、現在の設計、実装、監査またはRelease判断へ使用しない。現在契約は、Authority Rootをadmin／installerが事前Provisionし、`provisioner_principal_only`だけが書込み、Runtime主体は読取り専用とする。Runtime自身はRoot作成または権限変更を行わない。

最初の処置として、OS暗黙値を持たないAuthority Root選択Core候補と、activation recordのcanonical byte／Hash Core候補を追加する。選択結果へ絶対Pathを保持せず、recordはCredential、生PathまたはAuthorityを保持しない。原子的書込み、Path／owner／ACL照合、専用CLI Effect、disable遷移、Candidate Revision／Operation／Provider除外の実強制、run-scoped CapabilityおよびProvider起動は未実装である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立確認前に`Resolved`、activation成立、Runtime完成、採用、準拠、移行、StableまたはReleaseとして扱わない。

固定Commit `4b115520a5d26ee8c2f16fb413061aa9736e6a1a`／Tree `9dfaed65e6ab787d02cb290cf92e981350ca2705`に対するAgent／Architecture／Security Reviewは`Pass`、Document Auditは`DOC-ACTIVATION-001` Majorにより`Fail`、Gap／Impact＋Conformance Auditは`GCI-ACTIVATION-001` Minorにより`Fail`であった。個別結果は履歴として保持するが監査集合全体は`Invalidated`であり、AgentのPassを現在判定、解消、後続実装またはReleaseへ流用しない。`DOC-ACTIVATION-001`は新Lifecycle契約の追加で生じた直接利用側への伝播漏れ、`GCI-ACTIVATION-001`は今回変更で新たに発生した直接object入力の処理量境界として分類する。

`DOC-ACTIVATION-001`への処置として、Runtime Rootとactivation recordの`disableSemantics`を`stop_new_operations_and_safely_cancel_in_flight`へ統一する。READMEは契約上の新規Operation停止／進行中Operationのsafe cancel／recoveryと、現在の永続遷移／Operation結合未実装を分離して説明する。保存データ非削除とdelete別操作は維持する。

`GCI-ACTIVATION-001`への処置として、activation入力上限の一意な正本へ`canonicalUtcLength: 24`を加え、文字列型と4桁年canonical UTCの正確な長さをDate解析、canonical化、byte計測およびHash計算より前に確認する。23／25文字、巨大文字列、offset、date-only、非文字列および不正日付を例外なしの固定`blocked`へ閉じ、24文字の正常値とactive／disabled境界を回帰確認する。

両処置は`Applied`／`Self-checked`であり、新固定版のCoordinator全試験、Checker、全体Checkerおよび同じ3独立監査が完了するまで未`Resolved`とする。persistent activation、Authority Root分離、候補／Capability分離、原子的永続化／Path／ACL／専用Effect未実装、Gate `blocked`および非Release境界は変更しない。

固定Commit `4bcc17ccb6ba9b50374bb8a4069b2148f281fe19`／Tree `a5d9dcccd8efe109a01a08da96c738c82762bc04`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。現在記録は[`CHG-000015_Current_Review_Record_4bcc17c.md`](Evidence/CHG-000015_Current_Review_Record_4bcc17c.md)とする。`DOC-ACTIVATION-001`および`GCI-ACTIVATION-001`はdisable lifecycleとactivation時刻入力境界の固定範囲で`Resolved`と判定する。

この解消は原子的永続化、Authority Root／Runtime Rootの実Path／owner／ACL、専用activate／disable Effect、Candidate Revision／Operation／Provider除外の実強制、run-scoped Capabilityまたは実Operationを成立させない。旧`4b11552`以前の結果は履歴としてのみ保持し、現在判定へ流用しない。次段階と人間判断の再開条件は現在記録のCurrent Decision Setへ保持し、Gate `blocked`、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開の非成立を維持する。

### 専用activate／disable command grammar候補

Evidence Commit `01b1c2fc08adced6303e2dbdf9a6982b18b6a247`のCurrent Decision Setに従い、追加の人間判断なしで専用`activate`／`disable`のCLI grammar候補へ進む。旧`4bcc17c`の3独立確認はAuthority Root選択／activation record canonical Core候補の履歴としてのみ保持し、本差分の合否へ流用しない。

`activate`は`--json`、`--runtime-root <absolute-path>`および`--authority-root <absolute-path>`だけ、`disable`は`--json`と`--runtime-root <absolute-path>`だけを受理する。未知／重複option、値欠落、余剰token、相対Path、制御文字または4096文字超過のCLI値は処置前のusage errorへ閉じる。Runtime RootはCLI、`CRDD_COORDINATOR_ROOT`、Repository既定の順、Authority RootはCLI、`CRDD_COORDINATOR_AUTHORITY_ROOT`の順とし、Authority RootにOS暗黙既定を設けない。Authority Root欠落または不正環境値はCLI誤用と区別した`blocked`とする。`disable`はAuthority Root optionまたは環境値を受理／使用しない。doctor／recovery／isolation用optionを専用commandへ混入させず、既存grammarを緩めない。

妥当な要求も現在は`runtime_activation_effect_not_implemented`または`runtime_disable_effect_not_implemented`として`blocked`にする。JSON／通常出力はcommand種別、固定reason、Effect非発火およびCapability未発行だけを示し、Path、環境値、cwd、Filesystem Identityまたはraw tokenを保持しない。専用commandからRootの`lstat`／`realpath`／作成、local exclude、Authority Bundle読取り、activation record生成／Hash／永続化、disable遷移、Candidate Revision／Operation／Provider除外、Capability、ProviderまたはOperationを発火しない。

公開contractは`activationCommandGrammar`／`disableCommandGrammar`の実装済み候補と、`activationEffect`／`disableEffect`／`atomicPersistence`の未実装を別軸へ分離する。局所試験はcommand別grammar、CLI／環境優先、Authority Root欠落、不正環境値、通常／JSONのPath非漏洩、exit code `2`／`64`およびdoctor／recovery非回帰を確認する。本処置は`Applied`／`Self-checked`であり、新固定版の全体Checkerと同じ3独立確認前にcommand Effect、activation成立、Capability、Runtime完成、採用、準拠、移行、StableまたはReleaseとして扱わない。

固定Commit `0e3bcd8be666336122ef5a59d22b1448389d7cea`／Tree `1770322a06d5bc872507875b68fd7e96f42c20b0`に対する監査は、Agent／Architecture／Security Reviewが`Fail`（`AG-ACTIVATION-CLI-001` Minor）、Document Auditが`Conditional`（`DOC-ACTIVATION-002` Minor）、Gap／Impact＋Conformance Auditが`Fail`（`GCI-ACTIVATION-COMMAND-001` Minor）であった。3結果は個別履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定、後続実装またはReleaseへ流用しない。前2件は各監査の初回固定版走査で検出し、GCIは今回修正によって新たに発生したFindingとして分類する。現在処置は`Applied`／`Self-checked`であり、新固定版の同じ3独立確認前は未`Resolved`とする。

`AG-ACTIVATION-CLI-001`への処置として、安全な引数配列snapshotの失敗と個別token検査失敗を分離する。snapshot成立後は所有配列から`--json`完全一致を先に確定し、その後に型、空、4096文字、C0／DELを検査する。`--json`付きの不正tokenは構造化usage error／exit `64`へ閉じ、Pathまたはraw値を返さない。snapshot自体が成立しない場合はraw入力からJSON要求を推定しない。

`DOC-ACTIVATION-002`への処置として、READMEの現在コマンド一覧へCLI helpと同じ`activate`／`disable`形式を追加し、直後にgrammar／診断入口だけが実装済み候補でEffectは常に`blocked`、Filesystem／record／Capability非発火であることを維持する。

`GCI-ACTIVATION-COMMAND-001`への処置として、Runtime Root／Authority Rootの各軸でCLI指定がある場合は同じ軸の環境値を選択／検証対象から外し、後続selectorへ`null`として渡す。CLI指定がない場合だけ環境値を検証し、Runtime Rootは環境値もなければRepository既定、Authority Rootは両方ない場合だけ明示Path欠落へ閉じる。一方の軸のCLI指定は他方の不正環境値を隠さず、`disable`はAuthority Rootを参照しない。README／Threat Modelも、選択される環境値だけが検証対象であることへ揃える。

局所試験はRuntime／Authority両軸のCLI優先、片軸だけの不正環境値、CLIなしの不正環境値、`disable`のRuntime軸、`--json`付きC0／DEL／4097文字、非JSON負例、exit `2`／`64`およびPath非漏洩を確認する。既存command別grammar、3結果、doctor／recovery、Effect非発火、Authority／Capability非昇格、Gate `blocked`および非Release境界は変更しない。

固定Commit `0734703e6735045247be3694fee50fed8c751fa6`／Tree `868e69d6baea17312fbf17aabc833d85e1b6bdc7`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `176 / 176 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。現在記録は[`CHG-000015_Current_Review_Record_0734703.md`](Evidence/CHG-000015_Current_Review_Record_0734703.md)へ接続する。

この新固定版により、`AG-ACTIVATION-CLI-001`、`DOC-ACTIVATION-002`および`GCI-ACTIVATION-COMMAND-001`は、activate／disable CLI grammar候補と直接利用側の固定範囲で`Resolved`と判定する。旧`0e3bcd8`以前の監査集合は各時点の履歴として保持するが、現在判定へ流用しない。これはCLI Effect、原子的永続化、Path／owner／ACL、disable／cancel実処理、run-scoped Capability、Provider／Operation、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開の成立を意味せず、Execution Environment Gateは`blocked`を維持する。

Evidence Commit `546221d8b37ff8c677d6b71c7ab9823025b821e1`のCurrent Decision Setに基づき、実Effectの前提となるactivation recordのcross-record transition Core候補へ進む。着手前整合確認では、再activation時のactivation ID、時刻、Authority tupleの変更／rollback規則が未決であるため、`active`から`active`への遷移を推定実装しない方針へ監査間で統合した。

今回の発火範囲は、前版がない初版`active`と、前版`active`から次版`disabled`への遷移だけである。外側入力をexact plain-data snapshotし、前版はcanonical Bufferを既存decoderで再検証、次版は既存compilerで再構成する。初版はrevision `1`、前版Hash `null`、`disabledAt: null`を要求する。disable遷移はsafe integer範囲でrevisionを正確に1増やし、再計算した前版Hash、activation／Repository／Runtime Root Identity、Bundle／Policy／Registryの全ID・revision・Hashおよび`activatedAt`を維持し、`disabledAt`だけを追加する。

`active`から`active`への再activationは`runtime_reactivation_transition_policy_not_implemented`、`disabled`起点は`runtime_disabled_transition_policy_not_implemented`へfail closedにする。結果は`candidate`に限り、Filesystem Effect、永続化、Authority、Capability、CLI Effect、disable時のcancel／recovery、ProviderまたはOperationを発火しない。Bundle等のIdentity変更時は旧activationを流用せず、現版では再activationを完了できないためGateを`blocked`に保つ。本処置は`Applied`／`Self-checked`であり、新固定版のCheckerと3独立確認前に遷移成立、永続化、Runtime完成またはReleaseへ用いない。

固定Commit `30aee201cc892c6c65986d50bd5b74d1fbbc1493`／Tree `a87e061986914f6cc6f6eef503cf50f61aa0de9b`に対する監査は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（`DOC-ACTIVATION-TRANSITION-001` Minor）、Gap／Impact＋Conformance Auditが`Fail`（`GCI-ACTIVATION-TRANSITION-001` Minor）であった。3結果は個別履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定、後続EffectまたはReleaseへ流用しない。2件はいずれも今回変更による修正起因Findingである。現在処置は`Applied`／`Self-checked`であり、新固定版の同じ3独立確認前は未`Resolved`とする。

`DOC-ACTIVATION-TRANSITION-001`への処置として、READMEのdisable遷移説明を、前版canonical byteからHashを再計算して結合し、revisionを正確に1増やし、Repository／Root Identity、Authority参照およびactivation時刻を維持し、`disabledAt`だけを追加する契約へ明確化する。record生成、永続化またはdisable Effectが成立したとは表現しない。

`GCI-ACTIVATION-TRANSITION-001`への処置として、前版／次版の個別妥当性確認と初版規則の後は、前版`disabled`、次版`active`、`active`から`disabled`のrevision上限、disable不変条件の順で評価する。これにより最大revisionでも`active`から`active`は再activation policy未実装、`disabled`起点はdisabled-origin policy未実装へ閉じ、revision exhaustionは実装済み候補である`active`から`disabled`だけへ適用する。MAX_SAFE-1からMAX_SAFEの正常境界、最大revisionの3遷移種別および既存負例を試験で固定する。

公開contract、許可遷移2件、既存decoder／compiler、candidate出力、Filesystem Effect／persistence／Capability非発火、CLI、Gate `blocked`、非規範／Release境界は変更しない。

固定Commit `c9a7a21afcedff654e51d728d15e5c0194107849`／Tree `4a9dfb0e09c4d96857cfd09e722284bee6c645a1`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `183 / 183 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`DOC-ACTIVATION-TRANSITION-001`と`GCI-ACTIVATION-TRANSITION-001`はこの固定範囲で`Resolved`と判定する。旧`30aee201`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_c9a7a21.md`](Evidence/CHG-000015_Current_Review_Record_c9a7a21.md)へ接続する。

確認済み範囲は初版`active`、`active`から`disabled`、Hash再計算、revision増分、Identity／Authority／時刻不変条件および最大revisionの判定順に限る。再activation、disabled起点の遷移、原子的永続化、Path／owner／ACL、実CLI Effect、cancel／recovery、Capability、Provider／Operationは未実装または未評価で、Gateは`blocked`を維持する。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labは、次段階のクロスプラットフォームRoot保護結果を承認した。Runtime RootはRepository既定または明示overrideへ事前Provisionし、Runtime主体が読取り／書込みでき、非承認主体が書き込めないようにする。Authority RootはRuntime Rootから物理分離してadmin／installerが事前Provisionし、provisioner主体だけが書込み、Runtime主体は読取り専用とする。Windows DACLとmacOS／Linuxのowner／modeは同じ保護結果へ写像し、OS固有の暗黙Pathを設けない。serverは同じ絶対Path契約をpersistent volumeへ適用し、network、removable、specialまたは安定確認できないFilesystemはRuntime 1.0でfail closedにする。Runtime自身はRoot作成、chmodまたはACL変更を行わない。

この決定を受け、実Platform Adapterの前段として共通Root保護方針Core候補を追加する。入力はRoot role、Platform family、Filesystem classおよび既存Root／安定Identity／link・reparse／主体別read・writeの観測claimをexact plain-dataで受理する。Runtime RootはRuntime read/write、Authority Rootはprovisioner writeかつRuntime read-onlyを要求し、いずれも非承認主体writeを拒否する。`windows`／`posix`と`local`／`persistent_volume`だけを候補化し、それ以外、情報不足、動的shapeまたは不正値を固定理由で`blocked`へ閉じる。

caller supplied観測はAuthorityではなく、成功結果も`root_protection_platform_adapter_verification_required`の`candidate`に限る。新CoreはFilesystemを読まず、Path、SID、UID、GID、mode、DACLまたはraw errorを保持しない。Root作成／権限変更、Windows DACL Adapter、POSIX owner／mode Adapter、persistent volume Adapter、Path binding、atomic persistence、activation、Capability、ProviderおよびOperationは未実装のままで、Gateを`blocked`に保つ。既存Root／Authority選択、Root Identity、File Bundle、activation record、doctorは同じPolicy contractを参照する利用側とし、CLI、transition、local excludeまたはatomic writerへ接続しない。本処置は`Applied`／`Self-checked`であり、新固定版の全体Checkerおよび3独立監査前に実Path／ACL確認、activation成立、Runtime完成またはReleaseへ用いない。

固定Commit `d76857b45cf51accb71c3d82e3c1454c6fded2c1`／Tree `5e2734dd8d0ac4545a1a73d120097add0aaec9ae`に対する監査は、Agent／Architecture／Security Reviewが`AG-ROOT-PROTECTION-001` Majorにより`Fail`、Document Auditが`DOC-ROOT-PROTECTION-001` Majorにより`Fail`、Gap／Impact＋Conformance Auditが`GCI-ROOT-PROTECTION-001` Majorおよび`GCI-ROOT-PROTECTION-002` Minorにより`Fail`であった。個別結果とseverityは履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定または後続実装へ流用しない。Agentは今回変更による新規発生、Documentは修正起因、Gapは今回変更による新規発生として分類しており、この分類差を改変しない。

4 Findingの同根は、writer Authorityを独立boolean claimで表現して排他性を固定できなかったことと、Authority Rootの旧逆向き説明を現在契約から失効させなかったことである。処置として`provisionerWriteAllowed`を廃止し、観測claimへ排他的な`writeAuthority`を追加する。Runtime Rootは`runtime_principal_only`、Authority Rootは`provisioner_principal_only`だけを候補化し、返却する`requiredWriteAuthority`は照合したPolicy要求であって実ACL確認済みとは扱わない。Threat Modelは現在契約へ訂正し、旧CHG判断は履歴を残したまま後続承認による`superseded`／現在不使用へ接続する。

caller claim／candidate境界、Platform Adapter／Path／ACL／Effect／Capability未実装、unsupported Filesystem fail closed、Gate `blocked`および非Release境界は変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前は未`Resolved`とする。

固定Commit `410c3ee300c9557d4b82dbf029691dfaf6ada328`／Tree `eeb0919ab876a4b0aa7eb95edb117a75584d91aa`に対する再監査は、Agent／Architecture／Security Reviewが`Pass`／Finding 0、Document Auditが`Pass`／Finding 0、Gap／Impact＋Conformance Auditが`GCI-ROOT-PROTECTION-R01` Minorにより`Fail`であった。個別結果は履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定または後続実装へ流用しない。GCIは本修正により生じた修正起因として分類された。

`GCI-ROOT-PROTECTION-R01`の原因は、排他的writer判定と`requiredWriteAuthority`を是正した一方、公開contractの`runtimeRootProtection`／`authorityRootProtection`要約が旧非排他表現のままdoctorとactivation contractへ投影されたことである。処置として要約を`runtime_principal_only_read_write_and_no_other_writer`／`provisioner_principal_only_write_runtime_read_only_and_no_other_writer`へ更新し、Root Protection Policy、doctorおよびactivation contractの3試験で完全一致を固定する。これはPolicy要求の表現であり、実DACL／owner／mode検証済み、読取り制限の追加、AuthorityまたはCapability成立を意味しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前は未`Resolved`とする。

固定Commit `63ec7fdecc471e1d26a3ab51edf1f6f030d556e0`／Tree `0c29e031482ab498db3b89087812b4acc4cd00b4`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `190 / 190 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。Root Protection Policyに関する上記5 Findingはこの固定範囲で`Resolved`と判定する。旧`d76857b`／`410c3ee`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_63ec7fd.md`](Evidence/CHG-000015_Current_Review_Record_63ec7fd.md)へ接続する。

次段階の着手前整合確認により、完全なPlatform AdapterにはRuntime／provisioner principalのAuthority source、POSIX ACL、Windows DACL、persistent volume分類およびhandle-relativeな時間結合の人間判断が必要である一方、追加判断なしでPOSIX Runtime Rootの受動mode precheck候補まで実装できると確認した。precheckは明示opt-in時だけ既存Root Path Identityのprivate session内で現在effective UID、Root ownerおよびmodeを観測し、owner rwx欠落とgroup／other write bitを拒否する。同一handleの前後metadataと既存Root／parent／Repository snapshotを再照合し、Path、UID、GID、mode、descriptorまたはraw errorを返さない。

mode precheck合格もACL不存在、将来Runtime principal binding、Filesystem classまたはAuthority Root保護を証明しないため、結果は`posix_runtime_root_protection_verification_incomplete`の`blocked`へ閉じる。`posixOwnerModeAdapter`、Windows DACL Adapter、persistent volume Adapter、activation、Capability、ProviderおよびOperationは未実装である。CLI、transition、local exclude、atomic writer、Authority Root／File Bundleは本precheckを消費せず変更不要とする。本処置は非規範候補の`Applied`／`Self-checked`であり、固定版の機械確認と3独立監査前に実Platform保護成立、Runtime完成、採用、準拠、移行、StableまたはReleaseへ用いない。

固定Commit `dfd1810102ed421d73508a9f53a230c3d0690169`／Tree `68a676f9a48d9c13a8171f75da80c74c374a0540`に対する監査は、Agent／Architecture／Security Reviewが`AG-POSIX-PRECHECK-001` Majorにより`Fail`、Document Auditが`DOC-POSIX-PRECHECK-001` Minor付き`Conditional`、Gap／Impact＋Conformance Auditが`GCI-POSIX-PRECHECK-001` Majorにより`Fail`であった。3結果とseverityは個別履歴として保持するが、監査集合全体は`Invalidated`であり、現在判定または後続Adapterへ流用しない。3件はいずれも今回変更による新規発生として分類された。

同根原因は、信頼できるFilesystem分類が成立する前に全非Windows Rootへmode観測を発火させ、さらにraw UID／mode観測から成功値を生成できるimport可能helperを追加したことである。処置としてraw観測helperと専用試験を削除し、外部または内部callerが観測値からprecheck成功を作るAPIを残さない。POSIX Runtime Root precheck入口はfail-closed実装として保持するが、Windowsではplatform未対応、非WindowsでもFilesystem classifier未実装として、raw入力、Path選択、Path Identity session、`lstat`／`realpath`／`open`／`fstat`、process identityおよびmode観測より前に固定理由で`blocked`へ閉じる。非opt-inは引き続き`not_evaluated`とする。

公開contractはprecheck入口=`implemented_fail_closed`、mode観測=`not_implemented`、Filesystem class確認=`not_implemented`へ分離する。旧`implemented_candidate_observation_only`、`passed_candidate`またはPOSIX mode観測済みという現行表現を利用側から除去する。Root Protection Policy、Runtime Root Path Identity、doctor、READMEおよびThreat Modelを同義に更新する一方、CLI、activation、transition、local exclude、Authority Root、File Bundle、ProviderまたはOperationへ新しい発火を追加しない。Path／UID／GID／mode／raw error非出力、Filesystem Effect／Capability非発行、Gate `blocked`および非Release境界を維持する。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前は未`Resolved`とする。

固定Commit `ad991c4ec52839f9769997abbdcb2e59fd6662b9`／Tree `4ad3cb85af2a00e1a7c61d4864c928e001fd94c8`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `191 / 191 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`AG-POSIX-PRECHECK-001`、`DOC-POSIX-PRECHECK-001`および`GCI-POSIX-PRECHECK-001`はこの固定範囲で`Resolved`と判定する。旧`dfd1810`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_ad991c4.md`](Evidence/CHG-000015_Current_Review_Record_ad991c4.md)へ接続する。

確認済み範囲は、trusted Filesystem分類前の入力／Path／Filesystem API非発火、raw観測成功APIの削除、contract／doctor／文書のfail-closed投影およびEffect／Capability非発行に限る。実POSIX mode／ACL、Windows DACL、persistent volume分類、principal binding、Path Adapter、activation、Capability、Provider／Operationは未実装または未評価で、Gateは`blocked`を維持する。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labは、ローカル利用者へOS別の複雑さを繰り返し要求しないオンボーディングUXを承認した。機能を使わないRepositoryにはRuntime固有Effectを発生させず、最初の有効なPlatform ProvisioningだけでOS権限確認、署名済みhelper確認および共有Authority Root準備を行う。その後はRepositoryごとの`coordinator activate`一回を入口とし、有効で再識別可能なProvisioning／activationとRoot保護Identityが維持される間、通常実行または再起動ごとに管理者権限、Path再入力またはACL手動設定を要求しない。権限または実体の変化時はfail closedで再確認または再Provisionを案内し、自動修復しない。

今回の実装範囲は、この承認内容を`describeRuntimeActivationContract()`が所有するpureなオンボーディングcontract候補とdoctor投影へ固定するところまでである。無効時の非発火、初回setup目標、共有Authority Provisioning scope、Repository単位の一command入口、専用Platform ProvisionerをEffect ownerとする境界、通常実行／再起動の目標UX、reverification／reprovision triggerおよび未実装状態を別軸にする。Runtime自身はRoot作成、chmod／chown、ACL／DACL変更を行わない。

「初回だけ」は一生に一度という意味ではなく、有効なProvisioning記録、helper／署名／Trust、principal、Root Identityおよび保護契約が維持される期間を意味する。helper／署名／Trust、principalまたは保護metadataの変化は再確認対象、Root欠落／置換、writer／read-only保護不一致またはAuthority Root Identity変更は再Provision対象とする。現行Authority RootはCLIまたは環境による明示絶対Pathを引き続き要求し、将来のProvisioning記録からのresolverと優先順は未実装である。Platform Provisioner検証／Effect、Provisioning記録、Root Effect、activation Effect、Capability、ProviderおよびOperationを今回発火しない。CLI grammar、Root選択、Root Protection Policy、transition、local excludeおよびFile Bundleの意味は変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の全体Checkerおよび3独立監査前に利用可能なsetup、有効化、Runtime完成またはReleaseへ用いない。

固定Commit `b6ed005c2cf862bd2e3a19c6134d1ec470f4369a`／Tree `475808d1849bbf730b81454751d2cf232e47c40c`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-ONBOARDING-001`）、Document Auditが`Fail`（Major `DOC-ONBOARDING-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。2 Findingはいずれも今回変更で新規発生し、Root Identity変化をreverification triggerとreprovision triggerの双方へ所属させた同根原因である。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

統合修正は、reverificationを変化検知時のfail-closed入口、reprovisionを再確認後の確定条件へ二段階化する。`reverificationTriggers`はhelper／署名／Trust、principal、Root Identityまたは保護metadataの変化を検知する契機、`reprovisionConditions`は再確認によってRoot欠落／置換、writer／Runtime read-only保護不一致、または将来の検証済みProvisioning記録に対するAuthority Root Identity不一致を確定した場合だけ成立する条件とする。判定不能時は`blocked`、自動修復なしを維持する。Provisioning記録検証とresolverは未実装のため、現在この条件を観測済みまたは成立済みとしない。README、Threat Model、contract、doctor投影および両試験へ直接伝播した。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に両Findingを`Resolved`としない。

固定Commit `36be2f39c453cbad90031288232b0b38db3ed95c`／Tree `8831df1aa7306aaf91049c8e7f4f26e706ffbc24`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `191 / 191 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`AG-ONBOARDING-001`および`DOC-ONBOARDING-001`はこの固定範囲で`Resolved`と判定する。旧`b6ed005`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_36be2f3.md`](Evidence/CHG-000015_Current_Review_Record_36be2f3.md)へ接続する。

確認済み範囲はpureな目標contract、二段階の再確認／再Provision条件、直接利用側への投影、明示Authority Root Path、非Effect／Capability非発行およびGate `blocked`に限る。実Platform Provisioner、署名／Trust、Provisioning記録、Authority Root resolver、OS別ACL／DACL、Root／activation Effect、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

ユーザー承認後の次段階について、着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合した。Provisioning Receipt、署名helper ManifestまたはAuthority Root resolverのSchema／codecは、正本、Trust、保存、失効、優先順および移行が未決であり、追加の人間判断なしに先取りしない。安全側の共通範囲として、`describeRuntimeActivationContract()`が既存未実装軸から派生するオンボーディング準備状態だけを所有し、新module、入力、LifecycleまたはAuthorityを作らない。

派生投影は共有Authority RootのPlatform scopeとRepository Runtime Rootのactivation前提を区別し、準備状態を`blocked`とする。阻害依存はPlatform Provisioner検証／Effect、Provisioning記録contract／検証、Authority Root resolution、Root Protection Platform Adapter、Runtime／Authority Root Provisioning Effect、activation Effect、Path Identity結合、原子的永続化およびrun-scoped Capabilityへ全数対応する。doctorは同じcontractを直接投影し、両試験で対象2件、状態および依存全件を固定する。README／Threat Modelへ、この一覧が実装順、Provisioning成立、Authority、CapabilityまたはReleaseではなく、Receipt／Manifest／resolver Schemaへ未着手の現在境界であることを伝播した。CLI、Root選択、Root Protection判定、Authority File Bundle、transition、local exclude、Provider／Operationは入力または発火を増やさないため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の独立確認前に準備完了または利用可能としない。

固定Commit `7a87805484cfc913a87fb41aa07b23d343be6d4d`／Tree `baf52bbc51000c1f86f2e264d1f175dcd9d698fc`の監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Fail`（Major `DOC-ONBOARDING-READINESS-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。Findingは今回変更で新規発生し、阻害一覧を既存実装状態から導出せず固定配列として第二管理したことが原因である。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

統合修正は、onboarding関係の実装状態とRoot Protection contractを呼出しごとに一度だけprivate snapshotへ固定し、公開field、阻害一覧およびreadinessを同じ値から生成する。各依存には現在のsource値を結合するが、明示的に承認されたreadiness十分値はまだ存在しないため、候補値、未知値または一部実装で阻害項目を除去しない。Root Protection複合依存はWindows DACL、POSIX owner／mode、POSIX ACL、Runtime principal binding、persistent volume、Filesystem class、Path binding、activation integrationおよびActivation側owner／ACL確認の全軸へ結合する。配列はfreezeし、阻害0件でも現版は`not_implemented`で`ready`へ昇格しない。README、Threat Model、contractおよび試験へ伝播した。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前にFindingを`Resolved`としない。

固定Commit `c326b7aa11629fbf4755c0931e15765a9a3102bf`／Tree `03b4603f0f89bbba56e1f82b63e8dfe7f5099109`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `191 / 191 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`DOC-ONBOARDING-READINESS-001`はこの固定範囲で`Resolved`と判定する。旧`7a87805`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_c326b7a.md`](Evidence/CHG-000015_Current_Review_Record_c326b7a.md)へ接続する。

確認済み範囲は既存状態からの派生readiness、2 target、12 dependency mapping、Root Protection 9軸、非Effect／Capability非発行およびGate `blocked`に限る。readiness十分値、Receipt／Manifest／resolver Schema、実Provisioner、OS別権限Adapter、Root／activation Effect、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は次のオンボーディング方針を承認した。公式署名済みPlatform ProvisionerをCoordinatorと共に配布し、有効なProvisioning Identityが維持されるPlatform scopeでは初回setupだけに管理者操作を集約する。共有Authority Rootの明示Pathと保護情報は将来の検証済みProvisioning Recordへ結合し、Repositoryごとは`coordinator activate`一入口でRuntime Rootを準備する。通常runでは記録、Trust、principal、両Root Identity／保護およびactivationを再確認し、不変なら管理者昇格、Path再入力またはACL手動設定を繰り返さない。ローカルのRuntime principalは選択利用者、serverは専用サービスアカウント（service account）とし、変化または不明はfail closedとする。オンボーディング準備状態は12実装依存の充足と対象runの現在根拠確認を両方満たす場合だけ`ready`候補とする。

着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合し、今回の編集を`describeRuntimeActivationContract()`が所有するpureな方針contractとdoctor投影に限定した。正本はPlatform scope、Repository activation入口、Runtime principal 2種、検証済み記録からの明示Authority Root Path再利用目標、runごとの再確認および二層ready規則を固定する。現行Authority Root選択はCLI、環境の順を維持し、Provisioning Record／Receipt／ManifestのSchema、署名algorithm／Trust Anchor、保存Path、resolver優先順、OS別ACL／DACL、十分値、ready遷移またはCapabilityを推定しない。README、Threat Modelおよび両試験へ直接伝播し、CLI、Root selector、Root Protection判定、File Bundle、transition、local exclude、Provider／Operationは入力または発火を増やさないため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前にProvisioning成立、Authority、Capability、Runtime完成またはReleaseへ用いない。

固定Commit `2d9df2a0189d06e60e7f5e55f3696f87a2de0e54`／Tree `1f935a3abd033e129b10dd48ecd85f97fe49c1e3`の監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（Minor `DOC-ONBOARDING-POLICY-001`および`DOC-ONBOARDING-TERMS-001`）、Gap／Impact＋Conformance Auditが`Fail`（Minor `GCI-ONBOARDING-POLICY-001`）であった。DOC-ONBOARDING-POLICY-001とGCI-ONBOARDING-POLICY-001は、12実装依存の充足をcurrent-run evidenceにも重複させた同根原因で、今回変更による新規発生である。DOC-ONBOARDING-TERMS-001も今回変更で新規発生し、Provisioning Record、Provisioning Receipt、署名helper ManifestおよびAuthority File Bundle Manifestの関係を未定義のまま新語を導入したことが原因である。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

統合修正は、current-run evidenceから実装依存の重複1件だけを除き、12件の実装依存と6件の対象run根拠を`onboardingReadyRule`でAND結合する。また、Provisioning Recordを将来のPlatform setup結果を再識別・再検証する記録目標とし、Provisioning Receiptおよび署名helper Manifestとの同一性、包含関係または構成は未決、Authority File Bundle Manifestは既存の別成果物で代用・流用しないというpureな関係表示を追加した。Schema、codec、保存、署名入力、Authorityまたは新blockerは追加しない。README、Threat Model、contractおよび両試験へ伝播し、人間向け初出を専用サービスアカウント（service account）へ揃えた。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前にFindingを`Resolved`としない。

固定Commit `d3551f771e7054f8f4bc1d78af328346266858a7`／Tree `ef1bd35d74e5aa13f8536ebc6316edd9b6b57d1a`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-ONBOARDING-TERMS-R01`）、Document Auditが`Conditional`（Minor `DOC-ONBOARDING-R01`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。両Findingは同じCHG直接利用側に残った英語偏重の旧表示というlocale-first未適用を原因とする。Agentは既知Findingの未完了利用側として新規候補4分類へ加算せず、Documentは初回監査時から存在した見落としとして分類した。各分類を個別結果として保持し、集合全体を`Invalidated`として現在判定へ流用しない。

統合局所修正は、該当1句だけを`専用サービスアカウント（service account）`へ置換し、README／Threat Modelと揃える。コード値、6件のrun根拠、12件の実装依存、二層ready規則、4成果物関係、Authority／Effect／Capability／Gateおよび非Release境界は変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に両Findingを`Resolved`としない。

固定Commit `9824b4d9f0a44bcbfa7407bb93775e0d3a5b0291`／Tree `836772297e452f9083c0b47a321a1e3fb0c98412`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `191 / 191 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`AG-ONBOARDING-TERMS-R01`および`DOC-ONBOARDING-R01`はこの固定範囲で`Resolved`と判定し、既知`DOC-ONBOARDING-POLICY-001`、`DOC-ONBOARDING-TERMS-001`および`GCI-ONBOARDING-POLICY-001`の解消も維持する。旧`d3551f7`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_9824b4d.md`](Evidence/CHG-000015_Current_Review_Record_9824b4d.md)へ接続する。

確認済み範囲は承認済みオンボーディング方針のpure contract、6件／12件の二層ready条件、4成果物の関係表示、明示Authority Root Path、非Effect／Capability非発行およびGate `blocked`に限る。Provisioner Trust、Provisioning成果物Schema／保存／Lifecycle、resolver、OS別権限Adapter、readiness十分値、Root／activation Effect、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、初回`activate --authority-root`後の通常利用でPath再入力を繰り返さないため、Repository直下の固定`.crdd-runtime/authority-root-locator.json`へ資格情報を含まないAuthority Root検索票（Authority Root Locator）を置く方針を承認した。選択Runtime Rootが外部overrideでも検索票配置は移動しない。検索票はRepository／Runtime Root／Authority Root／Provisioning RecordのIdentity Hashと、現在activationのID／revision／canonical record Hashを結ぶ信用前の検索ヒントである。端末固有の絶対Pathを含む保護対象metadataとして扱い、別PC、改変、移動またはIdentity不一致ではfail closedで再Provision／再activationへ戻す。

着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合し、今回の実装をlocator revision `1`のpure canonical Core候補へ限定した。exact plain-dataと11 field、8192 byteのraw上限、4096 byteの絶対Path上限、current platformのcanonical Path文法、lowercase SHA-256、activation ID／revision／record Hash、strict UTF-8およびcanonical JSON完全一致を検査する。公開結果は安全な要約と内容Hashだけで、Path、raw recordまたはcanonical byteを保持／出力しない。検索票はProvisioning Record、Provisioning Receipt、署名helper ManifestおよびAuthority File Bundle Manifestとは別成果物で、いずれのAuthorityも代用しない。

Filesystem探索／読取り／書込み、原子的永続化、resolver、Provisioning Record検証、Root Identity／owner／ACL、active activation結合、Capability、ProviderおよびOperationは未実装である。locator Core候補は既存12阻害依存を解除せず、CLI grammar、Root selector、Root Path Identity、local exclude、activation transition、File Bundle、Trust／GrantおよびProvider／Operationは入力または発火を増やさないため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前に検索票永続化、Authority Root解決、activation成立、Capability、Runtime完成、採用、準拠、移行、StableまたはReleaseへ用いない。

固定Commit `8da4514550359fc01d87f7164b76c07efbb53bc8`／Tree `82a07d3d4f735e1f5e2e5e96c0dffec5e9424e57`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-AUTH-LOCATOR-001`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Fail`（Minor `GCI-AUTH-LOCATOR-001`）であった。両Findingは今回変更による新規発生である。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

`AG-AUTH-LOCATOR-001`への処置として、Windows Path候補を大文字drive letterのdrive-absoluteかつ保守的なcanonical lexical subsetへ限定する。drive prefix以外のcolon／ADS、`< > " | ? *`、segment末尾dot／space、`CON`／`PRN`／`AUX`／`NUL`／`CLOCK$`／`CONIN$`／`CONOUT$`／`COM1-9`／`LPT1-9`の大小文字・拡張子付き別名を拒否し、UNC／device namespace、dot segment、非canonical separatorおよび末尾separatorの既存拒否を維持する。`CONSOLE`、`COM0`／`COM10`および`LPT0`／`LPT10`をprefix一致だけで誤拒否しない。これはlexical候補判定であり、実在性、case／Unicode alias、Filesystem class、link／reparse、Identity、ownerまたはACLを確認せず、Windows serverのUNC／network Pathを対応済みとしない。

`GCI-AUTH-LOCATOR-001`への構造処置として、同じprivate locator contract snapshotのFilesystem read、resolver、Provisioning Record検証、Authority Root Identity検証およびactive activation結合を既存`authority_root_resolution_from_provisioning_record` dependencyへ、Filesystem writeとatomic persistenceを既存`activation_atomic_persistence` dependencyへ追加する。第13 blockerを作らず、12 blockerの名称／順序、6 run根拠、二層ready規則、十分値未承認、ready遷移未実装を維持する。公開contractとdoctor試験はlocator 7軸が未実装で対応する2 blockerが残る現在状態を固定するが、全依存の十分値が未定義であるため、この出力試験だけを将来の因果接続証明には用いない。両処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に両Findingを`Resolved`としない。11 field、locator revision `1`、Path／raw record／canonical byte非出力、固定Repository配置、非Effect／Authority／Capability、Gate `blocked`および非Release境界は変更しない。

固定Commit `c30272500761724f2d59844544f7d0afd815eb44`／Tree `086b753c891e5fc20f35ed4e1785590395901d81`の再監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Fail`（Minor `GCI-AUTH-LOCATOR-R01`）であった。`GCI-AUTH-LOCATOR-001`の構造解消とSecurity側の既知解消条件は確認されたが、R01はWindows予約device basenameの既知母集団に含まれる`COM¹`／`COM²`／`COM³`および`LPT¹`／`LPT²`／`LPT³`が候補化される部分未解消である。新規候補4分類へ重複加算しない。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

局所処置として、COM／LPTの番号suffixだけへASCII `1-9`に加えてU+00B9、U+00B2およびU+00B3を明示追加し、大小文字と拡張子付き別名も拒否する。入力全体のUnicode正規化は行わず、`CONSOLE`、`COM0`／`COM10`、`LPT0`／`LPT10`およびU+2074付き名称を誤拒否しない。拒否結果へPathまたはraw入力を含めない。README／Threat Modelの「予約device basenameとその拡張子付き別名」という現在契約はこの母集団を包含するため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前にR01または既知AG Findingを`Resolved`としない。locatorの他のPath境界、7軸と既存2 dependencyの結合、12 blocker／6 run根拠、非Effect／Authority／Capability、Gate `blocked`および非Release境界は変更しない。

固定Commit `0c709c2c63faf789f6d9052981426dcd1341a23b`／Tree `eac5a3ee75e8a02d070adbef2f92c8cb044668b6`を対象に、Agent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditを新規に実行し、3件とも`Pass`、Finding `0`を得た。共通入力はCoordinator `197 / 197 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0`／Warning `0`、diff／worktree cleanである。`AG-AUTH-LOCATOR-001`、`GCI-AUTH-LOCATOR-001`および`GCI-AUTH-LOCATOR-R01`はこの固定範囲で`Resolved`と判定する。旧`c302725`以前の監査集合は履歴として保持し、現在判定へ流用しない。現在記録は[`CHG-000015_Current_Review_Record_0c709c2.md`](Evidence/CHG-000015_Current_Review_Record_0c709c2.md)へ接続する。

確認済み範囲はlocatorのpure canonical Core候補、固定Repository配置、Windows／POSIX lexical境界、Path非出力、locator未実装7軸と既存2 dependencyの接続、12 blocker／6 run根拠、成果物分離、非Effect／Authority／CapabilityおよびGate `blocked`に限る。Filesystem persistence／resolver、Provisioning Record／Root Identity／active activation実検証、OS別Path／ACL、readiness十分値、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、将来の署名・Trust検証済みProvisioning RecordをAuthority Root再利用判断の正本とし、Authority Root検索票はそのHashを参照する信用前の成果物とする方針を承認した。初版activationと検索票は同じ原子的更新として成立させ、一部更新、Hash／Identity不一致または再識別不能ではfail closedとし、自動修復せず再Provisionへ戻す。Provisioning Recordの具体Schema、署名algorithm／Trust Anchor、保存／Lifecycle、transaction／journal／rollback／recovery方式、disable／再activation時の検索票処置およびOS別権限方式はこの承認に含めない。

着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合し、今回の実装を新しい永続transaction成果物ではなく、有効activation–検索票結合候補（Active Activation–Locator Binding Candidate）のpure比較Coreへ限定した。既存transition Coreが認める前版なしの初版`active`だけを対象に、Repository／Runtime Root Identity Hash、activation ID／revisionおよび再計算activation record Hashの5項目を既存canonical Coreから比較する。一致しても結果は`candidate`であり、Path、raw record、canonical byteまたはIdentity値を公開せず、Provisioning Record検証、Filesystem read／write、原子的永続化、crash recovery、実active binding、AuthorityおよびCapabilityを成立させない。原子的更新は承認済み目標contractだけを投影し、transaction ID、journalまたは新Schemaを作らない。未実装軸は同じimplementation snapshotから既存`authority_root_resolution_from_provisioning_record`および`activation_atomic_persistence`へ接続し、第13 blockerを追加せず12 blocker、6 run根拠、二層ready規則およびGate `blocked`を維持する。CLI、Root selector／Path Identity、activation transitionの意味、Provisioning Record／Receipt／helper Manifest、Authority File Bundle、local exclude、Provider／Operationは入力または発火を増やさないため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前にBinding成立、原子的永続化、Authority、Capability、Runtime完成、採用、準拠、移行、StableまたはReleaseへ用いない。

固定Commit `485a128d1d20534d71ebb2147c8299e3d1ad0ce4`／Tree `9a9abfffdbbbb7cf6f50ca01f76c3c5352c25b6e`の監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（Minor `DOC-ACTIVATION-LOCATOR-001`）、Gap／Impact＋Conformance Auditが`Fail`（Minor `GCI-ACT-LOC-BIND-001`）であった。後2件は、5つのbinding fieldを実比較と公開contractで別々に列挙した同じ根本原因で、今回変更によって新たに発生した。集合全体を`Invalidated`とし、各結果は履歴として保持するが現在判定へ流用しない。

統合修正は、凍結した`RUNTIME_ACTIVATION_LOCATOR_PAIR_BINDING_FIELDS`をbinding contractの単一正本としてnamed exportし、公開contract、locatorのexact input Set、比較反復および試験母集団を同じ配列から派生させる。5項目の内容／順序、初版限定、locatorの11-field Schema、Path／raw／canonical byte／Identity非出力、12 blocker／6 run根拠、非Effect／Authority／Capability、Gate `blocked`および非Release境界は変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に両Findingを`Resolved`としない。

新固定Commit `597d0def80a81d4ed756167ad864f6216f843e36`／Tree `12f81bb8fab5515d6d23a14bf2ee39c6d91fdb08`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`DOC-ACTIVATION-LOCATOR-001`および`GCI-ACT-LOC-BIND-001`はこの固定範囲で`Resolved`と判定する。旧`485a128`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_597d0de.md`](Evidence/CHG-000015_Current_Review_Record_597d0de.md)へ接続する。

確認済み範囲は初版activation–locator pure内容比較、5 field単一正本、情報非出力、原子的更新目標、不一致時fail closed、12 blocker／6 run根拠、非Effect／Authority／CapabilityおよびGate `blocked`に限る。Provisioning Record Schema／署名／保存／Lifecycle、実Filesystem／atomic writer／crash recovery、resolver、Root Identity／ACL、disable／reactivation locator Lifecycle、ready遷移、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、将来のProvisioning RecordをPlatform scopeのRuntime向け信用判断を担う中心成果物とし、Provisioner Identityと署名metadataをRecordへ結合し、セキュリティ上重要な全項目を一つのcanonical JSON署名対象へまとめる方針を承認した。署名値の物理配置またはenvelope形式は未決であり、署名値自体を循環して署名対象へ含めない。Provisioning Receiptと独立helper Manifestを別のRuntime Authority成果物として要求せず、Authority File Bundle Manifestは既存の別成果物として分離する。Trust AnchorはCoordinatorと共に配布するQual-Lab公開鍵集合を将来使用し、複数key ID、切替時の重複期間および明示失効による旧鍵拒否を必須方針とする。Record正本は共有Authority Rootと同じPlatform scopeで管理者／provisioner write、Runtime read-onlyとし、RepositoryはLocatorにRecord Hashだけを持つ。初回setup／再設定は明示CLI、通常runは検証済みRecord＋Locator、環境変数は互換／自動化向け明示overrideとし、不一致、欠落、失効または再識別不能ではsilent fallbackせず`blocked`として再Provisionへ戻す。

着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合し、今回の編集を`describeRuntimeActivationContract()`が所有する入力なし・Effectなしの凍結Provisioning Record Trust／Selection方針投影へ限定した。既存の関係表示はRecord中心、Receipt／helper Manifest非Authority成果物およびAuthority File Bundle Manifest別成果物という承認済み関係から派生させる。Record Schema／codec、canonical JSONの厳密規格、署名algorithm／encoding、鍵形式／key ID、失効Schema、保存Path／履歴／recovery、resolverの厳密precedence、OS別ACL／DACL、Filesystem read、Lifecycle永続化、ready十分値、AuthorityおよびCapabilityは推定・実装しない。12 blocker、6 run根拠、二層ready規則、現行CLI→環境、Gate `blocked`を維持し、Locator、Trust Loader、Authority File Bundle、Prelaunch Verifier、CLI selector、Provider／Operationは入力または発火を増やさないため変更不要である。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前にProvisioning Record成立、Trust検証、Authority Root解決、Filesystem Effect、Capability、Runtime完成、採用、準拠、移行、StableまたはReleaseへ用いない。

固定Commit `a08cf3c692934bd9c63dce9cc362bb925402dbc4`／Tree `2fe423b2d7f68155c8a2c104bd4e1d000b85fe5a`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-PROVISIONING-RECORD-001`）、Document Auditが`Fail`（Major `DOC-PROVISION-001`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-PROVISIONING-RECORD-001`）であった。前2件は修正起因、Gap Findingは今回変更で新規発生として各監査の分類を個別保持する。3件は、Record中心topologyを採用した一方で旧Receipt名の実装状態／blocker／文書利用側を残し、Record固有のTrust軸を同じreadiness snapshotへ接続しなかった同じ根本原因である。集合全体を`Invalidated`として現在判定へ流用しない。

統合構造修正は、private実装状態をProvisioning Record contract、Record verification、Trust Anchor集合、失効評価、Filesystem読取りおよびLifecycle永続化の6軸へ分け、同じsnapshotから方針投影とreadinessを生成する。12 blockerの位置と総数を維持し、旧`provision_receipt_contract`／`provision_receipt_verification`を`provisioning_record_contract`／`provisioning_record_verification`へ置換する。前者はRecord contractとLifecycle、後者はRecord verification、鍵集合、失効評価およびRecord読取りへ結合する。実行するProvisioner実体の署名／Trust検証は`platform_provisioner_verification`の別責務として維持し、生成済みRecordの署名検証と同一化しない。Receiptは別Runtime Authority成果物ではないという関係表示だけに残す。旧「Receipt／helper Manifestとの関係は未決」という過去判断は後続の人間承認によりsupersededされ、現在判定へ使用しない。6 run根拠の末尾も独立helper成果物ではなくPlatform Provisioner署名／Trust等の不変性を一意に示す名称へ更新する。README、Threat Model、contractおよびdoctor試験へ全数伝播するが、Schema、暗号方式、鍵形式、保存Path、resolver、Effect、AuthorityまたはCapabilityは追加しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に3 Findingを`Resolved`としない。

固定Commit `94d23244064b7676916ce87fadaa42c161686887`／Tree `9b0dae2f1bafecb7a9e48c8f3718ae2ade3c1f5e`の再監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（Minor `DOC-PROVISION-R01`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。主要な`AG-PROVISIONING-RECORD-001`、`DOC-PROVISION-001`および`GCI-PROVISIONING-RECORD-001`の構造解消条件は確認されたが、R01はThreat Modelの現在契約1段落に残った単独`helper`表現が独立helper成果物にも読める直接利用側の部分未解消である。R01を既知Findingの部分未解消として新規候補4分類へ重複加算せず、集合全体を`Invalidated`として現在判定へ流用しない。

統合局所修正は、同段落の`helper／署名／Trust`を`Platform Provisionerの署名／Trust`へ、`Directoryやhelperの存在またはcaller claim`を`Directory、Platform Provisionerの存在またはcaller claim`へ置換する。Provisionerの存在だけをProvisioning成立へ流用しない文脈を維持する。過去CHG／Evidenceの歴史的`helper`表現は改変せず、コード、README、Record固有6軸、12 blocker、6 run根拠、Receipt／File Bundle境界、Authority／Capability非発行、Gate `blocked`および非Release境界を変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前にR01または既知Findingを`Resolved`としない。

固定Commit `710b274369f93548f7dadf027ef820d1fecfc6d8`／Tree `6e1964bc05d11ad0bb623f8cd3ba7bccbbdba9db`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`DOC-PROVISION-R01`、`AG-PROVISIONING-RECORD-001`、`DOC-PROVISION-001`および`GCI-PROVISIONING-RECORD-001`はこの固定範囲で`Resolved`と判定する。旧`94d2324`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_710b274.md`](Evidence/CHG-000015_Current_Review_Record_710b274.md)へ接続する。

確認済み範囲はProvisioning Record Trust／Selection方針、Record固有6実装軸と2 Record blocker、Platform Provisioner実体と生成済みRecord署名の検証責務分離、Record／Locator／Authority File Bundle Manifestの成果物境界、12 blocker／6 run根拠、非Effect／Authority／CapabilityおよびGate `blocked`に限る。canonical Record Schema、署名対象byte、暗号suite、鍵形式／key ID／失効Schema、保存Path／Lifecycle、resolver、OS別ACL、atomic persistence、readiness十分値、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、Provisioning Record署名の基礎方式としてRFC 8785 JCS、Ed25519、RFC 8410 SPKI DERおよびexact DERのSHA-256由来key Identityを採用し、payloadと複数署名を分離するEnvelope、Qual-Lab同梱鍵集合、鍵切替の重複期間、明示失効および未知／失効／不正／形式不明時のfallbackなし`blocked`を方針承認した。CRDD固有domain separationのexact byte／framing、Record／Envelope／keyset／revocation manifestのexact Schema、key ID表示encoding、署名充足規則および実鍵はこの承認だけでは一意でなく、後続判断として残す。過去の「署名値をRecord内へ置くか分離Envelopeへ置くか未決」という判断はこの後続承認でsupersededされ、現在判定へ使用しない。外部規格の正本、確認日、適用節、採用／非採用範囲および再評価契機は[Threat Modelの外部規格入力](../../tools/coordinator/THREAT_MODEL.md#provisioning-signature-external-standards)を正本入口とする。

着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合し、今回の実装をpureな署名基礎Core候補へ限定した。新Coreはplain JSON値をRFC 8785に従いcanonical化し、Ed25519 SPKI DERをparse後のexact再符号化一致で検査してSHA-256 digestを導出し、caller supplied messageに対するRFC 8032個別署名一致だけを候補評価する。raw JSON decoder、CRDD domain framing、Record payload／Envelope／keyset／revocation Schema、aggregate Record Verifier、Filesystem、resolver、Provisioner起動、Authority、CapabilityまたはProvider／Operationへ接続しない。既存canonical成果物をJCSへ移行せず、12 blocker、6 run根拠、二層ready規則およびGate `blocked`を維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前にRecord検証、Trust、Authority、Capability、Runtime完成、採用、準拠、移行、StableまたはReleaseへ用いない。

固定Commit `2b3522a21ba45c75ba11cbda0a868ec9a18d501c`／Tree `8350421398fb09b28b990b6548ff56862a1bc51f`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-PROVISION-SIG-001`、Minor `AG-PROVISION-SIG-002`）、Document Auditが`Conditional`（Minor `DOC-SIGNATURE-001`）、Gap／Impact＋Conformance Auditが`Fail`（Minor `GCI-PROVISIONING-SIGNATURE-001`、Minor `GCI-PROVISIONING-JCS-002`）であった。Agentのtopology Findingは今回変更で新たに確認対象となった承認伝播未完了、Agent budget Finding、Document FindingおよびGap 2件は今回変更で新規発生として各監査の分類を個別保持する。topology 2件、budget 2件、外部規格追跡1件の3根本原因へ統合し、集合全体を`Invalidated`として現在判定へ流用しない。

統合構造修正は、分離Envelope topologyを署名基礎contractの凍結値1件からactivation policy、doctorおよび文書へ投影し、exact Envelope Schema／encoding／domain／署名充足未実装と分ける。JCS snapshotはarray lengthまたはrecord own-key件数と残node budgetを全descriptor map作成前に照合し、descriptorを個別取得する。bounded writerはproperty名と文字列のescapeを含む実JCS UTF-8 tokenを追加前に計数し、保持chunkと最終Bufferを131072 byte以下へ閉じる。外部規格はThreat Modelの単一表でRFC Editor URL、発行時点、文書区分、適用節、採用／非採用、確認日および再評価契機を所有し、README／CHGは参照だけを持つ。exact Schema、domain bytes、key ID encoding、threshold、Trust／revocation受理を推定せず、12 blocker／6 run根拠、Authority／Capability／Effect、Gate `blocked`および非Releaseを変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に5 Findingを`Resolved`としない。

固定Commit `c5cd5d5f044a94788014f19a4cd2fa498dca9c89`／Tree `5d8df8615afde62fc9e2ee073bf9b68e6ee8f817`の再監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-PROVISION-SIG-R01`）、Document Auditが`Conditional`（Minor `DOC-SIGNATURE-R01`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。Agent Findingは初回レビュー時から存在した見落とし、Document Findingは修正起因として各監査の分類を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。

統合局所修正は、JCS snapshotの訪問済み集合を現在の再帰祖先だけへ限定し、direct／indirect cycleは拒否したまま、非循環の共有参照を出現ごとの別nodeとして再snapshot／再serializeする。共有参照と同値な複製treeのcanonical byte／Hash一致、共有参照によるnode budget迂回不可を試験へ固定する。Threat Modelの外部規格入力見出しは`## 5. 成立性Gate`直下の`###`へ一段だけ訂正し、明示anchor、RFC表およびREADME／CHGリンクを変更しない。既知5 Findingの解消処置、Envelope topology、bounded budget、外部規格正本、12 blocker／6 run根拠、Authority／Capability／Effect、Gate `blocked`および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-PROVISION-SIG-R01`または`DOC-SIGNATURE-R01`を`Resolved`としない。

固定Commit `3f19e2bf51e1e3839776d721534e8aa523961935`／Tree `181613eebb215aefcc4c332525e2f3c778ca2900`の最終再監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-PROVISION-SIG-R02`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。R02は今回修正で新規発生した試験根拠不足として分類し、集合全体を`Invalidated`として現在判定へ流用しない。

R02の局所処置は、同一`{value:null}` objectを2047回参照するarrayを4095 nodeの`candidate`、2048回参照するarrayをlength早期拒否ではなく深部の出現単位node計数による`provisioning_jcs_budget_exceeded`として固定する。両arrayが上限未満のlengthで全要素同一Identityであることを明示し、既存4095／4096 array length早期境界試験と分離する。実装、文書、Envelope topology、bounded writer、外部規格正本、12 blocker／6 run根拠、Authority／Capability／Effect、Gate `blocked`および非Releaseは変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-PROVISION-SIG-R02`を`Resolved`としない。

固定Commit `e4f70692f864ad54d4d18978e52bb0c03b89afa1`／Tree `15956026198501f49026aa500a965ee16ce2d6fd`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-PROVISION-SIG-R02`、`AG-PROVISION-SIG-R01`、`DOC-SIGNATURE-R01`ならびに既知5 Findingはこの固定範囲で`Resolved`と判定する。旧`3f19e2b`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_e4f7069.md`](Evidence/CHG-000015_Current_Review_Record_e4f7069.md)へ接続する。

確認済み範囲はpure署名基礎Core、分離Envelope topology、bounded JCS budget、共有参照／cycle境界、外部規格追跡、12 blocker／6 run根拠およびGate `blocked`に限る。raw decoder、exact domain／Record／Envelope／keyset／revocation Schema、key ID encoding、署名充足規則、実鍵、Filesystem、resolver、OS権限、atomic persistence、Authority、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、セキュリティ境界を維持する条件で次工程を承認した。着手前Agent／Architecture／Security、DocumentおよびGap／Impact＋Conformance観点を統合すると、exact domain byte列、key ID encoding、Envelope／鍵集合／失効一覧Schemaおよび永続化は複数解釈が残るため今回実装しない。一意な共通範囲として、RFC 4648のpaddingなしcanonical base64urlで表したexact 64-byte Ed25519署名を内部で厳格復号して既存個別primitiveへ渡すpure入口と、複数署名をfail closedで扱う目標方針だけを追加する。

署名入口はexact plain-data入力だけを受け、86文字のbase64url alphabet、復号後64 byteおよび再符号化完全一致を要求する。padding、空白、標準base64専用文字、長さ不一致、非canonical pad bitを固定理由で拒否し、署名文字列または復号byteを結果、doctor、log、Evidence、ProviderまたはOperationへ出さない。複数署名の目標方針は、1件以上の既知・非失効・有効署名を必要とし、重複、未知、失効、不正または形式不明なentryを1件でも含む場合は全体をfallbackなしで拒否する。これは実aggregate Verifierではなく、同梱Trust評価も未実装である。key ID、domain、Schema、Filesystem、Authority、Capability、12 blocker、6 run根拠、Gate `blocked`および非Release境界を変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前に`Resolved`、Provisioning Record成立、Runtime完成、採用、準拠、移行、StableまたはReleaseとしない。

固定Commit `6966217fc01db109697fd47b0bfa57f25ee170e6`／Tree `78a8c4eccf8bb7384f4ecb2359664166d9a26a45`の監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（Minor `DOC-SIGNATURE-BASE64-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。Findingは今回変更で新規発生し、READMEとThreat Modelの上流要約が旧来の無限定な「encoding／署名充足規則は未決」を保持したため、実装済み候補の署名値base64url encodingと承認済み目標方針を未決のEnvelope全体／aggregate実判定へ混同したことが原因である。集合全体を`Invalidated`として現在判定へ流用しない。

統合局所修正は、READMEとThreat Modelの現在契約要約だけを同義化する。署名値そのもののpaddingなしcanonical base64urlを実装済み候補とし、未決／未実装範囲をEnvelope全体のexact wire Schema、field名と配置、payload／key ID等の署名値以外のfield encoding、CRDD domain、および承認済みfail-closed目標方針を適用するaggregate実判定へ限定する。コード、RFC表、contract／doctor、86文字／64-byte／再符号化条件、12 blocker／6 run根拠、Gate `blocked`、過去CHG履歴および非Release境界は変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前にFindingを`Resolved`としない。

固定Commit `4ad65cc296763912e67a3d127ec1b88df009ebce`／Tree `242dc2531c315009e16378c66cba71196428efbc`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`DOC-SIGNATURE-BASE64-001`はこの固定範囲で`Resolved`と判定する。旧`6966217`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_4ad65cc.md`](Evidence/CHG-000015_Current_Review_Record_4ad65cc.md)へ接続する。

確認済み範囲はpureな署名値base64url入口、個別Ed25519 primitiveへの内部接続、複数署名fail-closed目標方針、利用側伝播、12 blocker／6 run根拠およびGate `blocked`に限る。exact domain、key ID encoding、Record／Envelope／keyset／revocation Schema、aggregate実判定、実鍵／Trust配布、Filesystem、resolver、atomic persistence、Authority、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

Qual-Labの人間の決定権限者は、Runtime 1.0の実装目標として、準備記録（Provisioning Record）の署名・Trust、Platform scopeとRoot保護、resolver、activation Lifecycleおよびrun-scoped Capabilityの5判断群を一括承認した。第1実装単位では、署名messageをASCII `CRDD\0PROVISIONING-RECORD\0V1\0`、payload JCS byte長の符号なし64-bit big-endian値、payload JCS bytesの順に固定し、鍵識別子をexact Ed25519 SPKI DERのSHA-256 lowercase hexadecimal 64文字とする。準備記録、署名包絡（signature Envelope）、信頼起点鍵集合（Trust Anchor Set）および失効一覧（Revocation Manifest）のrevision 1 exact Schema、Ed25519署名entry、最大180日のRecord期間、Trust epoch、鍵有効期間およびfail-closed集約規則をpure Core候補として実装する。過去のdomain、key ID、Envelope、Record、鍵集合、失効一覧およびaggregate実判定が未決という記述はこの承認でsupersededされ、現在判定へ使用しない。

第1実装単位は、新しいpure Core、既存署名primitiveからの責務参照、Runtime activation contract、doctor、README、Threat Modelおよび試験へ伝播する。caller supplied鍵集合、失効一覧および評価時刻は暗号条件の候補を再現するだけで、Qual-Lab同梱Trust、現在版またはrollback防止を成立させない。実鍵、installation key enrollment、Filesystem read／write、保存、resolver、Platform Provisioner、OS権限、activation persistence、Authority、Capability、Provider／Operationへ接続せず、12 blocker、6 run根拠、Gate `blocked`および非Release境界を維持する。既存activation、Locator、Trust Policy、RegistryおよびFile BundleをJCSへ移行せず、過去candidate成果物を正式Recordへ流用しない。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeの機械確認とAgent／Architecture／Security、Document、Gap／Impact＋Conformanceの3独立監査が完了するまで`Resolved`、Runtime完成、採用、準拠、移行、StableまたはReleaseとしない。

固定Commit `5be85702e9b443e941e010e209f621b293babe75`／Tree `faa35c14f02967d4b560b11146f4324144aa6a7e`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-PROVISION-CORE-001`、`AG-PROVISION-CORE-002`、`AG-PROVISION-CORE-003`および`AG-PROVISION-CORE-004`）、Document Auditが`Conditional`（Minor `DOC-PROVISION-CORE-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。5 Findingはいずれも今回変更で新規発生として各監査の分類を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。

統合修正は、ID／Hash／key IDをprimitive stringへ型確定してから長さと正規表現を検査し、配列を標準`Array.prototype`と連続own data indexへ限定する。domain prefixはimmutable ASCII stringを単一正本とし、署名messageごとにowned Bufferを生成する。SPKI fieldは復号前にexact 59文字、復号後に44 byteとcanonical再符号化一致を要求する。失効一覧へ署名key IDが列挙されていれば`revokedAt`の過去／現在／未来を問わず全体拒否し、予約失効状態を導入しない。READMEとThreat Modelへ、準備記録が`issuedAt < expiresAt`かつ最大180日、集約評価が`issuedAt <= evaluationTime < expiresAt`である境界を同義伝播する。exact Schema、domain値、key ID、上限、sort／JCS、12 blocker／6 run根拠、Authority／Capability／Effect非発行、Gate `blocked`および非Releaseは変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に5 Findingを`Resolved`としない。

固定Commit `d03be5ba59634dd060562f090e4740daf79ca831`／Tree `0780b43c090ba3f0ac3acc56d2cfe195ae84e9a5`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-PROVISION-CORE-001`から`004`および`DOC-PROVISION-CORE-001`はこの固定範囲で`Resolved`と判定する。旧`5be8570`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_d03be5b.md`](Evidence/CHG-000015_Current_Review_Record_d03be5b.md)へ接続する。

確認済み範囲はrevision 1 pure codec、domain／key ID、aggregate暗号条件、未信頼入力／資源境界、時刻／失効規則、12 blocker／6 run根拠およびGate `blocked`に限る。実鍵／enrollment、Runtime所有Trust、rollback防止、Runtime時計、Filesystem、resolver、OS権限、atomic persistence、Authority、Capability、Provider／Operationは未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

### 端末導入鍵と準備認証局の方針投影

Qual-Labの人間の決定権限者は、端末固有の準備記録を製品同梱秘密鍵で署名せず、Platform ProvisionerがPlatform scopeごとのEd25519端末導入鍵（installation key）をOS鍵保管領域、TPMまたはSecure Enclaveで生成・保持し、Qual-Lab準備認証局（Qual-Lab Provisioning CA）が公開鍵へ短期証明書を発行する方針を承認した。Qual-Lab秘密鍵をCoordinator、Repository、Provisioning Recordまたはoffline bundleへ埋め込まず、秘密鍵materialをCoordinator Runtimeの入力、出力または成果物にしない。初回登録は明示オンラインまたは管理者持込みoffline bundleに限定し、silent fallbackを許さない。検証済み登録へ結合された公開鍵だけを将来のRecord署名鍵候補とし、通常runは検証済み登録状態が有効な間networkを要求しない。未知、期限切れ、失効、置換、不一致または再検証不能では`blocked`として再Provisionへ戻し、自動回復しない。

着手前整合確認はAgent／Architecture／Security、Document、Gap／Impact＋Conformanceの3観点を統合した。追加判断なしで一意に実装できる最大範囲を、`describeRuntimeActivationContract()`が所有する入力なし・非Effectの方針投影と未実装依存の接続に限定する。鍵生成、鍵保護確認、登録証明書契約／検証、認証局Trust／失効確認、初回登録交換およびRecord–登録結合検証を同じprivate implementation snapshotへ追加し、既存`platform_provisioner_verification`、`platform_provisioner_effect`および`provisioning_record_verification`のsourceへ接続する。既存12 blockerの名称、順序、件数、6 run根拠、二層ready規則およびready遷移未実装を維持し、第13 blockerを追加しない。

証明書形式、CA署名algorithm／domain／key format／key ID、短期の具体値、更新／overlap／失効／rollback、challenge／nonce／attestation、offline bundle Schema／replay対策、保存Path／Lifecycle／recoveryおよびplatform backend／保護強度は未決であり、今回Schema、codec、decoder、Verifier、network、keystore、Filesystemまたは暗号Effectを作らない。Provisioning pure Core、CLI、Locator、Authority Trust Loader、File Bundle、Prelaunch、Provider／Operationは入力または発火が増えないため変更不要である。方針、doctor、README、Threat Modelおよび試験だけへ同義伝播し、Authority／Capability／Effectを発行せずGate `blocked`と非Release境界を維持する。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeの機械確認と3独立監査が完了するまで`Resolved`、Runtime完成、採用、準拠、移行、StableまたはReleaseとしない。

固定Commit `1325f3a9dc550892b0101270f97aad598328c98f`／Tree `f9e4454920dd032456dcf6665ebe1aa531b17e81`の監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Fail`（Major `DOC-INSTALL-ENROLL-001`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-INSTALL-ENROLLMENT-001`）であった。両Findingは今回変更で新規発生として個別に保持し、集合全体を`Invalidated`として現在判定へ流用しない。Document Findingの原因は、人間承認済みの短期証明書topologyとOS管理鍵保管backend候補群を未決のexact仕様から表示上十分に分離しなかったことであり、承認自体の欠落ではない。Gap Findingの原因は、実行するPlatform Provisioner実体Trustと生成済みRecord署名者のenrollment Trustを同じ`platform_provisioner_verification` sourceへ混在させたことである。

統合修正では、実行するProvisioner実体の署名／Trust検証を`platform_provisioner_verification`単独へ戻し、鍵生成と初回登録交換を`platform_provisioner_effect`、証明書契約を`provisioning_record_contract`、鍵保護、証明書検証、Qual-Lab CA Trust／失効およびRecord–enrollment結合検証を`provisioning_record_verification`へ割り当てる。7未実装軸と阻害依存の関係を一つの凍結された正本からreadinessと公開説明へ派生し、現在値がすべて`not_implemented`でも試験が誤配線を検出できるようにする。12 blockerと6 run根拠の名称、順序、件数は変更しない。

承認済み範囲はEd25519 installation key、OS管理鍵保管境界、OS keystore／TPM／Secure Enclaveというplatform別backend候補群、Qual-Lab Provisioning CAによる短期enrollment certificate topology、明示online／offline初回登録、通常run offline、秘密鍵非埋込み／非出力である。候補群は全環境で同時必須、Runtimeの自由選択／fallbackまたは同等強度確認済みを意味しない。未決範囲はcertificateのexact Schema／wire encoding／field、具体的有効期間、更新／overlap／失効／rollback／replay、platform別backend選択と必要保護強度／exportability、CA署名方式、challenge／attestation、offline bundle、保存Path／Lifecycle／recoveryである。両Findingへの処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`Resolved`としない。Authority／Capability／Effect非発行、Gate `blocked`、非Release境界を維持する。

固定Commit `6b041e1b1daefe27ed12fffb55738d0facc4a171`／Tree `30627686650aacc74b4a9f09b18fe0034ab56c25`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`DOC-INSTALL-ENROLL-001`および`GCI-INSTALL-ENROLLMENT-001`はこの固定範囲で`Resolved`と判定する。旧`1325f3a`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_6b041e1.md`](Evidence/CHG-000015_Current_Review_Record_6b041e1.md)へ接続する。実certificate／CA／keystore／Network／Filesystem／Record結合／Authority／Capabilityは未実装または未評価で、Gate `blocked`を維持する。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

### 端末登録の具体方針と未実装依存の投影

Qual-Labの人間の決定権限者は、登録証明書を独自JCS JSON、CA署名をEd25519、key IDをexact SPKI DERのSHA-256 lowercase hexadecimal 64文字とし、有効期間180日、期限30日前から更新対象、新旧併用期間最大30日とする方針を承認した。期限切れ、失効、rollback、置換、不一致または検証不能は`blocked`とし、更新失敗や登録方式の不成立から別sourceへ無言でfallbackしない。WindowsはCNG／KSP TPM-backed鍵を優先して明示的software KSPを代替候補、macOSはKeychain Secure Enclave-backed鍵を優先してsoftware-backed Keychainを代替候補、LinuxはTPM 2.0を優先してroot-owned software keystoreを代替候補とする。初回setupでは選択backendと確認できた保護強度を表示し、検証済み状態が有効な通常runでは再選択、管理者操作またはnetworkを要求しない。

初回登録は明示オンラインまたは管理者持込みの署名済みオフライン初回登録束に限定する。オンライン方式は一回限りのチャレンジ（one-time challenge）、ノンス（nonce）、プラットフォーム範囲（Platform scope）および端末導入公開鍵（installation public key）を結合する。オフライン束は登録要求ハッシュ（enrollment request hash）、登録証明書、準備認証局チェーン（Provisioning CA chain）、失効スナップショット（revocation snapshot）および束の期限（bundle expiry）を結合する目標とする。束の署名者、署名対象、exact topologyおよび署名充足規則は未実装で、署名らしい値からTrustを推定しない。再送（replay）、別machine、別Platform scopeまたは期限切れ入力を拒否し、onlineからofflineへ自動fallbackしない。秘密鍵materialをCoordinator Runtimeの入力、出力または成果物にせず、Qual-Lab秘密鍵を製品、Repository、準備記録または束へ埋め込まない。

着手前整合確認の統合結果に従い、今回の編集は承認値を`describeRuntimeActivationContract()`の単一private implementation snapshotへ固定し、doctor、試験、READMEおよびThreat Modelへ入力なし・非Effectで投影する範囲に限定する。証明書のexact field Schema／wire encoding／domain bytes、所有証明（proof-of-possession）、チャレンジ有効期間（challenge TTL）、オフライン認証局チェーンのexact topology／署名充足、再送消費台帳（replay ledger）、CA root／intermediate Lifecycle、保存Path／recoveryおよびplatform adapterはなお未決である。このためcertificate／bundle codec、network、keystore、Filesystem、暗号EffectまたはAuthority verifierを実装しない。

鍵生成、オンライン登録、オフライン束取込みおよび自動更新は既存`platform_provisioner_effect`、証明書wire contractとオフライン束contractは`provisioning_record_contract`、鍵保護、証明書／CA Trust／失効、Record結合、platform adapterおよびreplay永続化の検証は`provisioning_record_verification`へ接続する。12 blockerの名称、順序、件数、6 run根拠、二層ready規則およびready遷移未実装を維持する。処置は`Applied`／`Self-checked`であり、新固定Commit／Treeの機械確認と3独立監査が完了するまで`Resolved`、Runtime完成、採用、準拠、移行、StableまたはReleaseとしない。

固定Commit `f8d464fc8cdf61da8aca6474f0a34e20f91452e6`／Tree `77fe8c7e80c9c8a65400cde10e540d6080be595b`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-INSTALL-ENROLL-001`）、Document Auditが`Fail`（Major `DOC-INSTALL-ENROLL-002`、Minor `DOC-INSTALL-ENROLL-003`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。集合全体を`Invalidated`として現在判定へ流用しない。`AG-INSTALL-ENROLL-001`は今回変更で新規発生、`DOC-INSTALL-ENROLL-003`も今回変更で新規発生として保持する。

監査集合の統合時に一次の人間承認を再照合した結果、`DOC-INSTALL-ENROLL-002`が未承認としたオンライン4要素とオフライン束5要素は、いずれも人間が明示承認済みであった。このため当該Findingの配列削除案は受入Oracleの根拠誤認として不採用とし、監査時の`Fail`履歴は保持するが現在の修正対象にはしない。exact field Schema、CA chain topology、署名対象および署名充足規則が未決である境界は維持する。

`AG-INSTALL-ENROLL-001`への処置として、オフライン束が署名必須の目標であること、検証済み自動更新の成功後は利用者／管理者操作を要求しないこと、rollbackを期限切れ／失効等と同じfail-closed対象にすることを契約正本、doctor、試験、READMEおよびThreat Modelへ追加する。`DOC-INSTALL-ENROLL-003`への処置として、人間向け説明の初出を日本語先行にする。両処置は`Applied`／`Self-checked`であり、新固定版の3独立監査前に`Resolved`としない。12 blocker／6 run根拠、非Effect／非Authority／非Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `f39958bbe1c9b71643238454f42651bf357596f8`／Tree `8e004f29cbcc17d93bf0fb9f8d5644bb057868dc`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-INSTALL-ENROLL-001`および`DOC-INSTALL-ENROLL-003`はこの固定範囲で`Resolved`と判定する。`DOC-INSTALL-ENROLL-002`は一次承認Oracleの再照合により修正不要と確定し、元監査の履歴は保持する。旧`f8d464f`以前の監査集合は現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_f39958b.md`](Evidence/CHG-000015_Current_Review_Record_f39958b.md)へ接続する。実certificate／bundle／CA／keystore／Network／Filesystem／Authority／Capabilityは未実装または未評価でGate `blocked`を維持する。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

### プラットフォーム管理者侵害時の検出・停止境界

Qual-Labの人間の決定権限者は、Runtime 1.0のRoot保護について、Windowsの`SYSTEM`／machine AdministratorsおよびPOSIXの`root`を信頼するプラットフォーム管理者境界（Trusted Platform Administrator Boundary）として扱う残存リスクを承認した。通常DACL／ACL／mode上のwriterはRuntime Rootではruntime principal、Authority Rootではprovisioner principalへ限定する。Runtime所有経路がIdentity、保護metadata、署名、Trustまたはactivationの観測可能な変更を検出した場合は`blocked`として再検証し、信頼基盤（trust base）が健全と確認できた場合だけ再Provisionへ進める。健全性を確認できない場合、分類不能な場合、または管理者侵害が疑われる／確定した場合は、同じTrust基盤上の再Provisionへ直接進まず、プラットフォーム復旧（Platform recovery）でTrust基盤を再確立した後だけ再Provisionへ進める。再検証、復旧またはTrust再確立が不能なら`blocked`を維持して人間の決定権限者へ移送し、自動修復やfallbackを行わない。プラットフォーム復旧は将来の人間／Platform運用処置の目標で、現RuntimeのEffect、Capabilityまたは成功状態ではない。いずれの経路でもCapability、ProviderおよびOperationを開始しない。

この判断は、管理者侵害を防止できる、またはOS／kernel／Verifierを完全に支配した攻撃者を必ず検出できるという保証ではない。完全支配下で観測結果や実行コードを偽装される場合は保証対象外とする。正本はRoot Protection契約が所有し、activation contractとdoctorは同じ凍結投影を使用する。12 blocker、6 current-run evidence、Root Protection Platform Adapter未実装、Authority／Capability／Effect非発行、Gate `blocked`および非Release境界を維持する。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeの機械確認とAgent／Architecture／Security、Document、Gap／Impact＋Conformanceの3独立監査が完了するまで採用、Runtime完成、準拠、移行、StableまたはReleaseとしない。

固定Commit `2e8a9df243398afd4776ae3aae9c92ee621c90b8`／Tree `704ffb34c5a08b6280893bca56cc2b27dd5fdfb8`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-ROOT-ADMIN-001`）、Document Auditが`Conditional`（Minor `DOC-ROOT-ADMIN-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定、解消、後続実装またはReleaseへ流用しない。両Findingは今回変更で新規発生した。

統合修正は、観測可能な通常変更を`blocked`、Runtime所有再検証、Trust基盤健全確認後の再Provisionへ限定し、健全性確認不能、分類不能または管理者侵害疑い／確定を`blocked`、プラットフォーム復旧、Trust再確立後の再Provisionへ分離する。旧単一responseは廃止し、分類不能を侵害疑い側へfail closedにする。人間向け初出はプラットフォーム復旧（Platform recovery）へ統一し、復旧自体をRuntime Effect、Capabilityまたは成功状態として実装しない。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-ROOT-ADMIN-001`または`DOC-ROOT-ADMIN-001`を`Resolved`としない。既存writer境界、12 blocker、6 current-run evidence、Authority／Capability／Effect非発行、Gate `blocked`および非Releaseを維持する。

固定Commit `e760d81e8fe59461bde0c7d544332799f2ceb108`／Tree `e3327ce55710a55934137ea70f30580048d3d46e`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-ROOT-ADMIN-R01`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-ROOT-ADMIN-R01`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。Agent Findingは初回固定版から存在した見落とし、Gap Findingは修正起因として各監査の分類を保持する。

局所処置は、正本の観測対象へIdentity、保護metadata、署名、Trustおよびactivationを全数固定し、通常変更をRuntime所有再検証によるTrust基盤健全確認後だけ再Provision可能とする。侵害疑い／確定と分類不能は、プラットフォーム復旧の実施とTrust基盤再確立の確認をともに満たした後だけ再Provision可能とする。復旧の実施だけ、caller claimまたは同じ侵害対象の自己観測だけでTrust再確立と扱わない。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-ROOT-ADMIN-R01`または`GCI-ROOT-ADMIN-R01`を`Resolved`としない。Platform recovery未実装、完全支配時の非保証、12 blocker／6 evidence、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `cedecc3c723f916eaddc3bf6df6cb7c3bd929004`／Tree `f71b87f3fbb9c3ec088b5739492e711010171507`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-ROOT-ADMIN-001`、`DOC-ROOT-ADMIN-001`、`AG-ROOT-ADMIN-R01`および`GCI-ROOT-ADMIN-R01`はこの固定範囲で`Resolved`と判定する。旧`e760d81`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_cedecc3.md`](Evidence/CHG-000015_Current_Review_Record_cedecc3.md)へ接続する。

確認済み範囲はPlatform Administrator Trust Boundary、通常変更／分類不能／侵害疑いのfail-closed分岐、観測5軸、契約投影およびGate境界に限る。実Platform recovery、Trust健全性／再確立Oracle、Windows DACL、POSIX owner／mode／ACL、persistent volume、再Provision Effectおよび完全OS侵害下の検出は未実装または未評価である。本解消はRuntime完成、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。

### Provisioning実装6群の一括承認とcontract固定

Qual-Labの人間の決定権限者は、登録証明書、オンライン登録、署名済みオフライン登録束、CA／失効／rollback、保存／resolver／recoveryおよびOS保護Adapterの6群を一括承認した。登録証明書は既承認のEd25519／JCS、有効期間180日、期限30日前からの更新、新旧overlap最大30日を維持する。オンラインchallengeは10分有効で端末秘密鍵による所有証明成功後に一度だけ消費し、offline bundleは7日有効で一度だけ利用する。CAはoffline rootとonline issuing keyを分離し、issuing key最大365日、切替overlap 30日、失効情報freshness 24時間とする。Trust epoch／revisionとsame-revision Hashの単調floorを要求する。

保存はAuthority Rootのimmutable content-addressed Recordとatomic current pointer、Repositoryのimmutable activation／locator generationとatomic pointerへ分離する。Authority Recordを先に確定し、cross-volume atomicityを主張しない。immutable file fsync、generation directory fsync、pointer temporary file fsync、pointer atomic replace、pointer parent directory fsync、再読取Identity確認を要求し、各fsync、atomic replace、再読取またはIdentity確認のfailure／unknown／mismatch、および結果分類不能では、今回作成済みの成果物と検証済みの既存journalだけを回復用に保持して`blocked`とし、明示的回復を要求する。journal不存在または保持確認不能も`blocked`のままとし、推測rollback、自動retry、旧pointerへのfallbackまたは成功扱いを行わない。disableはinactive locatorをgenerationへ保持し、再有効化は新activation IDを要求する。setupは明示CLI、明示environmentの順、通常runは検証済みRecord＋Locatorだけを候補とし、選択source失敗時に低優先sourceへfallbackしない。

権限Effect ownerは公式署名済みPlatform Provisionerだけで、Runtime自身のpermission mutationを禁止する。WindowsはRuntime Rootをruntime SID read/write、Authority Rootをprovisioner／承認admin write＋runtime SID read-onlyとし、継承および広範write ACEを拒否する。POSIXはRuntime Rootをruntime UID owner／mode `0700`、Authority Rootをprovisionerまたはroot owner＋runtime read/traverse ACLとし、未承認group／other writeを拒否する。local相当の安定Identity、durable atomic replaceおよび同等ACLを実証できないnetwork／removable／special／unknown volumeは`blocked`とする。OS root／SYSTEM／machine AdministratorsのTrust境界と侵害時Platform recovery規則は既存正本を維持する。

今回の実装は、上記承認値を`describeRuntimeActivationContract()`とRoot Protection正本の入力なし・凍結contractへ固定し、doctor、試験、READMEおよびThreat Modelへ投影する範囲である。各成果物のexact field Schema／wire encoding／domain bytes、CA chainのexact topology／署名充足、replay台帳の保存形式、CA実配布LifecycleおよびOS／Filesystem Adapter実装は承認内容から一意に導けないため推定しない。新input、Network、Filesystem、鍵操作、Authority、CapabilityまたはEffectを発行せず、12 blocker、6 run根拠、Gate `blocked`および非Releaseを維持する。処置は`Applied`／`Self-checked`であり、新固定版の機械確認と3独立監査前に採用、Runtime完成、準拠、移行、StableまたはReleaseとしない。

固定Commit `67a85ead8d2266a638ad00c2e4ba0fb307a0e136`／Tree `939b8120d531bc8fe635a5d8148fbc2261538313`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-PROVISION-STORAGE-001`）、Document Auditが`Fail`（Major `DOC-PROVISION-PACKAGE-001`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-PROVISIONING-PACKAGE-001`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。3 Findingはいずれも今回変更で新規発生した。

統合修正では、immutable file、generation directory、pointer temporary file、pointer atomic replace、pointer parent directoryおよび再読取Identityの6段階を順序付きで固定する。各段階の失敗は成果物を保持して`blocked`とし、推測rollbackしない。保存実装軸は同じprivate implementation snapshotへ集約し、Record write／current pointer Effectを`platform_provisioner_effect`、current pointer contractを`provisioning_record_contract`、Record read／Trust floorを`provisioning_record_verification`、Repository generation／recovery journalを`activation_atomic_persistence`へ接続する。contractとEffectを別軸にし、第13 blockerを追加しない。

過去の保存／recovery／disable locator／reactivationが未決という判断は、後続の一括承認により質的契約の範囲でsupersededされ、現在判定へ使用しない。private ownership、期待previous／next Hash、曖昧時の保持＋`blocked`、inactive locator保持および新activation IDは承認済みである。未決のまま維持するのはexact transaction／journal Schema、ID形式、具体配置、具体的回復手順およびPlatform／Filesystem Adapter／Effectである。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に3 Findingを`Resolved`としない。承認済み数値、OS保護、12 blocker、6 run根拠、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `3e66b69eb86eae7f8d07403d162370b1ee3b332d`／Tree `48b6c4669ddd0e6d31f44307bb4e8ffb3891cc3b`の再監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-PROVISION-STORAGE-R01`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。R01は既知`AG-PROVISION-STORAGE-001`の部分未解消として分類する。

R01への局所処置として、6 durability段階のfailure／unknown／mismatch、結果分類不能、journal不存在または保持確認不能を単一responseへ結合する。今回作成済みの成果物と検証済みの既存journalだけを回復用に保持して`blocked`とし、明示的回復を要求するが、推測rollback、自動retry、旧pointerへのfallbackまたは成功扱いを行わない。明示的回復のexact手順とEffectは未実装である。処置は`Applied`／`Self-checked`であり、新固定版の3独立監査前にR01を`Resolved`としない。6段階順序、storage source mapping、12 blocker／6 evidence、OS／数値、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `293a4ab20acdf336d53af39f43ba37ba3b47b8e4`／Tree `cdd99276f682f243f9b3119d6297189a54765b19`の再監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Conditional`（Minor `DOC-PROVISION-STORAGE-R02`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-PROVISION-STORAGE-R02`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。2 Findingは同根かつ既知R01の部分未解消であり、新規候補4分類へ加算しない。

R02への局所処置として、共通failure responseの保持対象を今回作成済みの成果物と検証済みの既存journalだけへ限定し、回復目的以外の利用、推測rollback、自動retry、旧pointerへのfallbackおよび成功分類を禁止する。journalの新規生成、存在または完全保持は保証せず、不存在または保持確認不能も`blocked`とする。`ambiguousRecoveryBehavior`はこの共通responseを参照し、処置を重複所有しない。処置は`Applied`／`Self-checked`であり、新固定版の3独立監査前にR01／R02を`Resolved`としない。6段階順序、storage source mapping、12 blocker／6 evidence、OS／数値、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `2d79391d40400b2c207166f1423ba66295a68d95`／Tree `43b6166d87d05e22f2432b35a7cf8e83eada8ed2`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-PROVISION-STORAGE-001`、`GCI-PROVISIONING-PACKAGE-001`、`DOC-PROVISION-PACKAGE-001`、`AG-PROVISION-STORAGE-R01`、`DOC-PROVISION-STORAGE-R02`および`GCI-PROVISION-STORAGE-R02`はこの固定範囲で`Resolved`と判定する。旧293a4ab以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_2d79391.md`](Evidence/CHG-000015_Current_Review_Record_2d79391.md)へ接続する。

Qual-Labの人間の決定権限者は、オンライン登録challengeの有効期間を10分から30分へ変更した。旧10分値は履歴として保持するが、後続判断によりsupersededされ現在判定へ使用しない。30分はchallenge発行時から登録通信へだけ適用し、利用者への細切れの指示または通常runのNetwork発火を意味しない。challengeはnonce、installation public key、Platform scopeおよび登録要求（enrollment request）へ結合し、最初の検証試行が成功でも失敗でも消費して再利用しない。期限切れは`blocked`として新しいchallengeを要求し、offline方式へ自動fallbackしない。

今回の処置は`onlineChallengeValidityMinutes`を`30`へ更新し、binding、最初の検証試行での消費および期限切れ時のfresh challenge要求を入力なしcontractへ明示する。challenge／requestのexact wire Schema、署名message、Runtime所有clock、サーバ側消費台帳、Network Effectおよび自動再発行処理は未実装である。12 blocker、6 run根拠、offline bundle 7日、証明書180日、更新30日前、overlap 30日、issuing key 365日、失効情報freshness 24時間、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。処置は`Applied`／`Self-checked`であり、新固定版の3独立監査前に採用、Runtime完成、準拠、移行、StableまたはReleaseとしない。

固定Commit `02da76bf35fe66460b07c8789a05472e96efdee3`／Tree `ce24256b62d3d8c00768ca4c54bc13211d8112cf`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-ENROLL-CHALLENGE-001`）、Document Auditが`Fail`（Major `DOC-ENROLLMENT-TTL-001`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-ENROLLMENT-TTL-001`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。

固定された人間決定Oracleは、TTL 30分、一回限り、challenge／nonce／installation public key／Platform scope／登録要求の結合、成功・失敗・期限切れ後の再利用禁止、期限切れ時のfresh challengeおよびofflineへの自動fallback禁止を明示的に含む。Document／Gap Findingの「TTLだけが承認済み」という前提はこのOracleと矛盾するため、監査結果自体は履歴保持するが、修正案は`Not accepted — contradicted by fixed human decision evidence`として現在の修正対象へ含めない。

有効な`AG-ENROLL-CHALLENGE-001`への処置として、`onlineEnrollmentRequiredInputs`へSchema非依存の`enrollment_request_binding`を追加し、正本、doctor、2試験、READMEおよびThreat Modelの現在説明を5要素へ同期する。これはraw request、exact Schema、Hashまたはwireを実装済みとする意味ではない。TTL、消費、bindingおよび期限切れfield、PoP、通常run非発火、exact wire／clock／消費台帳／Network Effect未実装、12 blocker／6 evidence、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-ENROLL-CHALLENGE-001`を`Resolved`としない。

固定Commit `01736ca0f2ce64e174c862c243a2292d907a4265`・Tree `770461589d50a7a4dc47d7ccab0c375c6dbb72b8`の監査集合は、Agent／Architecture／Security Reviewが`Pass`・Finding `0`、Document Auditが`Conditional`・Minor `DOC-ENROLLMENT-LOCALE-001`、Gap／Impact＋Conformance Auditが`Pass`・Finding `0`であった。3結果を個別に保持し、集合全体を`Invalidated`として現在判定へ流用しない。Document Findingは初回固定版から存在した見落としとして分類する。

`DOC-ENROLLMENT-LOCALE-001`への局所処置として、オンライン登録challengeの人間可読な現在説明をlocale-firstへ統一する。READMEおよびThreat Modelでは既出の正式語に従って英語混在表示を`登録要求`へ統一し、CHGの現在判断では初出を`登録要求（enrollment request）`、以後を`登録要求`とする。機械値`enrollment_request_binding`、required inputs 5件、TTL 30分、成功・失敗・期限切れ後の再利用禁止、fresh challenge、PoP、offline fallback禁止、通常run非発火、DOC／GCIの`Not accepted`処置、12 blocker／6 evidence、Gate `blocked`および非Releaseは変更しない。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`Resolved`としない。

固定Commit `7839da46723850427770e7f65607dba657b70ca3`／Tree `72a9e93b4b28c2637f96ce6ecc36ec82f265559c`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-ENROLL-CHALLENGE-001`および`DOC-ENROLLMENT-LOCALE-001`はこの固定範囲で`Resolved`と判定する。旧01736ca以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_7839da4.md`](Evidence/CHG-000015_Current_Review_Record_7839da4.md)へ接続する。

確認済み範囲はTTL 30分、required inputs 5件、成功／失敗／期限切れ後の再利用禁止、fresh challenge、PoP、offline fallback禁止、通常run非発火、locale-first表示および固定Oracleの履歴処置に限る。challenge／requestのexact codec、Runtime所有clock、消費台帳、Network／CA／keystore Effect、Authority、Capability、Provider／Operationは未実装または未評価である。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 2026-08-15 — 初回オンライン登録pure Coreの範囲縮小

人間判断により、登録基盤全体の一括exact化を行わず、本変更を30分のチャレンジ、登録要求の所有証明、登録証明書の署名検査という初回オンライン経路へ縮小した。`initial-enrollment-pure-core.mjs`は、チャレンジのdomain-framed payload Hashを登録要求へ一方向に結合し、Platform scope／Provisioner Identity／端末導入鍵の一致、およびEd25519署名をpureに検査する。旧オンラインexact未決判断はChallenge／Request／Certificateのobject Schema、domain、JCS署名messageおよびpure数学的一致に限って後続判断により置換され、現在判定へ使用しない。raw wire／transport、Runtime時計、一回消費台帳、CA Trust／失効、Network、Filesystem、keystore、Record実結合、証明書更新およびオフライン束は未実装である。候補一致もAuthority、Capability、EffectまたはGateを開かない。処置は`Applied`／`Self-checked`であり、固定改訂版の独立レビューおよび必須監査前は`Resolved`ではない。

固定`4eceef6`の監査集合はAgent／Security `Fail`（Major 2／Minor 2）、Document `Fail`（Major 1／Minor 1）、Gap／Conformance `Fail`（Major 2）で、集合を`Invalidated`として現在判定へ流用しない。同根の処置として、issuer入力の上限前copy除去、nonce canonical再符号化、Request–Certificate一括binding、個別数学的一致と完全条件の分離、pure実装軸から既存2 blockerへの接続、現在文書の実装済み／未実装分離、locale／方向／anchor是正を適用した。新固定版の3監査完了前は各Findingを`Resolved`としない。

固定Commit `4d0b97ac0d3e77deed641afea0ed7470aaca7f44`／Tree `891774c9399fb47aec62e2810d58bc56a4dce631`の再監査集合は、Agent／Architecture／Security Reviewが`Pass`（Finding `0`）、Document Auditが`Fail`（Major `DOC-INITIAL-ENROLL-R01`、Minor `DOC-INITIAL-ENROLL-R02`）、Gap／Impact＋Conformance Auditが`Fail`（Major `GCI-INITIAL-ENROLL-001-R1`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。3 Findingはいずれも既知Findingの部分未解消であり、新規候補4分類へ加算しない。

局所処置は、初回オンラインのチャレンジ、登録要求および登録証明書について、exact object contractと成果物別domain framingを3つの契約sourceへ分離し、既存`provisioning_record_contract`へ接続する。raw byte decoder／transport codecは`not_implemented`として別軸に保つ。登録要求の所有証明、登録証明書署名および初回flow bindingは検証sourceとして`provisioning_record_verification`へ接続する。登録証明書のdomain表示も、初回オンラインexact domainの実装済み候補と更新／他経路の未実装を分離する。READMEとThreat Modelは、初回オンラインobject Schema／domain／JCS messageの実装済み候補と、raw byte decoder／transport、更新、オフライン、CA Trust、時計、台帳およびEffectの未実装を区別し、初出用語をオンライン登録チャレンジ（online enrollment challenge）、登録要求（enrollment request）、登録証明書（enrollment certificate）へ統一する。

本処置は状態と依存関係の構造是正だけであり、新Schema、Network、Filesystem、時計、消費台帳、CA Trust、keystore、Authority、CapabilityまたはEffectを追加しない。既存12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に既知Findingを`Resolved`としない。

固定Commit `4ed69bab34ed18f34f807a680532b278e49cc78d`／Tree `123e98d8941632eec60159ee058aecb74cbd0450`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。初回オンライン登録に関する既知AG／DOC／GCI Findingはこの固定範囲で`Resolved`と判定する。旧`4d0b97a`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_4ed69ba.md`](Evidence/CHG-000015_Current_Review_Record_4ed69ba.md)へ接続する。

確認済み範囲は初回オンラインのobject契約、domain framing、所有証明、証明書署名、flow binding、依存接続および安全なcandidate境界に限る。raw wire／transport、Runtime所有clock、一回消費台帳、実CA Trust／失効、Network、keystore、Filesystem、Record実結合、更新およびオフライン経路は未実装・未評価である。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 2026-08-15 — 初回オンライン登録payload decoder候補

次の実装単位は、初回オンラインのチャレンジ、登録要求および登録証明書という3成果物の署名前payload JSON bytesだけを対象とする。入力はNode `Buffer`に限定し、既存JCS正本の131072 byte上限をcopy前に確認する。BOMを拒否し、strict UTF-8で復号し、既存object normalizerと成果物別domain framingを再利用して、入力bytesとcanonical JCS bytesが完全一致した場合だけartifact Hash候補を返す。object、raw bytes、canonical bytes、ID、Path、SPKIまたはsignatureを公開結果へ含めない。

このdecoderは署名Envelopeまたはtransport codecではなく、数学的署名一致、Runtime所有clock、一回消費台帳、CA Trust／失効、Network、Filesystem、keystore、Authority、CapabilityまたはEffectを成立させない。3 decoder実装軸を既存`provisioning_record_contract`へ接続するが、readiness十分値は未承認のままとし、12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。変更分類は非規範Security Reference Implementation候補で、現在の永続成果物に移行は発火しない。処置は`Applied`／`Self-checked`であり、新固定版の独立レビューおよび必須監査前は`Resolved`ではない。

固定Commit `ce526e2fb588abb3d58fde169c99730e18fc948c`／Tree `afa2a547abb766b6360e2bbc72f3d7ed1e682c8d`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。今回のpayload decoder候補に未解決Findingはなく、この固定範囲を監査済み候補として閉じる。旧`da0dd843`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_ce526e2.md`](Evidence/CHG-000015_Current_Review_Record_ce526e2.md)へ接続する。

確認済み範囲は3成果物の署名前canonical payload Buffer入力、copy前budget、BOM／strict UTF-8／canonical完全一致、artifact Hashだけの安全な結果、依存接続およびGate境界に限る。署名Envelope／transport、Runtime所有clock、一回消費台帳、実CA Trust／失効、Network、keystore、Filesystem、Record実結合、更新およびオフライン経路は未実装・未評価である。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 2026-08-15 — 初回オンライン登録の署名Envelope候補

Qual-Labの人間の決定権限者は、チャレンジを現行payloadのまま維持し、登録要求と登録証明書へ共通topology `{contract, contractRevision: 1, payload, signatures: [{keyId, algorithm: "Ed25519", signature}]}`を採用した。登録要求はpayloadの端末導入鍵IDと一致する署名exact 1件、登録証明書は準備認証局候補SPKIから再計算したkey IDと一致する署名exact 1件だけを受理する。未知、重複、複数、algorithm不一致、key ID不一致または暗号的不一致は`blocked`とする。

今回の実装は`initial-enrollment-pure-core.mjs`を単一正本として、登録要求Envelope contract `crdd-coordinator/initial-enrollment-request-envelope`と登録証明書Envelope contract `crdd-coordinator/initial-enrollment-certificate-envelope`のrevision 1 exact object検査へ限定する。既存のpayload normalizer、成果物別domain framing、Ed25519／SPKI／base64url primitiveを再利用し、旧payload／signature別引数を公開検証経路として残さない。登録証明書のissuer SPKIはcaller suppliedの未信頼候補であり、暗号的一致だけからCA Trustを成立させない。

object Envelope 2軸を既存`provisioning_record_contract`へ接続する。raw Envelope byte decoder、transport、Runtime所有clock、一回消費台帳、CA Trust／失効、Network、Filesystem、keystore、更新およびオフライン経路は未実装のままとする。12 blocker、6 current-run evidence、Authority／Capability／Effect非発行、Gate `blocked`および非Releaseを維持する。変更分類は非規範Security Reference Implementation候補で、現在の永続成果物に移行は発火しない。処置は`Applied`／`Self-checked`であり、新固定版の独立レビューおよび必須監査前は`Resolved`ではない。

固定Commit `27be08b5bebc60b7bf780b0a264b76a2b0ad5216`／Tree `405297576bf7f908c2ebdaa085165029fe5b6e01`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Major `AG-INITIAL-ENVELOPE-001`）、Document Auditが`Pass`（Finding `0`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。Findingは初回固定版から存在した見落としとして分類する。

局所処置は、caller supplied issuer SPKI Bufferをintrinsic byteLengthと既存上限でcopy前に検査し、module-privateのowned Bufferへ一度だけsnapshotする。同じowned BufferだけをDER検査、key ID再計算、Envelope key ID照合およびEd25519署名検証へ使用し、copy後にraw caller Bufferを再参照しない。SharedArrayBuffer-backed入力の並行変更自体の検出は保証しないが、snapshot後の全判定を同一bytesへ時間結合する。Envelope topology、role、domain、公開API、dependency mappingおよび文書意味は変更しない。処置は`Applied`／`Self-checked`であり、新固定版の3独立再監査前に`AG-INITIAL-ENVELOPE-001`を`Resolved`としない。12 blocker、6 current-run evidence、非Effect／Authority／Capability、Gate `blocked`および非Releaseを維持する。

固定Commit `8b979d5252e29c047ecfe9bc7282c54ccc8baa9e`／Tree `11024ece8a497e63e4cc90b0607b39b7197807b5`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-INITIAL-ENVELOPE-001`はこの固定範囲で`Resolved`と判定する。旧`27be08b`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_8b979d5.md`](Evidence/CHG-000015_Current_Review_Record_8b979d5.md)へ接続する。

確認済み範囲はRequest／Certificate object Envelope、署名exact 1件、role／domain結合、issuer単一snapshot、安全なcandidate出力、依存接続およびGate境界に限る。raw Envelope byte decoder／transport、Runtime所有clock、一回消費台帳、実CA Trust／失効、Network、keystore、Filesystem、Record実結合、更新およびオフライン経路は未実装・未評価である。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 2026-08-15 — 初回オンライン登録Envelope raw byte decoder候補

Qual-Labの人間の決定権限者は、登録要求と登録証明書のEnvelope全体を上限131072 byteのcanonical JCS UTF-8として表現し、独自headerまたはlength prefixを付けないraw形式を承認した。decoderはNode `Buffer`だけを受理し、copy前budget、BOM拒否、strict UTF-8、exact Envelope normalizerおよび入力bytesと再生成canonical bytesの完全一致を要求する。成功結果は成果物別payload Hashと安全状態だけで、Envelope、payload、署名、SPKI、ID、raw／canonical bytesまたはPathを返さない。

この実装はraw Envelopeの構造とcanonical encodingだけを候補化し、署名の数学的一致は既存object Verifier、HTTP／file framingやcontent typeは未実装transportの責務に残す。decoder成功からRuntime所有clock、一回消費台帳、CA Trust／失効、Network、Filesystem、keystore、Authority、CapabilityまたはEffectを成立させない。2 decoder軸は同じprivate implementation snapshotから既存`provisioning_record_contract`へ接続するが、12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。旧`8b979d5`以前のraw Envelope未実装という現在説明は本承認範囲でsupersededされ現在判定へ使用しないが、過去の監査・Evidenceは履歴として改変しない。変更分類は非規範Security Reference Implementation候補で、処置は`Applied`／`Self-checked`、新固定版の独立レビューおよび必須監査前は`Resolved`ではない。

固定Commit `799c2c34d9aa3eddd43d8d90602d88dda772b72c`／Tree `c0df1f6812f002c83da3178eca2fe436e09c3242`の監査集合は、Agent／Architecture／Security Reviewが`Fail`（Minor `AG-INITIAL-RAW-ENVELOPE-001`）、Document Auditが`Fail`（Major `DOC-INITIAL-RAW-ENVELOPE-001`）、Gap／Impact＋Conformance Auditが`Pass`（Finding `0`）であった。3結果を個別保持し、集合全体を`Invalidated`として現在判定へ流用しない。Security Findingは初回固定版から存在した見落とし、Document Findingは今回変更で新たに発生した伝播不足として分類する。

統合処置は、payload 3種とEnvelope 2種のBuffer限定、copy前budget、owned copy、BOM拒否、fatal UTF-8、JSON parse、exact normalizer、canonical再生成およびbyte完全一致をmodule-private共通helperへ単一化する。各wrapperは既存成果物別normalizer、domain、reasonおよびHash名だけを所有し、公開汎用API、raw／canonical bytesまたはnormalized objectを追加しない。`onlineChallengeBinding`はChallenge payloadとRequest Envelopeのraw bytesを実装済み候補、transportとEffectを未実装として同じ正本／doctor投影へ同期する。README／Threat Modelは既に同義のため変更しない。Envelope literal、署名exact 1件、object Verifier、issuer単一snapshot、dependency mapping、12 blocker、6 evidence、Gate、Authority／Capability／EffectおよびRelease境界を維持する。両Findingの処置は`Applied`／`Self-checked`であり、新固定版の3監査完了前は`Resolved`ではない。

固定Commit `d1e32cbd9153a3f4af94b251206f48321c9c8b08`／Tree `237a700dee7ae02cc8b16a048437f8ff383f9552`に対するAgent／Architecture／Security Review、Document AuditおよびGap／Impact＋Conformance Auditはすべて`Pass`、Finding `0`であった。`AG-INITIAL-RAW-ENVELOPE-001`および`DOC-INITIAL-RAW-ENVELOPE-001`はこの固定範囲で`Resolved`と判定する。旧`799c2c3`以前の監査集合は履歴として保持するが現在判定へ流用しない。現在のレビュー記録は[`CHG-000015_Current_Review_Record_d1e32cb.md`](Evidence/CHG-000015_Current_Review_Record_d1e32cb.md)へ接続する。

確認済み範囲はRequest／Certificate raw Envelopeのcanonical JCS UTF-8入力、共通private decode境界、成果物別payload Hash、安全なcandidate出力、現在状態投影、依存接続およびGate境界に限る。transport、Runtime所有clock、一回消費台帳、実CA Trust／失効、Network、keystore、Filesystem、Record実結合、更新およびオフライン経路は未実装・未評価である。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持し、Runtime完成、採用、準拠、移行、Stable、Releaseまたは公開を先取りしない。

### 2026-08-15 — Runtime時計とprocess内一回消費Controller候補

人間の指示により、残るProvisioning実装を依存順の複数コミットで進める。第1単位は、Runtime自身が取得するwall clockとmonotonic clockを同時に観測し、同一process内で時計の後退を検出するController、および有効なチャレンジに対する最初の検証試行を成功・失敗のいずれでも消費する上限4096件のprocess内台帳である。期限切れ、未発行、再利用、容量超過または時計の後退は`blocked`とし、期限切れ・再利用・失敗ではfresh challengeを要求する。通常run、doctorまたは暗黙経路から発火しない。

process再起動をまたぐ永続台帳、保存Path、ACL、atomic persistenceおよび複数process間の排他は未実装である。このため成功結果も`persistenceConfirmed: false`のcandidateに限定し、replay防止、Trust、Authority、Capability、Filesystem／Network EffectまたはGateを成立させない。新しいRuntime state contractを既存`provisioning_record_verification` dependencyへ接続するが、`enrollmentReplayProtectionPersistence`は`not_implemented`、12 blockerと6 current-run evidenceは不変とする。本処置は`Applied`／`Self-checked`であり、後続単位を含む固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — 端末導入鍵と準備記録署名のP-256統一

Qual-Labの人間の決定権限者は、OS管理鍵保管との相互運用境界を簡潔に保つため、revision 1の端末導入鍵とProvisioning Record署名をECDSA P-256 with SHA-256へ統一した。公開鍵はRFC 5480のP-256 exact SPKI DER、鍵識別子はそのDERのSHA-256 lowercase hexadecimal 64文字、署名値はlow-Sへ一意化した固定64-byte IEEE P1363形式をpaddingなしcanonical base64urlで表す。登録要求の所有証明とProvisioning Record署名はこの同一algorithm familyを使用する。一方、準備認証局（Provisioning CA）による登録証明書署名は既存Ed25519 roleを維持し、端末鍵またはRecord署名鍵と相互転用しない。

RSA、P-384／P-521、Ed25519端末鍵およびalgorithm fallbackはrevision 1の入力母集団へ含めない。未知algorithm、別曲線、DER形式署名、可変長署名またはrole不一致はfail closedで拒否する。過去の初回オンラインEnvelope節に記録された端末導入鍵Ed25519値は当時の履歴として改変しないが、本後続判断により端末導入鍵とRecord署名の現在判定には使用しない。公開済み／安定成果物への移行はなく、未Releaseのcandidate contractだけを更新する。

今回の実装はP-256 SPKI inspection、ECDSA SHA-256／IEEE P1363個別検証、登録要求所有証明、Provisioning Record codec／aggregate、およびruntime activation／doctor／文書の状態投影に限定する。OS keystore／TPM／Secure Enclaveでの実鍵生成・署名、Runtime所有Trust、CA配布、Filesystem、Network、Authority、CapabilityまたはEffectを成立させない。12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。処置は`Applied`／`Self-checked`であり、後続単位を含む固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — OS鍵保管ポリシーCore候補

第2単位は、端末導入鍵の公開P-256 SPKIとBackend選択だけを扱う非Effectのポリシー正本およびclaim-only評価である。Windowsは`cng_ksp_tpm_p256`、macOSは`secure_enclave_p256`、Linuxは`tpm2_p256`を優先し、各software Backendは初回setupで明示承認されたfallbackだけを候補化する。preferred Backendにfallback承認を付ける入力、未承認fallback、未知Backend、別曲線または不正SPKIは`blocked`とする。RSA、別曲線またはsilent algorithm／Backend fallbackを追加しない。

このCoreは秘密鍵、鍵handle、Pathまたはkey IDを入出力せず、公開SPKIとpolicy選択を検査するだけである。実Windows CNG、macOS Secure Enclave、Linux TPM 2.0、software鍵保護、署名済みPlatform Provisionerとの結合、鍵handle所有証明および実鍵生成／署名Effectは未実装である。policy候補はhardware-backed、非exportable、Trust、Authority、CapabilityまたはEffectを意味しない。新sourceを既存`provisioning_record_contract`へ接続するが、実Adapter検証は`not_implemented`、12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、後続単位を含む固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — 準備認証局chainと失効pure Core候補

第3単位は、caller suppliedのoffline root Trust Set、offline rootが署名するonline／offline issuing key証明書、およびoffline root署名済み失効一覧の暗号条件をpureに再現する。rootとissuing keyはEd25519、key IDはexact SPKI DERのSHA-256 lowercase hexadecimal 64文字とする。issuing roleは`online_enrollment_issuer`または`offline_bundle_issuer`だけ、issuing key期間は最大365日、失効一覧期間は最大24時間とする。失効一覧へroot、失効一覧署名rootまたはissuing keyが列挙されていれば、`revokedAt`を予約発効時刻として扱わず即時`blocked`とする。

正常結果もroot／issuing／revocationの数学的一致候補に限る。caller supplied root集合、評価時刻、epochおよびrevisionをRuntime所有Trust、rollback floor、時計Authorityまたは配布状態へ昇格しない。実Trust Anchor同梱、root rotation、same-revision Hash floor永続化、Filesystem／Network配布およびAuthorityは未実装である。2つのpure sourceを既存Provisioning Record contract／verification dependencyへ接続するが、既存`provisioningCaTrustAndRevocationVerification`は`not_implemented`、12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、後続単位を含む固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — 署名済みオフライン初回登録束pure Core候補

第4単位は、署名済みオフライン初回登録束（signed offline enrollment bundle）のrevision 1 exact object Envelopeと暗号・binding検査である。束はチャレンジ、ECDSA P-256所有証明付き登録要求、そのdomain-framed payload Hash、Ed25519署名済み登録証明書、同一root／CA series／trust epochに属する`online_enrollment_issuer`と`offline_bundle_issuer`のexact 2役、root署名済み失効snapshot、および最大7日の期限を結ぶ。束の期限は内側登録証明書の期限を越えてはならず、評価時刻は両方の半開有効区間内でなければならない。外側Envelopeは`offline_bundle_issuer`のEd25519署名exact 1件を要求し、未知role、別系列・epoch、失効・期限外、要求Hash／Platform scope／Provisioner Identity／端末導入鍵の不一致、内外いずれかの署名不一致をfail closedで拒否する。

入力全体は既存JCS budget内で一度owned plain-data snapshotへ変換してから検証し、caller objectの再読みによる時間差を作らない。正常結果も暗号・binding候補と`consumptionRequired: true`だけであり、caller supplied root集合と評価時刻をRuntime所有Trust、rollback floorまたは時計Authorityへ昇格しない。raw Envelope decoder、transport、process再起動をまたぐ一回消費台帳、Filesystem import、CA実配布およびAuthority／Capability／Effectは未実装である。pure contract／verification sourceを既存2 blockerへ接続するが、12 blocker、6 current-run evidence、Gate `blocked`および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、後続単位を含む固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — 準備記録と登録証明書のpure結合候補

第5単位は、準備記録の暗号条件と登録証明書chainを同一pure判定へ結ぶ。準備記録の各署名key IDには現在有効な登録証明書exact 1件を要求し、全署名を漏れなく結合する。準備記録の`provisionerEnrollmentId`、Platform scope、Provisioner Identity、P-256 SPKI／key ID、およびTrust Anchor entryの`enrollmentCaId`を、登録証明書とonline issuing証明書のCA seriesへ完全一致させる。複数署名時も署名数と証明書binding数を一致させ、重複証明書、未結合署名または余分なbindingを拒否する。

入力Record／Trust Set／失効一覧Bufferはcopy前上限確認後に一度owned copyし、登録証明書とCA成果物もJCS budget内のowned plain-data snapshotへ変換してから既存Record aggregate、証明書署名およびCA chain検証を再利用する。正常結果も暗号・登録結合候補であり、Runtime所有Trust、rollback floor、時計、Filesystem、activationまたはcurrent-run再検証を成立させない。既存`recordEnrollmentBindingVerification`を`implemented_candidate`へ進めるが、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — 登録証明書更新pure遷移候補

登録証明書更新は既存証明書Envelope間のpure遷移として検査する。同じ`enrollmentId`、Platform scope、Provisioner Identity、端末導入鍵IDおよびSPKIを維持し、評価時刻と新証明書`issuedAt`が旧証明書の残り30日以内かつ旧`expiresAt`未満であること、新旧重複が最大30日であること、および新証明書が旧証明書より後まで有効であることを要求する。issuer key rotationは許容するが、両証明書のEd25519署名数学的一致を個別に要求する。

この候補は発行、Network、自動更新、Filesystem保存、Runtime所有時計、CA Trust、失効、rollback floorまたはLifecycleを実装しない。更新Effectは引き続き`not_implemented`で、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、固定版の独立レビュー前は`Resolved`ではない。

### 2026-08-15 — Platform Provisioner二重署名Gate候補

Qual-Labの人間の決定権限者は、配布版Platform Provisionerについて、OSネイティブコード署名とQual-Lab署名済みmanifestの両方を同じ実行物へ結合して検証できることをEffect前の必須条件とした。どちらか一方だけ、未知署名、改変、権限不一致、RSA、別曲線または別方式へのfallbackでは`blocked`とする。ローカル／開発buildはdry-run／test専用で、Trust、GateまたはFilesystem Effectを成立させない。管理者昇格、鍵生成、ACL変更および保存は、将来の明示`provision`だけが発火できる。

今回の実装は、Platform、architecture、version、実行物SHA-256、Root Protection Policy Hash、Key Storage Policy Hashおよび有効期間をJCS payloadへ固定するmanifest revision 1と、Ed25519署名exact 1件のpure暗号一致検査に限定する。caller supplied release signer SPKI、実行物digestおよび評価時刻はRuntime所有Trust、実行物取得または時計Authorityではない。正常結果もmanifest cryptographic match候補だけで、OSネイティブ署名成立、実行物Identity、release TrustまたはEffectを返さない。

Windows WinVerifyTrust、macOS SecStaticCodeCheckValidity、Linux配布方式固有の署名検証、実publisher／Team ID／package signer、Runtime所有release Trust、実行物digest取得、Path／permission再確認および実`provision` Effectは未実装である。新pure sourceとOS署名未実装sourceを既存`platform_provisioner_verification`へ接続するが、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、固定版の独立レビュー前は`Resolved`ではない。

後続の局所単位として、明示`coordinator provision [--json]`のcommand grammarを追加する。現ローカル／開発buildでは二重署名、Runtime所有release TrustおよびEffect Adapterが未実装なため常に`blocked`、`dryRunOnly: true`、Effect 0を返す。未知argumentはusage errorとし、Path、鍵、署名または権限値を受理・出力しない。`doctor`、`activate`、通常runまたは暗黙fallbackから発火させず、実Effectが実装されるまで唯一の入口という形だけを固定する。この処置も`Applied`／`Self-checked`であり、12 blocker、6 evidence、Gateおよび非Release境界を変更しない。

さらに、Platformごとの固定Verifier種別、署名者Identity Hash、manifestと同じ実行物digest、file Identity安定性およびpermission policy一致をまとめる二重検証pure集約候補を追加する。manifest検証は内部で再実行し、片側の自己申告結果を流用しない。正常一致もcaller supplied観測と期待Identityの形が一致した候補にすぎず、`nativeObservationRuntimeOwned: false`、`releaseIdentityRuntimeOwned: false`、`effectAuthorizationIssued: false`を維持する。実Adapter、実release Identity選択およびEffect controllerが同じ制御経路を所有するまで、CapabilityまたはEffectへ変換しない。新sourceは既存`platform_provisioner_verification`へ接続するが、blockerを解除しない。

### 2026-08-16 — Platform Provisionerのnpm／`.mjs`配布境界

Qual-Labの人間の決定権限者は、version 1を専用native executableではなく`.mjs`を含むnpm packageとして配布する方針を承認した。過去の「OSネイティブコード署名とQual-Lab manifestの二重条件」は当時の判断として履歴保持するが、version 1の現在判定へ使用しない。Windows AuthenticodeまたはmacOS Developer ID証明書の購入、専用EXE化およびOSネイティブ署名はversion 1の必須条件ではない。

現在のEffect前Trust目標は、npm registry署名、生成元証明（provenance）、Qual-Lab署名済みpackage manifest、およびRuntime所有のpackage内容／Filesystem Identity確認を同じpackageへ結合することである。package manifestはpackage名、version、file一覧から得るcontent root、Root Protection Policy Hash、Key Storage Policy Hashおよび有効期間をEd25519署名exact 1件へ結合する。registry／provenance／package観測をcallerが自己申告してもAuthorityまたはEffectへ昇格しない。どれか一つの欠落、生成元不一致、改変、権限不一致またはfallbackは`blocked`とする。

今回の実装はpackage manifest、content rootおよび非Authorityなpackage Trust Gateのpure候補と、Runtime activation／doctor／明示`provision`の状態投影までである。実npm install receipt検証、provenance取得、release Trust選択、package file読取り／安定Identity／permission検証、publish workflow、Effect controllerおよびRoot／鍵／ACL変更は未実装である。ローカルsource checkoutはtest／dry-run専用で、TrustまたはEffectを成立させない。既存12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と必要な独立レビュー／監査前は`Resolved`、採用、準拠、移行、Stable、Releaseまたは公開ではない。

### 2026-08-16 — CoordinatorをCRDD配布物へ限定

Qual-Labの人間の決定権限者は、Coordinatorを個別用途または単独公開packageとして提供せず、CRDDと一体の配布物としてだけ使用する方針を承認した。直前のnpm registry公開／個別installを前提にした判断は履歴保持するが、この後続判断によりsupersededされ、現在判定へ使用しない。`tools/coordinator/package.json`の`private: true`を維持し、version 1では単独npm publish、単独package取得、専用EXEおよび有料OSコード署名証明書を要求しない。

現在のEffect前Trust目標は、検証済みCRDD Revision、Qual-Lab署名済み内包package manifest、およびRuntime所有のpackage内容／Filesystem Identity確認を同じCRDD配布物へ結合することである。manifest revision 1は`crddRevision`を署名対象へ追加し、package content rootとCRDD Revisionを分離不能にする。単独package、未知Revision、内容／権限不一致または別sourceへのfallbackは`blocked`とする。caller suppliedの`verified_crdd_bundle`値はRuntime所有Trustではない。

今回の処置はprivate bundle contract、pure package Trust Gate、Runtime activation／doctor投影および明示`provision`の安全要約までである。実CRDD release Identity検証、release Trust選択、package file読取り／安定Identity／permission検証およびEffect controllerは未実装である。既存12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseを維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と必要な独立レビュー／監査前は`Resolved`、採用、準拠、移行、Stable、Releaseまたは公開ではない。

### 2026-08-16 — CRDD同梱専用境界の伝播是正

全体整合確認により、単独installを禁止する現在contractに対して`package.json`の`bin`公開、Gate観測の`installedPackageIdentityStable`、旧二重署名設計由来の`dual-gate`ファイル名、およびREADMEの現行command一覧からの`provision`欠落が残っていることを確認した。`bin`を削除してCRDD Repository内の固定Pathからの直接起動だけを表示し、観測語を`bundledPackageIdentityStable`へ変更し、実装／試験を`platform-provisioner-package-gate`へ改名する。READMEのcommand一覧には安全に`blocked`となる`provision [--json]`を追加する。

この是正は公開範囲を拡張せず、CRDD同梱専用という後続判断へ実装metadata、schema語、内部所有名および利用者向け表示を一致させる。package manifest、CRDD Revision結合、Trust／Effect条件、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseは変更しない。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と必要な独立レビュー／監査前は`Resolved`ではない。
