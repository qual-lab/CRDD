# Coordinator Runtime 1.0 Threat Model

Status: Implementation Candidate

本書は[`CHG-000015`](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)の実装固有脅威モデルである。CRDDのHuman Authority、External Information Boundary、Independent Reviewまたは準拠条件を再定義しない。

## 1. 保護対象

- 対象Repositoryと元worktreeの内容、Git metadataおよびIdentity
- Operation Packet、Authority Grant、Candidate RevisionおよびReview対象
- Immutable Event Log、Projection、Leaseおよび完了判定
- Credential、Internal／Restricted情報およびProvider送信範囲
- 他Operation、他Repository、通常User Homeおよび外部接続先

## 2. 信頼境界

| 境界 | 信頼するもの | 信頼しないもの |
|---|---|---|
| Runtime Core | 検証済みSchema、Profile、Policy、Event追記処理 | Agentの自己申告、Providerの`Pass`、自然言語だけのAuthority |
| Repository Adapter | 固定したGit入力とRuntimeからの許可 | dirty変更の暗黙取込み、ProviderによるGit metadata操作 |
| Provider Adapter | 正規化処理と明示Capability | 生出力、Provider固有Session、利用可能というだけのAuthority |
| Provider子プロセス | 確定Packet内の限定処理 | Filesystem、Network、Credential、外部Repositoryへの一般アクセス |
| Reviewer | 固定対象と基準からの独立再構成 | Executorの要約、旧Candidate RevisionのReview |

## 3. Operation専用領域

```text
runtime-state/
└─ operations/
   └─ OP-000001/
      ├─ provider-home/
      ├─ workspace/
      ├─ tmp/
      ├─ events/
      ├─ projection/
      └─ management/
```

主体別の許可は次のとおりである。

- Runtime Coreだけが`events/`、`projection/`および`management/`を書き込む。
- Repository Adapterだけが隔離workspaceの作成・破棄に必要なGit metadataを操作する。
- Provider子プロセスは`workspace/`、`provider-home/`、`tmp/`だけを書き込める。
- Credential Broker／AdapterだけがCredential Storeを必要最小限で読み取る。
- Provider子プロセスへCredential StoreのPath、通常User Home、他Operationまたは元RepositoryのGit metadataを見せない。
- 診断用領域はRuntimeが当該runで`mkdtemp`した一意なchildだけを所有する。所有Capabilityと作成時の`dev`／`ino`／`birthtimeNs`はmodule-privateに保持し、終了時に同じobject、実体Identity、親境界、実Path、prefix、directory種別および非linkをすべて確認してchildだけを一回削除する。Pathまたはprefixだけを所有根拠にせず、既存parent、sibling、呼出側指定Path、symlinkまたはjunctionを再帰削除しない。

Runtime 1.0のExecution Environment backendはWindows上のDocker Desktop／Linux containerだけとする。Provider子プロセスをHost、Git Bash、通常WSLディストリビューションまたは別Container Runtimeへfallbackさせない。Docker CLIはRuntime側の信頼対象Adapterとして引数配列で起動し、HostのDocker Context／Credentialを読ませず、ローカルDocker Desktop Linux Engineのnamed pipeへ固定する。ProviderへDocker socketまたはDocker CLIを渡さない。

## 4. 主要脅威と制御

| 脅威 | 主制御 | 補助制御 | 失敗時 |
|---|---|---|---|
| AgentがAuthorityを自己拡張 | Runtimeが実効Packetを確定 | Schema、Event | Operation拒否 |
| Providerが監査履歴を改変 | `events/`／`projection/`／`management/`をProvider書込み範囲外にする | Hash、事後検査 | Operation失敗 |
| 未承認push／外部Repository更新 | Credential／SSH Agent／Provider連携を渡さず、許可外Egressを拒否 | Process command拒否、refs事後照合 | Operation拒否 |
| Secretまたは内部情報の永続化 | 正規化、分類、Redaction後だけ永続化 | 保存量上限 | Result拒否 |
| dirty変更の暗黙混入 | 書込みOperationはHEADから隔離 | source dirty記録 | 依存時はBlocker |
| 古いReviewの流用 | Candidate Revision Identity一致を要求 | Stale Event | 再Verification／Review |
| Provider完了後のRuntime crash | Lease、Idempotency Key、Result Fingerprint、workspace照合 | Provider resume Capability | 自動再実行せず復旧 |
| Path case衝突 | 元Pathとcase sensitivityを保持し衝突検査 | Manifest照合 | Snapshot拒否 |
| Provider限定Egressを強制不能 | Capability Gate | read-only縮退は情報境界成立時だけ | Operation拒否 |

## 5. 成立性Gate

現在の`doctor`は受動事前診断であり、Providerプロセス、認証、NetworkまたはRepository変更を実行しない。`where`／`which`等の外部locatorも起動せず、Runtime自身がPATHとPATHEXTをFilesystem APIで確認する。絶対Path、locatorの生出力またはProvider Versionは診断結果へ保持しない。

初回Gateは次を個別に返す。

- NodeとローカルGitの利用可否
- Codex／Claude Codeコマンドの検出と専用Homeでの起動可否
- Provider子プロセスへ渡すCredential関連環境名の除去
- Operation専用Home、workspace、tmp、events、projection、managementの作成可否
- 主体別Filesystem強制機構の有無
- 許可Provider endpointだけに限定するEgress強制機構の有無
- Providerの自動更新、Telemetry、Session再開、timeout／cancelの確認状態

各必須項目は`confirmed`、`blocked`、`not_implemented`または`unknown`で保持する。自動更新、Telemetry、Session再開、timeout、cancelおよびprocess tree終了は個別に評価し、Providerごとの認証・発見状態と混ぜない。Operation領域の作成成功と主体別Filesystem強制、Credential環境名の除去とCredential Store／Helperを含む隔離強制も別の項目とする。全必須項目が観測により`confirmed`となるまで全体は`blocked`である。

CLI未導入、認証未確認、Filesystem境界未強制、Credential隔離未強制またはEgress未強制を、利用可能または安全と推定しない。Gateは不足を人間判断へ誤変換せず、阻害理由と必要な後続処置を返す。

将来のActive Probe Adapterは、Filesystem、Credential、EgressおよびProcess境界を先に強制し、同じ隔離環境内でだけProviderを起動する。Windowsでは発見した`.exe`、`.cmd`または`.bat`の種別、複数候補、空白を含むPathおよび引数境界を決定論的に扱い、shell injectionを許さない。生stdout／stderrは正規化前に永続化しない。現在の受動診断結果をActive Probe、認証または利用可能性の根拠へ流用しない。

Fake Provider隔離Probeは固定Digest image、read-only root filesystem、全Linux Capability削除、`no-new-privileges`、PID上限、非root UIDおよび`--network=none`を使用する。mount対象は`workspace/`、`provider-home/`、`tmp/`だけであり、`events/`、`projection/`、`management/`、通常User Home、Credential StoreおよびDocker socketを渡さない。mount元はfactory発行objectからmodule-privateなCapabilityとして作成し、各childの実Path、親、名前、`dev`、`ino`および`birthtimeNs`をcreate直前、start直前およびProbe終了後に照合する。公開Path、同形object、link／junctionまたは同名replacementを所有根拠にしない。

Docker CLIのTrust Anchorは、固定install root、`docker.exe`、Docker Incの有効なAuthenticode署名を確認した実体、および承認済みSHA-256の組合せである。Runtime PolicyはQual-Labが所有し、Docker Desktop更新でHashまたは実体Identityが変わった場合は自動採用せず、再評価まで`docker_cli_untrusted`として停止する。PATH、通常環境変数、Docker ContextまたはProvider出力から上書きできない。Docker子プロセスにはPATH、通常Home、Credential／Context／TLS関連環境を渡さず、固定named pipeと空の専用Docker設定だけを使う。Nodeの検査からspawnまでを敵対的なHost管理者から完全防御するものではなく、Host／Docker Desktop管理者はTrust Boundaryに含む。

Probe containerは`docker create`が返した64桁container IDを一次Identityとし、名前とownership labelは補助情報に限定する。起動前に同じIDの名前、label、image、entrypoint／command、3 mount、Network、read-only root、Capability、security option、PID上限、user、privileged／device非追加をinspectし、一件でも不一致ならstartしない。cleanupも同じIDだけを対象にする。削除後は完全なID、完全な名前および完全なownership labelを3つの独立した成功応答から照会し、各応答を64桁ID集合として正規化して、すべて空の場合だけ不存在を確定する。非0終了、不正・重複・過大出力または一件でも残留があれば`blocked`とする。この独立性は同一Docker daemon内の検索軸を分ける意味であり、daemon自体から独立した証明ではない。Docker daemonへ同権限を持つHost主体はTrust Boundaryに含み、名前またはlabelだけを敵対的daemon利用者への所有証明としない。

container不存在を確認できるまでHost側Operation領域を削除しない。Host回収記録は再帰削除対象rootの外側にある固定一時親直下の専用・non-link領域へ原子的に保存する。Docker `create`要求の送信前に状態を`docker_submission_started`へ遷移し、この状態以降は3軸不存在が確定するまでHost-only回収を拒否する。cleanup不確定時は推測困難なrecovery token、root／child実体Identity、container ID、engine、imageおよび所有情報を保持し、Credential、生出力または一般Host Pathを含めない。

明示recoveryは固定一時親、外部Host marker、non-link、実体Identity、tokenおよび同一containerの全inspect条件を再確認する。処置順はDocker cleanup、ID／名前／labelの3軸不存在確認、Docker記録の状態確定、Host root cleanup、root不存在確認、外部Host marker消費とする。Host childが既に不存在なら部分回収済みとして扱えるが、存在するchildのlink化またはIdentity不一致では削除しない。Docker IDを取得できなかった場合は遅延createを否定できないため、一回の空照会からHost削除へ進まず`blocked`を維持する。例外または部分失敗では外部記録を保持し、caller指定ID／Pathや未知containerを削除しない。現在UserとDocker daemonへ同権限を持つHost主体をこの回復記録のTrust Boundaryに含む。

回復段階の実行用tokenを混同しない。`docker_submission_started`から3軸不存在を確認するまではDocker tokenだけを返し、one-shot CapabilityによるHost marker更新後は更新後Hashを持つHost tokenだけを返す。Host cleanupの失敗、未知entryまたは既知child置換でも古いDocker tokenへ戻らない。受動診断はfactoryがprivateに固定した初期`host_only` Hashを照合し、現在markerを読み直して新しい正当tokenを生成しない。Host recoveryの共通moduleはtoken、Schema、Hashおよび読取り検証を一意に所有し、状態変更はDocker隔離module内の固定遷移だけが原子的に行う。`docker_absent_confirmed`への遷移は3軸Oracleが生成した一回限りのCapabilityを必須とし、公開tokenと状態文字列だけでは実行できない。Docker送信準備記録と送信前取消がともに失敗した場合は、実行不能tokenを回復IDとして案内せず、Operation領域を保持した`manualRecoveryRequired`として停止する。

3軸不存在Oracleの成功は、同一実行内のProbe ID、64桁container ID、Operation root、Docker CLI Capabilityおよび`docker_submission_started`のHost記録Hashへ結び付いたmodule-privateな一回限りのCapabilityにする。Capabilityを公開結果へ含めず、token、owned object、状態名、同形objectまたは別Probeの結果から復元しない。Host記録の原子的更新に成功した後だけ消費し、更新失敗時は送信開始状態と回復情報を保持する。非export化は誤用防止であり、同じHost権限でソースを変更できる主体への完全なSecurity境界とはしない。

Operation rootのcleanup所有母集団は、factoryが作成する`workspace/`、`provider-home/`、`tmp/`、`events/`、`projection/`および`management/`の6 childである。Docker mount対象は前3件だけであり、管理領域を昇格させない。通常cleanupとHost recoveryはroot直下を列挙し、現在entryが既知6件の部分集合で、存在する各childが保存Identity、directory種別、non-link、親および実Pathへ一致する場合だけ再帰削除する。既知childの不存在は部分回収として許容するが、未知file／directory／link、dangling linkまたは置換childは拒否する。

明示Docker recoveryは`management/`と回復記録を先に再識別し、root直下の既知部分集合と存在childのIdentityを確認してから3軸不存在を照会する。container不存在時は既知childの部分欠落をHost recoveryへ引き継ぐ。container残存時だけmount 3件と`management/`を必須化し、同じcontainerのinspectとcleanupへ進む。非mount childの欠落だけでcontainer cleanupを妨げず、存在childの置換、未知entryまたは管理領域の欠落では推測回復しない。

このFake ProbeはProvider endpoint限定Egressを証明しない。`--network=none`は外部送信を遮断するが公式Providerを利用不能にするため、Provider用Egress allowlistが未実装である限り`execution.egress`は`blocked`のままとする。Fake Probeの合格をProvider認証、active probe、lifecycleまたは実Operationの許可へ流用しない。

Provider隔離ProfileはAuthority候補と強制結果を分離する。Profileが表すのは、Provider、Authority RegistryのGrant参照候補、Credential BrokerのGrant参照候補および要求Origin集合であり、人間承認、Credential値または実行可能Capabilityではない。Profile自身、Agent出力、環境変数またはProviderの自己申告だけからAuthority、Filesystem、Credential、EgressまたはProcess境界を`confirmed`へ上げない。Runtimeが所有するAuthority Grant Verifier、Enforcer／Adapterの観測結果が、同じ固定Profile Hash、OperationおよびScopeへ結び付いた場合だけ各Gateを評価する。

送信先はOrigin完全一致とし、wildcard、平文HTTP、userinfo、query、fragment、任意Path、IP literalおよびlocalhostを拒否する。これは承認入力の正規化境界であり、DNS解決、TLS終端または実通信の強制を証明しない。実書込みOperationではProvider containerを外部Networkへ直接接続せず、Operation専用の内部Networkから専用Egress Proxyだけへ接続する。Proxyの許可先、DNS、TLS接続先および迂回不能性を実測できなければ`read_only`へ縮退せずOperationを拒否する。

Credential GrantはBrokerとGrantの用途別namespaceを持つ不透明な参照候補だけをProfileへ保持する。Secret、Token、API Key、Credential Store PathまたはCredential値をProfile、Prompt、通常Event、ProjectionまたはEvidenceへ保存しない。将来のCredential Brokerは、対象ProviderとProfileへ限定した短期Credentialだけを隔離環境へ渡し、ProviderからCredential Storeを直接読ませず、終了時の破棄を確認する。Brokerが未実装または破棄を確認できない場合はGateを開かない。

Authority Grant VerifierはRuntimeまたは人間が事前に許可したRegistryだけを信頼し、Profile内の`registryId`を新しい信頼元の定義として扱わない。Grantの存在、決定権限者、UTCへ正規化した有効期間、取消・置換状態、Provider、要求Origin集合、Credential Grant参照、対象Operation／Scopeおよび候補Identityを正本から確認する。Provider起動直前にも期限・取消・置換を再確認し、古い確認結果を別Operationまたは失効後へ流用しない。Grant参照とHashの循環を避ける承認手順はVerifier実装時にAuthority正本として決定し、候補Hashの自己一致だけで承認を成立させない。Verifierが未実装の現在は`authority_grant_verification`を満たさず、Gateを開かない。

現在のVerifier Core候補はRegistryの契約、revision、UTC観測時刻、Grant状態と有効期間、Provider、Origin、Credential Grant参照、Operation、ScopeおよびProfile Hashを決定論的に照合する。ただし、入力Registryの構造妥当性とHash一致は、そのRegistryを信頼するAuthorityを作らない。Runtime所有Trust Policyの導入・有効化、信頼設定の所有権・改訂・取消境界、およびProvider起動直前の再照合が成立するまで結果は`candidate`であり、Runtime Capabilityを発行しない。未来の観測時刻、未発効・失効・取消・置換Grant、重複Grant参照またはいずれかの結合差をfail closedにする。

Trust Anchor Loader Core候補はRegistry byte列をTypedArrayの内部slotで131072 byte以下と確認し、Runtime所有Bufferへ一度コピーしてから、strict UTF-8、BOMなし、canonical JSONの完全一致、Registry契約および正規化後Hashを確認する。呼出側Bufferの上書き可能な`length`、`byteLength`または比較methodを判断へ使用しない。末尾改行、空白、重複key等によりParse結果とcanonical byte列が一致しない入力を拒否する。Trust Policy候補も独立した4096 byte上限、strict UTF-8、BOMなしおよびcanonical JSON完全一致を要求する。Policyは固定契約、Policy ID／revision／状態、Registry ID／revision／Hashだけを持ち、plain-data snapshot後にRegistry候補と完全照合する。caller supplied Policy、Agent出力または同じHashの自己申告をRuntime所有Policyとみなさず、Policy候補のHashもAuthorityの証明にしない。

Runtime 1.0で正式に扱うAuthority取得方式はRuntime管理領域内の固定ローカルFile Bundleだけとし、IPC／Network Transportを正式Backendまたはfallbackにしない。Bundleは固定名の`bundle.json`、`trust-policy.json`、`authority-registry.json`から成り、Manifestは契約revision、Bundle ID／revision／状態、前版Bundle Hash、Trust Policy HashおよびRegistry Hashをcanonical byteへ固定する。初版だけ前版Hashを`null`とし、後続版は64桁Hashを要求する。Core候補は3ファイルのbyte上限、canonical形式、状態および相互Hashを確認するが、Bundle revisionの存在だけで単調な更新・取消・有効化を成立させない。

Authority Bundleの物理RootはRepository単位のRuntime Rootから分離し、複数Repositoryで共有可能な明示絶対Pathだけを受理する。OS固有の暗黙Rootは設けず、CLI、環境の順で選ぶ。Repository内Runtime RootまたはProvider mountへAuthority Bundleを含めず、Path／owner／ACL、non-link、安定IdentityおよびRuntime主体だけが書込み可能という共通保護結果をPlatform Adapterが確認できなければfail closedにする。Windows DACL、POSIX owner／modeおよびserver volume policyは実装差だが、OS名だけで成立を推定しない。現在のAuthority Root選択Core候補はPathを出力せず、実Path AdapterまたはCapabilityを発行しない。

共通Root保護方針Core候補は、`runtime`／`authority`のRoot role、`windows`／`posix`のPlatform family、`local`／`persistent_volume`のFilesystem classおよび主体別access観測をexact plain-dataとして受ける。Runtime RootにはRuntime read/writeと非承認主体write禁止、Authority Rootにはprovisioner write、Runtime read-onlyおよび非承認主体write禁止を要求する。既存Root、安定Identity、link／reparse非該当も共通条件とする。network、removable、special、unknown、観測欠落または不正shapeはfail closedにする。読取り制限は今回の人間決定に含まれないため、Runtime以外のread禁止を新しい共通条件にしない。RuntimeがRoot作成やchmod／ACL変更を実行しないことと、OS上その権限変更能力を完全に除去できることも区別する。

このCoreはPolicy要求と観測claimを照合するpureな候補であり、caller suppliedの`stableIdentityObserved`、link／reparse状態またはaccess可否をAuthorityへ昇格させない。Windows DACL Adapter、POSIX owner／mode Adapter、persistent volume Adapter、Path bindingおよびactivation integrationは未実装である。Core自身はFilesystemを読み書きせず、Root作成、chmod、ACL変更、atomic writer、Bundle読取り、activation、Capability、ProviderまたはOperationを発火しない。実AdapterがPath、SID／UID／GID、mode／DACL、Filesystem分類および同一snapshotを確認できるまでGateを`blocked`にする。network／removable／special Filesystemの許可、非承認主体の定義拡張、読取り制限またはRuntime自身の権限変更能力除去を追加する場合は、新しい人間判断へ戻す。

Runtime Rootの既定候補はRepository直下の`.crdd-runtime`、明示overrideの指定契約と優先順はCLI、環境、Repository既定とする。選択は絶対Pathの構文候補だけを扱い、絶対Path自体をdoctor／Evidenceへ出力しない。OS別の暗黙rootを設けず、serverでは同じ契約へ永続Volumeの絶対Pathを指定できる。CLI引数は未知、重複、値欠落、余剰tokenおよびrecoveryとの混在をRoot／Git metadata処置前に拒否する。`--runtime-root`は`--enable-runtime`なしで受理しない。環境overrideは非opt-in時にRuntime Root検査へ渡さず、opt-in時だけCLIより低い優先度で一度固定する。CLIからの呼出しだけでなく`doctor`の直接入力も処置前にexact plain-data snapshotへ固定し、ネストしたRoot要求のaccessor、Proxy、symbol、独自prototype、欠落／余分fieldまたは不正値を固定理由で拒否する。`--enable-runtime`は有効化要求の診断候補であり、Directoryの存在、override、ignored状態またはRepository内ファイルをactivationの根拠にしない。Runtime所有activation記録の原子的永続化と再検証が成立するまでCapabilityを発行しない。

activationは診断要求とrun-scoped Capabilityから分離したRepository単位の永続状態とする。専用`activate`／`disable`のCLI grammar候補はcommandごとのoptionを処置前に一度だけ解析し、CLI誤用、環境／選択契約不成立、および妥当な要求だがEffect未実装という3結果を区別する。Runtime RootはCLI、環境、Repository既定、Authority RootはCLI、環境の順で選び、Authority RootにOS暗黙既定を設けない。各Root軸でCLI指定がある場合は同じ軸の低優先な環境値を選択／検証せず`null`として後続selectorへ渡し、CLI指定がない場合だけ環境値を検証する。一方のRoot軸のCLI指定で他方の不正環境値を隠さない。`disable`はAuthority Rootを読まず、doctor／recovery用optionも両commandへ混入させない。安全な引数snapshotを取得できた場合は個別token検査より先に`--json`要求を確定し、不正tokenでも構造化usage errorを返す。snapshot自体が成立しない場合はraw入力からJSON要求を推定しない。結果はcommand種別と固定reasonだけを返し、Path、環境値、cwd、Identityまたはraw tokenを保持しない。固定`activation.json`候補はRepository／Runtime Root Identity Hash、Bundle／Policy／RegistryのID、revisionおよびHash、activation revision／前版Hash、状態と4桁年・24文字のcanonical UTC時刻を結合する。時刻は文字列型と長さをDate解析、canonical化およびHash計算より前に確認する。cross-record Core候補は外側入力をexact plain-data snapshotし、前版canonical byteを既存decoderで再検証してHashを再計算する。前版のない初版`active`と、revisionを正確に1増やし、前版Hash、activation／Repository／Root Identity、Bundle／Policy／Registryの全参照および`activatedAt`を維持して`disabledAt`だけを加える`active`から`disabled`への遷移だけを候補化する。caller supplied Hashを信頼せず、disableとAuthority差替えを混在させない。`active`から`active`への再activationと`disabled`起点の遷移は未実装である。Bundle Identity変更時に古いrecordを自動追随させず、現版では再activationを完了できないため`blocked`にする。`disable`は永続状態として新規Operationを止め、進行中Operationは既存の安全なcancel／recovery契約へ渡し、保存データを削除しない。deleteは別の明示的かつ不可逆な操作として今回実装しない。command grammar候補、recordのcanonical Core候補およびcross-record Core候補はFilesystem処置、Authority、原子的永続化、Path／ACL、起動直前再確認またはCapabilityを成立させない。

`.crdd-runtime`はCandidate Revision、Repository Snapshot、Operation入力、Provider mountおよびProvider可視Pathの母集団から常に除外する。`.gitignore`または`.git/info/exclude`は誤commit防止の補助であり、強制境界にしない。既存のtracked entry、symlink／junction、Provider mountとの包含関係、Repository Identity差または別Runtimeによる同時所有はfail closedにしなければならない。Root選択CoreはFilesystemへ触れない。別のPath Identity Core候補は、既に存在するRepository、選択Rootおよび直近parentを事前・realpath解決後・事後・最終返却前に照合し、non-link directory、`dev`／`ino`／`birthtimeNs`の安定性、Rootとparentの直接関係、およびlexical／realpathの包含方向一致だけを確認する。関係を同一、Repository内、Repositoryを内包、相互非包含の4状態へ分け、外部overrideはlexical／realpathの双方で相互非包含の場合だけ許可する。Repository自身またはRepositoryを内包する祖先Rootは指定元にかかわらず`blocked`にする。欠落、置換、link／junction、分類差または安定Identityを取得できないFilesystemも`blocked`にする。Root作成／削除、exclude更新、Path／Operation統合による除外強制、全parent chain、case／Unicode alias、owner／DACL／mode、network／removable Filesystem、activation記録またはCapabilityは成立させない。

Qual-Labは、明示enable時に選択RootがRepository内ならRepository Adapterがroot相対の完全一致entryを`.git/info/exclude`へ冪等に追加し、tracked `.gitignore`を自動変更しない方式を承認した。Repository外overrideにはGit excludeを追加しない。構文候補生成はRepository内外の判定とGit pattern用のescapeだけを行い、Git metadataを書き込まない。Repository内への適用時は、後段で説明する限定parserとlocal exclude書込みAdapter候補が配置graph／configを再検証し、書込みと事後確認を行う。制御文字を含むPath、Repository root自体またはRepository直下の`.git`配下をRuntime Root候補にせず、絶対Pathを結果へ保持しない。完全なRepository Identity、activation結合およびCapabilityは未実装である。ignore状態だけをCandidate Revision／Operation／Provider除外の根拠にしない。

Runtime 1.0のRepository形態候補は通常worktree、linked worktreeおよび`.git` fileを使うが`core.worktree`を持たない限定worktreeとし、bare Repositoryと標準submodule自身を拒否する。Filesystem解決Core候補は`.git` directory／fileと`commondir`を上限付きで読み、non-linkなGit directoryおよびcommon Git directoryを解決し、既存`info/exclude`境界のlinkを拒否する。common configはformat version 0と明示的な`core.bare=false`を一つずつ要求する。限定parserは外部Git CLIの最終照合やfallbackを要求せずmetadata配置graph／config候補を確認するが、完全なRepository Identity、親chain、case／Unicode aliasまたはCapabilityを成立させない。

control fileはPathを上限確認後に再度無制限読取りせず、同一file handleから最大値+1 byteまで読む。Path側とhandle側、読取り前後の種別、`dev`、`ino`、`birthtimeNs`、size、`mtimeNs`および`ctimeNs`が一致し、上限内でEOFまで取得できたbyteだけを解釈する。Repository root、Git directoryおよびcommon Git directoryも子entry確認の前後と最終候補返却前に実体Identityを再照合する。この安定読取りとmetadata書込みCore候補は実装済みだが、同権限Hostによる全parent chainの敵対的TOCTOUを完全防御するものではない。親chain、case／Unicode alias、完全なRepository Identity、owner／ACL、crash durability、activation結合およびCapabilityは未実装境界に残す。

`info/exclude`は`$GIT_COMMON_DIR`に属するため、linked worktreeでは同じcommon Git directoryを使う他worktreeにもpatternが適用される。Qual-Labは、この共有影響を既定`/.crdd-runtime/`だけに限定し、linked worktreeのRepository内custom Rootを拒否する方針を承認した。custom配置が必要な場合はRepository外overrideを使用し、Git excludeを追加しない。local exclude CoreはRepository内RootについてFilesystem解決Coreのlayout候補を再検証し、linked worktreeと判定したcustom Rootを`blocked`へ閉じる。この候補判定からactivationまたはCapabilityを推定しない。

Qual-Labは、Runtime 1.0のGit metadata配置Authorityを外部Git CLIへ依存させず、内蔵の限定Filesystem parserで成立させる方針を承認した。parserは通常worktree、linked worktreeおよび`.git` fileを使うが`core.worktree`を持たない限定worktreeに対象を絞り、common Git directoryの`config`を上限付き安定読取りする。Repository format version 0と明示的な`core.bare=false`を一つずつ要求し、`extensions`／`include`／`includeIf`／`core.worktree`、未知構文、重複したAuthority関連key、未対応formatまたはextensionを自動fallbackせず`blocked`にする。標準submodule自身はこの限定範囲に含めない。これによりGit実行ファイルのPath／Hash／更新承認をOS別に持たない一方、Gitとして有効な特殊構成を保守的に拒否する。このparserはGit全仕様、完全なRepository Identity、case／Unicode alias、parent chain、owner／ACLまたは同一権限Host主体への完全防御を主張しない。

local exclude書込みAdapter候補は、解決済みcommon Git directoryの既存`info` directoryだけを対象とし、caller指定のGit metadata Pathを受理しない。専用統合処置は、内部／外部Rootの双方でRepository、選択Root、直近parent、lexical／realpath包含分類および選択元を最初のPath Identity snapshotへ固定する。内部RootはGit layout確認後、metadata書込み直前、さらに処置後の各時点をその初回snapshotへ照合し、外部overrideもexclude不要候補の返却直前まで同じ初回Identityを要求する。途中で別の正常directoryへ同名置換されても、新しい実体を再基準化しない。既存`exclude`は131072 byteを上限として同一handleから所有copyへ読み、non-link、実体Identity、size、modeおよび更新時刻の前後一致を要求する。完全一致entryがなければ、同一`info` directory内の固定lock名を排他的に取得し、既存内容を保持した一時fileを同期してから置換し、再読取りbyte一致とexact entryを確認する。既存lockは別主体または中断処理の可能性があるため推測削除せず`blocked`とする。処理中に作成したlockだけは実体Identityが同じ場合に限り失敗時に除去する。置換後またはRoot事後再検証の失敗は書込み済み事実を隠さず`blocked`へ閉じ、暗黙rollbackしない。専用統合処置はIdentity descriptor、汎用callback、tokenまたはCapabilityを公開しない。同一権限Host主体による各Filesystem呼出し間の最終race、parent chain、owner／ACL、crash durabilityまたはactivationへの強い時間的結合は保証しない。Candidate／Operation／Provider除外の実強制、activationおよびCapabilityが未実装の間、Gateは`blocked`を維持する。

有効化と処置は対象Repositoryだけへ限定する。親RepositoryがCRDD submoduleを参照するだけの場合、submodule側を変更しない。CRDD-Communication等の別Repositoryを読取り依存にする場合も変更しない。別Repositoryを変更対象にする場合はRoot、activation、exclude、Candidate RevisionおよびOperationを分離し、Runtime Rootを共有しない。複数Repositoryへの同時書込みOperationは未対応であり、依存参照から暗黙に対象を拡張しない。

無効化は新規Operationの開始を止める意味とし、保存済みRuntimeデータを削除しない。データ削除は別の明示操作である。無効化処理とデータ削除処理はいずれも現在未実装であり、Root選択Coreの契約値を実行可能な操作または削除Authorityとして扱わない。

実Path Adapterは、選択済みRootと3ファイル名、root／親／各fileのrealpath containment、non-link／non-reparse、所有主体と権限、作成時・読取り時の実体Identity、取得量、同一Bundle snapshot、原子的置換および旧版からの単調なrevision／Hash chainをProvider起動直前に確認しなければならない。Windows DACL、POSIX owner／modeまたはserver volume policyはPlatform Adapterの実装差であり、Protocolは同じ保護結果を要求する。現在はこのPath／権限／activation境界が未実装であり、File Bundle Core候補、caller supplied Pathまたは一致HashだけではAuthority Capabilityを発行しない。

起動直前Authority再確認Core候補は、呼出側Contextから時刻を受理せず、module初期化時に固定したRuntimeプロセスの`Date.now`とISO変換関数を一回だけ使用する。同じ呼出しでcanonical Registry byte、Trust Policy候補、Profile、Grant、Operation、Scope、有効期間および全Identityを再検証し、Trust Policy ID／revision／Hashと確認時刻を結果へ結合する。呼出側が時刻を追加したContext、accessor、Identity差、失効・未発効・取消・置換をfail closedにする。この結果は候補であり、後からProvider起動へ流用できるCapabilityではない。実Provider起動直前の同一制御経路への結合、Runtime所有Trust Policyの有効化、OS時計の完全性および同一権限コードによるintrinsic置換防止は未実装またはRuntime／Host Trust Boundaryであり、Core候補だけでGateを開かない。

未信頼入力の処理量は、Profile契約が一意に所有する識別子長、Origin件数、各Origin長と、Registry契約が所有するGrant件数、Parse前raw byteおよび正規化後canonical UTF-8 byte数で制限する。raw byte、件数および文字列長をJSON Parse、URL解析、`map`、`sort`およびcanonical化より前に検査し、上限済み母集団だけをcanonical化してHash直前にbyte数を検査する。未知shapeや循環参照を再帰探索せずfail closedにする。実ファイルまたはTransportからbyte列を取得する前段Adapterは取得量とPath／Channel Authorityを別途強制する。候補Coreの評価時刻は有効な`Date`またはcanonical UTC文字列だけを受理するが、起動直前VerifierはRuntime所有の信頼できる時計を使用し、Profile、Registry、Providerまたは呼出側の自己申告時刻からAuthorityを成立させない。

未信頼JavaScript入力は共通plain-data snapshot境界を通す。Proxyを反射処理前に拒否し、plain recordは通常またはnull prototype、期待する列挙可能own data propertyだけを一度descriptor mapへ固定する。配列は全descriptor取得前にown length data descriptorと上限を確認し、`Array.prototype`、連続した`0..length-1`の列挙可能own data propertyだけをsnapshotする。accessor、symbol、独自prototype、hole、非canonical index、余分propertyまたはdescriptor不整合を拒否する。nested record／arrayもdescriptor valueから段階的にsnapshotし、以後raw入力を再読しない。Proxy trapに対する一般JavaScript上の完全防御は主張せず、検出または反射例外を`blocked`へ閉じ、将来LoaderのParse前byte上限とJSON相当plain-data decodeを信頼入口条件とする。

Egress Policy候補は生Profileを内部Validatorへ通し、内部で生成した正規ProfileとHashからだけ完全一致hostnameを導出する。呼出側の検証済みという自己申告、HashまたはProfile objectを信頼せず、Authorityまたは通信許可を自己成立させない。Proxyは`CONNECT`と文字列として厳密なport `443`だけを受け、正規化済みASCII hostnameを許可候補集合へ完全一致させる。IP literal、userinfo、末尾dot、leading zero／符号／空白／制御文字を含むport、別method／port／hostnameを拒否する。

DNS address分類は[IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml)および[IANA IPv6 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml)の2025-10-09更新版、[IANA IPv6 Global Unicast Address Space](https://www.iana.org/assignments/ipv6-unicast-address-assignments/ipv6-unicast-address-assignments.xhtml)の2025-10-10更新版、ならびに[IANA IPv6 Address Space](https://www.iana.org/assignments/ipv6-address-space/ipv6-address-space.xhtml)の2025-10-23更新版を2026-08-11に確認して固定する。Special-purposeの採用列は`Globally Reachable`、Global Unicastの採用列は`Status=ALLOCATED`である。

判定順はbinary parse、IPv4-mapped／compatible／NAT64識別、Special-purpose最長prefix一致、IPv6 Global Unicast割当一致、既定拒否とする。mappedと`64:ff9b::/96`は下位32 bitをIPv4規則へ還元し、compatibleは拒否する。Special-purpose一致が`false`、空欄または`N/A`ならAllocation一致で再許可しない。IPv4はSpecial-purpose非一致だけを通常候補、IPv6はSpecial-purposeで明示許可された範囲または`ALLOCATED` prefixだけを候補とし、未掲載、`RESERVED`、未分類、parse不整合を拒否する。

固定snapshotのSHA-256は、正本から選択・正規化して埋め込んだmetadataと全prefix entryを対象とし、IANA raw file自体のHashではない。entry件数も取得可能にし、Runtime contract revision変更、各IANA registry更新またはendpoint E2E不一致を再確認契機とする。表を自動更新して信頼境界を変更しない。

DNS解決結果はすべてのaddressを検査し、空、不正または非global addressが一件でもあれば接続しない。Policy fixtureの合格をDNS rebinding対策または実通信許可と扱わず、後続Proxyは検査済みbinary addressへ直接接続してhostnameを再解決しないことを受入条件とする。

Provider containerはOperation専用internal Networkだけへ接続し、Proxyだけを到達可能にする。Proxyはinternal Networkと専用Egress Networkへ接続するが、Docker socket、Host Network、他Operation Networkまたは一般Host serviceへ到達させない。Provider環境のProxy変数設定だけを遮断根拠にせず、Docker Network上で直接外部経路が存在しないことを検証する。現在はPolicy／Topology候補だけで、Proxy process、Network lifecycle、DNS／TLS、Authority Capability結合および実Egressは未実装のため、`execution.egress`を`confirmed`へ上げない。

現在のIdentity照合はFake ProviderとHost一時領域に対する境界であり、Path検査から削除までの敵対的な同時置換を完全に防ぐ証明ではない。実Provider Active Probeを実装する場合は、Provider process treeの終了確認後にcleanupし、Providerからtemporary parentへ到達できないOS Sandbox／ACLまたは同等境界を先に成立させて、cleanup競合を再評価する。

## 6. 非対象

- 外部Effectの実行または回復
- Remote Repository操作
- 複数Provider RoutingまたはRole交換
- Git以外のRepository Backend
- Raw Provider Logの保管
- 汎用Migrationまたは複数Protocol Reader
