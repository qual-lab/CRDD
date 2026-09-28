# Phase 4 Remote Project Context MCP検証記録

## 結論

CROS Connection CredentialをRequestごとに検証し、そのCredentialのWorkspace集合から解決したPortfolioだけをProject Context MCPへ渡すComposition Rootを実装した。MCP専用の固定Bearerを重ねず、Repository単体利用では引き続きCROS Credentialを要求しない。

## 成立した境界

| 境界 | 結果 | 根拠 |
|---|---|---|
| Bearer HTTP → Credential | PASS | Requestごとに現在Registryを照合し、不正Tokenを401へ閉じた |
| Credential → Workspace Exposure | PASS | Developer Credentialからdevelopmentだけを解決した |
| Exposure → Portfolio | PASS | DEV SourceだけをMCP Handlerへ固定し、MGMT Sourceを搬送しなかった |
| Portfolio → MCP | PASS | `crdd.get_project_context`が五場面と許可Sourceだけを返した |
| Tool公開範囲 | PASS | Remote Project Context構成ではProject Runtime Toolを追加しない |
| Cleanup | PASS | Server終了後にlistenerと所有Connectionを残さなかった |

## 実行結果

```text
対象: 40_Develop/mcp
実行: npm.cmd test
結果: 38 passed / 0 failed

内訳:
- format: PASS
- typecheck: PASS
- lint: PASS
- CROS Credential → Project Context MCP HTTP IT: PASS
```

## 残る範囲

- 実装Listenerはloopback限定である。Shared Serverの外部公開にはTLS終端、配置、Secret投入および運用回復を別に成立させる。
- Topic／Meeting CRUD、AI依頼およびHost RecoveryはこのProject Context読取り境界へ混在させない。

## Checklist

- [x] MCP専用の固定BearerをCROS Credentialへ重ねていない
- [x] Requestごとに現在Credentialを検証した
- [x] systemAdminからContent Accessを生成していない
- [x] Grant外RepositoryのIdentityを応答へ含めていない
- [x] Repository単体MCPのCredential不要契約を維持した
- [x] Formatter、型、Lintおよび全MCP試験を完了した
- [ ] OPEN: Shared Server用TLS配置と運用設定入口は後続Phaseで成立確認する
