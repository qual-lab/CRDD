# UI Detail

成果物種別: UI Detail統合投影
状態: `<Draft／Canonical／OPEN>`
維持責任者: `<人間またはチーム>`

## 1. 目的と対象範囲

- 対象Product／Capability:
- 対象UI Definition:
- 対象改訂版:
- 対象外:

```text
UI Definition
      ↓
UI Area
      ↓
Logical Screen（SCR-*）
      ↓
Screen Part（PRT-*）
      ↓
Interaction／State／Variant
```

## 2. UI Definitionの処置

| UI ID | Detail適用 | UI Area | SCR／PRT | 状態 | 理由／戻り条件 |
|---|---|---|---|---|---|
| `UI-XXXXXX` | `Applicable／N/A／OPEN` | | | | |

未記載を非該当と解釈しない。`N/A`には理由、`OPEN`にはOwner、現在の影響、戻り条件および再評価契機を記載する。

## 3. UI AreaとScreen Inventory

| UI Area | 目的 | Area Design Guide | Logical Screen | Flow |
|---|---|---|---|---|
| | | | | |

## 4. Hero-led Visual Designの現在地

| 項目 | 判定 | 内容／参照 |
|---|---|---|
| Screen Inventory | `Applicable／N/A／OPEN` | |
| Screen／Operation Flow | `Applicable／N/A／OPEN` | |
| Hero Screen | `Applicable／N/A／OPEN` | |
| Visual Direction比較 | `Applicable／N/A／OPEN` | |
| Human Direction Decision | `Applicable／N/A／OPEN` | |
| Visual Baseline | `Applicable／N/A／OPEN` | |
| Secondary Screen展開 | `Applicable／N/A／OPEN` | |
| Pattern発見 | `Applicable／N/A／OPEN` | |
| CMP昇格判断 | `Applicable／N/A／OPEN` | |

## 5. UI／SPEC Detail対応

| SCR／PRT／Interaction | BHV | 関係 | Coverage | Gap／処置 |
|---|---|---|---|---|
| | | | `Covered／N/A／OPEN／Gap` | |

## 6. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| | | | | |

## 補足分析

必須Sectionへ収まらない対象固有の分析を記載する。必須情報をこの節へ退避しない。

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 対象UI Definitionを全件処置した
- [ ] UI Areaごとの目的とArea Design Guideを示した
- [ ] Logical ScreenをRouteやFigma Frameと混同していない
- [ ] Screen PartをHTML要素やLayout wrapperへ過剰発行していない
- [ ] Interaction、StateおよびVariantを評価した
- [ ] Screen Inventory／Flowの後にHero Screenを選定した
- [ ] 複数Visual DirectionのIntentとTrade-offを比較した
- [ ] Human Direction Decisionを記録した
- [ ] Visual SourceとRendered Viewを区別した
- [ ] Secondary Screenへ展開してからPatternを評価した
- [ ] CMPへの昇格または理由付き非昇格を記録した
- [ ] SCR／PRT／InteractionとBHVの双方向Coverageを評価した
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [ ] Detailで上流の意味やSystem Behaviorを創作していない
