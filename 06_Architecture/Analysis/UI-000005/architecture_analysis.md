# UI-000005のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000005`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000005 実行事実と故障境界の診断](../../../04_UI/Definitions/UI-000005/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

実際に起きたことと故障箇所を根拠から切り分けられる。

### 表示面と情報の優先順位

```text
実行事実と故障境界の診断
        ↓
実行（Execution）／観測（Observation）／情報源（Source）／評価（Assessment）／改善候補（Improvement Candidate）／実行基盤／境界／故障／利用可能能力／回復経路
        ↓
現在状態・不足・制限
        ↓
実行→観測→根拠→評価→改善候補／故障→境界→影響する能力→継続可能範囲→回復
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000004 | 実行（Execution） | 一回の実行 | 実行識別子（Execution ID） |
| IA-000004 | 観測（Observation） | 観測した値と観測状態 | Execution＋測定項目（Metric）＋観測時点（Observed At） |
| IA-000004 | 情報源（Source） | 観測元 | 情報源の識別子（Source Identity）／改訂版（Revision） |
| IA-000004 | 評価（Assessment） | 事実に対する評価 | Observation集合へ結合 |
| IA-000004 | 改善候補（Improvement Candidate） | 改善候補 | Assessmentと根拠へ結合 |
| IA-000020 | 実行基盤 | AIによる仕事を成立させる外部環境 | 環境の種類と検証対象で識別する |
| IA-000020 | 境界 | 認証、起動、取消、結果取得、回復のどこを確認したか | 実行基盤と能力へ結ぶ |
| IA-000020 | 故障 | 成立しなかった境界と観測根拠 | 境界、観測時点、原因が分かる範囲へ結ぶ |
| IA-000020 | 利用可能能力 | 故障後も続けられる仕事 | 成立している境界と必要条件から導く |
| IA-000020 | 回復経路 | 故障した境界を安全に戻す方法 | 対象境界と回復後の確認へ結ぶ |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: 診断を開く／証拠を絞る／回復へ進む。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000006 | 実行事実を出所と観測時点付きで比較する | 未観測値を含む実行事実の取得 | 出所・時点・観測状態を保持する | 未観測を0や正常へ畳む |
| UX-000008 | 故障した境界と影響する能力を特定する | 一つの失敗を全体障害と判断する直前 | 失敗した場所・影響範囲・利用可能性を分ける | 一律の失敗表示で無関係な能力まで停止する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000006／IA-000004 | 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 | 実行→観測→根拠→評価→改善候補 |
| UX-000008／IA-000020 | 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | 故障→境界→影響する能力→継続可能範囲→回復 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「実行（Execution）、観測（Observation）、情報源（Source）、評価（Assessment）、改善候補（Improvement Candidate）、実行基盤、境界、故障、利用可能能力、回復経路」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

### 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行事実と評価候補の取得のArchitecture定義](../../Definitions/execution-fact-retrieval/architecture_definition.md) | 実行記録読取りProjection | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別。導線: 実行→観測→根拠→評価→改善候補 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |
| [実行境界の診断のArchitecture定義](../../Definitions/execution-boundary-diagnosis/architecture_definition.md) | Platform Access診断Port | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別。導線: 実行→観測→根拠→評価→改善候補 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行事実と評価候補の取得](../../Definitions/execution-fact-retrieval/architecture_definition.md) | New | observed／not_observed／unknownを区別し、事実と評価候補を別結果として返す。評価には根拠、対象範囲、不確実性、採用状態を持たせる。 |
| [実行境界の診断](../../Definitions/execution-boundary-diagnosis/architecture_definition.md) | New | 境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000008、SPEC-000009
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
