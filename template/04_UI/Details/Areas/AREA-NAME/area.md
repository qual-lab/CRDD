# <UI Area表示名> Design Guide

成果物種別: UI Area Design Guide
Area Key: `<stable-area-name>`
状態: `<Draft／Canonical／OPEN>`
維持責任者: `<人間またはチーム>`

## 1. Areaの目的と利用者成果

- Areaの目的:
- 主な利用者:
- 保持する利用者成果:
- 対象UI Definition:
- 対象外:

## 2. 情報構造と優先順位

```text
<最初に認識する情報>
        ↓
<判断に必要な情報と根拠>
        ↓
<主要操作と回復>
```

| 情報／責務 | 優先度 | 常時表示／必要時表示 | 根拠／関係 |
|---|---|---|---|
| | | | |

## 3. Screen InventoryとFlow

| SCR | 目的 | 入口 | 終了条件 | 主なPRT | 状態 |
|---|---|---|---|---|---|
| | | | | | |

```text
<Screen／Operation Flow>
```

## 4. Area共通のComposition

- Layout:
- Information Density:
- Visual Hierarchy:
- Reading Order:
- Action Hierarchy:
- Responsive／Platform差:

## 5. Interaction原則

| 観点 | Areaでの原則 | 例外／禁止 |
|---|---|---|
| 主要操作 | | |
| 選択とContext保持 | | |
| Feedback | | |
| Focus／Keyboard | | |
| Pending／Cancel | | |
| Failure／Recovery | | |

## 6. 状態・失敗・回復の表現

| 状態 | 利用者へ伝える意味 | 表現原則 | 次の行動／回復 |
|---|---|---|---|
| | | | |

## 7. Visual Baselineの適用とArea固有差分

- Product全体のVisual Baseline参照:
- Area固有の適用:
- Area固有の例外:
- 例外の理由と適用範囲:

Product全体のTypography、Color、Spacing、Surface等を再定義しない。Area固有の適用方法と理由付き例外だけを所有する。

## 8. PatternとReusable Component

| Pattern／CMP | 利用場面 | Area固有の使い方 | 非適用条件 |
|---|---|---|---|
| | | | |

最初の一画面だけに存在する構造を、反復確認なしにCMPへ昇格しない。

## 9. Accessibility

| 観点 | 適用 | Areaでの成立方法 | N/A／OPEN理由 |
|---|---|---|---|
| Keyboard | | | |
| Focus | | | |
| Reading Order | | | |
| 色以外の識別 | | | |
| Text Expansion | | | |
| Motion／Reduced Motion | | | |

## 10. 避ける表現

- <このAreaで避ける表現。ない場合は理由付きN/A>

## 11. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| | | | | |

## 補足分析

必須情報を退避せず、Area固有の追加分析だけを記載する。

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] Areaの目的、利用者成果、対象UI Definitionを説明できる
- [ ] 情報構造と優先順位を示した
- [ ] Screen InventoryとFlowを示した
- [ ] Area共通のCompositionを示した
- [ ] Interaction、State、FailureおよびRecoveryの原則を示した
- [ ] Product Visual Baselineを複製せず、適用と例外を分けた
- [ ] Pattern／CMPの利用規則と非適用条件を評価した
- [ ] Accessibilityを全項目評価した
- [ ] 避ける表現を明示した
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
