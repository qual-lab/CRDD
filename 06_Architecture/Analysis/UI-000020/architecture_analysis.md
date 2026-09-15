# UI-000020のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000020`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000020 実行記録の依頼と結果確認](../../../04_UI/Definitions/UI-000020/ui_definition.md)

このUI定義だけを正式入力とする。上流工程、SPEC、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

実行記録を作る側が、許可された事実を一度だけ記録し、成否または結果不明を見分けて安全な次の処置へ進める。

### 表示面と情報の優先順位

記録対象・許可範囲、記録試行、結果状態、根拠、次の行動の順に示す。`not_recorded`と`unknown`を同じ失敗表示へ畳まない。

### 操作とFeedback

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000032 | 記録を依頼し、結果に応じて取得・修正後の再依頼・同一試行の再観測を選ぶ | 保存要求後に結果確認が途切れる時 | recorded／not_recorded／unknown、同じ実行・試行、完成記録または再観測先 | unknownを未記録と推定して再発行する |

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000032／IA-000022 | prepared／publishing／recorded／not_recorded／unknown | 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 |

### 視覚表現とアクセシビリティ

- 状態を色だけで区別せず、状態名、Execution、Attemptと次の行動を文字で示す。
- CLI、TypeScript API、MCPまたはWorkbenchで同じ結果状態と再観測の意味を保つ。

### 制約

- UIだけに記録の正本、Authority判断、不変Storeまたは独自状態Storeを作らない。
- 記録AuthorityをTask実行、評価採用または別Source変更へ流用しない。
- 記録結果不明を成功、未記録または空へ畳まない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writer／Store／Record Attempt | 許可された記録作成側。UIはAuthorityを生成しない | 許可された実行記録領域への不変公開 | Identity・Schema不一致、並行衝突、途中失敗、Effect不明、別Execution上書き、許可外情報 |

```text
記録依頼
   ↓ Effect前検査
prepared
   ↓ 不変公開要求
publishing
   ├ 完成確認 ─→ recorded
   ├ Effect 0確認 → not_recorded
   └ 観測不能 ─→ unknown ─→ 同じIdentity／Attemptで再観測
```

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | New | 記録Effect、並行書込み、途中失敗、情報境界、結果不明時の再観測を読取りProjectionから分けて所有する |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000030
- UIが必要とする記録依頼、結果状態、同一試行の再観測、情報最小化および終了後条件がSPECで観測可能かを一つずつ照合する。
- 差分がある場合はArchitectureで補完せずUI／SPEC対応レビューへ戻す。
