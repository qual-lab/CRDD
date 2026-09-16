# SPEC-000001のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000001`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000001 事前検査を実行し意味レビューへ案内する](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

事前検査を実行し意味レビューへ案内する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 検査対象と条件を受け取った時 |
| 事前条件 | 検査対象、対象改訂版および検査条件が揃っている |
| Authority | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[未検査] --検査--> [指摘なし／指摘あり／検査不能]
```

- 振る舞い: 対象と条件を同じ改訂版へ固定して機械検査し、指摘位置・理由・意味判断が必要な範囲を返す。
- 成功条件: 同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。
- 副作用: Repository内容を変更しない読取り検査。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない |
| 境界 | 検査対象内／対象外、検査可能／検査不能を分け、対象外を変更しない |
| 失敗 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「Repository内容を変更しない読取り検査」と矛盾する結果を返さない |
| 対応UI | [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [機械検査と文書検査のArchitecture定義](../../Definitions/ARCH-000001/architecture_definition.md) | Checker CoreとCRDD現行Profile | 検査の実行者。指摘の意味判断や修正採用のAuthorityは発行しない | Repository内容を変更しない読取り検査。 | 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [機械検査と文書検査](../../Definitions/ARCH-000001/architecture_definition.md) | Same | 機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000001、UI-000018
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応UIの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
