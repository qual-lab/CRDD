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

Probe containerは`create`で得たcontainer IDと全Security属性を起動前に照合し、同じIDだけを回収する。container不存在を確認できない場合はHost側のmount元を保持し、安全な`recovery-id`だけを返す。明示recoveryは同じIDと所有記録を再確認できたFake Probeだけを処置し、未知containerまたは一般Docker操作へ拡張しない。

Fake Provider Gateの合格は、DockerによるFilesystem／Credential Path／Network遮断の成立だけを示す。Provider endpoint限定Egress、公式CLIの導入・認証、自動更新／Telemetry、Session再開、timeout／cancelおよびprocess tree終了が確認されるまでは全体を`blocked`とし、実Operationへ進めない。

## Runtime 1.0の実行基盤

Runtime 1.0はWindows上のDocker DesktopとLinux containerだけを正式対象とする。WindowsネイティブProvider実行、Git Bash直接実行、通常WSLディストリビューション、別Container RuntimeまたはDockerなしのfallbackを互換性要件にしない。Provider CLIは後続で専用imageへ導入し、Host側のCodex／Claude設定またはCredentialを暗黙に再利用しない。

## 開発者確認

```shell
node --test tools/coordinator/tests/doctor.test.mjs
```

Runtime 1.0のその他のCLIは、成立性Gate、Protocol、状態不変条件および永続Storeが固定されるまで提供しない。
