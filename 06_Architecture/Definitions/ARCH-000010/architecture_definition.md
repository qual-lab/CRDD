# Tool CapabilityとAIモデル構成のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000010`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。

| 区分 | 内容 |
|---|---|
| 状態Owner | Capability RegistryとModel Configuration Resolver |
| 所有する責務 | Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由 |
| 所有しない責務 | Tool実行、Provider利用可能性の捏造、Repository Binding |
| 主な外部境界 | Repository設定、Tool Package、Provider Preflight |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000010](../../Analysis/UI-000010/architecture_analysis.md) | Tool・AIモデル構成の選択 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000014](../../Analysis/SPEC-000014/architecture_analysis.md) | Repositoryに適合する標準Toolを解決する |
| [SPEC-000015](../../Analysis/SPEC-000015/architecture_analysis.md) | AIモデル構成を検証し実効選択を決める |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000010 | UI | Capability RegistryとModel Configuration Resolver | UI契約はAuthorityを発行しない。利用者操作: 選ぶ／構成を検証する／更新する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）。導線: 仕事→必要能力→登録Tool→配布根拠→起動 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。 → 結果と次の行動を認識する |
| SPEC-000014 | SPEC | Tool能力Registry | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない | 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。 | Tool一覧の閲覧だけで実行Authorityを発行しない。 | [目的＋Repository改訂版] -> [能力・配布根拠照合] -> [利用可能候補／不足／不一致] |
| SPEC-000015 | SPEC | AIモデル構成Manager | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する | 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 | [構成Candidate] -> [検証] ├ valid -> [採用済み構成] -> [実効選択] └ invalid／unavailable -> [拒否／再選定条件] |

## 5. 構造と依存方向

```text
[Capability RegistryとModel Configuration Resolver]
├─ [SPEC-000014: Repositoryに適合する標準Toolを解決する]
   [目的＋Repository改訂版] -> [能力・配布根拠照合] -> [利用可能候補／不足／不一致]
└─ [SPEC-000015: AIモデル構成を検証し実効選択を決める]
   [構成Candidate] -> [検証] ├ valid -> [採用済み構成] -> [実効選択] └ invalid／unavailable -> [拒否／再選定条件]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000010 | Capability RegistryとModel Configuration Resolver | UI契約はAuthorityを発行しない。利用者操作: 選ぶ／構成を検証する／更新する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）。導線: 仕事→必要能力→登録Tool→配布根拠→起動 |
| SPEC-000014 | Tool能力Registry | Tool能力一覧を閲覧する主体。一覧取得はTool実行Authorityを発行しない | 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。 |
| SPEC-000015 | AIモデル構成Manager | 構成管理者が更新を採用し、Runtimeが検証済み構成から選択する | 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。
- SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000010 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000014 | Tool一覧の閲覧だけで実行Authorityを発行しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000015 | 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| Tool入口はv0.20.1、外部モデル構成は基準版なし | Coordinator Tool入口／Provider model profile | Capability RegistryとModel Configuration Resolver | 一部保持・一部新規 | [coordinator:unit:provider-model-profile-runtime](../../../07_Quality/04_Test_Catalog.json) | Capability Registryと外部構成Schemaは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 能力発見→構成読込→検証→利用可能性確認→選択結果を段階的な結合試験で確認する。
- 未知Capability推定、古いモデル名固定、availability未確認の選択、一覧取得から実行Authority生成を理由別に反証する。
- cleanup・Recoveryは非該当。利用不能時は再選択条件を返す。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/coordinator/01_Architecture.md)
