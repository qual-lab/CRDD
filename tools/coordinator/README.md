# Coordinator Runtime 1.0

Status: Implementation Candidate

`Coordinator Runtime`は、Codex Coordinator Agent、Claude Code Executorおよび独立Codex Reviewerを、CRDDのAuthority、固定改訂版、検証、ReviewおよびCurrent Decision Setへ接続するローカルWorkflow Runtimeである。

現在はExecution Environmentの成立性Gateを実装中であり、実Operation、Provider認証、Repository変更、push、mergeまたは外部Effectには使用できない。

## 制御境界

RuntimeがOperation状態、実効Authority、Repository Identity、Provider起動、Result検証、停止、再開および完了条件を所有する。Codex Coordinator Agentが返す計画、Packetまたは判断集合は候補であり、RuntimeによるProfile、Authority、CapabilityおよびIdentity照合なしに実行しない。

Runtime 1.0が許可する変更は、Operation専用の隔離workspace内のローカル差分だけである。Provider子プロセスへcommit、push、merge、tag、Releaseまたは一般外部Effectの能力を与えない。

詳細な脅威、主体別権限および停止条件は[`THREAT_MODEL.md`](THREAT_MODEL.md)を参照する。変更の判断と追跡は[`CHG-000015`](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)が所有する。

## 現在利用できるコマンド

```shell
node tools/coordinator/bin/coordinator.mjs doctor
node tools/coordinator/bin/coordinator.mjs doctor --json
node tools/coordinator/bin/coordinator.mjs doctor --isolation --json
node tools/coordinator/bin/coordinator.mjs doctor --recover-isolation <recovery-id> --json
```

`doctor`は受動事前診断（passive preflight）である。CLIをインストール、認証または起動せず、PATH上の候補、ローカルGit／Repository、Operation専用領域および未実装の隔離条件を列挙する。Providerの絶対Path、生出力またはVersion出力は保持しない。認証、Filesystem、Credential Store、EgressまたはProcess lifecycleの確認が未実装・未評価である限り非ゼロ終了し、後続Operationを開始しない。

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

Runtime 1.0の書込みOperationはDockerを唯一の正式Isolation Backendとし、Host、Git Bash、通常WSLまたは`local-restricted`へ縮退しない。`fake`は決定論的試験専用であり、実Provider、実Credentialまたは実送信先の利用許可にならない。現在はAuthority Grant VerifierのTrust Anchor Loaderと起動直前再確認、ProxyおよびCredential Brokerが未実装のため、Profile候補を作成できても全体Gateは`blocked`のままである。

Authority Grant Verifier Core候補は、Authority Registry候補を固定契約、Registry revision、UTC観測時刻、Grant集合およびSHA-256へ正規化する。Profile候補との照合では、Grantのactive状態、有効期間、Provider、要求Origin、Credential Grant参照、Operation ID、Scope IDおよびProfile Hashの完全一致を要求する。構造と内容の照合結果は`candidate`であり、自己申告Registryを信頼済み正本へ昇格させない。Runtime所有のTrust Anchor Loaderと、Provider起動直前の取消・置換・期限再確認が未実装であるため、Authority Capabilityは発行せず全体Gateを`blocked`に保つ。

過大なProfile／Registry入力、許可数を超えるGrant／Origin、長すぎる識別子／Origin、またはcanonical UTCでない評価時刻はAuthority候補にせず`blocked`へ閉じる。このCoreの上限は受理済みJavaScript値に対する追加の正規化、並べ替えおよびHash処理を制限するものであり、将来のTrust Anchor LoaderはファイルやTransportをJavaScript値へ展開する前にも読込みbyte上限を強制する。

## Provider Egress Proxy

Provider Egress ProxyのPolicy候補は、生Profileを内部Validatorで再検証し、そのValidatorが生成した正規ProfileとHashからだけ要求Originのhostnameを取り出す。呼出側が組み立てた検証結果、Hashまたは正規化済みと称するobjectは受理せず、Authority確認済みPolicyへも昇格しない。許可候補は`CONNECT`、完全一致hostnameおよび文字列として厳密なport `443`だけであり、通常HTTP method、wildcard、別表記のport、IP literal、userinfo、末尾dotまたは別hostnameを拒否する。

DNS結果は32／128 bitへ正規化し、固定したIANA IPv4／IPv6 Special-Purpose Address Registry snapshotを最長prefix一致で評価する。IPv6はさらにIANA IPv6 Global Unicast Address Spaceの`ALLOCATED` snapshotへ照合し、special-purpose規則で許可された範囲または明示的な割当範囲だけを候補にする。`Globally Reachable`が`true`でない登録、未割当／予約範囲、legacy compatible IPv6、site-local、multicast、判定不能なaddress、またはpublic addressに混在するspecial addressを拒否する。IPv4-mapped IPv6と`64:ff9b::/96`のNAT64 addressは埋込みIPv4へ還元して同じ規則を適用する。この判定とfixtureはRuntime ProxyによるDNS固定、TLSおよびsocket接続の実強制ではなく、実強制前は候補のままとする。

正式TopologyではProvider containerをOperation専用のinternal Docker Networkだけへ接続し、外部Networkへ直接接続しない。ProxyだけがOperation internal Networkと専用Egress Networkへ接続し、Docker socket、Host NetworkまたはHost fallbackを使用しない。現在はPolicy判定とTopology契約だけが実装済みで、Proxy process、Network作成、DNS／TLS実測およびAuthority Capability結合は未実装である。Docker Desktop local Linux Engineも現在確認できないため、`execution.egress`と全体Gateは`blocked`を維持する。

## 開発者確認

```shell
npm test --prefix tools/coordinator
```

Runtime 1.0のその他のCLIは、成立性Gate、Protocol、状態不変条件および永続Storeが固定されるまで提供しない。
