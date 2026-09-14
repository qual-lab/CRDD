# REQ-000021の利用者体験分析

状態: Candidate
要求: `REQ-000021` Remote要求結果の同一Identity再取得
探索元: [Remote Project Context](../../../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)

## 1. なぜこの要求を体験として扱うのか

Remote要求の応答が消えた時、同じ操作を再実行すると二重Effectの危険がある。利用者は「失敗した」と推測するのでなく、元の要求へ戻って現在状態を確認できる必要がある。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Timeout後に同じ依頼を新規実行する | 同じRequest Identityから状態、結果、回復義務を再取得する |
| 応答喪失と処理失敗を同一視する | Effectの成立、結果搬送、観測不能を区別する |

## 3. UXへの処置

`UX-000008@1`「同一要求への再接続」とする。Retryボタンではなく、同じ要求の観測と安全な再入場を体験の中心に置く。

## 4. 重要場面、失敗、品質期待

- 切断後もRequest Identityを失わない。
- 状態不明を失敗や未実行へ畳まない。
- 再接続時に別・拡大Authorityを生成しない。
- Recoveryが必要なら対象と次の操作を一意に示す。

## 5. 下流への引き渡し

IAはRequest、Attempt、Result、DeliveryおよびRecoveryを関連付ける。SPEC／Architectureは冪等な照会と再入場を分け、System Testは切断を含むLifecycle全体を確認する。
