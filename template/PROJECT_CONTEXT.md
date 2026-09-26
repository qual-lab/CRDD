# Project Context

Project ID: `<project-id／OPEN: 理由>`
Repository ID: `<repository-id／OPEN: 理由>`
Repository Role: `<repository-role／OPEN: 理由>`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

<現在地を数文で示す。>

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | <項目> | <状態> | `<Owner IDまたは名称>: <path>` |

## 2. 何が危ない、または止まっているか

### 結論

<重要なRiskと停止を数文で示す。該当がない場合も、なし（確認済み）または不明: 理由を示す。>

| 種別 | 結論 | 影響 | 根拠 |
|---|---|---|---|
| 現在事実 | <Ownerが管理するRisk> | <影響> | `<Owner IDまたは名称>: <path>` |
| 共有分析 | <複数正本から導いた分析> | <影響> | `<Source A>: <path>、<Source B>: <path>` |

## 3. 今、人間が決めることは何か

### 結論

<現在必要な判断の有無を示す。>

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| <判断／なし（確認済み）／不明: 理由> | <Authority> | <必要最小限の説明> | `<Owner>: <path>` |

## 4. なぜこの状態・判断になったか

### 結論

<主要な理由を数文で示す。>

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| <結論> | <必要最小限の理由> | `<Owner>: <path>` |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| <候補／なし（確認済み）／不明: 理由> | <理由または再評価条件> | `<Owner>: <path>` |

## Checklist

- [ ] Project ID、Repository IDおよびRepository Roleを評価した。
- [ ] 三つのIdentityがRepository Manifestと一致している。
- [ ] 五場面を省略せず、結論を先に示した。
- [ ] 現在事実と共有分析を区別した。
- [ ] 正本が存在する内容をOwner Relationへ接続した。
- [ ] Project Context固有の安定IDを追加していない。
- [ ] 項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。
- [ ] 確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。
- [ ] Owner Artifactとの競合時はProject Contextを現在値として使わない。
- [ ] 保存済みの次候補と対話時の追加提案を区別できる。
- [ ] Gateを閉じる前に再投影要否を評価する。
