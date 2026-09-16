# SPEC-000009のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000009`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000009 実行基盤の故障境界と利用可能範囲を診断する](../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

実行基盤の故障境界と利用可能範囲を診断する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | AI実行環境の処理が停止または失敗した時 |
| 事前条件 | 診断対象、境界ごとのCorrelation ID、許可されたProbeを確認できる |
| Authority | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない |
| 判定不能 | 不足を既定値で補完せず、対象を変更せず理由と再確認先を返す |

### 振る舞い・状態・結果

```text
[故障観測] -> [認証／起動／実行／取消／搬送／回復を照合]
 -> [確定箇所／未確定／利用可能範囲]
```

- 振る舞い: 認証・起動・実行・取消・結果搬送・回復の観測点を相関し、故障位置と残る利用可能範囲を返す。
- 成功条件: 原因未確定と確定済みを分け、Providerごとの差を保持する。
- ここにない取消、再試行、回復または状態値を架空に追加しない。

### 失敗・回復・副作用

- 失敗: 一つの失敗から全機能停止や原因を断定しない。
- 副作用: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。
- 本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 原因未確定と確定済みを分け、Providerごとの差を保持する |
| 境界 | 診断対象内／対象外、原因確定／未確定を分け、診断から修復Effectを発行しない |
| 失敗 | 一つの失敗から全機能停止や原因を断定しない |
| 観測不能 | 不明を正常・不存在・完了へ丸めず、実際の副作用「許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない」と矛盾する結果を返さない |
| 対応UI | [UI-000005](../../../04_UI/Definitions/UI-000005/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行境界の診断のArchitecture定義](../../Definitions/ARCH-000008/architecture_definition.md) | Platform Access診断Port | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない | 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。 | 一つの失敗から全機能停止や原因を断定しない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行境界の診断](../../Definitions/ARCH-000008/architecture_definition.md) | Same | 境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。 |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000005
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
