# UI／SPEC Detail対応

成果物種別: UI／SPEC Detail対応投影
状態: 更新中（SCR-000008／BHV-000012の限定対応レビュー済み、全体Pass再主張なし）
維持責任者: Qual-Lab

## 1. 対象と判定境界

- UI Detail改訂版: 20 SCR、20 PRT、32 Interaction
- SPEC Detail改訂版: 30 BHV
- Definition対応: [UI／SPEC対応](../06_UI_SPEC_Correspondence.md)の32組
- 判定境界: UI DetailからBHVへの操作Coverageと、BHVからUI Detailへの結果・失敗・回復Coverage

Definition対応の意味を再定義せず、同じ32組をDetailへ具体化する。今回の鍵交換2操作はUI-000008／SPEC-000012の現行DefinitionからSCR-000008／BHV-000012へ伝播した。変更はその1 Relationのみで、全体Passを再主張しない。未変更31 Relationの旧結果と、再確認対象の現在の対応を分ける。現行Definition対応とWorkbench候補横断投影は限定独立レビュー済みで、Architecture／Quality／Sourceの追従も未完了である。

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
| [SCR-000006／PRT-000006.spec-000031](../../04_UI/Details/Areas/project-context/SCR-000006/screen.md) | [BHV-000031](BHV-000031/behavior.md) | [UI-000006](../../04_UI/Definitions/UI-000006/ui_definition.md) | [SPEC-000031](../Definitions/SPEC-000031/spec_definition.md) | Covered | Tree、差分選択、Stage、Commit、Push確認、結果不明および再観測を同じContextで確認 |
| [SCR-000007／PRT-000007.spec-000011](../../04_UI/Details/Areas/operation/SCR-000007/screen.md) | [BHV-000011](BHV-000011/behavior.md) | [UI-000007](../../04_UI/Definitions/UI-000007/ui_definition.md) | [SPEC-000011](../Definitions/SPEC-000011/spec_definition.md) | Covered | 状態、操作、結果、失敗、判断不能および回復を同じContextで確認 |
| [SCR-000008／PRT-000008.spec-000012](../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | [BHV-000012](BHV-000012/behavior.md) | [UI-000008](../../04_UI/Definitions/UI-000008/ui_definition.md) | [SPEC-000012](../Definitions/SPEC-000012/spec_definition.md) | Covered（限定対応レビュー済み） | 現行Role・三可視境界、独立失効、2操作×2入口、事前表示／条件付き明示確認、情報保持、秘密一度表示、失効確定／発行不明と同じ回復・現在再観測 |
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

既存の32 InteractionとBHV接続は維持する。件数とリンクの存在だけで更新版の意味対応をPassとしない。

### SCR-000008／BHV-000012の改訂対応

| 確認対象 | UIでの認識・操作 | BHVでの条件・結果 | 現在判定 |
|---|---|---|---|
| 利用と通常管理 | 自身と対象ID・表示名・Role・権限・資格、許可内Repository | 要求毎の現行Role認可、公開／実アクセスと三可視境界 | 限定独立レビュー済み |
| 独立失効 | 対象資格と失効結果、不明時確認先 | 以後の要求拒否、新発行なし、開始済み取消非証明 | 限定独立レビュー済み |
| 2操作の範囲 | 指定対象の全旧鍵／全員の全旧鍵、既存発行先と保持情報 | 指定交換は同じuserId、全員交換は指定既存administratorへ発行。ユーザー・Role権限・登録・Product Data保持 | 限定独立レビュー済み |
| 2入口と確認 | 通常管理／Hostを分け、全4組で事前表示 | 通常×指定は追加明示確認なし、Host×指定・通常×全員・Host×全員は明示確認 | 限定独立レビュー済み |
| 失敗・結果・回復 | 前提不足は事前停止、失効確定／発行不明と同じ確認先、秘密再表示なし | Effect前拒否、応答／Process喪失後も同じ回復の非秘密耐久情報を保持し現在再観測 | 限定独立レビュー済み |

対象Screen・Behaviorを双方から照合した静的な対応確認であり、UI表示・保存・認可の実装や実E2Eを検証した結果ではない。

## 3. BHVからUIへのCoverage

| 集合 | Canonical件数 | UI Detailへ接続済み | 欠落 |
|---|---:|---:|---:|
| BHV | 30 | 30 | 0 |
| UI Interaction Relation | 32 | 32 | 0 |

上表は接続件数であり、更新版全体のPass数ではない。BHV-000012の結果・失敗・回復は今回の改訂対応表で再確認し、他29 BHVは更新前の記録を保持する。

## 4. N:N Relation

```text
20 UI Definition → 20 SCR／20 PRT
          │ 32 Interaction Relations
          ▼
       30 BHV
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
| Definition意味との不一致 | SCR-000008／BHV-000012は限定独立レビュー済み。他対象は更新前記録 | Owner Definition工程 | Detailが新しい意味を必要とした時 |
| CMP Coverage | N/A | UI工程 | Reusable Componentを発行した時 |

## 6. Architecture／Qualityへの引き渡し

- Architectureは32 Relationを配置制約として扱い、UI／SPEC Definitionの意味を変更しない。
- Qualityは各Relationの操作、Feedback、状態、結果、失敗および回復を既存検証義務へ統合する。
- 実装との一致はReality Auditで別に判定する。

## Checklist

- [x] Definition対応とDetail対応を分けた
- [x] UIからBHVへのCoverageを全件評価した
- [x] BHVからUIへのCoverageを全件評価した
- [x] 32 RelationをN:Nのまま保持した
- [x] Result、Failure、Pending、Reject、UnknownおよびRecoveryの利用者認識を評価した
- [x] UIまたはSPECの不足をDetail内で創作していない
- [x] ArchitectureとQualityへの引き渡しを明示した
- [x] N/Aに理由を記録した
