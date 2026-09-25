# v0.21 UI Visual Baseline

成果物種別: UI Visual Baseline
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的と適用範囲

v0.21のCLI、MCP、Markdownおよび将来Surfaceへ共通する視覚・読み取り原則を固定する。Product固有GUIのArt Direction、色体系またはComponent外観は固定しない。

## 2. Hero Screen選定

| 候補 | Productらしさ | 横断性 | 判定 |
|---|---|---|---|
| N/A | v0.21は異種Surfaceの意味契約を対象とし、代表GUIを持たない | CLI、MCP、文書を一画面へ畳めない | N/A: v0.22のGUI Product設計時に選定する |

Screen Inventory／Flowの参照: [UI Detail](../01_UI_Detail.md)

## 3. Visual Direction

| 観点 | v0.21基準 | 理由 |
|---|---|---|
| Composition | 結論→状態→主要操作→根拠→詳細 | 判断順と読み順を一致させる |
| Information Density | 不足・制限・判断要否を初期表示し、内部詳細を段階表示 | 完全に見える誤解を防ぐ |
| Visual Hierarchy | blocked、unknown、restricted、recovery requiredを通常成功より弱くしない | 安全な次行動へつなぐ |
| Typography | 状態語と見出しを平易な日本語で示す | 専門知識なしで理解可能にする |
| Spacing／Rhythm | 意味単位と操作単位を分ける | 連続した生出力へ埋没させない |
| Surface／Depth | N/A: Surface固有外観はv0.21の契約外 | Product固有GUIで探索する |
| Color | 色だけで状態を識別しない | 非視覚SurfaceとAccessibilityを保つ |
| Reading Order | 視覚順、読上げ順、Text出力順を一致させる | 入口間で意味を変えない |
| Action Hierarchy | 安全な主要操作、回復、破壊的操作を分ける | 誤Effectを防ぐ |

## 4. 状態の共通表現

| 状態 | 必須表示 | 禁止 |
|---|---|---|
| success／available | 対象、結果、観測時点 | 一部成功から全体完了を推定する |
| pending／waiting | 待機理由、Owner、次の確認 | 処理中だけを表示する |
| blocked／failed | 理由、影響範囲、安全な戻り先 | 原因不明を確定原因として示す |
| unknown／stale | 未観測または古いこと、再観測先 | 正常値、空値、不存在へ畳む |
| restricted | 利用不可の意味、許可確認先 | 非開示対象の存在やIdentityを漏らす |

## 5. Accessibility

- 状態は色、位置またはIconだけに依存せず、状態語と説明を持つ。
- 主要操作、根拠、戻り先はKeyboardとTextだけでも辿れる。
- 視覚順と読上げ順を一致させる。
- 省略表示から全文・正本・Evidenceへ到達できる。
- AnimationはN/A: v0.21はMotionを使用しない。

## 6. Pattern／Componentへの境界

状態・根拠・次行動の順序はPatternとして共有する。外観を持つReusable Componentは、複数の実画面で反復を確認するまで`CMP-*`を発行しない。

## 7. Secondary Screenでの検証

20 Logical Screenへ同じ意味順序を適用し、各Screenが状態、根拠、主要操作および戻り先を保持することを確認した。これはVisual Mockupの比較ではなく、v0.21の非視覚Surfaceを含む表現契約の横断確認である。

## 8. 未確認事項・戻り条件

| 項目 | 状態 | Owner | 戻り条件 |
|---|---|---|---|
| GUI Art Direction | N/A | v0.22 UI工程Owner | GUI ProductとHero Screenを採用した時 |
| CMP外観 | OPEN | UI工程Owner | 複数実画面で反復を確認した時 |

## Checklist

- [x] Screen Inventory／Flowの後に適用範囲を決めた
- N/A: v0.21には代表GUIがないため、Hero Screenを選定していない
- N/A: Product固有Visual Directionはv0.22で人間判断する
- [x] 状態、根拠、操作、読み順およびAccessibilityの共通基準を固定した
- [x] 色だけで状態を識別しない
- [x] Secondary Screenへ展開して成立を確認した
- [x] Screenshotだけを正本にしていない
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
