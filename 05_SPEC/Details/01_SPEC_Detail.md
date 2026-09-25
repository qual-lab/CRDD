# SPEC Detail

成果物種別: SPEC Detail統合投影
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的と移行境界

v0.21.0でCanonical化した29件のSPEC Definitionを、新しいSPEC Detail契約へ全件移行した。BHVはSource、ArchitectureまたはWIPから逆算せず、各SPEC DefinitionのTrigger、Precondition、Authority、State、Effect、Result、FailureおよびRecoveryから導出した。

```text
29 SPEC Definition
       ↓ 全件処置
29 BHV
       ↓
31 UI Detail Relation
       ↓
18 ARCH責務 + 13 Quality検証目標
```

## 2. SPEC Definitionの処置

| SPEC ID | SPEC Definition | Detail適用 | BHV | 理由 |
|---|---|---|---|---|
| `SPEC-000001` | 事前検査を実行し意味レビューへ案内する | Applicable／Covered | [BHV-000001](BHV-000001/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000002` | 委任範囲と権限を確定して受理する | Applicable／Covered | [BHV-000002](BHV-000002/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000003` | 委任した仕事の状態と判断要否を返す | Applicable／Covered | [BHV-000003](BHV-000003/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000004` | 失敗後の再試行と回復を安全に選別する | Applicable／Covered | [BHV-000004](BHV-000004/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000005` | 残存資源を清掃し終了後を確認する | Applicable／Covered | [BHV-000005](BHV-000005/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000006` | Projectと節目の現在状態を投影する | Applicable／Covered | [BHV-000006](BHV-000006/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000007` | 複数Projectを比較可能な投影へ統合する | Applicable／Covered | [BHV-000007](BHV-000007/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000008` | 実行事実と評価を区別して取得する | Applicable／Covered | [BHV-000008](BHV-000008/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000009` | 実行基盤の故障境界と利用可能範囲を診断する | Applicable／Covered | [BHV-000009](BHV-000009/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000010` | Repositoryと実行対象のBindingを解決する | Applicable／Covered | [BHV-000010](BHV-000010/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000011` | 複数入口で同じ依頼・結果契約を保つ | Applicable／Covered | [BHV-000011](BHV-000011/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000012` | 接続資格からWorkspace利用範囲を確定する | Applicable／Covered | [BHV-000012](BHV-000012/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000013` | Meeting内容を候補化し所有正本へ昇格する | Applicable／Covered | [BHV-000013](BHV-000013/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000014` | Repositoryに適合する標準Toolを解決する | Applicable／Covered | [BHV-000014](BHV-000014/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000015` | AIモデル構成を検証し実効選択を決める | Applicable／Covered | [BHV-000015](BHV-000015/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000016` | 実行時データの配置・保持・清掃を制御する | Applicable／Covered | [BHV-000016](BHV-000016/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000017` | Task情報と結果を同じ仕事へ引き継ぎ再取得する | Applicable／Covered | [BHV-000017](BHV-000017/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000018` | Runtimeの信頼要素を独立評価する | Applicable／Covered | [BHV-000018](BHV-000018/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000019` | 責務変更後の利用側閉包を検証する | Applicable／Covered | [BHV-000019](BHV-000019/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000020` | 変更・監査・試験・品質の閉包を評価する | Applicable／Covered | [BHV-000020](BHV-000020/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000021` | 外部送信の同意範囲を検証して送信する | Applicable／Covered | [BHV-000021](BHV-000021/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000022` | 過去情報と現在有効な意図を区別して解決する | Applicable／Covered | [BHV-000022](BHV-000022/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000023` | 文書の物語・構造・図と工程引継ぎを検査する | Applicable／Covered | [BHV-000023](BHV-000023/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000024` | 公式素材の由来・権利・用途を確認する | Applicable／Covered | [BHV-000024](BHV-000024/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000026` | 外部処理の結果を元の仕事へ持ち帰る | Applicable／Covered | [BHV-000026](BHV-000026/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000027` | 持ち帰った候補を所有正本へ昇格する | Applicable／Covered | [BHV-000027](BHV-000027/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000028` | Taskの取消と終了確認 | Applicable／Covered | [BHV-000028](BHV-000028/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000029` | 判断待ちTaskへの判断返却 | Applicable／Covered | [BHV-000029](BHV-000029/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000030` | 実行事実を同じ契約で記録する | Applicable／Covered | [BHV-000030](BHV-000030/behavior.md) | Canonical Definitionから導出 |

## 3. BHV Inventory

| BHV | 目的 | Source SPEC | UI Detail Coverage |
|---|---|---|---|
| [BHV-000001](BHV-000001/behavior.md) | 事前検査を実行し意味レビューへ案内する | [SPEC-000001](../Definitions/SPEC-000001/spec_definition.md) | Covered |
| [BHV-000002](BHV-000002/behavior.md) | 委任範囲と権限を確定して受理する | [SPEC-000002](../Definitions/SPEC-000002/spec_definition.md) | Covered |
| [BHV-000003](BHV-000003/behavior.md) | 委任した仕事の状態と判断要否を返す | [SPEC-000003](../Definitions/SPEC-000003/spec_definition.md) | Covered |
| [BHV-000004](BHV-000004/behavior.md) | 失敗後の再試行と回復を安全に選別する | [SPEC-000004](../Definitions/SPEC-000004/spec_definition.md) | Covered |
| [BHV-000005](BHV-000005/behavior.md) | 残存資源を清掃し終了後を確認する | [SPEC-000005](../Definitions/SPEC-000005/spec_definition.md) | Covered |
| [BHV-000006](BHV-000006/behavior.md) | Projectと節目の現在状態を投影する | [SPEC-000006](../Definitions/SPEC-000006/spec_definition.md) | Covered |
| [BHV-000007](BHV-000007/behavior.md) | 複数Projectを比較可能な投影へ統合する | [SPEC-000007](../Definitions/SPEC-000007/spec_definition.md) | Covered |
| [BHV-000008](BHV-000008/behavior.md) | 実行事実と評価を区別して取得する | [SPEC-000008](../Definitions/SPEC-000008/spec_definition.md) | Covered |
| [BHV-000009](BHV-000009/behavior.md) | 実行基盤の故障境界と利用可能範囲を診断する | [SPEC-000009](../Definitions/SPEC-000009/spec_definition.md) | Covered |
| [BHV-000010](BHV-000010/behavior.md) | Repositoryと実行対象のBindingを解決する | [SPEC-000010](../Definitions/SPEC-000010/spec_definition.md) | Covered |
| [BHV-000011](BHV-000011/behavior.md) | 複数入口で同じ依頼・結果契約を保つ | [SPEC-000011](../Definitions/SPEC-000011/spec_definition.md) | Covered |
| [BHV-000012](BHV-000012/behavior.md) | 接続資格からWorkspace利用範囲を確定する | [SPEC-000012](../Definitions/SPEC-000012/spec_definition.md) | Covered |
| [BHV-000013](BHV-000013/behavior.md) | Meeting内容を候補化し所有正本へ昇格する | [SPEC-000013](../Definitions/SPEC-000013/spec_definition.md) | Covered |
| [BHV-000014](BHV-000014/behavior.md) | Repositoryに適合する標準Toolを解決する | [SPEC-000014](../Definitions/SPEC-000014/spec_definition.md) | Covered |
| [BHV-000015](BHV-000015/behavior.md) | AIモデル構成を検証し実効選択を決める | [SPEC-000015](../Definitions/SPEC-000015/spec_definition.md) | Covered |
| [BHV-000016](BHV-000016/behavior.md) | 実行時データの配置・保持・清掃を制御する | [SPEC-000016](../Definitions/SPEC-000016/spec_definition.md) | Covered |
| [BHV-000017](BHV-000017/behavior.md) | Task情報と結果を同じ仕事へ引き継ぎ再取得する | [SPEC-000017](../Definitions/SPEC-000017/spec_definition.md) | Covered |
| [BHV-000018](BHV-000018/behavior.md) | Runtimeの信頼要素を独立評価する | [SPEC-000018](../Definitions/SPEC-000018/spec_definition.md) | Covered |
| [BHV-000019](BHV-000019/behavior.md) | 責務変更後の利用側閉包を検証する | [SPEC-000019](../Definitions/SPEC-000019/spec_definition.md) | Covered |
| [BHV-000020](BHV-000020/behavior.md) | 変更・監査・試験・品質の閉包を評価する | [SPEC-000020](../Definitions/SPEC-000020/spec_definition.md) | Covered |
| [BHV-000021](BHV-000021/behavior.md) | 外部送信の同意範囲を検証して送信する | [SPEC-000021](../Definitions/SPEC-000021/spec_definition.md) | Covered |
| [BHV-000022](BHV-000022/behavior.md) | 過去情報と現在有効な意図を区別して解決する | [SPEC-000022](../Definitions/SPEC-000022/spec_definition.md) | Covered |
| [BHV-000023](BHV-000023/behavior.md) | 文書の物語・構造・図と工程引継ぎを検査する | [SPEC-000023](../Definitions/SPEC-000023/spec_definition.md) | Covered |
| [BHV-000024](BHV-000024/behavior.md) | 公式素材の由来・権利・用途を確認する | [SPEC-000024](../Definitions/SPEC-000024/spec_definition.md) | Covered |
| [BHV-000026](BHV-000026/behavior.md) | 外部処理の結果を元の仕事へ持ち帰る | [SPEC-000026](../Definitions/SPEC-000026/spec_definition.md) | Covered |
| [BHV-000027](BHV-000027/behavior.md) | 持ち帰った候補を所有正本へ昇格する | [SPEC-000027](../Definitions/SPEC-000027/spec_definition.md) | Covered |
| [BHV-000028](BHV-000028/behavior.md) | Taskの取消と終了確認 | [SPEC-000028](../Definitions/SPEC-000028/spec_definition.md) | Covered |
| [BHV-000029](BHV-000029/behavior.md) | 判断待ちTaskへの判断返却 | [SPEC-000029](../Definitions/SPEC-000029/spec_definition.md) | Covered |
| [BHV-000030](BHV-000030/behavior.md) | 実行事実を同じ契約で記録する | [SPEC-000030](../Definitions/SPEC-000030/spec_definition.md) | Covered |

各BHVは一つのSource SPECを詳細化する。複数SPECが同じArchitectureまたはQuality目標へ収束しても、Trigger、Authority、Effect、FailureまたはResultが独立して変更・検証できるためBHVを統合しない。

## 4. UI／SPEC Detail対応

[UI／SPEC Detail対応](02_UI_SPEC_Detail_Correspondence.md)で31 Relationを双方向に全件評価した。UIを必要としないBHVはなく、全BHVが一つ以上のSCR／PRT／Interactionへ接続されている。

## 5. Architecture／Qualityへの引き渡し

- Architecture: 各BHVをSource SPECが接続済みのARCH責務へ配置制約として渡す。
- Quality: 各BHVのNormal、Boundary、Failure、UnknownおよびRecoveryを既存の検証義務へ統合する。
- Source／Test: Canonical BHV成立後のReality Auditで照合し、BHVを実装から逆算しない。

## 6. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| v0.22固有BHV | OPEN | SPEC工程Owner | v0.21移行には影響しない | v0.22の新しいSPEC Definitionを固定した時 |
| 実装との一致 | OPEN | Reality Audit Owner | Canonical Detailの成立には影響しない | v0.22 Reality Auditで照合する時 |

## 補足分析

本移行はv0.21 SPEC Definitionの意味を変更しない。v0.22固有のDetailed Behaviorは新しいCanonical Definitionから別途追加する。

## Checklist

- [x] v0.21のSPEC Definition 29件を全数処置した
- [x] 29 BHVをSource SPECから導出した
- [x] Trigger、Precondition、Authority、Input、Validation、State、Sequence、Effect、Output、FailureおよびRecoveryを全件評価した
- [x] UI Detailとの双方向Coverageを評価した
- [x] ArchitectureとQualityへの伝播先を示した
- [x] Source、ArchitectureまたはWIPからBHVを逆算していない
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
