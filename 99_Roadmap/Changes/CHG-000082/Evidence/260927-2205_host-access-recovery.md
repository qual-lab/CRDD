# Host Access Recovery局所検証

## 結論

CROSの全管理Credential喪失時に、Remote入口を使わずHost対話CLIからAccessだけを再構成する経路を成立させた。表示済み計画のRecovery IDを人間が完全一致で確認した場合だけ、対象Credential失効とContent GrantなしのBootstrap管理Credential発行を一つのRegistry revisionで確定する。

## 成立した境界

```text
Host Authority
  ↓
Recovery Plan（対象／保持／Product Data Effect 0）
  ↓ exact Recovery ID確認
prepare Event
  ↓
Credential Registry 1 revision更新
  ↓
settle Event
  ↓
Bootstrap管理Credentialを一度表示
```

- `administrator_recovery`は未失効の管理Credentialだけを失効し、通常Credentialを保持する。
- `full_access_reset`は全未失効Credentialを対象とする。
- Registry revisionまたは対象集合が変化した古い計画はEffect 0で拒否する。
- prepare／settle EventはOS管理Runtime Rootへ不変記録し、生Token、salt、VerifierおよびProduct Dataを含めない。
- settle記録を確認できない場合はTokenを公開せず、`recovery_required`として終了する。

## 検証

```text
cd 40_Develop/cros
npm.cmd test
```

結果: Formatter、TypeScript型検査、Warningを失敗とするLintおよび29試験が成功した。

主な観測:

- Administrator Recoveryで旧Adminだけが失効し、Developer Credentialは継続利用できた。
- Full Access Resetは明示確認前にEffect 0となった。
- File RegistryとFile Recovery Recorderを同じTrust Domain Rootへ接続し、二つの不変Eventと新管理Credentialを再観測できた。
- Host CLIは計画と完了結果を順に表示し、exit 0、新管理Credential一件、Content Grant 0で終了した。

## 未成立

- Shared ServerのTLS配置と運用設定入口。
- Remote CROS経由のTopic／Meeting書込みRouting。
- AI Profile設定とAI依頼Surface。
