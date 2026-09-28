# Phase 4 Remote CROS Transport検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-013`、`PPR-IT-002`
観測日時: 2026-09-27 19:39 JST
対象状態: Commit `a565fb7f`以降の未Commit変更候補。Phase 4全体の完了Evidenceではない。

## 結論

Remote CROS Transport CoreはPassした。有効なBearer CredentialをRequestごとに現在Registryへ照合し、現在Credentialの明示Workspace集合とExposure Snapshotから許可されたRepositoryだけをProject／Portfolio Projectionとして返す。

Credential Registry revisionとExposure Registry revisionは別の値として扱う。外部Hostへの平文HTTPではBearer Tokenを送信せず、Server側の平文HTTP Listenerはloopbackだけに限定する。

## 成立した経路

```text
Remote Consumer
  ↓ Bearer Credential
loopback HTTP / TLS終端後の内部境界
  ↓ Requestごとに現在Recordを照合
Credential Registry
  ↓ workspaceIds[]
Exposure Snapshot（別revision）
  ↓
許可済みRepository
  ↓
Portfolio Projection
```

## 自動検証

| Scenario | 結果 | Oracle |
|---|---|---|
| 有効Developer Credential | Pass | Development WorkspaceのRepositoryだけを返す |
| Management Repository | Pass | Developer ResponseへIdentity、件数、欠落枠を表示しない |
| 無効Bearer | Pass | HTTP 401の共通理由だけを返しCredential状態を開示しない |
| Credential／Exposure revision | Pass | 異なるrevision空間を分けたまま解決する |
| 外部平文HTTP | Pass | Network Effect前に拒否する |
| loopback HTTP | Pass | Local Transport試験として許可する |
| Listener cleanup | Pass | close後の再接続を拒否する |

```text
cros
tests 24 / pass 24 / fail 0

workbench
tests 7 / pass 7 / fail 0

checker
files 1,886 / markdown 1,096 / links 17,858 / anchors 2,032
warnings 0
expected error 1: stable-release-tag-identity-mismatch
```

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/cros/src/remote-transport.ts` | `cec700eaa466450427df055ae101cf407196c47dd69b2c9438556396979eeca2` |
| `40_Develop/cros/src/runtime.ts` | `50609adb5bc13cd515fdd105f93fb24ce8a1ddef6eb0d5ded15244960ce3fa68` |
| `40_Develop/cros/src/connection-credential.ts` | `febba1359506eebefac3698b67acc8a180f83cd4b248eba35288ac2d3842cd91` |
| `40_Develop/cros/tests/integration/remote-transport.contract.test.ts` | `fcf8bfca508a4b3d438172e8040f91668eb95ba30d894cf0eb07eda846254c9f` |

## 限定

- Shared ServerのTLS終端、公開Host配置および運用設定は未成立である。外部Interfaceへ平文HTTP Serverを公開しない。
- Workbench／MCPがEndpointとCredentialを設定・保存して本Transportを利用するProduction入口は未成立である。
- Host Recovery、AI依頼、Topic／Meeting CRUDおよびPhase 4全体の完了を証明しない。

## Checklist

- [x] CredentialとExposureのRegistry revisionを同一視していない。
- [x] Requestごとに現在Credentialを再検証した。
- [x] `systemAdmin`からContent Accessを生成していない。
- [x] Grant外RepositoryのIdentity、存在、件数または欠落枠を返していない。
- [x] Bearer TokenをResponse、Evidence、Project Contextまたはlogへ保存していない。
- [x] 外部平文HTTPへのBearer送信をEffect前に拒否した。
- [x] Shared Server TLS配置とConsumer設定入口を成立済みと表示していない。
