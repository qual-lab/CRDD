# CHG-000015 Agent／Architecture／Security Review

- 固定対象Commit: `c21b99a0024e136173e66f2b1e1a46971e34b999`
- 固定対象Tree: `ad3a2791760f16288e51b314b0f8a371dd2ebe70`
- 親Commit: `07f996189f8e0b54339c5307864dd7c06933d000`
- 共通入力: Coordinator `50 / 50 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0` / Warning `0`、diff／worktree clean
- 結果: `Pass`
- 未解決Finding: `0`

## 確認結果

`AG-EGRESS-002`と同根の`GCI-COORD-011`は解消した。IPv6 Special-Purposeの最長prefix一致を割当確認より先に評価し、`false`／空欄／`N/A`を再許可しない。Special-purpose非一致はIANA IPv6 Global Unicast Address Spaceの`ALLOCATED` 36 prefixだけを候補とし、未掲載、予約、`3ffe::/16`、未割当`2000::/3`、`4000::/3`以降を拒否する。

IPv4-mapped IPv6と`64:ff9b::/96`は埋込みIPv4をIPv4規則へ還元し、publicだけを候補とする。compatible IPv6は拒否する。生Profile内部検証、caller supplied Hash不流用、厳密な`host:443`、Policy候補とAuthority／Capabilityの分離に回帰はない。

## 未評価

実Proxy、Docker Network lifecycle、実DNS固定、DNS rebinding E2E、TLS／socket接続、Authority Verifier、Credential Broker、実Provider、実OperationおよびIANA将来更新は未評価である。これらは未実装であり、doctorと全体Gateは`blocked`を維持する。本PassはRuntime完成、利用許可、準拠、移行またはReleaseを意味しない。

新規候補4分類はすべて`0`。確信度は`High`。
