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
```

`doctor`はCLIをインストールまたは認証せず、現在の環境でProvider隔離Gateを成立させられるかを診断する。Gateが成立しない場合は非ゼロ終了し、後続Operationを開始しない。

## 開発者確認

```shell
node --test tools/coordinator/tests/doctor.test.mjs
```

Runtime 1.0のその他のCLIは、成立性Gate、Protocol、状態不変条件および永続Storeが固定されるまで提供しない。
