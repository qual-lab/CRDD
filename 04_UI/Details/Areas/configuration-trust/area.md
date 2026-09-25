# 構成・信頼 Design Guide

成果物種別: UI Area Design Guide
Area Key: `configuration-trust`
状態: Canonical
維持責任者: Qual-Lab

## 1. Areaの目的と利用者成果

- Areaの目的: Workspace、Tool、AIモデル、Runtime Dataおよび信頼要素を、Authorityと利用範囲を分けて選択・確認できるようにする。
- 主な利用者: CRDDを使って作業、確認または判断する人
- 保持する利用者成果: Workspace、Tool、AIモデル、Runtime Dataおよび信頼要素を、Authorityと利用範囲を分けて選択・確認できるようにする。
- 対象UI Definition: [UI-000008](../../../Definitions/UI-000008/ui_definition.md)、[UI-000010](../../../Definitions/UI-000010/ui_definition.md)、[UI-000011](../../../Definitions/UI-000011/ui_definition.md)、[UI-000013](../../../Definitions/UI-000013/ui_definition.md)
- 対象外: 実装技術、独自の正本、画面固有の業務規則

## 2. 情報構造と優先順位

```text
対象と所有者を確認
        ↓
利用可否・範囲・根拠・制約を比較
        ↓
選択、保留、再認証または清掃へ進む
```

| 情報／責務 | 優先度 | 常時表示／必要時表示 | 根拠／関係 |
|---|---|---|---|
| 現在状態と判断要否 | 最優先 | 常時 | 対象UI Definition |
| 根拠、観測時点、不足、制限 | 高 | 常時 | IAおよびUI Definition |
| 詳細、履歴、内部識別情報 | 中 | 必要時 | 所有正本 |

## 3. Screen InventoryとFlow

| SCR | 目的 | 入口 | 終了条件 | 主なPRT | 状態 |
|---|---|---|---|---|---|
| [SCR-000008](SCR-000008/screen.md) | UI-000008の利用者成果を一つの作業単位で扱う | 対象Contextを選んだ時 | 次の安全な行動を選べる | PRT-000008 | Canonical |
| [SCR-000010](SCR-000010/screen.md) | UI-000010の利用者成果を一つの作業単位で扱う | 対象Contextを選んだ時 | 次の安全な行動を選べる | PRT-000010 | Canonical |
| [SCR-000011](SCR-000011/screen.md) | UI-000011の利用者成果を一つの作業単位で扱う | 対象Contextを選んだ時 | 次の安全な行動を選べる | PRT-000011 | Canonical |
| [SCR-000013](SCR-000013/screen.md) | UI-000013の利用者成果を一つの作業単位で扱う | 対象Contextを選んだ時 | 次の安全な行動を選べる | PRT-000013 | Canonical |

```text
対象を選ぶ → 状態と根拠を確認 → 次の行動を選ぶ → 所有正本またはBehaviorへ渡す
```

## 4. Area共通のComposition

- Layout: 結論、現在状態、主要操作、根拠、詳細の順に置く。
- Information Density: 判断に必要な不足と制限を隠さず、内部詳細は段階的に開く。
- Visual Hierarchy: 停止、判断待ち、失敗、観測不能を通常成功より弱く見せない。
- Reading Order: 視覚順と読上げ順を一致させる。
- Action Hierarchy: 安全な次の行動を第一候補とし、破壊的・外部Effect操作を分離する。
- Responsive／Platform差: CLI、MCP、文書、将来のGUIで意味と状態語を変えない。

## 5. Interaction原則

| 観点 | Areaでの原則 | 例外／禁止 |
|---|---|---|
| 主要操作 | 対象、Authority、Effectを確認してから実行する | 表示閲覧から実行Authorityを推定しない |
| 選択とContext保持 | 同じ対象Identityと観測時点を保つ | 表示名だけで対象を結合しない |
| Feedback | 受理、開始、結果、判断待ちを分ける | 受付を完了として表示しない |
| Focus／Keyboard | 主要操作、根拠、戻り先へ順に到達できる | Pointerだけに依存しない |
| Pending／Cancel | 要求と完了を分ける | 取消要求を終了として表示しない |
| Failure／Recovery | 原因確定、原因不明、回復可能を分ける | 不明を失敗なしへ畳まない |

## 6. 状態・失敗・回復の表現

| 状態 | 利用者へ伝える意味 | 表現原則 | 次の行動／回復 |
|---|---|---|---|
| ready／available | 安全に次へ進める | 根拠と範囲を併記 | 主要操作へ進む |
| pending／waiting | 外部処理または判断を待つ | Ownerと待機理由を示す | 待機、取消、判断 |
| blocked／failed | 継続条件を満たさない | 理由と影響範囲を示す | 修正、再確認、回復 |
| unknown／stale | 現在状態を断定できない | 正常や不存在と別表示 | 同じIdentityで再観測 |
| restricted | 開示または操作できない | 非開示対象の存在を漏らさない | Authority確認 |

## 7. Visual Baselineの適用とArea固有差分

- Product全体のVisual Baseline参照: [v0.21基準](../../Visual/visual_baseline.md)
- Area固有の適用: 状態語、根拠、次の行動をText-firstで示す。
- Area固有の例外: N/A: v0.21にはProduct固有GUI Visualを固定しない。
- 例外の理由と適用範囲: v0.21のCLI、MCP、文書へ共通する意味表現だけを対象とする。

## 8. PatternとReusable Component

| Pattern／CMP | 利用場面 | Area固有の使い方 | 非適用条件 |
|---|---|---|---|
| 状態・根拠・次行動 | 全SCR | 同じ順序と状態語を使う | 利用者判断を持たない生データ |
| CMP | N/A | N/A: 実画面反復を未確認 | Screen固有構造しか確認できない間 |

最初の一画面だけに存在する構造を、反復確認なしにCMPへ昇格しない。

## 9. Accessibility

| 観点 | 適用 | Areaでの成立方法 | N/A／OPEN理由 |
|---|---|---|---|
| Keyboard | Applicable | 主要操作、根拠、戻り先へ順に到達する | |
| Focus | Applicable | 状態変化後も対象Contextを失わない | |
| Reading Order | Applicable | 結論から詳細への順序を保つ | |
| 色以外の識別 | Applicable | 状態語、記号、説明を併用する | |
| Text Expansion | Applicable | 省略だけで意味を失わせない | |
| Motion／Reduced Motion | N/A | | v0.21はMotionを契約化しない |

## 10. 避ける表現

- 一つの署名・設定・Credentialから、内容閲覧や実行を一律に許可する表現。
- 内部識別子、生Logまたは単一Scoreだけで利用者判断を要求する表現。

## 11. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| Product固有Visual | N/A | Qual-Lab | v0.21の意味契約には影響しない | GUI Productを設計する時にVisual探索を開始 |
| CMP昇格 | OPEN | UI工程Owner | 再利用Componentは未発行 | 複数の実画面で同じ構造が反復した時 |

## 補足分析

v0.21の異種Surfaceへ共通する意味契約をDesign Guideとして固定する。v0.22固有のVisual Directionは本書へ先取りしない。

## Checklist

- [x] Areaの目的、利用者成果、対象UI Definitionを説明できる
- [x] 情報構造と優先順位を示した
- [x] Screen InventoryとFlowを示した
- [x] Area共通のCompositionを示した
- [x] Interaction、State、FailureおよびRecoveryの原則を示した
- [x] Product Visual Baselineを複製せず、適用と例外を分けた
- [x] Pattern／CMPの利用規則と非適用条件を評価した
- [x] Accessibilityを全項目評価した
- [x] 避ける表現を明示した
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
