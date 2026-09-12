# CHG-000015 Document Audit

- 固定対象Commit: `c21b99a0024e136173e66f2b1e1a46971e34b999`
- 固定対象Tree: `ad3a2791760f16288e51b314b0f8a371dd2ebe70`
- 親Commit: `07f996189f8e0b54339c5307864dd7c06933d000`
- 共通入力: Coordinator `50 / 50 Pass`、Checker `143 / 143 Pass`、全体Checker Error `0` / Warning `0`、diff／worktree clean
- 結果: `Pass`
- 未解決Finding: `0`

## 確認結果

IANA Special-Purpose IPv4／IPv6の2025-10-09版、IPv6 Global Unicastの2025-10-10版、IPv6 Address Spaceの2025-10-23版を公式正本と照合した。`Status=ALLOCATED` 36 prefix、正本URL、採用列、確認日、3つの既定判定、正規化snapshot SHA-256の意味、55／36 entry件数、更新契機および非自動更新がREADME、Threat Model、CHG、コード、試験で一致する。

判定順序、Special-purpose優先、NAT64／mapped IPv6のIPv4還元、未割当／予約IPv6の拒否、Profile Identity結合、厳密なCONNECTの説明と実装に不整合はない。`07f9961`の監査結果は個別履歴として保持し、集合`Invalidated`・現在判定不流用である。

## 未評価

IANA raw dataから埋込み表を再生成する自動手段、実Proxy、Docker Network、DNS pinning、TLS／socket、Verifier、Broker、実Egress、実Provider、実Operationおよび現固定版Docker Probeは未評価である。Policy／Topologyは非規範の`candidate`で、全体Gateは`blocked`である。

51の全観点は`Pass`。新規候補4分類はすべて`0`。
