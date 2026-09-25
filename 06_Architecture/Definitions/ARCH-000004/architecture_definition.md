# Project実行のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000004`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。

| 区分 | 内容 |
|---|---|
| 状態Owner | Project Runtime |
| 所有する責務 | Objective／Task受付、Project-level状態、判断待ち、取消、Recovery義務、再入場、結果 |
| 所有しない責務 | Provider選定、OS操作、Transport、人間の採用判断 |
| 主な外部境界 | Coordinator Execution Port、状態Store、人間判断 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000002](../../Analysis/UI-000002/architecture_analysis.md) | 委任・実行状態・判断 |
| [UI-000003](../../Analysis/UI-000003/architecture_analysis.md) | 失敗後の再試行・回復・清掃 |
| [UI-000012](../../Analysis/UI-000012/architecture_analysis.md) | Agent間の情報引継ぎと再接続 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000002](../../Analysis/SPEC-000002/architecture_analysis.md) | 委任範囲と権限を確定して受理する |
| [SPEC-000003](../../Analysis/SPEC-000003/architecture_analysis.md) | 委任した仕事の状態と判断要否を返す |
| [SPEC-000004](../../Analysis/SPEC-000004/architecture_analysis.md) | 失敗後の再試行と回復を安全に選別する |
| [SPEC-000005](../../Analysis/SPEC-000005/architecture_analysis.md) | 残存資源を清掃し終了後を確認する |
| [SPEC-000017](../../Analysis/SPEC-000017/architecture_analysis.md) | Task情報と結果を同じ仕事へ引き継ぎ再取得する |
| [SPEC-000028](../../Analysis/SPEC-000028/architecture_analysis.md) | Taskの取消を要求し終了状態を確認する |
| [SPEC-000029](../../Analysis/SPEC-000029/architecture_analysis.md) | 判断待ちTaskへ判断を返し再開可能にする |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000002 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 委任を提案する／委任範囲を確認して受け付ける／拒否する／拒否理由から同じ提案の範囲を見直す／取消す／判断を返す。 | UI契約はEffectを定義しない | 暗黙の範囲拡張、拒否後の別依頼化、回復不能／古い観測や取消要求の受理だけを進捗・完了と誤認する | 準備中／許可待ち／実行中／停止。権限発行前後を分ける。提案／受付可能／受付済み／拒否は受付Feedbackとして別に示す / 目的→範囲と担い手→許可→実行。拒否時は同じ提案の範囲見直しへ戻る。受付後の結果不明はLifecycleへ追加せず、同じ依頼識別情報の再観測条件として示す / ；開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） / Task→現在状態→判断要否→待機・入力・取消・回復 / ；開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）に加え、取消要求済み（cancel_requested）／取消完了（cancelled）／取消結果不明・回復必要（cancel_unknown／recovery_required）を区別する / Task→現在状態→判断要否→待機・入力・取消要求→終了状態確認／同じ回復対象識別子（Recovery Identity）の再観測 /  |
| UI-000003 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 再試行する／回復する／清掃する。 | UI契約はEffectを定義しない | 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす／名前や経過時間だけで由来不明物を削除する | 失敗後の作用なし／作用済み／不明、回復要／不要 / 失敗→作用状態→同じ依頼の結果→回復処置または再試行 / ；存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） / 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 / ；存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） / 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 /  |
| UI-000012 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 引き継ぐ／再接続する／結果を戻す。 | UI契約はEffectを定義しない | 全量投入・秘密情報混入・古い仮説の現在値化／Timeoutを未実行とみなし新規外部作用（Effect）を起こす | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） / 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 / ；進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） / 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 / ；進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） / 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 /  |
| SPEC-000002 | SPEC | 委任受付 | Project運営者が委任範囲を判断する。Runtimeは範囲を拡張しない | 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする | 不足・競合・未承認範囲はEffect前に停止する。明示拒否は再発行しない。受付後の結果不明は同じRequestを再観測する | 提案→検証→受理／拒否→Task作成→実行状態または同じRequestの再観測 |
| SPEC-000003 | SPEC | Project状態照会 | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない | 読取り専用。TaskやProvider Processを変更しない。 | 観測不能や古い状態を進行中・完了へ推定しない。 | [ready] -> [running] -> [waiting／blocked／completed／failed] 各状態は観測時点と次の行動を伴う |
| SPEC-000004 | SPEC | 再試行・回復分類 | 回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない | 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。 | 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。 | [失敗／切断] --Effect観測--> [なし／済み／不明]   ├ なし  -> [再試行候補]   ├ 済み  -> [結果再取得]   └ 不明  -> [回復／再確認必須] |
| SPEC-000005 | SPEC | 清掃Controller | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime | 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。 | 由来不明、参照中、観測不能は削除せず、義務を保持する。 | [義務あり] -> [処置準備済み] -> [清掃Effect発行済み]  -> [終了後未確認] -> [不存在確認・義務解消] |
| SPEC-000017 | SPEC | 結果再接続Resolver | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない | 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。 | 応答喪失を未実行とみなさず、別依頼として再発行しない。 | [依頼準備] -> [情報搬送] -> [Task実行] -> [結果生成] -> [結果帰還] 切断時: [同じIdentityで状態／結果再取得] |
| SPEC-000028 | SPEC | 取消Controllerと終了観測 | 対象Taskと試行へ限定した取消権限を持つ主体。実行、回復、清掃または別Taskの権限を含まない | 検証済みの対象Taskと試行に限り、取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。 | 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。 | [実行中／判断待ち]         │ --対象・世代・取消権限を検証-->         ▼ [取消要求済み] --終了を観測--> [取消完了]         │                         └─ 終了後資源を確認         ├--先に正常完了を観測--> [完了結果]         └--作用状態を確認不能--> [取消結果不明／回復必要] |
| SPEC-000029 | SPEC | 判断受付とTask再開調停 | その判断点へ結合した人間の決定権限。委任範囲、Provider実行、取消、回復または別判断点の権限を含まない | 検証済みの判断点へ判断または入力を一度記録し、同じTaskへ再開可能通知を一度だけ渡す。新しいTaskや試行は自動作成しない。 | 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。 | [判断待ち]     │ --Task・判断点・世代・決定権限を検証-->     ▼ [判断記録済み] --同じTaskへ結合--> [再開可能]     │                                  │     └--競合／重複--> [blocked]         └--Runtimeが再開--> [実行中／結果] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000002 (UI)
   準備中／許可待ち／実行中／停止。権限発行前後を分ける。提案／受付可能／受付済み／拒否は受付Feedbackとして別に示す / 目的→範囲と担い手→許可→実行。拒否時は同じ提案の範囲見直しへ戻る。受付後の結果不明はLifecycleへ追加せず、同じ依頼識別情報の再観測条件として示す / ；開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） / Task→現在状態→判断要否→待機・入力・取消・回復 / ；開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）に加え、取消要求済み（cancel_requested）／取消完了（cancelled）／取消結果不明・回復必要（cancel_unknown／recovery_required）を区別する / Task→現在状態→判断要否→待機・入力・取消要求→終了状態確認／同じ回復対象識別子（Recovery Identity）の再観測 / 
├─ UI-000003 (UI)
   失敗後の作用なし／作用済み／不明、回復要／不要 / 失敗→作用状態→同じ依頼の結果→回復処置または再試行 / ；存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） / 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 / ；存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） / 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 / 
├─ UI-000012 (UI)
   準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） / 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 / ；進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） / 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 / ；進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） / 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 / 
├─ SPEC-000002 (SPEC)
   提案→検証→受理／拒否→Task作成→実行状態または同じRequestの再観測
├─ SPEC-000003 (SPEC)
   [ready] -> [running] -> [waiting／blocked／completed／failed] 各状態は観測時点と次の行動を伴う
├─ SPEC-000004 (SPEC)
   [失敗／切断] --Effect観測--> [なし／済み／不明]   ├ なし  -> [再試行候補]   ├ 済み  -> [結果再取得]   └ 不明  -> [回復／再確認必須]
├─ SPEC-000005 (SPEC)
   [義務あり] -> [処置準備済み] -> [清掃Effect発行済み]  -> [終了後未確認] -> [不存在確認・義務解消]
├─ SPEC-000017 (SPEC)
   [依頼準備] -> [情報搬送] -> [Task実行] -> [結果生成] -> [結果帰還] 切断時: [同じIdentityで状態／結果再取得]
├─ SPEC-000028 (SPEC)
   [実行中／判断待ち]         │ --対象・世代・取消権限を検証-->         ▼ [取消要求済み] --終了を観測--> [取消完了]         │                         └─ 終了後資源を確認         ├--先に正常完了を観測--> [完了結果]         └--作用状態を確認不能--> [取消結果不明／回復必要]
└─ SPEC-000029 (SPEC)
   [判断待ち]     │ --Task・判断点・世代・決定権限を検証-->     ▼ [判断記録済み] --同じTaskへ結合--> [再開可能]     │                                  │     └--競合／重複--> [blocked]         └--Runtimeが再開--> [実行中／結果]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000002 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 委任を提案する／委任範囲を確認して受け付ける／拒否する／拒否理由から同じ提案の範囲を見直す／取消す／判断を返す。 | UI契約はEffectを定義しない |
| UI-000003 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 再試行する／回復する／清掃する。 | UI契約はEffectを定義しない |
| UI-000012 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 引き継ぐ／再接続する／結果を戻す。 | UI契約はEffectを定義しない |
| SPEC-000002 | 委任受付 | Project運営者が委任範囲を判断する。Runtimeは範囲を拡張しない | 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする |
| SPEC-000003 | Project状態照会 | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない | 読取り専用。TaskやProvider Processを変更しない。 |
| SPEC-000004 | 再試行・回復分類 | 回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない | 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。 |
| SPEC-000005 | 清掃Controller | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime | 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。 |
| SPEC-000017 | 結果再接続Resolver | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない | 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。 |
| SPEC-000028 | 取消Controllerと終了観測 | 対象Taskと試行へ限定した取消権限を持つ主体。実行、回復、清掃または別Taskの権限を含まない | 検証済みの対象Taskと試行に限り、取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。 |
| SPEC-000029 | 判断受付とTask再開調停 | その判断点へ結合した人間の決定権限。委任範囲、Provider実行、取消、回復または別判断点の権限を含まない | 検証済みの判断点へ判断または入力を一度記録し、同じTaskへ再開可能通知を一度だけ渡す。新しいTaskや試行は自動作成しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000002: 暗黙の範囲拡張、拒否後の別依頼化、回復不能／古い観測や取消要求の受理だけを進捗・完了と誤認する Effect: UI契約はEffectを定義しない
- UI-000003: 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす／名前や経過時間だけで由来不明物を削除する Effect: UI契約はEffectを定義しない
- UI-000012: 全量投入・秘密情報混入・古い仮説の現在値化／Timeoutを未実行とみなし新規外部作用（Effect）を起こす Effect: UI契約はEffectを定義しない
- SPEC-000002: 不足・競合・未承認範囲はEffect前に停止する。明示拒否は再発行しない。受付後の結果不明は同じRequestを再観測する Effect: 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする
- SPEC-000003: 観測不能や古い状態を進行中・完了へ推定しない。 Effect: 読取り専用。TaskやProvider Processを変更しない。
- SPEC-000004: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。 Effect: 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。
- SPEC-000005: 由来不明、参照中、観測不能は削除せず、義務を保持する。 Effect: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。
- SPEC-000017: 応答喪失を未実行とみなさず、別依頼として再発行しない。 Effect: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。
- SPEC-000028: 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。 Effect: 検証済みの対象Taskと試行に限り、取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。
- SPEC-000029: 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。 Effect: 検証済みの判断点へ判断または入力を一度記録し、同じTaskへ再開可能通知を一度だけ渡す。新しいTaskや試行は自動作成しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000002 | 暗黙の範囲拡張、拒否後の別依頼化、回復不能／古い観測や取消要求の受理だけを進捗・完了と誤認する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| UI-000003 | 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす／名前や経過時間だけで由来不明物を削除する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| UI-000012 | 全量投入・秘密情報混入・古い仮説の現在値化／Timeoutを未実行とみなし新規外部作用（Effect）を起こす | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000002 | 不足・競合・未承認範囲はEffect前に停止する。明示拒否は再発行しない。受付後の結果不明は同じRequestを再観測する | 委任受付、拒否、Task作成、結果不明時の同じRequest再観測を、上位受入判断と分けて確認する |
| SPEC-000003 | 観測不能や古い状態を進行中・完了へ推定しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000004 | 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000005 | 由来不明、参照中、観測不能は削除せず、義務を保持する。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000017 | 応答喪失を未実行とみなさず、別依頼として再発行しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000028 | 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000029 | 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000002 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| UI-000003 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000022: 実行環境の導入・運用者が「残存資源の由来・保持・清掃・回復を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| UI-000012 | REQ-000017: 外部へ渡す情報の所有者が「必要な情報だけを出所付きで渡す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000002 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000003 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000004 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000022: 実行環境の導入・運用者が「残存資源の由来・保持・清掃・回復を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000005 | REQ-000015: 実行環境の導入・運用者が「実行時データの所有場所と一連の状態変化を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000022: 実行環境の導入・運用者が「残存資源の由来・保持・清掃・回復を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行環境の導入・運用者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000017 | REQ-000017: 外部へ渡す情報の所有者が「必要な情報だけを出所付きで渡す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000027: 外部へ渡す情報の所有者が「送信範囲を理解し帰還結果を候補として扱う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000021: プロジェクト運営者／PMが「切断後に同じ依頼へ戻る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 外部へ渡す情報の所有者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000028 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000029 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000002／PRT-000002](../../../04_UI/Details/Areas/operation/SCR-000002/screen.md) | UI-000002 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [SCR-000003／PRT-000003](../../../04_UI/Details/Areas/operation/SCR-000003/screen.md) | UI-000003 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [SCR-000012／PRT-000012](../../../04_UI/Details/Areas/operation/SCR-000012/screen.md) | UI-000012 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000002](../../../05_SPEC/Details/BHV-000002/behavior.md) | SPEC-000002 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000003](../../../05_SPEC/Details/BHV-000003/behavior.md) | SPEC-000003 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000004](../../../05_SPEC/Details/BHV-000004/behavior.md) | SPEC-000004 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000005](../../../05_SPEC/Details/BHV-000005/behavior.md) | SPEC-000005 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000017](../../../05_SPEC/Details/BHV-000017/behavior.md) | SPEC-000017 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000028](../../../05_SPEC/Details/BHV-000028/behavior.md) | SPEC-000028 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |
| [BHV-000029](../../../05_SPEC/Details/BHV-000029/behavior.md) | SPEC-000029 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000002.spec-000029`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のProject Runtime、Coordinator、取消、判断再開、Recovery | Project Runtime／Coordinator | Project Runtime | 保持・責務分離 | [project-runtime:unit:objective-intake](../../../07_Quality/Registry/test-catalog.json)、[project-runtime:unit:state-query](../../../07_Quality/Registry/test-catalog.json)、[coordinator:integration:project-runtime-full-flow](../../../07_Quality/Registry/test-catalog.json) | 取消／判断再開の実装Evidence対応とWorkbench／CROS入口との接続は詳細設計で再確認する |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Objective／Task受付、Project-level状態、判断待ち、取消、Recovery義務、再入場、結果」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 受付→実行→結果→判断／完了、または失敗分類→Recovery→settlementを段階的な結合試験で確認する。
- 範囲拡張、状態の別Task混入、Effect不明の再試行、cleanup要求だけの完了化を理由別に反証する。
- なし。外部Effectを伴うため完全Lifecycleを必要とする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/project-runtime/01_Architecture.md)
- [現行照合先](../../Details/coordinator/01_Architecture.md)
- [現行照合先](../../Details/platform-access/01_Architecture.md)

## Checklist

- [x] UI分析とSPEC分析だけを正式入力として統合した
- [x] UI ContractとSPEC Contractを入力別に保持した
- [x] 独立したArchitecture Responsibilityを説明できる
- [x] 所有する責務、所有しない責務およびBoundaryを明示した
- [x] Major Component、Interfaceおよび依存方向を明示した
- [x] Data／State Ownershipを明示した
- [x] Authority、EffectおよびLifecycleを入力別に評価した
- [x] Failure Boundary、Recovery責任および観測を明示した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
