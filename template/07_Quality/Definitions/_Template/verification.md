# 検証定義

成果物種別: Quality定義
検証目標: `<何を成立したと確認するか>`
主な試験段階: `<Unit／Integration／System／Acceptance>`
状態: Draft
維持責任者: `<担当責任者>`

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 対応Local Item |
|---|---|---|
| `../../../<工程>/Definitions/<ID>/<definition>.md` | `<このSource固有の成立条件。共通目標名へ置換しない>` | `<本文内Local IDを一つ以上>` |

### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| `../../../06_Architecture/Details/<area>/01_Architecture.md` | `<境界、状態、故障、観測、終了後条件>` |

Sourceと詳細設計領域は、Quality Analysis Mappingに宣言した関係集合と完全一致させる。Source固有条件は空白差を除いて同じ文面を保ち、`検証目標 → Local Item`の組も完全一致させる。Source、検証目標、Local Itemまたは詳細設計領域を別の説明で重複登録しない。

## 2. 事前条件

- `<対象、環境、入力、Authority、隔離条件>`

## 3. 検証項目

| Local ID | 分類 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
|---|---|---|---|---|---|---|
| `OBJ-01` | 正常 | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |
| `OBJ-02` | 準正常／境界 | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |
| `OBJ-03` | 異常／判定不能 | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |

Local IDは本Definition内でSource固有条件とEvidenceを対応させるための識別子であり、CRDD全体の安定コンテキストIDではない。

7軸はすべて記載する。定型操作を持たないレビューや評価でも、事前状態／入力、観測と期待結果、終了後条件および実行形態を空欄にしない。実行形態は`Automated`、`Manual`、`Hybrid`から選び、試験段階または担当観点を混在させない。

## 4. 評価

- Pass: `<必要な観測と終了後条件がすべて成立>`
- Fail: `<成立条件に反する観測>`
- Blocked: `<必要な観測またはAuthorityが不足>`
- Not Run: `<未実行。Passに読み替えない>`

実行結果は本Definitionへ書き込まず、対象のCHGまたはReleaseの`Evidence/`へ記録する。

## 5. 根拠と限界

- 対象改訂版、実行条件、観測手段および必要なEvidenceを示す。
- 未観測範囲と残存Riskを示す。
- 既存Source／Testとの対応は、Canonical設計の固定後にReality Auditで扱う。
- PT／LTは、人間が対象、環境、上限、費用／Credit、中止条件およびcleanupを明示した場合だけ実行する。
