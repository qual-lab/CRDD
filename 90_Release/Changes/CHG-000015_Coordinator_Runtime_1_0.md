# 変更トレース: Coordinator Runtime 1.0

変更トレースID: `CHG-000015`
状態: `Draft`
担当責任者: Qual-Lab
最終更新日: 2026-08-26
対象系列: Coordinator Runtime 1.x
対象バージョン: 1.0 Candidate
変更分類: `normative`（Runtime実装に加え、標準保守と公式／配布AI入口の一般規則を強化）
リリースレベル: `MINOR`（v0.18.0候補。統合Release全体の最大分類はCHANGELOGを正本とする）
`migration_required`: `true`（標準保守、公式AI入口または配布`template/AGENTS.md`を利用する採用側は利用側処置を評価）

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
- Front Codex／Claude CodeからCoordinatorを経由し、Codex／Claude Code Executorと対象Providerを除外した独立Reviewerを選ぶ4経路を同じ仲介Authority Treeで扱う。
- 既定はcross-providerでSubscription枠を分散し、移譲不要、Provider固有の検証特性または反対Providerの実測不能時だけ同一Provider／Front-onlyを理由付きで選ぶ。

## 4. 1.0へ含めないもの

- `existing_worktree`への直接書込み
- commit、push、merge、rebase、tagまたはRelease操作
- 汎用Migration Engineまたは複数CRDD版の同時互換
- Provider同士の直接spawn、再帰的Authority cycleまたはCoordinator外の動的Routing
- API key、従量API、追加credit購入、quota不足からの有料経路fallback
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

Qual-Labの人間の決定権限者は、Provisioning Record署名の基礎方式としてRFC 8785 JCS、Ed25519、RFC 8410 SPKI DERおよびexact DERのSHA-256由来key Identityを採用し、payloadと複数署名を分離するEnvelope、Qual-Lab同梱鍵集合、鍵切替の重複期間、明示失効および未知／失効／不正／形式不明時のfallbackなし`blocked`を方針承認した。CRDD固有domain separationのexact byte／framing、Record／Envelope／keyset／revocation manifestのexact Schema、key ID表示encoding、署名充足規則および実鍵はこの承認だけでは一意でなく、後続判断として残す。過去の「署名値をRecord内へ置くか分離Envelopeへ置くか未決」という判断はこの後続承認でsupersededされ、現在判定へ使用しない。外部規格の正本、確認日、適用節、採用／非採用範囲および再評価契機は[Threat Modelの外部規格入力](../../tools/coordinator/threat-model.md#provisioning-signature-external-standards)を正本入口とする。

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

### 2026-08-16 — Coordinator型検査の段階導入

実行形式と配布用チェッカーを`.mjs`のまま維持し、Coordinator内部だけへTypeScriptの`allowJs`／`noEmit`型検査を段階導入する。設定全体の`checkJs`は無効のまま、対象ファイルの`@ts-check`で範囲を明示する。第1段階はPlatform Provisioner Trust CoreとPackage Gateだけを`strict`対象にし、TypeScriptおよびNode型定義をCoordinatorの固定devDependencyとして使用する。型検査はJavaScriptを生成せず、Runtime、署名対象、CLI起動方法またはCRDD配布物の公開面を変更しない。

`tools/crdd_check.ts`と`template/tools/crdd_check.ts`は、採用Repositoryで追加installなしに直接実行できるブートストラップ境界として対象外にする。残るCoordinator moduleはpilotの型境界、保守費および誤検出を確認してから専用変更で拡張し、`.ts`拡張子への変換はRuntime 1.0の内部API安定後に別判断とする。自己確認では型検査、対象49件、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

この段落の型検査対象外判断と旧Pathは当時の履歴である。内部JavaScriptの完全TypeScript移行は[CHG-000016](CHG-000016_Internal_TypeScript_Migration.md)、現行Checker Pathの破壊的移行は[CHG-000017](CHG-000017_Tools_Coding_Standards.md)が後続決定として置き換え、現在判定には使用しない。

### 2026-08-16 — Coordinator全実装moduleへの型検査展開

後続の人間承認に基づき、`allowJs`／`checkJs`／`noEmit`による型検査を`bin`／`src`配下の全38実装moduleへ展開する。全実装moduleへJavaScript互換の構造検査を適用し、Platform Provisioner Trust CoreとPackage Gateには既存の`strict`検査を別設定で重ねる。意図的な不正shape、readonly Node APIの差替えおよび失敗系unionを多用する試験fixtureは静的型へ合わせたcastで弱めず、従来の全Coordinator実行試験で確認する。

全域検査によって、Runtime activationのprivate implementation snapshotに`platformKeyStoragePolicy`が同じ値で二重定義されていたことを検出し、重複だけを除去した。併せてcanonical array length descriptor、初回登録decoderの成功判別、challenge Hash結果、準備記録domain message、Git exclude書込み失敗、doctor recoveryおよびCLI reportの既存境界をJSDocまたは明示fieldで表現した。実行形式、公開API、署名対象、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseは変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第2波

全実装moduleのJavaScript型検査を維持したまま、strict対象を2から12 moduleへ拡張する。追加対象はAuthorityの起動直前確認、Authority／Runtime Root候補、Host recovery token、初回登録の時計・消費状態、Platform鍵保管方針、activation IDおよびactivation-locator結合である。公開入力は`unknown`として明示し、候補結果、時刻snapshot、Hash台帳および選択結果をJSDocで型付けする。検証済みchallengeから時刻fieldを読む箇所は、検証後の限定castだけを使用する。

この変更は型検査用metadataに限り、Schema、reason、暗号方式、Filesystem／Network Effect、Runtime Authority、Capability、12 blocker、6 evidenceまたはGate状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第3波

strict対象を12から16 moduleへ拡張し、Repository Git layout候補、登録証明書更新候補、Root保護方針およびProvider隔離profileの入力を`unknown`から検証後に限定する。catchした例外の`code`／`message`参照、再帰canonical JSON、候補結果の追加detailsおよびSPKI owned copy境界をJSDocで表現する。既存のcandidate／blocked reason、Schema、Hash、時刻規則、Authority／Capability／Effect境界は変更しない。

自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第4波

strict対象を16から20 moduleへ拡張し、Authority File Bundle、Authority Trust loader、Provisioning Recordと登録証明書の結合、およびRuntime activation遷移を対象に加える。raw Bufferのcopy前上限、canonical JSON、候補details、署名者結合およびactivation recordのcandidate形状をJSDocで固定した。型が明確になった利用側では、candidate statusに加えてrecord存在をfail closedに確認する。

この処置は既存検証の型表現と防御的null確認に限り、canonical bytes、Hash、署名、Schema、reason、Trust、Authority／Capability／EffectまたはGate状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第5波

strict対象を20から23 moduleへ拡張し、plain-data snapshot、Git local excludeおよびAuthority Root locatorを対象に加える。共通snapshotはProperty Descriptorのdata property条件を型predicateとして表し、保持値自体は任意入力であるため利用側の個別検証責務を変えない。Locatorのrevisionは`number`確認後に安全整数境界を評価し、Git excludeはRepository内外の判別結果をdiscriminated unionとして固定する。

この処置は入力snapshot、候補選択およびcanonical locatorの既存規則を型で表現するだけで、Path、Filesystem Effect、Authority、CapabilityまたはGate状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第6波

strict対象を23から25 moduleへ拡張し、署名済みオフライン初回登録束とProvisioning CAのpure Coreを対象に加える。外部入力は`unknown`、exact arrayの正規化callbackと内部暗号shapeは限定型として表し、時刻・正整数の検査は型predicateへ収束させる。候補detailsと失効key ID集合も既存結果を維持したまま型付けする。

この処置は既存のEd25519署名、domain framing、CA role、失効、7日／365日／24時間境界またはfail-closed判定を変更しない。Runtime所有Trust、時計、rollback、消費台帳、Authority／Capability／EffectおよびGate状態も不変である。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第7波

strict対象を25から26 moduleへ拡張し、Provider egress proxy policyを対象に加える。IPv4／IPv6、CIDR rule、IANA snapshot tuple、CONNECT authorityおよびfixture入力の型を明示し、固定NAT64 prefixと正規化済みoriginのnull境界を検証後に限定する。

この処置はIANA snapshot、longest-prefix判定、IPv4-mapped IPv6、CONNECT 443限定、private address拒否、Network Effect未実装またはAuthority未成立の境界を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第8波

strict対象を26から27 moduleへ拡張し、Runtime activation recordの正本とonboarding readiness投影を対象に加える。公開するRecord／raw byte入力を`unknown`として扱い、canonical JSON、UTC、revision、identifier、候補結果および12 dependencyのsource集合をJSDocで表現する。型検査で必要になったrevisionのprimitive number確認とreadiness十分値indexの存在確認は、既存のfail-closed条件を明示する防御に限定する。

この処置はactivation Schema、canonical bytes、Hash、12 blocker、6 current-run evidence、dependency mapping、Authority／Capability／Effect、GateまたはRelease状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第9波

strict対象を27から28 moduleへ拡張し、Authority RegistryとGrant照合候補を対象に加える。Registry、Grant、評価Contextおよびraw byte入力を`unknown`として扱い、正規化済みGrant、canonical JSON、UTC、origin集合、候補状態およびbyte所有境界をJSDocで表現する。Grant／Registry revisionのprimitive number確認と、件数1確認後のGrant存在確認は既存のfail-closed条件を型上も明示する。

この処置はRegistry／Grant Schema、canonical bytes、Hash、Provider／Operation／Scope照合、Runtime Trust、Authority／Capability／EffectまたはGate状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — strict型検査の第10波

strict対象を28から29 moduleへ拡張し、Runtime Root Path IdentityとGit local exclude結合を対象に加える。Filesystem metadata、Path object Identity、realpath snapshot、containment、Repository相対位置、identity sessionおよびlocal exclude結果をJSDocで表現し、外部入力を`unknown`として固定する。Repository内部位置で先頭segmentを取得できない到達不能境界は、既存の不正exclude entry reasonへfail closedに閉じる。

この処置はPath選択、TOCTOU再確認、containment、Git metadata書込み、Root保護、Authority／Capability／EffectまたはGate状態を変更しない。自己確認では二層型検査、Coordinator全255件、Checker全143件および全体Checker（Error 0／Warning 0）がPassした。本処置は`Applied`／`Self-checked`であり、必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — CRDD内部Scriptの完全TypeScript移行判断

Qual-Labの人間の決定権限者は、現行フォルダ配置を維持したままCRDD内部ScriptをTypeScriptへ完全移行し、Node.js 24.12以上のnative TypeScript実行を標準にする方針を承認した。Runtime用の`tsx`、`ts-node`、Bundlerまたは追加npm packageは要求せず、TypeScript Compilerは開発時の型検査へ限定する。Node native type strippingで消去できない構文、tsconfig path aliasおよびCompiler変換に依存するRuntime挙動は採用しない。

この判断は、version 1で`.mjs`を維持し`.ts`変換を内部API安定後の別判断とした2026-08-16の旧判断をsupersedeし、現在判定へ使用しない。移行は全production moduleのstrict収束、Coordinator `bin`／`src`、tests、ルートチェッカー／fault injector／配布ひな型、参照文書の順に固定する。各中間Commitは実行可能性と既存255件／143件の回帰を維持する。現在環境はNode.js 22.18.0のため中間検証に限って使用し、最終固定版はNode.js 24.12以上でnative `.ts`直接実行を確認するまで`Resolved`、Runtime採用、準拠、移行完了またはReleaseとしない。12 blocker、6 current-run evidence、Authority／Capability／EffectおよびGate `blocked`は変更しない。

### 2026-08-16 — Coordinator testのTypeScript移行

production 38 / 38 moduleに続き、Coordinator test 30 / 30 fileを`.ts`へ移行した。test専用strict設定をproduction設定から分離して全testへ`strict`、`noImplicitAny`、`noUncheckedIndexedAccess`およびNode native TypeScript制約を適用する。意図的な不正shape、欠落field、Proxy、accessor、Node API差替えおよび失敗系unionは、`any`、型検査抑制またはunsafe castで隠さず、`unknown`、Property Descriptor、`Reflect`および実行時assertionで表現する。production側でも外部のreadiness入力を`unknown`としてsnapshot後に絞り、Docker probe JSONをexact plain-dataとして検証し、作成成功後のoperation directoriesをoverloadで非nullに限定した。

自己確認ではproduction／testのstrict型検査、Biome Lint／FormatterおよびCoordinator全255件がPassした。Coordinator配下のproduction／testに`.mjs`／`.cjs`は残らない。ルートチェッカー、checker test、fault injectorおよび配布ひな型は承認済み順序どおり最後の単位として残す。本処置は`Applied`／`Self-checked`であり、チェッカー群とNode.js 24.12以上での最終確認および必要な独立レビュー前は`Resolved`、移行完了、採用、準拠、Stable、Releaseまたは公開ではない。

### 2026-08-16 — 最終チェッカー群のTypeScript移行

承認済み順序の最終単位として、公式ルートチェッカー、配布ひな型チェッカー、チェッカー試験および異常注入器を現行配置のまま`.ts`へ移行した。配布ひな型チェッカーはGit探索、Markdown構造、変更トレース、参照集計および是正表の内部shapeを明示型へ変換し、外部JSON結果は試験側で`unknown`から実行時検証して再構成する。異常注入器はNode組み込みmoduleの差替え境界を限定型で表し、暗黙`any`、型検査抑制またはunsafe castを導入しない。旧JavaScript併用型検査設定は削除し、production、testおよびcheckerの全TypeScriptをstrict型検査へ接続する。

Biome Lint／Formatterは`tools`および`template/tools`のTypeScript全体を対象とし、チェッカー試験と全体チェッカーは`.ts`を直接実行する。`.mjs`／`.cjs`の実Scriptは`tools`および`template/tools`から除去し、文書と実行例も現行`.ts`入口へ更新する。現在環境のNode.js 22.18.0ではnative type strippingの中間互換確認まで行うが、承認済みの最終実行要件はNode.js 24.12以上である。この処置は`Applied`／`Self-checked`であり、Node.js 24.12以上の固定環境による全確認と必要な独立レビュー前は`Resolved`、移行完了、採用、準拠、Stable、Releaseまたは公開ではない。

### 2026-08-16 — 同梱Coordinator packageのFilesystem観測候補

TypeScript移行前に保留したPlatform Provisionerの実装を再開し、CRDD配布物内でmodule相対に固定される`tools/coordinator`だけを対象とするFilesystem Adapter候補を追加した。AdapterはRootと各fileがnon-linkであることを確認し、Root Identityを走査中に再確認しながら、各fileを同じhandleから読み取ってbyte数とSHA-256を取得する。再帰file一覧から既存のpackage content rootを再計算し、署名済みmanifest候補のpackage名、version、CRDD Revisionおよびcontent rootとの一致を検査できる。開発依存の`node_modules`とroot `.gitignore`は配布package内容へ含めない。公開結果は件数、総byte数、Hashおよび状態だけで、file Path、生byte、descriptor、署名または鍵を含めない。callerが任意Rootを選ぶ検査入口は非Authorityのまま分離する。

TypeScript完全移行後も残っていた`crdd_bundled_private_mjs_package`は現在契約と矛盾する互換残骸であるため、shimまたはaliasを残さず`crdd_bundled_private_typescript_package`へ置換した。外部互換は維持せず、現在の正本と全直接利用側を同時に移行する。

この候補はpackage内容と安定Filesystem Identityの観測だけを進める。CRDD release Identityの取得・検証、Qual-Lab release Trust Anchor／signerの選択、署名済みmanifestの配布位置と選択、owner／permission policy検証、Effect controllerおよび実`provision`接続は未実装である。caller supplied signer、期待RevisionまたはmanifestからTrust、Authority、CapabilityまたはEffectを発行せず、既存12 blocker、6 current-run evidenceおよびGate `blocked`を維持する。上記release signer／Trustとmanifest配布契約は人間の決定権限を要するため、本変更では推測しない。自己確認ではCoordinator 261 / 261、Checker 150 / 150、両private packageの型検査／Biome Lint／Formatter、および全体Checker 414 files／288 Markdown／Error 0／Warning 0がPassした。本処置は`Applied`／`Self-checked`であり、新固定版の必要な独立レビュー前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — Release Trustと同梱package保護方針の承認

Qual-Labの人間の決定権限者は、公開鍵検証とOS保護を組み合わせる方針を承認した。release Trustは、外部確認済みCRDD ReleaseへQual-Labの有効なEd25519公開鍵exact 1本を固定し、CRDD version、Commit、TreeおよびCoordinator package content rootを署名対象へ結ぶ。公開鍵は誰でも検証に使用できるが、正式署名を作る秘密鍵はRepositoryへ保存せず、Qual-LabのRelease工程だけが使用する。第三者鍵、自動fallbackおよび未知鍵を受理しない。鍵rotationは後続の人間承認付きCRDD変更とし、version 1で複数鍵を暗黙選択しない。署名済みpackage manifestの固定Pathは`90_Release/coordinator-package-manifest.json`とする。実公開鍵は鍵生成・保管工程が完了するまで未設定とし、placeholder鍵またはtest鍵をTrust Anchorへ流用しない。

同梱package保護は、本番Platform ProvisioningをOS保護された配置からだけ許可する。Windowsは`SYSTEM`とmachine Administratorsだけにwriteを許可し、Runtime利用者はread／executeだけとし、一般利用者へwriteを与える継承ACEを拒否する。macOS／Linuxはroot所有、directory `0755`、file `0644`を要求し、group／other writeを拒否する。source checkoutは開発・試験に使用できるが、管理者Effectを許可しない。初回setupだけが必要な昇格と保護設定を担い、通常runでは再確認だけを行う。改変または権限不一致は自動修復せず`blocked`として再setupへ戻す。

今回の後続処置は、POSIX package treeのowner／mode観測候補と、release Trust model、Identity binding、manifest固定Pathおよび実鍵未設定状態のcontract投影である。Windows DACL Adapter、CRDD Release Identity loader、署名済みmanifest loader、実Trust Anchor投入、初回setup EffectおよびEffect controllerは未実装であり、Gate `blocked`、Authority／Capability／Effect非発行を維持する。直前節の「人間判断が必要」という現在状態は本承認でsupersededされ、設計判断として現在判定へ使用しない。ただし実秘密鍵の生成・保管と公開鍵投入は人間が管理するRelease運用であり、AIがRepositoryへ生成しない。本処置は`Applied`／`Self-checked`で、必要な機械確認と独立レビュー前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

承認済みの4点結合をexact schemaへ反映し、manifest revision 1の旧`crddRevision`単独fieldを互換aliasなしで`crddVersion`、`crddCommit`、`crddTree`へ置換した。`packageContentRootSha256`と合わせた4値を署名対象へ含め、Gateの期待値と配布観測も同じ4値へ移行する。旧schemaはCandidate時点の履歴であり、現在判定へ使用しない。

OpenSSLがない環境でも人間のRelease操作を安全に継続できるよう、Node.js 24.12の暗号APIを使うprivate保守entrypoint `scripts/generate-release-key.ts`を追加した。新規のRepository外絶対Pathだけを受理し、対話端末で非表示入力した20文字以上のpassphraseによりEd25519秘密鍵をAES-256-CBC暗号化PKCS#8 PEMとして保存し、公開SPKI DERとSHA-256 key IDだけを返す。既存Path、Repository内Path、短いpassphraseまたは非対話実行を拒否し、秘密鍵を出力結果へ含めない。これは実鍵の生成をAIまたは通常Runtimeへ移すものではなく、人間が検証済みNodeとRepository所有entrypointの絶対Pathを指定して明示実行するRelease保守入口である。Trust Anchor投入、Manifest署名、ReleaseおよびEffectは別工程のまま維持する。

自己確認ではCoordinator 263 / 263、Checker 150 / 150、命名／参照5 / 5、Coordinator private packageの型検査／Biome Lint／Formatter、および全体Checker 416 files／288 Markdown／Error 0／Warning 0がPassした。実Release鍵は人間の非表示passphrase入力を要するため、この固定版の機械試験では一時試験鍵だけを生成して暗号化秘密鍵、公開鍵導出、非漏洩および拒否境界を確認した。本処置は`Applied`／`Self-checked`であり、独立レビューと実公開鍵の投入前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

初回の実対話確認では、1回目の非表示入力を読み終えた際に非同期iteratorが標準入力streamを閉じ、2回目の確認入力を受け取れない不具合を検出した。入力処理をstreamを閉じない一時event listenerへ変更し、各入力後にraw modeとlistenerだけを解除する構造へ是正した。Node.js 24.19.0のPTYで同一の試験用passphraseを2回入力し、暗号化秘密鍵と公開鍵の生成完了および安全なJSON要約を確認した後、一時成果物を削除した。実Release鍵のpassphraseはAIへ渡さず、人間の対話端末だけで入力する境界を維持する。

人間がRepository外`C:\project\key\CRDD`で生成・移動した鍵対のうち、公開SPKI DERだけを確認した。公開鍵は44 byteのcanonical Ed25519 SPKIで、SHA-256は`6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f`である。秘密鍵は内容を読み取らず、暗号化秘密鍵fileの存在、サイズおよびnon-link metadataだけを確認した。

公開鍵をCRDD所有の不変source literalとして固定し、module初期化時にEd25519、44 byte、canonical DERおよび固定SHA-256を再確認するRelease Trust contractを追加した。Runtime所有の同梱package検証入口はcaller supplied signerを入力shapeから除去し、この固定鍵snapshotだけをmanifest暗号検証へ渡す。第三者鍵、未知鍵fallback、caller鍵による置換、複数鍵の暗黙選択または秘密鍵同梱を許可しない。Runtime activationとdoctorは同じcontract snapshotを投影する。

公開鍵の固定だけでは署名済みmanifest、CRDD release Identity loader、Windows DACL AdapterまたはEffect controllerは成立しないため、全体Gate、Authority／Capability／EffectおよびRelease状態は`blocked`のまま維持する。次工程は固定Pathのmanifest生成・署名・読取りとrelease Identity結合であり、秘密鍵とpassphraseは引き続き人間のRelease端末だけが使用する。本処置は`Applied`／`Self-checked`であり、機械確認と独立レビュー前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

自己確認ではCoordinator 265 / 265、Checker 150 / 150、命名／参照5 / 5、Coordinator private packageの型検査／Biome Lint／Formatter、および全体Checker 418 files／288 Markdown／Error 0／Warning 0がPassした。外部保管公開鍵と固定source literalのSHA-256も完全一致した。秘密鍵、passphrase、鍵保管Pathは試験、doctorまたは公開結果へ入力していない。

人間承認に基づき、Repository外鍵保管directory `C:\project\key\CRDD`と直下の全3 fileはWindows ACL継承を解除した。Ownerは`DESKTOP-N90GJ7T\nakas`、明示Allowは同Owner、`NT AUTHORITY\SYSTEM`および`BUILTIN\Administrators`のFull Controlだけであり、一般利用者とAuthenticated Usersの継承writeを除去した。鍵2 file以外に存在した空の`mem.txt`は内容を読まず、削除せず、同じdirectory保護境界へ含めた。これは外部Release鍵保管の局所運用処置であり、CRDD RuntimeのWindows DACL Adapter実装完了、package配置、Effect、統合またはReleaseを意味しない。

### 2026-08-16 — 署名済みRelease manifestの生成・読込候補

固定Pathの署名済みRelease manifestについて、対象Commit／Treeとmanifest自身の循環を避ける配布境界を固定した。manifestは対象Git Treeへ含めず、対象Treeを外部の配布ステージングRootへ展開した後、固定Path`90_Release/coordinator-package-manifest.json`へ後置する配布成果物とする。Repository内または対象Treeへmanifestを生成する互換経路は設けない。

private保守entrypoint `scripts/sign-release-manifest.ts`は、Repository外の絶対ステージングRoot、Repository外の暗号化秘密鍵、CRDD Version／Commit／Tree、canonical UTCの発行／失効時刻を明示入力とする。配布Rootの`tools/coordinator`を既存のnon-link同一handle観測で再計算し、package名／version／content root、Root保護Policyと鍵保管PolicyのRFC 8785 canonical byteに対するSHA-256、CRDD Identityおよび有効期間をrevision 1 payloadへ結ぶ。秘密鍵から導出した公開SPKIがCRDDへ固定したQual-Lab公開鍵と完全一致する場合だけEd25519署名し、既存manifestを上書きしない。passphrase、秘密鍵、生manifest messageまたは鍵Pathを結果へ出力しない。保護操作用package aliasは持たず、検証済みNodeとRepository所有entrypointの絶対Pathからだけ開始する。

固定Path loader候補は上限131072 byte、BOMなしstrict UTF-8、RFC 8785 canonical byte完全一致、non-link、読取り前後と同一handleのFilesystem Identity一致を要求する。Runtime用の同梱package検証入口はmodule相対のCRDD配布Rootからこの固定manifestを取得し、固定公開鍵、package content rootおよび期待CRDD Identityへ渡せる。ただし期待CRDD IdentityをRuntime所有の検証済みReleaseから取得するloaderは未実装であり、callerの期待値、source checkoutまたはmanifest自身からRelease Identityを成立させない。

実鍵によるmanifest生成は、Release対象Version／Commit／Tree、配布ステージングRootおよび有効期間を人間のRelease判断で固定した後にだけ実行する。現Candidateへの実署名は行わない。Windows package DACL Adapter、Release Identity loader、Effect controllerおよび実`provision`接続は引き続き未実装で、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行、v0.18 Candidate／Released Baseline v0.17.0を維持する。本処置は`Applied`／`Self-checked`であり、新固定版の機械確認と独立レビュー前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 269 / 269、Checker 150 / 150、命名／参照5 / 5、Coordinator private packageの型検査／Biome Lint／Formatter、および全体Checker 424 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0がPassした。実Release鍵による成功署名は人間のRelease判断後に限定するため実行せず、一時試験鍵が固定公開鍵と一致しない場合の拒否、署名前payloadの暗号検証、固定Path loaderのcanonical byte／stable same-file境界および安全要約を機械確認した。

後続の自己照合で、署名payloadへRoot保護Policyと鍵保管PolicyのHashを含めるだけでは、Runtimeが所有する現在Policyとの一致確認にならない不足を検出した。同梱package検証入口で両Policyを正本から再canonical化してSHA-256を計算し、署名検証済みpayloadの2 Hashと完全一致しない場合はfail closedに拒否する。caller supplied Policy Hashや署名者の主張だけから現在Policy一致を成立させない。

さらに、固定署名manifestの`crddTree`を主張値のまま受理せず、外部配布Root全体をGit blob／tree object形式で再帰的にHash化するRelease Identity候補を追加した。各directoryとfileをnon-link実体として確認し、fileは同じhandleから上限内で読み、走査前後にIdentityを再確認する。署名対象Treeの外で後置する固定manifestだけを計算から除外し、`.git`、未知file、欠落file、内容変更、mode差、link、special entryまたはRoot Tree不一致を拒否する。これにより署名済みCoordinator packageだけを別RootへコピーしてCRDD一式として扱う経路を閉じる。

固定Path manifest、固定Release鍵、現在Policy Hash、Coordinator package content rootおよび配布Root Git Treeが同じ候補で一致した場合に限り、CRDD Release Identityと配布IdentityをRuntime所有候補として表示する。署名されたCommitは固定鍵によるRelease証明として扱うが、旧Releaseへのrollbackを拒否する永続floor、Windows DACLおよびEffect controllerは未実装であり、Authority／Capability／Effect、Gate、採用、統合またはReleaseへ昇格しない。

Release署名commandも署名直前に同じ配布Root Git Tree再計算を行い、明示された`crddTree`と不一致なら秘密鍵が固定鍵と一致していても署名fileを生成しない。これによりRelease操作時の誤ったCommit／Tree組合せを署名済み成果物へ固定しない。

実Repositoryの`HEAD`を一時directoryへ`git -c core.autocrlf=false archive`で展開し、Gitが示すRoot TreeとNode.js実装の再計算値が完全一致することを確認した。通常のWindows改行変換を受けたarchiveはblob byteがGit objectと異なるため意図どおり不一致となる。Release stagingは改行変換しないarchiveを必須とし、作業Treeの見かけ上の同一性からRelease Identityを推定しない。

Node.js 24.19.0で、Coordinator 272 / 272、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／88 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 426 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0がPassした。実秘密鍵、passphraseおよび実Release manifestは使用・生成していない。本処置は`Applied`／`Self-checked`であり、独立レビュー前は`Resolved`ではない。

### 2026-08-16 — Release sequenceとrollback floor遷移候補

Qual-Labの承認により、署名manifest revision 1へ1以上のsafe integer `releaseSequence`を必須追加した。未公開Candidate内の変更なので旧Schemaの互換aliasまたはfallbackを残さない。Release署名commandは`--release-sequence`を明示要求し、Sequence、CRDD Version、Commit、Tree、Coordinator package content rootおよびPolicy Hashを同じEd25519署名payloadへ結ぶ。

rollback floorのpure Core候補は、初回Identityと増加Sequenceを永続化要求として返し、保存済みfloorと同じSequenceではmanifest Hash／Version／Commit／Treeの完全一致だけを再利用候補にする。低いSequenceはrollback、同一Sequenceの異なるIdentityは差替えとしてfail closedに拒否する。floor自身も成果物固有domain、uint64be JCS byte長およびcanonical payloadのSHA-256で再検証する。caller supplied floorはAuthorityではなく、初回または増分の結果も永続化が完了するまで`rollbackFloorConfirmed: false`とする。

永続化Path、原子的書込み、crash recovery、Windows DACL、Effect controllerおよび実`provision`接続は未実装である。12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行およびv0.18 Candidate／Released Baseline v0.17.0を維持する。本処置は`Applied`／`Self-checked`であり、全機械確認と必要な独立レビュー前は`Resolved`、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 277 / 277、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／90 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 428 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0がPassした。実秘密鍵、passphrase、実Release manifestおよび永続floorは使用・生成していない。

### 2026-08-16 — Windows package書込みDACL事前検査候補

承認済みのWindows保護方針に従い、CRDD配布物の同梱Coordinator packageを対象とする読み取り専用DACL事前検査候補を追加した。Adapterは`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`のnon-link実体を固定引数、固定埋込みScriptおよび最小Process環境で起動する。Rootと全子要素を上限2049件で走査し、Root DACLの継承保護、全要素のownerが`SYSTEM`またはmachine Administratorsであること、reparse pointがないこと、および両主体以外へnumeric write maskを許可するACEがないことをSID実値で確認する。表示名やローカライズされたaccount名を判断へ使わない。

公開結果は件数、状態および固定reasonだけに限定し、Path、SID、ACE、descriptor、PowerShell出力またはraw errorを返さない。Adapterは権限を変更せず、自動修復、Root作成、ACL継承解除、Runtime Authority、CapabilityまたはFilesystem Effectを発行しない。現在のsource checkoutはRoot DACLの継承が保護されていないため、実観測で`windows_package_dacl_inheritance_not_protected`へ安全停止することを確認した。これは本番配置の不合格を正しく示す候補結果であり、開発checkoutを保護済み配布物へ昇格しない。

同梱package Filesystem観測、Runtime activationおよびdoctorは同じprivate contract snapshotから、Windows書込みDACL事前検査を`implemented_candidate`、Runtime read／execute主体とのACL結合を`not_implemented`として投影する。rollback floor永続化、保護済み配置を作るEffect controller、実`provision`接続およびactivationは未実装である。12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行、v0.18 Candidate／Released Baseline v0.17.0を維持する。本処置は`Applied`／`Self-checked`であり、全機械確認と必要な独立レビュー前は`Resolved`、採用、統合、準拠、StableまたはReleaseではない。

全数命名検査で、直前のrollback floor候補に残っていた固定key集合の不要な中間定数とBoolean local名の規約違反を検出した。不要な集合を削除して最終集合を直接固定し、内部Booleanを`isPersistenceRequired`へ変更した。公開Schema keyの`persistenceRequired`、Hash、reason、遷移意味および署名manifest契約は変更していない。

Node.js 24.19.0で、Coordinator 282 / 282、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／92 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 430 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。実DACL観測ではsource checkoutを`windows_package_dacl_inheritance_not_protected`として拒否し、権限変更は行っていない。

### 2026-08-16 — Runtime主体DACL結合とRepository所有レイアウト契約

人間の決定権限者は、実装を可能な限りRepository内で完結させる方針を承認した。実装、設定、試験、相対レイアウトおよび移行記録はRepositoryを正本とし、Repository外へ置くのは秘密鍵と端末固有の実インストール状態だけに限定する。Windows端末状態は`%ProgramData%\Qual-Lab\CRDD\Coordinator`をRootとし、`releases\<releaseSequence>`、`state\release-floor.json`および`state\active-release.json`へ分離する。旧配置alias、shim、単独packageまたは専用EXEは作らない。

Windows DACL観測は、既存の`SYSTEM`／machine Administrators write限定に加え、既定ではsetup processのWindows Identity、サービス運用では明示service SIDをRuntime主体として結合する。Rootにexact 1件の明示・子孫継承read／execute Allowを要求し、全要素で同主体のread／execute成立、write ACEとDeny ACE不在を確認する。SIDは内部PowerShell境界だけで使用し、公開結果、doctorまたはPath要約へ出力しない。DACL観測は読み取り専用で、permission mutation、Authority、CapabilityまたはEffectを発行しない。

固定レイアウトCoreはWindows絶対ProgramData Rootと正のRelease Sequenceだけを受理し、公開候補へ絶対Pathを返さない。実Filesystem作成、rollback floor保存、active release切替、crash recoveryおよびEffect controllerは引き続き未実装である。処置は`Applied`／`Self-checked`であり、全機械確認と独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — rollback floor専用Store

後続処置として、`state/release-floor.json`のcanonical byte codecと専用Storeを実装した。Storeは固定`state` directoryと固定target／pending名だけを扱い、pending fileをexclusive createして`fsync`し、原子的置換後に同一形式で再読取り照合する。既存pendingは自動上書きせず明示復旧を要求し、復旧は同一floorまたは単調増加するfloorだけを許可してrollbackと同一Sequence差替えを拒否する。Windowsでparent directoryの`fsync`が提供されない場合は結果へ保持し、file `fsync`、pending recoveryおよび再読取りを省略しない。汎用Path writer、旧state aliasおよび推測rollbackは追加しない。

このStoreはFilesystem Effectを実行するため、Platform Provisioner Effect依存として投影する。ただし実ProgramData Rootの作成、DACL設定、署名済み配布物からの導入、active release切替および`provision` controllerには未接続であり、Authority、CapabilityまたはGateを発行しない。上段のrollback floor永続化未実装という現在表示はこの限定Store範囲でsupersededし、Effect統合未実装という境界は維持する。処置は`Applied`／`Self-checked`であり、全機械確認と独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — Windows Platform Provisioner導入Effect候補

Repository所有の実装、設定、試験および固定レイアウトを使用し、明示`provision`からだけ発火するWindows導入Effect候補を追加した。Effectは最初にmodule相対のCRDD配布Rootを固定署名manifest、固定Qual-Lab公開鍵、CRDD Git Tree、Coordinator package content rootおよび現在Policy Hashへ再結合する。source checkoutまたは署名manifestを欠く配布Rootは、ProgramData探索、Directory作成またはDACL変更より前に`blocked`へ閉じる。

検証済み配布物は`%ProgramData%\Qual-Lab\CRDD\Coordinator\releases\<releaseSequence>`のpending世代へ複製し、`tools\coordinator`と`90_Release\coordinator-package-manifest.json`を同じ固定世代へ配置する。pending世代を再検証してから原子的directory renameを行い、`SYSTEM`とmachine AdministratorsへFull Control、選択したRuntime主体へread／executeだけを付与する固定DACLをRoot以下へ適用して、同じ観測Adapterで再確認する。任意Root、環境変数由来ProgramData、旧名alias、単独package、互換shimまたは専用EXEを追加しない。

`state/active-release.json`は、署名済みmanifest Identity、Release Sequence、CRDD Version／Commit／Tree、package content rootおよび確認済みrollback floor Hashを成果物固有domainへ結ぶcanonical状態とする。専用Storeは固定target／pending、exclusive create、file `fsync`、原子的renameおよび再読取り照合を所有し、既存pendingを推測上書きしない。`provision`は配布物、世代配置、DACL、rollback floorおよびactive releaseの候補処理が全て成立した場合だけ成功候補を返すが、Runtime AuthorityまたはCapabilityは発行しない。

本候補では、rollback floorとactive releaseの二状態を一つのcrash-consistent transactionとして確定する処理、Runtime通常runが保護済みactive世代を読んで再検証する処理、Provisioning Record／Authority Rootとの結合、および`activate`／`disable` Effectは未実装である。したがって状態更新途中の失敗は明示復旧を要求し、既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。Repository外へ残るものはRelease秘密鍵と端末固有のProgramData状態だけで、秘密鍵、passphrase、絶対PathまたはSIDを公開結果へ含めない。

対象試験と型検査は`Applied`／`Self-checked`である。新固定版の全機械確認と必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — Platform Provisioner状態transaction候補

`release-floor.json`だけが確定して`active-release.json`の切替に失敗する中間状態を推測処理しないため、固定`state/provision-transaction.json`を永続intentとする状態transaction候補を追加した。intentはprevious floor Hash、previous active Hash、next floor、next active releaseを成果物固有domainとcanonical SHA-256へ結び、固定target／pending以外を受理しない。明示`provision`はintentを`fsync`して原子的に配置した後、floor、activeの順に確定して両Hashを再読取りし、成功後だけintentを削除する。

途中停止または既存pendingがある場合、新しい状態を推測して上書きせず、次の明示`provision`が同じintent、previous Hashまたはnext Hashの一致だけから復旧する。競合、改変、rollbackまたは別active stateは`blocked`へ閉じる。Runtime通常runは未完了intentを自動修復せず、Runtime有効世代読取りの実装まではAuthorityまたはCapabilityを発行しない。RepositoryにはSchema、実装、試験、固定相対Pathだけを置き、実transactionは端末固有ProgramData状態へ限定する。

これにより前節の「両状態をまたぐtransaction未実装」はこの限定範囲でsupersededし、Runtime有効世代読取り、Provisioning Record／Authority Root結合、activation／disable Effect、ready遷移およびReleaseは未実装のまま維持する。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — 導入済み有効世代の読取り・再検証候補

Windowsの既知フォルダー（known folder）である共通アプリケーションデータ（CommonApplicationData）の探索をRepository所有の共通moduleへ集約し、環境変数によるRoot差替えを禁止した。導入EffectとRuntime readerはこの同一探索結果だけから固定`Qual-Lab\CRDD\Coordinator`レイアウトを解決し、任意Root、旧Path aliasまたはRepository内の端末状態複製を追加しない。

読取り専用Runtime候補は、`state/provision-transaction.json`が存在しないこと、rollback floorとactive releaseのSequence／floor Hashが一致すること、固定active世代の署名manifest、CRDD Git Tree、Coordinator package content rootおよびWindows DACLが再検証できることを全て要求する。未完了transactionを通常runから復旧せず、欠落、競合、改変、期限外、DACL不一致または判定不能を`blocked`へ閉じる。公開結果はSequenceと検証済みHashの安全要約に限定し、絶対Path、SID、ACL、署名、鍵またはraw stateを返さない。

Runtime activationとdoctorは同じprivate contract snapshotから本readerを`implemented_candidate`として投影する。ただし通常runへのAuthority接続、Provisioning Record／Authority Root結合、activation／disable Effect、ready遷移およびReleaseは未実装である。reader成功だけからRuntime Authority、CapabilityまたはFilesystem／Network Effectを発行せず、既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。Repository外へ残すのはRelease秘密鍵と端末固有ProgramData状態だけである。

本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — Provisioning Record immutable Store候補

共有Authority Root内の固定`.crdd-provisioning`を準備記録（Provisioning Record）Store Rootとし、`records/<recordHash>.json`のimmutable署名包絡とcanonical `current.json` pointerへ分離した。実装、Schema、固定相対レイアウトおよび試験はRepositoryを正本とし、端末固有RecordはAuthority Rootだけへ保存してRepositoryへ複製しない。旧Path alias、互換shim、汎用Path writerまたは別Receipt成果物を追加しない。

StoreはRecord envelopeを既存exact decoderで所有copyへ変換した後、content Hash名のfileをexclusive createして`fsync`し、records directoryを同期する。current pointerは固定contract／revision／Record Hashだけをcanonical byteへ固定し、pending fileの`fsync`、原子的置換、parent directory同期および同一handle再読取りを要求する。既存immutable fileはbyte完全一致だけを冪等候補とし、別内容、pending、改変または再読取り不一致を`blocked`へ閉じる。

Record更新では既存pure Coreへ系列検証を追加し、record revisionの1増分、previous Record Hash、Record ID、Platform scope、Provisioner Identityおよび登録IDの一致を全て要求する。同一Record Hashの冪等再適用だけを例外とし、古いRecord、同revision差替えまたは別系列へcurrent pointerを移動しない。公開結果はRecord Hashと状態だけに限定し、raw envelope、canonical byte、絶対Path、署名または鍵を返さない。

Runtime activationとdoctorはFilesystem read／write、current pointer contract／persistenceを`implemented_candidate`として同じprivate snapshotから投影する。Runtime所有Trust Anchor集合、失効評価、trust floor、明示復旧、Authority Root resolver／保護、Provisioner Effect接続、完全Lifecycle、Authority、Capabilityおよびready遷移は未実装であり、既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 307 / 307、Checker 150 / 150、両private packageの型検査／Biome Lint／Formatter、および全体Checker 447 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。端末固有Authority Root、実Trust Anchor、実秘密鍵および実Provisioning Recordは使用・生成していない。

### 2026-08-16 — Provisioning Record pointer明示復旧候補

通常のRecord読取り／書込みからpending pointerを自動処理せず、専用の明示復旧Effect候補を追加した。復旧はpending pointerと参照先immutable Recordをcanonical byte／content Hashで再検証し、current欠落時の適用、currentと同一Hashの場合のpending除去、またはpure Coreが承認する正しい次revisionへの遷移だけを許す。current改変、不正pending、別系列、rollback、同revision差替えまたは再読取り不一致では状態を推測せず`blocked`に保つ。

復旧結果はRecord Hashと状態だけを返し、raw envelope、canonical byte、絶対Path、署名または鍵を公開しない。RepositoryはSchema、実装、試験および固定相対Pathを所有し、端末固有Record状態は引き続きAuthority Rootへ限定する。Runtime所有Trust、失効、trust floor、Authority Root resolver／保護、Provisioner接続、Authority、Capabilityおよびready遷移は未実装であり、既存blockerとGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

Node.js 24.19.0で、Coordinator 309 / 309、Checker 150 / 150、両private packageの型検査／Biome Lint／Formatter、および全体Checker 447 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。端末固有Storeへの復旧Effectは試験fixture内だけで実行し、実Authority Rootまたは実Provisioning Recordを変更していない。

### 2026-08-16 — Provisioning Trust floor pure遷移候補

準備Trust状態のrollbackと同revision差替えを拒否するpure Core候補を追加した。floorはTrust Anchor Set Hash、信頼epoch、失効一覧Hashおよび失効revisionを成果物固有domain、uint64be JCS byte長およびcanonical SHA-256へ結ぶ。同一epochではAnchor Set Hash完全一致と失効revisionの単調増加を要求し、同一失効revisionではManifest Hash完全一致だけを許す。新epochだけが新しいAnchor Setと失効系列を開始できる。

初回または増分floorは永続化要求を返し、永続済み同一Identityだけをrollback確認候補とする。caller supplied Trust、HashまたはfloorはRuntime所有Trust、失効確認、AuthorityまたはCapabilityを成立させない。専用Store、Trust配布、Runtime時計との結合およびRecord aggregateとの実接続は未実装で、既存blockerとGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

### 2026-08-16 — Provisioning Trust floor専用Store候補

pure遷移が要求するfloorをAuthority Root内の固定`.crdd-provisioning/trust-floor.json`へ保存する専用Storeを追加した。Storeはcanonical byteだけを受理し、固定pendingのexclusive create、file `fsync`、原子的置換、可能な場合のparent directory同期および同一handle再読取りを要求する。既存floorへの書込みはpure遷移を再評価し、同一Identityの冪等候補、失効revisionの増分または新epochだけを許す。

pendingがある通常読取り／書込みは`blocked`となり、明示復旧だけが欠落targetへの適用、同一floorのpending除去または単調増加floorへの遷移を行う。不正pending、rollback、同revision差替え、Root不一致または再読取り不一致を推測修復しない。RepositoryはSchema、実装、試験および固定相対Pathを所有し、実floorは端末固有Authority Rootへ限定する。Trust配布、Runtime時計、検証済みTrustからStoreへのcontroller接続、AuthorityおよびCapabilityは未実装で、Gate `blocked`を維持する。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

Node.js 24.19.0で、Coordinator 314 / 314、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／113 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 451 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。端末固有floorへのFilesystem Effectは試験fixture内だけで実行し、実Authority Root、実Trust Anchorまたは実失効一覧を変更していない。

### 2026-08-16 — Provisioning RecordとAuthority Rootのpure結合候補

署名済み準備記録と選択済みAuthority Rootを結ぶpure検証候補を追加した。入力はRecord envelope、明示選択した絶対Path、観測済みFilesystem Identity Hashおよび保護policy Hashに限定し、Record署名対象の3値と完全一致する場合だけ候補を返す。1値でも異なる場合は別Root、環境変数または旧Pathへfallbackせず`blocked`とする。

公開結果はRecord Hashと一致状態だけに限定し、絶対Path、raw envelope、署名またはFilesystem情報を出さない。本候補は選択済みRootのbindingだけを所有し、Authority Root探索、実Path Identity観測、保護Adapter、Runtime所有Trust、AuthorityまたはCapabilityを成立させない。Repository内には実装、契約および試験だけを置き、端末固有Rootを複製しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

Node.js 24.19.0で、Coordinator 315 / 315、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／113 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 451 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。実Authority Root、端末固有Record、実Trust Anchorまたは秘密鍵は使用・変更していない。

### 2026-08-16 — Provisioning Trust成果物Store候補

信頼起点鍵集合と失効一覧をAuthority Root内の固定`.crdd-provisioning/trust-anchors/<sha256>.json`および`revocation-manifests/<sha256>.json`へ保存する専用Storeを追加した。両成果物は既存pure codecでcanonical byteへ再検証し、同一信頼epochだけを受理する。新規fileはcontent Hash名へのexclusive create、file `fsync`、対応OSでのdirectory同期および安定再読取りを要求し、既存fileは同一byteだけを冪等候補とする。片方だけが作成された途中状態は未参照のimmutable成果物として保持し、推測削除またはTrust成立扱いをしない。

読取り候補は永続済みtrust floorが指定するTrust Anchor Set Hash、失効一覧Hash、信頼epochおよび失効revisionへ両成果物を再結合する。改変、欠落、同一Hashの別byte、Root差替えまたは結合不一致を`blocked`へ閉じる。公開結果はHashとrevisionの安全要約だけを返し、canonical byte、SPKI、絶対Pathまたは失効entryを出さない。RepositoryはSchema、実装、固定相対レイアウトおよび試験を所有し、実Trust成果物は端末固有Authority Rootだけへ置く。

本StoreはPlatform Provisioner Effectと準備記録検証の依存へ候補投影するが、初期Trustの承認済み導入元、Runtime所有時計、準備記録の実集約検証、Authority Root resolver、Authority、Capabilityおよびready遷移は未実装である。既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`ではない。

Node.js 24.19.0で、Coordinator 318 / 318、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／115 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 453 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。Filesystem Effectは試験fixture内だけで実行し、実Authority Root、実Trust Anchor、実失効一覧または秘密鍵を使用・変更していない。

### 2026-08-16 — 永続Trustによるcurrent Record集約検証候補

永続済みの準備Trust floor、同floorへcontent Hashで結合した信頼起点鍵集合／失効一覧、およびimmutable Storeの`current.json`が指す準備記録を一つのRuntime検証候補へ接続した。候補は各成果物を安定したFilesystem実体から再読取りし、floorの信頼epoch／失効revision／2つのHash、current pointerのRecord Hash、全署名、署名鍵の有効期間および失効状態を再確認する。評価時刻は公開APIから受け取らずRuntime内で取得し、caller supplied時刻を現在時刻へ昇格させない。

公開結果はRecord Hash、検証済み署名数、信頼epoch、失効revisionおよびTrust成果物Hashの安全要約だけに限定し、raw Record、canonical byte、絶対Path、SPKI、署名または失効entryを返さない。Runtime activationとdoctorは、準備記録のTrust Anchor集合および失効評価を`implemented_candidate_runtime_clock_non_authority`として同じprivate contract snapshotから投影する。

本候補は、Repositoryが所有する実装、固定相対レイアウト、契約および試験だけで完結する。実Trust成果物と端末固有RecordはAuthority Root、秘密鍵はRepository外の承認済み保管場所へ限定する。初期Trustの承認済み導入元、Authority Root resolver／Filesystem Identity／保護Adapterとの実結合、activation、Runtime Authority、Capabilityおよびready遷移は未実装である。したがって既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。

Node.js 24.19.0で、Coordinator 319 / 319、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／115 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 453 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。Filesystem Effectは試験fixture内だけで実行し、実Authority Root、実Trust Anchor、実失効一覧、実準備記録または秘密鍵を使用・変更していない。本処置は`Applied`／`Self-checked`であり、新固定版の必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

### 2026-08-16 — Authority Root検索票専用Store候補

Repository直下の固定`.crdd-runtime/authority-root-locator.json`へ、Authority Root検索票の初回永続化、安定読取りおよび明示復旧を接続した。Storeは既存Repository Rootと`.crdd-runtime` Directoryのnon-link実体Identityを最初に固定し、検索票を既存exact codecでcanonical byteへ変換して固定pendingへexclusive create、file `fsync`、原子的rename、対応OSでのdirectory同期および同じRoot Identityでの再読取りを要求する。pendingが残る場合は通常読取りを停止し、明示復旧だけがtarget欠落時の適用または同一targetのpending除去を行う。

既存targetと異なる検索票への更新は、activation recordと検索票をまたぐ原子的transactionが未実装なので推測上書きしない。内部resolver候補は保存済み検索票が指す絶対Pathのnon-link Directory実体と安定Identityだけを確認し、絶対PathやFilesystem Identityを公開結果へ出さない。検索票に記録されたAuthority Root Identity Hash、保護Hash、Provisioning Record Hashおよびactivationとの完全結合は後続Controllerの責務として残し、Root Directoryの存在だけからAuthorityまたはCapabilityを発行しない。

RepositoryはStore実装、固定相対Path、契約および試験だけを所有し、端末固有Authority Rootまたは秘密鍵を保存しない。既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 321 / 321、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／115 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 453 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。Filesystem Effectは試験fixture内だけで実行し、実Repository Runtime Root、実Authority Rootまたは秘密鍵を使用・変更していない。

### 2026-08-16 — Authority Root検索票と永続Trust／current Recordの結合候補

Repository固定Storeから検索票を安定読取りし、記録されたAuthority Rootのnon-link Directory実体を確認した後、同じRoot内の固定`.crdd-provisioning`から永続Trust floor、content-addressed Trust成果物およびcurrent Recordを再取得する結合候補を追加した。Runtime取得時刻による全署名／鍵期間／失効検証が成立したRecordだけを受理し、検索票のProvisioning Record Hashと一致させる。

さらにcurrent Recordの署名済みpayloadからAuthority Root絶対PathとIdentity Hashを再取得し、検索票の同じ2値と完全一致させる。検索票、TrustまたはRecordの欠落、pending、改変、期限外、Hash不一致、Path不一致またはIdentity Hash不一致は、旧候補や環境値へfallbackせず`blocked`へ閉じる。公開結果は検索票HashとRecord Hashの安全要約だけに限定し、絶対Path、Identity値、raw Record、canonical byte、SPKI、署名または失効entryを返さない。

本候補はRepository所有の実装、契約、固定相対レイアウトおよび試験で完結する。端末固有のAuthority Root／Trust／Recordと秘密鍵はRepositoryへ複製しない。OSが実測するAuthority Root Identity Hash、ACL／DACL等の保護、初期Trustの承認済み導入元、実active activation、Runtime AuthorityおよびCapabilityは未接続である。したがって12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の全機械確認と必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 322 / 322、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／115 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 453 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。Filesystem Effectは試験fixture内だけで実行し、実Repository Runtime Root、実Authority Root、実Trust成果物、実準備記録または秘密鍵を使用・変更していない。

### 2026-08-16 — Root Identity／保護観測HashとWindows実測結合候補

Root Identity観測成果物`crdd-coordinator/root-identity-observation`とRoot保護観測成果物`crdd-coordinator/root-protection-observation`のrevision 1を追加した。前者はWindowsのdevice ID、file IDおよびbirthtime nanoseconds、後者はfixed drive、Root role、Runtime主体Hash、role別accessおよびwriter排他を正規化する。それぞれ固有ASCII domain、uint64be canonical payload byte長、canonical payloadおよびSHA-256へ固定し、絶対Path、SID、ACLまたはraw observationをHash成果物と公開結果へ含めない。

Windows Adapter候補は固定したWindows PowerShell実体だけを非対話で起動し、Root処置前後のnon-link Directory Identity、fixed drive、全対象のreparse不在、継承保護DACL、信頼済みowner、Runtime主体のread／execute、Root role別writeおよび非承認writer不在を読み取り専用で観測する。Runtime主体は呼出側入力を受けず、Adapterを実行するWindows processのSIDから取得する。Runtime Rootは同主体だけのread／write、Authority Rootは同主体read-onlyかつPlatform管理者境界だけのwriteを要求する。観測失敗、Identity変化、非fixed drive、DACL不成立または分類不能は権限変更、自動修復、別Path fallbackを行わず`blocked`へ閉じる。

Repository固定検索票から永続Trust／current Recordを再検証する既存候補へWindows実測を接続し、検索票のIdentity Hash、Recordの署名対象絶対Path／Identity Hash／Protection Hashおよび実測2 Hashを完全一致させる。別途、current Recordを正規化済み観測Hashへ結ぶStore入口を追加し、1値でも異なる場合は候補化しない。公開結果はRecord Hash、検索票Hashおよび一致状態だけに限定し、Path、SID、ACL、canonical byte、SPKIまたは署名を返さない。

Repositoryが所有するのは実装、契約、固定domain／Schema、文書および試験である。端末固有Authority Root、実Trust成果物、準備記録、秘密鍵および実DACL状態はRepositoryへ複製しない。POSIX Root観測、初期Trustの承認済み導入元、権限Provision Effect、activation transaction、実active activation、Authority、Capabilityおよびready遷移は未実装である。既存12 blocker、6 current-run evidenceおよびGate `blocked`を縮小しない。本処置は`Applied`／`Self-checked`であり、新固定版の必要な独立レビュー前は`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseではない。

Node.js 24.19.0で、Coordinator 328 / 328、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／117 owned source closure、両private packageの型検査／Biome Lint／Formatter、および全体Checker 455 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0を確認した。Windows実Adapterの負例は試験用一時Rootを読み取り専用で観測し、権限を変更していない。実Authority Root、実Trust成果物、実準備記録または秘密鍵は使用・変更していない。

#### `0a98272`監査集合とWindows実効access境界の再整理

固定Commit `0a98272bcbcbf13c3be5d94adcf74c6c7d9b7587`／Tree `3ad75d9caa2e2d38958456e528988a7be3d6a337`／Parent `1f5d0e7e07cc410866b4d0e1674675da32633f78`を、Coordinator 328 / 328、Checker 150 / 150、命名／参照5 / 5、3 TypeScript project／117 owned source closure、両package check、full checker Error 0／Warning 0およびcleanを共通入力として固定監査集合へ渡した。Agent／Architecture／SecurityはMajor 3件でFail、DocumentはMinor 1件でConditional、Gap／ImpactはMajor 2件でFail、ConformanceはFinding 0件でPassだった。集合全体は`Invalidated`であり、Conformance単独Passを現在判定へ流用しない。

Agent監査は、PowerShellの再帰列挙がentity上限判定前に全treeをmaterializeするresource境界、Runtime SIDだけのACE集計ではgroup deny、deny-only group、restricted tokenおよびACE順序を含む実効accessを証明できない点、およびRoot観測後のcurrent Record再読取りとRoot Identity最終照合が同じ時間境界へ閉じていない点を指摘した。Gap監査は、`observedProvisioningRecordBinding`が既存`authority_root_resolution_from_provisioning_record`のsource母集団へ未接続である点と、Repository／Authority Rootのsame／inside／containsおよびlexical／realpath関係差をTrust読取り前後で拒否していない点を指摘した。Document監査は、集約Verifier単体の未接続説明と後段Windows実測候補の現行表示が競合する点を指摘した。

統合修正では、Root Identity／Protection成果物のexact pure contractとHash生成候補を維持し、Windows実Adapterだけを`not_implemented_effective_access_required`へ戻した。PowerShell ACE集計、`CreateFileW`のopen失敗または`Add-Type`を、Authority Rootへのwrite／append／delete／delete-child／write-DACL／write-owner拒否の証明へ流用しない。`Add-Type`は対応Windows PowerShellでcompilerや一時fileを発生させ得るため、read-onlyかつ`filesystemEffectIssued: false`の観測境界にも使用しない。将来の実装は、現在process tokenが実Runtime principalである文脈でgroup、deny-only group、restricted token、ACE順序およびgeneric mappingをOSに評価させ、DACL構造確認と実効access確認を分離する必要がある。外部署名helperの新設は今回承認範囲へ含めず、人間判断なしに追加しない。

検索票resolverは、RepositoryとAuthority Rootをlexical／stable realpathの双方で相互非包含に限定した。同一Root、Authority RootがRepository内、Authority RootがRepositoryを包含、relation差、linkまたはIdentity変化をTrust／current Record読取り前後で`blocked`へ閉じる。fixtureもAuthority RootとRepositoryを兄弟directoryへ是正し、same／inside／containsの負例を固定した。`observedProvisioningRecordBinding`は既存Authority Root resolution dependencyのsource正本へ追加し、専用contract testでfield母集団を固定した。第13 blockerは作らず、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行を維持する。

READMEとThreat Modelは、集約Verifier単体、検索票resolver／Root Identity／Record結合候補、および未実装のWindows実効access Adapterを分離した。過去の未接続記録は当時事実として改変せず、本節の後続判断が`0a98272`のWindows実Adapter実装済み表示をsupersedeし現在判定へ使用しない。初期Trust、POSIX観測、activation transaction、実active activation、Authority／Capability／ready、実EffectおよびReleaseは未実装のままである。

本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeに対する全機械確認とAgent／Architecture／Security、Document、Gap／Impact／Conformanceの固定監査集合が完了する前は、各Findingを`Resolved`、Runtime完成、採用、統合、準拠、StableまたはReleaseとしない。

#### `85b520d`監査集合とPlatform Provisioner実効access境界の水平是正

固定Commit `85b520dede5ec217daa66d11e44f17be0492f8e7`／Tree `9967e65f8318b93260d2fee07a8e031b1c53bf2e`／Parent `0a98272bcbcbf13c3be5d94adcf74c6c7d9b7587`を、Coordinator 330 / 330、Checker 150 / 150、両package check、full checker 455 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0およびcleanを共通入力として固定監査集合へ渡した。Agent／Architecture／SecurityはMajor 2件でFail、DocumentはMajor 1件でFail、Gap／ImpactはFinding 0件でPass、ConformanceはFinding 0件でPassだった。集合全体は`Invalidated`であり、部分Passを現在判定へ流用しない。Agent 2件は初回監査からの見落とし、Document 1件は修正起因である。

Agent監査は、Platform Provisioner Windows DACL Adapterにもentity上限判定前のPowerShell再帰全tree materializationと、runtime SIDへ直接記載されたACE集計から実効accessを成立させる同根問題が残ることを指摘した。Document監査はREADMEの2段落がWindows実効accessとProtection Hash結合を現在実装済みと過大表示することを指摘した。

水平是正では`platform-provisioner-windows-dacl`からPowerShell、FilesystemおよびDACL変更実装を撤去した。DACL構造claim evaluatorはcaller claimをPolicyへ照合する非Authorityのpure候補だけを返し、`writePolicyConfirmed`、`runtimeReadConfirmed`および`runtimePrincipalBound`を成立させない。実観測と適用入口は入力、環境、Path、PowerShellまたはFilesystemへ触れず、`not_implemented_effective_access_required`で`blocked`へ閉じる。

`coordinator provision`のcommand grammar、manifest／release／package検証およびstate codec／Store／transaction component候補は保持するが、実Effectは関数入口で停止し、配布物、時計、ProgramData、Path、Filesystem read／write、copy、DACL変更、state更新または復旧を発火しない。Runtime active release readerも同様にProgramData探索とstate／package読取り前に停止する。package gate、package Filesystem、install layout、DACL、Effectおよびreaderのcontractは同じ未実装境界へ更新し、runtime activationとdoctorは同じprivate implementation snapshotから投影する。既存`platform_provisioner_verification`／`platform_provisioner_effect`阻害依存へ残し、第13 blockerを作らず、12 blocker、6 current-run evidenceおよびGate `blocked`を維持する。

READMEとThreat Modelは、実装済みのpure／component候補と、未実装のWindows実効アクセス確認（effective access verification）、DACL適用、Platform Provisioner EffectおよびRuntime readerを分離した。Path、SID、ACL、raw errorまたは秘密を出力せず、Authority、Capability、準拠またはReleaseを成立させない。過去節の実装済み記録は当時事実として保持し、本節がそれらの現在表示をsupersedeして現在判定へ使用しない。

本変更は未公開Candidate内部の安全側是正で、永続実状態を作成できる成功経路が存在しないため`migration_required: false`を維持する。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの全機械確認と固定監査集合完了前はFindingを`Resolved`、採用、統合、準拠、StableまたはReleaseとしない。

#### `dda7f7c`監査集合とCLI helpの現在境界

固定Commit `dda7f7c3f6dbfa3d16bf8c5a994eb41f1e738ed5`／Tree `25cf845cbb2cec0b8d705394055e4bfef813ee5b`／Parent `85b520dede5ec217daa66d11e44f17be0492f8e7`を、Coordinator 330 / 330、Checker 150 / 150、両package check、full checker 455 files／288 Markdown／1867 links／561 anchors／26 Related／26 versioned documents／8 stable IDs／68 remediation rows／Error 0／Warning 0およびcleanを共通入力として固定監査集合へ渡した。Agent／Architecture／SecurityはFinding 0件でPass、DocumentはFinding 0件でPass、Gap／ImpactはMinor 1件でConditional、ConformanceはFinding 0件でPassだった。集合全体は`Invalidated`であり、部分Passを現在判定へ流用しない。Gap Finding `GCI-PLATFORM-PROVISIONER-CLI-001`は今回の修正によって新たに発生した。

Gap監査はCLI helpだけが`provision installs...`と現在導入できるように表示し、実Effect未実装のcontract、READMEおよびThreat Modelと競合することを指摘した。helpをcommand grammar候補、Provision Effect未実装、および配布物読取り、時刻、Path解決またはFilesystem Effect前の`blocked`へ更新する。`help`、`--help`および`-h`が同じ出力経路を使い、旧文0件、新文exact 1件、exit 0となることをCLI contract testで固定する。

command名、引数grammar、JSON Schema、reason／status、妥当な`provision`要求のexit 2、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability非発行および非Release境界は変更しない。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの全機械確認と固定監査集合完了前はFindingを`Resolved`としない。

固定Commit `eb58fb02cebc489f565c0c403803c0f7aba09eb5`／Tree `a26c5256aae59bfea70a8783425382dcede44285`へのAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditはすべて`Pass`／Finding 0で完了した。`DOC-ROOT-OBSERVATION-001`／`R01`、85bのAgent Major 2件、および`GCI-PLATFORM-PROVISIONER-CLI-001`は現在固定版で`Resolved`とする。旧dda以前の監査集合は履歴として保持し、現在判定へ流用しない。結果と未評価境界は[`CHG-000015_Current_Review_Record_eb58fb0.md`](Evidence/CHG-000015_Current_Review_Record_eb58fb0.md)へ接続する。監査Passから採用、統合、準拠、StableまたはReleaseを成立させない。

#### 2026-08-25 — Local Personal一般Task縦結合と`f139c3b`監査集合の是正

固定Commit `f139c3b3e47ed209b1d2c99c64ac3225dae1bb4e`／Tree `f4b16fe664bcedd8752781d1b9e0c8fe6f6084d5`を、Coordinator 626 / 626、package check、full checker Error 0／Warning 0およびcleanを共通入力として、Agent／Architecture／Security ReviewとDocument／Gap／Impact Auditへ渡した。Agent監査は旧8件中6件を`Resolved`、2件を`Unresolved`とし、新規を含むMajor 3件で`Fail`だった。Document／Gap監査はMajor 6件で`Fail`だった。Criticalは0件である。旧`eb58fb0`監査Passは当時のPlatform Provisioner候補だけの履歴であり、一般Taskの現在判定へ流用しない。

統合した是正対象は、外部送信承認画面の制御文字／非表示field、Repository所有の情報分類・処理境界Policy欠落、Scope／Task Packet Hashの配列境界衝突、選定理由のEffect前表示とcaller申告区分、Provider cleanup不明時のHost Recovery ID欠落、Candidate cleanup失敗時の孤児化、保持期限／容量／Secret境界、および独立Review指摘を是正へ接続できないapproval-only Gateである。README／Threat Model／本CHGの現行表示と、Hardened／Provisioning候補の旧blocked表示の競合も同じ集合へ含めた。

是正後のLocal Personal一般Taskは次を現在契約とする。

- 開始Commitの固定`.crdd-external-send-policy.json`を内蔵Git object readerで上限付き読取りし、情報分類、決定権限、Provider別Account／Tenant境界、Subscription、目的・操作、保持・削除、二次利用・学習、再委託および適用Terms／Policy IdentityをPolicy Hashへ結合する。不明時は送信しない。
- Objective、Acceptance Criteria、書込み範囲、読取り範囲、Provider候補、Revision、Policy HashおよびScope Hashを端末安全なcanonical JSONで全表示し、表示と送信Packetを同じ一意Hashへ結合する。配列はNUL joinせずschema固定JSONでHash化する。
- 選定EventはProvider、model、effort、速度、理由、高コスト可否と、caller申告field／Runtime実測fieldの区分をProvider Home観測およびprocess起動前へ出す。表示不能なら停止する。明示人間Policyがない`high`は自動選択しない。
- Reviewerが変更を要求した場合、上限付きFindingは公開Resultへ出さず一回限りのopaque Capabilityに保持し、最大1回だけ同一Executorへ是正Packetとして渡す。同じ独立Reviewerへ再Reviewし、二回目が承認でなければCandidateを公開しない。
- Candidate本文はRepository Policyが保存を許可した場合だけstaged保存する。保持期限は1〜168時間、Store上限は128件／256 MiB、既知Secret patternは拒否し、Credential不存在は主張しない。Operation cleanup成功後だけexport可能なIDへpublishする。
- Provider開始／完了のcleanup不明時はHost Recovery IDとDocker Recovery IDを分離して返す。Operation cleanupとCandidate discardが同時に失敗してもexport不能なCandidate Recovery IDを保持し、publish失敗でも同IDから明示discardできる。
- Local Personal一般Taskと、署名済みAuthority File Bundle／protected activationを要求するHardened／Provisioning候補を分離する。後者の未接続表示を前者の未実装根拠へ流用しない。Docker Effectは認証preflightを含むexact 9 commandであり、旧exact 7 command表示を現在判定に使用しない。

API key、従量API、追加credit購入、自動plan切替、Provider同士の直接spawn、canonical Repositoryへのcommit／merge／copy、T3／T4、Managed／Enterprise、および悪意ある同一OS User／Administrator／Kernel耐性は引き続き対象外または別Capabilityである。実装中の処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの全機械確認とAgent／Architecture／Security再レビュー、Document／Gap／Impact再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。残る実行Gateは正式署名配布物上の一般Task実runであり、Release鍵passphraseと外部送信対話承認は人間入力なしに代行しない。

##### `14717c2`監査集合の第二次是正

固定Commit `14717c2fc9ad18bd99a3f9ddeeb1ef7e27eeb9c8`／Tree `0cf30f0961008ab9ac1cc4f975a2bfd8b1ee9f78`へのAgent／Architecture／Security再レビューはMajor 6件、Document／Gap／Impact再監査はMajor 4件で`Fail`だった。Criticalは0件である。completion Promise reject時のDocker Recovery ID、Candidate永続化／publish障害、期限後の物理削除とprocess間競合、保存PolicyのEffect前表示、Provider境界の未検証値、Reviewer由来自由文の別Provider転送、およびProvider適格性を実測済みと誤認させる表示を同じ是正集合へ統合した。

第二次是正では、Candidate Storeを固定Local User一時Rootの排他lock、起動／公開入口のbounded GC、容量予約、pending／staged／publishedのexact-one Recovery、冪等publishおよびRecovery IDによるdiscardへ閉じた。期限後はexportを拒否し、物理削除は明示discardまたは次回の安全な入口で行う。常駐serviceを持たないため期限瞬間の削除は主張せず、stale lock、unknown entryまたは所有不明状態を推測処置しない。永続化の中間障害をWorkspace Runtimeが`staged`へ誤標識しないよう修正し、Coordinatorはcleanup後にRecovery IDで自動discardできた場合だけ手動Recovery要求を解除する。

外部送信Policy revision 2はRepositoryからの提案に限定し、`enabled`、Candidate分類／保持／物理削除、選択Local User専用Provider Home Session、CodexのChatGPT Subscription OAuth、Claude Max、およびRuntimeがProvider Terms本文とexact Account／Tenantを検証しない境界を閉集合へ固定した。fail-closedな導入例を`template/`へ追加し、Repositoryごとの人間設定とCommit固定をREADME／導入規則へ接続した。公式CLIの読取り専用preflightはCodexの`Logged in using ChatGPT`とClaudeの`subscriptionType=max`をPolicy Offeringへ厳密照合し、別OfferingまたはAPI keyではProvider request前に停止する。

Reviewerの自由文は公開Resultと別Provider向け是正Packetの双方から除外し、`path`、閉集合の`severity`およびdomain-separated `messageSha256`だけを、同一分類・同一Executor・最大64件・最大1回の派生転送Scopeへ結合した。ExecutorはReviewer文を命令として受けず、Workspace、Acceptance CriteriaおよびTestから是正を再構成する。Provider経路のEffect前Eventは実適格性の証明ではなく、Provider Home、配布物、Policy、認証preflightおよびrequest内quotaをdeferredとした事前選定候補へ改めた。Provider request開始後の失敗を同一Operationで別Providerへ自動再送せず、cleanup後の新Operationへ戻す。

Node.js 24.19.0でCoordinator 646 / 646、private packageのstrict typecheck／Biome Lint／Formatter、Coordinator Task、Delegation Route、Docker Process Controllerの重点coverage、および全体Checker 672 files／386 Markdown／2164 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0を確認した。`git diff --check`もPassした。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの独立再レビューと再監査前はFindingを`Resolved`、Runtime完成またはPR最終候補としない。正式署名配布物上の一般Task実runにはRelease鍵passphraseと外部送信の対話承認が必要なため、人間不在中は実行しない。

##### `acc418f`監査集合の第三次是正

固定Commit `acc418fad38a5ca7f976250511632fd4cd8d57f7`／Tree `09eed4d9bbae31ad3df2eedd9c6244719181a1f0`へのAgent／Architecture／Security再レビューはMajor 3件、Document／Gap／Impact再監査はMajor 3件／Minor 1件で`Fail`だった。Criticalは0件である。前節までのProvider／Policy／期限／永続化／Reviewer／選定に関する指摘は同固定版で解消を確認した一方、Candidate Storeのproduction Rootが`TEMP`／`TMP`へ依存して選択ユーザーowner／DACL／fixed volume／non-reparseを証明しないこと、人間向けCLIがCandidateとRecovery情報を落とすこと、および個別discardが無関係な全体GC失敗へ依存してstale file lockの安全な回復経路を持たないことが新たに残った。READMEの期限後削除、固定Provider imageおよび配布`template/AGENTS.md`の物理削除表示も現在実装と不一致だった。

第三次是正では、Candidate Storeを選択ローカルユーザーのWindows Known Folder配下の固定`Qual-Lab\CRDD\CandidateStore`へ移し、native helperがfixed volume、non-reparse chain、安定Identity、選択ユーザーowner、および選択ユーザー／SYSTEMだけのprotected DACLを初期化時と各処置後に確認する。既存の不正保護状態を自動修復しない。process間排他は選択ユーザーSID、Store実体およびexact保護状態へ結合したProtection HashからWindows named-pipe kernel objectを導出し、同じユーザーの別ログインSessionも同じlockを共有する。owner process終了時はOSがobjectを解放するため、productionはstale lock fileとage-based deletionを持たない。

Candidate IDによる個別discardは全体GCから分離した。unknown／damaged regular fileはfile名と安定Filesystem Identityへ結合したCandidate Store Recovery IDを返し、明示`candidate recover-store --recovery-id ... --confirm`が現在のexact 1実体と再照合できた場合だけ削除する。取得後に実体が変化したID、複数一致、非regular entry、判定不能またはcleanup不明は上書きせず`manualRecoveryRequired`へ閉じる。Task／Candidateの人間向け表示はCandidate ID、export期限、Host／Docker／Candidate／Candidate Storeの各Recovery IDおよび手動回復要否を保持し、raw Provider出力、PathまたはCredentialらしい未知fieldを投影しない。CLI入力Schemaの誤用はCandidate Store起動GCより先に判定し、個別discard／recoverは無関係な起動GCを前置しない。

README、Threat Modelおよび配布`template/AGENTS.md`は、期限後export拒否と次回安全入口のbounded物理削除、Candidate Store保護、固定Provider imageの接続済み状態および`candidatePhysicalDeletion`の確認義務へ更新した。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの全機械確認と同じAgent／Architecture／Security再レビュー、Document／Gap／Impact再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実runには引き続きRelease鍵passphraseと外部送信の対話承認が必要であり、人間不在中は実行しない。

Node.js 24.19.0のCandidate Store重点coverage最終値は、Nodeが同一processで収集できた対象4 source合計でline 75.27%、branch 71.07%、function 81.82%だった。`command-report.ts`は三指標100%、`candidate-bundle-store.ts`はline 76.83%／branch 73.00%／function 81.54%、kernel lockはline 77.63%／branch 80.00%／function 75.00%、Windows adapterはline 58.82%／branch 36.67%／function 83.33%である。別Worker processでkernel objectを所有する`candidate-store-lock-worker.ts`は同一processのcoverage表へ集計されないため、親process強制終了後の再取得を含む契約試験で確認した。100%未達は、固定署名Release以外から成功させないproduction adapter、実OS helperのtimeout／artifact差替え／処置後Root差替え、kernel objectのrelease timeout、およびFilesystem APIの稀なrace／close failureをtest hookでproductionへ開放していないためである。残るriskは稀なOS／Filesystem failureのreasonまたはRecovery ID分類差で、代替確認はsource checkoutのEffect前停止、native protocol正負試験、process強制終了後のkernel lock再取得、stable identity差替え拒否、全659試験、Rust全試験／Clippy／PE／coverageおよび正式署名一般Task runとする。担当責任者はQual-Lab、現在追加の人間判断は不要、再確認条件は正式署名run、production adapterの安全なdependency分離、Candidate Store wire／Root保護／回復方式またはNode coverage capabilityの変更時とする。数値だけから品質成立を推定せず、独立再レビューの判定を維持する。

第三次是正後の機械確認では、Node.js 24.19.0でCoordinator 659 / 659、private packageのstrict typecheck／Biome Lint／Formatter、Candidate Store重点試験18 / 18を確認した。platform-accessはRust全試験、worker／native bootstrapのClippy、`cargo fmt --check`、再現可能release build、PE検査、Rust coverageおよびTypeScript coverageを確認した。全体Checkerは680 files／386 Markdown／2164 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。これらは固定版作成前の`Applied`／`Self-checked`根拠であり、独立再レビューと再監査を代替しない。

##### `da1711f`監査集合の第四次是正

固定Commit `da1711f91dca1b870f91bf86b514ab69bef9e20a`／Tree `9b6277d21774e6f756ca7e94ab5a5b6cf89ee02f`へのAgent／Architecture／Security再レビューはFinding 0件で`Pass`、Document／Gap／Impact再監査はMajor 2件／Minor 1件で`Fail`だった。Candidate Store Root、回復およびCLI表示の指摘は同固定版で解消した一方、Provider Homeの排他がprocess-local mapだけで別process／別login sessionを防がないこと、一般TaskがHost recovery tokenをDocker recovery IDとして返してFake Probe recoveryへ誤配送すること、および最終結果がCandidateの`expiresAtMs`を落とすことが残った。Criticalは0件で、現在追加の人間判断は不要と判定した。

第四次是正では、Authorityが使うSID＋Authentication LUIDのsession bindingを維持したまま、SID＋Provider＋固定logical Provider Home namespaceだけからsession非依存のstable binding Hashをnative observerで生成する。Provider Home Identity、保護、Authority session bindingおよびstable logical bindingを別Hashとしてfresh観測へ再結合する。選択ユーザーのKnown Folder配下へ固定`Qual-Lab\CRDD\RuntimeState` Rootを追加し、Candidate Storeと同じfixed volume、non-reparse chain、安定Identity、選択ユーザーowner、および選択ユーザー／SYSTEMだけのprotected DACLを署名済みnative helperが処置前後に確認する。

Docker Effect直前から終了まではstable logical Home binding由来のWindows named-pipe kernel lockを保持し、同じHomeのprocess間／login session間同時mountを拒否する。RuntimeStateにはlogical Homeごとのactive pointerとnonce別Task回復Directoryを分離して耐久化する。各Docker createの送信前にsubmission marker、成功直後に完全Docker ID receiptを書き、通常cleanupと明示回復はID、name、ownership label、imageおよびNetwork属性が全一致する資源だけをID指定で削除する。送信済みでID receiptがない場合、foreign／unknown資源、設定差またはflush／Identity不明は、名前から自動採用・削除せず手動回復へ閉じる。

一般Taskの回復IDは`docker-task.<logical-home-hash>.<operation-nonce>.<base-hash>`とし、Fake Probeの`docker.*`およびHostの`host.*`からCLI dispatchを分離する。Task起動前はRuntimeStateを128 entry上限で監査し、残存Task recordから再構成したexact recovery IDを返して新しいProvider Effectを停止する。crash回復では同じlogical Home kernel objectの取得を元process世代不在の必要条件とし、exact Docker不存在、crash mount absence、Host recovery lineageおよびactive pointerを順に確認する。通常mount completionとcrash absenceは別Evidenceとし、Task recordはHost Operation cleanup成功後まで残す。通常完了でもDocker finalization capabilityをTask Runtime内部だけに保持し、Host cleanup後にRuntimeState recordを削除できた場合だけCandidateをpublishする。Candidate Storeが返す安全な`expiresAtMs`は最終結果と人間向け表示へ伝播する。

Provider Home protocolはrevision 3へ移行し、request／response magic、固定response長、RuntimeState provider種別およびstable logical binding Hashを旧revisionへaliasせず検査する。これにより正式署名Releaseのnative artifactとmanifestは再生成・再署名が必要であり、人間不在中は署名、passphrase入力、OAuth、外部Provider送信、PR統合またはReleaseを実行しない。

本処置は`Applied`／`Self-checked`である。新固定Commit／TreeへのCoordinator全試験、private package check、Rust全試験／Clippy／format、全体Checkerおよびdiff checkを完了した後、同じAgent／Architecture／Security再レビューとDocument／Gap／Impact再監査を固定集合として再実行する。それらが完了する前はMajor／Minorを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実runは監査Pass後の人間操作待ちとする。

通常cleanupとcrash回復の期待Docker構成照合は、ID、name、ownership label、imageおよびNetworkの`Internal`値だけでは成立させない。bridge／local Network、containerの非特権、read-only root filesystem、全Capability drop、`no-new-privileges`、固定PID上限、固定UID／GID、目的別のexact Network membership、bind mountの目的地／read-write／`rprivate`、およびproxyの固定tmpfsを照合する。どれかが分類不能または不一致ならIDが正しくても自動削除せず停止する。

水平伝播では、ルートREADMEはCRDD全体の価値と採用入口、`template/AGENTS.md`は採用Repositoryの人間判断とCandidate物理削除義務、外部送信Policy例は送信・保持Policy、Provider Result SchemaはProvider payloadを所有するため、Runtime内部のlogical Home lease、Docker回復tokenおよびCoordinator結果の`expiresAtMs`を新しいfieldとして重複所有させない。現在契約を所有するCoordinator README／Threat Model、本CHG、Runtime実装・CLI・報告投影および試験だけを更新対象とする。この非該当判定は、各成果物の既存責務を変更せず、外部送信Policy、Provider Result Schemaまたは配布導入規則の変更として扱わない。

##### `9881843`監査集合の第五次是正

固定Commit `98818435b872025fe4bd6da056f72661f51518e4`／Tree `ba5a48d769d64e6557f94f07510b4a3ba08a8cd0`へのAgent／Architecture／Security再レビューはCritical 1件／Major 5件で`Fail`、Document／Gap／Impact再監査はMajor 5件／Minor 2件で`Fail`だった。前固定版までのProvider Home process間排他、Task専用Recovery IDおよびCandidate期限伝播は解消した一方、完了済みTask Aの回復が同じHost状態を共有する後続Task Bを変更できること、Windows directory `fsync`、Task／Host owner世代と完全inventory、回復用Docker configのTrust、exact ID不存在時のexact name確認、Host cleanupとRuntimeState finalization間のWAL、古いGrantによる後続Grant entryの削除、および安全な人間向け回復表示が残った。現在追加の人間判断は不要であり、部分Passは現在判定へ流用しない。

第五次是正では、一般TaskがHost Operation単位のWindows kernel owner generationをEffect前に取得し、明示回復は同じowner generationを取得できる場合だけHost状態へ触れる。Host management領域にはexact recovery ID／base Hash／nonceのactive run bindingを置き、通常完了とcrash回復の双方で同じHostを参照する全Task記録とactive pointerを走査する。旧Task、複数回復記録、unknown entry、別active bindingまたは不完全な同Host runがあれば推測せず停止する。人間による別process回復へ渡す際はTask process内のHost／logical Home lockを明示的に放棄するが、耐久記録は残してAuthorityをRecovery IDへ限定する。

RuntimeState記録は、file `fsync`と再読取り済みbase、base Hashへ結合したcommit、pointer Hash／Identity、Host active run binding、submission markerおよびDocker ID receiptの順へ変更した。WindowsではNode.jsがdirectory handleの`fsync`を受理しないため、v1の保証範囲を正常OS上のprocess crash回復と明示し、電源断後の完全耐久性を主張しない。通常Host cleanup前にcleanup intent、Host領域とmarkerの不存在確認後にcleanup receiptを書き、receiptと全inventoryが成立した場合だけTask記録を削除する。回復用Docker CLIはRuntimeState内の新規空configだけを使い、Host／Provider／callerのDocker設定を読まない。

Docker資源はID、name、ownership label、image、mount、hardeningおよびNetwork構成を照合し、削除後はexact IDとexact nameの双方の不存在を要求する。復旧記録、pointer、commitおよびreceiptはexact key、bounded canonical JSON、安定IdentityとHashで読み、raw filesystem errorまたはPathを公開reasonへ流さない。CLIの非JSON表示も安全な固定reason、exact Recovery IDおよび次の明示回復commandを保持する。

Provider Home観測の四Hashはpairwise distinctを要求し、Mount Grant useへstable logical Home binding Hashを追加した。古いGrantのcomplete／revokeは、そのGrant自身が現在のactive mount ownerである場合だけactive entryを削除でき、後続Grant Bを消さない。Mount Grant Core／Runtime、Docker Recovery、Docker Effect、Process ControllerおよびCoordinator Taskのcontract revisionを更新し、旧revisionを現行成功経路へaliasしない。

本処置は`Applied`／`Self-checked`であり、新固定Commit／TreeへのNode.js 24全試験、重点coverage、private package check、全体Checkerおよびdiff checkを完了した後、同じAgent／Architecture／Security再レビューとDocument／Gap／Impact再監査を固定集合として再実行する。それらがすべて完了する前はCritical／Major／Minorを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

##### `6b6cf6d`監査集合の第六次是正

固定Commit `6b6cf6d1c7014ba95fd5435a8242f8df05d0beab`／Tree `64f8de`へのAgent／Architecture／Security再レビューはMajor 5件／Minor 1件、Document／Gap／Impact再監査はMajor 4件／Minor 1件で`Fail`だった。Criticalは0件である。WAL記録のfinal filenameへの直接書込み、Host markerが既にexpected successorまたはintent時点のpreviousである回復境界、RuntimeStateのexact inventory不足、複数Docker Recovery IDのTask／CLI伝播欠落、別logical Homeまで停止する全体block、Provider開始前の回復handoff欠落、production相当のprocess強制終了matrix不足、selected-user RuntimeState bindingの再確認不足、およびREADME／Roadmapの状態競合を一つの是正集合へ統合した。現在追加の人間判断は不要であり、部分結果を現在判定へ流用しない。

第六次是正では、Docker Taskの全durable JSONをfsync済みtemporary、安定再読取り、atomic renameおよび内容Hash／Filesystem Identity／byte数／logical keyへ結合したcommit sidecarへ変更する。targetだけが確定した状態、orphan temporary、余分なfilename、上限超過、非canonical JSON、Schema／Hash／Identity差は通常実行へ進めず保持してfail closedにする。RuntimeState全体の固定Windows kernel lock下でroot、logical Home、active pointer、operation／cleanup Directory、base／commit、Docker config、Host binding、submission、receipt、cleanup intent／receiptをexact inventoryし、selected-user bindingを最初の書込みとHost Effect前に再確認する。

同じlogical Homeのactive記録だけを新Effectの阻害条件とし、別logical Homeの完全な記録は同時存在を許す。全体inventoryがunknown／partial／uncommittedなら全Taskを停止する。回復対象Directoryは完全照合後に固定cleanup tombstoneへatomic renameし、削除途中でprocessが終了しても同じRecovery IDで再開する。Host markerは初期Host root／nonceへ再結合し、intentのprevious、expected successor、第三状態を分離する。previousは未送信またはcrash cleanupへ、expectedはreceipt補完へ進め、第三状態やownership不明では上書きしない。

Process Controllerは最初のDocker commandより前にopaqueな回復CapabilityとRecovery IDをTask Runtimeへhandoffし、handoff失敗時はProvider Effectを開始しない。正常finalizationは同じCapability objectだけを受理し、cleanup不明時は登録済み全handoffをexact-onceで放棄する。Task／CLI／安全な人間向け報告は複数Docker Recovery IDを保持し、現在失敗したTaskを先頭に各exact doctor commandを示す。RuntimeStateの共有production parserを実試験でも用い、別Home複数記録、active-first順序、unknown／uncommitted全体block、cleanup tombstone再開、およびchild processをtemporary fsync後・target rename後・commit rename後に強制終了するmatrixを追加した。

Coordinator README、Threat Modelおよび実装残件台帳は、第六次是正の状態、両Provider Adapter接続済み、process crashと電源断の保証差、および再レビュー／再監査前は未完了である境界へ揃えた。本処置は`Applied`／`Self-checked`である。機械確認、固定Commit／Tree、同じAgent／Architecture／Security再レビューおよびDocument／Gap／Impact再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

第六次是正の固定版作成前機械確認では、Node.js 24のCoordinator全673試験、private package strict typecheck／Biome Lint／Formatter、Docker回復重点42試験、Coordinator Task重点31試験、およびjournal強制終了matrix 7試験を確認した。journal単体coverageはline 91.59%／branch 71.88%／function 84.62%で、固定閾値90%／70%／80%を満たす。platform-accessはRust全試験、両binary Clippy、`cargo fmt --check`、再現可能release build、PE検査、Rust coverageおよびTypeScript coverageを再確認した。全体Checkerは682 files／386 Markdown／2165 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。これらは`Applied`／`Self-checked`の根拠であり、固定版の独立再レビュー／再監査を代替しない。

##### `6779777`監査集合の第七次是正

固定Commit `6779777f3eea90b44c15c4a2276ba20330abe5c2`／Tree `44accd3541f712e6af5431731f3567759bc4844c`へのAgent／Architecture／Security再レビューはCritical 0件／Major 7件で`Fail`、Document AuditはFinding 0件で`Pass`、Gap／Impact＋Conformance再監査はMajor 1件で`Fail`だった。commit pair削除がprocess crash後に再開できないこと、RuntimeState inventory／mutationのlock範囲と順序、caller supplied Root Pathを受けるproduction parser、submission／receiptのcommit・purpose照合、cleanup tombstoneのfilenameだけによる回復、finalized済みDocker IDの再出力、およびproduction crash matrix不足を一つの是正集合へ統合した。Issue #30はCommunication／Market／Adoptionの別follow-upであり、本変更の解消またはclose対象ではない。現在追加の人間判断は不要で、部分Passを現在判定へ流用しない。

第七次是正では、commit pairの削除と移動を、親Directory Identity、logical key、元serialized content、Hash、Filesystem Identityおよびbyte数へ結合した単一atomic intentへ変更した。deleteは`full pair → content absent → pair absent`、moveは`source full → content moved → target full`の到達可能状態だけをproduction共用の純粋状態機械で再開する。intent生成中のprocess終了は決定的pending anchorから再開し、第三状態、同名replacement、未知SchemaまたはIdentity／内容差では上書きせずEvidenceを保持する。

Operation cleanupは、元entry全件のtype／Hash／Identity／byte数、空Docker config Directory Identity、元Operation Directory Identityおよび期待cleanup basenameをcommit済みmanifestへ固定する。manifest追加後に元inventory＋manifest pairを全数再照合し、同一Identityのままcleanup Directoryへatomic renameする。payload削除前にRuntimeState Root側へDirectory Identity、Recovery IDおよび全entry evidenceを結合した単一cleanup anchorを確定し、成功時だけpayload、Directoryおよびanchorを残存0へ閉じる。process終了後はmanifestまたはRoot anchorをAuthorityとして再開し、unknown／replacement／判定不能ではrecursive deleteを行わない。

RuntimeStateのproduction inventoryはcaller supplied Path入口を廃止し、Runtime所有のselected-user Known Folderから取得したRootだけを固定kernel lock下で読む。Host状態を扱う回復はlock-freeのbounded base discoveryをHost owner世代の識別だけに使い、`Host Operation → logical Home → RuntimeState`の順に排他を取得した後、Root Identity、token、base、journal intentおよび全inventoryを読み直す。Host Effectが既に不存在でcleanupだけが残る段階は`logical Home → RuntimeState`で残骸除去だけを再開する。beginは外側Operationが保持するHost owner世代の内側で`logical Home → RuntimeState`を取得し、逆順に解放する。

Docker submission／receiptは両方をcommit sidecar付きcanonical JSONとして読み、filenameのpurposeとrecordのpurposeを完全一致させる。Host intent／receiptはcurrent／expected token、root、nonce、current／next stateおよびprevious／observedを相互照合する。Task RuntimeのDocker handoffは`active`、`finalizable`、`finalized`、`abandoned`を区別し、`finalized`だけを未解決Recovery ID集合から除く。先行handoffがfinalize済みで後続だけが失敗した場合は後続IDだけを返し、全handoff finalize後のCandidate persist／publish失敗へDocker IDを再混入しない。`abandoned`は手動処置可能なIDとして保持する。

process強制終了matrixは、元record commit生成の`fsync`／target rename／commit renameに加え、delete intentのanchor `fsync`／rename／content削除／commit削除、move intentのanchor `fsync`／rename／content移動／commit移動／anchor削除、cleanup anchorの`fsync`／rename／payload部分削除／Directory削除後を実child processで中断する。既知状態はexact targetまたは残存0へ再開し、第三状態、unknown entry、競合anchorおよび変更済みempty DirectoryはEvidence保持＋fail closedへ分離する。純粋move状態機械は16 Boolean組合せのうち到達可能3状態だけを許可する。

本処置は`Applied`／`Self-checked`である。現時点の機械確認ではCoordinator全684試験、Docker回復重点44試験、Coordinator Task contract 23試験、journal強制終了／第三状態matrix 13試験、private package strict typecheck／Biome Lint／FormatterをPassした。journal単体coverageはline 100.00%／branch 72.04%／function 100.00%で、固定閾値90%／70%／80%を満たす。platform-accessはRust全試験、両binary Clippy、`cargo fmt --check`、再現可能release build、PE検査、Rust coverageおよびTypeScript coverageを再確認した。全体Checkerは684 files／386 Markdown／2165 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。新固定Commit／Treeへの独立Agent／Architecture／Security再レビューおよびDocument／Gap／Impact再監査がすべて完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

##### `93d54b2`監査集合の第八次是正

固定Commit `93d54b256427158acaba6d549c978a921c84d41a`／Tree `e2310cda4de515c949035a1782bb0c17884e15e9`へのAgent／Architecture／Security再レビューはCritical 0件／Major 5件／Minor 1件で`Fail`、Document／Gap／Impact再監査はMajor 3件／Minor 1件で`Fail`、ConformanceはFinding 0件で`Pass`だった。Root journalのdelete／move intentからprocess終了後にRecovery IDを再構成できないこと、通常完了・cleanup・finalizeを含むRuntimeState mutationの排他範囲、長いDocker／Host Effect中の全体lock保持、Candidate中間障害時のfinalized済みDocker ID再出力、Host intentの決定的successor証明、production回復経路を直接通す強制終了matrix、および旧CHGの履歴上の残件表示が現在残件に見える点を一つの是正集合へ統合した。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第八次是正では、Root journalのcleanup、deleteおよびmove intentが保持するbase／pointer内容とcommit evidenceからexact Docker Recovery IDを再構成する。anchor filenameのdigest、logical key、content Hash、Filesystem Identity、byte数およびcommitの意味を相互検証し、改名、複製、内容とcommitの意味不一致または不正anchorを回復Authorityへ昇格しない。process強制終了試験は、base moveとactive pointer deleteの途中状態からRootだけを走査して同じRecovery IDを再発見できることを確認する。

RuntimeState mutationは同じproduction kernel lock controllerへ接続し、通常のsubmission／receipt／resource／absence／mount記録、完了、cleanupおよびfinalizationも排他外で書き換えない。Docker CLIまたはHost recoveryのような長いEffectだけはHost Operation／logical Home owner世代を保持したまま全体RuntimeState lockを一時解放し、Effect後に同じlockを再取得してRoot Identity、selected-user binding、journalおよび全inventoryを再検証する。第三者の競合、再取得不能または再検証不成立では次のmutationを発生させない。

Host transition intentはEffect前のexact record、現在token、期待successor token、rootおよびnonceへ結び、純粋な決定的validatorが現在状態から唯一の期待successorを再構成できる場合だけEffectまたはreceipt補完へ進む。Task Runtimeは各時点のactionable handoff集合を再計算し、finalized済みIDをCandidate persist／publish／discardの後続障害へ再混入させない。隔離試験Runtimeで完了済みhandoffに別finalization依存がない場合も同じ完了意味を用いる。

Coordinator README、Threat Modelおよび実装残件台帳は、第八次是正の実装済み境界と、production `recoverRuntimeOwnedDockerTask`／CLIを直接通してselected-user binding、Host previous／expected／第三状態、同一／別logical Home、複数Recovery ID、exact Docker構成／削除および残存0を一つの強制終了matrixで確認する残件を分離した。`CHG-000050`から`CHG-000053`の旧「残件」は各固定時点の履歴であり、現在状態は本変更とRoadmap 08を参照する。Issue #30は`CHG-000013`が所有するCommunication／Market／Adoptionの別follow-upであり、本変更によって解消またはcloseしない。

本処置は`Applied`／`Self-checked`である。Node.js 24のCoordinator全692試験、追加したRoot Recovery ID process強制終了試験、Host transition pure contract、RuntimeState lock controller process間試験、Coordinator Taskの例外境界、Docker回復重点22試験、Coordinator Task重点35試験、Docker Process Controller重点50試験、private package strict typecheck／Biome Lint／FormatterをPassした。Docker回復重点coverageはline 99.66%／branch 75.78%／function 100.00%で、固定閾値90%／70%／80%を満たす。全体Checkerは689 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。production回復経路の直接matrix、固定Commit／Tree、および同じ独立再レビュー／再監査は未完了である。これらが完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

##### `a2d8187`監査集合の第九次是正

固定Commit `a2d81875675eea89e390308a2b36686726cc80d7`／Tree `f4cea94ab19f34742739ba526595cab718614ac1`へのAgent／Architecture／Security再レビューはCritical 0件／Major 2件で`Fail`、Document AuditはMajor 1件で`Fail`、Gap／ImpactはMajor 2件／Minor 1件で`Fail`、ConformanceはFinding 0件で`Pass`だった。前回のRoot Recovery ID、finalized ID再出力、Host deterministic successorおよびanchor／commit semanticは解消した一方、全体lock再取得後のRoot／selected-user／全inventory再検証、production回復本体と実CLIを直接通すmatrix、README内の旧現在表示、および同期資源の解放確認が残った。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第九次是正では、Docker Recovery Runtime contractをrevision 5へ更新する。通常完了、cleanup、finalizeおよび明示回復の全RuntimeState mutationは、短いglobal lock取得後にRuntime-owned native observationを再取得し、Root Path、Filesystem Identity Hash、Protection Hash、selected-user `localUserBindingHash`、RuntimeState binding Hash、対象Recovery IDおよびbounded full inventoryを再照合してからだけ処置する。長時間Docker／Host Effect後も同じ再検証を繰り返し、別Homeの完全recordだけを許容し、unknown／partial／replacementまたは別selected-userでは次のreceipt／cleanup mutationを発生させない。

RuntimeState、logical HomeおよびHost generationの同期資源は、回復結果の返却前に解放結果を確認する。解放不能または確認不能では、Docker／Host処置が収束していても成功を返さず、同じRecovery IDを保持した`blocked`へ閉じる。同期資源の解放確認を、mtime、stale推定または後続Operationの失敗へ委ねない。

production wrapperがnative Root Capabilityを供給するpackage-private共有engineを分離し、公開package facadeへcaller PathやAuthority injectionを追加しない。同じengineを実file、実child process killおよびWindows kernel lockで直接駆動し、Host Effect直前のprevious、receipt確定後のexpected、third state非上書き、selected-user再結合不一致、cleanup途中からの残存0、same Home exact-one、別Home非競合を確認する。Docker回復のexact ID／name／label／image／mount／hardening／Network照合もproductionと同じ関数へ閉じたrunnerで直接確認し、全構成一致時だけ削除し、replacementでは削除0とする。通常完了はDocker不存在、mount完了、Host successor、lease解放、Host cleanup intent／receiptおよびfinalizeを本番関数で順に通し、receipt前finalizeを拒否して成功時にRuntimeState／Host残存0へ閉じる。複数IDの全件投影はTask Runtimeと安全な人間向けreport、実CLI child processは`docker-task.*` dispatchのJSON／人間表示、exact Recovery ID、固定reason、次commandおよびHost Path非表示を確認する。production本体とCLIを明示coverage対象へ追加する。

README、Threat ModelおよびRoadmap 08は、production共有engineで確認済みの範囲と、固定版作成後に残る独立再レビュー／再監査および正式署名一般Task実runを分離する。process-kill／2-process代表matrixはHost previous／expected／third、selected-user再結合、same／other Home、cleanup中断、exact Docker cleanup／replacement、通常完了、複数ID投影および実CLI dispatchへ分解し、各Authority境界の直接試験へ接続した。過去CHGの履歴は書き換えず、Issue #30を本Runtime変更でcloseしない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全705試験、production回復／実CLI重点16試験、Docker journal重点24試験、Coordinator Task重点35試験、Docker Process Controller重点59試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageはline 99.67%／branch 76.43%／function 100.00%で固定閾値90%／70%／80%を満たし、production回復本体の直接coverageはline 73.86%／branch 52.71%／function 83.47%だった。全体Checkerは692 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。固定Commit／Treeと同じ独立再レビュー／再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

##### `617b11a`監査集合の第十次是正

固定Commit `617b11a292bcf589c499ca99c2ac230d6dfd337a`／Tree `e10a446d2d01bd04d7b2d24cd99bc19b554d2adf`へのAgent／Architecture／Security再レビューはCritical 0件／Major 4件／Minor 1件で`Fail`、Document AuditはMajor 1件／Minor 3件で`Fail`、Gap／Impactは同じ初回RuntimeState mutation境界をMajorとして`Fail`、ConformanceはFinding 0件で`Pass`だった。初回base／pointer／Host begin、journal resume、cleanup tombstone／manifest削除が作成時RuntimeState bindingの耐久Evidenceへ再結合する前に発生し得ること、effectful contract-test seamの公開面、同期資源の一部解放失敗後に残りを試さないこと、CLI／2-process／cleanup-only selected-user matrix、production coverage固定閾値、およびNode.js検証版の記録差を一つの是正集合へ統合した。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第十次是正では、Docker Recovery Runtime contractをrevision 6へ更新する。作成時RuntimeStateのIdentity Hash、Protection Hash、selected-user `localUserBindingHash`およびRuntimeState binding Hashをbaseへ固定し、Operation cleanup manifestとRoot cleanup anchorまで同じEvidenceを伝播する。beginはlogical Home／RuntimeState lock取得後にRuntime-owned observationを再取得し、初回のpending base書込みより前に作成候補と完全一致させる。明示回復はbase、cleanup manifestまたはcleanup anchorを読み取り専用で発見し、その作成時Evidenceと現在のnative observation、対象Recovery IDおよびbounded inventoryを照合してからだけjournal resume、rename、deleteまたはcleanupを行う。cleanupだけが残る段階も旧selected-user Evidenceがなければ推測削除しない。

RuntimeState、logical HomeおよびHost generationの解放は、純粋な同期解放状態機械で全対象を必ず試し、最初の失敗理由と同じRecovery IDを保持して`blocked`へ閉じる。beginでRuntimeState lock解放が確認できない場合は、ready capabilityを無効化してlogical Home leaseも解放対象へ戻す。production回復重点coverageにはline 65%／branch 45%／function 75%の固定下限を追加した。packageはprivateかつ`main`／`exports`を持たない既存境界を維持し、caller Root／observerをproduction wrapperやCLIの引数へ追加しない。正式配布の起動Authorityは引き続きnative observationを消費するproduction wrapperだけが持つ。

追加matrixは、cleanup-only selected-user再結合不一致を削除前に停止する例、lock取得後のbegin再結合不一致を初回記録前に停止する例、および一つのreleaseがthrow／falseでも後続releaseを全試行する例を含む。本処置は`Applied`／`Self-checked`であり、新固定Commit／Treeへの全試験、重点coverage、private package check、全体Checkerおよびdiff checkを完了した後、同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査を固定集合として再実行する。それらが完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。

第十次是正の固定版作成前機械確認では、Node.js 24.19.0のCoordinator全708試験、production回復／実CLI重点18試験、Docker journal／状態機械重点25試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。production回復＋実CLI coverageは全体line 68.15%／branch 53.46%／function 78.47%で固定閾値65%／45%／75%を満たし、回復本体はline 74.18%／branch 56.53%／function 82.84%だった。Docker journal重点coverageは全体line 99.68%／branch 77.12%／function 100.00%で固定閾値90%／70%／80%を満たす。全体Checkerは692 files／386 Markdown／2175 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。これらは`Applied`／`Self-checked`の根拠であり、新固定Commit／Treeへの独立レビュー／再監査を代替しない。

##### `2db635a`監査集合の第十一次是正

固定Commit `2db635abb9fb7eb128a5a876869f96bac505a36b`／Tree `97b442b669bebdd8ffc4a86afd1b909c2e23e35a`へのAgent／Architecture／Security再レビューはCritical 0件／Major 5件で`Fail`、Document AuditはMajor 2件／Minor 1件で`Fail`、Gap／ImpactはMajor 2件で`Fail`、ConformanceはFinding 0件で`Pass`だった。対象Recovery IDの作成時bindingを確認した後にRoot全journalを再開して別Taskを変更できること、通常Host cleanup／Host doctor／RuntimeState inventoryで同期解放失敗を成功へ投影できること、caller Root／observer／runner付きeffectful seamがmodule exportのままであること、Evidence 0件の任意tokenを完了済みと推測すること、CLI／独立2 process／exact Docker統合matrixの不足、およびREADME／Roadmapに旧現在状態を重ねたことを一つの是正集合へ統合した。現在追加の人間判断は不要で、部分Passを現在判定へ流用しない。

第十一次是正では、Docker Recovery Runtime contractをrevision 7へ更新する。Root kernel lockはbounded inventoryの直列化だけに用い、Root journalの再開は対象Recovery IDと作成時RuntimeState bindingを必須入力とするtarget-scoped APIへ置換した。全anchorを最初のmutation前に検証し、対象だけを再開する。validな別Task anchorはserialized byteとFilesystem Identityを再確認して保持し、ID再構成不能、同一IDのbinding不一致、競合または第三状態では対象処置も開始しない。開始時点でbase、cleanup manifest、cleanup anchorまたは同等のexact Evidenceが0件なら、空Rootを完了receiptの代用にせず`docker_task_recovery_evidence_missing`へ閉じる。Task A／Bを同じRootへ置くproduction共有engine試験は、Aの回復後にBのanchor、payload、HashおよびFilesystem Identityが不変であることを確認する。

通常Host cleanupはOperation root消滅後、外部marker削除前にprocess-local Host generationの解放を確認する。確認不能ならmarkerを残し、同じHost tokenによるdoctor再開へ渡す。直接Host doctorは自分が取得したgenerationを解放確認してからexact markerを削除し、false／throwでは`recovered`を返さない。RuntimeState inventoryもlock解放確認後だけ暫定inventoryを返し、false／throwを`docker_task_runtime_state_lock_release_unconfirmed`へ固定する。Kernel lock Workerの応答抑止を使った試験は、通常cleanupとHost doctorが成功を返さずmarkerを保持し、次の同じtokenで残存0へ収束することを確認する。

production `docker-recovery-runtime.ts`はnative observationを内部選択する正式Facadeだけを再exportし、caller Root／observer／runner付きcontract engineを`docker-recovery-runtime-internal.ts`へ分離した。private packageは`exports` allowlistで`./cli`だけを明示し、package self-referenceによる内部deep subpath importを`ERR_PACKAGE_PATH_NOT_EXPORTED`で拒否する。production `src`／`bin`は正式Facade以外からinternal engineをimportしないことをcontract testで固定する。試験engineのrunner injectionはpackageの正式利用面へ公開せず、source checkoutのEffect Authorityや同一悪意ローカルユーザー耐性へ昇格しない。

受入matrixは、独立child processが保持するsame Home lockの拒否と別Home非競合、cleanup-onlyの作成時selected-user一致／不一致、空Rootの未発行token拒否、receipt付きprovider containerのexact ID／name／label／image／mount／hardening／Network照合、exact削除、不存在再確認、Host successor、Host cleanupおよびRuntimeState／Host残存0を一つのclosed production engineで確認する。CLIはbinと共通の安全projectorへ表示を集約し、実CLIのunavailable dispatchに加えて、実inventory parserが返す単一ID、複数ID、third stateおよび回復成功をJSON／人間表示とexit codeへ投影する。Host Path、生Docker／Provider出力、Credentialまたはraw errorを追加しない。

README、Threat ModelおよびRoadmap 08は、旧第九次／第十次の履歴をCHGへ残し、現在状態を第十一次へ一意化した。本処置は`Applied`／`Self-checked`である。全機械確認、新固定Commit／Tree、および同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

第十一次是正の固定版作成前機械確認では、Node.js 24.19.0のCoordinator全719試験、Docker journal／状態機械重点27試験、production回復／実CLI重点25試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 99.13%／branch 75.90%／function 100.00%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 73.20%／branch 58.71%／function 81.94%で固定閾値65%／45%／75%を満たし、内部回復本体はline 78.95%／branch 60.36%／function 86.03%、正式Facadeはline／branch／function 100.00%だった。全体Checker、`git diff --check`、固定Commit／Treeおよび同じ独立再レビュー／再監査は次の固定手順で確定する。

##### `dd8b9d1`監査集合の第十二次是正

固定Commit `dd8b9d1efea4dd43e686d3bc961da9eb65f28ee4`／Tree `67034f2b87c184783f0bd33291f73162b5494ca4`へのAgent／Architecture／Security再レビューはCritical 0件／Major 2件で`Fail`、Document AuditはMajor 2件／Minor 1件で`Fail`、Gap／ImpactはMajor 2件で`Fail`、ConformanceはFinding 0件で`Pass`だった。前回5件の主要実装は解消または大幅改善した一方、別Homeの複数`base` move中間状態をlogical keyだけで曖昧化する探索、Root-level move／deleteの作成時binding／A-B matrix、release不明時に耐久Evidenceは残してもactionable Recovery IDをreportから失う経路、正式配布package検証でCLI-only `exports`を必須にしない経路、およびThreat Modelの機械確認状態競合を一つの是正集合へ統合した。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第十二次是正ではDocker Recovery Runtime contractをrevision 8へ更新する。Root journalのJSON発見はlogical keyだけでなくexact Recovery IDを必須入力とし、別Taskのvalid intentを候補数へ混入させない。target-scoped resumeはcleanup、base move、base-commit moveおよびactive pointer deleteの全schemaについて、intent内のbase Evidenceまたはexact Recovery IDへ結合したbase contentから作成時RuntimeState bindingを解決し、現在bindingとの一致を最初のmutation前に確認する。対象外anchorはserialized byteとFilesystem Identityを保持し、同一ID内の複数候補、binding解決不能、不一致または第三状態では処置しない。production inventoryもjournalが正当に所有するsplit pair sidecarをorphanへ誤分類せず、別Homeの複数base move中間状態をRecovery ID別に列挙する。

直接Host doctorはmarkerとtokenの構文・内容を検証できた場合、release不明を`blocked`としながらexact Host Recovery IDを返す。RuntimeState inventoryもlock保持中に完全検証したDocker Recovery ID一覧をrelease不明時の手動回復reportへ保持する。IDは次回Effect Authorityへ流用せず、doctor再実行時にmarker、Root、bindingおよび全inventoryを再検証する。JSON／人間表示は既存safe projectorでexact IDと次commandだけを出し、Host Path、marker Path、Credentialまたは生errorを出力しない。

Coordinator package metadataは`private: true`に加えてexact `exports: {"./cli":"./bin/coordinator.ts"}`を必須とする。`exports`欠落、余分なsubpath、internal module公開またはCLI差替えは、署名生成、bundled observationおよびinstalled verificationが共有するstable package observerでEffect前に拒否する。source checkout、caller Root／observer／runner seamおよびinternal deep importは正式Authorityへ昇格しない。Threat Model、READMEおよびRoadmapは機械確認完了と未完了監査を一意に表示する。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全724試験、Docker journal／状態機械重点29試験、production回復／実CLI重点27試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 97.99%／branch 77.02%／function 100.00%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 73.79%／branch 60.03%／function 82.43%で固定閾値65%／45%／75%を満たし、内部回復本体はline 79.53%／branch 61.69%／function 86.43%、正式Facadeはline／branch／function 100.00%だった。全体Checker、`git diff --check`、新固定Commit／Tree、および同じ独立再レビュー／再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `a2501f4`監査集合の第十三次是正

固定Commit `a2501f4262f12981272dda278f3351d8e4a11077`／Tree `a3b28e99c1afe5438255c0f9c7effc6b2c27db15`へのAgent／Architecture／Security再レビューはCritical 0件／Major 1件／Minor 1件で`Fail`、Document AuditはMinor 1件を伴う`Pass`、Gap／ImpactはMajor 1件で`Fail`、ConformanceはFinding 0件で`Pass`だった。release不明時のactionable IDとexact CLI投影、および正式packageのCLI-only `exports`境界は解消した。一方、`base-commit.json` moveでcontentだけがOperation Directoryへ移動しcommit sidecarがRootに残る正当なWAL中間状態を通常inventoryがunknownとして拒否し、全schema直接matrixからも漏らしていた。README、Threat Model、Roadmapおよび本CHGの現在Gate表示も、完了済み全体Checkerと競合していた。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第十三次是正ではDocker Recovery Runtime contractをrevision 9へ更新する。read-only journal inventoryはvalidated move intentからlogical key、source pair名およびtarget pair名を投影する。production inventoryはexact Recovery ID、`base-commit.json` logical key、固定target content／commit名および単一validated move intentが一致する場合だけ、split pairのcommit record EvidenceをOperation inventoryへ渡す。commit sidecar欠落を一般許可せず、unknown、複数intent、Recovery ID差、logical key差、target名差または第三状態は従来どおり停止する。inventoryはjournal resumeやFilesystem mutationを行わない。

受入matrixは`base-commit.json` moveのintent確定後、content移動後およびcommit sidecar移動後の全process-crash境界を、同一Homeと別HomeのA/Bで直接発火する。各境界でproduction inventoryが全exact Recovery IDを返し、Aのinventory／target-scoped resume後もB anchorのserialized byteとFilesystem Identityが不変であること、binding不一致では全anchorを保持すること、および両resume後にjournal anchorが残存0となることを確認する。base move、pointer delete、cleanup、unknown非採用、selected-user／RuntimeState binding、Subscription-only、API key／有料fallback禁止およびPath／Credential非表示は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全725試験、Docker journal／状態機械重点29試験、production回復／実CLI重点28試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 98.91%／branch 77.70%／function 100.00%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 73.37%／branch 60.27%／function 82.55%で固定閾値65%／45%／75%を満たし、内部回復本体はline 79.01%／branch 61.91%／function 86.52%、正式Facadeはline／branch／function 100.00%だった。全体Checkerは694 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0、`git diff --check`もPassした。新固定Commit／Treeを確定して同じ独立再レビュー／再監査を再実行する。それらのPass前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `acccbc9`監査集合の第十四次是正

固定Commit `acccbc9015a2241561024f0a15779b6906343b22`／Tree `e82ee6da1eab7351242ebc709c53cf21951857e5`へのAgent／Architecture／Security再レビューはCritical 0件／Major 1件で`Fail`、Document AuditとGap／Impactも同じ根本原因をMajorとして`Fail`、ConformanceはFinding 0件で`Pass`だった。第十三次の正常3境界、同一／別Home、A/B不変および現在Gate同期は解消した。一方、split moveのcommit sidecar欠落時にOperation Directoryの実target contentを読まずintent由来recordを代用し、target byte／Hash／Filesystem Identityまたはtarget Directory Identityの差があってもactionable Recovery IDを投影できた。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第十四次是正ではDocker Recovery Runtime contractをrevision 10へ更新する。journalのread-only move-state検証とeffectful resumeは、同じpair Evidenceと状態機械を使用する。source／target Directory Identity、content／commitのserialized byte、Hash、byte数、Filesystem Identity、Recovery ID、logical key、source／target名およびanchor digestを現在Filesystemへ再結合し、`move_content`、`move_commit`、`complete`の三状態だけを投影する。production `readRootRecord`は実fileが存在する場合にintent内容へ単純fallbackせず、対象Recovery ID、logical key、target Directoryおよびtarget名を指定したread-only helperが実targetを検証したEvidenceだけを受理する。inventoryからrename、deleteまたはresumeは発火しない。

受入matrixは`base.json`と`base-commit.json`の双方へ、target byte改変、同内容別Identity置換、source commit sidecar改変、source／target二重存在、全component欠落、偽target sidecarおよびtarget Directory置換を追加した。全負例でinventoryは`blocked`、Recovery IDは空、Root全entryの名前、byteおよびFilesystem Identityは不変となる。正常なanchor確定後、content移動後、commit sidecar移動後の同一／別Home A/Bは引き続き全IDを列挙し、Aのinventory／resume前後でBのanchor、target contentおよびsidecarを含む全componentのbyte／Filesystem Identityを維持する。unknown／replacement非採用、selected-user／RuntimeState binding、Subscription-only、API key／有料fallback禁止およびPath／Credential非表示は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全726試験、Docker journal／状態機械重点29試験、production回復／実CLI重点29試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 96.22%／branch 78.33%／function 98.46%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 74.09%／branch 60.45%／function 82.55%で固定閾値65%／45%／75%を満たし、内部回復本体はline 79.80%／branch 62.11%／function 86.52%、正式Facadeはline／branch／function 100.00%だった。全体Checkerは694 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0、`git diff --check`もPassした。新固定Commit／Treeを確定して同じ独立再レビュー／再監査を再実行する。それらのPass前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `fe525bf`監査集合の第十五次是正

固定Commit `fe525bf66837c7531b53b8643718a8d6541c33e6`／Tree `581ee22783321b6643e251b62965a7a3d28ad0a3`へのAgent／Architecture／Security再レビューはFinding 0件で`Pass`し、前回`AG-DRR-014-01`の解消を確認した。ConformanceもFinding 0件で`Pass`した。一方、Document AuditとGap／Impact Auditは、Operation Directoryに`base.json`と`base-commit.json`の両contentが存在する場合だけbounded inventoryを実行していた同じ根本原因をMajor 1件として`Fail`とした。pending pair作成後、空Directory、`base` moveの各中間状態、base完了後・base-commit開始前、および`base-commit`のcontent移動境界では、unknown／orphan／replacement entryを検査せずactionable Recovery IDを投影し、明示回復がfull inventoryより先にjournal resumeまたはpending pair移動を開始し得た。現在追加の人間判断は不要であり、部分Passを現在判定へ流用しない。

第十五次是正ではDocker Recovery Runtime contractをrevision 11へ更新する。production Root inventoryは、pending-only、空Operation Directory、`base`の`move_content`／`move_commit`／`complete`、base完了後・base-commit開始前、`base-commit`の`move_content`／`move_commit`／`complete`およびfull Operationを明示分類する。move中の各pairはexact Recovery ID、logical key、source／target名、source／target Directory Identity、serialized byte、Hash、byte数およびFilesystem Identityをjournalの共通read-only move状態機械で現在Filesystemへ再結合する。full stateだけを既存Operation inventoryへ遷移させ、partial stateでは到達可能なcomponent名とtypeだけをexact allowlistとし、全Directory entryをboundedに列挙する。unknown、orphan temporary、余分sidecar、non-regular、replacement、順序外componentまたは第三状態はRecovery ID空のblockedとなり、rename、deleteまたはresumeを発火しない。

Task admissionは新Operationの最初の記録より前に同じRoot inventoryを通す。明示Recoveryは、Host／Home／RuntimeState排他取得前の読み取り専用preliminary inventoryと、排他取得後のfresh inventoryを通過してから対象Recovery ID限定journal resumeへ進み、resume後にも全inventoryを再確認する。受入matrixは`base`／`base-commit`双方のanchor確定後、content移動後、commit sidecar移動後を同一／別Home A/Bで直接発火し、pending-only、空Directoryおよびbase完了後・base-commit開始前も追加した。各partial状態へunknown regular file、orphan temporary、余分sidecar、non-regular entryおよび同内容別Filesystem Identity置換を注入し、production Root inventoryがblocked、Recovery ID空、Root全treeの名前・byte・Filesystem Identity不変となることを確認する。base完了anchorが残る間にbase-commit intentも開始した到達不能な順序は第三状態として同様に拒否する。Task admissionは新規記録前、明示Recoveryはjournal resume前に同じunknown状態を拒否し、Aのinventory／resume中もvalid Bの全componentを保持する。Subscription-only、API key／有料fallback禁止、T1／T2 Minimum Trust Boundary、exact Docker ID／構成、package CLI-only exports、Path／SID／Credential非表示およびIssue #30の所有境界は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全731試験、Docker journal／状態機械重点29試験、production回復／実CLI重点34試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 96.22%／branch 78.33%／function 98.46%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 74.32%／branch 63.25%／function 83.23%で固定閾値65%／45%／75%を満たし、内部回復本体はline 79.84%／branch 64.83%／function 87.07%、正式Facadeはline／branch／function 100.00%だった。全体Checkerは694 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0で、`git diff --check`もPassした。新固定Commit／Treeへの同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `ea1edd3`監査集合の第十六次是正

固定Commit `ea1edd3c81223db4163377c4b9115b64445b3585`／Tree `2cd3f9348f37fd9064d96e04e85206bd1e38a9ae`へのAgent／Architecture／Security再レビューは`AG-DRR-015-01`をMajor 1件として`Fail`とし、pending base commit pair完成後・pending base-commit開始前の到達可能なprocess終了状態がactionable Recovery IDなしでRoot全体を停止させると確認した。Document AuditとGap／Impact Auditは`DOC-EA1-PENDING-DUP-001`／`GDI-EA1-PENDING-DUP-001`をMajor 1件として`Fail`とし、move intent消滅後にOperation Directory側target pairとRoot側pending source pairが重複する到達不能状態を通常のactionable recordとして採用できると確認した。Conformance AuditはFinding 0件で`Pass`だった。旧`AG-DRR-014-01`および狭義のOperation Directory partial inventory迂回は解消を維持するが、監査集合全体は`Invalidated`であり部分Passを現在判定へ流用しない。現在追加の人間判断は不要である。

第十六次是正ではDocker Recovery Runtime contractをrevision 12へ更新する。Task開始はpending base commit pairの確定直後にRecovery IDを導出・保持する。Root inventoryはpending base-onlyを独立した到達可能状態として扱い、exact Schema、nonce、stable logical Home、base Hash、commit sidecarおよびFilesystem Identityを現在Filesystemから再検証できる場合だけRecovery IDを投影する。明示Recoveryはpreliminary inventory、Host／Home／RuntimeState排他およびlocked fresh inventoryの後、同じbase Hash、logical HomeおよびRecovery IDから欠落したbase-commitを決定論的に確定し、既存のpre-effect cleanupへ接続する。ProviderまたはDocker Effectは開始しない。

各bootstrap pairの分類結果はOperation Directory側targetだけでなく、Root側pending sourceの`required`、`absent`またはvalidated journal所有状態を返す。全Root entryの列挙後、pending source pairの実在をこの期待状態へ照合し、no-intentのsource／target重複、commit側だけの片側pending、orphan sidecar、byte改変、同内容別Filesystem Identity置換または順序外componentをRecovery ID空のblockedへ閉じる。Task admissionと明示Recoveryは最初の新規記録、journal resume、欠落commit再構成、renameまたはdeleteより前に同じRoot inventoryを完了する。Subscription-only、API key／有料fallback禁止、T1／T2 Minimum Trust Boundary、exact Docker ID／構成、package CLI-only exports、Path／SID／Credential非表示およびIssue #30の所有境界は変更しない。

受入matrixはpending base-onlyを同一／別Home A/Bへ追加し、実子processをbase commit pair確定直後に強制終了してexact Recovery IDの再発見、明示Recovery、Host／RuntimeState残存0およびclean inventoryへの収束を確認する。no-intentのbase source／target重複、base-commit source／target重複および両pair重複は、同一内容を新しいFilesystem Identityで作成して拒否する。pending base-onlyのbyte改変、同内容別Identity置換、orphan sidecar、Task admissionおよび明示Recoveryのmutation前拒否では、Recovery ID空または対象ID付きblockedとRoot全treeの名前・byte・Filesystem Identity不変を確認する。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全735試験、Docker journal／状態機械重点29試験、production回復／実CLI重点38試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 96.22%／branch 78.33%／function 98.46%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 76.08%／branch 65.64%／function 83.65%で固定閾値65%／45%／75%を満たし、内部回復本体はline 81.65%／branch 67.20%／function 87.42%、正式Facadeはline／branch／function 100.00%だった。全体Checkerは694 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `e368a14`監査集合の第十七次是正

固定Commit `e368a14de384d32fa8a74ade82aca8735920c32d`／Tree `8cfb52460ae24c82bf2bb84c8d908939d4f2c8d1`へのDocument Audit、Gap／Impact AuditおよびConformance AuditはFinding 0件で`Pass`し、旧`DOC/GDI-EA1-PENDING-DUP-001`とpartial bootstrap Findingの解消を確認した。一方、Agent／Architecture／Security再レビューは`AG-DRR-016-01`をMajor 1件として`Fail`とした。Root inventory recordがactive pointerを持てるphaseを保持せず、pending base-only、両pending pair、空Directory、各move中間状態または両pair fullだが`host-begin-intent`確定前のrecordへ、exact committed active pointerを通常のactive leaseとして結合できた。通常の作成順は両pair確定、host-begin-intent確定、active pointer確定であるため、これは到達不能な第三状態である。監査集合全体は`Invalidated`であり部分Passを現在判定へ流用しない。現在追加の人間判断は不要である。

第十七次是正ではDocker Recovery Runtime contractをrevision 13へ更新する。Root inventory recordはactive pointer適格性を明示し、両bootstrap pairがOperation Directory内で完全なcommit pairであること、Root pending sourceと両move intentが不存在であること、通常Operation inventoryを通過したこと、exact `host-begin-intent`が存在すること、およびそのcurrent Host tokenがbaseの`initialHostRecoveryId`と一致することをすべて満たす場合だけ適格とする。committed pointer検証とpointer write／delete journal探索はいずれもこの適格性を必須とする。pointerからbootstrap phaseを推測・昇格せず、partialまたはpre-host-intent状態のpointerはRecovery ID空のglobal blockedとして保持し、自動削除、journal resume、欠落commit再構成、renameまたはdeleteを開始しない。

受入matrixはpending base-only、両pending pair、空Directory、`base`と`base-commit`双方の全move境界、base完了後およびfull pair／host-begin-intent前へexact committed pointerを追加し、同一／別Home A/Bの双方でinventoryがblocked、Recovery ID空、Root全treeの名前・byte・Filesystem Identity不変となることを確認する。代表状態ではTask admissionと明示Recoveryが最初のmutation前に拒否する。正式順序でfull pair、exact host-begin-intent、active pointerを作成した実production process-kill fixtureは引き続きactionable IDを列挙し、pre-effect cleanupへ収束する。pending base-only、Root source期待状態、Subscription-only、API key／有料fallback禁止、T1／T2 Minimum Trust Boundary、exact Docker ID／構成、package CLI-only exports、Path／SID／Credential非表示およびIssue #30の所有境界は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全737試験、Docker journal／状態機械重点29試験、production回復／実CLI重点40試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 96.22%／branch 78.33%／function 98.46%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 76.13%／branch 65.95%／function 83.65%で固定閾値65%／45%／75%を満たし、内部回復本体はline 81.67%／branch 67.50%／function 87.42%、正式Facadeはline／branch／function 100.00%だった。全体Checkerは694 files／386 Markdown／2174 links／588 anchors／26 Related／26 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査が完了する前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `747d5bb`監査集合の第十八次是正

固定Commit `747d5bbdfb057bd10b0e2313226c1de8cf9bd206`／Tree `59c042cbd878b17c178631944d7cc278e73381bb`へのDocument Audit、Gap／Impact AuditおよびConformance AuditはFinding 0件で`Pass`し、旧Document／Gap Findingの解消と文書整合を確認した。一方、Agent／Architecture／Security再レビューは`AG-DRR-016-01`をMajor 1件として`Unresolved`とした。active pointer適格性がbootstrap完了とHost beginという下限だけを検査し、base-commit moveのtarget確定後にanchorが残る状態、およびlease解放receipt、通常完了またはHost cleanup開始・完了後にpointerが再出現する状態を受理できた。前者はpointer生成前、後者はpointer削除後であり、いずれも正規順序では到達不能である。監査集合全体は`Invalidated`であり部分Passを現在判定へ流用しない。現在追加の人間判断は不要である。

第十八次是正ではDocker Recovery Runtime contractをrevision 14へ更新する。active pointer適格性は、両bootstrap pairが`complete`でRoot pending sourceとmove intentが双方`absent`であること、通常Operation inventoryとexact Host begin lineageが成立すること、および`lease-release-receipt.json`、`normal-run-complete.json`、`host-cleanup-intent.json`、`host-cleanup-receipt.json`が存在しないことをすべて要求する。cleanup manifest／tombstone状態も従来どおりactive pointerへ結合しない。`host-complete` receipt前後とcrash-absence処置中はpointer削除前の正当な状態として維持する。committed pointerとpointer delete journalの双方で同じ適格性を使用し、不成立時はRecovery ID空でblockedとし、pointer削除、journal resume、commit再構成またはrenameを行わない。

受入matrixはbase／base-commit move完了anchor残存、4種のpointer解放後Evidence、committed／journal pointer、同一／別Home A/B、およびTask admission／明示Recoveryのmutation前停止を全tree不変で確認する。正式Host begin後のpointer回復、host-complete receipt前後、crash-absence処置および正式pointer delete journalの冪等回復は維持する。Subscription-only、API key／有料fallback禁止、T1／T2 Minimum Trust Boundary、exact Docker ID／構成、package CLI-only exports、Path／SID／Credential非表示およびIssue #30の所有境界は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全740試験、Docker journal／状態機械重点29試験、production回復／実CLI重点43試験およびprivate package strict typecheck／Biome Lint／FormatterをPassした。Docker journal重点coverageは全体line 96.22%／branch 78.33%／function 98.46%で固定閾値90%／70%／80%を満たす。production回復＋実CLI coverageは全体line 76.22%／branch 66.29%／function 83.75%で固定閾値65%／45%／75%を満たし、内部回復本体はline 81.76%／branch 67.83%／function 87.50%、正式Facadeはline／branch／function 100.00%だった。全体Checkerと`git diff --check`を完了し、新固定Commit／Treeを確定して同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査を再実行する。それらのPass前はFindingを`Resolved`、Runtime完成、採用、統合、準拠、Stable、ReleaseまたはPR最終候補としない。正式署名配布物上の一般Task実run、Release鍵passphrase、OAuth再認証、外部Provider送信、PR最終承認／統合およびReleaseは人間操作待ちとする。Issue #30は`CHG-000013`所有のCommunication／Market／Adoption follow-upであり、本変更のclose対象ではない。

##### `d4cbdff`監査集合の結果

固定Commit `d4cbdff079e5e2270b71263d6edbfe32e5332dd1`／Tree `d9cdf6265ab09cdac6dacde0bded41b6bd107a81`へのAgent／Architecture／Security再レビュー、Document Audit、Gap／Impact AuditおよびConformance Auditは、Critical／Major／Minor 0件で全て`Pass`した。`AG-DRR-016-01`は`Resolved`、第十七次以前のFindingも解消維持と判定された。確認範囲はbase／base-commit move anchor、4種のpointer解放後Evidence、committed／journal pointer、同一／別Home A/B、Task admission／明示Recoveryのmutation前停止、正式Host begin、host-complete receipt前後、crash-absenceおよび正式pointer delete journal回復を含む。追加是正と現在の人間判断は不要である。

`d4cbdff`固定版時点の未完了Gateは正式署名配布物上の一般Task実runだった。Release鍵passphrase、必要なOAuth再認証および外部Provider送信は人間操作・判断として残し、就寝中または無人状態で開始しない。そのrunと終了後の残存0確認が完了する前は、Coordinator Runtime 1.0完成、PR最終候補、統合、StableまたはReleaseへ昇格しない。Issue #30は引き続き`CHG-000013`所有でありcloseしない。

##### 正式署名一般Taskの対話・搬送境界是正

正式署名配布物を使った一般Taskの初回実行準備では、署名manifest生成とRuntime所有Release検証は成功した一方、汎用`coordinator task --request-stdin --json`へPowerShellからJSONを渡す保守用起動操作が三回とも`task_request_invalid_json`でEffect前に停止した。原因は、PowerShell text pipelineのencoding、Windows PowerShell 5.1に存在しない`.NET`の`StandardInputEncoding` property、および長い入れ子`Start-Process ... -Command`による引数再構成だった。短いNode `ProcessStartInfo`相当のbinary stdin確認ではJSON parseを通過して後続Runtime preflightまで到達したため、Runtimeの上限付きUTF-8／重複key拒否parserではなく、Repository外で都度合成したShell搬送が共通原因である。三回の停止はいずれもTask parse完了前で、Provider、Docker、Network、Candidateまたはcanonical Repository Effectを開始していない。

同根箇所を、Release鍵入力、Release manifest署名、一般Task request、外部送信challenge、OAuth bootstrap、Provider Task Packet stdin、Docker／Git子process、Candidate／Recovery CLIへ水平走査した。等価な未所有搬送は正式署名一般Taskの検証起動だけだった。Release鍵はdirect TTYとraw inputを要求し、外部送信challengeはWindowsの`CONIN$`／`CONOUT$`またはPOSIX `/dev/tty`を直接開き、Provider Task PacketはNode `spawn`の`shell:false`とUTF-8 stdinへ固定し、Docker／GitおよびCandidate／Recoveryは固定argvまたは非対話入口を使う。OAuth bootstrapは人間が開始する公式Provider CLI／browserだけを許し、通常Taskから自動loginしない。これらは対話端末または前提不成立時にfail closedとなるため、共通Shell wrapperへ置換しない。

是正として、署名済み配布物内の`verify-signed-general-task.ts`を正式Gate専用のRuntime所有Runnerとして追加した。公開の固定Taskをprocess内で構成し、Codex Front、Claude Code Executor、Codex Independent Reviewer、exact 1 changed path、期待UTF-8 byte、cleanup、Recovery ID不存在、canonical Repository非変更およびCandidate discardを一つのPass条件へ結合する。署名Release Identityが不成立ならTaskを開始せず、Task／Review／Candidate／discardのいずれかが不成立ならPassを返さない。通常のstdin専用Task契約、Task本文のargv／環境非露出、対話外部送信Grant、Subscription-only、API key／従量課金fallback禁止およびT1／T2 Minimum Trust Boundaryは変更しない。

利用側の処置は、汎用Task CLIを`変更不要`、Release鍵生成／署名を`既存direct TTY契約で変更不要`、外部送信Grantを`既存console device契約で変更不要`、Provider／Docker stdinを`既存shell:false契約で変更不要`、OAuthを`公式CLI／外部system browser限定としてREADMEへ明示`、正式署名一般Task Gateを`固定Runnerへ変更`とした。PowerShell text pipeline、`ConvertTo-Json`、一時request file、長い入れ子ShellおよびWindows PowerShell 5.1固有APIを検証入口へ戻さないことをRunner contract testとREADMEへ固定する。これは対話機構を一般Platform化する変更ではなく、未リリースCHG-000015の最後の実runを再現可能にする是正である。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全745試験、追加Runner重点5試験、private package strict typecheck／Biome Lint／Formatter、Checker package check／全試験、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは699 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Tree、同じAgent／Architecture／Security再レビューとDocument／Gap／Impact＋Conformance再監査、および新しい正式署名配布物での一般Task実runと残存0確認は未完了である。これらが完了する前はRuntime完成、PR最終候補、統合、StableまたはReleaseへ昇格しない。

##### `6d97953`正式署名Runner独立レビューの是正

固定Commit `6d97953bbd44dff5c3266adef2e061fbb8deecd4`／Tree `74b2261e7e586875aa365c0face5be85f3ba0e69`へのArchitecture／Security、Document／GapおよびTest／UX独立レビューは、Shell JSON搬送の構造的除去を妥当とした一方、共通根本原因をMajor 4件、Minor 1件として`Fail`とした。Task ResultがCandidate IDを返した後にroute／review／cleanup契約不一致で先にreturnするとCandidateをdiscardせず、Candidate残存中でもTask側`cleanupConfirmed`をRunner全体へ投影できた。署名ReleaseのCommit／Treeと対象RepositoryのCandidate Revision、Candidate bundleの全Identity Hashを相互結合せず、別branchまたは古いsessionのrunを固定Release根拠へ誤帰属できた。PATH上の裸のNodeを使いながらversion 24.12以上をEffect前に検査せず、現HostのNode 22.18でもRunner本体へ進めた。READMEは旧`d4cbdff`監査Passを現在Gateへ流用し、新Runnerの再レビュー未完了表示と競合した。process entrypoint、取消、completion rejectおよびStore例外の負例も不足していた。旧監査集合を現在判定へ流用せず、追加の人間判断は不要である。

是正では、Node 24.12.0以上を判定する共通pure contractを追加し、Coordinator CLI、Release鍵生成、Release manifest署名および正式署名一般Task Runnerが、対話入力、Release検証またはEffectより前に未対応Runtimeを固定reasonで拒否する。正式Runnerはread-onlyな対話console preflightもRelease検証前に行う。READMEの署名・検証commandはPATH上の裸のNodeではなく、絶対Pathとversionを直前確認したNode実行ファイルを要求する。unsupported／判定不能時に別Node、Shell、request fileまたは搬送方式へfallbackしない。

Runnerは署名manifest Hash、package content root、version、sequence、Commit、Tree、Runtime所有package Rootおよびstable Filesystem Identityを必須化する。Taskのbase Commit／Treeを署名Releaseへ一致させ、Task Candidate RevisionとCandidate bundleのbase Commit／Tree、base manifest、patch、content manifestおよびallowed paths Hashを照合し、patch Hashを同じdomain-separated構成から再計算する。成功EvidenceへsafeなRelease Identityを投影し、別Revisionへの誤帰属を許さない。

Task completion後のsignal bindingはCandidate disposition完了まで保持する。Task ResultがCandidate IDを返した場合、Pass可否にかかわらずRuntime Candidate Storeからbounded readとdiscardを試行する。内容差、route差、review差またはcleanup差でもdiscard成功を確認し、discardまたはStore処置がthrow／blockedならCandidate IDとStore側Recovery IDを保持して`manualRecoveryRequired: true`、`cleanupConfirmed: false`へ閉じる。処置中の取消要求はCandidate cleanup後もPassへ戻さない。canonical Repository、任意Pathまたはcaller supplied IDへ削除範囲を広げない。

READMEは`d4cbdff`のPassを同固定版の履歴へ限定し、現固定版の再レビュー／再監査完了前に正式署名runを現在Gateと表示しない。追加試験はNode境界、console不成立、exact固定Request、Release／Candidate Identity欠落・差、route／cleanup差での必須discard、completion reject、取消、Candidate Store read／discard例外およびCLI余分argvの単一JSON／exit 2を含む。

同根のsession後退を追加走査した結果、Node version判定が`doctor`と新Gate、OS対話console取得が外部送信Grantと正式Runnerに重複していたため、それぞれ一つの共通contractへ収束した。packageのNode要件も`>=24.12.0`へcanonical化した。実行sourceへ`StandardInputEncoding`、`Start-Process`、`ConvertTo-Json`または`shell:true`を再導入した場合、対話console deviceを共通module外で直接所有した場合、packageと共通Node要件がずれた場合、および保護対象入口がNode Gateを外した場合に失敗する回帰試験を追加した。全`tools/**`の正本である内部Toolコーディング規約へ、Shell非依存の構造化搬送、direct TTY／固定console、実行Runtimeの親子結合、module基準Pathおよび起動Directory差の検証を追加した。実測では親npmをNode 24で起動してもpackage scriptの裸の`node`がPATH上のNode 22.18へ戻る状態をGateがEffect前に拒否し、試験側のRepository root CWD仮定もCoordinator package CWDからの全試験で検出した。後者は`import.meta.dirname`基準の絶対Pathへ是正した。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全754試験、Node／対話／正式Runner重点14試験、外部送信／doctorを含む水平重点76試験、Checker全153試験、および両private packageのstrict typecheck／Biome Lint／FormatterをPassした。正式Runner重点coverageはline 91.74%／branch 81.68%／function 80.00%、共通Node Gateはline／function 100.00%だった。全体Checkerは703 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの同じ独立再レビュー／再監査が完了する前に署名または実Provider runへ進まない。

##### `9611b73`正式署名Runner独立再レビューの是正

固定Commit `9611b738d3d7f3b6fbb7b957b76365fc6595efd0`／Tree `11caf11b05a538af6a1fbc50b575e0095a1c9077`へのArchitecture／Security、Document／GapおよびTest／UX独立再レビューは、旧Major Findingの解消を確認した一方、Major 4件、Minor 2件として`Fail`とした。Task側とCandidate discard側が同時に失敗した場合にRunnerがTask側のHost／Docker／Candidate Recovery Identityを落とした。Release署名と受動`doctor`がPATH上の外部Git CLIを再選択し、保護操作用package aliasと相対entrypointが、絶対Pathで起動した親Nodeから別Nodeへ後退できた。RunnerだけがRelease IdentityのGit IDとVersion grammarを狭く複製し、実SIGINT／SIGTERM bindingのexact onceと解除を直接確認していなかった。READMEには現在版の再レビュー待ちと完了済み表示が競合していた。旧固定版の部分Passを現在判定へ流用せず、追加の人間判断は不要である。

是正では、Task Resultとdiscard Resultを同時に受けるbounded Recovery projectionへ変更し、Host、Docker、CandidateおよびCandidate Storeの全ID集合を重複排除して保持する。単数Identityが競合する場合は単数fieldを`null`、複数fieldへ全候補を保持し、`recoveryIdentityAmbiguous: true`として手動回復へ閉じる。Candidate ID以外のPath、raw Provider出力または自動回復範囲は追加しない。SIGINT／SIGTERM binderは取消をexact onceにし、取消処理のthrowをTask／cleanup結果へ優先させず、Candidate disposition終了後の冪等unbindまでを直接試験する。

Release Identity grammarは40／64文字の小文字Git Object IDとprereleaseを含むVersionを一つのRepository所有moduleへ集約し、Trust、package filesystem、package gate、active pointerおよび正式Runnerで共有する。Release署名は指定CommitのCommit／TreeをRepository所有のbounded Git object readerから読み、`doctor`も同じreaderで現在HEADのCommit／Tree候補だけを受動観測する。外部Git CLI、PATH探索、working tree clean claimまたはRepository Path公開を使わない。保護操作用の鍵生成／Manifest署名package aliasを削除し、人間向けcommandは検証済みNode実行ファイルとRepository所有entrypointの双方を絶対Pathへ固定する。一般の型検査、静的解析、試験またはbuild用package scriptは保護操作Authorityではなく、Node要件不一致を明示停止する開発用orchestrationとして分離する。

同根箇所を、全production `child_process`利用、package command、README、Release鍵、Manifest署名、一般Task、外部送信、OAuth、Provider packet、Docker、Candidate、Recovery、Windows Known FolderおよびGitへ再走査した。PowerShell text pipeline、`StandardInputEncoding`、`ConvertTo-Json`、`Start-Process`、`shell:true`およびPATH Gitは実行sourceに残っていない。残る子Processは、事前検証済みnative helper、Hash／byte長／Filesystem Identityを固定したDocker CLI、System32の固定`taskkill.exe`、または固定SystemRoot配下PowerShellによるcaller入力なしの固定Known Folder読取りであり、いずれもShell再解釈を使用しない。回帰試験は保護操作用package alias、相対Release entrypoint、PATH Git、Release grammar複製、Shell搬送、共通console迂回およびNode Gate迂回を再導入時に拒否する。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0のCoordinator全759試験、Node／対話／正式Runner重点13試験、Checker全153試験、Coordinator private packageの2 TypeScript project、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。正式Runner重点coverageはline 94.32%／branch 83.33%／function 88.46%、共通Node Gateはline／function 100.00%だった。全体Checkerは705 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeと同じ独立再レビュー／再監査の全Pass前は`Resolved`、Runtime完成、PR最終候補または正式署名実run可能へ昇格しない。Release鍵passphrase、OAuth再認証および外部Provider送信は引き続き人間操作・判断である。

##### `8fada35`正式署名Runner独立再レビューの是正

固定Commit `8fada35dd3128541539a34f45bb8b29a68bec3d3`／Tree `0ddb805811e1da2120f76bfa2596fc78e9c2fd55`へのArchitecture／Security、Document／GapおよびTest／UX独立再レビューは、前固定版のMajor Finding解消を確認した一方、重複を統合してMajor 3件、Minor 2件として`Fail`とした。Repository所有Git readerがCommit本文中の`tree `行をheaderとして採用でき、参照先のobject typeをTreeへ固定していなかった。保護Recoveryへ到達する相対entrypointの`doctor` package aliasが残っていた。Release Identity schemaは40／64文字のGit Object IDを表現できたが、実Candidate StoreとRepository borrowは40文字だけを扱うため、SHA-256 RepositoryをEffect前に一意に拒否する能力境界がなかった。PowerShell例示の絶対Pathが引用されず空白を含むPathで壊れた。未使用のWindows Common Application Data補助moduleは親環境の`SystemRoot`を実行Identityに利用していた。現在のRuntimeは未リリースであり、同じCHG内で共通原因を是正する。追加の人間判断は不要である。

Git readerはCommitの最初のheader行だけをexact `tree <40 lowercase hex>`として受理し、header／本文separator欠落、重複Tree headerおよび本文内の疑似headerを拒否する。参照objectをboundedに再読取りしてtypeが`tree`であることも確認する。SHA-1／SHA-256は表現文法とRuntime能力を分離し、Coordinator Runtime 1.0は実証済みSHA-1 Repositoryの40文字IDだけを実行する。64文字IDは未知値や不正入力と混同せず`release_manifest_git_object_format_unsupported`または`signed_general_task_git_object_format_unsupported`として、passphrase入力、Candidate bind、Repository読取りまたはTask Effectより前に停止する。将来のSHA-256 Git対応はCandidate Store、Repository borrow、Release署名およびTask E2Eを同時に拡張して再検証するまで自動fallbackしない。これはGit clientに依存せず、Release artifactのSHA-256 Hash利用を変更しない。

保護Recoveryへ相対Node／entrypointで入れる`doctor` package aliasを削除し、READMEと鍵生成usageのPowerShell実行Pathをすべて二重引用符で囲む。一般の型検査、静的解析および試験scriptは非保護の開発orchestrationとして維持する。呼出しのないWindows Common Application Data補助moduleを削除し、production子Process所有集合とstrict TypeScript対象を更新する。回帰試験はpackage alias、未引用Path、64文字IDの遅延拒否、Commit本文／separator／重複header、非Tree参照およびproduction子Process集合の後退を検出する。

本処置は`Applied`／`Self-checked`である。Windowsへ導入したNode.js 24.19.0の絶対実行ファイルでCoordinator全762試験、Git／対話／署名／正式Runner重点35試験、Checker全153試験、CoordinatorとCheckerのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。正式Runner重点coverageはline 94.41%／branch 83.67%／function 88.46%、共通Node Gateはline／function 100.00%だった。全体Checkerは704 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeと同じ独立再レビュー／再監査の全Pass前は`Resolved`、Runtime完成、PR最終候補または正式署名実run可能へ昇格しない。Release鍵passphrase、OAuth再認証および外部Provider送信は引き続き人間操作・判断である。

##### `b1adc03`正式署名Runner独立再レビューの是正

固定Commit `b1adc03b922ee19ab1296a13d8a5e19001d3950a`／Tree `d792bca326752d894bb9a5b79a6648b21f3b3863`へのArchitecture／SecurityおよびDocument／Gap独立再レビューはCritical／Major／Minor 0で`Pass`した。Test／UX独立再レビューはPowerShell、Git Commit解析、package aliasおよび旧Findingの解消を確認した一方、Major 1件として`Fail`とした。40／64文字の能力境界は署名されたCRDD配布Releaseへ適用されたが、実Taskの作業対象Repositoryでは64文字HEADを一度bindでき、Operation、External Send Policy、Candidate StoreおよびExternal Send Grantの後にworkspace materialization一般エラーへ流れる経路が残った。前固定版の部分Passを現在判定へ流用せず、追加の人間判断なしで同じCHG内の共通原因を是正する。

Repository Object Formatのread-only preflightをGit configとHEADのstable identityへ結合し、一般Task Runtimeとboolean probe RuntimeのOperation作成より前へ配置した。対象RepositoryがSHA-256の場合は`coordinator_task_git_object_format_unsupported`または`coordinator_runtime_git_object_format_unsupported`として、Operation directory、External Send Policy／Grant、Candidate Store、workspace、Provider processおよびcleanup対象を一件も作らず停止する。不正／判定不能Repositoryは専用のpreflight failureへ分離する。Repository bind層でも共有40文字Runtime能力を必須にし、preflight迂回時もCapabilityを発行しない。

Git layoutのconfig readerは、従来のversion 0／拡張なしSHA-1だけをAuthority候補として維持しながら、read-only preflightに限ってversion 1のexact `extensions.objectFormat=sha256`と任意の`compatObjectFormat=sha1`を識別する。通常layout解決、local exclude書込みまたはRepository AuthorityへSHA-256を昇格させない。実64文字detached HEAD fixtureは、Operation作成、External Send認可、Candidate Store、workspace materializationおよびprocess startが0回で専用reasonを返すことを確認する。CRDD配布Releaseの64文字fixtureと作業対象Repository fixtureの試験名と責務を分離する。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でCoordinator全765試験、対象Repository／CLI／Git layout／署名Runner重点89試験、Checker全153試験、CoordinatorとCheckerのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。Coordinator Task Runtimeのline coverageは86.63%／branch 78.06%／function 86.05%である。全体Checkerは704 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの3観点独立再レビュー／再監査を行う前は`Resolved`へ昇格しない。Release鍵passphrase、OAuth再認証および外部Provider送信は引き続き人間操作・判断である。

##### `db91288`正式署名Runner独立再レビューの是正

固定Commit `db91288978ff9cf2ff8f43512c0e1d4ad1d4c77e`／Tree `4932c94e523cd21ea9f8429a53c659e59df91492`へのTest／UX独立再レビューはCritical／Major／Minor 0で`Pass`し、正規SHA-256 configと64文字HEADを持つ作業対象Repositoryの旧Major解消を確認した。Architecture／SecurityおよびDocument／Gap独立再レビューは同じ根本原因のMajor 1件を検出して`Fail`とした。preflightはGit configとHEAD file Identityを安定観測したが、HEAD内容またはloose／packed ref先の実Object ID幅を読まなかった。このためSHA-1宣言と64文字Revision、またはSHA-256宣言と40文字Revisionの不整合がpreflightを通り、Operation作成後の一般repository binding failureへ流れた。Provider、GrantまたはCandidate Authorityへの昇格はbind多層防御で防止されていたが、Operation 0と専用preflight failureの現在契約を満たさない。旧固定版の部分Passを現在判定へ流用せず、追加の人間判断なしで同じCHG内の共通原因を是正する。

Object Format preflightは、選択worktreeのGit DirectoryにあるHEADと、Common Git Directoryにあるloose refまたはbounded `packed-refs`をstable同一fileとして読取り、actual Revisionを公開せず40／64文字幅だけを宣言Object Formatへ照合する。linked worktreeではworktree固有HEADと共通config／refの境界を維持する。SHA-1宣言＋40文字およびSHA-256宣言＋64文字だけを整合候補とし、正規SHA-256は従来どおり未対応専用reason、不整合、欠落、曖昧refまたは判定不能はOperation作成前のrepository preflight failureへ閉じる。通常Git layout、local excludeまたはRepository AuthorityへSHA-256を昇格させず、bind層の40文字再観測も削除しない。

代表試験は、正規SHA-256の64文字detached HEADに加えて、SHA-1宣言と64文字detached HEAD、loose ref、packed ref、およびSHA-256宣言と40文字HEADを含む。一般Taskとboolean probeは不整合時もOperation、External Send、Candidate Store、workspace、processおよびcleanupを0件に保つ。本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でCoordinator全768試験、対象Repository preflight重点58試験、Coordinator Task Runtime対象37試験、Checker全153試験、CoordinatorとCheckerのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは704 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの3観点独立再レビュー／再監査を行う前は`Resolved`へ昇格しない。

##### `c0720f3`正式署名Runner独立再レビューの是正

固定Commit `c0720f31b9df18f5b660a6e130853d8ba02a5882`／Tree `58632c9e1c1696c5a5af7254d084ab3111051649`へのTest／UXおよびDocument／Gap独立再レビューはCritical／Major／Minor 0で`Pass`し、宣言Object Formatと実Revision幅の旧Majorを`Resolved`とした。Architecture／Security独立再レビューは同じOperation前preflight契約の水平探索からMajor 1件を検出して`Fail`とした。loose refの最終fileはsymlinkとIdentity差を拒否していたが、`refs`または`refs/heads`等の中間Directoryがjunction／reparse pointの場合に、構成Pathとcanonical realpathの差をpreflightが拒否しなかった。外部Directoryの40文字refをbounded readしてSHA-1候補とし、bind層で拒否するためAuthority、Grant、Candidate Store、workspaceまたはProvider Effectへ昇格しない一方、Repository外readとOperation作成を許し、判定不能RepositoryをOperation 0で止める契約を満たさなかった。

共通stable file readerは、読取り前と同一descriptor読取り後の双方で、構成した絶対Pathとnative canonical realpathの完全一致を要求する。これにより最終file symlinkだけでなく中間Directoryのjunction／reparseも拒否し、正規linked worktreeのworktree固有Git DirectoryとCommon Git Directoryの分離は維持する。normal worktreeの`refs` junction、`refs/heads` junction、最終ref symlink、linked worktreeのCommon Git Directory配下junction、および一般TaskのOperation／External Send／Candidate Store／workspace／process／cleanup 0を代表試験へ追加した。SHA-256 Authority非昇格、bindのfresh再観測と40文字Gate、Revision／Path非公開、PATH Git／shell非使用は変更しない。本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で重点46試験、Coordinator全771試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは704 files／387 Markdown／2240 links／621 anchors／33 Related／32 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの3観点独立再レビュー／再監査を行う前は`Resolved`へ昇格しない。

固定Commit `8eb77899d368429224390cd2f111ac4f952033ac`／Tree `d01ec2ae67302dfc659cd351e94534ea646a97b0`へのArchitecture／Security、Test／UX、Document／Gap独立再レビューは、いずれもCritical／Major／Minor 0で`Pass`し、新規Findingなしとした。Architecture／Securityは前回と同じ`.git/refs`外部junction診断が候補から`null`へ変わることを実測し、Test／UXは関連91試験を独自再実行してPassした。normal／linked worktree、`refs`／`refs/heads` junction、最終symlink、detached／loose／packed ref、Object FormatとOID幅、Operation前の全Effect 0、Authority非昇格、Revision／Path非公開を一括確認した。c0720f3のMajorは`Resolved`であり、本Runner Gate是正集合も`Resolved`とする。実Release鍵、Docker、OAuth、AppContainer、ETWおよび実Provider送信はこのread-only独立再レビューの対象外であり、それぞれの人間操作・実行Gateを代替しない。

##### Runner Gate監査往復からの既存収束契約強化

Object FormatとOID幅の是正後、初回から存在した中間junction境界を再レビューで検出した。厳しい独立監査が未知の反例を検出する役割は維持する一方、修正担当側の着手前整合が入力形式へ偏り、Path alias、lifecycle段階、Effect発生点および重複readerを同じ確認母集団へ含めなかったため、既知の隣接条件を固定版ごとに小出しで処置する往復が生じた。これはモデルをCodexからClaude Codeへ替えるだけでは解消せず、モデル差に依存しない母集団とEvidence対応が必要である。

既存の着手前整合確認、複数箇所是正、初回レビュー網羅性および変更実行契約を正本としたまま、Trust／Security／Authority／Effect境界では入力／状態、alias・indirection・境界、lifecycle段階およびEffect発生点を適用可能な確認軸として先に固定する。preflightと後段Gate等が同じ対象を読む場合は、全observer／reader／parserと利用側を列挙し、共通bounded primitiveまたは同等性と意図した差の試験へ接続する。再レビューで既知母集団内の見落としを検出した場合は一箇所だけを再修正せず、未走査組合せと並行Gateを修正担当側で一括再照合して次の固定候補へまとめる。`10_Agent.md`、`19_Maintenance.md`および`tools/coding-standards.md`の既存条項をこの具体性まで強化し、新しい監査、承認段階、正本文書、恒久表または安定コンテキストIDは追加しない。Coordinator実装READMEは、上位Coordinatorが`acceptanceCriteria`へ確認母集団を具体化する接続と、Task Packet Runtime自身は自然言語上の完全性を生成・証明しない現在限界を明示する。

##### Windowsの対話コンソール用デバイスパスの是正

最終候補`f09694b6d3ea1d4d73d4c56e6e2dc86dce8d4c11`を署名した正式一般タスクの実行では、可視PowerShell、明示`conhost.exe`および可視`cmd.exe`のいずれから起動しても、リリース検証またはタスクの効果より前に`signed_general_task_interactive_console_required`で停止した。全停止でプロバイダー、Docker、ネットワーク、候補または正規リポジトリへの効果は0、回復IDはなく、手動回復は不要だった。

原因は起動シェルではなく、共通対話コンソール基本機能がWindowsデバイスを相対名`CONIN$`／`CONOUT$`で開いていたことである。Node.js 24系のWindowsファイルシステムAPIでは相対デバイス名が現在ディレクトリからの相対パスとして解釈され、先に開く`CONIN$`が`ENOENT`となった。`CONOUT$`もデバイスとしての同一性を保証せず、通常ファイルを作成し得る。両方を明示デバイス名前空間`\\.\CONIN$`／`\\.\CONOUT$`へ固定する必要がある。これは外部送信Grantと正式Runnerが共有する同一基本機能の実装不具合であり、人間へ手動Command Prompt起動を要求しても解消しない。

是正ではWindowsデバイス名だけを明示名前空間へ変更し、共通対話コンソール契約をrevision 2へ更新する。POSIX `/dev/tty`、標準入力への代替禁止、シェル搬送禁止、コンソール不在／デバイスを開く処理の失敗時のFail Closed、一回限りの確認要求と入力および出力境界は変更しない。外部送信Grantと正式Runnerは共通基本機能の参照で追従し、個別の代替経路または別のコンソール所有者を追加しない。未リリースCHG-000015内の回帰として同じ変更、検証、切戻しおよびリリース境界で是正し、別CHGへ分割しない。

発火例は実Win32 Consoleへ接続したWindowsプロセスで両明示デバイスを開ける場合、非発火例はコンソールを必要としない通常の非対話処理、境界例は標準入出力がパイプでもプロセスがコンソールへ接続されている場合、判定情報不足例は一方または両方のデバイスを開けない場合である。正式Runnerは最後のケースをリリース検証、タスク開始およびタスクの効果より前に停止する。外部送信Grantの利用側は、先行するローカルのオペレーション／Candidate Store準備を回復契約に従って片付け、外部送信の決定権限、プロバイダーおよびネットワークの効果より前に停止する。

初回固定版`a7d61aa68c9cd5056bb62f3e4dd92e352798b45b`へのArchitecture／Securityレビューは`Pass`した。Document／Gapレビューは利用者ロケール優先表示のMinor 1件、Test／UXレビューは実デバイスを開く経路を直接試験しないMajor 1件と、原因記録および効果発生点のMinor 2件を検出した。旧固定版の部分Passを現在判定へ流用しない。

再処置では、共通基本機能へ内部OSアダプターを与え、Windowsの正確な`\\.\CONIN$`＋`r`、`\\.\CONOUT$`＋`w`、POSIXの`/dev/tty`、両ハンドルの引き渡し、成功時の回収、入力／出力デバイスを開く処理の失敗、処理例外、各ハンドルを閉じる処理の例外および一方の回収失敗後も他方を回収する全組合せを決定論的に試験する。本番の公開パッケージ入口へアダプター、ハンドルまたは汎用コンソール能力を追加せず、相対名、標準入出力またはシェルへの代替を許さない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で共通コンソール／正式Runner／外部送信Grant重点20試験、Coordinator全772試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、リポジトリ全体Checkerおよび`git diff --check`をPassした。全体Checkerは701 files／384 Markdown／2,235 links／650 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Tree、独立Architecture／Security、Document／GapおよびTest／UX再レビュー、再署名、正式一般タスクの実行と残存0確認が完了する前に本指摘事項を`Resolved`、Runtime完成またはリリース可能へ昇格しない。

##### Windows対話表示のUnicode境界是正

固定版`1461b4534629047cff0c0f2d54a21202e1ce49f1`／Tree `3a18948d879a74f3be68127f479b34c08b71671b`は三つの独立再レビューでCritical／Major／Minor 0となり、リリース順序（`releaseSequence`）`2026082502`、マニフェストのSHA-256 `c5e12c52a7371c472e70cccf97c1f90aac2e769699d39290ef61745384f8a810`として署名に成功した。修正済みの明示デバイス名により正式Runnerは対話確認まで到達したが、Windowsの`CONOUT$`へUTF-8バイトを直接書いた承認表示が文字化けし、人間が内容を判読できなかった。承認確認コードは入力せず`Ctrl+C`で停止した。Candidate Store／RuntimeStateは空、今回由来のDocker、Provider Home更新、プロバイダー／ネットワークの効果、回復IDおよび一時出力残存は0である。リリース順序`2026082502`の署名済み配布候補は現在の修正後の配布物Identityへ流用または再署名しない。

原因はデバイス名や起動シェルではなく、Windowsコンソールハンドルへ`fs.writeSync`でUTF-8バイトを書いたことである。Windowsコンソールは現在の出力コードページでバイトを解釈するため、Unicode文字列の表示成立を保証しない。外部`chcp`、シェル搬送、親環境または文字化けした承認の受理を代替経路にせず、WindowsではNodeのTTY出力だけをUnicode表示経路とし、`CONOUT$`は実コンソールの存在確認に維持する。TTYでない標準出力、表示例外またはコンソールデバイス不成立はGrantを発行せずFail Closedとする。POSIXは従来どおり`/dev/tty`へUTF-8で直接表示する。

共通対話コンソール契約はrevision 3とする。発火例はWindowsで明示`CONIN$`／`CONOUT$`を開け、かつ標準出力がUnicode対応TTYである直接実行、非発火例は対話確認を要しない処理、境界例は標準出力をリダイレクトしたWindowsプロセス、判定情報不足例はTTY判定または表示処理が成立しない場合である。最後の二例は別の出力、コードページ変更またはシェルへ代替せず、外部送信Grantを発行しない。決定論的試験はWindows TTYへの日本語文字列、リダイレクト時の拒否、POSIXデバイス表示および表示例外を固定し、既存のデバイスを開く処理／処理／回収の全失敗位置試験と組み合わせる。

固定版`38d33168f1a368fd984587acdf587b7b62055ced`／Tree `56ec3b7d5d3fa6ef8e848c9503bf48b4d29402dd`の独立レビュー集合は、Document／Gapで日本語優先表示のMinor 1件、Architecture／SecurityおよびTest／UXで同根のMajor 1件を検出した。Node.js 24.19.0のWindows TTYでは`process.stdout.write`の完了通知が関数復帰後となるため、revision 3案は承認内容の表示完了前に入力を開始し、最終表示の非同期失敗後にもGrantを発行し得た。同期例外だけの試験と記録を現在判定へ流用せず、revision 3案を正式実行、`Resolved`またはRuntime完成へ進めない。

再処置では共通対話コンソール契約と外部送信Grant契約をrevision 4へ更新する。Windows TTY書込みは完了通知または同じ書込み期間の非同期エラーへ一度だけ収束させ、初回の承認内容と確認コードの表示完了後だけ入力を開始する。入力はイベントループを塞がない非同期読取りとし、`SIGINT`／`SIGTERM`、読取り失敗または終了を確認失敗へ閉じる。正しい確認コードの入力後も最終表示の完了と両コンソールハンドルの回収が成立した場合だけGrantを発行する。一方のハンドル回収失敗後も他方を回収し、回収不明を成功へ流用しない。標準出力のリダイレクト、非TTY、書込み完了失敗、ストリームエラー、取消または読取り失敗では、プロバイダー／ネットワークの効果より前にGrant 0とし、先行するローカル準備を既存のクリーンアップ／回復契約へ戻す。

決定論的試験は、保留中の初回表示では入力0、初回表示成功後だけ確認コードを読取り、最終表示成功後だけ確認成功となる順序を固定する。初回表示失敗、取消／読取り失敗、誤った確認コード、最終表示失敗、同期例外、非同期エラー、リダイレクト、非TTY、非同期処理中のハンドル保持、処理失敗および両ハンドル回収を同じ契約母集団へ含める。POSIX `/dev/tty`、`CONIN$`／`CONOUT$`の存在確認、標準入力・`chcp`・シェル・親環境への代替禁止、Subscription限定、API課金への代替禁止および公開パッケージ入口は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で共通コンソール／外部送信Grant／正式Runner重点53試験、Coordinator全777試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatterおよびリポジトリ全体CheckerをPassした。全体Checkerは701 files／384 Markdown／2,235 links／650 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／TreeへのArchitecture／Security、Document／GapおよびTest／UX独立再レビュー、未使用の新しいリリース順序による再署名、正式一般タスクの実行と残存0確認が完了する前に本指摘事項を`Resolved`、Runtime完成またはリリース可能へ昇格しない。

固定版`c7f08899cafa64f4c8352205a7b66a429c08aee5`／Tree `1de69a907b0a398376762a4af32072c1cb488cda`の三つの独立再レビューは`Fail`とした。Document／GapはMajor 1件とMinor 1件、Architecture／SecurityとTest／UXは同根のMajor 2件を検出した。取消監視が入力読取り中だけに存在し、初回表示待ちと最終表示待ちの取消を保持しなかった。取消時は保留中の`fs.read`完了を待たずにコンソールハンドルを閉じ得た。Windows TTY書込みのコールバックがエラーを返した直後に監視を外すため、Nodeが続けて発行する`error`イベントを未処理にし得た。通常成功順の旧Major解消だけを現在判定へ流用せず、revision 4を再署名、正式実行、`Resolved`またはRuntime完成へ進めない。

同根原因を、外部イベント、非同期I/O、取消およびAuthority利用側を一つの状態・資源所有契約として固定しなかった着手前整合不足と判定した。Coordinator全体を水平走査し、保留中の文字デバイス読取りを直接扱う箇所はこの対話確認経路だけであり、Docker子Process管理、同期の上限付きファイル読取りおよび通常の結果表示は別の既存所有契約であることを確認した。レビュー往復を特定Node実装だけの事例として閉じず、`10_Agent.md`、`19_Maintenance.md`、`tools/coding-standards.md`、公式`AGENTS.md`および`template/AGENTS.md`の既存条項へ一般化した。外部イベント、非同期I/O、子Process、外部実行基盤または取消可能な処理では、状態遷移、保留処理、イベント監視、ハンドル、Capability、Authority、Effect、実際の基本機能または複合順序を再現する試験用実装、全利用側の待機直後再確認、および監査往復から標準へのフィードバック判断を初回固定前に要求する。監査間で是正方針を整合済みでも、具体化した解決策が新しい状態、資源、境界または利用側を導入する場合は、変更後の経路を対象に着手前整合確認と固定候補前の完全性確認を再実行する。指摘事項との対応確認と、解決策自身の完全性確認を分け、前者の成立から後者を推定しない。新しい監査種別、正本文書、恒久表または安定コンテキストIDは追加しない。

revision 5では、Operation所有の`AbortSignal`へCLIの`SIGINT`／`SIGTERM`とRuntime取消を合流し、承認開始前から最終表示完了まで取消状態を保持する。生の非同期`fs.read`は廃止し、明示`CONIN$`／`CONOUT$`の存在確認を維持したうえで、リダイレクトされておらず既存の読取り処理を持たないNode TTY入力だけを承認入力の所有経路とする。取消、読取りエラー、終了または入力上限超過ではTTY読取りを停止し、イベント監視を回収してから確認処理を終了する。非TTY標準入力を代替経路にせず、TTY入力不成立ではGrant 0とする。Windows Unicode TTY出力はコールバック完了後も次のイベントループ境界まで同じ`error`監視を保持し、コールバックエラーと後続`error`イベント、先行`error`イベント、同期例外および書込み抑制（`backpressure`）を一回だけ成功または失敗へ収束させる。

確認順序は、取消前提確認、初回表示完了、取消再確認、TTY入力完了または安全な停止、取消再確認、最終表示完了、取消再確認、コンソール検査ハンドル回収、Grant発行に固定する。Coordinator Taskは外部送信Authority待機直後かつworkspace作成前に同じ取消状態を再確認する。実Node `Writable`のコールバックエラーと後続`error`イベント、実Node Streamの入力完了／取消／入力完了直後の遅延エラー、初回表示前・表示待ち・入力待ち・最終表示待ちの取消、イベント監視残存0、両検査ハンドル回収、Grant／workspace／Provider／Network Effect 0を固定候補前の受入条件とする。既存のSubscription限定、API課金への代替禁止、シェル・`chcp`・親環境への代替禁止、正規Repository非変更および公開パッケージ入口は変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で共通コンソール／外部送信Grant／正式Runner／Coordinator取消重点57試験、Coordinator全781試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatterおよびリポジトリ全体CheckerをPassした。実Node `Writable`の複合エラー順と実Node Streamの入力完了／取消をモック試験から分離して確認した。新固定Commit／TreeへのArchitecture／Security、Document／GapおよびTest／UX独立再レビュー、未使用の新しいリリース順序による再署名、正式一般タスクの実行と残存0確認が完了する前に本指摘事項を`Resolved`、Runtime完成またはリリース可能へ昇格しない。

固定版`30663dc5f0964b05794e4f8263bda2b80ceeb0af`／Tree `cd1a1fd3392e70c02bcea824723a38b57df0e343`へのArchitecture／Security、Document／GapおよびTest／UX独立再レビューは、旧指摘の非同期出力失敗、取消伝播および保留読取り回収を解消済みとした一方、三観点とも通常の公開Task経路で構造化要求と承認入力が同じ`process.stdin`を競合するMajorを検出した。Test／UXはcleanup例外が未処理または黙殺され、終了後状態を確認せず成功し得るMajorも検出した。Document／Gapは事前確認と実処理の成立条件が一致せず、Task開始前停止の主張を満たさないMajorを検出した。固定版の部分解消を現在判定へ流用せず、再署名、正式一般タスクおよび外部Provider送信へ進めない。

発生点は、監査条件を非同期処理の局所修正へ取り込んだ一方、着手前整合で公開入口の入力搬送と対話入力の物理channelを同じ実行形態へ再構成せず、構造化入力と対話入力の単体肯定試験を別々に成立根拠としたことである。監査間是正方針レビューの不足だけでなく、具体設計で新設した資源役割の競合、cleanup後条件および事前確認と実処理の同等性を固定候補前に反証しなかった。高性能なモデルまたは同じ長期セッションなら気づくことを成立条件にせず、既存の着手前整合確認、変更実行契約、実装規則、公式AI入口および配布ひな型を強化する。

強化後は、同じProcess、channel、stream、descriptor、handleまたは一時領域を複数役割へ使用する場合に、役割別の所有者、lifecycle、EOF／close／取消、競合およびcleanup後条件を列挙する。固定候補前には公開入口から本番同等のProcess構成と入力搬送を再構成し、成功例ではなく主張を破る入力、通知順、資源競合およびcleanup失敗を反証する。監査往復は、要求／正本、着手前整合、監査条件の具体化、実装逸脱、試験形態、監査入力または初回監査のどこで最初に防げたかを分類し、一般化可能な原因だけを既存正本、ひな型、Checker、生成器または契約試験へ還元する。新しい監査、工程、恒久成果物または安定コンテキストIDは追加しない。

採用プロジェクトの通常作業では、考慮不足と利用側で必要な是正を説明しても、CRDD標準への具体的な還元提案を通常の進行報告へ混在させない。CRDD正本、ひな型、Checkerまたは契約試験への還元は、CRDD標準の保守または変更提案が明示的な対象となった場合だけ行う。今回はCRDD標準自身の未リリース`CHG-000015`を保守しているため、同じ変更、検証、切戻しおよびリリース境界へ含める。

##### 公開Task搬送と対話入力を分離するrevision 6是正

固定版`30663dc5f0964b05794e4f8263bda2b80ceeb0af`の三観点Majorを受け、公開`coordinator task --request-stdin`のfd0は上限付きJSONをEOFまで読む構造化搬送専用とし、対話承認から`process.stdin`を除去した。Windowsではfreshな`\\.\CONIN$`／`\\.\CONOUT$`の双方をTTYとして検証し、標準出力が書込み可能なUnicode TTYであることも事前確認と実処理の共通条件にする。入力descriptorだけを署名Releaseのpackage content rootへ含まれる非公開固定readerのfd0へ複製するため、親Task stdinがpipeでも承認入力と競合しない。

readerは検証済みOperation管理Capabilityの後、Provider／Network／workspace Effectの前に起動する一回限りのProcess Effectである。実行Runtimeは現在の`process.execPath`の絶対Path、entrypointはmodule相対の固定絶対Path、argvと環境は空、`shell:false`、安全な固定Directory、標準入力はexact console descriptor、標準出力は512 bytes上限、標準エラーは破棄、制御は私有IPCに固定する。親のCredential、proxy、PATH、HOME、`NODE_OPTIONS`および`NODE_PATH`を継承せず、任意argv、caller Path、Repository、Provider Home、NetworkまたはProvider実行能力を与えない。Reader moduleは公開package exportへ追加せず、既存の再帰的package file inventory、安定Filesystem Identity、各file Hashおよび`packageContentRootSha256`によって署名Release Identityへ結合する。

入力protocolはstrict UTF-8の6桁challengeとCRLFまたはLFのexact 1行だけを受理する。複数行、NUL、制御文字、不完全multibyte、64 bytes超過、EOFまたは余分byteを拒否し、子の結果もexact 1 JSON record、512 bytes以下、正常exitおよびstdout close後だけ受理する。取消または125秒の親timeoutではIPC停止要求を送り、500 msで終了しなければ同じ固定子Processを強制終了し、`close`、stdout終了、listener回収およびdescriptorの順に収束してからGrant 0を返す。子は自身でも120秒で停止し、子Processを生成する能力を持たない。同じWindows consoleへの同時readerは固定kernel lockで一つに限定し、lock解放、表示、入力、子終了またはdescriptor回収のいずれかが不成立ならGrantを発行しない。

cleanupは例外を捕捉した事実だけで成功にせず、全remove／close試行を続行して終了後条件を集約する。出力listenerのremove例外、入力の各listener remove例外、Abort binding、pause、両console descriptorおよびkernel lockを確認し、一つでも不成立なら正しいchallengeを受けても成功へ昇格しない。事前確認が成立して実処理が不成立となる状態変化では、Provider／Network／workspace Effectを開始せず、既存Operation cleanup／Recoveryへ戻す。事前確認のopen／inspect／close自体は一時OS資源取得であり、Provider Effect 0と同一視しない。

決定論的試験は、Task stdinを構造化搬送へ固定し親console moduleが`process.stdin`を読まないこと、readerの非TTY拒否、厳密line protocol、cleanup全試行、同時kernel lock、empty env、固定argv／stdioおよび公開export不変を確認する。親Processの状態機械は、子`close`先行、stdout `close`先行、遅延出力、重複通知、取消、timeout、IPC停止、強制終了失敗およびlistener残存0を再現し、子とstdoutの双方の`close`を確認できるまで通常結果を返さない。OSが固定子の終了を報告できない場合は、状態不明のまま成功またはGrantを返さずfail-stopを維持する。Windows実測では親が開いた`CONIN$`を子fd0へ複製すると子がTTYとして認識し、取消後約0.6秒で子`close`まで完了し、250 ms後の親active handleにChildProcessは残らなかった。さらに実子Processのfd0をTask JSON pipe、fd1を`CONOUT$`、対話readerを別`CONIN$`へ同時に結び、取消完了後もTask JSON byte列がfd0へ完全に残ることを確認した。Coordinator全786試験、Checker全153試験、package／対話／Grant／lock重点30試験、strict typecheck、Lint、FormatterおよびRepository全体Checker（702 files、384 Markdown、2237 links、652 anchors、Error 0、Warning 0）はPassした。固定Commit／TreeへのArchitecture／Security、Document／GapおよびTest／UX独立再レビュー前は旧Majorを`Resolved`、再署名、正式一般TaskまたはRuntime完成へ昇格しない。リリース順序`2026082502`は再利用しない。

##### 親死活・Package Identity・実子Environmentを閉じるrevision 7是正

固定版`38a72267ea58af15c5d181cf99ba34cd2ee40846`／Tree `6cb2e11202d95ae72917c3df8e54e68040a50aae`へのArchitecture／Security、Document／GapおよびTest／UX独立再レビューは、fd0分離と通常cleanupを解消済みとした一方、親Process消失時に固定readerが自身のtimeoutまで残り得ること、公開`coordinator task --request-stdin`が署名package検証済み状態をTask入口へ結合していないこと、Windowsの`env:{}`が実子へPATH／profile系のambient値を補うこと、argvとEvidenceの表現差および本CHGの変更分類差を検出した。三監査へ統合是正方針を戻し、競合なしの`Accept with Conditions`を得てから同一未リリースCHG内で一括是正した。

固定readerは親IPCの`disconnect`を読取り開始前から監視し、監視登録後に接続状態を再確認する。親消失、取消またはtimeoutでは保留入力を終了し、子Process、stdout、IPC、listener、timer、console descriptorおよびkernel lockの終了後状態を確認する。親消失後は結果をstdoutへ書かず、書込み中のdisconnect／EPIPEもGrantへ昇格しない。Windows実Processで親だけを強制終了し、固定reader PID不存在、kernel lock再取得および次readerの単独成立を外部observerから確認する。

固定manifestの署名、Release Identity、Commit／Tree、package content rootおよび固定reader artifactを再検証した同一Processだけが、短命・一回限り・非serializeのopaque verified-package capabilityを発行できる。公開Task入口と正式Runnerは同じ発行経路を使用し、Task本番facadeはconsume時にfresh検証とIdentity一致を再確認する。欠落、偽造、別配布Root、別Release、差替えまたは期限切れは、Operation、console、kernel lock、Candidate Store、workspace、ProviderおよびNetwork Effectより前に停止する。Task JSON schema、argv、環境、fileまたはcaller claimで検証済み状態を移送しない。

WindowsではNodeへ空または非空の環境mapを渡した事実を親環境非継承の根拠にしない。内部Node reader、署名済みnative helperおよびDocker CLIは用途別の固定Profileを使い、PATH、HOME、profile、proxy、Credential helperおよびNode injection名を固定neutral値へ閉じる。Windows directoryは親`process.env`をAuthorityにせず、現在ProcessへOS loaderが読み込んだ`kernel32.dll`のmodule PathからSystem32とWindows directoryを再構成し、non-reparse実体とcanonical Pathを確認してだけ渡す。実子が観測するkey集合とneutral状態を秘密値なしで確認する。Worker threadの`env:{}`はCreateProcess環境ではないため別契約として理由付き非該当とする。argv契約は固定絶対entrypoint exact 1件と追加引数0件を示す`fixed_entrypoint_only_no_dynamic_arguments`へ統一する。

対話結果は内部の`confirmed`、`declined_invalid`、`cancelled`、`timeout`、`unavailable`、`reader_failed`および`cleanup_unknown`へ上限付き分類する。入力値、challenge、PID、Path、環境値または生OS errorは公開しない。Prompt後の改行は表示上のbest effortであり、cleanup成立の代替にしない。Grantは確認成功、取消なしおよび全cleanup成立時だけ発行し、`cleanup_unknown`は通常拒否へ弱めず手動回復を要求する。

本CHGはRuntime実装だけでなく、`10_Agent.md`、`19_Maintenance.md`、公式`AGENTS.md`、配布`template/AGENTS.md`および`tools/coding-standards.md`の規範を同じ未リリース意図で変更しているため、最大強度を`normative`、v0.18.0候補のリリースレベルを`MINOR`、`migration_required`を`true`へ是正する。採用側は標準保守、公式／配布AI入口、resource-role分離、preflight同等性、cleanup結合および監査往復の汎化利用側を棚卸しし、移行、置換、据え置きまたは対象外を記録する。Node IPC、Windows console名、具体的環境key、timeoutおよびbyte上限はCoordinator実装へ残し、一般規範へ昇格しない。最終Release、統合および残存リスク受容は人間の決定権限に残す。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で、親Process強制終了、実子Environment、Package Capability、外部送信承認、Task入口およびDocker cleanupを含む重点117試験、Coordinator全790試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは704 files／384 Markdown／2237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／TreeへのArchitecture／Security、Document／Gap、Test／UXおよび規範変更に対するConformance確認を含む全再監査が`Pass`する前に`Resolved`、再署名、正式一般Task、Provider Effect、Runtime完成またはRelease可能へ昇格しない。リリース順序`2026082502`は再利用しない。

##### Gate順序・OS Context・cleanup意味を閉じるrevision 8是正

固定Commit `71cca741fdd73482d34fc104ec809502f4730acf`／Tree `b88be4afc5b2d7301bf49193f38ad97eacb680fe`へのArchitecture／Security、Document／GapおよびTest／UX独立再監査は、旧親Process孤児化、fd0分離、固定argv、Windows ambient値のneutral化、Package Capability構造および規範分類を解消済みとした一方、統合してMajor 6件、Minor 3件相当を`Fail`とした。親環境の`SystemRoot`／`WINDIR`をOS Authorityとしていたこと、console descriptor／kernel lock cleanup不明を通常利用不能へ畳んだこと、正式RunnerがPackage Gateより前にconsole preflightを行ったこと、Windows用Profileを共通readerへ適用してPOSIXを停止したこと、子failsafeが親timeoutより先だったこと、およびPackage Capability成功状態機械のEvidence不足が主因である。最終改行、次readerとlock、更新日にも小さな不整合があった。3監査へ統合是正方針を再提示し、競合なしの`Accept with Conditions`を得た。現在追加の人間判断は不要である。

Windows directoryは親環境から取得せず、現在ProcessへOS loaderが読み込んだexact `kernel32.dll`のmodule Pathから観測し、System32、Windows directory、canonical realpathおよびnon-reparse実体を検証する。偽Windows treeと偽親環境を与えてもそのPathを子へ渡さない。PATH、Home、profile、proxy、Credential helperおよびNode injection値のneutral化は維持する。POSIX readerは固定空環境へ分離し、Windows Local Personalの正式保証範囲をPOSIXへ拡張しない。

Console所有結果は`completed`、`unavailable`、`operation_failed`および`cleanup_unknown`へ分け、両descriptor closeを全試行する。出力writerも`completed`、`write_failed`、`cleanup_unknown`へ分け、Promptと最終改行をboundedにする。Prompt後は取消やread失敗を含む全経路で改行を一度だけ試すが、改行単独失敗は表示失敗としてGrant 0、manual recoveryなしにし、listener、reader child、descriptorまたはlockの回収不明だけをprocess再起動要求へする。cleanup不明になったProcessは非serializeのprocess-local poison状態へ移し、同一Processの後続Package発行とTask開始を全Effect前に拒否する。無関係なOperation Recovery IDをconsole回復Authorityとして返さず、Operation cleanupも失敗した場合だけprocess再起動条件と正当なHost Recovery IDを両方保持する。

正式RunnerはNode Gate、Package Capability発行とRelease Identity確認、console preflight、Task開始の順へ固定する。Package Capabilityの内部状態機械は、単独でOperation Authorityを与えない隔離候補で成功、fresh exact Identity、single use、replay、期限切れ、全Identity差およびproduction consumer非互換を検証する。親timeout、取消猶予およびcleanup marginの合計を子orphan failsafeより短く固定し、親消失時だけ子failsafeを最後の境界とする。親kill後の次readerは、再取得したkernel lockをreader closeまで保持する。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でCoordinator全798試験、Checker全153試験、対話境界重点18試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは706 files／384 Markdown／2,237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの全監査Pass前に`Resolved`、署名、正式一般Task、Provider EffectまたはRuntime完成へ昇格しない。リリース順序`2026082502`は再利用しない。

##### cleanup所有権とProcess再利用境界を閉じるrevision 9是正

固定Commit `c132b3b037b62453fd04401796fe66e62573eab6`／Tree `d42b86a91d79c57c7c27192e621317e43c07ca13`への3独立監査は、親環境非Authority、timeout順序、Package Capability状態機械、POSIX固定空環境およびTask側のOperation cleanup分離を解消済みとした一方、同期console preflightのdescriptor close失敗、Windows terminal writeのcallback未完了timeout、およびconsole kernel-lock workerの終了未確認を通常利用不能へ縮退する同根Majorを検出した。production process poisonと後続Package／Task／Grant停止の貫通Evidence、Runner Gate順序の時系列、Reader cleanup故障、7対話状態の投影およびmachine descriptorにも不足があり、validation失敗をoperation開始後と誤分類するMinorを含めて監査集合を`Fail`とした。3監査へ統合是正方針を再提示し、競合なしの`Accept with Conditions`を得た。追加の人間判断は不要である。

同期preflightは`available`、`unavailable`、`cleanup_unknown`、非同期console所有は`completed`、`unavailable`、`operation_failed`、`cleanup_unknown`を返し、validation成功後かつoperation呼出し直前だけoperation開始済みとする。Windows terminal writeはcallback errorまたは同期throwでlistener回収済みなら`write_failed`、callback未完了timeoutまたはlistener回収不明なら`cleanup_unknown`とする。timeout後は結果を一度だけ固定し、遅延callbackにAuthorityまたは状態を変更させず、Process再起動までexact 1件の遅延error sinkを保持する。同じstdoutで再起動理由を必ず表示できるとは主張せず、内部のfail-stop判定を優先する。

対話console専用kernel lockは共通同期lock利用側から分離したasync構造化取得を使う。lock非取得とworker terminate／exitを確認した場合だけ`unavailable`、取得済みの場合はrelease stateとworker exitの双方を確認して`released`とする。acquire timeout、terminate／exit／release不明は`cleanup_unknown`である。Candidate Store、Provider Home、Docker Runtime StateおよびHost Operationの既存同期lock意味は本是正で変更しない。descriptor、writer、readerまたはconsole lockのcleanup不明を確認したRuntime所有境界だけが、非serializeかつreset不能のprocess-local poisonを同期的に成立させる。後続Package発行はmanifest／Filesystem観測前、TaskはCapability consume／Operation／console／Store／workspace／Provider／Network前、External Send再入はAuthority確認前に停止する。既に開始済みの別Operationの遡及取消は保証せず、fresh Processだけが非poison状態から開始する。

正式RunnerはNode、Package／Release、Repository Object Format、console、Taskの順に固定し、失敗境界ごとのevent列と同一opaque capabilityのexact handoffを確認する。console失敗時の未consume capabilityはRuntime-local、非serialize、非公開でTaskへ渡らず、単独ではOperation Authorityにならない。Grant Runtimeは`confirmed`、`declined_invalid`、`cancelled`、`timeout`、`unavailable`、`reader_failed`および`cleanup_unknown`をTask理由、manual recovery、Recovery IDおよびEffect 0へ対応付ける。cleanup不明だけがProcess再起動を要求し、console由来のRecovery IDは0、Operation cleanupも失敗した場合だけ正当なHost Recovery IDを結合する。現行CHANGELOGの一般化済み移行説明とも再照合し、本是正による矛盾または追加の利用者移行差分はないため変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でcleanup fault、7対話状態、正式Runner順序およびproduction process poison貫通を含む重点91試験、Coordinator全805試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは707 files／384 Markdown／2,237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの全監査Pass前に`Resolved`、署名、正式一般Task、Provider EffectまたはRuntime完成へ昇格しない。リリース順序`2026082502`は再利用しない。

##### cleanup認識時点と全起点のproduction貫通を閉じるrevision 10是正

固定Commit `2f2a2975f44ea6f16868c5bda291d3764887deb5`／Tree `553267c30791719789bf8737dbce201ec68fafc8`への3独立監査は、revision 9までの個別cleanup結果、Runner順序、7対話状態およびpoison後Gate自体を解消済みとした一方、operation側がcleanup不明を認識してからconsole lock releaseを待つ間に同一Processの新しい処理が再入できる時間窓をMajorとして検出した。Gap／Impact監査は同期descriptor close以外のwriter、reader、lock起点からproduction singletonと全Effect Gateまでの貫通Evidence不足を同根Major、Test／UX監査は既poison後のExternal Send再入が`null`へ縮退してProcess再起動理由を失うMinorを検出した。監査集合全体を`Invalidated`とし、3監査へ統合是正方針を再提示して競合なしの`Accept with Conditions`を得た。現在追加の人間判断は不要である。

actual productionのreader／writer wrapperは`cleanup_unknown`を返す直前に同期poisonする。Runtime所有のconsole confirmationはoperation valueまたはdescriptor wrapperのcleanup不明を認識した直後、console lock releaseの最初の`await`より前にpoisonし、その後もdescriptor、reader、writer listenerおよびlock releaseのcleanupを全試行する。lock releaseが初めて不明になった場合は、その結果または例外を認識した直後にpoisonする。generic `UsingAdapter`と隔離候補はproduction stateを変更せず、production confirmationはpackage exports、CLIまたはcaller注入可能なAuthorityへ追加しない。

既poisonのExternal Send production入口は、入力、Cancellation Signal、Authority、Repository、Policy、clock、challenge、consoleまたはlockを参照せず、`external_send_confirmation_cleanup_unknown_process_restart_required`、`manualRecoveryRequired:true`、Grant 0、Recovery ID 0、raw content／Host Path 0のbounded `blocked`結果を返す。Taskは専用Coordinator理由へ投影して通常Operation cleanupを続け、cleanup成功時はProcess再起動だけ、cleanup失敗時だけ正当なHost Recovery IDとの複合理由を返す。既開始Operationの遡及取消は保証しない。

production境界の実証ではNode builtinのOS境界だけをfresh child内で故障注入し、Runtimeへ任意callback、test Capability、dynamic argv／envまたは公開exportを追加しない。descriptor close、writer timeout、reader IPC cleanup、lock acquire terminate／exit不明、lock release exit不明の5 modeを別々のfresh Processで発火し、各originの`cleanup_unknown`、同期不可逆poison、Package入力／manifest／Filesystem非参照、Task Capability／Operation／Store／workspace／Provider／Network 0、External Send入力／Authority／console 0、Runner再起動理由／manual recovery／Recovery ID 0、および次のfresh Processだけが非poisonで開始することを確認する。writer／readerではlock releaseを保留し、保留中の再入拒否と、完了後もpoisonが維持されfresh Processだけが復帰することを確認する。現行CHANGELOGの一般化済み移行説明には追加矛盾または利用者移行差分がないため変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0で5 cleanup起点、保留release中の再入、External Send bounded結果およびTask cleanup投影を含む重点76試験、Coordinator全805試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは707 files／384 Markdown／2,237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの全監査Pass前に`Resolved`、署名、正式一般Task、Provider EffectまたはRuntime完成へ昇格しない。リリース順序`2026082502`は再利用しない。

##### production convenience入口をOutcome正本へ閉じるrevision 11是正

固定Commit `0c2fdf54ac3d82ea1da88b7b5574abc275b293b5`／Tree `44628b749c45442aa94908c6084b9105138d8b0d`へのArchitecture／Security監査は`Pass`、Document／Gap／Impact／Conformance監査は、release保留中の再入拒否と完了後のpoison維持を区別しない自己確認記録をMinorとした。Test／UX監査は、正式External Send経路の旧Findingを解消済みとした一方、`withInteractiveConsole`、`withInteractiveConsoleAsync`および`readInteractiveConsoleLine`のproduction convenience入口がpureなgeneric adapterへ直接接続され、cleanup不明を通常の`null`へ縮退できる初回見落としをMajorとして検出した。監査集合全体を`Invalidated`とし、3監査へ統合是正方針を再提示して競合なしの`Accept with Conditions`を得た。追加の人間判断は不要である。

production同期Outcomeを正本入口として追加し、同期／非同期consoleとreaderのconvenience入口は対応するpoison付きproduction Outcomeだけへ一方向に委譲する。cleanup不明を認識したOutcome境界が同期poisonし、noncompleted状態の値を`null`へ消去した後だけconvenienceが値または`null`へ縮退する。writerとavailabilityの既存poison付き経路も同じ閉じたproduction入口母集団へ含める。generic `UsingAdapter`群はproduction stateを読まず／書かないpureな非Authority候補のままとし、operationが返したcandidate値を保持できる既存の試験用途を変更しない。production入口またはtest seamをpackage exports、CLI、caller Authorityへ追加しない。

同期descriptor close、非同期descriptor closeおよびreader IPC cleanupを各convenienceとstructured Outcomeから別々のfresh childで発火し、cleanup不明の公開return前poison、convenience `null`、structured value `null`、後続Package／Task／External Send／Runner停止、入力非参照、Grant 0およびRecovery ID 0を確認する。generic adapterへ同じclose faultを与えた反例ではproduction stateが変化しないことを確認する。completed、unavailable、operation_failed、cancelled、timeoutおよびreader_failedはcleanup確認済みならpoisonしない既存状態分類を維持する。現行CHANGELOGの一般化済み移行説明には追加差分がないため変更しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でproduction convenience／structured Outcome、全cleanup起点、後続Gateおよびgeneric非Authority対照を含むCoordinator全806試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは707 files／384 Markdown／2,237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／Treeへの全監査Pass前に`Resolved`、署名、正式一般Task、Provider EffectまたはRuntime完成へ昇格しない。リリース順序`2026082502`は再利用しない。

固定Commit `0c498429e0f07a6c2aba582f2bcca44b57ee9914`／Tree `b1984d5787728d79a0998759e88435311259241a`を対象に、Architecture／Security Review、Test／UX ReviewおよびDocument／Gap／Impact／Conformance Auditを新規に実行し、3件とも`Pass`、Critical／Major／Minor Finding `0`を得た。共通入力はCoordinator `806 / 806 Pass`、Checker `153 / 153 Pass`、strict typecheck、Biome Lint／Formatter、Repository全体Checker Error `0`／Warning `0`、diff／worktree cleanである。revision 10のEvidence表現Minorとrevision 11のproduction convenience入口Majorは同固定範囲で`Resolved`と判定し、旧`0c2fdf5`以前の監査集合は履歴として保持するが現在判定へ流用しない。

確認済み範囲はproduction／genericの同期・非同期・reader・writer・availability入口、process poison singleton、External Send、Package、Task、正式Runnerの後続Gate、fresh-childの全cleanup origin、machine descriptor、package exports、README、CHANGELOGおよびCHG revision 10／11である。実署名済みRunner、正式一般Task、実Provider／Network Effect、実OS資源故障、POSIX実TTYおよびT1–T2外のHost compromiseは未評価である。現在、この是正について追加の人間判断はない。署名、正式一般Task、Provider Effect、統合およびReleaseは各Gateと人間の決定権限を維持し、リリース順序`2026082502`は再利用しない。

##### Windows出力ConsoleのTTY同一性を閉じるrevision 12是正

監査Pass後の固定Commit `0788b9d171ffc969a683ab0dad7f1a580adf6bbf`／Tree `9218b745dc21f56eedbb273fb25d97f6002facc3`をRelease順序`2026082602`、manifest SHA-256 `2f70ac108640ce960fd00c37b4219ce8794161cc8bef6a88d8de008efced1fb2`として署名し、正式Runnerを実行した。RunnerはNode、Package／Release、Repository Object Format Gateを通過した後、console preflightで`status: blocked`、`reason: signed_general_task_interactive_console_required`、`manualRecoveryRequired: false`、全Recovery IDなし、正規Repository変更なし、生Provider出力・Host Path・Credential報告なし、exit `2`を返した。Provider、Network、workspace、Candidate StoreまたはRecovery Effectは開始しておらず、回復操作は不要である。コード変更後に同じRelease Identityを流用せず、順序`2026082602`は履歴として再利用しない。

本番と同じNode.js 24.19.0およびWindows classic consoleでOS deviceのopen modeを水平実測した。`\\.\CONIN$`の`r`はTTY、`\\.\CONOUT$`の`w`／`a`はopenできるがTTYではなく、`r+`／`rs+`はTTYとなった。Windows GUI subsystem化、`CREATE_NEW_CONSOLE`除去、Task stdin pipe分離またはvisible console起動だけではこのNode descriptor分類を変更しない。したがって起動Shell、標準入力fallback、親環境継承またはConsole生成を追加せず、Windowsの固定出力deviceだけを`r+`で開く。POSIXの`/dev/tty`出力は従来の`w`を維持する。

同期、非同期およびavailability preflightは、単一の非公開platform定義からWindows `\\.\CONIN$`＋`r`／`\\.\CONOUT$`＋`r+`またはPOSIX `/dev/tty`＋`r`／`w`を取得する。Windows出力descriptorはNode TTY同一性の検証と同じoperation lifecycleでの回収だけに用い、表示は既存どおりUnicode対応`process.stdout`へ固定する。出力descriptorを読む処理、Providerや公開callerへ渡すAuthority、package export、標準入出力fallback、shell transport、親環境、Grant条件またはEffect範囲は追加しない。open、validation、operationおよび両closeの既存fail-closed／process-poison分類を維持する。

発火例はNode.js 24.19.0のWindows classic consoleで固定input `r`とoutput `r+`を開き、両descriptorと`process.stdout`がTTYである場合、非発火例は対話確認不要の処理、境界例は標準出力redirectまたは固定device open／validation失敗、判定情報不足例はdescriptor close結果を確認できない場合である。最後の二例は別device、`w`、標準入出力またはshellへ代替せず、cleanup確認済みなら利用不能、cleanup不明なら同じProcessをpoisonして停止する。実Windows consoleからproduction `interactiveConsoleAvailabilityOutcome()`を直接実行し、`stdoutTty: true`、contract revision `12`、open mode `r`／`r+`、outcome `available`を確認した。固定候補への全試験、Repository Checkerおよび独立再レビュー前は本処置を`Resolved`、再署名または正式一般Task成功へ昇格しない。

本処置は`Applied`／`Self-checked`である。Node.js 24.19.0でWindows実Consoleを含む対話境界19試験とCoordinator全806試験、Checker全153試験、Coordinatorのstrict typecheck、Biome Lint／Formatter、Repository全体Checkerおよび`git diff --check`をPassした。全体Checkerは707 files／384 Markdown／2,237 links／652 anchors／29 Related／28 versioned documents／8 stable IDs／74 remediation rows／Error 0／Warning 0である。新固定Commit／TreeへのArchitecture／Security、Document／Gap／Impact／ConformanceおよびTest／UX独立再レビューがすべて`Pass`する前に`Resolved`、再署名、正式一般Task、Provider EffectまたはRuntime完成へ昇格しない。

固定Commit `2aba15937d8be20ba6fea78e4a72e6d259af86c7`／Tree `d38d4449e11563dd1ab13dcb31a2077299e72b0c`へのArchitecture／SecurityとDocument／Gap／Impact／Conformance独立確認はFinding `0`で`Pass`した。Test／UX独立確認は実装を正しいと評価した一方、将来、非同期External Send経路だけが`w`へ退行しても同期のopen mode試験が通るMinor 1件を検出した。監査集合全体の解消判定へ部分Passを流用せず、固定候補を更新して全3確認を再実行する。

是正では、同じ決定論的OS device試験で非同期Windowsの`r`／`r+`と非同期POSIXの`r`／`w`を直接記録して検査し、両descriptorの回収まで結合した。Windows実Console試験も`r+`で開いた出力descriptor自体がTTYであることを明示検査する。production実装、権限、公開入口、cleanup、Effect範囲または保証platformは変更しない。Coordinator全試験、Checker、Repository全体Checkerおよび新固定Commit／Treeへの3独立再確認が完了する前にMinorを`Resolved`としない。
