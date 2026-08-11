# Coordinator Runtime 1.0

Status: Implementation Candidate

`Coordinator Runtime`は、Codex Coordinator Agent、Claude Code Executorおよび独立Codex Reviewerを、CRDDのAuthority、固定改訂版、検証、ReviewおよびCurrent Decision Setへ接続するローカルWorkflow Runtimeである。

現在はExecution Environmentの成立性Gateを実装中であり、実Operation、Provider認証、Repository変更、push、mergeまたは外部Effectには使用できない。

## 導入時のRepository単位

Runtimeは、有効化を明示した対象Repositoryだけを一つのOperation単位として扱う。通常のRepository、linked worktree、および`.git` fileを使うが`core.worktree`を持たない限定worktreeをRuntime 1.0の対象候補とし、bare Repositoryと標準submodule自身は対象外とする。

親RepositoryがCRDDをsubmoduleとして参照しているだけなら、CRDD側のGit metadataやRuntime Rootには触れない。CRDD-Communication等を別Repositoryへ分離した場合も、読取り依存として参照するだけならそのRepositoryを変更しない。変更対象にする場合だけ、そのRepositoryで個別に有効化し、Root、activation、local exclude、Candidate RevisionおよびOperationを分離する。Runtime RootをRepository間で共有せず、複数Repositoryへの同時書込みOperationはRuntime 1.0の対象にしない。

## 制御境界

RuntimeがOperation状態、実効Authority、Repository Identity、Provider起動、Result検証、停止、再開および完了条件を所有する。Codex Coordinator Agentが返す計画、Packetまたは判断集合は候補であり、RuntimeによるProfile、Authority、CapabilityおよびIdentity照合なしに実行しない。

Runtime 1.0が許可する変更は、Operation専用の隔離workspace内のローカル差分だけである。Provider子プロセスへcommit、push、merge、tag、Releaseまたは一般外部Effectの能力を与えない。

詳細な脅威、主体別権限および停止条件は[`THREAT_MODEL.md`](THREAT_MODEL.md)を参照する。変更の判断と追跡は[`CHG-000015`](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)が所有する。

## 現在利用できるコマンド

```shell
node tools/coordinator/bin/coordinator.mjs doctor
node tools/coordinator/bin/coordinator.mjs doctor --json
node tools/coordinator/bin/coordinator.mjs doctor --isolation --json
node tools/coordinator/bin/coordinator.mjs doctor --enable-runtime --json
node tools/coordinator/bin/coordinator.mjs doctor --enable-runtime --runtime-root <absolute-path> --json
node tools/coordinator/bin/coordinator.mjs doctor --recover-isolation <recovery-id> --json
node tools/coordinator/bin/coordinator.mjs activate [--runtime-root <absolute-path>] [--authority-root <absolute-path>] [--json]
node tools/coordinator/bin/coordinator.mjs disable [--runtime-root <absolute-path>] [--json]
```

`doctor`は受動事前診断（passive preflight）である。CLIをインストール、認証または起動せず、PATH上の候補、ローカルGit／Repository、Operation専用領域および未実装の隔離条件を列挙する。Providerの絶対Path、生出力またはVersion出力は保持しない。認証、Filesystem、Credential Store、EgressまたはProcess lifecycleの確認が未実装・未評価である限り非ゼロ終了し、後続Operationを開始しない。

`doctor --enable-runtime`はRuntimeを有効化するコマンドではなく、明示的な有効化要求をRoot選択とPath Identityの診断候補へ接続する。既定では既に存在する`<repository>/.crdd-runtime/`を検査し、`--runtime-root <absolute-path>`があればその指定、なければ`CRDD_COORDINATOR_ROOT`、どちらもなければRepository既定を使う。`--runtime-root`だけの指定、未知／重複option、値欠落、またはrecoveryとの混在は、RootやGit metadataへ触れる前に拒否する。非opt-in時は環境変数が存在してもRuntime Rootを検査しない。直接APIを含む診断入力は、ネストしたRoot要求も期待するown data propertyだけから処置前に固定し、accessor、Proxy、symbol、独自prototype、欠落または余分fieldを受理しない。成功結果も`candidate`／`enable_requested`に限り、activation記録、Capability、Provider起動またはOperationを成立させない。JSON／通常表示へ絶対PathやFilesystem Identityを出さない。

実際の有効化は、診断とは別の専用`activate`操作でRepository単位に永続化する方針である。`activate`と`disable`の厳密なCLI grammarは実装済み候補であり、未知／重複option、値欠落、余剰token、相対Path、制御文字または上限超過を処置前に拒否する。Runtime RootはCLI、環境、Repository既定の順、Authority RootはCLI、環境の順で選び、Authority RootにOS暗黙既定を設けない。Root軸ごとにCLI指定がある場合は同じ軸の低優先な環境値を選択／検証対象にせず、CLI指定がない場合だけ環境値を検証する。選択対象となる環境値の不正、またはAuthority Root欠落はCLI構文違反と区別した`blocked`にする。どちらのcommandも現在は要求候補を安全に診断するだけで常に`blocked`となり、Filesystem読取り／書込み、Root作成、Bundle読取り、record生成、状態遷移、CapabilityまたはOperationを発火しない。Runtime Rootには固定名`activation.json`を置く候補とし、Repository、Root、Authority Bundle、Trust PolicyおよびRegistryのIdentity／revision／Hashをcanonical recordへ結合する。時刻はDate解析前に24文字へ限定した4桁年のcanonical UTCだけを受理する。cross-record Core候補は、前版がない初版`active`と、callerから受けた次版候補について前版canonical byteからHashを再計算して結合し、revisionを正確に1増やし、Repository／Root Identity、Authority参照およびactivation時刻を維持して`disabledAt`だけを追加する`active`から`disabled`への遷移だけを検査する。`active`から`active`への再activationと`disabled`起点の遷移は未実装である。Bundle、PolicyまたはRegistryのIdentityが変わった場合は古い有効化を自動流用せず、現版では再activationを完了できないため`blocked`にする。現在はrecordの構造／canonical byte Core候補、cross-record Core候補とcommand grammar候補までで、原子的書込み、Path／owner／ACL照合、run-scoped Capabilityおよび専用CLI Effectは未実装である。

`doctor --isolation`は、Runtime 1.0で唯一対応する実行基盤であるDocker DesktopのLinux container内にFake Providerを起動する。Docker CLIは固定install root、Docker Incの有効なAuthenticode署名を確認して選択した固定Hashおよび実体Identityへ照合し、PATH候補やDocker Contextから差し替えない。固定DigestのProbe image、read-only root filesystem、全Capability削除、`no-new-privileges`、PID上限および`--network=none`を使用し、Operation専用の`workspace/`、`provider-home/`、`tmp/`だけをmountする。Codex／Claude Code、認証、外部Provider endpointまたは対象Repositoryの変更は実行しない。

Probe containerは`create`で得たcontainer IDと全Security属性を起動前に照合し、同じIDだけを回収する。削除後は、完全なID、完全な名前、完全な所有labelを別々に照会し、3結果がすべて正常かつ空の場合だけcontainer不存在を確定する。いずれかの照会失敗、異常出力または残留ではHost側のmount元を保持し、安全な`recovery-id`だけを返す。

Host回収記録は再帰削除するOperation rootの外に保持する。Dockerへのcreate送信後は、上記3軸で不存在を確定するまでHost回収を直接実行できない。明示recoveryは、Docker container回収、3軸不存在確認、Host root回収、root不存在確認、外部marker消費の順に限定し、未知container、caller指定Pathまたは一般Docker操作へ拡張しない。通常実行またはcleanup中の例外は、Pathや生出力を含まない`blocked`結果へ正規化し、安全に再開できる場合だけ回復IDを返す。

受動診断の`host_only` cleanupとDocker送信後のcleanupは分離する。受動診断は作成直後に固定したHost記録Hashだけを信頼し、現在markerを再Hashして改変後の状態を正当化しない。Docker送信後は、container不存在未確認なら`docker.*`、3軸不存在確認とHost marker更新後なら更新後の`host.*`だけを実行用回復IDとして返す。Host cleanupに失敗しても古いDocker回復IDへ戻さない。Host記録の共通moduleはtoken、Schema、Hashおよび読取り検証だけを所有し、状態遷移はDocker隔離module内の固定操作に限定する。不存在確定は3軸Oracleから生成した一回限りのCapabilityなしに実行できない。Docker送信準備記録と送信前取消がともに失敗した場合は、実行不能なtokenを回復IDとして返さず、Operation領域を保持して`manualRecoveryRequired`付きで安全停止する。

3軸不存在の成功は、同じProbe、container、Operation root、Docker CLIおよび送信開始時のHost記録へ結び付いたmodule-privateかつ一回限りのCapabilityとして扱う。公開token、owned objectまたは状態文字列だけではHost回収を解禁できない。Host rootを削除する前には、Runtimeが作成した6 childすべてのIdentityとroot直下entry集合を確認し、既知childの部分的不在だけを許容する。未知entry、link／junctionまたは同名replacementは推測削除しない。

明示Docker recoveryでは、root直下が既知6 childの部分集合であり、存在するchildのIdentityが一致することを確認したうえで、まず3軸不存在を照会する。containerが不存在なら、`events/`、`projection/`またはmount childの既知欠落を理由にHost回復を止めない。containerが残る場合だけ、mount 3件と`management/`の存在・Identityを必須にして同じcontainerを回収する。`management/`、回復記録、未知entryまたは置換childを確認できない場合は推測せず停止する。

Fake Provider Gateの合格は、DockerによるFilesystem／Credential Path／Network遮断の成立だけを示す。Provider endpoint限定Egress、公式CLIの導入・認証、自動更新／Telemetry、Session再開、timeout／cancelおよびprocess tree終了が確認されるまでは全体を`blocked`とし、実Operationへ進めない。

## Runtime 1.0の実行基盤

Runtime 1.0はWindows上のDocker DesktopとLinux containerだけを正式対象とする。WindowsネイティブProvider実行、Git Bash直接実行、通常WSLディストリビューション、別Container RuntimeまたはDockerなしのfallbackを互換性要件にしない。Provider CLIは後続で専用imageへ導入し、Host側のCodex／Claude設定またはCredentialを暗黙に再利用しない。

## Provider隔離Profile

Provider隔離Profile（Provider Isolation Profile）は、実行権限そのものではなく、Runtimeが照合する要求候補である。CRDD版ごとのJSONを作らず、Runtime契約`crdd-coordinator/provider-isolation-profile`の改訂番号だけを持つ。CRDD基準版の変更とRuntime契約の破壊的変更を同じ互換処理へ混在させない。

ProfileはProvider、許可済みAuthority Registryを選ぶためのGrant参照候補、Credential BrokerのGrant参照候補、および要求されたHTTPS Originの完全一致集合だけを保持する。Credential値、Credential StoreのPath、wildcard、HTTP、任意Path付きURLまたは未対応Providerを受理しない。構造検証結果は`candidate`であり、人間承認、Authority成立、`accepted`、`confirmed`または実行可能の別名ではない。正規化後のProfile Hashは要求候補の同一性だけを固定し、Authorityの証明には使用しない。

Runtime 1.0の書込みOperationはDockerを唯一の正式Isolation Backendとし、Host、Git Bash、通常WSLまたは`local-restricted`へ縮退しない。`fake`は決定論的試験専用であり、実Provider、実Credentialまたは実送信先の利用許可にならない。現在はRuntime所有Trust Policyの導入・有効化、起動直前再確認CoreとProvider起動経路の結合、ProxyおよびCredential Brokerが未実装のため、Profile候補を作成できても全体Gateは`blocked`のままである。

Authority Grant Verifier Core候補は、Authority Registry候補を固定契約、Registry revision、UTC観測時刻、Grant集合およびSHA-256へ正規化する。Profile候補との照合では、Grantのactive状態、有効期間、Provider、要求Origin、Credential Grant参照、Operation ID、Scope IDおよびProfile Hashの完全一致を要求する。構造と内容の照合結果は`candidate`であり、自己申告Registryを信頼済み正本へ昇格させない。

Trust Anchor Loader Core候補は、Registry入力を上限付きbyte列として受け、厳密UTF-8、BOMなし、末尾空白を含まないcanonical JSONと、正規化後Registry Hashの一致を確認する。Trust Policy候補はRuntime契約`crdd-coordinator/authority-trust-policy`の`contractRevision: 1`、Policy ID／revision／状態、Registry ID／revision／Hashだけを保持する。callerが渡したPolicyとの完全一致は候補Identityを固定するだけであり、Runtime所有Policyの導入、所有権、取消または有効化を証明しない。したがって結果は`candidate`、Authority Capabilityは未発行であり、全体Gateを`blocked`に保つ。

起動直前Authority再確認Core候補は、呼出側から時刻を受け取らず、Runtimeプロセスが保持する時計関数を一度だけ読み取る。同じ呼出しの中でcanonical Registry byte、Trust Policy候補、Profile、Grant、OperationおよびScopeを再検証し、現在時刻がGrantの`validFrom <= now < expiresAt`を満たす場合だけ固定された再確認候補を返す。結果はTrust Policy ID／revision／Hash、Registry Identity、Grant revision、Profile Hash、Operation／Scopeおよび確認時刻へ結び付くが、再利用可能なAuthority Capabilityではない。Runtime所有Trust Policyの有効化とProvider起動経路への直結が未実装のため、Core候補だけでProviderを起動しない。

Runtime 1.0の正式なAuthority取得方式は、Runtime管理領域内の固定ローカルFile Bundleだけとする。Bundleは`bundle.json`、`trust-policy.json`、`authority-registry.json`の3ファイルで構成し、Manifestのrevision、状態、前版Hash、Policy HashおよびRegistry Hashをcanonical byteから固定する。File Bundle Core候補は3ファイルの構造とHashを検証するが、実際の配置Path、所有主体／ACL、link禁止、原子的置換、単調な有効化・取消をまだ強制しないため、結果は`candidate`で全体Gateは`blocked`のままである。IPC／Network TransportはRuntime 1.0の正式取得方式に含めない。

Authority BundleはRepository内Runtime Rootへ置かず、複数Repositoryから共有できる別のAuthority Rootへ配置する。Authority RootにはOS固有の暗黙既定値を設けず、CLIまたは環境から絶対Pathを明示し、CLIを優先する。同じ指定契約をWindows、macOS、Linuxおよびserver volumeで使う。Repositoryを書ける主体がAuthorityを自己発行できないよう、Runtime Rootとの包含、Provider mount、Path／owner／ACL未確認または安定Identityを取得できないFilesystemは`blocked`にする。現段階の選択CoreはPathを報告せず、実Path AdapterやCapabilityを成立させない。

共通Root保護方針Core候補（Root Protection Policy Core Candidate）は、WindowsのDACLとmacOS／Linuxのowner／modeを別々の正本にせず、同じ保護結果へ写像する。Runtime Rootは選択された利用者またはサービス実行主体を`runtime_principal_only`のwriterとして読取り／書込みでき、非承認主体が書き込めないことを要求する。Authority Rootは承認済みadmin／installerの集合を表す`provisioner_principal_only`だけが書込み、Runtime主体は読取り専用で、非承認主体が書き込めないことを要求する。どちらも事前Provision済みの既存non-link Rootと安定Identityを必要とし、Runtime自身はRoot作成や権限変更を行わない。`local`と`persistent_volume`だけを候補とし、network、removable、specialまたは分類不明のFilesystemはfail closedにする。ただし現Coreが受ける観測値はcaller supplied claimであり、成功結果もPlatform Adapterによる実DACL／owner／mode／volume確認待ちの`candidate`に限る。返却する`requiredWriteAuthority`は照合したPolicy要求であり実ACL検証結果ではない。Path、SID、UID、GID、mode、DACLまたはraw errorを返さず、activation、Capability、ProviderまたはOperationを成立させない。

POSIX Runtime Root mode precheck候補は、明示opt-in時だけ既存Path Identity session内で現在processのeffective UID、Root ownerおよびmodeを受動観測し、ownerのread／write／execute欠落またはgroup／other write bitという明白な違反を検出する。Path、UID、GIDまたはmodeは返さず、Root作成やchmodを行わない。合格してもACL不存在、将来Runtime principalとの結合、Filesystem classおよびAuthority Rootは未確認なので、結果は常に`blocked`である。`posixOwnerModeAdapter`、Windows DACL Adapterおよびpersistent volume Adapterは未実装であり、POSIX先行候補をクロスプラットフォーム成立やRuntime有効化として扱わない。

Runtime Rootの既定候補は`<repository>/.crdd-runtime/`とし、別の場所を使う場合の指定契約は`--runtime-root`または`CRDD_COORDINATOR_ROOT`による絶対Pathとする。優先順はCLI、環境、Repository既定である。OS別の暗黙保存先へ分散保存しない。CLI optionと環境読取りは明示enable要求の診断へ接続済みだが、有効化処理ではない。診断は、既に存在するRepository／Root／直近parentのnon-link実体Identityおよびlexical／realpath containmentを照合する。外部overrideは、RootがRepository外にあるだけでなく、RepositoryとRootが相互に包含しない位置だけを候補にする。Repository自身またはRepositoryを内包する祖先DirectoryをRootにできない。安定したFilesystem Identityを取得できない場合は`blocked`にする。機能は既定で無効であり、Directoryの存在、override指定またはRepository内設定だけでは有効化しない。明示的なenable要求とRuntime所有activation記録が必要で、いずれのCore候補もCapabilityを発行しない。

`.crdd-runtime/**`はGitの追跡有無にかかわらずCandidate Revision、Operation入力およびProvider mountへ含めない。ignoreは誤commit防止の補助であり、Filesystem安全境界ではない。明示enable時に選択RootがRepository内なら、Repository Adapterがroot相対の完全一致entryを`.git/info/exclude`へ冪等に追加し、tracked `.gitignore`は変更しない。Repository外overrideにはGit excludeを追加しない。Runtime 1.0は外部Git CLIをAuthorityとして起動せず、通常worktree、linked worktreeおよび`.git` fileを使うが`core.worktree`を持たない限定worktreeだけを内蔵parserで確認する。common configにRepository format version 0と`core.bare=false`がそれぞれ一つだけ明示され、`extensions`、設定`include`および`core.worktree`を使わない構成だけを受理する。標準submodule自身を含むそれ以外の構成はGitとして有効でも`blocked`にする。これによりWindows、macOS、Linux／serverでGit実行ファイルのPathやHashを別管理しない。

現在のmetadata書込み候補は、既存内容を131072 byte上限で同一handleから読み、専用lockを排他的に取得し、同一directory内で書込み・同期してから置換し、完全一致entryを再読取り確認する。適用時はRepository、選択Root、直近parent、包含分類および選択元を最初のPath Identity snapshotへ固定し、内部RootではGit layout確認後、書込み直前、さらに書込み後の各時点を同じ初回snapshotへ照合する。外部overrideも完了直前まで同じ初回snapshotを維持できた場合だけGit exclude不要候補とする。後続確認のたびに置換後の実体を新しい基準へ取り直さない。既存lock、link、Identity変化、同時更新、上限超過、書込みまたは事後確認失敗は`blocked`へ閉じ、未知lockを推測削除しない。書込み後のRoot再確認が失敗した場合は、書込み済み事実を保持して停止する。解決結果のPathを公開せず、親Repositoryが参照するCRDD submoduleや別Repositoryへ処置を広げない。標準submodule自身をRuntime対象にする経路を現版で受理しないことと、参照中のsubmoduleを変更しないことは別の境界である。linked worktreeの`info/exclude`は同じcommon Git directoryを使うworktree間で共有されるため、linked worktreeでは既定`<repository>/.crdd-runtime/`だけをRepository内Rootとして許可し、Repository内custom Rootは拒否する。custom配置が必要な場合はRepository外overrideを使用でき、その場合はGit excludeを追加しない。限定parserが確認するのはmetadata配置graph／config候補であり、完全なRepository Identityではない。既存のGit `info` directoryがない場合、完全なparent chain／ACL、activationとの結合およびCapability発行は未実装である。この専用統合処置はIdentity descriptor、汎用callback、tokenまたはCapabilityを公開しない。同一権限Hostによる各Filesystem呼出し間の最終raceを完全に防ぐことは主張せず、activation Adapterの未実装境界に残す。`disable`は新規Operationを停止し、進行中Operationを安全なcancel／recovery契約へ渡す。保存データの削除は別の明示操作に分離する。現在は永続disable遷移とOperation結合を実装していない。Rootの作成、全parent chainのPath保護、所有主体／ACL確認およびactivation記録の永続化も未実装である。

過大なProfile／Registry入力、許可数を超えるGrant／Origin、長すぎる識別子／Origin、またはcanonical UTCでない評価時刻はAuthority候補にせず`blocked`へ閉じる。Trust Anchor Loader CoreはRegistryをJavaScript値へ展開する前に131072 byteの上限を強制する。File Bundleを実際に読み取るRuntime所有Path Adapterは未実装であり、その入口でも取得量、選択済みRoot、Provider非到達、所有主体／権限および実体Identityを別途強制する。

Profile、Registry、および評価Contextのrecord／array構造は、JSON相当のplain dataだけを受理する。評価Contextの`now`だけは型付き値の例外として、Context recordから一度取得した有効な`Date`、またはcanonical UTC文字列を受理し、canonical UTC文字列へ変換して以後の評価に使用する。動的getter、Proxy、symbol、独自prototype、疎配列または余分な配列propertyを含む入力は値を実行・再読せず`blocked`にする。検査済みのproperty descriptorから作った固定snapshotだけを、正規化、比較およびHashへ使用する。

## Provider Egress Proxy

Provider Egress ProxyのPolicy候補は、生Profileを内部Validatorで再検証し、そのValidatorが生成した正規ProfileとHashからだけ要求Originのhostnameを取り出す。呼出側が組み立てた検証結果、Hashまたは正規化済みと称するobjectは受理せず、Authority確認済みPolicyへも昇格しない。許可候補は`CONNECT`、完全一致hostnameおよび文字列として厳密なport `443`だけであり、通常HTTP method、wildcard、別表記のport、IP literal、userinfo、末尾dotまたは別hostnameを拒否する。

DNS結果は32／128 bitへ正規化し、固定したIANA IPv4／IPv6 Special-Purpose Address Registry snapshotを最長prefix一致で評価する。IPv6はさらにIANA IPv6 Global Unicast Address Spaceの`ALLOCATED` snapshotへ照合し、special-purpose規則で許可された範囲または明示的な割当範囲だけを候補にする。`Globally Reachable`が`true`でない登録、未割当／予約範囲、legacy compatible IPv6、site-local、multicast、判定不能なaddress、またはpublic addressに混在するspecial addressを拒否する。IPv4-mapped IPv6と`64:ff9b::/96`のNAT64 addressは埋込みIPv4へ還元して同じ規則を適用する。この判定とfixtureはRuntime ProxyによるDNS固定、TLSおよびsocket接続の実強制ではなく、実強制前は候補のままとする。

正式TopologyではProvider containerをOperation専用のinternal Docker Networkだけへ接続し、外部Networkへ直接接続しない。ProxyだけがOperation internal Networkと専用Egress Networkへ接続し、Docker socket、Host NetworkまたはHost fallbackを使用しない。現在はPolicy判定とTopology契約だけが実装済みで、Proxy process、Network作成、DNS／TLS実測およびAuthority Capability結合は未実装である。Docker Desktop local Linux Engineも現在確認できないため、`execution.egress`と全体Gateは`blocked`を維持する。

## 開発者確認

```shell
npm test --prefix tools/coordinator
```

Runtime 1.0のその他のCLIは、成立性Gate、Protocol、状態不変条件および永続Storeが固定されるまで提供しない。
