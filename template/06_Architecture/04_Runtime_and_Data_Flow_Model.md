# Runtime／Data Flowモデル

## 1. 対象と正本境界

## 2. 主要データフロー

```text
<<E1: 外部Actor>> -- {internal} 入力 --> (P1: 検証・変換)
(P1) -- {internal} 保存値 --> [(D1: Canonical Store)]
(P1) -- {authorized-result} 結果 --> <<E2: 許可された利用者>>
==== Trust／Process境界 ====
```

## 3. 横断状態遷移

```text
[開始] -- 受付 [入力有効] / Identity確定 --> [S1: ready]
[S1] -- 実行要求 [Authority有効] / Effect開始 --> [S2: running]
[S1] -x 実行要求 [Authority不明] / Effect 0
[S2] -- 完了観測 [終了条件成立] / cleanup --> [終了: completed]
```

| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |
|---|---|---|---|---|---|---|---|---|
| ready | | | | | | | | |

## 4. 概念Entity関係

```text
[ER1: Entity A] [1] -- R1: Bを持つ --> [0..*] [ER2: Entity B]
```

## 5. 整合条件

| 対象 | 必須の相関 | 禁止する畳み込み |
|---|---|---|
| | | |

## 6. Qualityへの引渡し

- 
