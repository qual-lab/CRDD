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

### SPEC定義で保持する意味

SPEC定義では、前節までに示した対象、識別、関係、状態、可視性、責任および失敗時に保持する意味を、観測可能な契機・条件・結果へ変換する。実現方式、UI表現または試験手順は本分析で確定しない。

## 6. SPEC処置

| SPEC候補 | 処置 | 判断理由 |
|---|---|---|
| [SPEC-000030](../../Definitions/SPEC-000030/spec_definition.md) | New | 作成側の情報対象と状態を、記録Effectと観測可能な結果へ変換する |

## 7. UX観点との統合時に確認すること

情報を保存できるだけでなく、作成側が記録済み・未記録・結果不明を見分け、再発行と再観測を取り違えない結果にする。

## 未確認事項・人間判断・戻り条件

- 未確認事項: なし。
- 人間判断: 現在のCanonical範囲では追加判断なし。
- 戻り条件: 正式入力または処置判断に不足・競合が見つかった場合は、入力を所有する工程または本分析を再開する。

## 検証意図

分析で保持した成立・境界・失敗・判断不能を、Definition側で観測可能な契約へ変換できることを確認する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるIA Definitionを一件だけ特定した
- [x] 利用場面、Object、Identity、Relation、State、Visibilityおよび時間的意味を保持した
- [x] 入力、条件、状態、結果および開示境界を区別した
- [x] 導線、責任、Authorityおよび失敗時に保持する意味を評価した
- [x] SPEC候補への処置と理由を明示した
- [x] UX観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとSPECまたはIAへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] UX、UI、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] 実装StateまたはUI Presentationを先取りしていない
- [x] 補足分析へ必須情報を退避していない
