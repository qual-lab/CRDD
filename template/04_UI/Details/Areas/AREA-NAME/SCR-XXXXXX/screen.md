# SCR-XXXXXX <Logical Screen表示名>

成果物種別: Logical Screen Detail
Screen ID: `SCR-XXXXXX`
状態: `<Draft／Canonical／OPEN>`
維持責任者: `<人間またはチーム>`

## 1. Screenの目的と入口・終了条件

- 利用者の作業・認識目的:
- 対象UI Definition:
- Area:
- 入口:
- 終了条件:
- Route／Surface候補: `<参照情報。Screen Identityそのものではない>`

## 2. Screen Composition

```text
+---------------- SCR-XXXXXX ----------------+
| PRT-XXXXXX                                    |
|                                               |
| PRT-XXXXXX              PRT-XXXXXX            |
+-----------------------------------------------+
```

| PRT | 意味／責務 | 情報 | 操作 | State／Variant |
|---|---|---|---|---|
| | | | | |

## 3. InteractionとBHV対応

| Interaction Key | PRT | 利用者の意図 | Feedback | BHV | Coverage |
|---|---|---|---|---|---|
| `PRT-XXXXXX.<local-key>` | | | | | `Covered／N/A／OPEN／Gap` |

## 4. State／Variant

| State／Variant | 発生条件 | 表示する意味 | 操作 | 回復／次の状態 |
|---|---|---|---|---|
| | | | | |

## 5. VisualとAccessibility

- Visual Baseline参照:
- Area Design Guide参照:
- Screen固有の視覚判断:
- Reading Order:
- Focus Order:
- Keyboard／Alternative:

## 6. Pattern／CMP昇格判断

| Candidate | 判定 | 反復根拠 | 昇格先／非昇格理由 |
|---|---|---|---|
| | `Promote／Keep as PRT／OPEN` | | |

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| | | | | |

## 補足分析

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] ScreenをRoute、URLまたはFigma Frameだけで定義していない
- [ ] 利用者の目的、入口、終了条件を明示した
- [ ] 対象UI DefinitionとAreaへ接続した
- [ ] 意味あるPRTを全件示した
- [ ] Interaction、Feedback、StateおよびVariantを評価した
- [ ] System Behaviorを伴うInteractionをBHVへ接続した
- [ ] Failure、Unknown、PendingおよびRecoveryの表示を評価した
- [ ] Visual BaselineとArea Design Guideの適用を示した
- [ ] Accessibilityを評価した
- [ ] Pattern／CMP昇格を反復根拠から判断した
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
