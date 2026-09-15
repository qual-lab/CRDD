# Repository境界とBindingのArchitecture定義

成果物種別: Architecture定義
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

verified／unverified／ambiguous／unavailableを分け、local／cross-sourceの対象範囲を明示する。GitはAdapterの一実装であり、未Commitを理由に通常利用を拒否しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Version Control PortとRepository Binding Resolver |
| 所有する責務 | 開始PathからのRepository Root検証、Repository／Project Identity、実行対象Binding |
| 所有しない責務 | Git commitを成立条件にすること、Tool選択、Runtime Data清掃 |
| 主な外部境界 | Version Control、Filesystem、Repository Manifest |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000006](../../Analysis/UI-000006/architecture_analysis.md) | Repository内作業と対象選択 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000010](../../Analysis/SPEC-000010/architecture_analysis.md) | Repositoryと実行対象のBindingを解決する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000006 | UI | Version Control PortとRepository Binding Resolver | UI契約はAuthorityを発行しない。利用者操作: 対象を選ぶ／Rootを確認する／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。導線: Project→Repository→Binding→検証済みRoot | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 普段のRepository作業を保ちながら、対象の取り違えを防げる。 → 結果と次の行動を認識する |
| SPEC-000010 | SPEC | Version Control PortとRepository Binding Resolver | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない | 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 | [開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決] └--曖昧／不正--> [Effect 0] |

## 5. 構造と依存方向

```text
[Version Control PortとRepository Binding Resolver]
└─ [SPEC-000010: Repositoryと実行対象のBindingを解決する]
   [開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決] └--曖昧／不正--> [Effect 0]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000006 | Version Control PortとRepository Binding Resolver | UI契約はAuthorityを発行しない。利用者操作: 対象を選ぶ／Rootを確認する／正本を開く | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。導線: Project→Repository→Binding→検証済みRoot |
| SPEC-000010 | Version Control PortとRepository Binding Resolver | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない | 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000010: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。Effect: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000006 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000010 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のRepository Root検証 | Version Control／Coordinator Root Resolver | Version Control PortとRepository Binding Resolver | 保持・Adapter化 | [version-control:integration:repository-location](../../../07_Quality/04_Test_Catalog.json) | Git以外のAdapter実証は未実施 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「開始PathからのRepository Root検証、Repository／Project Identity、実行対象Binding」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 開始Path→Root検証→Manifest照合→Binding返却を段階的な結合試験で確認する。
- 偽装.git、worktree／submodule誤認、親Repositoryへの逸脱、Commit SHAへの過剰依存を理由別に反証する。
- Task Recoveryは非該当。境界不明時はEffect 0で停止する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../version-control/01_Architecture.md)
