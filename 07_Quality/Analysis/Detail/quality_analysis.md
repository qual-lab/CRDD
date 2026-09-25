# UI／SPEC DetailのQuality分析

成果物種別: Quality分析（UI／SPEC Detail観点）
分析Origin: `UI Detail／SPEC Detail`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的

発行済みのSCR／PRT／Interaction／BHVを全件処置し、既存Definitionから導出済みの検証目標へ具体的な観測条件を追加する。Detailごとの新しいQA-IDを機械的に作らず、同じ意味の検証義務へ統合する。

## 2. UI Detail Coverage

| Detail ID | Source UI | 観測する意味 | 統合先QA | 処置 |
|---|---|---|---|---|
| SCR-000001／PRT-000001 | UI-000001 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000001 | Mapped |
| SCR-000002／PRT-000002 | UI-000002 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000003 | Mapped |
| SCR-000003／PRT-000003 | UI-000003 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000003、QA-000008 | Mapped |
| SCR-000004／PRT-000004 | UI-000004 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000004 | Mapped |
| SCR-000005／PRT-000005 | UI-000005 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000004、QA-000006 | Mapped |
| SCR-000006／PRT-000006 | UI-000006 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000001、QA-000007 | Mapped |
| SCR-000007／PRT-000007 | UI-000007 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000009 | Mapped |
| SCR-000008／PRT-000008 | UI-000008 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000007 | Mapped |
| SCR-000009／PRT-000009 | UI-000009 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000005 | Mapped |
| SCR-000010／PRT-000010 | UI-000010 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000001、QA-000006 | Mapped |
| SCR-000011／PRT-000011 | UI-000011 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000008 | Mapped |
| SCR-000012／PRT-000012 | UI-000012 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000003、QA-000009 | Mapped |
| SCR-000013／PRT-000013 | UI-000013 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000010 | Mapped |
| SCR-000014／PRT-000014 | UI-000014 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000001 | Mapped |
| SCR-000015／PRT-000015 | UI-000015 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000002 | Mapped |
| SCR-000016／PRT-000016 | UI-000016 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000005、QA-000009 | Mapped |
| SCR-000017／PRT-000017 | UI-000017 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000004 | Mapped |
| SCR-000018／PRT-000018 | UI-000018 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000013 | Mapped |
| SCR-000019／PRT-000019 | UI-000019 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000011 | Mapped |
| SCR-000020／PRT-000020 | UI-000020 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する | QA-000012 | Mapped |

## 3. SPEC Detail Coverage

| Detail ID | Source SPEC | 観測する意味 | 統合先QA | 処置 |
|---|---|---|---|---|
| BHV-000001 | SPEC-000001 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000001 | Mapped |
| BHV-000002 | SPEC-000002 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003 | Mapped |
| BHV-000003 | SPEC-000003 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003 | Mapped |
| BHV-000004 | SPEC-000004 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003 | Mapped |
| BHV-000005 | SPEC-000005 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003、QA-000008 | Mapped |
| BHV-000006 | SPEC-000006 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000004 | Mapped |
| BHV-000007 | SPEC-000007 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000004 | Mapped |
| BHV-000008 | SPEC-000008 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000004 | Mapped |
| BHV-000009 | SPEC-000009 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000006 | Mapped |
| BHV-000010 | SPEC-000010 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000007 | Mapped |
| BHV-000011 | SPEC-000011 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000009 | Mapped |
| BHV-000012 | SPEC-000012 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000007 | Mapped |
| BHV-000013 | SPEC-000013 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000005 | Mapped |
| BHV-000014 | SPEC-000014 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000001 | Mapped |
| BHV-000015 | SPEC-000015 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000006 | Mapped |
| BHV-000016 | SPEC-000016 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000008 | Mapped |
| BHV-000017 | SPEC-000017 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003、QA-000009 | Mapped |
| BHV-000018 | SPEC-000018 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000010 | Mapped |
| BHV-000019 | SPEC-000019 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000001 | Mapped |
| BHV-000020 | SPEC-000020 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000002 | Mapped |
| BHV-000021 | SPEC-000021 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000009 | Mapped |
| BHV-000022 | SPEC-000022 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000004 | Mapped |
| BHV-000023 | SPEC-000023 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000013 | Mapped |
| BHV-000024 | SPEC-000024 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000011 | Mapped |
| BHV-000026 | SPEC-000026 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000009 | Mapped |
| BHV-000027 | SPEC-000027 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000005 | Mapped |
| BHV-000028 | SPEC-000028 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003 | Mapped |
| BHV-000029 | SPEC-000029 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000003 | Mapped |
| BHV-000030 | SPEC-000030 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する | QA-000012 | Mapped |

## 4. Interaction Coverage

次表は、[UI／SPEC Detail対応](../../../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)の全Relationを、検証責務を所有するQAへ統合した中央投影である。各QA Definitionは自身が所有するRelationだけを局所投影として保持する。UI側とBHV側の共通QAが1件なら`Single`、複数なら`Shared`、共通QAがなく両側のQAを共同Ownerとして保持する場合は`Joint`とする。

| Interaction Relation | BHV | Quality Relation Owner | Owner Mode | Coverage |
|---|---|---|---|---|
| `PRT-000001.spec-000001` | BHV-000001 | QA-000001 | Single | Mapped |
| `PRT-000002.spec-000002` | BHV-000002 | QA-000003 | Single | Mapped |
| `PRT-000002.spec-000003` | BHV-000003 | QA-000003 | Single | Mapped |
| `PRT-000002.spec-000028` | BHV-000028 | QA-000003 | Single | Mapped |
| `PRT-000002.spec-000029` | BHV-000029 | QA-000003 | Single | Mapped |
| `PRT-000003.spec-000004` | BHV-000004 | QA-000003 | Single | Mapped |
| `PRT-000003.spec-000005` | BHV-000005 | QA-000003、QA-000008 | Shared | Mapped |
| `PRT-000004.spec-000002` | BHV-000002 | QA-000003、QA-000004 | Joint | Mapped |
| `PRT-000004.spec-000006` | BHV-000006 | QA-000004 | Single | Mapped |
| `PRT-000004.spec-000007` | BHV-000007 | QA-000004 | Single | Mapped |
| `PRT-000005.spec-000008` | BHV-000008 | QA-000004 | Single | Mapped |
| `PRT-000005.spec-000009` | BHV-000009 | QA-000006 | Single | Mapped |
| `PRT-000006.spec-000010` | BHV-000010 | QA-000007 | Single | Mapped |
| `PRT-000007.spec-000011` | BHV-000011 | QA-000009 | Single | Mapped |
| `PRT-000008.spec-000012` | BHV-000012 | QA-000007 | Single | Mapped |
| `PRT-000009.spec-000013` | BHV-000013 | QA-000005 | Single | Mapped |
| `PRT-000010.spec-000014` | BHV-000014 | QA-000001 | Single | Mapped |
| `PRT-000010.spec-000015` | BHV-000015 | QA-000006 | Single | Mapped |
| `PRT-000011.spec-000005` | BHV-000005 | QA-000008 | Single | Mapped |
| `PRT-000011.spec-000016` | BHV-000016 | QA-000008 | Single | Mapped |
| `PRT-000012.spec-000017` | BHV-000017 | QA-000003、QA-000009 | Shared | Mapped |
| `PRT-000013.spec-000018` | BHV-000018 | QA-000010 | Single | Mapped |
| `PRT-000014.spec-000019` | BHV-000019 | QA-000001 | Single | Mapped |
| `PRT-000015.spec-000020` | BHV-000020 | QA-000002 | Single | Mapped |
| `PRT-000016.spec-000021` | BHV-000021 | QA-000009 | Single | Mapped |
| `PRT-000016.spec-000026` | BHV-000026 | QA-000009 | Single | Mapped |
| `PRT-000016.spec-000027` | BHV-000027 | QA-000005 | Single | Mapped |
| `PRT-000017.spec-000022` | BHV-000022 | QA-000004 | Single | Mapped |
| `PRT-000018.spec-000023` | BHV-000023 | QA-000013 | Single | Mapped |
| `PRT-000019.spec-000024` | BHV-000024 | QA-000011 | Single | Mapped |
| `PRT-000020.spec-000030` | BHV-000030 | QA-000012 | Single | Mapped |

`PRT-000004.spec-000002`は、委任・受入Contractの検証を所有するQA-000003と、Project Viewでの判断可能性を所有するQA-000004をまたぐ。片方の検証で全体成立を推定せず、両方の観測結果で同じInteractionを閉じる。

各Interactionについて、次を既存QA Local Itemへ統合する。

- 利用者操作から対応BHVへ到達できる。
- BHVのSuccess、Reject、Failure、UnknownおよびRecoveryがUI上で区別される。
- System Behaviorを伴うInteractionにBHV欠落がない。
- 利用者認識を要するBHV結果にSCR／PRT欠落がない。

## 5. 検証段階

| Detail | 主な検証段階 | 理由 |
|---|---|---|
| SCR／PRT | ST／UAT | 画面・Surface上の理解、操作、Feedbackと利用者成果を確認する |
| Interaction | IT／ST／UAT | UI操作とBHV境界、System結果の表示、利用者判断を段階的に確認する |
| BHV | UT／IT／ST | 局所Contract、境界協調、End-to-End Behaviorを意味に応じて確認する |
| Visual Baseline／Area Guide | ST／UAT | 情報優先度、Reading Order、Accessibilityおよび人間の理解を確認する |

固定対応ではない。各QA Local Itemの既存Levelを維持し、Detailが新しい観測境界を実証した場合だけLocal Itemを追加または分割する。

## 6. 未確認事項

| 項目 | 判定 | 理由／戻り条件 |
|---|---|---|
| CMP固有検証 | N/A | CMP未発行。複数実画面で反復を確認しCMPへ昇格した時に再分析する |
| Product固有GUIのVisual回帰 | OPEN | v0.22でHuman DirectionとVisual Baselineを採用した時に追加する |
| v0.21 Detailの意味Coverage | Covered | 20 SCR、20 PRT、29 BHV、31 Interactionを既存QAへ接続した |

## Checklist

- [x] 全20 SCRと20 PRTを処置した
- [x] 全29 BHVを処置した
- [x] 全31 Interaction Relationを個別にQuality Relation Ownerへ接続した
- [x] 各発行済みDetailを一件以上のQA-IDへ接続した
- [x] Detailごとに重複QA-IDを機械発行していない
- [x] UI／SPEC Definition由来の意味とDetail由来の観測条件を区別した
- [x] CMP未発行を理由付きN/Aとして処置した
- [x] v0.22固有Visual判断を先取りしていない
