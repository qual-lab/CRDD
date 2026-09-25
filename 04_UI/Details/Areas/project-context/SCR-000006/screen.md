# SCR-000006 Repository内作業と対象選択

成果物種別: Logical Screen Detail
Screen ID: `SCR-000006`
状態: Canonical
維持責任者: Qual-Lab

## 1. Screenの目的と入口・終了条件

- 利用者の作業・認識目的: 普段のRepository作業を保ちながら、対象の取り違えを防げる。
- 対象UI Definition: [UI-000006](../../../../Definitions/UI-000006/ui_definition.md)
- Area: [project-context](../area.md)
- 入口: 利用者が「Repository内作業と対象選択」を必要とし、対象Contextを識別できた時
- 終了条件: 普段のRepository作業を保ちながら、対象の取り違えを防げる。 次の安全な行動または所有正本を選べる
- Route／Surface候補: CLI、MCP、Markdownまたは将来GUI。SurfaceはScreen Identityではない

## 2. Screen Composition

```text
+---------------- SCR-000006 ----------------+
| PRT-000006  Repository内作業と対象選択 |
|  現在状態 → 根拠・不足 → 主要操作 → 次の行動 |
+-----------------------------------------------+
```

| PRT | 意味／責務 | 情報 | 操作 | State／Variant |
|---|---|---|---|---|
| `PRT-000006` | 普段のRepository作業を保ちながら、対象の取り違えを防げる。 | 対象、状態、根拠、不足、観測時点、次行動 | 対象を選ぶ／Rootを確認する／正本を開く。 | ready／pending／blocked／unknown／restricted |

## 3. InteractionとBHV対応

| Interaction Key | PRT | 利用者の意図 | Feedback | BHV | Coverage |
|---|---|---|---|---|---|
| `PRT-000006.spec-000010` | PRT-000006 | 対象を選ぶ／Rootを確認する／正本を開く。 | 受付、結果、失敗、判断不能および安全な次行動を区別する | [BHV-000010](../../../../../05_SPEC/Details/BHV-000010/behavior.md) | Covered |

## 4. State／Variant

| State／Variant | 発生条件 | 表示する意味 | 操作 | 回復／次の状態 |
|---|---|---|---|---|
| ready | 必要情報とAuthorityを確認できる | 安全に主要操作へ進める | 対象を選ぶ／Rootを確認する／正本を開く。 | 結果を同じContextで確認 |
| pending | 外部処理または人間判断を待つ | 未完了とOwnerを示す | 待機／取消／判断 | 同じIdentityで再観測 |
| blocked | 前提、権限または入力が不足 | 理由と影響範囲を示す | 修正／再確認 | readyへ戻る |
| unknown／stale | 現在状態を断定できない | 正常・不存在と区別する | 再観測 | 根拠取得後に再判定 |
| restricted | 開示または操作不可 | 許可範囲だけを示す | Authority確認 | Grant更新後に再評価 |

## 5. VisualとAccessibility

- Visual Baseline参照: [v0.21 UI Visual Baseline](../../../Visual/visual_baseline.md)
- Area Design Guide参照: [project-context](../area.md)
- Screen固有の視覚判断: 結論、状態、主要操作、根拠、詳細の順に示す
- Reading Order: Screen目的→状態→根拠・不足→操作→戻り先
- Focus Order: 対象→主要操作→根拠→戻る
- Keyboard／Alternative: TextとKeyboardだけで全判断情報へ到達可能にする

## 6. Pattern／CMP昇格判断

| Candidate | 判定 | 反復根拠 | 昇格先／非昇格理由 |
|---|---|---|---|
| 状態・根拠・次行動 | Keep as PRT | 意味順序は共通だが実画面の構造反復は未確認 | Product固有GUIで複数画面の反復を確認するまでCMPを発行しない |

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| Product固有Layout | N/A | v0.22 UI工程Owner | v0.21の意味契約には影響しない | GUI Productを設計する時 |
| CMP昇格 | OPEN | UI工程Owner | 再利用Component未発行 | 複数実画面で反復を確認した時 |

## 補足分析

v0.21のUI DefinitionをLogical Screenへ具体化した。SourceやWIPの配置をScreen Identityへ使っていない。

## Checklist

- [x] ScreenをRoute、URLまたはFigma Frameだけで定義していない
- [x] 利用者の目的、入口、終了条件を明示した
- [x] 対象UI DefinitionとAreaへ接続した
- [x] 意味あるPRTを全件示した
- [x] Interaction、Feedback、StateおよびVariantを評価した
- [x] System Behaviorを伴うInteractionをBHVへ接続した
- [x] Failure、Unknown、PendingおよびRecoveryの表示を評価した
- [x] Visual BaselineとArea Design Guideの適用を示した
- [x] Accessibilityを評価した
- [x] Pattern／CMP昇格を反復根拠から判断した
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
