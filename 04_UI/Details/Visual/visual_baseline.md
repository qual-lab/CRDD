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

| 項目 | 状態 | Owner | 影響 | 戻り条件 |
|---|---|---|---|---|
| GUI Art Direction | N/A（旧v0.21の対象範囲に対する記録） | v0.22 UI工程Owner | 旧非該当を現行Productの視覚評価の免除根拠にはしない | GUI ProductとHero Screenを採用した時 |
| CMP外観 | OPEN | UI工程Owner | 再利用Componentの外観は未固定 | 複数実画面で反復を確認した時 |
| 現行ひな型の視覚評価 | OPEN | UI工程Owner・Qual-Lab | Rendered View、Font、測定値、Zoom・Adaptive Profileと人間判断の成立は未確認。旧意味基準だけでG1〜G5通過やUI Detail完了を主張できない | 対象ProductのVisual評価を実施するとき、同じHero・表示条件・改訂版で根拠を取得し、人間判断へ戻す |

以下のChecklistは現行ひな型への照合結果である。先頭のCanonicalは旧v0.21の意味・読み順の基準を指し、現行Productの視覚案選定や実表示検証の完了を追加承認しない。`[x]`は本文にある設計原則の確認に限定し、実画面・実測の成立とは区別する。既存の非該当やSecondary Screenの記述を、新しい視覚評価の完了根拠へ読み替えない。

## Checklist

- OPEN: 現行ProductのHeroは未選定。担当:UI工程Owner・Qual-Lab。影響:比較条件未固定。再評価:対象Productの画面選定時 — Screen Inventory／Flowの後にHeroを選定した
- OPEN: 同一Hero・表示条件の実表示比較は未確認。担当:UI工程Owner・Qual-Lab。影響:案の採否未確定。再評価:視覚案比較時 — 同じHeroと表示条件で2案以上のRendered Viewを比較した
- OPEN: Productの複数案は未比較。担当:UI工程Owner・Qual-Lab。影響:UX／IA保持とTrade-off未確認。再評価:視覚案比較時 — 各DirectionのIntent、Trade-offおよび保持するUX／IAを比較した
- OPEN: 現行Productの方向決定の記録なし。担当:UI工程Owner・Qual-Lab。影響:AI案を採用済みと扱えない。再評価:人間の方向決定時 — AI提案とHuman Direction Decisionを区別した
- OPEN: 現行Productの採用判断は未確認。担当:UI工程Owner・Qual-Lab。影響:採用根拠と再探索条件未確定。再評価:人間の方向決定時 — 採用理由と再探索条件を示した
- OPEN: 旧意味基準は現行の全視覚観点の評価ではない。担当:UI工程Owner・Qual-Lab。影響:視覚Baseline未確定。再評価:視覚基準作成時 — Baselineの全観点を評価した
- OPEN: Fontと未導入時の実表示は未確認。担当:UI工程Owner・Qual-Lab。影響:文字の可読性未確認。再評価:Typography評価時 — 主要Font Family、Fallback順およびFont未導入時の成立を評価した
- OPEN: Productの書体構成は未確認。担当:UI工程Owner・Qual-Lab。影響:混在理由未確定。再評価:Typography評価時 — 見出し、本文、ID／Codeで異なる書体を使う場合は理由を示した
- OPEN: Font Binaryの同梱判断は未確認。担当:UI工程Owner・Qual-Lab。影響:配布条件未確定。再評価:Typographyと配布範囲の決定時 — Font Binary同梱をApplicable／N/A／OPENへ処置した
- OPEN: 各案の原則適合は未評価。担当:UI工程Owner・Qual-Lab。影響:人間の採否へ進める根拠なし。再評価:視覚案比較前 — Direction比較前に各案のVisual Design Principleを評価した
- OPEN: 実表示の文字寸法は未確認。担当:UI工程Owner・Qual-Lab。影響:可読性未確認。再評価:文字寸法と例外の評価時 — 本文14px、補助情報12pxを原則下限として例外を理由付き処置した
- OPEN: Productの寸法Tokenは未確認。担当:UI工程Owner・Qual-Lab。影響:寸法体系未確定。再評価:視覚基準作成時 — Type ScaleとSpacingをToken化し、偶発的な値の増殖を避けた
- OPEN: Contrastの測定値は未確認。担当:UI工程Owner・Qual-Lab。影響:実表示の識別性未確認。再評価:Contrast評価時 — Contrastを測定値または測定可能なTokenで評価した
- OPEN: 操作Targetの寸法と間隔は未確認。担当:UI工程Owner・Qual-Lab。影響:操作性未確認。再評価:実表示の操作評価時 — Pointer／Touch Targetの寸法と間隔を評価した
- [x] 色だけに依存せず状態を識別できるようにした
- OPEN: §5は設計原則であり各表示条件の実測なし。担当:UI工程Owner・Qual-Lab。影響:適応性とFocus未確認。再評価:実表示の条件別検証時 — 長文、大量情報、200%拡大、狭幅およびKeyboard Focusを評価した
- OPEN: 現行Productの対象Platformと必須Profileの評価未確認。担当:UI工程Owner・Qual-Lab。影響:適用除外を推定できない。再評価:対象Platform決定とProfile評価時 — 汎用Webでは全必須Adaptive Profileを評価し、対象を限定した場合は決定権限者と影響を記録した
- OPEN: Breakpointと区間代表点は未確認。担当:UI工程Owner・Qual-Lab。影響:境界の成立未確認。再評価:Layout境界検証時 — 全Breakpointの直前／一致／直後と各Layout区間の代表点を評価した
- OPEN: 実Browser Zoomと狭幅の別観測は未実施。担当:UI工程Owner・Qual-Lab。影響:条件別結果未確認。再評価:Zoom・狭幅検証時 — 実Browser Zoomと狭幅Viewportの結果を同一視していない
- OPEN: Profileの技術結果と人間判断の対は未確認。担当:UI工程Owner・Qual-Lab。影響:例外受容を推定できない。再評価:Profile評価と人間判断時 — Profileの技術結果と人間の例外受容を分け、FAILをPASSへ書き換えていない
- OPEN: 現行ProductのVisual Sourceと実表示の対応は未確認。担当:UI工程Owner・Qual-Lab。影響:再現条件未確定。再評価:視覚案作成時 — Visual SourceとRendered Viewを区別した
- OPEN: §7の意味順序確認は視覚案の展開検証ではない。担当:UI工程Owner・Qual-Lab。影響:視覚的な展開成立未確認。再評価:Secondary Screenの実表示検証時 — Secondary Screenへ展開して成立を確認した
- OPEN: 旧Canonicalと現行Productの採否は別。担当:UI工程Owner・Qual-Lab。影響:現行Baselineの確定不可。再評価:人間の方向決定とBaseline確定時 — Human Direction Decision前にBaselineをCanonical化していない
- OPEN: ProductのPattern／CMP確定は未確認。担当:UI工程Owner・Qual-Lab。影響:再利用構成未確定。再評価:Secondary Screen検証と昇格判断時 — Secondary Screen検証前にPattern／CMPを確定していない
- [x] Screenshotだけを正本にしていない
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
