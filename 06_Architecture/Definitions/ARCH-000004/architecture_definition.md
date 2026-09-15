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

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000002 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 委任する／取消す／判断を返す | UI契約はEffectを定義しない。表示上の状態差: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。導線: 目的→範囲と担い手→許可→実行 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 任せた範囲と進行状態を理解し、必要な時だけ判断する。 → 結果と次の行動を認識する |
| UI-000003 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 再試行する／回復する／清掃する | UI契約はEffectを定義しない。表示上の状態差: 失敗後の作用なし／作用済み／不明、回復要／不要。導線: 失敗→作用状態→同じ依頼の結果→回復処置または再試行 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 失敗後に同じ作用を重複させず、安全な回復方法を選べる。 → 結果と次の行動を認識する |
| UI-000012 | UI | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 引き継ぐ／再接続する／結果を戻す | UI契約はEffectを定義しない。表示上の状態差: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。導線: 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 必要な情報を限定して渡し、切断後も同じ仕事へ戻れる。 → 結果と次の行動を認識する |
| SPEC-000002 | SPEC | 委任受付 | Project運営者が委任範囲を決める。Runtimeは範囲を拡張しない | 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。 | 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。 | [提案] --検証--> [受理可能] --受理--> [Task作成済み] └--不足／競合--> [blocked・Effect 0] |
| SPEC-000003 | SPEC | Project状態照会 | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない | 読取り専用。TaskやProvider Processを変更しない。 | 観測不能や古い状態を進行中・完了へ推定しない。 | [ready] -> [running] -> [waiting／blocked／completed／failed] 各状態は観測時点と次の行動を伴う |
| SPEC-000004 | SPEC | 再試行・回復分類 | 回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない | 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。 | 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。 | [失敗／切断] --Effect観測--> [なし／済み／不明] ├ なし  -> [再試行候補] ├ 済み  -> [結果再取得] └ 不明  -> [回復／再確認必須] |
| SPEC-000005 | SPEC | 清掃Controller | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime | 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。 | 由来不明、参照中、観測不能は削除せず、義務を保持する。 | [義務あり] -> [処置準備済み] -> [清掃Effect発行済み] -> [終了後未確認] -> [不存在確認・義務解消] |
| SPEC-000017 | SPEC | 結果再接続Resolver | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない | 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。 | 応答喪失を未実行とみなさず、別依頼として再発行しない。 | [依頼準備] -> [情報搬送] -> [Task実行] -> [結果生成] -> [結果帰還] 切断時: [同じIdentityで状態／結果再取得] |
| SPEC-000028 | SPEC | 取消Controllerと終了観測 | exactなTask／Attemptへ限定した取消権限。実行、回復、清掃Authorityを含まない | 取消要求を一度だけ発行する。新規Provider実行と別TaskへのEffectは0。 | 古い世代、別Identity、競合完了、終了観測不能または資源残存を取消完了へ丸めない。 | [実行中／判断待ち] -> [取消要求済み] -> [終了観測] -> [取消完了／完了結果／回復必要] |
| SPEC-000029 | SPEC | 判断受付とTask再開調停 | exactな判断点へ結合した人間の決定権限。委任、実行、取消、回復Authorityを含まない | 判断を一度記録し、同じTaskへ再開可能通知を一度渡す。新規Task／Attemptは作らない。 | 古い世代、別判断点、重複、競合または再開観測不能を成功へ丸めない。 | [判断待ち] -> [判断記録済み] -> [再開可能] -> [実行中／結果] |

## 5. 構造と依存方向

```text
[Project Runtime]
├─ [SPEC-000002: 委任範囲と権限を確定して受理する]
   [提案] --検証--> [受理可能] --受理--> [Task作成済み] └--不足／競合--> [blocked・Effect 0]
├─ [SPEC-000003: 委任した仕事の状態と判断要否を返す]
   [ready] -> [running] -> [waiting／blocked／completed／failed] 各状態は観測時点と次の行動を伴う
├─ [SPEC-000004: 失敗後の再試行と回復を安全に選別する]
   [失敗／切断] --Effect観測--> [なし／済み／不明] ├ なし  -> [再試行候補] ├ 済み  -> [結果再取得] └ 不明  -> [回復／再確認必須]
├─ [SPEC-000005: 残存資源を清掃し終了後を確認する]
   [義務あり] -> [処置準備済み] -> [清掃Effect発行済み] -> [終了後未確認] -> [不存在確認・義務解消]
├─ [SPEC-000017: Task情報と結果を同じ仕事へ引き継ぎ再取得する]
   [依頼準備] -> [情報搬送] -> [Task実行] -> [結果生成] -> [結果帰還] 切断時: [同じIdentityで状態／結果再取得]
├─ [SPEC-000028: Taskの取消を要求し終了状態を確認する]
   [実行中／判断待ち] -> [取消要求済み] -> [終了観測] -> [取消完了／完了結果／回復必要]
└─ [SPEC-000029: 判断待ちTaskへ判断を返し再開可能にする]
   [判断待ち] -> [判断記録済み] -> [再開可能] -> [実行中／結果]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000002 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 委任する／取消す／判断を返す | UI契約はEffectを定義しない。表示上の状態差: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。導線: 目的→範囲と担い手→許可→実行 |
| UI-000003 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 再試行する／回復する／清掃する | UI契約はEffectを定義しない。表示上の状態差: 失敗後の作用なし／作用済み／不明、回復要／不要。導線: 失敗→作用状態→同じ依頼の結果→回復処置または再試行 |
| UI-000012 | Project Runtime | UI契約はAuthorityを発行しない。利用者操作: 引き継ぐ／再接続する／結果を戻す | UI契約はEffectを定義しない。表示上の状態差: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。導線: 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| SPEC-000002 | 委任受付 | Project運営者が委任範囲を決める。Runtimeは範囲を拡張しない | 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。 |
| SPEC-000003 | Project状態照会 | Taskを閲覧できる主体。状態照会から取消・回復Authorityを推定しない | 読取り専用。TaskやProvider Processを変更しない。 |
| SPEC-000004 | 再試行・回復分類 | 回復または再試行を選ぶ決定権限者。分類結果だけではEffectを発行しない | 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。 |
| SPEC-000005 | 清掃Controller | 回復義務に結合した清掃Capabilityを持つ運用者またはRuntime | 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。 |
| SPEC-000017 | 結果再接続Resolver | 送信・実行・結果閲覧を別に認可し、再接続は新規実行Authorityを発行しない | 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。 |
| SPEC-000028 | 取消Controllerと終了観測 | exactなTask／Attemptへ限定した取消権限。実行、回復、清掃Authorityを含まない | 取消要求を一度だけ発行する。新規Provider実行と別TaskへのEffectは0。 |
| SPEC-000029 | 判断受付とTask再開調停 | exactな判断点へ結合した人間の決定権限。委任、実行、取消、回復Authorityを含まない | 判断を一度記録し、同じTaskへ再開可能通知を一度渡す。新規Task／Attemptは作らない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000002: 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。Effect: 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。
- SPEC-000003: 観測不能や古い状態を進行中・完了へ推定しない。Effect: 読取り専用。TaskやProvider Processを変更しない。
- SPEC-000004: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。Effect: 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。
- SPEC-000005: 由来不明、参照中、観測不能は削除せず、義務を保持する。Effect: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。
- SPEC-000017: 応答喪失を未実行とみなさず、別依頼として再発行しない。Effect: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。
- SPEC-000028: 取消要求の受理を終了とみなさず、競合完了と終了観測不能を区別する。Effect: exactなTask／Attemptへ取消を一度だけ発行し、新規Provider実行は0。
- SPEC-000029: 古い世代、別判断点、重複または競合を成功へ丸めない。Effect: 判断を一度記録して同じTaskへ再開可能通知を渡し、新規Task／Attemptは作らない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000002 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| UI-000003 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| UI-000012 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000002 | 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000003 | 観測不能や古い状態を進行中・完了へ推定しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000004 | 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000005 | 由来不明、参照中、観測不能は削除せず、義務を保持する。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000017 | 応答喪失を未実行とみなさず、別依頼として再発行しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000028 | 取消要求の受理、Process終了、資源回収および終了観測を同一視しない。 | 競合完了、終了観測不能、重複取消および対象外Effect 0を理由別に反証できること |
| SPEC-000029 | 判断点、世代、Authority、重複および競合を区別する。 | 判断の一回記録、同じTaskへの再開通知、新規Task／Attempt 0を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

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
