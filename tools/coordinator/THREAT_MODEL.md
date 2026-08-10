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

3軸不存在Oracleの成功は、同一実行内のProbe ID、64桁container ID、Operation root、Docker CLI Capabilityおよび`docker_submission_started`のHost記録Hashへ結び付いたmodule-privateな一回限りのCapabilityにする。Capabilityを公開結果へ含めず、token、owned object、状態名、同形objectまたは別Probeの結果から復元しない。Host記録の原子的更新に成功した後だけ消費し、更新失敗時は送信開始状態と回復情報を保持する。非export化は誤用防止であり、同じHost権限でソースを変更できる主体への完全なSecurity境界とはしない。

Operation rootのcleanup所有母集団は、factoryが作成する`workspace/`、`provider-home/`、`tmp/`、`events/`、`projection/`および`management/`の6 childである。Docker mount対象は前3件だけであり、管理領域を昇格させない。通常cleanupとHost recoveryはroot直下を列挙し、現在entryが既知6件の部分集合で、存在する各childが保存Identity、directory種別、non-link、親および実Pathへ一致する場合だけ再帰削除する。既知childの不存在は部分回収として許容するが、未知file／directory／link、dangling linkまたは置換childは拒否する。

このFake ProbeはProvider endpoint限定Egressを証明しない。`--network=none`は外部送信を遮断するが公式Providerを利用不能にするため、Provider用Egress allowlistが未実装である限り`execution.egress`は`blocked`のままとする。Fake Probeの合格をProvider認証、active probe、lifecycleまたは実Operationの許可へ流用しない。

現在のIdentity照合はFake ProviderとHost一時領域に対する境界であり、Path検査から削除までの敵対的な同時置換を完全に防ぐ証明ではない。実Provider Active Probeを実装する場合は、Provider process treeの終了確認後にcleanupし、Providerからtemporary parentへ到達できないOS Sandbox／ACLまたは同等境界を先に成立させて、cleanup競合を再評価する。

## 6. 非対象

- 外部Effectの実行または回復
- Remote Repository操作
- 複数Provider RoutingまたはRole交換
- Git以外のRepository Backend
- Raw Provider Logの保管
- 汎用Migrationまたは複数Protocol Reader
