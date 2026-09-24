# Repository境界とBindingのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000009`
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

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000006 | UI | Version Control PortとRepository Binding Resolver | UI契約はAuthorityを発行しない。利用者操作: 対象を選ぶ／Rootを確認する／正本を開く。 | UI契約はEffectを定義しない | CROS未設定で手元作業まで止まる／同名や近いパスを同じ対象と誤認する | 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） / Project→Repository→Binding→検証済みRoot / ；手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 / Repository→手元の正本→作業、必要時だけCROS /  |
| SPEC-000010 | SPEC | Version Control PortとRepository Binding Resolver | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない | 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 | [開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決]   └--曖昧／不正--> [Effect 0] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000006 (UI)
   確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） / Project→Repository→Binding→検証済みRoot / ；手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 / Repository→手元の正本→作業、必要時だけCROS / 
└─ SPEC-000010 (SPEC)
   [開始Path] -> [Repository Root検証] -> [Repository／Project／Binding解決]   └--曖昧／不正--> [Effect 0]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000006 | Version Control PortとRepository Binding Resolver | UI契約はAuthorityを発行しない。利用者操作: 対象を選ぶ／Rootを確認する／正本を開く。 | UI契約はEffectを定義しない |
| SPEC-000010 | Version Control PortとRepository Binding Resolver | 現在Repositoryで作業する主体。別RepositoryへのAuthorityは発行しない | 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000006: CROS未設定で手元作業まで止まる／同名や近いパスを同じ対象と誤認する Effect: UI契約はEffectを定義しない
- SPEC-000010: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 Effect: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000006 | CROS未設定で手元作業まで止まる／同名や近いパスを同じ対象と誤認する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000010 | 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000006 | REQ-000008: 開発者が「現在リポジトリだけで日常作業を完結する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000036: 開発者が「日常作業をCommit SHAや特定Git実装から切り離す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000009: プロジェクト運営者／PMが「プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000020: プロジェクト運営者／PMが「複数リポジトリを不完全性付きで一つのプロジェクトとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000010 | REQ-000008: 開発者が「現在リポジトリだけで日常作業を完結する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000036: 開発者が「日常作業をCommit SHAや特定Git実装から切り離す」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000009: プロジェクト運営者／PMが「プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000020: プロジェクト運営者／PMが「複数リポジトリを不完全性付きで一つのプロジェクトとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000024: プロジェクト運営者／PMが「境界を越えた結果を同じタスクへ受け取る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のRepository Root検証 | Version Control／Coordinator Root Resolver | Version Control PortとRepository Binding Resolver | 保持・Adapter化 | [version-control:integration:repository-location](../../../07_Quality/Registry/test-catalog.json) | Git以外のAdapter実証は未実施 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「開始PathからのRepository Root検証、Repository／Project Identity、実行対象Binding」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 開始Path→Root検証→Manifest照合→Binding返却を段階的な結合試験で確認する。
- 偽装.git、worktree／submodule誤認、親Repositoryへの逸脱、Commit SHAへの過剰依存を理由別に反証する。
- Task Recoveryは非該当。境界不明時はEffect 0で停止する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/version-control/01_Architecture.md)

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
