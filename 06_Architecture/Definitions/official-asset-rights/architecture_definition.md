# 公式素材の権利・用途確認のArchitecture定義

成果物種別: Architecture定義
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

candidate／approved／restricted／withdrawnを区別し、生成手段や見た目だけから公開・再配布権を推定しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 公式Repositoryの素材収載判断 |
| 所有する責務 | 素材の出所、権利確認、許可用途、対象版、決定権限者の記録 |
| 所有しない責務 | 法的判断の自動化、確認だけからの収載・再配布、用途外利用 |
| 主な外部境界 | 素材提供者、決定権限者、公式Repository、公開成果物 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000019](../../Analysis/UI-000019/architecture_analysis.md) | 公式素材の由来・権利・用途確認 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000024](../../Analysis/SPEC-000024/architecture_analysis.md) | 公式素材の由来・権利・用途を確認する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000019 | UI | 公式Repositoryの素材収載判断 | UI契約はAuthorityを発行しない。利用者操作: 素材を見る／根拠を確認する／利用する | UI契約はEffectを定義しない。表示上の状態差: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）。導線: 素材→由来→権利→用途→収載・派生 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 素材の由来と許可された用途を確認して安心して使える。 → 結果と次の行動を認識する |
| SPEC-000024 | SPEC | 公式Repositoryの素材収載判断 | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない | 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。 | 生成手段だけで権利を推定せず、用途外利用を許可しない。 | [素材候補] -> [由来／権利／用途／判断者を照合] ├ 確認済み -> [approved／restricted] ├ 取下げ -> [withdrawn] └ 不明 -> [candidateのまま停止] |

## 5. 構造と依存方向

```text
[公式Repositoryの素材収載判断]
└─ [SPEC-000024: 公式素材の由来・権利・用途を確認する]
   [素材候補] -> [由来／権利／用途／判断者を照合] ├ 確認済み -> [approved／restricted] ├ 取下げ -> [withdrawn] └ 不明 -> [candidateのまま停止]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000019 | 公式Repositoryの素材収載判断 | UI契約はAuthorityを発行しない。利用者操作: 素材を見る／根拠を確認する／利用する | UI契約はEffectを定義しない。表示上の状態差: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn）。導線: 素材→由来→権利→用途→収載・派生 |
| SPEC-000024 | 公式Repositoryの素材収載判断 | 権利確認と許可用途を決められる決定権限者。確認結果は収載・配布や用途外利用のAuthorityを含まない | 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000024: 生成手段だけで権利を推定せず、用途外利用を許可しない。Effect: 由来・権利・許可用途・判断者を同じ素材へ記録する。実際の収載・配布は別の変更・Release Authorityを必要とする。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000019 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000024 | 生成手段だけで権利を推定せず、用途外利用を許可しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の公式素材確認記録 | Communication／Release判断 | 公式Repositoryの素材収載判断 | 保持 | [CHG-000073 §5](../../../99_Roadmap/Changes/CHG-000073/change.md#5-独立レビューと構造是正) | Workbench操作は未定義 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「素材の出所、権利確認、許可用途、対象版、決定権限者の記録」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 候補→根拠確認→人間判断→対象版・用途照合→収載／非収載を段階的な結合試験で確認する。
- 生成手段からの権利推定、許可用途の拡張、撤回後の継続利用を理由別に反証する。
- Runtime Recoveryは非該当。判断不能時は候補を隔離する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../../17_Communication.md)
- [現行照合先](../../../19_Maintenance.md)
