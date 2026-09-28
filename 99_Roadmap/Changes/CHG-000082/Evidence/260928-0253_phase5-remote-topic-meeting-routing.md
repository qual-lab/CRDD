# Phase 5 — Remote CROS Topic／Meeting Routing

検証日時: 2026-09-28 02:53 JST
対象変更: `CHG-000082`

## 結論

Remote CROS MCPでTopic／Meetingの全Toolに対象`repositoryId`を必須化し、RequestごとのCredential、Workspace Grant、Exposure Registry revision、Repository revisionおよびBindingを再検証してから、許可済みRepositoryの共通Project Operation Applicationへ一回だけRoutingする境界を成立させた。

```text
Bearer Credential
      ↓ requestごとに再認証
Workspace Grant
      ↓
Repository Exposure + Revision
      ↓
Repository Binding
      ↓
Topic／Meeting Application
      ↓
Canonical Markdown Effect
```

## 成立した境界

- Repository単体Toolは従来どおり暗黙の現在Repositoryを使用する。
- Remote CROS Tool Definitionだけが全Topic／Meeting Callへ`repositoryId`を必須化する。
- `repositoryId`はRouting TargetでありAuthorityではない。
- Grant外、Exposure外、改訂不一致、未登録およびBinding不在は同じ`Invalid params`で非開示拒否する。
- 許可後は`repositoryId`を除去し、Repository単体と同じTopic／Meeting Adapterへ縮約する。
- 別Repositoryへの暗黙Fallbackを行わない。

## 検証結果

| 検証 | 結果 |
|---|---|
| MCP format／typecheck／lint | Pass |
| `cros-project-context-mcp.integration.test.ts` | 2件Pass |
| 許可済みDEV RepositoryへのTopic登録 | `record_created`、Revision 1を実Filesystemで観測 |
| Grant外MGMT Repositoryへの同一要求 | `Invalid params`、Repository／Workspace非開示、Effect 0 |
| 外部Provider Effect | 0 |

## 残る境界

- Cross-Repository Owner Relation操作は、参照先RepositoryのAuthorityと複数正本Effectを別契約で扱う必要がある。
- Shared Serverの外部公開にはTLS配置と運用設定入口が必要である。

## Checklist

- [x] Target IdentityとContent Authorityを分けた
- [x] RequestごとにCredentialとExposureを再検証した
- [x] Repository Revision不一致を許可しない
- [x] Grant外Repositoryの存在を開示しない
- [x] Repository単体の共通Application契約を再利用した
- [x] 許可／拒否の実Filesystem Effectを確認した
