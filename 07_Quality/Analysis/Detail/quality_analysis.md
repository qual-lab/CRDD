# UI／SPEC DetailのQuality分析

成果物種別: Quality分析（UI／SPEC Detail観点）
分析Origin: `UI Detail／SPEC Detail`
状態: Canonical
維持責任者: Qual-Lab

現在の`PRT-000008.spec-000012`導出は、初回限定接続の応答と次要求の通常認証を区別し、追加受領操作0を確認する。関係・処置状態のfieldへ合否条件を混在させず、QA-000007の既存初回項目へ渡す。Source／実行は未完了、この差分の独立レビューは待機中。

現在の通常管理は、Role別分担9行に対応する11認可要求種別と、User4＋Repository3の通常保存7操作を区別してQA-000007へ導出する。ProfileのCatalog更新・鍵Lifecycle・初回／Host交換は通常保存7操作に含めない。下段の2026-10-11限定再導出は当時の履歴であり、「固定8」「通常6」を現行母集合として使用しない。今回の計数同期は限定独立再レビューPass・全重大度の残指摘0。正式191項目はNot Runを維持し、Source／実接続・全体完成の成立へ読み替えない。

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
| SCR-000008／PRT-000008 | UI-000008 | Screen目的、情報、操作、Feedback、状態、失敗、Unknownおよび回復がSource UIの意味を保持する。解除の両読戻しと取消非証明、元発行不明の再観測・確定受け渡し未確認後の明示的な別交換・現在管理者認証未接続／喪失時の既存Hostという表示／導線を保持する。秘密再表示・自動再発行・失効鍵の遅延利用案内を反証する。通常の一度提示は操作administrator画面だけ・追加受領ボタンなし。初回はHost提示の案内と、限定接続確認後の通常利用へ進む表示を評価する。 | QA-000007 | Mapped ／初回項目へ定義接続・Not Run |
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
| BHV-000012 | SPEC-000012 | Trigger、Precondition、Authority、Validation、State、Effect、Result、FailureおよびRecoveryがSource SPECの意味を保持する。解除の同一受理操作・採用改訂による登録／Exposure両除去読戻し、対象外／本体保持と旧取消非証明を確認する。元発行Identity≠Credential ID、通常発行Recovery0／交換由来元exact、確定後の現在admin明示による別Operation／Recovery交換、各交換内exactと先の鍵を含む対象集合、現在admin認証未接続／喪失時の既存Host2のみを確認する。通常本人受領を記録せず、初回同鍵接続の確認保存・読戻し・清掃／Lock終了前は応答と通常権限0を確認する。 | QA-000007 | Mapped ／初回項目へ定義接続・Not Run |
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
| BHV-000031 | SPEC-000031 | Tree、差分選択、Stage、Commit、Push確認、Remote結果および再観測がSource SPECの意味を保持する | QA-000007 | Mapped |

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
| `PRT-000006.spec-000031` | BHV-000031 | QA-000007 | Single | Mapped |
| `PRT-000007.spec-000011` | BHV-000011 | QA-000009 | Single | Mapped |
| `PRT-000008.spec-000012` | BHV-000012 | QA-000007 | Single | Mapped ／初回項目へ定義接続・Not Run |
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
| 現行Detailの意味Coverage | QA目標Relationあり／初回追加義務は定義接続・Not Run | 20 SCR、20 PRT、30 BHV、32 InteractionのQA目標接続と、初回追加義務のDefinition／Local Item接続は別。SCR-000008、BHV-000012、PRT-000008.spec-000012の3処置行は初回項目へ定義接続。3はLocal Item数でも独立義務数でもない |

## Topic／Meetingの保存境界からの追加導出

| 導出元 | 必要な観測 | Quality所有の検証項目 | 対象外 |
|---|---|---|---|
| `ARCH-000006` Domain Model詳細設計§9.1、`SPEC-000013` | 公開操作と保存後RecordのIdentity・改訂・状態・Relationの相関 | `QA-000005`／`CPR-IT-010` | Reader専用の`CPR-IT-008`を更新成功の根拠にしない |
| 同詳細設計の保存Path親chain | Root・種別親・Record親・CHG親の静的link／junction・非Directoryを拒否し、ENOENTと観測不能を分ける。一階層作成のEEXIST後も観測し、正本・別保存先のbytesとLock不存在を照合する | `QA-000005`／`CPR-IT-011` | 観測直後の非協調Process差替え、実Process競合、実OS close故障、電源断保証 |
| 同詳細設計の保存一次失敗と入力拒否の分離 | 変換拒否は更新0回。一次失敗のみは同一例外、cleanup併発はAggregateErrorのcauseに同じ一次例外、errorsにcleanup試行順を保持する。undefined・入れ子の失敗、実改訂・残存物を相関し、実更新を未保存へ丸めない。短命Fileは排他的open成功後だけ所有し、部分write・close失敗ではrename／読戻しへ進まず、他者Fileと正本bytes・改訂を保持する。closeの局所注入は実close後の故障報告に限る | `QA-000005`／`CPR-IT-011` | OSの保存確定、Lock回収、親link保証、MCP／Workbench返却の全体完成は別途確認する |

Domain Model詳細設計§9.1の通常保存完了は、同じLock内で一度取得したbytesと同一snapshotのID・改訂・Project IDの照合へ具体化する。`CPR-IT-010`の成功と`CPR-IT-011`の欠落・読取り／解析故障・値差・cleanup併発を分け、保存後内部故障から未保存やEffect 0を推定しない。不正UTF-8と正規置換文字の反例を含め、電源断耐久性は人間判断により対象外とする。親差替え・実Process競合は別の未完了保証として保持する。

## AI Adapterの純粋結果変換・課金方針からの追加導出

容量についてはCodexの16KiBの契約値照合と実入力の逸脱拒否を区別する。移管14 Caseは前者までであり、追加の容量境界試験でUTF-8の16,383／16,384 bytesの受理と16,385 bytesの拒否、正規化値と生出力非公開を観測する。この試験からClaudeの容量、実Processの出力制限や取消・cleanup成立を主張しない。

| 導出元 | 必要な観測 | Quality所有の検証項目 | 対象外 |
|---|---|---|---|
| `ARCH-000004`／`ARCH-000015`、AI Adapter詳細設計§7.3の`coord.provider-attempt` | 単一exact結果、不正JSON／Envelope拒否、固定上限、正規化値と生出力非公開 | `QA-000006`／`ERB-UT-032` | 実CLI、費用、Process終了、取消、cleanup。既存IT／STを代替しない |
| `ARCH-000010`、AI Adapter詳細設計§7.3の`coord.provider-selection`、CoordinatorのSubscription限定方針 | 固定課金方針、暗黙有料API切替・追加購入・設定単独Authorityの否定 | `QA-000006`／`ERB-UT-033` | 実課金防止と未実装有料APIの提供。旧Trust軸項目へ誤接続しない |

追加導出: `ARCH-000006` Domain Model詳細設計§9.1と`SPEC-000013`の部分成功・故障分離から、`QA-000005`／`CPR-IT-012`へ公開応答の検証義務を渡す。MCP詳細設計§6とWorkbench詳細設計§8で入力拒否と内部故障の非開示応答を具体化する。Workbench Local POSTの保存開始時故障と、Remote失敗・保存後・再読取り・実OS全体の未評価を区別し、内部エラーから未保存・Effect 0・cleanup成立を推定しない。

## 鍵の期限なし方針の接続 — 2026-10-11

期限なし方針の現在導出（2026-10-11）: SCR-000008／BHV-000012から、期限表示・自動更新なしの画面表現と、明示失効・交換後の旧鍵拒否・現在認可の振る舞いを別Ownerへ接続する。既存QA-000007／RFD-ST-003／RFD-IT-013／RFD-UAT-007へ統合し、新Local ItemやUTを追加しない。更新項目の正式評価はNot Run、Source・Store・本番資格接続と新Evidenceは未成立。

## Checklist

- [x] 全20 SCRと20 PRTを処置した
- [x] 全30 BHVを処置した
- [x] 全32 Interaction Relationを個別にQuality Relation Ownerへ接続した
- [x] 各発行済みDetailを一件以上のQA-IDへ接続した
- [x] Detailごとに重複QA-IDを機械発行していない
- [x] UI／SPEC Definition由来の意味とDetail由来の観測条件を区別した
- [x] CMP未発行を理由付きN/Aとして処置した
- [x] v0.22固有Visual判断を先取りしていない


## 前段の初回Host設定の詳細からの追加導出 — 2026-10-11

以下の未定義OPENは分析段階の履歴。現在の接続は次節と主表を参照する。

| 導出元・処置行 | 必要な確認 | 引渡し先・現在状態 |
|---|---|---|
| SCR-000008／PRT-000008 | 四状態と次の行動の案内、表示名は表示用、初回設定・秘密配送はWorkbenchで実行しない。作成済みと受領・通常接続完了を区別する | QA-000007候補／Definition・Local Item未接続OPEN（ST／UAT） |
| BHV-000012 | 管理状態と進行中初回記録の両方が未初期化と確認できた場合だけ開始する。欠落一件、読取り不能、破損、Lock使用中、既存ユーザー、部分状態、確認不能を未初期化へ畳まない。発行／記録不明では元試行だけ再観測し、発行・記録確定後の受け渡しまたは受領不明では作成済み管理者の既存Host指定交換へ別の明示操作として渡す。秘密再表示・自動再発行・自動再初期化を行わない。非秘密の元試行の保存・読戻しを最初のUUID／鍵Effect前に確定する。元試行相関確定後・作成／発行／記録中・確定後配送／受領前のProcess喪失を刺激し、新Processで同じ非秘密元試行と既知／不明を読戻す。現在の信頼されたログイン済みHost操作者を再照合し、追加Credential認証・OS昇格は要求しない。別UUID・追加鍵・自動再初期化・Secret保存／再表示0を別観測する。同一Processの再呼出しだけでは充足しない。 | QA-000007候補／Definition・Local Item未接続OPEN（UT／IT／ST） |
| PRT-000008.spec-000012 | 案内とSystem処置を相関し、案内だけを実行・成功にしない。状態照会を含む初回設定のMCP一覧・Schema・登録・dispatch非公開を確認する | QA-000007の正の成立とQA-000009の負境界へ分離引渡し。Definition・Local Item未接続OPEN（IT／ST／UAT） |

初回試行、発行、記録、受け渡し、受領、通常管理接続は別の観測事実である。発行・記録不明は同じ元試行の再観測だけ、発行・記録確定後の受け渡し／受領不明は作成済み管理者の既存Host指定交換へ別操作として渡す。初回設定を通常Host回復二操作へ追加しない。Root準備の既知EffectをEffect 0へ丸めない。

参照正本は[Access Managementの初回設定設計](../../../06_Architecture/Details/access-management/01_Architecture.md)、[管理状態とAPI候補](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md)、[Workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md)、[MCP](../../../06_Architecture/Details/mcp-server/01_Architecture.md)。既存185項目へ仮接続せず、3処置行を次段階のQA-000007／QA-000009でSame／New／Merge評価する。担当はQual-Lab、再評価契機は次段階の定義更新。初回義務はOPENであり未定義をNot Runへ丸めない。契約・品質の限定独立再レビュー済み、全重大度の残指摘0。Source／Test／実行／新Evidence未完了。

- [x] 初回追加義務をDefinition／Local Itemへ接続した — 今回は定義接続だけ。実行未完了。

## 前回のOwner詳細からの限定再導出 — 2026-10-11

以下の限定結果は初回追加義務の導出前の通常管理契約に限る。初回設定の充足へ流用しない。

| 詳細入力 | 導出する義務 | Quality Owner／Local Item | 実行状態 |
|---|---|---|---|
| SCR-000008／PRT-000008、BHV-000012、PRT-000008.spec-000012 | 通常6管理操作・固定分担・操作別対象・自己内容変更の理解と受理／利用の区別、交換4組の事前表示・3組確認、Secret一度表示、段階別結果を維持。解除の両読戻しと旧取消非証明、発行／記録不明の再観測と確定受け渡し未確認後の別交換、現在admin認証未接続／喪失だけHostを理解・操作できる。先の鍵の失効範囲と再配布、遅延失効鍵の案内0、旧事実／新操作区別を確認する | QA-000007／RFD-ST-016、RFD-UAT-007 | Not Run ／初回項目へ定義接続・Not Run |
| Access Managementの固定管理判定／通常管理保存境界、Workbenchの通常管理縦断 | 固定8操作×三Role、通常6入力→変更前認可→保存・読戻し→表示→次要求。内容認可と鍵処置を分離する。解除は同じ受理操作・採用改訂で登録＋対応Exposure両除去読戻しだけ完了、他登録／Exposureと本体を保持。片側残存・観測不能、事前別公開解除・登録時Binding再検証の必須化、両除去からの旧取消推定を反証 | QA-000007／RFD-UT-020、RFD-IT-021、RFD-ST-022 | Not Run |
| Access Management・Workbenchの最新詳細 | 通常発行・exact独立失効・現在認可を維持。発行／非秘密記録不明はCredential IDとは別の元発行Identity再観測・新交換0・通常発行Recovery新設0、交換由来だけ元exact。確定発行／記録と配送未確認は旧事実を保持し現在adminの明示的な別Operation／別Recovery交換。先の鍵を含む対象集合・各交換exact・遅延失効鍵利用案内0・新交換≠旧受領／rollback／取消を確認。現在admin認証未接続／喪失だけ既存Host2操作 | QA-000007／RFD-IT-017、RFD-IT-018、RFD-ST-003、RFD-IT-013、RFD-ST-016 | Not Run |
| Access Management・Domainの最新詳細 | 認可済み集合だけの集約、部分・競合・出所の保持、Owner分離 | QA-000007／RFD-IT-019 | Not Run |
| MCPの最新詳細 | 非鍵解除の同一受理操作／改訂・両除去読戻しと対象外／本体保持・取消非証明を意味を変えず搬送する。一覧・Schema・登録・dispatchに全鍵操作と鍵回復参照なし、要求Bearer認証継続 | QA-000009／EST-IT-010、EST-ST-015 | Not Run |

参照正本は[Access Management](../../../06_Architecture/Details/access-management/01_Architecture.md)、[Workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md)、[MCP](../../../06_Architecture/Details/mcp-server/01_Architecture.md)、[Domain](../../../06_Architecture/Details/domain-model/01_Architecture.md)の最新詳細である。既存のMapped／Coveredは導出関係の投影であり、上記変更の実行Passを示さない。RFD-UT-020とRFD-UT-023のみSource／Test Symbol接続済みで、候補試験の局所実行は成功した。正式Local Item結果／Evidence評価はNot Run、他ItemのTest Symbol・実行・Evidenceまでの接続は未完了。旧Evidenceは歴史的証跡として維持する。

固定8操作の担当Roleと今回の追加判断は採用済み。既存Local ItemのSource Model／Model Itemへ対象Detailと反証条件を接続し、この通常管理伝播では185項目を増やさなかった。現在はRFD-UT-020の固定管理判定とRFD-UT-023の初回判定のSource／Test Symbolと候補局所実行を除き、具体API・保存Schema・他Source／Test・実境界は未成立。正式Local Item／Evidence評価はNot Run。MCPの通常管理Toolを新規採用せず、採用済み非鍵入口の同値搬送はQA-000009／EST-IT-010、鍵回復参照を含む鍵の4面非公開はEST-ST-015で別に確認する。通常管理伝播の契約・品質限定独立レビュー済み・残指摘0であり、Not Run・過去Evidenceの適用範囲を維持する。


## 初回DetailのLocal Item接続 — 2026-10-11

| 処置行 | 定義接続 | 状態 |
|---|---|---|
| SCR-000008／PRT-000008 | RFD-ST-026、RFD-UAT-027 | Not Run |
| BHV-000012 | RFD-UT-023、RFD-IT-024、RFD-IT-025、RFD-ST-026 | Not Run |
| PRT-000008.spec-000012 | RFD-IT-025、RFD-ST-026、RFD-UAT-027／EST-ST-015 | 正の成立とMCP負境界を別Ownerへ接続、Not Run |

3はDetail処置行数であり、独立義務・Local Item数ではない。5項目への定義接続で旧未接続差分だけ解消する。RFD-UT-023のSource／Test Symbolと候補局所実行だけ接続済みで、正式Local Item／Evidence評価はNot Run。他初回項目のSource／Test／実行・新Evidence・物理保存・受領観測は未完了。今回13文書の定義接続は契約・品質の限定独立レビュー済み・残指摘0。

## AM状態Schemaの純粋検査接続 — 2026-10-12

Access Management詳細§4.5と純粋Schema具体化から、完全baseline、段階相関、現在参照と歴史参照の差、raw byte容量・strict UTF-8・閉集合の検証義務をQA-000007／RFD-UT-028へNew統合する。正本MeaningはARCH-000013／arch-000013.qa-000007。保存Adapter・Root・Lock・鍵・配送・本番接続はこのUTで充足しない。局所候補実行と正式Not Runを分ける。
