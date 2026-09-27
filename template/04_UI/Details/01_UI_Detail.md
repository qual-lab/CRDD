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

### 大量情報を扱う表示面

| Logical Screen／Part | 増加する対象 | 発見・表示方針 | UI状態 | SPEC Detailへ渡すBehavior |
|---|---|---|---|---|
| | | `検索／絞り込み／並び順／Cursor読込／遅延展開／仮想表示／内容分割／N/A` | `初回読込／追加読込／空／部分成功／失敗／観測不能` | |

全件取得・全件描画を既定にしない。非該当の場合も、対象件数・深さ・内容量が有界である理由を記録する。取得上限、Continuation、整合、権限境界および部分失敗はUIだけで決めず、SPEC Detailへ渡す。

## 4. Visual Design Gate

| Gate | 通過条件 | 判定 | Evidence／参照 | 未通過時に進めない工程 |
|---|---|---|---|---|
| G1 Screen Architecture | 対象範囲のScreen Inventory、入口・分岐・戻る・失敗・回復を含むFlowと、大量化し得る一覧・Tree・履歴の表示責務が揃う | `PASS／N/A／OPEN／FAIL` | | Hero選定 |
| G2 Hero Selection | InventoryとFlowを根拠に代表Screenを比較し、人間がHero候補を確認する | `PASS／N/A／OPEN／FAIL` | | Visual Direction作成 |
| G3 Visual Exploration | Heroについて2案以上のRendered View、Intent、Trade-off、保持するUX／IAを比較する | `PASS／N/A／OPEN／FAIL` | | Visual Baseline確定 |
| G4 Human Direction | 人間が採用・組合せ・再探索を判断し、理由と再探索条件を記録する | `PASS／N/A／OPEN／FAIL` | | Secondary Screen展開 |
| G5 Expansion | 採用DirectionをSecondary Screenへ展開し、例外、Pattern、CMP候補を評価する | `PASS／N/A／OPEN／FAIL` | | UI Detail完了、SPEC Detail／Architecture／Qualityへの通常引き渡し |

視覚的な画面または利用者向け端末UIが対象にある場合、G1〜G5を`N/A`にしてはならない。対象範囲が視覚的UIを一切持たない場合だけ、決定権限者、理由、利用者向けFeedbackの代替および再評価契機を記録して`N/A`にできる。`OPEN`にはOwner、現在の影響、戻り条件および再評価契機を記載する。

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
- [ ] G1: 対象範囲のScreen Inventoryと正常・分岐・失敗・回復Flowを全件処置した
- [ ] G1: 大量化し得る一覧・Tree・履歴を全件評価し、全件取得・全件描画を暗黙の前提にしていない
- [ ] G1: 検索・絞り込み・並び順・継続読込・遅延展開・仮想表示・内容分割の適用を処置した
- [ ] G1: 取得上限、Continuation、整合、権限境界および部分失敗をSPEC Detailへ引き渡した
- [ ] G2: G1通過後にHero候補を比較し、代表性と偏りを記録した
- [ ] G3: Heroについて2案以上のRendered View、Intent、Trade-offおよび保持するUX／IAを比較した
- [ ] G4: AI提案と人間の方向性判断を分け、採用理由と再探索条件を記録した
- [ ] Visual SourceとRendered Viewを区別した
- [ ] G5: 採用DirectionをSecondary Screenへ展開してからPatternを評価した
- [ ] G5: CMPへの昇格または理由付き非昇格を記録した
- [ ] 視覚的UIがある対象でG1〜G5をN/Aにしていない
- [ ] 未通過Gateより後の成果物をCanonical、完了または下流引き渡し可能と表示していない
- [ ] SCR／PRT／InteractionとBHVの双方向Coverageを評価した
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [ ] Detailで上流の意味やSystem Behaviorを創作していない
