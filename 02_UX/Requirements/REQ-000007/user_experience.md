# REQ-000007の利用者体験分析

状態: Candidate
要求: `REQ-000007` 出典と不完全性を保つProject View
探索元: [Project状態理解](../../../01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md)

## 1. なぜこの要求を体験として扱うのか

Projectの要約が短くても、どのSourceをいつ読んだ結果か分からなければ判断には使えない。欠測や古い観測を隠した見やすさは、利用者を誤った確信へ導く。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| 複数文書とlogを辿り、現在地を自分で合成する | Project Viewから現在地、根拠、観測時点および不足を同時に理解する |
| 要約が完全かどうかを推測する | `missing`、`restricted`、`stale`、`conflicting`を識別する |

## 3. UXへの処置

`UX-000002@1`「根拠付きProject View」の中核要求とする。同じ課題をより少ない再探索で解けるかを確かめる`UX-000006@1`「Workbench比較価値」にも接続する。

## 4. 重要場面、失敗、品質期待

- 結論からSource、Revision、Observed Atへ戻れる。
- 一部取得成功を完全なProject状態へ畳まない。
- 制限されたSourceの存在を開示できない場合、その件数や名称も漏らさない。
- 要約だけで判断できない時は、正本へ進む経路が分かる。

## 5. 下流への引き渡し

IAはPropertyごとのSource、現行性、Coverageおよび競合を表現する。UIは不完全性を0件や正常状態と同じ見た目にせず、Verificationは完全性を崩す反例を使う。
