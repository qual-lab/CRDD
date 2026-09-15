# QA-XXXXXX <Quality Contract Name>

成果物種別: Quality定義
Quality ID: `QA-XXXXXX`
検証目標: `<何を成立したと確認するか>`
主な試験段階: `<Unit／Integration／System／Acceptance>`
状態: Draft
維持責任者: `<担当責任者>`

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| `../../../<工程>/Definitions/<ID>/<definition>.md` | `<このSource固有の成立条件。共通目標名へ置換しない>` | `<UT／IT／ST／UAT>` | `<各試験段階を満たす本文内Local ID>` |

### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| `../../../06_Architecture/Details/<area>/01_Architecture.md` | `<境界、状態、故障、観測、終了後条件>` |

Sourceと詳細設計領域は、Quality Analysis Mappingに宣言した関係集合と完全一致させる。Source固有条件と試験段階は同じ内容を保ち、各試験段階を同じ段階のLocal Itemへ接続する。`検証目標 → Local Item`の組も完全一致させる。Source、検証目標、Local Itemまたは詳細設計領域を別の説明で重複登録しない。

## 2. 事前条件

- `<対象、環境、入力、Authority、隔離条件>`

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
|---|---|---|---|---|
| UT | `<Required／Conditional／N/A>` | `<最小責務>` | `<N/A／Direct Boundary>` | `<理由>` |
| IT | `<Required／Conditional／N/A>` | `<部品・境界・状態伝播>` | `<N/A／Direct Boundary／Adjacent 1 Block／Related 2 Blocks>` | `<理由>` |
| ST | `<Required／Conditional／N/A>` | `<Systemとしての成立>` | `<N/A／System/E2E>` | `<理由>` |
| UAT | `<Required／Conditional／N/A>` | `<利用目的への適合>` | `<N/A／User Acceptance>` | `<理由>` |

`Required`には同じ試験段階のLocal Itemを一件以上持たせ、`N/A`には同じ試験段階のLocal Itemを置かない。外部境界の到達範囲は同じ試験段階で必要な最大範囲とし、Local Itemはその範囲を越えない。`N/A`も理由を必須とする。外部境界を持つ目標では、下位の直接境界を省略して最終E2Eだけを設計しない。

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
|---|---|---|---|---|---|---|---|---|---|---|
| `OBJ-01` | 正常 | `<UT／IT／ST／UAT>` | `<Functional／Contract／Recovery等>` | `<対象責務・境界。N/Aなら理由>` | `<N/A／Direct Boundary／Adjacent 1 Block／Related 2 Blocks／System/E2E／User Acceptance>` | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |
| `OBJ-02` | 準正常／境界 | `<UT／IT／ST／UAT>` | `<種別>` | `<対象責務・境界>` | `<段階>` | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |
| `OBJ-03` | 異常／判定不能 | `<UT／IT／ST／UAT>` | `<種別>` | `<対象責務・境界>` | `<段階>` | `<入力>` | `<操作>` | `<期待>` | `<終了後>` | `Automated／Manual／Hybrid` |

Local IDは本Definition内でSource固有条件とEvidenceを対応させるための識別子であり、CRDD全体の安定コンテキストIDではない。

11軸はすべて記載する。定型操作を持たないレビューや評価でも、対象／境界、事前状態／入力、観測と期待結果、終了後条件および実行形態を空欄にしない。一つのLocal Itemに複数段階が必要なら、段階ごとの観測境界と合格条件が独立するようLocal Itemを分ける。実行形態は`Automated`、`Manual`、`Hybrid`から選び、試験段階または担当観点を混在させない。

## 5. 評価

- Pass: `<必要な観測と終了後条件がすべて成立>`
- Fail: `<成立条件に反する観測>`
- Blocked: `<必要な観測またはAuthorityが不足>`
- Not Run: `<未実行。Passに読み替えない>`

実行結果は本Definitionへ書き込まず、対象のCHGまたはReleaseの`Evidence/`へ記録する。

## 6. 根拠と限界

- 対象改訂版、実行条件、観測手段および必要なEvidenceを示す。
- 未観測範囲と残存Riskを示す。
- 既存Source／Testとの対応は、Canonical設計の固定後にReality Auditで扱う。
- PT／LTは、人間が対象、環境、上限、費用／Credit、中止条件およびcleanupを明示した場合だけ実行する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | `<Required／Conditional／N/A>` | `<変更した意味と利用側から再実行する既存Local Itemの選択条件>` | `<通常検証範囲／別途判断>` | `<未選択範囲と現在の保証を示す>` |
| PT | `<Conditional／N/A>` | `<対象、負荷上限、費用／Credit上限、中止条件、清掃条件。N/Aなら理由>` | `<Human Explicit Authorization／N/A>` | `未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない` |
| LT | `<Conditional／N/A>` | `<対象、継続時間、資源／費用上限、中止条件、清掃条件。N/Aなら理由>` | `<Human Explicit Authorization／N/A>` | `未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない` |

PT／LTは設計できても、利用者が対象、環境、上限、中止条件およびcleanupを明示しない限り実行しない。該当する成立条件がなければ、空欄にせず`N/A`と理由を記録する。
