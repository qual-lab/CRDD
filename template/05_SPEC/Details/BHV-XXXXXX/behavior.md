# BHV-XXXXXX <Detailed Behavior表示名>

成果物種別: SPEC Detail
Behavior ID: `BHV-XXXXXX`
状態: `<Draft／Canonical／OPEN>`
維持責任者: `<人間またはチーム>`

## 1. 目的とSource Definition

- 目的:
- Source SPEC:
- 対象利用側:
- 対象外:

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | `Applicable／N/A／OPEN` | |
| Precondition | `Applicable／N/A／OPEN` | |
| Authority | `Applicable／N/A／OPEN` | |
| Input | `Applicable／N/A／OPEN` | |
| Validation | `Applicable／N/A／OPEN` | |
| State／Transition | `Applicable／N/A／OPEN` | |
| Sequence | `Applicable／N/A／OPEN` | |
| Effect | `Applicable／N/A／OPEN` | |
| Output | `Applicable／N/A／OPEN` | |
| Failure | `Applicable／N/A／OPEN` | |
| Recovery | `Applicable／N/A／OPEN` | |

## 3. Behavior Flow

```text
Trigger
  ↓
Precondition／Authority／Validation
  ↓
State／Sequence／Effect
  ↓
Output
  ├ Success
  ├ Reject
  ├ Failure
  └ Unknown／Recovery
```

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| | | | `Covered／N/A／OPEN／Gap` |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | | |
| Boundary | | |
| Failure | | |
| Unknown | | |
| Recovery | | |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract:
- 配置を固定してはならない事項:
- Architectureで決める事項:

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| | | | | |

## 補足分析

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 独立したTriggerまたはResultを持つ
- [ ] Source SPECへ接続した
- [ ] TriggerからRecoveryまで全観点を評価した
- [ ] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [ ] Normal、Boundary、Failure、UnknownおよびRecoveryを評価した
- [ ] UI認識が必要な結果をUI Detailへ接続した
- [ ] Architecture方式やSource実装を先取りしていない
- [ ] 新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない
