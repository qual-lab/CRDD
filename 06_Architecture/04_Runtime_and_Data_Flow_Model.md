# Runtime／Data Flowモデル

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-11

固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

## 1. この成果物が所有すること

Projectの入力から状態、実行、観測、投影および候補採用までのData／State／Identity／Authorityの流れを統合する。物理保存形式は所有しない。

## 2. 主要データフロー

### 2.1 読み方と経路案内

`<<E>>`は外部の主体、`(P)`は処理、`[(D)]`は保持するデータ、`-->`は許可された流れ、`-x`は許可しない流れを表す。各図は一つの目的だけを示し、状態遷移や実行順序の厳密な条件は第3節、横断する整合条件は第5節が所有する。

```text
                         Runtime／Data Flowの全体像

  ┌──────────────────┐      ┌──────────────────┐
  │ A. 入力・実行    │      │ B. 読取り・投影  │
  │ Requestを検証し、│      │ 複数Sourceを読み、│
  │ Taskを動かす     │      │ 欠測付きで返す   │
  └────────┬─────────┘      └────────┬─────────┘
           │                         │
           │ 実行結果・状態          │ 根拠付きProject View
           ▼                         ▼
  ┌──────────────────┐      ┌──────────────────┐
  │ Runtime Data     │      │ C. 受入判断      │
  │ Task／Attempt／  │      │ 人間の明示判断を │
  │ Recovery         │      │ 限定記録する     │
  └──────────────────┘      └──────────────────┘

  ┌─────────────────────────────────────────────┐
  │ D. 外部情報                                 │
  │ 同意・最小化 → 外部送信 → 候補隔離 → 人間採用│
  └─────────────────────────────────────────────┘
```

この案内図は責務の位置関係だけを示す。データの分類、生成、保存および境界横断は§2.2〜2.6の経路別図を正本とする。

### 2.2 A — 入力・実行

```text
<<E1: 利用者／Agent>>
        │
        │ {internal}
        │ Objective／Query／Decision／Cancel
        ▼
==== 公開Transport／Process境界 ============================
        │
        ▼
(P1: 入力検証・公開Application Contractへの変換)
        │
        │ {internal} Canonical Request
        ▼
(P2: Orchestratorの上位状態・実行判断)
        │                         │
        │ {internal}             │ {internal}
        │ Execution Request      │ Project／Task State
        ▼                         ▼
(P3: Coordinator公開API)   [(D1: 上位現在状態／履歴)]
        │
        │ {internal} Execution Result／Unknown
        └───────────────────────────────> (P2)
```

`P2`の実装OwnerはOrchestrator、`P3`はCoordinator公開APIである。`P2`がProject／Task状態を所有し、実行委譲の結果または不明状態を同じTask Identityへ戻す。Coordinatorは実行観測をExecution Intelligenceの共通Writerへ渡し、Orchestratorは上位Attemptの観測を用途を分けて渡す。`P3`の結果を受けただけで上位受入判断やcleanup成立を生成しない。

| データ・状態 | 業務Owner | 保存・利用の境界 |
|---|---|---|
| Project／Task、判断点、受付世代、上位Attempt | Orchestrator | 現在状態と終了履歴を分離し、解決済み項目を現在状態へ蓄積しない。 |
| 単一実行、Docker資源、未解決回復、未搬送結果 | Coordinator | 現在状態の閉集合を単一Writerで保存する。記録の存在だけで実資源の存在・不存在を推定しない。 |
| 候補本体 | Coordinator | 隔離・read／discardを扱う。採用・Repository反映はOrchestratorの別操作である。 |
| 実行観測と履歴 | Execution Intelligence | Coordinator／Orchestratorの観測を区別する。Readerから事実を生成しない。 |
| 共通Root観測・保存・設定 | Domain Model | 各業務Ownerの意味とAuthorityを持たず、CRUDからGit確定を発行しない。 |

以下のRuntime Dataはデータ分類の総称であり、独立Packageや単一の業務状態Ownerではない。上位再入場と下位資源終了を分け、回復完了からProviderの再実行を自動発行しない。現在状態、通常履歴、候補本体、正式Evidence、短命な保存途中ファイルは、同じ永続記録へまとめない。

### 2.3 B — 読取り・Project投影

```text
<<E2: 既存の実行事実Source>>       <<E3: Project／Quality／Roadmap等の許可Source>>
              │                                      │
              │ {internal}                           │ {internal}
              │ Existing Execution Facts             │ Canonical Context／
              ▼                                      │ Currentness／Coverage
(P4: 欠測を保持する実行事実の読取り)                  │
              │                                      │
              │ {internal} Source-aware Observation  │
              └──────────────────┬───────────────────┘
                                 ▼
                   (P5: Project Projection)
                   ・実行事実だけで状態を作らない
                   ・欠測を正常値へ変換しない
                   ・Source／現行性／Coverageを保持する
                                  │
                                  │ {authorized-result}
                                  │ 根拠と不完全性を伴うProject View
                                  ▼
                   <<E4: 許可された結果利用者>>
```

`E2`と`E3`は現在責務の外側にあるSourceである。本モデルが所有するのは、許可されたSourceの読取り、欠測の保持および`P5`による結果投影である。

### 2.4 C — Objective／Milestone受入判断

```text
(P5: Project Projection)
        │
        │ {authorized-result} 判断根拠の表示
        ▼
<<E7: Project運営者>>
        │
        │ {authority-decision}
        │ 対象Identity＋明示判断
        ▼
(P9: Acceptance Decision Port)
        │
        │ {authorized-write}
        │ 受入／差戻し／判断待ち
        ▼
[(D3: Acceptance Decision Record)]

禁止
  (P5) -x (P9)       読取り投影から判断Authorityを生成しない
  (P9) -x (P2／P3)   Task作成・Provider Effectを発行しない
```

`P9`は`E7`の明示判断だけを受け付ける。Task完了はObjective判断の根拠、Objective受入記録はMilestone判断の根拠になるが、いずれも書込みAuthorityを自動生成しない。`SPEC-000006`／`SPEC-000007`の読取り要求は`P5`で終了し、`P9`へ到達しない。

### 2.5 D — 外部情報の送信・候補採用

```text
(P6: 送信同意の確認・情報最小化)
        │
        │ {approved-external} Request
        ▼
==== Network／外部Trust境界 ================================
        │
        ▼
<<E5: External Provider>>
        │
        │ {untrusted-external} Returned Result
        ▼
==== CRDDの隔離境界 =========================================
        │
        ▼
(P7: 未信頼候補の隔離)
        │
        │ {internal} Isolated Candidate
        ▼
(P8: 候補採用判断) <── {authority-decision} ── <<E6: 人間の決定権限者>>
        │
        │ {internal} Human-adopted Candidate
        ▼
[(D2: 採用先の正本)]
```

`P8`は人間の採用判断がある場合だけ`D2`へ書く。却下・保留では正本Effect 0とし、外部から返った結果を正本へ自動昇格しない。

### 2.6 接続認可・Context集約・鍵交換

```text
接続Credential → 既存userId → 現行Role詳細権限
                                │
Workspace／Exposure・実アクセス ─┤
                                ▼
                 Access Management（要求毎認可）
                                │ 許可済みRepository集合
                                ▼
                 Domain Model（Context集約）
                                │ 根拠・Coverage・不完全性
                                ▼
                 許可されたWorkbench／MCPの利用側

Workbenchの現行administrator または 信頼したHostログイン操作者
                 │ 交換種別・対象・既存発行先
                 ▼
     Access Management（旧失効前に同じexact Recoveryへ結合）
        ├→ 旧資格失効の確定範囲
        ├→ 新資格発行・結果記録の確定／不明
        ├→ 搬送・受領の確定／不明（発行結果と別の事実）
        ├→ 同じRecoveryの非秘密耐久状態
        └→ 生Secretは許可された発行結果へ一度だけ返す
             -x 保存／ログ／Evidence／会話／再表示
```

ユーザーは安定userId（UUID）、管理用表示専用名、一つのRoleを持つ。Roleが詳細権限を所有し、CredentialはuserIdへ結合する。改名・同名からIdentityを再生成せず、Credential／Sessionへ旧権限を固定しない。認証Contextは認証・搬送の単位であり、新しい永続Session Storeを意味しない。DomainはCredentialやGrantを解釈せず、許可済み集合からの投影だけを所有する。

通常の鍵発行・独立失効・交換は、同一Process Workbenchの現行administrator専用固定操作である。通常Host回復はログイン済みローカル操作者を信頼する対話CLIの交換2操作だけとし、追加認証・専用資格・承認コード・OS管理者昇格なしで既存Root／Path検証を維持する。MCPの一覧・Schema・登録・dispatchへ鍵操作を置かない。固定管理認可は現行RoleとARCH-000013の8操作分担から判定し、Role内容設定から派生させない。manager／administratorはユーザー登録・表示名変更、developer／managerのRole変更・内容設定、Repository登録・登録解除・Exposureを管理する。administratorの付与・解除・降格・詳細権限と鍵操作はadministrator専用。managerはadministratorの表示名だけ変更可。

鍵交換はuserId・表示名・Role・詳細権限・Repository登録・Product Dataを保持して鍵だけを変更する。指定ユーザー交換は対象既存userIdの全旧有効資格を失効させ同じuserIdへ新発行する。他ユーザーの鍵は保持する。全員交換は操作中管理者を含む全旧有効資格を失効させ、指定した既存administrator userIdへ新発行する。他ユーザーへの再発行・配布は管理者の通常鍵発行として扱う。

| 操作 | 対象と流れ | 独立した観測事実・禁止事項 |
|---|---|---|
| 通常管理 | 操作別入力 → 変更前の現在管理認可 → 明示更新 → 結果搬送 → 次要求の内容認可 | 新規登録は予定Role、既存Role変更は前後Role、名前変更は対象ID・新名前、Role内容は対象Role、Repositoryは登録／公開状態。manager自身も変更前の現在管理認可→明示的なRole内容設定／Exposure更新→次要求の現行Role・Exposure・実アクセス再評価の順に処置する。更新受理≠内容取得、管理≠内容自動付与、登録≠公開、登録解除≠Repository／Product Data削除を維持する。登録解除は同じ受理操作・採用改訂で登録と対応Exposureを除去し、両読戻し確認時だけ完了。対象外・本体を保持し、開始済み取消を証明しない。結果不明を成功化せず交換Recoveryを追加しない |
| 新規資格発行 | 既存対象userId → 固定administratorのWorkbench入口 → 発行結果 | 発行・結果記録・搬送・受領を分離する。旧資格失効0、交換Recoveryなし。後続搬送失敗だけで確定済み発行を不明へ戻さない |
| 独立失効 | exact対象資格Identityと既存userIdへの結合 → 同じWorkbench入口 → 失効結果 | 確定／不明を区別し、同じユーザーの別資格へ範囲を拡大しない。新発行・Secret・交換再入場0 |
| 指定ユーザー／全員交換 | WorkbenchまたはHost入口 → 旧失効前のexact Recovery結合 → 失効 → 発行 → 結果記録 → 搬送・受領 | 全4組を事前表示し、Hostまたは全員交換の3組だけ明示確認。段階ごとの事実を同じRecoveryへ保持し、Secretを保存／再表示しない |

## 3. 横断状態遷移

図の読み方: 箱は状態、`▼`は許可された遷移、分岐上の文言は契機または条件、`-x`は禁止する遷移を表す。直後の表が事前条件、Effect、回復および終了後観測の正本である。

### Project Task

```text
開始と実行
──────────
┌──────────────────────┐
│ 開始                 │
│ Objectiveを受け付ける│
└──────────┬───────────┘
           │ 入力・Identity有効
           │ Task Identityを確定
           ▼
┌──────────────────────┐
│ S1: 受付済み         │
└───────┬──────────┬───┘
        │実行可能  │必須判断が不足
        ▼          ▼
┌──────────────┐  ┌──────────────┐
│ S2: 実行中   │  │ S3: 判断待ち │
└──────────────┘  └──────────────┘

判断待ち
────────
                         ┌──────────────┐
          ┌──────────────│ S3: 判断待ち │──────────────┐
          │              └──────────────┘              │
          │ 同じTaskへ入力                              │ exact Taskを取消
          ▼                                             ▼
   ┌──────────────┐                              ┌──────────────────┐
   │ S1: 受付済み │                              │ S4: 取消処理中   │
   └──────────────┘                              └──────────────────┘

実行・取消・回復
────────────────
┌──────────────┐
│ S2: 実行中   │
└───┬─────┬────┘
    │     │
    │     ├─ exact Taskを取消 ───────────> [S4: 取消処理中]
    │     └─ Effect不明・残存あり ───────> [S5: 回復待ち]
    │
    └─ 結果・終了を観測 ─────────────────> [completed]

[S4: 取消処理中]
    ├─ 終了・cleanup確認 ─────────────────> [cancelled]
    └─ cleanup観測不能 ───────────────────> [S5: 回復待ち]

[S5: 回復待ち]
    ├─ exact Identityで再観測・限定処置 ─> [S5: 回復待ち]
    └─ 結果・cleanup確定 ────────────────> [元Attemptの確定結果]

元Attemptの確定結果: completed／failed／cancelledを実際の結果で選別する。
回復完了だけでcompletedや新しいProvider実行を生成しない。

禁止経路
  S1: 受付済み -- Authority不明の実行要求 --x Provider／Process Effect
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
| 回復待ち | Recovery再入場 | exact Identityと新鮮な観測 | 重複Effect拒否、現在資源の再観測と限定処置 | 確認済み回復処置だけ。Provider新規実行0 | 回復待ち | 不明なら回復待ち | 同じRecovery Identity | 新しいAttemptを混入しない |
| 回復待ち | 終了確認 | 元Attemptの結果とcleanup確定 | Recovery義務解消と元結果の確定 | 追加Effect 0 | 元結果に応じcompleted／failed／cancelled | 結果または資源不明なら回復待ち | Authority失効 | 義務解消と元結果を別々に観測する |
| 受付済み | 実行要求 | Authority不明 | 拒否 | Effect 0 | 受付済み | 同じ | 非該当。Effect未発行 | Provider／Process Effect 0 |

### 外部情報

```text
┌─────────────────────┐
│ S10: not_authorized │
│ 送信Authorityなし   │
└──────────┬──────────┘
           │ 同意範囲が一致
           │ 送信Authorityを発行
           ▼
┌─────────────────────┐
│ S11: authorized     │
└──────────┬──────────┘
           │ Authority有効
           │ 情報を最小化して送信
           ▼
┌─────────────────────┐
│ S12: sent           │
└──────────┬──────────┘
           │ Provider応答を観測
           ▼
┌─────────────────────┐
│ S13: returned       │
└──────────┬──────────┘
           │ Request Identityがexact
           │ 未信頼候補を隔離
           ▼
┌─────────────────────┐
│ S14: candidate      │
│ 人間の判断待ち      │
└────────┬───────┬────┘
         │採用   │却下
         ▼       ▼
 ┌────────────┐ ┌────────────┐
 │ adopted    │ │ rejected   │
 │許可時だけ  │ │正本Effect 0│
 │正本を更新  │ │            │
 └────────────┘ └────────────┘

禁止経路
  S10 -- 未許可・不明の送信要求 --x 外部送信
  S13 -- Identity欠落・曖昧な候補化 --x 採用経路
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
                       ┌─────────────────────────┐
                       │ 開始                    │
                       │ 対象Identityを解決する  │
                       └────────────┬────────────┘
                                    │ Task根拠あり
                                    │ 表示だけ／Effect 0
                                    ▼
                       ┌─────────────────────────┐
                       │ S20: Objective判断待ち  │
                       │ Task根拠・受入条件を確認│
                       └────────────┬────────────┘
                                    │ Project運営者の明示判断
                   ┌────────────────┼────────────────┐
                   │受入            │差戻し          │判断待ち
                   ▼                ▼                ▼
        ┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐
        │ S21              │ │ S24            │ │ S25              │
        │ Objective受入済み│ │ Objective差戻し│ │ Objective判断待ち│
        └────────┬─────────┘ └────────────────┘ └──────────────────┘
                 │
                 │ Objective受入記録がある場合だけ
                 ▼
        ┌─────────────────────────┐
        │ S22: Milestone判断待ち  │
        │ Objective根拠・条件を確認│
        └────────────┬────────────┘
                     │ Project運営者の明示判断
            ┌────────┼────────┐
            │受入    │差戻し  │判断待ち
            ▼        ▼        ▼
   ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
   │ S23          │ │ S26          │ │ S27            │
   │Milestone受入済│ │Milestone差戻し│ │Milestone判断待ち│
   └──────────────┘ └──────────────┘ └────────────────┘

戻り経路
  [S24: Objective差戻し]    -- 同じObjectiveの根拠・条件を再確認 --> [S20]
  [S25: Objective判断待ち]  -- 同じObjectiveの追加判断を待つ -----> [S20]
  [S26: Milestone差戻し]    -- 同じMilestoneの根拠・条件を再確認 --> [S22]
  [S27: Milestone判断待ち]  -- 同じMilestoneの追加判断を待つ -----> [S22]

禁止経路
  Task完了だけ -------------------------x Objective受入
  Objective差戻し／判断待ち -----------x Milestone判断開始
  Objective受入だけ -------------------x Milestone受入
  読取りProjection --------------------x 判断Authority生成
```

判断を記録したことと受け入れたことを同一状態へ畳まない。Objective受入済みだけがMilestone判断を開始でき、Objective差戻しとObjective判断待ちは同じObjectiveの再確認または追加判断へ戻る。受入・差戻し・判断待ちの各記録は対象Identity、判断者、根拠Revisionと相関し、Task作成またはProvider Effectを発行しない。

| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |
|---|---|---|---|---|---|---|---|---|
| 開始 | 対象解決 | exactなObjective IdentityとTask根拠あり | 根拠と受入条件を表示 | 正本Effect 0 | Objective判断待ち | 対象不明・根拠不足は開始前拒否 | 非該当。Effect未発行 | Decision Record、Task、Provider Effect 0 |
| Objective判断待ち | 明示判断: 受入 | exactな対象・世代・Project運営者Authority | Objective受入を一度記録 | Objective Decision Record一件 | Objective受入済み | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Objective受入記録一件。Task作成／Provider Effect 0 |
| Objective判断待ち | 明示判断: 差戻し | exactな対象・世代・Project運営者Authority | Objective差戻しを一度記録 | Objective Decision Record一件 | Objective差戻し | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Objective差戻し記録一件。Milestone判断、Task作成、Provider Effect 0 |
| Objective判断待ち | 明示判断: 判断待ち | exactな対象・世代・Project運営者Authority | Objective判断待ちを一度記録 | Objective Decision Record一件 | Objective判断待ち継続 | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Objective判断待ち記録一件。Milestone判断、Task作成、Provider Effect 0 |
| Objective差戻し | 根拠・条件の再確認 | 同じObjective Identity | 根拠と受入条件を表示 | 正本Effect 0 | Objective判断待ち | 別Identityなら差戻しを保持 | 非該当。同じIdentityを保持 | 既存差戻し記録を保持。Milestone判断Effect 0 |
| Objective判断待ち継続 | 追加判断の開始 | 同じObjective Identity | 現在の判断待ちと必要情報を表示 | 正本Effect 0 | Objective判断待ち | 別Identityなら判断待ちを保持 | 非該当。同じIdentityを保持 | 既存判断待ち記録を保持。Milestone判断Effect 0 |
| Objective受入済み | Milestone判断開始 | exactなObjective受入記録とMilestone Identity | Objective根拠とMilestone受入条件を表示 | 正本Effect 0 | Milestone判断待ち | 受入記録不明・不一致はObjective状態へ戻す | 非該当。Effect未発行 | Milestone Decision Record、Task、Provider Effect 0 |
| Milestone判断待ち | 明示判断: 受入 | exactな対象・世代・Project運営者Authority | Milestone受入を一度記録 | Milestone Decision Record一件 | Milestone受入済み | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Milestone受入記録一件。Task作成／Provider Effect 0 |
| Milestone判断待ち | 明示判断: 差戻し | exactな対象・世代・Project運営者Authority | Milestone差戻しを一度記録 | Milestone Decision Record一件 | Milestone差戻し | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Milestone差戻し記録一件。Task作成／Provider Effect 0 |
| Milestone判断待ち | 明示判断: 判断待ち | exactな対象・世代・Project運営者Authority | Milestone判断待ちを一度記録 | Milestone Decision Record一件 | Milestone判断待ち継続 | 記録結果不明は同じIdentityで再観測 | 重複記録せず同じIdentityへ再入場 | Milestone判断待ち記録一件。Task作成／Provider Effect 0 |
| Milestone差戻し | 根拠・条件の再確認 | 同じMilestone Identity | Objective根拠とMilestone受入条件を表示 | 正本Effect 0 | Milestone判断待ち | 別Identityなら差戻しを保持 | 非該当。同じIdentityを保持 | 既存差戻し記録を保持。追加Effect 0 |
| Milestone判断待ち継続 | 追加判断の開始 | 同じMilestone Identity | 現在の判断待ちと必要情報を表示 | 正本Effect 0 | Milestone判断待ち | 別Identityなら判断待ちを保持 | 非該当。同じIdentityを保持 | 既存判断待ち記録を保持。追加Effect 0 |
| 任意の判断状態 | 明示判断 | 別対象、古い世代、重複またはAuthority不一致 | 理由付き拒否 | Effect 0 | 現在状態を保持 | 同じ | Recovery義務を新設しない | Decision Record、Task、Provider Effect 0 |
| Objective判断待ち | Task完了 | 明示判断なし | 自動受入を拒否 | Effect 0 | Objective判断待ち | 同じ | 非該当 | Decision Record、Milestone判断、Task作成、Provider Effect 0 |
| Objective差戻し／判断待ち継続 | Milestone判断開始 | Objective受入記録なし | 開始を拒否 | Effect 0 | 現在状態を保持 | 同じ | 非該当 | Milestone Decision Record、Task、Provider Effect 0 |
| Milestone判断待ち | Objective受入だけによるMilestone受入 | Project運営者の明示判断なし | 自動受入を拒否 | Effect 0 | Milestone判断待ち | 同じ | 非該当 | Milestone Decision Record、Task、Provider Effect 0 |

### 鍵交換の段階と状態

以下は[ARCH-000013](Definitions/ARCH-000013/architecture_definition.md)の横断投影であり、物理Schemaや新しい状態実値を定義しない。通常入口は同一Process Workbenchの現行administrator、Host入口は信頼したログイン済みローカル操作者とし、同じ交換2操作へ接続する。

| 段階／契機 | 必要な条件・処置 | Effectと結果 | 再入場・終了後観測 |
|---|---|---|---|
| 処置前 | 現在Authority、既存対象・必要な管理者、必要状態・認可健全性を確認。全4組を事前表示、Hostまたは全員交換だけ明示確認 | 条件不明／破損なら新Effect 0で停止 | 認可破損修復・Role初期化・特別User／Bootstrapなし |
| 相関確定 | 旧資格失効より前に交換を同じexact Recovery IDへ結合 | 失効開始前から各結果・非秘密耐久記録を同じIDで追跡 | 後続失敗・Process喪失・再入場でも別Recoveryを重ねない |
| 旧資格失効 | 指定ユーザーまたは全員のexactな範囲を処置 | 確定した失効範囲を保持。後続要求を拒否 | 全員交換は現在管理者の旧資格も失効。入口の現在Authorityと交換結果を区別する |
| 新資格発行 | 同じOperationの既存発行先を使用 | 発行確定または不明を失効結果と別に保持 | 生Secretを保存せず許可された結果へ一度だけ返す |
| 発行未確定・Process喪失 | 既知失効と未確定の発行結果を非秘密耐久状態に保存 | 完了・rollback・旧鍵有効を推定しない。確定済みの段階は保持 | 同じRecovery IDを保持し、現在状態と現在Authorityで再観測。Secretを再表示しない |
| 発行または結果記録が不明 | Credential IDとは別の非秘密な元発行Identityと既知事実を保持 | 確定済み発行を後続の記録失敗だけで不明へ戻さず、新交換を開始しない | 元処理を再観測。交換由来だけ元exact Recovery、通常発行に交換Recoveryを新設しない |
| 発行・結果記録確定、配送／受領未確認 | 「発行済み・受け渡し未確認」と表示し、現在administratorが既存の交換を別操作として明示選択 | Secret保存・再表示・自動再発行なし。旧事実・元発行Identityを保持 | 別Operation／別Recoveryで開始し、各交換内だけsame exact。現在administrator非接続時は既存Host交換入口へ |
| 別交換の対象と終了 | 指定は先発行鍵を含む対象User全旧有効資格→同じ既存userId。全員は先発行鍵を含む全旧有効資格→指定既存administrator | 指定では他User鍵を保持。全員では他Userを通常再発行・配布へ戻す。現在対象・認可と4組表示／3組確認を再適用 | 遅延旧応答で失効鍵を利用可能表示しない。別交換成功≠旧Secret受領・rollback・開始済み取消 |
| 結果確定・受領 | 失効・発行・結果記録・搬送・受領の各事実を照合 | 未確認段階をcompletedへ畳まない | 鍵交換の完了はTask取消完了・過去Effect 0を証明しない |

Workbench／Host CLIの入口分担は採用済みであり、具体的な保存確定方式、再入場API、画面・入力・受領方式と元発行Identity／配送観測の具体保存・搬送はDetailsへ残す。3分岐の処置方針自体は採用済みで、物理成立とは区別する。保存した参照はAuthorityそのものではなく、現在Authorityへの再結合なしに回復処置を許可しない。

### 初回Host設定の状態・データフロー投影

詳細は[Access ManagementのStateとSequence](Details/access-management/01_Architecture.md#41-初回host設定のstateとsequence)を正本とし、新しい状態実値や物理Schemaを定義しない。

```text
既存Root・双方未初期化を確認＋Host明示開始
  → 非秘密元試行相関の耐久確定・読戻し
  → administrator UUIDユーザー作成
  → 同じuserIdへ鍵発行 → 結果記録
  → 一度だけ配送 → 受領確認 → 通常管理接続確認
```

| 観測した状態 | 流れ・個別事実 |
|---|---|
| 未試行・双方未初期化確認済み | 明示開始時だけ新試行を作る。事前に試行やUUIDを推定しない |
| 既存管理状態あり | 初期化しない。通常の鍵喪失は既存Host交換へ戻す |
| 確認済み途中試行あり | 元試行だけを再観測。作成・発行済みを未初期化へ戻さない |
| Root／観測／記録／排他等が不明 | 新作成を停止し、確認済み元試行がある場合だけ再観測する |

論理的な`initialization`進行記録は耐久状態の候補であり、短命な`access-management.pending.json`、`unresolvedKeyExchanges`、Lock回復と同一ではない。発行または結果記録不明と、両者確定後の配送／受領だけ不明を分ける。配送未確認と配送確認済み・受領未確認も別の事実である。具体Schema・保存確定・保持清掃・受領方式はOPENで、状態名や一度表示から受領・全体完了を推定しない。

## 4. 概念Entity関係

```text
Project実行
───────────
┌────────────────┐
│ ER1: Project   │
└───────┬────────┘
        ├─ R1: 1 → 0..* ──> [ER2: Repository]
        ├─ R6: 1 → 0..* ──> [ER7: Milestone]
        │                       └─ R18: 1 → 0..* ──> [ER21: Milestone Acceptance Decision]
        └─ R7: 1 → 0..* ──> [ER8: Objective]
                                ├─ R17: 1 → 0..* ──> [ER20: Objective Acceptance Decision]
                                └─ R8:  1 → 0..* ──> [ER9: Task]
                                                          ├─ R9:  1 → 0..* ──> [ER10: Execution Attempt]
                                                          ├─ R10: 1 → 0..* ──> [ER11: Decision Wait]
                                                          ├─ R11: 1 → 0..* ──> [ER12: Recovery Obligation]
                                                          └─ R12: 1 → 0..* ──> [ER13: Execution Fact]

ユーザー・現在認可とRepository利用範囲
────────────────────────────────────
[Credential] ── userIdへ結合 ──> [User: UUID／表示名]
                                      │ 一つの現行Role
                                      ▼
                                [Role詳細権限]
                                      │ 要求毎に評価
                                      ▼
[ER5: 認証Context]
      │ R4: 各要求で現在認可を確認
      ▼
[ER6: 認可済み対象集合]
      │ R5: 現行Role・公開範囲・実アクセスでWorkspace対象を解決
      ▼
[ER4: Workspace]
      │ R3: 1 Workspaceは0..* Exposureを持つ
      ▼
[ER3: Repository Exposure]
      ▲
      │ R2: 1 Repositoryは0..* Exposureへ公開される
[ER2: Repository]

候補と人間判断
──────────────
[ER14: Meeting]
      └─ R13: 1 → 0..* ──> [ER15: Candidate]
                                   └─ R14: 0..* → 0..1 ──> [ER16: Topic／Decision]

[ER17: External Request]
      └─ R15: 1 → 0..* ──> [ER18: Returned Candidate]
                                   └─ R16: 0..* → 0..1 ──> [ER19: Adoption]
```

Relationはアクセス権や採用Authorityを自動生成しない。`Project ID`と`Repository ID`は別Identityであり、一つのProjectが複数Repositoryを持てる。

認可済み集合はCredentialへ固定された永続権限ではない。Workspaceの公開範囲と現在取得可能性を別判定し、Domain Modelは許可されたRepository集合だけを受ける。ER5／ER6とR4／R5は本モデルの局所ラベルであり、新しい保存Entity／通信fieldを要求しない。

## 5. 整合条件

| 対象 | 必須の相関 | 禁止する畳み込み |
|---|---|---|
| Task | Project、Objective、Task、Attempt、Generation | 別Attempt結果の混入 |
| Recovery | 最初の残存可能性から再入場までexact Identity | 新しい／拡大Authorityへの置換 |
| Projection | Source、Revision／Version、Observed At、Coverage | partialをcomplete、unknownを正常へ変換 |
| Acceptance Decision | Project、Objective／Milestone、根拠Revision、判断者、判断種別 | ProjectionからのAuthority生成、Task完了からObjective受入、Objective受入からMilestone受入 |
| External Result | Request、Consent Scope、Provider Result、Candidate | returnedをadoptedへ自動昇格 |
| Historical Context | Source、Occurred At、Applicable Revision、Currentness | historicalをcurrentへ自動採用 |
| 接続認可 | Credential→userId、現行Role詳細権限、Exposure、実アクセス | 表示名をIdentityにすること、旧権限固定、管理から内容閲覧の生成 |
| 新規発行／独立失効 | 発行は既存対象userId、独立失効はexact資格IdentityとuserIdへの結合。操作別結果 | 旧資格の自動失効、失効対象の拡大、独立失効による新発行・Secret、交換Recoveryの生成 |
| 鍵交換 | 旧失効前から同じRecovery ID、交換種別、入口、対象・既存発行先、失効・発行・記録・搬送・受領の観測 | 同じ交換内の別Recovery生成、元発行不明からの新交換、自動再発行、失効鍵の遅延利用表示、Secret耐久化、unknownの成功化、確定発行の後続配送失敗による不明化、Authority復元、取消完了の推定 |

## 6. Qualityへの引渡し

- 登録解除の同一操作・改訂、両読戻し、対象外・本体保持と開始済み取消非証明を確認する。
- 鍵3分岐、元発行IdentityとCredential IDの分離、元処理と別交換の相関分離、別交換の失効範囲、遅延旧応答の失効鍵表示拒否を反証する。

- 各状態の入口、許可操作、禁止操作、終了後観測を検証する。
- 多対多Relationと欠測を含むProjectionの整合性を確認する。
- 同じIdentity系列内で別Attempt、別Repository、別Workspaceが混入しないことを反証する。
- DataがTrust／Process／Repository／外部境界を越える箇所は、内容、Authority、保存、cleanupを結合して確認する。
- 受入判断は根拠表示、明示Authority、限定記録、終了後観測を分け、読取りProjection、Task作成およびProvider EffectとのEffect隔離を確認する。
- 同名・改名のIdentity不変、現行Roleの後続要求反映、三可視境界、管理／内容閲覧の分離を確認する。
- 新規発行の旧失効0・交換Recoveryなし、独立失効のexact資格対象・新発行／Secret／交換再入場0を別々に確認する。
- 鍵交換2操作×2入口、4組表示・3組だけ確認、保持情報不変、旧失効前から同じRecoveryへの結合を確認する。失効・発行・記録・搬送・受領とProcess喪失を別観測にし、確定発行を後続失敗で不明へ戻さない。秘密値を検証記録へ複製しない。
- 通常鍵操作の固定administrator、追加認証なしのHost交換2操作だけ、MCP全鍵操作非公開、現在参照許可と鍵権限の非同一性、固定8分担の迂回・変更前認可の欠落・更新受理からの内容取得推定を入口ごとに反証する。

## Checklist

- [x] Project状態、単一実行、候補本体、実行履歴の実装Ownerを分離した。
- [x] 上位受入判断を下位完了・通知・回復完了から生成しない。
- [x] 共通保存部品を全業務状態のOwnerとして扱っていない。
- [x] 基本状態遷移とAnalysis担当欄を照合し、回復再入場・義務解消から新規実行や一律成功を生成する矛盾を是正した。
- OPEN: 詳細API・全利用側・検証設計の具体化は段階3、固定設計の独立レビューは段階4へ残る。実装・実境界成立は未評価である。
