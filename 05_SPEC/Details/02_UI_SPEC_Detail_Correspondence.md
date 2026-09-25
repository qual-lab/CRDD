# UI／SPEC Detail対応

成果物種別: UI／SPEC Detail対応投影
状態: Pass
維持責任者: Qual-Lab

## 1. 対象と判定境界

- UI Detail改訂版: 20 SCR、20 PRT、31 Interaction
- SPEC Detail改訂版: 29 BHV
- Definition対応: [UI／SPEC対応](../06_UI_SPEC_Correspondence.md)の31組
- 判定境界: UI DetailからBHVへの操作Coverageと、BHVからUI Detailへの結果・失敗・回復Coverage

Definition対応の意味を再定義せず、同じ31組をDetailへ具体化する。

## 2. UIからBHVへのCoverage

| SCR／PRT／Interaction | BHV | Source UI | Source SPEC | 判定 | 保持する対応 |
|---|---|---|---|---|---|
| [SCR-000001／PRT-000001.spec-000001](../../04_UI/Details/Areas/operation/SCR-000001/screen.md) | [BHV-000001](BHV-000001/behavior.md) | [UI-000001](../../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](../Definitions/SPEC-000001/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000002／PRT-000002.spec-000002](../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | [BHV-000002](BHV-000002/behavior.md) | [UI-000002](../../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000002](../Definitions/SPEC-000002/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000002／PRT-000002.spec-000003](../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | [BHV-000003](BHV-000003/behavior.md) | [UI-000002](../../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000003](../Definitions/SPEC-000003/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000002／PRT-000002.spec-000028](../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | [BHV-000028](BHV-000028/behavior.md) | [UI-000002](../../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000028](../Definitions/SPEC-000028/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000002／PRT-000002.spec-000029](../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | [BHV-000029](BHV-000029/behavior.md) | [UI-000002](../../04_UI/Definitions/UI-000002/ui_definition.md) | [SPEC-000029](../Definitions/SPEC-000029/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000003／PRT-000003.spec-000004](../../04_UI/Details/Areas/operation/SCR-000003/screen.md) | [BHV-000004](BHV-000004/behavior.md) | [UI-000003](../../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000004](../Definitions/SPEC-000004/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000003／PRT-000003.spec-000005](../../04_UI/Details/Areas/operation/SCR-000003/screen.md) | [BHV-000005](BHV-000005/behavior.md) | [UI-000003](../../04_UI/Definitions/UI-000003/ui_definition.md) | [SPEC-000005](../Definitions/SPEC-000005/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000004／PRT-000004.spec-000002](../../04_UI/Details/Areas/project-context/SCR-000004/screen.md) | [BHV-000002](BHV-000002/behavior.md) | [UI-000004](../../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000002](../Definitions/SPEC-000002/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000004／PRT-000004.spec-000006](../../04_UI/Details/Areas/project-context/SCR-000004/screen.md) | [BHV-000006](BHV-000006/behavior.md) | [UI-000004](../../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000006](../Definitions/SPEC-000006/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000004／PRT-000004.spec-000007](../../04_UI/Details/Areas/project-context/SCR-000004/screen.md) | [BHV-000007](BHV-000007/behavior.md) | [UI-000004](../../04_UI/Definitions/UI-000004/ui_definition.md) | [SPEC-000007](../Definitions/SPEC-000007/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000005／PRT-000005.spec-000008](../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | [BHV-000008](BHV-000008/behavior.md) | [UI-000005](../../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000008](../Definitions/SPEC-000008/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000005／PRT-000005.spec-000009](../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | [BHV-000009](BHV-000009/behavior.md) | [UI-000005](../../04_UI/Definitions/UI-000005/ui_definition.md) | [SPEC-000009](../Definitions/SPEC-000009/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000006／PRT-000006.spec-000010](../../04_UI/Details/Areas/project-context/SCR-000006/screen.md) | [BHV-000010](BHV-000010/behavior.md) | [UI-000006](../../04_UI/Definitions/UI-000006/ui_definition.md) | [SPEC-000010](../Definitions/SPEC-000010/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000007／PRT-000007.spec-000011](../../04_UI/Details/Areas/operation/SCR-000007/screen.md) | [BHV-000011](BHV-000011/behavior.md) | [UI-000007](../../04_UI/Definitions/UI-000007/ui_definition.md) | [SPEC-000011](../Definitions/SPEC-000011/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000008／PRT-000008.spec-000012](../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | [BHV-000012](BHV-000012/behavior.md) | [UI-000008](../../04_UI/Definitions/UI-000008/ui_definition.md) | [SPEC-000012](../Definitions/SPEC-000012/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000009／PRT-000009.spec-000013](../../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | [BHV-000013](BHV-000013/behavior.md) | [UI-000009](../../04_UI/Definitions/UI-000009/ui_definition.md) | [SPEC-000013](../Definitions/SPEC-000013/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000010／PRT-000010.spec-000014](../../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | [BHV-000014](BHV-000014/behavior.md) | [UI-000010](../../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000014](../Definitions/SPEC-000014/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000010／PRT-000010.spec-000015](../../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | [BHV-000015](BHV-000015/behavior.md) | [UI-000010](../../04_UI/Definitions/UI-000010/ui_definition.md) | [SPEC-000015](../Definitions/SPEC-000015/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000011／PRT-000011.spec-000005](../../04_UI/Details/Areas/configuration-trust/SCR-000011/screen.md) | [BHV-000005](BHV-000005/behavior.md) | [UI-000011](../../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000005](../Definitions/SPEC-000005/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000011／PRT-000011.spec-000016](../../04_UI/Details/Areas/configuration-trust/SCR-000011/screen.md) | [BHV-000016](BHV-000016/behavior.md) | [UI-000011](../../04_UI/Definitions/UI-000011/ui_definition.md) | [SPEC-000016](../Definitions/SPEC-000016/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000012／PRT-000012.spec-000017](../../04_UI/Details/Areas/operation/SCR-000012/screen.md) | [BHV-000017](BHV-000017/behavior.md) | [UI-000012](../../04_UI/Definitions/UI-000012/ui_definition.md) | [SPEC-000017](../Definitions/SPEC-000017/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000013／PRT-000013.spec-000018](../../04_UI/Details/Areas/configuration-trust/SCR-000013/screen.md) | [BHV-000018](BHV-000018/behavior.md) | [UI-000013](../../04_UI/Definitions/UI-000013/ui_definition.md) | [SPEC-000018](../Definitions/SPEC-000018/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000014／PRT-000014.spec-000019](../../04_UI/Details/Areas/governance/SCR-000014/screen.md) | [BHV-000019](BHV-000019/behavior.md) | [UI-000014](../../04_UI/Definitions/UI-000014/ui_definition.md) | [SPEC-000019](../Definitions/SPEC-000019/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000015／PRT-000015.spec-000020](../../04_UI/Details/Areas/governance/SCR-000015/screen.md) | [BHV-000020](BHV-000020/behavior.md) | [UI-000015](../../04_UI/Definitions/UI-000015/ui_definition.md) | [SPEC-000020](../Definitions/SPEC-000020/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000016／PRT-000016.spec-000021](../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | [BHV-000021](BHV-000021/behavior.md) | [UI-000016](../../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000021](../Definitions/SPEC-000021/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000016／PRT-000016.spec-000026](../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | [BHV-000026](BHV-000026/behavior.md) | [UI-000016](../../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000026](../Definitions/SPEC-000026/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000016／PRT-000016.spec-000027](../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | [BHV-000027](BHV-000027/behavior.md) | [UI-000016](../../04_UI/Definitions/UI-000016/ui_definition.md) | [SPEC-000027](../Definitions/SPEC-000027/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000017／PRT-000017.spec-000022](../../04_UI/Details/Areas/project-context/SCR-000017/screen.md) | [BHV-000022](BHV-000022/behavior.md) | [UI-000017](../../04_UI/Definitions/UI-000017/ui_definition.md) | [SPEC-000022](../Definitions/SPEC-000022/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000018／PRT-000018.spec-000023](../../04_UI/Details/Areas/project-context/SCR-000018/screen.md) | [BHV-000023](BHV-000023/behavior.md) | [UI-000018](../../04_UI/Definitions/UI-000018/ui_definition.md) | [SPEC-000023](../Definitions/SPEC-000023/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000019／PRT-000019.spec-000024](../../04_UI/Details/Areas/project-context/SCR-000019/screen.md) | [BHV-000024](BHV-000024/behavior.md) | [UI-000019](../../04_UI/Definitions/UI-000019/ui_definition.md) | [SPEC-000024](../Definitions/SPEC-000024/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000020／PRT-000020.spec-000030](../../04_UI/Details/Areas/operation/SCR-000020/screen.md) | [BHV-000030](BHV-000030/behavior.md) | [UI-000020](../../04_UI/Definitions/UI-000020/ui_definition.md) | [SPEC-000030](../Definitions/SPEC-000030/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |

全31 Interactionに対応BHVが存在する。表示だけで完了するInteractionや、対応Behaviorを暗黙に実装へ委ねたInteractionはない。

## 3. BHVからUIへのCoverage

| 集合 | Canonical件数 | UI Detailへ接続済み | 欠落 |
|---|---:|---:|---:|
| BHV | 29 | 29 | 0 |
| UI Interaction Relation | 31 | 31 | 0 |

全BHVについて、Success、Reject、Failure、UnknownまたはRecoveryのうち利用者認識が必要な結果を、対応SCR／PRTのState／VariantとFeedbackへ接続した。

## 4. N:N Relation

```text
20 UI Definition → 20 SCR／20 PRT
          │ 31 Interaction Relations
          ▼
       29 BHV
          │
          ▼
18 ARCH責務／13 Quality検証目標
```

`UI-000002`、`UI-000003`、`UI-000004`、`UI-000005`、`UI-000010`、`UI-000011`、`UI-000016`は複数BHVを持つ。`SPEC-000002`と`SPEC-000005`は複数Screenで利用される。1:1へ畳まず、各Relationを独立して保持する。

## 5. Gap／戻り条件

| 項目 | 判定 | Owner | 戻り条件 |
|---|---|---|---|
| UI InteractionにBHVがない | 0件 | UI／SPEC工程 | 新Interaction追加時 |
| BHV結果を認識できるUIがない | 0件 | UI／SPEC工程 | 新BHV追加時 |
| Definition意味との不一致 | 0件 | Owner Definition工程 | Detailが新しい意味を必要とした時 |
| CMP Coverage | N/A | UI工程 | Reusable Componentを発行した時 |

## 6. Architecture／Qualityへの引き渡し

- Architectureは31 Relationを配置制約として扱い、UI／SPEC Definitionの意味を変更しない。
- Qualityは各Relationの操作、Feedback、状態、結果、失敗および回復を既存検証義務へ統合する。
- 実装との一致はReality Auditで別に判定する。

## Checklist

- [x] Definition対応とDetail対応を分けた
- [x] UIからBHVへのCoverageを全件評価した
- [x] BHVからUIへのCoverageを全件評価した
- [x] 31 RelationをN:Nのまま保持した
- [x] Result、Failure、Pending、Reject、UnknownおよびRecoveryの利用者認識を評価した
- [x] UIまたはSPECの不足をDetail内で創作していない
- [x] ArchitectureとQualityへの引き渡しを明示した
- [x] N/Aに理由を記録した
