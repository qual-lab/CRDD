# Visual Baseline

成果物種別: Product Visual Baseline
状態: `<Draft／Human Selected／Canonical／OPEN>`
維持責任者: `<人間またはチーム>`

## 1. Productの表現意図

- 望ましい印象:
- 避ける印象:
- Product Personality:
- 対象Platform／媒体:

## 2. Hero Screen選定

| 候補SCR | Productを代表する理由 | 不足／偏り | 判定 |
|---|---|---|---|
| | | | `Selected／Rejected／OPEN` |

Screen Inventory／Flowの参照:

## 3. Visual Direction比較

| Direction | Visual Source | Rendered View | Intent | 強み | Trade-off | 保持するUX／IA | 判定 |
|---|---|---|---|---|---|---|---|
| A | | | | | | | |
| B | | | | | | | |

視覚的UIが対象にある場合は、同じHero、同じ情報責務、比較可能な表示条件で2案以上を作成する。文章だけのDirection名やMoodの説明をRendered Viewの代替にしない。

## 4. Human Direction Decision

- 判断者:
- 採用／組合せ／却下:
- 判断理由:
- 再探索条件:

## 5. Baseline

| 観点 | Baseline | 避けること |
|---|---|---|
| Composition | | |
| Information Density | | |
| Visual Hierarchy | | |
| Attention | | |
| Typography | | |
| Spacing／Rhythm | | |
| Surface | | |
| Border／Depth | | |
| Color | | |
| Reading Order | | |
| Action Hierarchy | | |
| Interaction表現 | | |

### Typography Contract

| 項目 | 評価結果 | 理由／Fallback／再評価条件 |
|---|---|---|
| 主要Font Family | | |
| Fallback順 | | |
| 見出しと本文の使い分け | | |
| ID／Code／数値の使い分け | | |
| Font未導入環境 | | |
| Font Binary同梱 | | |
| 異なる書体の混在 | | |

### Visual Design Principle Evaluation

| 観点 | 判定 | Token／測定値／実表示Evidence | 例外・Gap・再評価条件 |
|---|---|---|---|
| Type Scale | `PASS／N/A／OPEN／FAIL` | | |
| 日本語最小文字サイズ | `PASS／N/A／OPEN／FAIL` | | |
| Line Height／Line Length | `PASS／N/A／OPEN／FAIL` | | |
| Text／Non-text Contrast | `PASS／N/A／OPEN／FAIL` | | |
| Pointer／Touch Target | `PASS／N/A／OPEN／FAIL` | | |
| Proximity／Grouping／Alignment | `PASS／N/A／OPEN／FAIL` | | |
| Spacing Rhythm | `PASS／N/A／OPEN／FAIL` | | |
| Color非依存の状態識別 | `PASS／N/A／OPEN／FAIL` | | |
| 長文／大量情報／Overflow | `PASS／N/A／OPEN／FAIL` | | |
| 200%拡大／狭幅 | `PASS／N/A／OPEN／FAIL` | | |
| Reading Order／Keyboard Focus | `PASS／N/A／OPEN／FAIL` | | |

Visual Directionごとにこの原則を評価する。原則未達の案をHuman Tasteの候補へ進めず、修正または理由付き却下する。

### Platform／Adaptive Layout Evaluation

汎用Webは固定端末一覧ではなく、Reflow、実Zoom、Productの全Breakpoint、各Layout区間、対応Window範囲および高さ制約を評価する。明示的に対象Platformを限定した場合だけ、決定権限者、対象外利用者、影響および再評価条件を示して`N/A`にできる。

#### 不変Profile

| Profile | 論理Viewport／条件 | 適用 | 技術結果 | 人間判断 | Evidence／Gap／再評価条件 |
|---|---|---|---|---|---|
| `REFLOW-320` | 320 CSS px幅。高さと実行環境を記録 | `Applicable／N/A` | `PASS／FAIL／OPEN／N/A` | `Accepted／Accepted Exception／Pending／N/A` | |
| `ZOOM-200` | 実Browserの200% Zoom。前後の実効CSS Viewportを記録 | | | | |
| `ZOOM-400` | 実Browserの400% Zoom。前後の実効CSS Viewportを記録 | | | | |

#### Product固有Profile

Breakpointごとに`直前／一致／直後`、各Layout区間に少なくとも1つの代表点を置く。宣言した最小・最大Window、最小高さ、Visual比較用Baselineも省略しない。

| Profile | Condition Class | 論理Viewport／条件 | 選定理由 | 技術結果 | 人間判断 | Evidence／Gap／再評価条件 |
|---|---|---|---|---|---|---|
| `BREAKPOINT-<name>-BEFORE` | 境界直前 | | | `PASS／FAIL／OPEN／N/A` | `Accepted／Accepted Exception／Pending／N/A` | |
| `BREAKPOINT-<name>-AT` | 境界一致 | | | | | |
| `BREAKPOINT-<name>-AFTER` | 境界直後 | | | | | |
| `RANGE-<name>` | 区間代表 | | | | | |
| `WINDOW-MIN` | 最小Window | | | | | |
| `WINDOW-MAX` | 最大Window | | | | | |
| `HEIGHT-MIN` | 高さ制約 | | | | | |
| `PRODUCT-BASELINE` | Visual基準 | | | | | |

技術的な`FAIL`を人間判断によって`PASS`へ改名しない。許容する場合は`FAIL + Accepted Exception`として残し、影響、代替、残存Risk、受容者、期限または再評価契機を記録する。

## 6. SourceとRendered View

- 再現可能なVisual Source:
- Rendered View:
- 対象改訂版:
- Render条件:

Screenshotだけを唯一の正本にしない。

## 7. Secondary Screenでの検証

| SCR | Baseline適用結果 | 発見したPattern | 例外／Gap |
|---|---|---|---|
| | | | |

## 8. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| | | | | |

## 補足分析

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] Screen Inventory／Flowの後にHeroを選定した
- [ ] 同じHeroと表示条件で2案以上のRendered Viewを比較した
- [ ] 各DirectionのIntent、Trade-offおよび保持するUX／IAを比較した
- [ ] AI提案とHuman Direction Decisionを区別した
- [ ] 採用理由と再探索条件を示した
- [ ] Baselineの全観点を評価した
- [ ] 主要Font Family、Fallback順およびFont未導入時の成立を評価した
- [ ] 見出し、本文、ID／Codeで異なる書体を使う場合は理由を示した
- [ ] Font Binary同梱をApplicable／N/A／OPENへ処置した
- [ ] Direction比較前に各案のVisual Design Principleを評価した
- [ ] 本文14px、補助情報12pxを原則下限として例外を理由付き処置した
- [ ] Type ScaleとSpacingをToken化し、偶発的な値の増殖を避けた
- [ ] Contrastを測定値または測定可能なTokenで評価した
- [ ] Pointer／Touch Targetの寸法と間隔を評価した
- [ ] 色だけに依存せず状態を識別できるようにした
- [ ] 長文、大量情報、200%拡大、狭幅およびKeyboard Focusを評価した
- [ ] 汎用Webでは全必須Adaptive Profileを評価し、対象を限定した場合は決定権限者と影響を記録した
- [ ] 全Breakpointの直前／一致／直後と各Layout区間の代表点を評価した
- [ ] 実Browser Zoomと狭幅Viewportの結果を同一視していない
- [ ] Profileの技術結果と人間の例外受容を分け、FAILをPASSへ書き換えていない
- [ ] Visual SourceとRendered Viewを区別した
- [ ] Secondary Screenへ展開して成立を確認した
- [ ] Human Direction Decision前にBaselineをCanonical化していない
- [ ] Secondary Screen検証前にPattern／CMPを確定していない
- [ ] Screenshotだけを正本にしていない
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
