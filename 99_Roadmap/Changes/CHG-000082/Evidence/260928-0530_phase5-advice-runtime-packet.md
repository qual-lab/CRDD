# Phase 5 読取り助言Runtime Packet確認

## 結論

Workbench読取り助言のExecutor Coreから署名Provider Runtimeへ渡す入力を、Repository非共有の一回消費Packetとして固定した。

この確認で成立した範囲は、Packet発行、Owner照合、一回消費、未使用取消、Provider Command完全性Hashおよび共有境界のEffect前拒否である。Docker Process、Provider通信および外部AI送信は実行していない。

## 確認した境界

```text
Workbench Advice Execution Plan
        ↓
Provider Command Plan
        ↓
ADVICEPKT-*
├ Operation ID
├ Profile ID
├ Task / Projection Hash
├ Provider Command Hash
├ Provider Prompt
└ Repository / Workspace / Tool / Session = false
        ↓
署名Provider Runtime Adapter（次の実装対象）
```

## 実行結果

| 確認 | 結果 | 内容 |
|---|---|---|
| Packet局所試験 | Pass | 6件。正常消費、再利用拒否、別Owner拒否、未使用取消、Workspace要求拒否、発行後のCommand入力変更からの分離 |
| Coordinator型検査 | Pass | strict sourceおよびtest TypeScript構成 |
| Formatter／Lint | Pass | 追加SourceとTestに対するBiome確認 |
| Provider Effect | 未実施 | 外部送信AuthorityおよびProvider通信を発行していない |
| Docker lifecycle | 未接続 | `workbench_advice`第三モードへの接続は次の対象 |
| 署名 | 未実施 | 固定候補前のため再署名していない |

## 保持した未成立範囲

- Provider HomeとSubscription認証の再利用
- 限定Egress付きDocker Processの開始と完了観測
- 取消後のProcess tree／Container／Network cleanup
- 実Provider出力の署名Runtime経由受理
- Codex／Claude双方の実境界E2E

## Checklist

- [x] 一回消費Capabilityを再利用できない
- [x] Packet参照文字列だけではPromptを取得できない
- [x] 別Owner Capabilityで消費できない
- [x] 未使用PacketをEffect 0で取消できる
- [x] 発行後に呼出し側がCommand配列・環境変数を変更してもPacket内容が変化しない
- [x] Repository／Workspace共有を要求するCommandを発行前に拒否する
- [x] Packet発行をProvider Effect成立と表示しない
- [x] 未接続のDocker lifecycleと実Provider E2Eを未成立のまま記録した
