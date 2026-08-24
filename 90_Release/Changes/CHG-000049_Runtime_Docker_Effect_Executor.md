# 変更トレース: Runtime Docker Effect Executor

- 変更ID: `CHG-000049`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: Claude prepared planのexact 9 commandだけを実行・終了・回収するWindows Docker Effect adapter
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Docker Effect Runtime revision 1とProcess Controller revision 5）
- 移行要否: `migration_required: false`（発行済みproduction OperationとDocker Effectは0。永続Schemaを変更しない）
- 関連正本: [`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`CHG-000048`](CHG-000048_Runtime_Docker_Recovery_Connection.md)

## 結論

Runtime-owned Claude Adapterが生成したopaque prepared planのexact 9 commandだけを、承認済みDocker CLIと固定Docker Desktop Linux Engineへ接続した。任意argv、shell、PATH探索、親process環境、caller supplied Docker endpointまたはcaller supplied cleanup名は受理しない。

Docker CLIは固定絶対Path、byte長`41631088`およびSHA-256 `C8EAA01D1E78CAECD65D730E670CBFE4DFCE006E1C6F18167C003587CB4BB610`を開始時と各command前に再確認する。`--config`はOperation management配下のRuntime所有空directoryへ固定し、Environmentは`SystemRoot`、`WINDIR`、`SystemDrive`およびRuntime固定のCLI hint設定だけへ置換する。

## 代表例と境界

- 発火例: 同じOperation、Selection、Provider Home mount source、固定image digest、Proxy token、model／effortおよび所有名を持つ9 command完全一致だけを順次起動する。
- 非発火例: commandのplain copy、順序／引数差、未知model、別image、別mount、偽造management Capability、Docker CLI差替え、PATH fallbackまたは親環境追加はprocessを開始しない。
- 境界例: timeout、取消または出力上限時は固定`taskkill.exe`へ起動済みDocker CLIのexact PID、tree、forceだけを渡し、close後もcontainer／networkを別に回収する。
- 判定情報不足例: resource照会、所有label、process tree終了、config residueまたは不存在再確認が不明ならMount leaseとRecoveryを完了しない。

## Security invariant

- Effect executorはRecovery開始後にだけProcess Controllerから到達する。
- Provider containerはinternal networkだけ、Proxyだけがinternalとegress networkの二つへ接続される固定planを再構成して完全一致させる。
- container／networkはexact nameで列挙し、`crdd.coordinator.runtime` labelが一致する場合だけ削除する。foreignまたは不明なresourceを推測削除しない。
- cleanup後にexact nameの不存在を再照合し、Runtime所有Docker configの残存が0である場合だけconfigを削除する。
- stdout／stderr、Docker argv、Provider Home Path、Proxy tokenおよびHost Pathを公開Resultへ含めない。

## 現在の検証結果と残件

固定plan、固定CLI／Engine／Environment、plain copy拒否、全不存在cleanup、foreign label停止およびconfig residue停止の契約試験を追加した。基準Node.js v24.19.0でEffect／Process Controllerを含む対象27試験、strict source／test typecheck、Biome lint／formatを通過した。Docker Effect Runtimeの対象coverageはline 71.14%、branch 78.87%、function 63.64%である。未到達は固定Windows CLIの実Filesystem観測、実process／taskkillと防御失敗分岐であり、component契約試験のfake結果へ置換せず、実Docker E2Eで別途確認する。

Provider Eligibilityと有効化済みAuthority sourceが未接続のため、通常production入口はprepared plan発行前に`blocked`である。残件はこれらの接続、実Docker timeout／cancel／cleanup、実Claude production E2E、Codex Adapter、独立レビュー／監査およびPRである。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
