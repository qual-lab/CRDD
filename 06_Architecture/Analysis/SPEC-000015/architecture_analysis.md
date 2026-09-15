# SPEC-000015のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000015`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000015 AIモデル構成を検証し実効選択を決める](../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

AIモデル構成を検証し実効選択を決める。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | AIモデル構成を読込み、更新または選択する時 |
| 事前条件 | 構成Candidate、許可値、利用可能性、用途、優先順位を確認できる |
| Authority | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

### 振る舞い・状態・結果

```text
[構成Candidate] -> [検証]
  ├ valid -> [採用済み構成] -> [実効選択]
  └ invalid／unavailable -> [拒否／再選定条件]
```

- 振る舞い: 許可値、利用可能性、用途、費用・品質制約、優先順位を検証し、実効選択と再選定条件を返す。
- 成功条件: コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。
- 副作用: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる |
| 境界 | 許可値／未知値、利用可能／利用不能を分け、不正構成を暗黙fallbackしない |
| 失敗 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ構成を保存する。選択はProvider実行Effectを発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Tool CapabilityとAIモデル構成のArchitecture定義](../../Definitions/ARCH-000010/architecture_definition.md) | AIモデル構成Manager | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する | 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Tool CapabilityとAIモデル構成](../../Definitions/ARCH-000010/architecture_definition.md) | Same | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000010
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
