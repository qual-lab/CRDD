# Phase 4 Workbench Remote接続検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-013`、`PPR-IT-002`
観測日時: 2026-09-27 19:45 JST
対象状態: Commit `a565fb7f`以降の未Commit変更候補。Phase 4全体の完了Evidenceではない。

## 結論

WorkbenchからRemote CROS Portfolioを取得するApplication接続はPassした。EndpointとCredentialはWorkbench Processの接続中だけ保持し、Repository、Project Context、HTML、Health結果またはlogへ保存・表示しない。

明示RefreshではRemote側がCredentialを再検証する。Credential失効後にRefreshした場合、直前PortfolioをCurrentとして表示せず、`Remote CROS unavailable`へ遷移する。Repository単体利用は引き続きCredential不要である。

## 自動検証

| Scenario | 結果 | Oracle |
|---|---|---|
| Remote起動時接続 | Pass | 有効Credentialで許可Portfolioを表示 |
| Credential秘密値 | Pass | HTMLとHealth Responseへ不存在 |
| 明示Refresh | Pass | 起動時操作Tokenを要求しRemoteへ一回だけ再取得 |
| Credential失効後Refresh | Pass | Remote unavailableへ遷移し直前PortfolioをCurrent表示しない |
| Repository mode | Pass | Credential不要、既存Health Contractを維持 |
| 終了後状態 | Pass | WorkbenchとRemote CROSのListener／Connectionを残さない |

```text
workbench
tests 8 / pass 8 / fail 0

cros
tests 24 / pass 24 / fail 0
```

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/workbench/src/workbench-server.ts` | `27be5a59e930999352e14589fe39f5e32c7f3ac4eef97225f97dd3d550af2a0d` |
| `40_Develop/workbench/tests/integration/workbench-server.contract.test.ts` | `fbb9cdeeaf464f8c37c62c91eeb3e9bf753686a8154bb24225e6e9b13dd3c088` |

## 限定

- 現在のProduction CLIはEndpointとCredentialを安全に入力するSurfaceをまだ提供しない。APIへ明示構成した接続経路だけを検証した。
- Shared Server TLS配置、MCP接続設定、Host RecoveryおよびAI依頼は未成立である。
- 接続CredentialのOS Credential Store永続化はWorkbenchの責務に含めていない。

## Checklist

- [x] Repository単体利用へCredentialを要求していない。
- [x] CredentialをRepository、Project Context、HTML、Health結果またはlogへ保存していない。
- [x] RefreshごとにRemote側で現在Credentialを検証した。
- [x] 失効後の直前ProjectionをCurrent表示していない。
- [x] Remote接続失敗をRepository modeへ畳んでいない。
- [x] 未実装の設定Surface、TLS配置、Host RecoveryまたはAI依頼を成立済みと表示していない。
