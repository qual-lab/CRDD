# Workbench Visual Baseline

状態: G5 Revalidation OPEN — Actual Browser Zoom

## 1. 結論

Workbenchは`A — Decision Rail`をVisual Baselineとする。暗色、高密度、判断優先の基調を用い、左Navigation、中央作業面、右Evidence Railで構成する。

## 2. Typography

| 項目 | Baseline | 例外 |
|---|---|---|
| UI全体 | `Noto Sans CJK JP` | 未導入時は`Noto Sans JP`、`Yu Gothic UI`、`Hiragino Sans`、`system-ui`の順でFallbackする |
| 見出し | UI全体と同じ | N/A: Product内でSerif／明朝を混在させない |
| ID／数値 | UI全体と同じ＋tabular numerals | 固定幅が意味成立に必要なCode EditorだけDetailで再評価する |
| Font synthesis | 無効 | N/A: 存在しないWeightをBrowserへ合成させない |

### Type Scale

| Token | 値 | 用途 |
|---|---:|---|
| `--text-xs` | 12px | 補助Label、Metadata、Statusの下限 |
| `--text-sm` | 13px | Navigation、Rail、Panel Header |
| `--text-md` | 14px | 日本語本文、説明、通常の操作文言 |
| `--text-lg` | 16px | Item Title、重要な短文 |
| `--heading-sm` | 18px | Section Title候補 |
| `--heading-md` | 24px | Sub Screen Title候補 |
| `--heading-lg` | 30px | Hero／Screen Title |

8〜11pxで密度を作っていた初期Fixtureは不適合と判定し、12pxを絶対的な表示下限、14pxを常用本文の基準へ改訂した。

## 3. Composition

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│ Navigation   │ Current Work                 │ Evidence /       │
│ where        │ understand / decide / act    │ Boundary / Next  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

中央Compositionは画面目的に合わせて変える。三列Shellを同じにすることと、すべての画面を同じCard配置にすることを混同しない。

## 4. Visual Hierarchy

- 通常状態より判断待ち、Risk、失敗、欠測を先に識別できる。
- Accent ColorはAttentionまたは主要Actionへ限定する。
- Source、Coverage、Authorityおよび破壊操作境界を右Railで常時確認できる。
- AIへの依頼は補助入口とし、画面の主役または会話履歴の正本にしない。

## 5. PatternとComponentの境界

G5でDecision Rail Shell、Screen Context Header、Attention Treatment、Evidence Rail、Collection Control BarをPattern候補とした。PatternはProduct固有Ruleであり、Reusable Componentではない。CMPはBehavior、State、AccessibilityおよびAuthority Contractが複数画面で同一と確認できた後に発行する。

## 6. Visual Design Principle Evaluation

| 観点 | 判定 | Token／測定値／実表示Evidence | 例外・Gap・再評価条件 |
|---|---|---|---|
| Type Scale | PASS | 12／13／14／16／18／24／30pxへToken化 | Code Editorの固定幅書体は実装時に再評価 |
| 日本語最小文字サイズ | PASS | 補助情報12px、本文14px | N/A: 12px未満を使用しない |
| Line Height／Line Length | PASS | 本文1.5〜1.7、長文は中央Column内に限定 | 実Dataの最長文で再検証する |
| Text／Non-text Contrast | PASS | 通常幅5画面の可視文字351要素で4.5:1未満0件。Focus Outlineは暗色面10.41:1、明色面6.89:1 | Disabled Stateは実装時に再測定する |
| Pointer／Touch Target | PASS | 5画面75操作要素を通常幅・720px幅で測定し、32px未満0件 | Touch中心では44pxを後続Surfaceで要求する |
| Proximity／Grouping／Alignment | PASS | 三列Shell、Panel、Rail、CardのGroup境界 | 狭幅時は一列へ再配置する |
| Spacing Rhythm | PASS | 4／8／12／16／24px Token | 既存Fixtureの個別余白は実装化時にTokenへ完全移行する |
| Color非依存の状態識別 | PASS | Label、Border、位置、説明を色と併用 | Icon System確定時に再確認する |
| 長文／大量情報／Overflow | PASS | Search、Filter、継続読込、Tree遅延展開を画面責務化 | 実Data Stress FixtureはSPEC Detail後に実行する |
| 200%拡大／狭幅 | OPEN | localhost Previewを用い、5画面を899／900／901／1024／1119／1120／1121／1280 CSS pxで実Browser再表示した。固定最小幅を廃止し、1120px付近で一列化する | 全40条件で横Overflow 0件、12px未満0件。実Browserの200%／400% Zoomは入力後の実効Viewport変化を観測できず、狭幅結果から代替PASSにしない |
| Reading Order／Keyboard Focus | PASS | 5画面で正の`tabindex` 0件。DOM順をNavigation→Current Work→Evidenceへ揃え、`:focus-visible`を2px Outlineで明示 | Dialog等のFocus Returnは該当Interactionの実装時に再評価する |

### 実測サマリー

| 表示条件 | 対象 | 文字サイズ | 文字Contrast | 操作対象 | 横Overflow | Focus順 |
|---|---|---:|---:|---:|---:|---:|
| 通常幅 1280〜1440px | Hero 2案＋Secondary 3画面 | 12px未満 0件 | 4.5:1未満 0件 | 32px未満 0件 | 0件 | 正の`tabindex` 0件 |
| Sampling: 320／360／412／768／1024／1280／1440／1920 CSS px | 同じ5画面 | 12px未満 0件 | 4.5:1未満 0件 | 32px未満 0件 | 0件 | 正の`tabindex` 0件 |

上記は端末Profileではなく、現在のVisual Fixtureに対するSampling Evidenceである。実Browser Zoomとは扱わない。計測はRendered DOMのComputed StyleとBounding Rectangleを対象とし、目視だけでPASSへしなかった。localhost Preview導入後に旧900px境界の横Overflowを検出し、固定最小幅を廃止したうえで新しい1120px境界の前後を再評価した。

### Platform／Adaptive Layout Evaluation

| Profile | 条件 | 技術結果 | 人間判断 | Evidence／Gap／再評価条件 |
|---|---|---|---|---|
| `REFLOW-320` | 320 CSS px幅 | PASS | Accepted | 5画面で横Overflow、12px未満文字、4.5:1未満文字、32px未満操作対象および正の`tabindex`が0件 |
| `ZOOM-200` | 実Browserの200% Zoom | OPEN | Pending | 現在の自動実行環境では実効Viewportの変化を信頼して観測できない。実Browser環境で再実行する |
| `ZOOM-400` | 実Browserの400% Zoom | OPEN | Pending | 320 CSS pxのReflowはPASSしているが、実Zoomの代替にはしない |
| `RANGE-SAMPLING` | 360／412／768／1024／1280／1440／1920 CSS px | PASS | Accepted | 5画面40条件のComputed Style／Bounding Rectangle計測 |
| `PRODUCT-BASELINE` | 1440 × 960 | PASS | Accepted | Direction比較とSecondary ScreenのRendered View |
| `BREAKPOINT-BOUNDARY` | 899／900／901px、および1119／1120／1121px | PASS | Accepted | localhost Preview上の5画面30条件で横Overflow 0件、12px未満0件。旧900px境界で検出した反例を固定最小幅廃止と1120px付近の一列化へ反映した |

## 7. Evidence

- [Project Workspace](direction-a.png)
- [Topic Detail](topic-detail.png)
- [Repository Worktree](repository-worktree.png)
- [Project Portfolio](project-portfolio.png)
- [Secondary Screen Expansion](../../05_Workbench_Secondary_Expansion.md)

## Checklist

- [x] Human Direction Decisionと一致している
- [x] Typographyを一つのFont Family系統へ統一した
- [x] Compositionと画面固有Layoutを区別した
- [x] Attention、根拠、不完全性、次行動のVisual順序を定義した
- [x] PatternとCMPを同一視していない
- [x] 3つのSecondary Screenで成立を確認した
- [x] Direction比較後に検出した原則違反をRule、Format、Checkerおよび自己適用へ還元した
- [x] 本文14px、補助情報12pxを原則下限として再描画した
- [x] Type ScaleとSpacingをToken化した
- [x] Contrast、操作対象、状態識別、内容増加および狭幅を評価した
- [x] Pointer／Touch Targetの寸法と間隔を評価した
- [x] 色だけに依存せず状態を識別できるようにした
- OPEN: 実Browserの200%／400% Zoomは実行環境を変えて再評価する。狭幅、長文、大量情報およびKeyboard Focusは評価済み
- [x] 固定端末一覧ではなくReflow、Layout区間およびProduct Baselineとして記録した
- [x] 実Browser Zoomと狭幅Viewportの結果を同一視していない
- [x] DOM順と視覚順を揃え、Keyboard Focusを色だけに依存しないOutlineで表示した
