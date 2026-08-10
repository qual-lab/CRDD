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

Fake Provider隔離Probeは固定Digest image、read-only root filesystem、全Linux Capability削除、`no-new-privileges`、PID上限、非root UIDおよび`--network=none`を使用する。mount対象は`workspace/`、`provider-home/`、`tmp/`だけであり、`events/`、`projection/`、`management/`、通常User Home、Credential StoreおよびDocker socketを渡さない。Probe結果は許可領域の書込み、管理領域の非公開、Credential名の非継承、専用Home／tmpおよびNetwork遮断をすべて満たす場合だけ`confirmed`とする。Probe containerにはRuntime生成の一意な名前とownership labelを付ける。timeoutまたは失敗後も同じlabelを持つcontainerだけを回収し、所有を確認できないcontainerを削除しない。

このFake ProbeはProvider endpoint限定Egressを証明しない。`--network=none`は外部送信を遮断するが公式Providerを利用不能にするため、Provider用Egress allowlistが未実装である限り`execution.egress`は`blocked`のままとする。Fake Probeの合格をProvider認証、active probe、lifecycleまたは実Operationの許可へ流用しない。

現在のIdentity照合は、Providerを起動しない受動事前診断のcleanup境界である。Path検査から削除までの敵対的な同時置換を完全に防ぐ証明ではない。将来Active Probeを実装する場合は、Provider process treeの終了確認後にcleanupし、Providerからtemporary parentへ到達できないOS Sandbox／ACLまたは同等境界を先に成立させて、cleanup競合を再評価する。

## 6. 非対象

- 外部Effectの実行または回復
- Remote Repository操作
- 複数Provider RoutingまたはRole交換
- Git以外のRepository Backend
- Raw Provider Logの保管
- 汎用Migrationまたは複数Protocol Reader
