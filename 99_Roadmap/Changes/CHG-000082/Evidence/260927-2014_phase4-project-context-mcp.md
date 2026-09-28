# Phase 4 Project Context MCP 検証記録

## 結論

Repository単体の`PROJECT_CONTEXT.md`とCROSの許可済みPortfolio Projectionを、同じMCP Project Context Adapterへ渡せる契約を実装した。Repository単体ではCredentialを要求せず、`crdd.list_projects`と`crdd.get_project_context`から現在投影を取得できる。Project Runtime状態は`crdd.get_project_runtime_state`へ分離したままである。

## 成立した境界

| 境界 | 結果 | 根拠 |
|---|---|---|
| Transport → Application | PASS | Transportは`McpRequestHandler`だけへ依存し、Tool固有処理を持たない |
| Application → Project Context | PASS | Tool一覧とRoutingをApplication Adapterが所有する |
| Repository単体 | PASS | 配布CLIから実`PROJECT_CONTEXT.md`の五場面を取得した |
| CROS Federation入力 | PASS | Adapter単体試験で`PortfolioProjection`のcomplete／partial Sourceを保持した |
| 非開示 | PASS | 未提供Projectを一律`project_context_not_available`へ閉じ、Repository Identityを返さなかった |
| Runtime状態との分離 | PASS | Project Context応答へ`requestId`等のRuntime DTOを混入しない |

## 実行結果

```text
対象: 40_Develop/mcp
実行: npm.cmd test
結果: 37 passed / 0 failed
内訳:
- format: PASS
- typecheck: PASS
- lint: PASS
- unit / integration / system: PASS
```

配布入口のSystem試験では、子Processのstdinを応答受領まで保持した。要求送信直後のEOFは親Process喪失として取消される既存契約であり、非同期File読取りを通すために取消契約を弱めていない。

## 残る範囲

- CROS Shared ServerのRemote MCP Composition Rootは未実装である。Project Context Adapterは許可済み`PortfolioProjection`を受け取れるため、後続実装ではCROS Credential／Workspace Grantを処置したProjectionだけを接続する。
- 対話時の追加推論はMCP投影へ保存せず、Front AIが事実・保存済み分析と区別して生成する。

## Checklist

- [x] Repository単体利用へCROS Credentialを要求していない
- [x] Project ContextとProject Runtime状態を別Tool・別DTOにした
- [x] 五場面を補完・要約し直さず搬送した
- [x] 未提供Projectから非開示Sourceの存在を推測できない
- [x] Transportと専門Adapterを分離した
- [x] Formatter、型、Lint、単体・結合・System試験を完了した
- [ ] OPEN: Remote CROS MCPのCredential認証とComposition Rootは後続Phase 4で接続する
