# Coordinator Runtime 1.0 Threat Model

Status: Implementation Candidate

OS鍵保管ポリシーCore候補はP-256公開鍵と、Windows CNG／KSP＋TPM、macOS Secure Enclave、Linux TPM 2.0の優先Backend、または明示承認されたsoftware fallbackという選択だけを検査する。Backend名、公開SPKIおよびfallback承認はcaller suppliedのpolicy入力であり、hardware-backed、非exportable、鍵handle所有、Platform Provisioner署名または実OS保護の根拠ではない。秘密鍵を入力・出力せず、silent downgradeを拒否し、実native Adapterと保護確認がない限りGateを開かない。

準備認証局（Provisioning CA）のpure Core候補は、offline rootとonline／offline issuing keyのroleを分離し、root署名済みissuing certificateとroot署名済み失効一覧の暗号的一致を検査する。issuing keyは最大365日、失効一覧は半開区間で最大24時間だけ候補化し、未知root、epoch差、期限外、署名不一致および列挙済みroot／issuing keyをfail closedで拒否する。caller supplied root集合、失効一覧および評価時刻はRuntime所有Trust、rollback-resistant floorまたは時計Authorityではなく、実配布と永続化なしにGateを開かない。

準備記録と登録証明書のpure結合候補は、Recordの全署名鍵を現在の登録証明書、Platform scope、Provisioner Identity、公開SPKIおよびCA seriesへ1対1で結ぶ。未結合署名、重複証明書または余分なbindingはfail closedで拒否し、この一致だけからRuntime所有Trust、時計、Filesystem、activationまたはAuthorityを成立させない。

登録証明書更新のpure遷移候補は、同じenrollment、Platform scope、Provisioner Identityおよび端末導入鍵を維持し、旧証明書の残り30日以内かつ失効前に新証明書を発行し、重複期間を最大30日に限定する。caller supplied時刻やissuer鍵からRuntime所有時計、CA Trust、rollback防止、保存または自動更新Effectを成立させない。

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

Authority Bundleの物理RootはRepository単位のRuntime Rootから分離し、複数Repositoryで共有可能な明示絶対Pathだけを受理する。OS固有の暗黙Rootは設けず、CLI、環境の順で選ぶ。Repository内Runtime RootまたはProvider mountへAuthority Bundleを含めず、Path／owner／ACL、non-link、安定Identity、provisioner／admin主体だけが書込み可能、Runtime主体は読取り専用、非承認主体は書込み不可という共通保護結果をPlatform Adapterが確認できなければfail closedにする。Windows DACL、POSIX owner／modeおよびserver volume policyは実装差だが、OS名だけで成立を推定しない。現在のAuthority Root選択Core候補はPathを出力せず、実Path AdapterまたはCapabilityを発行しない。

共通Root保護方針Core候補は、`runtime`／`authority`のRoot role、`windows`／`posix`のPlatform family、`local`／`persistent_volume`のFilesystem classおよび主体別access観測をexact plain-dataとして受ける。Runtime RootにはRuntime read/write、排他的な`runtime_principal_only` writerおよび非承認主体write禁止、Authority Rootには排他的な`provisioner_principal_only` writer、Runtime read-onlyおよび非承認主体write禁止を要求する。Runtime principalは選択された利用者またはサービス実行主体、provisioner principalは承認されたadmin／installerのProvisioning Authority集合を意味し、単一人物を意味しない。既存Root、安定Identity、link／reparse非該当も共通条件とする。network、removable、special、unknown、観測欠落または不正shapeはfail closedにする。読取り制限は今回の人間決定に含まれないため、Runtime以外のread禁止を新しい共通条件にしない。RuntimeがRoot作成やchmod／ACL変更を実行しないことと、OS上その権限変更能力を完全に除去できることも区別する。

writer限定は通常のDACL／ACL／mode上の許可を対象とする。Windowsの`SYSTEM`／machine AdministratorsおよびPOSIXの`root`はOS自体を支配できる信頼するプラットフォーム管理者境界（Trusted Platform Administrator Boundary）であり、暗号的に排除できる第三者writerとは扱わない。Runtime所有経路がIdentity、保護metadata、署名、Trustまたはactivationの観測可能な変化を検出した場合は`blocked`として再検証し、信頼基盤（trust base）が健全と確認できた場合だけ再Provisionへ進める。健全性を確認できない場合、分類不能な場合、または管理者侵害が疑われる／確定した場合は、同じTrust基盤上の再Provisionへ直接進まず、プラットフォーム復旧（Platform recovery）でTrust基盤を再確立した後だけ再Provisionへ進める。再検証、復旧またはTrust再確立が不能なら`blocked`を維持して人間の決定権限者へ移送し、自動修復やfallbackを行わない。プラットフォーム復旧は将来の人間／Platform運用処置の目標で、現RuntimeのEffect、Capabilityまたは成功状態ではない。いずれの経路でもCapabilityを発行せずProvider／Operationを開始しない。これは侵入防止ではなく、観測可能な変更に対する検出と安全停止の契約である。攻撃者がOS、kernelまたはVerifier自体を完全に支配し、観測結果または実行コードを偽装する場合の検出と防御は保証しない。

このCoreはPolicy要求と観測claimを照合するpureな候補であり、caller suppliedの`stableIdentityObserved`、link／reparse状態またはaccess可否をAuthorityへ昇格させない。同梱package向けのWindows DACL Adapter候補は、固定Windows PowerShell 5.1とSID／numeric access maskからRoot継承保護、全要素のowner、reparse point不在、非信頼主体へのwrite ACE不在、および選択したRuntime主体の全要素read／execute成立とwrite／Deny ACE不在を確認する。権限変更は署名済みCRDD配布物を先に検証した明示`provision`が固定ProgramData導入Rootへだけ実行し、全要素を設定後に同じ検査で再確認する。Path、SID、ACEまたはraw errorは公開しない。POSIX owner／mode Adapter、persistent volume Adapter、Path bindingおよびactivation integrationは未実装である。pure CoreとRuntime通常runはFilesystemを書き込まず、Root作成、chmod、ACL変更、activation、Capability、ProviderまたはOperationを発火しない。network／removable／special Filesystemの許可、非承認主体の定義拡張、読取り制限またはRuntime自身の権限変更能力除去を追加する場合は、新しい人間判断へ戻す。

POSIX Runtime Root precheck入口候補は、明示opt-in時に評価するが、信頼できるFilesystem classifierが未実装の間はPOSIXでもraw入力、Path選択、Path Identity session、`lstat`／`realpath`／`open`／`fstat`、process identityおよびmode観測へ進まず、固定理由で`blocked`へ閉じる。Windowsはplatform未対応として同じくPath観測前に閉じ、非opt-inは入口を発火しない。現段階では`local`と`persistent_volume`を実体から分類できず、POSIX owner／mode観測、ACL／xattr、将来service principal、Authority Rootのprovisioner集合およびFilesystem class確認は未実装である。Path／UID／GID／mode／descriptorを公開せず、任意callback、raw観測から成功を作るhelperまたは再利用tokenを追加しない。将来mode観測を導入する場合は、信頼できるlocal Filesystem分類と同じPath Identity sessionへ先に結合し、caller supplied classだけで有効化しない。

Runtime Rootの既定候補はRepository直下の`.crdd-runtime`、明示overrideの指定契約と優先順はCLI、環境、Repository既定とする。選択は絶対Pathの構文候補だけを扱い、絶対Path自体をdoctor／Evidenceへ出力しない。OS別の暗黙rootを設けず、serverでは同じ契約へ永続Volumeの絶対Pathを指定できる。CLI引数は未知、重複、値欠落、余剰tokenおよびrecoveryとの混在をRoot／Git metadata処置前に拒否する。`--runtime-root`は`--enable-runtime`なしで受理しない。環境overrideは非opt-in時にRuntime Root検査へ渡さず、opt-in時だけCLIより低い優先度で一度固定する。CLIからの呼出しだけでなく`doctor`の直接入力も処置前にexact plain-data snapshotへ固定し、ネストしたRoot要求のaccessor、Proxy、symbol、独自prototype、欠落／余分fieldまたは不正値を固定理由で拒否する。`--enable-runtime`は有効化要求の診断候補であり、Directoryの存在、override、ignored状態またはRepository内ファイルをactivationの根拠にしない。Runtime所有activation記録の原子的永続化と再検証が成立するまでCapabilityを発行しない。

activationは診断要求とrun-scoped Capabilityから分離したRepository単位の永続状態とする。専用`activate`／`disable`のCLI grammar候補はcommandごとのoptionを処置前に一度だけ解析し、CLI誤用、環境／選択契約不成立、および妥当な要求だがEffect未実装という3結果を区別する。Runtime RootはCLI、環境、Repository既定、Authority RootはCLI、環境の順で選び、Authority RootにOS暗黙既定を設けない。各Root軸でCLI指定がある場合は同じ軸の低優先な環境値を選択／検証せず`null`として後続selectorへ渡し、CLI指定がない場合だけ環境値を検証する。一方のRoot軸のCLI指定で他方の不正環境値を隠さない。`disable`はAuthority Rootを読まず、doctor／recovery用optionも両commandへ混入させない。安全な引数snapshotを取得できた場合は個別token検査より先に`--json`要求を確定し、不正tokenでも構造化usage errorを返す。snapshot自体が成立しない場合はraw入力からJSON要求を推定しない。結果はcommand種別と固定reasonだけを返し、Path、環境値、cwd、Identityまたはraw tokenを保持しない。固定`activation.json`候補はRepository／Runtime Root Identity Hash、Bundle／Policy／RegistryのID、revisionおよびHash、activation revision／前版Hash、状態と4桁年・24文字のcanonical UTC時刻を結合する。時刻は文字列型と長さをDate解析、canonical化およびHash計算より前に確認する。cross-record Core候補は外側入力をexact plain-data snapshotし、前版canonical byteを既存decoderで再検証してHashを再計算する。前版のない初版`active`と、revisionを正確に1増やし、前版Hash、activation／Repository／Root Identity、Bundle／Policy／Registryの全参照および`activatedAt`を維持して`disabledAt`だけを加える`active`から`disabled`への遷移だけを候補化する。caller supplied Hashを信頼せず、disableとAuthority差替えを混在させない。`active`から`active`への再activationと`disabled`起点の遷移は未実装である。Bundle Identity変更時に古いrecordを自動追随させず、現版では再activationを完了できないため`blocked`にする。`disable`は永続状態として新規Operationを止め、進行中Operationは既存の安全なcancel／recovery契約へ渡し、保存データを削除しない。deleteは別の明示的かつ不可逆な操作として今回実装しない。command grammar候補、recordのcanonical Core候補およびcross-record Core候補はFilesystem処置、Authority、原子的永続化、Path／ACL、起動直前再確認またはCapabilityを成立させない。

ローカル導入の目標contractは、無効なRepositoryではRuntime固有Effectを発火せず、初回Platform setupをTrust検証済みCRDD配布物内の明示Provisioner経路と共有Authority Root Provisionへ限定し、Repositoryごとの`coordinator activate`を唯一の有効化入口とする。有効なProvisioning／activationと保護Identityを再確認できる将来状態では通常実行／再起動ごとの昇格、Path再入力またはACL手動設定を要求しないが、再確認自体を省略しない。Platform Provisionerの署名／Trust、principal、Root Identityまたは保護metadataの変化を検知した場合は必ずfail closedでreverificationを開始する。再確認によってRoot欠落／置換、排他的writerまたはAuthority RootのRuntime read-only不一致、もしくは将来の検証済みProvisioning記録に対するAuthority Root Identity不一致が確定した場合だけreprovisionを案内する。判定不能時も`blocked`とし、Runtimeは自動修復、Root作成、chmod／chownまたはACL／DACL変更を行わない。現段階では署名済み配布物のPlatform Provisioner検証、Windows導入Effect、状態transactionおよびRuntime有効世代readerは実装済み候補であるが、Provisioning記録、Authority Root resolver、readerの通常run Authority接続およびactivation Effectは未実装である。これらの再Provision条件を実評価せず、Directory、Platform Provisionerの存在またはcaller claimをProvisioning成立へ流用しない。現行の明示Authority Root Path契約を維持し、OS暗黙Pathを導入しない。

明示`coordinator provision`のcommand grammarは実装済み候補だが、現ローカル／開発buildでは常にEffect前に`blocked`となる。結果の`dryRunOnly`、CRDD配布Revision／package Filesystem未確認またはEffect 0という表示は検証tokenではなく、別入口へ持ち回ってTrustを成立させられない。CRDD配布物と内包packageの全Trust条件が同一制御経路へ結合されるまでRoot作成、鍵生成、ACL変更または保存を行わない。

承認済みのProvisioning方針は、CRDD配布物の`tools/coordinator`に内包するprivate TypeScript sourceを固定Release Trustで検証し、有効な準備Identityが維持されるPlatform scopeへ初回の管理者操作を限定する目標contractである。内部Scriptは同一フォルダ配置のまま`.ts`で、実行要件はNode.js 24.12以上のnative TypeScript実行とする。version 1のEffect前条件は、検証済みCRDD Revision、Qual-Lab署名済みpackage manifest、およびRuntime所有のsource内容／Filesystem Identity確認が同じCRDD配布物へ結合して成立することである。manifestのexact object、CRDD Revision、Ed25519署名およびfile一覧content rootのpure一致に加え、module相対で固定した`tools/coordinator`だけを再帰走査し、non-link Root／fileのIdentityを前後確認しながら同じhandleからbyte数とSHA-256を取得するFilesystem Adapter候補を実装した。開発依存の`node_modules`とroot `.gitignore`は配布package内容から除外し、Path、生byteまたはdescriptorを公開しない。release Trustは、外部確認済みCRDD ReleaseへQual-Labの有効なEd25519公開鍵exact 1本をCRDD所有sourceへ固定し、CRDD version、Commit、TreeおよびCoordinator content rootを`90_Release/coordinator-package-manifest.json`の署名対象へ結ぶ。公開鍵は検証専用で、秘密鍵をRepositoryへ保存しない。manifestは署名対象Git Treeの外で生成し、展開済み配布物へ後置することでCommit／Treeの自己参照を避ける。外部ステージングRoot用の署名command、Policy Identity算出、固定Pathのcanonical同一handle loader、および後置manifestだけを除いた配布Root全体のGit Tree再計算は候補実装済みである。署名済み`crddTree`と実配布Treeを一致させ、単独packageまたは一部fileだけのコピーをCRDD配布物として受理しない。Windowsの明示`provision` Effectは、検証済み配布物だけを固定ProgramData Rootの世代別pendingへコピーし、配置後も同じ署名Manifestとcontent rootを再検証してからDACL、rollback floorおよびactive releaseを更新する。固定公開鍵以外のcaller supplied signer、期待Revision、manifestまたは任意Root観測をRuntime所有Trustへ昇格しない。POSIXではroot所有、directory `0755`、file `0644`を全treeへ要求する候補を実装した。単独npm公開／個別install、専用native executableおよびOSネイティブコード署名はversion 1で要求せず、単独取得sourceをEffectへ使用しない。未知Revision、改変、権限不一致または別source／方式へのfallbackをEffect前に拒否する。未検証source checkoutはProgramData探索と書込みより前に`blocked`となり、明示`provision`以外から昇格、鍵生成、ACL変更または保存を発火しない。

署名payloadは単調増加する`releaseSequence`もRelease Identityへ結合する。rollback floorのpure遷移と専用Storeは低いSequenceと同一SequenceのIdentity差替えを拒否し、canonical pending、file `fsync`、原子的置換および再読取りを要求する。有効世代ポインターも同じRelease Identity、package content rootおよびfloor Hashをcanonical `active-release.json`へ結合する。両状態は永続transaction intentへ結び、明示`provision`だけがfloor、activeの順で確定し、途中停止時は同じintentを復旧する。Runtime readerは未完了transaction不在、floor／active一致、署名済み導入世代およびDACLを読取り専用で再検証する。通常runのAuthority接続が未実装の間は、caller supplied floor、active stateまたはreader候補をAuthorityへ昇格しない。

package Trust Gateのpure集約はmanifest、CRDD Revision、package content root、file Identity安定性およびpermission policy一致を同時に要求する。固定Root Filesystem Adapterは内容とIdentityをRuntime側で観測するが、release signer／manifest／期待Revisionはまだ未信頼入力で、owner／permissionも検証しない。したがってcaller supplied観測値または`verified_crdd_bundle`値と同様にAuthorityへ昇格せず、同一権限code、配布物自体または実行前の内容を信頼する根拠にはならない。release Trust、permission検証およびEffect controllerの同一制御経路が必要である。

現在のexact schemaはCRDD Revisionを単独fieldとして扱わず、`crddVersion`、`crddCommit`、`crddTree`および`packageContentRootSha256`の4値をmanifest署名とGate照合へ結ぶ。旧`crddRevision`は受理せず、4値の欠落、不一致または置換をEffect前に拒否する。

ローカルでは選択利用者、serverでは専用サービスアカウント（service account）をRuntime principal種別とするが、自己申告principal、Platform Provisionerの存在または署名らしい値をAuthorityへ昇格しない。共有Authority Rootの通常run再利用は、将来の署名・Trust検証済みProvisioning Recordへ結合された明示Pathに限る。準備記録（Provisioning Record）のrevision 1 payload、署名包絡（signature Envelope）、信頼起点鍵集合（Trust Anchor Set）および失効一覧（Revocation Manifest）のexact pure codecと集約署名検証（aggregate signature verification）候補を実装した。Provisioning Receiptを別のRuntime Authority成果物として要求しない。Platform Provisioner package manifestは配布packageと保護policyの結合検証専用であり、Provisioning RecordまたはAuthority File Bundle Manifestを代替しない。

pure Core候補は署名領域分離（domain separation）を固定ASCII prefix `CRDD\0PROVISIONING-RECORD\0V1\0`、payload JCS byte長の符号なし64-bit big-endian値、payload JCS bytesの順で構成する。鍵識別子（key ID）はexact RFC 5480 P-256 SPKI DERのSHA-256 lowercase hexadecimal 64文字、署名はECDSA P-256 with SHA-256の固定64-byte IEEE P1363形式をpaddingなしcanonical base64urlで表す。準備記録はcanonical UTCの`issuedAt`より`expiresAt`が後で、その差が最大180日以内の場合だけ候補化する。集約評価では評価時刻が`issuedAt`以上かつ`expiresAt`未満であることを要求し、期限外または180日超過をfail closedで拒否する。この180日は準備記録の有効期間上限で、鍵の有効期間、鍵切替期間または失効一覧の保持期間ではない。raw decoderはBufferだけをowned copyし、strict UTF-8、BOMなし、exact Schema、JCS再符号化完全一致、件数・深さ・node・byte上限を要求する。集約候補は全署名entryが既知、非失効、期間内かつ暗号学的に正常な場合だけ成立し、無効entryを無視しない。署名鍵が失効一覧へ列挙されていれば`revokedAt`が評価時刻より過去、同時または未来のいずれでも拒否し、`revokedAt`を予約失効の発効時刻として扱わない。caller suppliedの入力鍵集合、失効一覧および評価時刻は暗号条件を再現する候補であり、それ自体はQual-Lab同梱Trust、現在版、rollback防止またはRuntime時計Authorityではない。永続floorへ結合したTrust成果物、current RecordおよびRuntime取得時刻を使う集約検証候補は実装したが、初期Trustの承認済み導入元、Authority Root実体のresolver／Identity／保護、実端末登録Effect、完全Lifecycleおよびactivation確認が未接続のため、候補一致もAuthority、CapabilityまたはGateを開かない。raw payload、canonical byte、Path、SPKI、signatureまたはkey IDをdoctor、log、Evidence、ProviderまたはOperationへ出さない。

端末導入鍵（installation key）の初回オンライン登録pure Core候補は、30分のオンライン登録チャレンジ（online enrollment challenge）、チャレンジのdomain-framed payload Hashを含む登録要求（enrollment request）、端末導入鍵による所有証明、およびPlatform scope・Provisioner Identity・公開鍵を結ぶ登録証明書（enrollment certificate）を検査する。端末導入鍵と準備記録はECDSA P-256 with SHA-256、準備認証局（Provisioning CA）はEd25519という異なる鍵roleとalgorithmに固定し、RSA、別曲線またはalgorithm fallbackをrevision 1へ持ち込まない。チャレンジ／登録要求／登録証明書のexact object Schema、成果物別domain、JCS署名messageおよび数学的署名一致は実装済み候補である。署名前payloadのcanonical raw byte decoderに加え、登録要求のECDSA P-256署名exact 1件と登録証明書のEd25519署名exact 1件をpayloadから分離するobject Envelope、およびEnvelope全体を上限131072 byteのcanonical JCS UTF-8として受理するraw byte decoderも実装済み候補である。独自header／length prefixを受理せず、入力bytesと再生成canonical bytesの完全一致を要求する。登録要求は署名key IDとpayloadの端末導入鍵ID、登録証明書は署名key IDとcaller supplied issuer SPKIの再計算Hashを一致させる。オフライン束はexact object Envelope、online／offline issuing 2役、要求・証明書・失効snapshotのbindingおよびoffline issuing key署名をpureに検査する候補まで実装した。transport、Runtime所有時計、永続一回消費台帳、Runtime所有CA Trust／失効、Network、Filesystem import、keystore、Record結合および証明書更新は未実装である。caller supplied issuerをTrustへ昇格せず、decoder候補や数学的一致もAuthority、Capability、EffectまたはGateを開かない。

初回オンライン登録のpure Core候補は、30分のチャレンジをJCS化し、登録要求がそのdomain-framed payload HashとPlatform scope・Provisioner Identity・端末導入鍵を結び、要求全体へのECDSA P-256 with SHA-256所有証明を検査する。登録証明書は同じIdentity群と公開鍵を結び、別domainのEd25519準備認証局署名を検査する。正常結果は暗号条件の`candidate`だけであり、Runtime所有時計、一回消費台帳、CA Trust／失効、Network、Filesystem、Record結合およびAuthorityを成立させない。証明書更新、実CA Trust／rotation、実keystoreおよび保存Lifecycleは対象外である。オフライン束のobject／署名／binding候補は別pure Coreで扱う。

<a id="provisioning-signature-external-standards"></a>

### 署名基礎Coreの外部規格入力

固定`state/release-floor.json`と`state/active-release.json`のStoreはcanonical byte、pending fileの永続化、原子的置換、再読取り照合および明示復旧までを実装済み候補とし、`state/provision-transaction.json`を所有する状態transactionから明示`provision` Effectへ接続する。Windowsでparent directory syncが利用できない場合も、未完了pendingを捨てたり自動rollbackしたりしない。Runtime readerは実装済み候補だが、通常runへのAuthority接続が未完了の間は、Store、transactionまたはreader結果をRuntime AuthorityまたはCapabilityへ昇格しない。

確認日（reviewedAt）は`2026-08-15`である。Runtimeは規格本文をネットワーク取得または自動更新せず、下表で採用した内部contractを拘束点とする。RFC errata、Node.js cryptoの挙動、または採用範囲が変わる場合は人間の判断と再監査を行う。

| 正本・発行時点・文書区分 | 今回適用する節 | 採用範囲 | 非採用・未実装範囲 |
|---|---|---|---|
| [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)（2020-06、Informational） | §3.1–§3.2.4、§5、Appendix B | plain I-JSON値のJCS canonicalizationと公式number vector | raw JSON duplicate-key decoder、Record Schema、既存canonical成果物の移行 |
| [RFC 5480: Elliptic Curve Cryptography Subject Public Key Information](https://www.rfc-editor.org/rfc/rfc5480.html)（2009-03、Standards Track） | §2.1.1、§2.1.1.1、§2.2 | P-256（secp256r1／prime256v1）のexact SPKI DER構文とcanonical再符号化候補 | 別曲線、ECDH、CA Trust採用、鍵保管Backend |
| [FIPS 186-5: Digital Signature Standard](https://csrc.nist.gov/pubs/fips/186-5/final)（2023-02、Standard） | §6、§6.4 | ECDSA P-256 with SHA-256の数学的一致候補。署名表現のlow-S一意化は内部contractで追加する | FIPS準拠表明、鍵生成・保管認証、別曲線、Runtime Authority |
| [RFC 8410: Algorithm Identifiers for Ed25519, Ed448, X25519, and X448 for Use in the Internet X.509 Public Key Infrastructure](https://www.rfc-editor.org/rfc/rfc8410.html)（2018-08、Standards Track） | §3–§4、Appendix A | Ed25519 SPKI DERの構文・canonical再符号化候補 | Trust Anchor採用、key ID表示、keyset／失効判断 |
| [RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)](https://www.rfc-editor.org/rfc/rfc8032.html)（2017-01、Informational） | §5.1.7、§7.1 | Ed25519個別署名の暗号学的一致と空message試験vector | CRDD domain、Envelope、鍵／失効／aggregate Authority判定 |
| [RFC 4648: The Base16, Base32, and Base64 Data Encodings](https://www.rfc-editor.org/rfc/rfc4648.html)（2006-10、Standards Track） | §3.2–§3.5、§5 | exact 64-byte Ed25519署名および固定64-byte P-256 IEEE P1363署名のpaddingなしcanonical base64url、非alphabet／非canonical表現の拒否 | key ID encoding、Envelope wire Schema、他のbase encoding |

Provisioning Record正本は共有Authority Rootと同じPlatform scopeで管理者／provisionerだけが書込み、Runtimeは読取り専用とする目標であり、Repositoryへ複製しない。RepositoryのAuthority Root LocatorはRecord Hashだけを持つ信用前hintで、Recordや署名を代用しない。初回setup／再設定は明示CLI、通常runは検証済みRecord＋Locator、環境変数は互換／自動化向けの明示overrideという役割に分けるが、現行CLI→環境の実選択を未実装resolverで置換しない。不一致、欠落、失効または再識別不能では低優先sourceへsilent fallbackせず`blocked`とし、自動修復せず再Provisionへ戻す。実行するProvisioner実体の署名・Trust確認と、生成済みProvisioning Recordの署名検証は別責務である。オンボーディング準備状態は、12件の実装依存が将来承認される十分条件を満たすことと、対象runでProvisioning Record／Provisioner Trust、Authority／Runtime Root Identityと保護、principal binding、Repositoryに結合したactive activationおよびPlatform Provisioner署名／Trust／保護metadataの6根拠をRuntime所有経路が再確認することのANDとする。どちらかが欠落、不明または不一致なら`blocked`であり、契約表示だけでFilesystem Effect、Authority、CapabilityまたはOperationを発行しない。

準備記録Store候補は固定`.crdd-provisioning/records/<recordHash>.json`のimmutable envelopeとcanonical `current.json` pointerへ分離する。安定した同一handleからRecordとpointerを再読取りし、Hash、canonical byteおよび系列のrevision／previous Hash／Record ID／Platform scope／Provisioner Identity／登録IDを照合する。通常経路はpendingを自動処理せず、明示復旧だけが欠落currentへの適用、同一currentのpending除去、または正しい次revisionへの遷移を行う。改変、系列差替えまたは分類不能では推測rollbackや旧pointer fallbackをせず`blocked`へ閉じる。Storeの成功はFilesystem候補に限り、Runtime所有Trust、失効、trust floor、Authority Root保護、resolver、AuthorityまたはCapabilityを成立させない。

Authority Root結合候補は、選択済み絶対Path、Filesystem Identity Hashおよび保護policy Hashを準備記録の署名対象値と比較し、1値でも異なれば別候補へfallbackせず拒否する。公開結果へ絶対Pathを出さず、結合一致からRoot探索、保護成立またはAuthorityを推定しない。

準備Trust floorのpure Core候補はTrust Anchor Set Hashと信頼epoch、失効一覧Hashと失効revisionをcanonical Hashへ結ぶ。同一epochのAnchor差替え、epoch rollback、失効revision rollbackおよび同一失効revisionのManifest差替えを拒否し、新epochだけが新しいAnchorと失効系列を開始できる。専用Storeは固定`.crdd-provisioning/trust-floor.json`以外を扱わず、pendingがあれば通常処理を停止して明示復旧だけを許す。永続floorからcontent-addressed Trust成果物を再取得してcurrent RecordをRuntime取得時刻で検証するが、初期Trustの承認済み導入元が未接続である間はRuntime所有Authorityを成立させない。

Trust成果物Store候補は、信頼起点鍵集合と失効一覧を成果物別のcontent Hash名で固定`.crdd-provisioning`配下へ保存し、同一Hashの別byte、改変、link、Root差替え、epoch不一致またはtrust floorとのHash／revision不一致を拒否する。途中で片方だけが作成されても未参照のimmutable成果物として保持し、floorへ結合された2成果物が揃うまで成功したTrust状態とみなさない。floorへ結合済みの2成果物とcurrent Recordを安定読取りし、Runtime取得時刻で全署名、鍵の有効期間および失効状態を集約検証する。RepositoryはSchema、固定相対レイアウト、実装および試験だけを所有し、実鍵集合、失効状態、端末固有Rootまたは秘密鍵を保存しない。初期Trustの承認済み導入元とAuthority Root実体のresolver／Identity／保護が未接続なので、Storeと集約検証の一致だけからRuntime所有Trust、Authority、CapabilityまたはGateを成立させない。

オンボーディング準備状態は既存contractの実装状態を一回固定し、同じsnapshotから公開fieldと阻害一覧を生成する派生表示に限る。共有Authority RootのPlatform scopeとRuntime RootのRepository scope／activation前提を同時・同一Effectとして平坦化しない。Platform Provisioner検証／Effect、Provisioning Record contract／Lifecycleおよび署名／鍵／失効／読取り検証、Authority Root resolution、Root Protection Platform Adapter、Runtime／Authority Root Provisioning Effect、activation Effect、Path Identity結合、原子的永続化またはrun-scoped Capabilityが未実装である間は常に`blocked`である。候補値、未知値またはRoot Protectionの一部実装だけで阻害項目を除去せず、阻害一覧が空でも別途承認されたready遷移なしに`ready`へ昇格しない。投影は外部入力、Provisioning Record Schema／署名Envelope、独立Receipt／helper Manifest Authority Schema、Path、Filesystem／署名API、Effect、AuthorityまたはCapabilityを受理／生成せず、caller claimで状態を変更できない。

Authority Root検索票（Authority Root Locator）は、Repository直下の固定`.crdd-runtime/authority-root-locator.json`に置く信用前検索ヒントであり、外部Runtime Root overrideへ追随しない。初回検索票の専用Store候補はcanonical byte、pending `fsync`、原子的配置、安定再読取りおよび明示復旧を要求し、pending残存時の通常読取りと既存検索票から別内容への推測遷移を拒否する。内部resolver候補は記録Pathのnon-link Directory実体だけを観測し、記録済みIdentity Hash、保護、Provisioning Recordまたはactivationとの一致をAuthorityへ昇格しない。Repository、Runtime Root、Authority RootおよびProvisioning RecordのIdentity Hashに加え、activation ID、revisionおよびcanonical record Hashを結合し、同じIDの別revisionを古い検索票から再信頼しない。資格情報は含めないが端末固有の絶対Pathを含むため、raw record、canonical byteまたはPathをdoctor、log、Evidence、Provider、OperationまたはCandidate Revisionへ公開しない。検索票はProvisioning Recordとは別成果物でRecord Hashだけを参照する。Provisioning Receiptまたは独立helper Manifestを必須Authority成果物として要求せず、補助資料が存在してもRecordを代替しない。既存Authority File Bundle Manifestは別成果物であり、相互にAuthorityを代用しない。

検索票Core候補はcallerが明示的に呼んだ場合だけexact shape、byte上限、current platformで対応する保守的なcanonical lexical subset、canonical JSONおよび内容Hashを検査する。Windowsは大文字drive letterのdrive-absolute形式に限定し、UNC／device namespace、ADS、禁止文字、segment末尾dot／space、予約device basenameとその拡張子付き別名を拒否する。これはlexical候補判定だけで、Pathの存在、case／Unicode alias、link／reparse、Filesystem class、Identity、ownerまたはACLを確認せず、Windows serverのUNC／network Pathを対応済みとしない。POSIX側の既存canonical absolute lexical Path契約は変更しない。有効activation–検索票結合候補（Active Activation–Locator Binding Candidate）は、既存Coreで検査した初版`active` recordと検索票のRepository／Runtime Root Identity Hash、activation ID／revisionおよび再計算record Hashだけを比較する。`active`は入力状態値に限り、実runの有効性を示さない。比較一致もProvisioning Record Hash、Authority Root Identityまたは保護を検証せず、Path、raw record、canonical byteまたはIdentity値を公開しない。Filesystem探索／読取り／書込み、原子的永続化、crash recovery、resolver、Provisioning Record／署名、Root Identity／保護または実active activation bindingを行わない。将来はactivationと検索票を同じ原子的更新で成立させるが、現版は一部更新、Hash／Identity不一致または判定不能をfail closedにし、自動修復、暗黙rollbackまたは旧記録へのfallbackを行わず再Provisionへ戻す目標契約だけを所有する。これらの未実装軸は同じcontract snapshotから既存のAuthority Root resolutionおよびactivation atomic persistence阻害依存へ結合する。構文とHashが正しくても`untrusted_discovery_hint`の候補に限り、実行時は検証済みProvisioning Record、Provisioner Trust、Repository／両Root Identity、active activation、principalおよびRoot保護をRuntime所有経路で再確認する。欠落、不一致、改変、移動または別PCではfail closedで再Provision／再activationへ戻し、自動修復またはPath変換を行わない。検索票Coreまたはpure比較一致だけで既存12阻害依存、Gate、Authority、CapabilityまたはOperationを開かない。質的規則としてprivate-owned transaction、期待previous／next Hash、曖昧時の成果物保持＋`blocked`、inactive locator保持および新activation IDを承認済みとする。未決・未実装なのはexact transaction／journal Schema、ID形式、配置、具体的回復手順およびAdapter／Effectである。

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

### 承認済みProvisioning実装パッケージの脅威境界

後続の人間判断により、一回限りのオンライン登録チャレンジ（online enrollment challenge）は発行時から30分有効とする。nonce、installation public key、Platform scopeおよび登録要求へ結合し、最初の検証試行が成功でも失敗でも消費して再利用しない。期限切れは`blocked`とし、新しいchallengeを要求するが、offline方式へ自動fallbackしない。この期限は登録通信だけに適用し、通常runでは発火しない。登録要求／登録証明書のobject Envelope、署名exact 1件のpure検証、および両Envelopeのcanonical JCS UTF-8 raw byte decoderは実装済み候補である。Runtime所有のwall clockとmonotonic clockの後退検出、および最初の検証試行をprocess内で一回消費するControllerも候補実装した。process再起動をまたぐ永続台帳、transportおよびEffectは未実装であり、process内結果だけからreplay防止、TrustまたはAuthorityを成立させない。署名済みoffline bundleは7日有効・一回消費とし、exact object Envelopeと暗号・binding検査は実装済み候補、raw decoder・永続台帳・import Effectは未実装とする。準備認証局はoffline rootとonline／offline issuing keyを分離し、issuing keyは最大365日、切替overlapは30日、失効情報freshnessは24時間とする。Trust epoch／revisionの低下または同revision別Hashはrollbackとして拒否するが、単調floorの永続化は未実装である。

Authority RecordとRepository generationはimmutable成果物とatomic pointerへ分離し、cross-volume atomicityを主張しない。順序はimmutable file fsync、generation directory fsync、pointer temporary file fsync、pointer atomic replace、pointer parent directory fsync、再読取Identity確認とする。各fsync、atomic replace、再読取またはIdentity確認のfailure／unknown／mismatch、および結果分類不能では、今回作成済みの成果物と検証済みの既存journalだけを回復用に保持して`blocked`とし、明示的回復を要求する。journal不存在または保持確認不能も`blocked`のままとし、推測rollback、自動retry、旧pointerへのfallbackまたは成功扱いを行わない。明示的回復の具体手順とEffectは未実装である。権限Effect ownerは全package Trust条件を満たした明示Platform Provisioner経路だけで、通常Runtimeによるpermission mutationを禁止する。Windowsの継承／広範write ACE、POSIXの未承認group／other write、およびlocal相当の安定Identity・durability・ACLを証明できないnetwork／removable／special／unknown volumeは拒否する。

これらは質的な安全契約である。初回オンライン登録3成果物のexact object Schema／domain／JCS署名messageとpure数学的一致は実装済み候補である。署名前payloadのcanonical raw byte decoder、登録要求／登録証明書のexact object Envelope、および両Envelope全体のcanonical JCS UTF-8 raw byte decoderも実装済み候補である。オフライン束のexact object／online・offline issuing 2役chain／署名・binding検査も実装済み候補である。transport、永続replay台帳、Runtime所有CA Trust／rollback floor、CA実配布Lifecycle、証明書更新、オフライン束raw decoder／import Effectおよび実OS／Filesystem Adapterは未実装である。caller claim、Pathやcertificateの存在またはcandidate contractだけからTrust、Authority、Capabilityまたはreadyを成立させない。

## 6. 非対象

- 外部Effectの実行または回復
- Remote Repository操作
- 複数Provider RoutingまたはRole交換
- Git以外のRepository Backend
- Raw Provider Logの保管
- 汎用Migrationまたは複数Protocol Reader
