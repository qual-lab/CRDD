# Shared Server Production Boundary検証記録

Evidence種別: Verification Result
対象変更: `CHG-000082`
対象版: `v0.22.0`
観測日時: 2026-09-28 11:14 JST
結果: Passed

## 1. 結論

Shared Serverは、固定OS設定から検証済みRepositoryとWorkspace Exposureを構成し、外部TLS終端の後段にあるloopback限定GatewayからRESTとMCPを同じHTTPS Originへ公開する境界まで成立した。Requestごとの現在Credential検証、非開示、TLS終端情報の完全一致、Browser Originの一致、および終了時のGateway／内部Listener／Socket／Proxy Request回収を確認した。

公開証明書の発行・更新、Port 443の所有およびFirewallは配置先のTLS終端が所有する。今回の検証は実Internet／LANへの公開Effectを発行していないため、配置先固有の公開運用Evidenceには算入しない。

## 2. 成立した構造

```text
Remote Client
     │ HTTPS
     ▼
External TLS Terminator
     │ fixed x-forwarded-proto / host
     ▼
127.0.0.1 Shared Gateway
     ├─ /v1/... → CROS REST
     └─ /mcp    → MCP
```

| 境界 | 成立内容 |
|---|---|
| 公開Origin | RESTとMCPを一つの設定済みHTTPS Originへ配置 |
| TLS終端 | `x-forwarded-proto=https`と設定済みHostの完全一致。Browser `Origin`がある場合も完全一致 |
| 内部Listener | Gateway、CROS REST、MCPをすべてloopback限定に維持 |
| 運用設定 | OS管理の固定`shared-server.json`だけを読取り、任意Config Pathを受理しない |
| Trust Domain | 一Processを一Trust DomainとRuntime Rootへ固定し、Requestから切替しない |
| Repository | 絶対Pathかつ検証済みGit Rootだけを受理し、Project／Repository Identityは`PROJECT_CONTEXT.md`から取得 |
| Revision | Project Context内容Hashを使用し、Commit済み状態を起動条件にしない |
| Credential | OS管理Credential Registryを使用。空Registryでは起動せず、初期化／全喪失はHost限定Recoveryへ戻す |
| Secret | Token、Token Hash、証明書、秘密鍵を共有設定、argv、環境変数、Repository、Prompt、logへ置かない |
| 終了 | 親Processのstdin EOF、SIGINT／SIGTERMまたは明示closeを同じcleanup経路へ接続 |

## 3. 検証結果

| 対象 | コマンド／試験 | 結果 | 主な観測 |
|---|---|---|---|
| CROS | `npm run format:check` | Pass | 25 files、変更なし |
| CROS | `npm run typecheck` | Pass | TypeScript error 0 |
| CROS | `npm run lint` | Pass | Warning／Error 0 |
| CROS | `npm test` | Pass | 33／33 |
| MCP | `npm run format:check` | Pass | 25 files、変更なし |
| MCP | `npm run typecheck` | Pass | TypeScript error 0 |
| MCP | `npm run lint` | Pass | Warning／Error 0 |
| MCP | `npm test` | Pass | 46／46 |
| Project Operation | `npm test` | Pass | 18／18。Topic／Meetingを含むRepository Application境界を確認 |
| Workbench | `npm test` | Pass | 18／18。Remote CROS接続とCredential失効後の非表示を確認 |
| Version Control | Consumer Closure局所再試験 | Pass | Shared Config AdapterをRepository Locationの既知Consumerへ登録 |
| Machine Registry | Test Catalog／CROS symbol／MCP symbol JSON parse | Pass | Parse error 0 |

専用試験は次の三件である。

- `cros:integration:shared-server-config`
  - 固定OS設定、検証済みRoot、Project Context Identity、Workspace Exposure、平文Origin拒否を確認した。
- `mcp:integration:cros-shared-server`
  - REST／MCP同一Origin、TLS終端Header、Origin拒否、許可済みProjection、Credential非表示、終了後Listener 0を確認した。
- `mcp:system:cros-shared-server-entry`
  - 配布入口`crdd-cros-server.ts --serve`を固定設定から起動し、親Process stdin EOF後にexit 0とListener不存在を確認した。

## 4. 反証した失敗

| 失敗仮説 | 結果 |
|---|---|
| 平文HTTP OriginでもShared Serverが起動する | 起動前に拒否 |
| Repository subdirectoryをRootとして利用する | 起動前に拒否 |
| TLS終端Headerなしで内部Gatewayへ到達できる | 421で拒否、Token非表示 |
| 別OriginからBrowser Requestを送れる | 403で拒否、Repository／Workspace／Credential非開示 |
| RESTとMCPが別Originまたは別Access Contextになる | 同じGateway Originと現在Credentialから同じ許可Repositoryを確認 |
| close後もListenerまたはSocketが残る | 接続拒否と資源集合0を確認 |

## 5. 未確認範囲

- 実Internet／LANでの公開、証明書発行・更新およびReverse Proxy製品固有設定は未実施である。
- 一Processで複数Trust Domainをrouteする多Tenant構成はv0.22対象外であり、必要な場合はProcess／Runtime Root／OS Accountを分ける。
- TLS終端が受信Forwarded Headerを確定値で上書きすることは配置先運用の受入条件であり、本Repositoryの自動試験は特定Proxy製品を起動しない。
- 実Providerを使用するWorkbench AI助言／変更候補E2Eは別の残存項目であり、本Evidenceでは成立を主張しない。

## Checklist

- [x] RESTとMCPの同一Originを確認した。
- [x] TLS終端HeaderとBrowser Originの拒否を確認した。
- [x] RequestごとのCredential検証と許可済みProjectionだけの公開を確認した。
- [x] 固定OS設定と検証済みRepository Rootを確認した。
- [x] Secretが共有設定、argv、環境変数、Repositoryまたは出力へ入らないことを確認した。
- [x] Server停止後のListener／Socket／Proxy Request不存在を確認した。
- [x] 外部公開を未実施のまま実公開Evidenceへ読み替えていない。
