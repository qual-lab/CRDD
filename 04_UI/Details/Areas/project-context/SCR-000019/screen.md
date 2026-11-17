# SCR-000019 公式素材の由来・権利・用途確認

成果物種別: Logical Screen Detail
Screen ID: `SCR-000019`
状態: Canonical
維持責任者: Qual-Lab

## 1. Screenの目的と入口・終了条件

- 利用者の作業・認識目的: 素材の由来と許可された用途を確認して安心して使える。
- 対象UI Definition: [UI-000019](../../../../Definitions/UI-000019/ui_definition.md)
- Area: [project-context](../area.md)
- 入口: 利用者が「公式素材の由来・権利・用途確認」を必要とし、対象Contextを識別できた時
- 終了条件: 素材の由来と許可された用途を確認して安心して使える。 次の安全な行動または所有正本を選べる
- 提示範囲: 既存の公開文書・確認結果への案内。専用画面、CLI／MCP操作や将来GUIの開発要求は設けない

## 2. Screen Composition

```text
+---------------- SCR-000019 ----------------+
| PRT-000019  公式素材の由来・権利・用途確認 |
|  現在状態 → 根拠・不足 → 主要操作 → 次の行動 |
+-----------------------------------------------+
```

| PRT | 意味／責務 | 情報 | 操作 | State／Variant |
|---|---|---|---|---|
| `PRT-000019` | 素材の由来と許可された用途を確認して安心して使える。 | 対象、状態、根拠、不足、観測時点、次行動 | 素材文書を見る／根拠と許可用途を確認する／人間が利用を判断する。 | ready／pending／blocked／unknown／restricted |

## 3. InteractionとBHV対応

| Interaction Key | PRT | 利用者の意図 | Feedback | BHV | Coverage |
|---|---|---|---|---|---|
| `PRT-000019.spec-000024` | PRT-000019 | 素材文書を見る／根拠と許可用途を確認する／人間が利用を判断する。 | 受付、結果、失敗、判断不能および安全な次行動を区別する | [BHV-000024](../../../../../05_SPEC/Details/BHV-000024/behavior.md) | Covered |

## 4. State／Variant

| State／Variant | 発生条件 | 表示する意味 | 操作 | 回復／次の状態 |
|---|---|---|---|---|
| ready | 必要情報とAuthorityを確認できる | 安全に主要操作へ進める | 素材文書を見る／根拠と許可用途を確認する／人間が利用を判断する。 | 結果を同じContextで確認 |
| pending | 人間の判断が未確定 | 未判断であることを素材文書または確認記録に示す | 根拠確認／人間判断 | 判断後の文書へ戻る |
| blocked | 前提、権限または入力が不足 | 理由と影響範囲を示す | 修正／再確認 | readyへ戻る |
| unknown／stale | 現在状態を断定できない | 正常・不存在と区別する | 再観測 | 根拠取得後に再判定 |
| restricted | 開示または操作不可 | 許可範囲だけを示す | Authority確認 | 既存の開示担当または素材の判断権限者へ確認し、許可範囲の文書へ戻る |

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
| 状態・根拠・次行動 | N/A | 既存文書の読取り説明であり、製品Componentを要求しない | 専用Componentや将来GUIの開発待ちを設けない |

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| Product固有Layout | N/A | v0.22 UI工程Owner | v0.21の意味契約には影響しない | GUI Productを設計する時 |
| CMP昇格 | N/A | UI工程Owner | 専用画面・Componentの開発は要求しない | 別の製品要求が採用された時だけ再検討 |

## 補足分析

本Detailは既存文書の読み順と根拠の区別を説明する。製品の新画面・非同期処理・State Store・Component化を要求しない。

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
