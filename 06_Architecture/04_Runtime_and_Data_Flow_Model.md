# Runtime／Data Flowモデル

Status: Candidate (v0.21.0)
Owner: Qual-Lab
Last Updated: 2026-09-15

## 1. この成果物が所有すること

Projectの入力から状態、実行、観測、投影および候補採用までのData／State／Identity／Authorityの流れを統合する。物理保存形式は所有しない。

## 2. 主要データフロー

```text
<<E1: 利用者／Agent>>
        │ {internal} Objective／Query／Decision／Cancel
        ▼
==== Transport／Process境界 ==================================
 (P1: 入力検証と公開Application Contractへの変換)
        │ {internal} Canonical Request
        ▼
 (P2: Project Runtimeによる状態・実行判断)
        │ {internal} Project／Task State
        ├────────────────────────────> [(D1: Runtime Data)]
        │ {internal} Execution Request
        ▼
 (P3: Execution Portによる実行委譲)
        │ {internal} Execution Result／Unknown
        └────────────────────────────> (P2)

<<E2: 既存の実行事実Source>>
        │ {internal} Existing Execution Facts
        ▼
 (P4: 欠測を保持する実行事実読取りProjection)
        │ {internal} Source-aware Observation
        └────────────────────────────> (P5: Project Projection)

<<E3: Project／Quality／Roadmap等の許可Source>>
        │ {internal} Canonical Project Context／Currentness／Coverage
        └────────────────────────────> (P5)

 (P5)
        │ {authorized-result} Source／Currentness／Coverage付き結果
        ▼
<<E4: 許可された結果利用者>>

受入判断経路
 <<E7: Project運営者>> -- {authority-decision} 対象Identity＋受入／差戻し／判断待ち --> (P9: Acceptance Decision Port)
 (P5) -- {internal} 判断根拠だけを表示 --> <<E7>>
 (P9) -- {authorized-write} Objective／Milestone判断 --> [(D3: Acceptance Decision Record)]
 (P5) -x (P9)  ProjectionからAuthorityを生成しない
 (P9) -x (P2／P3)  Task作成・Provider Effectを発行しない

外部情報経路
 (P6: 送信同意・最小化) -- {approved-external} Request --> <<E5: External Provider>>
 <<E5>> -- {untrusted-external} Returned Result --> (P7: 未信頼候補の隔離)
 (P7) -- {internal} Isolated Candidate --> (P8: 候補採用判断)
 <<E6: 人間の決定権限者>> -- {authority-decision} Adoption Decision --> (P8)
 (P8) -- {internal} Human-adopted Candidate --> [(D2: 採用先の正本)]
```

`P3`は実行事実SourceのWriterではない。`E2`は現在責務の外側で既に存在するSourceであり、本モデルが所有するのは`P4`以降の読取り、欠測保持および結果投影だけである。`P5`は実行事実だけからProject状態を作らず、許可されたProject／Quality／Roadmap等の正本も同じ観測条件で読む。`P8`は人間の採用判断がある場合だけ`D2`へ書き、却下・保留では正本Effect 0とする。

`P9`は`E7`の明示判断だけを受け付ける。Task完了はObjective判断の根拠、Objective受入はMilestone判断の根拠にはなるが、いずれも書込みAuthorityを発行しない。`SPEC-000006`／`SPEC-000007`の読取り要求は`P5`で終了し、`P9`へ到達しない。

## 3. 横断状態遷移

### Project Task

```text
[開始] -- Objective受付 [入力・Identity有効] / Task Identity確定 --> [S1: 受付済み]
[S1] -- 実行判断 [実行可能] / Capability要求 --> [S2: 実行中]
[S1] -- 判断要求 [必須判断不足] / Provider Effect 0 --> [S3: 判断待ち]
[S3] -- 入力返却 [同じTask] / 判断を再評価 --> [S1]
[S3] -- 取消要求 [exact Task] / 取消開始 --> [S4: 取消処理中]
[S2] -- 結果確定 [終了状態観測済み] / Authority失効 --> [終了: completed]
[S2] -- 取消要求 [exact Task] / 取消開始 --> [S4]
[S2] -- 実行観測 [Effect不明または残存あり] / Recovery義務保持 --> [S5: 回復待ち]
[S4] -- 終了観測 [Resource settlement確認] / cleanup確定 --> [終了: cancelled]
[S4] -- cleanup観測 [不明] / Recovery義務保持 --> [S5]
[S5] -- Recovery再入場 [exact Identityかつ新鮮な観測] / 重複Effectを拒否 --> [S2]
[S5] -- 終了確認 [結果とcleanup確定] / Recovery義務解消 --> [終了: completed]
[S1] -x 実行要求 [Authority不明] / Effect 0
```

| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |
|---|---|---|---|---|---|---|---|---|
| 開始 | Objective受付 | 入力・Identity有効 | Task Identity確定 | 外部Effect 0 | 受付済み | 不正なら開始前拒否 | 非該当。Effect未発行 | 受付結果と一意なIdentity |
| 受付済み | 実行判断 | 実行可能 | Capability要求 | 実行開始要求 | 実行中 | Authority不明なら受付済み | Effect 0またはRecoveryへ接続 | Task Identityが一意 |
| 受付済み | 判断要求 | 必須判断不足 | 判断待ちを保持 | Provider Effect 0 | 判断待ち | 状態保存不能ならblocked | 同じTaskへ再入場 | Taskと判断Identityを保持 |
| 判断待ち | 入力返却 | exact Task | 判断を再評価 | Provider Effect 0 | 受付済み | 入力不正なら判断待ち | Recovery義務を追加発行しない | 旧Authorityを流用しない |
| 判断待ち | 取消要求 | exact Task | 取消開始 | 条件成立時だけ取消要求 | 取消処理中 | 不明なら判断待ち | 取消後の終了観測へ接続 | 同じTask Identityを保持 |
| 実行中 | 結果確定 | Capability発行済み、終了観測済み | Authority失効 | 確定済みProvider／Process Effect | completed | 結果不明は回復待ち | 必要Resourceを回収 | 結果と終了状態が一致 |
| 実行中 | 取消要求 | exact Task | 取消開始 | 取消要求 | 取消処理中 | 受付不明は回復待ち | 終了観測へ接続 | 元Task／Attemptを保持 |
| 実行中 | 実行観測 | Effect不明または残存あり | Recovery義務保持 | 追加Effect 0 | 回復待ち | 回復待ちを維持 | exact Identityを保持 | 結果またはRecovery義務 |
| 取消処理中 | 終了観測 | exact Task | Resource settlement確認 | 取消済みEffectの観測 | cancelled | 観測不能は回復待ち | 逆順cleanup | Process／Resource不存在または不明 |
| 取消処理中 | cleanup観測 | 観測不能 | Recovery義務保持 | 追加Effect 0 | 回復待ち | 回復待ちを維持 | exact Identityを保持 | cleanup不明を明示 |
| 回復待ち | Recovery再入場 | exact Identityと新鮮な観測 | 重複Effect拒否 | 確認済み処置だけ | 実行中 | 不明なら回復待ち | 同じRecovery Identity | 新しいAttemptを混入しない |
| 回復待ち | 終了確認 | 結果とcleanup確定 | Recovery義務解消 | 追加Effect 0 | completed | 不明なら回復待ち | Authority失効 | 義務解消を観測 |
| 受付済み | 実行要求 | Authority不明 | 拒否 | Effect 0 | 受付済み | 同じ | 非該当。Effect未発行 | Provider／Process Effect 0 |

### 外部情報

```text
[開始] --> [S10: not_authorized]
[S10] -- 同意確認 [許可範囲一致] / 送信Authority発行 --> [S11: authorized]
[S10] -x 送信要求 [未許可または不明] / Effect 0
[S11] -- 送信要求 [Authority有効] / 最小化した情報を送信 --> [S12: sent]
[S12] -- 結果受領 [Provider応答を観測] / returned状態を保持 --> [S13: returned]
[S13] -- 依頼Identity照合 [exact] / 未信頼候補を隔離 --> [S14: candidate]
[S13] -x 候補化 [Identity missingまたはambiguous] / 隔離・採用不可
[S14] -- 採用判断 [人間が採用] / 正本更新Authorityを別途確認 --> [終了: adopted]
[S14] -- 却下判断 [人間が却下] / 候補を処置 --> [終了: rejected]
```

| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |
|---|---|---|---|---|---|---|---|---|
| 開始 | lifecycle開始 | 未送信 | 未許可状態を確定 | 外部Effect 0 | not_authorized | 同じ | 非該当。Effect未発行 | 送信Authorityなし |
| not_authorized | 同意確認 | 許可範囲一致 | 送信Authority発行 | 外部Effect 0 | authorized | 不明ならnot_authorized | 非該当。Effect未発行 | Authorityの範囲・期限 |
| not_authorized | 送信要求 | 未許可または不明 | 拒否 | 外部Effect 0 | not_authorized | 同じ | 非該当。Effect未発行 | 送信0 |
| authorized | 送信要求 | Authority有効 | 許可情報を最小化して送信 | 外部送信 | sent | 結果不明なら回復義務を判定 | Request Identityを保持 | 送信受付と完了を分離 |
| sent | 結果受領 | Provider応答を観測 | returned状態を保持 | 正本Effect 0 | returned | 応答不明ならsentまたは回復義務 | Request Identityを保持 | 受領と候補化を分離 |
| returned | 依頼Identity照合 | exact | 未信頼候補を隔離 | 正本Effect 0 | candidate | 相関不能ならreturned | 隔離Ownerが保持 | 未信頼状態を保持 |
| returned | 候補化 | Identity missingまたはambiguous | 拒否し隔離 | 正本Effect 0 | returned | 同じ | 人間採用経路へ渡さない | 候補・採用Authorityなし |
| candidate | 採用判断 | 人間が採用 | 正本更新Authorityを別途確認 | 許可時だけ正本更新 | adopted | Authority不明ならcandidate | 候補を保持 | 採用結果と正本更新を観測 |
| candidate | 却下判断 | 人間が却下 | 候補を処置 | 正本Effect 0 | rejected | 処置不明ならcandidate | 候補Ownerが再入場 | 正本不変と候補処置 |

### Objective／Milestone受入判断

```text
[開始] -- 対象解決 [Task根拠あり] / 表示だけ --> [S20: Objective判断待ち]
[S20] -- 明示判断 [Project運営者Authority] / 受入・差戻し・判断待ちを記録 --> [S21: Objective判断記録済み]
[S21] -- Milestone判断開始 [Objective根拠あり] / 表示だけ --> [S22: Milestone判断待ち]
[S22] -- 明示判断 [Project運営者Authority] / 受入・差戻し・判断待ちを記録 --> [S23: Milestone判断記録済み]
[S20] -x Task完了だけによるObjective受入 / Effect 0
[S22] -x Objective受入だけによるMilestone受入 / Effect 0
```

判断待ちの選択は終了状態へ畳まない。受入・差戻し・判断待ちの各記録は対象Identity、判断者、根拠Revisionと相関し、Task作成またはProvider Effectを発行しない。

## 4. 概念Entity関係

```text
[ER1: Project] [1] -- R1: Repositoryを束ねる --> [0..*] [ER2: Repository]
[ER2] [1] -- R2: 利用範囲へ公開される --> [0..*] [ER3: Repository Exposure]
[ER4: Workspace] [1] -- R3: 公開対象を持つ --> [0..*] [ER3]
[ER5: Session] [1] -- R4: 利用許可を持つ --> [1..*] [ER6: Session Grant]
[ER6] [0..*] -- R5: Workspace利用を許可する --> [1] [ER4]

[ER1] [1] -- R6: Milestoneを持つ --> [0..*] [ER7: Milestone]
[ER1] [1] -- R7: Objectiveを持つ --> [0..*] [ER8: Objective]
[ER8] [1] -- R8: Taskへ具体化される --> [0..*] [ER9: Task]
[ER9] [1] -- R9: 実行試行を持つ --> [0..*] [ER10: Execution Attempt]
[ER9] [1] -- R10: 判断待ちを持つ --> [0..*] [ER11: Decision Wait]
[ER9] [1] -- R11: 回復義務を持つ --> [0..*] [ER12: Recovery Obligation]
[ER9] [1] -- R12: 既存の実行事実を参照する --> [0..*] [ER13: Execution Fact]
[ER8] [1] -- R17: Objective判断を持つ --> [0..*] [ER20: Objective Acceptance Decision]
[ER7] [1] -- R18: Milestone判断を持つ --> [0..*] [ER21: Milestone Acceptance Decision]

[ER14: Meeting] [1] -- R13: 候補を生む --> [0..*] [ER15: Candidate]
[ER15] [0..*] -- R14: 採用時に接続する --> [0..1] [ER16: Topic／Decision]
[ER17: External Request] [1] -- R15: 帰還候補を持つ --> [0..*] [ER18: Returned Candidate]
[ER18] [0..*] -- R16: 人間採用時だけ成立する --> [0..1] [ER19: Adoption]
```

Relationはアクセス権や採用Authorityを自動生成しない。`Project ID`と`Repository ID`は別Identityであり、一つのProjectが複数Repositoryを持てる。

## 5. 整合条件

| 対象 | 必須の相関 | 禁止する畳み込み |
|---|---|---|
| Task | Project、Objective、Task、Attempt、Generation | 別Attempt結果の混入 |
| Recovery | 最初の残存可能性から再入場までexact Identity | 新しい／拡大Authorityへの置換 |
| Projection | Source、Revision／Version、Observed At、Coverage | partialをcomplete、unknownを正常へ変換 |
| Acceptance Decision | Project、Objective／Milestone、根拠Revision、判断者、判断種別 | ProjectionからのAuthority生成、Task完了からObjective受入、Objective受入からMilestone受入 |
| External Result | Request、Consent Scope、Provider Result、Candidate | returnedをadoptedへ自動昇格 |
| Historical Context | Source、Occurred At、Applicable Revision、Currentness | historicalをcurrentへ自動採用 |

## 6. Qualityへの引渡し

- 各状態の入口、許可操作、禁止操作、終了後観測を検証する。
- 多対多Relationと欠測を含むProjectionの整合性を確認する。
- 同じIdentity系列内で別Attempt、別Repository、別Workspaceが混入しないことを反証する。
- DataがTrust／Process／Repository／外部境界を越える箇所は、内容、Authority、保存、cleanupを結合して確認する。
- 受入判断は根拠表示、明示Authority、限定記録、終了後観測を分け、読取りProjection、Task作成およびProvider EffectとのEffect隔離を確認する。
