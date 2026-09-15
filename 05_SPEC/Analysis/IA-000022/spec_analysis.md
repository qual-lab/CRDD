# IA-000022のSPEC分析

成果物種別: SPEC分析（IA観点）
分析単位: `IA-000022`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000022 実行記録の作成・公開状態](../../../03_IA/Definitions/IA-000022/ia_definition.md)

UX、UIまたはREQを直接読んで不足を補完しない。

## 2. 利用場面ごとに保持する意味

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000032](../../../03_IA/Analysis/UX-000032/ia_analysis.md) | 実行基盤・アプリの組込み担当者／観測した事実を共有可能にする時 | 実行、情報源、観測、記録試行、公開結果、完成記録、回復先 | prepared／publishing／recorded／not_recorded／unknown | 観測→記録依頼→結果。unknownでは同じ実行と試行→再観測→確定状態 |

## 3. 対象・識別・関係

Execution ID、Source Identityと改訂版、Observation、Record Attempt、Publication Resultを別対象として保持する。記録試行はExecutionと作成側に結び、公開結果は完成記録、衝突先または回復先へ結ぶ。

## 4. 状態・可視性・時間的意味

`prepared`、`publishing`、`recorded`、`not_recorded`、`unknown`を区別する。要求受理、Effect発行、完成記録の確認を同一視せず、`unknown`を`not_recorded`へ丸めない。

## 5. 導線・責任・失敗時の保持

作成側は許可された最小事実を渡し、SystemはEffect前検査、不変公開、衝突再読取り、状態返却と資源回収を担う。途中失敗または結果不明でもExecution IDとAttempt IDを保持する。

### 制約

保存製品、API、ProcessまたはLock方式を固定しない。記録AuthorityをTask実行、評価採用または別Source変更へ広げない。秘密情報、生出力、不要な個人情報を診断へ複製しない。

### 下流へ保持する意味

記録対象、Authority、状態遷移、不変公開、並行衝突、再観測、終了後資源および情報境界をSPECへ渡す。

## 6. SPEC処置

| SPEC候補 | 処置 | 判断理由 |
|---|---|---|
| [SPEC-000030](../../Definitions/SPEC-000030/spec_definition.md) | New | 作成側の情報対象と状態を、記録Effectと観測可能な結果へ変換する |

## 7. UX観点との統合時に確認すること

情報を保存できるだけでなく、作成側が記録済み・未記録・結果不明を見分け、再発行と再観測を取り違えない結果にする。
