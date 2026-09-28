# Phase 4 Workbench接続Surface検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-013`、`PPR-IT-002`
観測日時: 2026-09-27 19:54 JST
対象状態: Commit `a565fb7f`以降の未Commit変更候補。Phase 4全体の完了Evidenceではない。

## 結論

WorkbenchのRemote CROS接続SurfaceはPassした。Repository単体利用をCredentialなしで開始し、利用者が明示入力したEndpointとCredentialでRemote CROSへ接続できる。CredentialはWorkbench Process memoryだけに保持し、HTML、URL、Repositoryまたはlogへ保存・再表示しない。

接続後は明示Refreshし、Credential失効時には直前のPortfolioをCurrentとして表示しない。明示DisconnectではRemote接続、CredentialおよびPortfolioを破棄してRepository modeへ戻る。

## 成立した経路

```text
Repository mode
  ↓ 明示Connect（Endpoint + Credential）
Workbench Process memory
  ↓ Authorization header
Remote CROS
  ↓ 許可済みPortfolio
Workbench表示
  ├ 明示Refresh
  └ 明示Disconnect → Credential破棄 → Repository mode
```

## 自動検証

| Scenario | 結果 | Oracle |
|---|---|---|
| Repository単体起動 | Pass | Credentialなしで利用できる |
| Browser接続 | Pass | EndpointとCredentialの一回入力からRemote Projectionを取得する |
| Credential非再表示 | Pass | 生TokenをHTMLへ含めずpassword fieldも空で再描画する |
| 明示Refresh | Pass | 現在Credentialで再認証し現在Projectionを取得する |
| Credential失効 | Pass | 直前Portfolioを消去しRemote unavailableを表示する |
| 明示Disconnect | Pass | Process内CredentialとPortfolioを破棄してRepository modeへ戻る |
| Workbench回帰 | Pass | 8／8 Pass、失敗0 |
| Repository Checker | Pass（既知Error除外） | 1,886 files、1,096 Markdown、17,858 links、2,032 anchors、Warning 0。Error 1件は作業HEADと公開済みv0.21.0 tagの既知不一致 |

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/workbench/src/workbench-server.ts` | `0dfc361f734f3761ce8c4c270b8a6212c6b6133ea64a7ba5b726ba12f164685f` |
| `40_Develop/workbench/src/credential-administration.ts` | `6f43e0d1a3235cb75048745ed7b3f790098a480093e791f070b7f12ceeb9c74b` |
| `40_Develop/workbench/tests/integration/workbench-server.contract.test.ts` | `25e2e590a02469fc066ed9566e3080e45c2fd169564891cfb2d9b97bc1730d0e` |

## 限定

- MCP Consumerの接続設定入口を証明しない。
- Shared ServerのTLS終端、公開Host配置または運用設定を証明しない。
- OS Credential Storeへの永続保存は実装しない。Workbench終了後の自動再接続は現在のCapabilityではない。
- Host Recovery、AI依頼、Topic／Meeting CRUDまたはPhase 4全体の完了を証明しない。

## Checklist

- [x] Repository単体利用へCredentialを要求していない。
- [x] CredentialをURL、HTML、Repositoryまたはlogへ保存・再表示していない。
- [x] 接続成功前に候補CredentialをCurrent Connectionへ昇格していない。
- [x] 接続失敗または失効後に直前PortfolioをCurrent表示していない。
- [x] 明示DisconnectでProcess内Credentialを破棄した。
- [x] Credential管理SurfaceとConsumer接続Surfaceを別の責務として表示した。
- [x] MCP、TLS、Host RecoveryおよびAI依頼を成立済みと表示していない。
