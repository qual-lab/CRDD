# 境界／Interfaceモデル

## 1. 対象と正本境界

## 2. 境界表

| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |
|---|---|---|---|---|---|
| | | | | | |

## 3. 型とPortの関係

```text
interface ExecutionPort { +execute(request): Result }
ExecutionPort <|.. ExecutionAdapter
ExecutionAdapter --> ApplicationCore : uses [1]
```

## 4. 主要なブロック間シーケンス

（Identity、Authority、Effect、結果、cleanupの順序をplain textで示す。）

## 5. Schema責務

| 情報 | Canonical Owner | Writer | Reader | 所有禁止 | 物理Schema参照 |
|---|---|---|---|---|---|
| （情報名） | | 現在責務の外側／限定Writer | | | |

## 6. Qualityへの引渡し

- 
