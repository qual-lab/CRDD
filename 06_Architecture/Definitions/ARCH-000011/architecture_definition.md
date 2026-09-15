# Runtime Dataの配置・保持・清掃のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000011`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

temporary／durable／recovery_required／cleanup／unknownを用途別に分ける。Repository-local情報を自Repoに集約し、横断CROS状態はOS管理Rootへ分離する。

| 区分 | 内容 |
|---|---|
| 状態Owner | Runtime Data Contract |
| 所有する責務 | Repository-local .crddとOS管理Runtime Rootの用途、Owner、耐久性、保持、清掃 |
| 所有しない責務 | 各Toolの業務データ意味、任意Pathへの書込み、由来不明残存の削除 |
| 主な外部境界 | Filesystem、Repository Root、OS-managed Runtime Root |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000011](../../Analysis/UI-000011/architecture_analysis.md) | 実行時データの保持・清掃 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000016](../../Analysis/SPEC-000016/architecture_analysis.md) | 実行時データの配置・保持・清掃を制御する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000011 | UI | Runtime Data Contract | UI契約はAuthorityを発行しない。利用者操作: 保持内容を見る／清掃する／保留する | UI契約はEffectを定義しない。表示上の状態差: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。導線: 作業→データ用途→保持判断→清掃→不存在確認 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 必要な状態だけを保持し、不要になったデータを安全に清掃できる。 → 結果と次の行動を認識する |
| SPEC-000016 | SPEC | Runtime Data Contract | 各領域Ownerに限定した書込みCapability。別用途・別Repositoryへ転用しない | 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。 | 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。 | [作成要求] -> [Root／用途検証] -> [保持中] -> [清掃可能判定] -> [清掃] -> [不存在確認] |

## 5. 構造と依存方向

```text
[Runtime Data Contract]
└─ [SPEC-000016: 実行時データの配置・保持・清掃を制御する]
   [作成要求] -> [Root／用途検証] -> [保持中] -> [清掃可能判定] -> [清掃] -> [不存在確認]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000011 | Runtime Data Contract | UI契約はAuthorityを発行しない。利用者操作: 保持内容を見る／清掃する／保留する | UI契約はEffectを定義しない。表示上の状態差: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。導線: 作業→データ用途→保持判断→清掃→不存在確認 |
| SPEC-000016 | Runtime Data Contract | 各領域Ownerに限定した書込みCapability。別用途・別Repositoryへ転用しない | 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000016: 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。Effect: 許可領域への作成・publish・清掃Effectを発行し、終了後状態を再観測する。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000011 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000016 | 用途不明の直下書込み、時間だけの削除、別Repositoryへの波及を拒否する。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の.crdd利用とRecovery Store | 各Tool Writer／Runtime Data path resolver | Runtime Data Contract | 保持・再編 | [runtime-data:integration:repository-paths](../../../07_Quality/Registry/test-catalog.json)、[runtime-data:integration:temporary-operation-lifecycle](../../../07_Quality/Registry/test-catalog.json) | 全Writer移行は未完了 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Repository-local .crddとOS管理Runtime Rootの用途、Owner、耐久性、保持、清掃」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- Root検証→Area選択→書込み→保持判定→cleanup／Recovery→不存在観測を段階的な結合試験で確認する。
- 直下への無秩序配置、tmpの耐久利用、由来不明残存削除、別Repositoryへの書込みを理由別に反証する。
- なし。Filesystem Effectを伴うため完全Lifecycleを必要とする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/runtime-data/02_Current_Path_Reality_Audit.md)
- [現行照合先](../../Details/runtime-data/01_Architecture.md)
