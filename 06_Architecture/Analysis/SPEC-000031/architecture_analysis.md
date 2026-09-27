# SPEC-000031のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000031`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000031 Repository差分を選びCommit・通常Pushする](../../../05_SPEC/Definitions/SPEC-000031/spec_definition.md)

このSPEC定義だけを正式入力とする。上流工程、現行ArchitectureまたはGit実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

検証済みRepositoryの作業差分から変更集合を選び、Commitを作成し、確認済みの設定済みUpstreamへ通常Pushする。

### UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000034](../../../05_SPEC/Analysis/UX-000034/spec_analysis.md) | Projectの意味と作業差分を結び、共有対象を取り違えず通常Pushまで進む |

### IA観点の分析結果

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000007](../../../05_SPEC/Analysis/IA-000007/spec_analysis.md) | 履歴管理状態、変更差分、変更集合、外部共有対象および操作結果 |

### 両観点の統合判断

検証済みRepositoryでTreeとDiffを観測し、利用者が選んだ変更だけをStage／UnstageしてCommitする。Push前にRemote、Branch、送信Commitを明示確認し、要求、受理、Remote反映および終了後状態を分ける。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 利用者が作業差分を確認して共有を選ぶ時 |
| 事前条件 | Repository Root、Branch、HEAD、Tree、Diff、Remote、Upstreamを観測できる |
| Authority | Stage、Unstage、Commit、Pushは人間の選択に基づく。Pushは送信対象の明示確認を必要とする |
| 判定不能 | Repository、Remote、Branch、送信CommitまたはAuthorityが不明なら外部Effect 0で停止する |

### 振る舞い・状態・結果

```text
[Tree観測]
   ↓
[差分選択] ── Stage／Unstage ──▶ [変更集合]
   ↓
[Commit作成]
   ↓ Remote・Branch・Commit確認
[通常Push要求] ─▶ [受理／拒否／不明] ─▶ [終了後観測]
```

- Staged、Unstaged、Untracked、Conflictを区別する。
- Commit作成とRemote反映を同一視しない。
- Push拒否、認証失敗、通信断および状態不明を成功へ畳まない。

### 失敗・回復・副作用

- 失敗: Conflict、無効な差分選択、Commit失敗、Push拒否、認証失敗、通信断、Remote結果不明。
- 副作用: Stage領域、Local Commit、Remote Branchを順に変更し得る。各Effectの成立を別々に観測する。
- 回復: 既知のTreeとCommitを保持し、再観測後に利用者が再試行または別入口を選ぶ。自動再送とForce Pushを行わない。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 選択差分だけをCommitし、確認したRemote・Branch・Commitを通常Pushして終了後状態を返す |
| 境界 | 空変更、Untracked、Conflict、Upstreamなし、Remote差分ありを区別する |
| 失敗 | 誤対象を送らず、部分成立と結果不明を成功表示しない |
| 観測不能 | Push結果を確認できなければ再送せず、既知状態と再観測先を返す |
| 対応UI | [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)のTree・Diff・Stage・Commit・Push確認と一致する |

### 対応するUI

- pairs_with: [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)

### 制約

Force Push、Branch作成、Merge、RebaseおよびRemote設定管理は対象外とする。Version Control実装を差替可能にし、Git CLIへの直接依存を固定しない。

### 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を解消済みとみなさない。

#### UX-000034から継承する確認事項

- 確認事項: 部分Stage、Large Repository、認証失敗時の負担、既存Toolとの比較価値。
- 判断者: 開発者、Project運営者／PM、Qual-Lab。
- 現在判定: Workbench Pilotでの実利用確認が必要。Architecture責務のCanonical化を止める事項ではない。
- 未確認時の影響: 性能条件、高度な操作、確認UIを確定しない。
- Discoveryへ戻す条件: 想定利用者、問題、通常Pushの必要性または対象外操作が変わる場合。
- UX分析へ戻す条件: 利用場面、目的、重要場面、失敗または品質期待が変わる場合。

#### IA-000007から継承する確認事項

Git Commitを業務Identityにせず、要求、受理、Remote反映および終了後観測の時点差を維持する。情報構造が不足する場合はIAを再開する。

#### SPEC固有の追加判断

通常Pushの確認負担はPilotで評価する。対象外操作が必要になればDiscoveryへ戻す。

### 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

### 補足定義

なし。

この節にあるUX／IA参照は、正式入力であるSPEC Definitionが報告する来歴であり、Architectureの追加の正式入力ではない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Repository境界とBindingのArchitecture定義](../../Definitions/ARCH-000009/architecture_definition.md) | Version Control PortとRepository Binding Resolver | 人間が選択した差分と明示確認したPush対象に限定する | Stage領域、Local Commit、Remote Branchを順に変更し、各Effectを個別観測する | 誤対象、Conflict、Commit失敗、Push拒否、認証失敗、通信断、結果不明の成功化 |

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | [Repository境界とBindingのArchitecture定義](../../Definitions/ARCH-000009/architecture_definition.md)へ入力Contractを意味変更せず渡す。 |
| Boundary／Component／Interface | 評価済み | Workbench利用側、Version Control Port、Git Adapter、Remote境界を分け、Git固有方式をPort外へ漏らさない。 |
| Data／State Ownership | 評価済み | Version Control PortをTree、選択集合、Stage、Commit、Push結果のOwner候補とし、業務IdentityとGit Identityを同一視しない。 |
| Failure／Recovery | 評価済み | 誤対象、Conflict、Commit失敗、Push拒否、認証失敗、通信断、結果不明を成功へ畳まず、自動再送しない。 |
| Security／Trust | 評価済み | 検証済みRepositoryと人間が確認したRemote・Branch・CommitだけへEffectを許可し、Force Pushを禁止する。 |
| Quality Constraint | 評価済み | Stage、Commit、Push受理、Remote反映および終了後状態を別々に観測する。 |
| Human Input | 継承あり | 部分Stage、Large Repository、認証失敗時の負担、既存Toolとの比較価値および通常Push確認負担をWorkbench Pilotで評価する。 |
| Open／Gap | 上流確認を継承 | 現在判定: 後続の実利用確認が必要。現在のSPEC定義をCanonical化する判断を止める事項ではない。Architecture固有の追加Gapはない。 |
| Verification Intent | 評価済み | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

Human Inputの判断者は「開発者、Project運営者／PM、Qual-Lab」。再評価契機は「Workbench Pilot、前提変更、または対象外操作が必要になった時」。Architectureはこれらを解消済みとせず、入力の意味が変わる場合はOwner工程へ戻す。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Repository境界とBinding](../../Definitions/ARCH-000009/architecture_definition.md) | Same | 検証済みRepositoryと差替可能なVersion Control PortをOwnerとする既存責務へ統合できる。読取り専用のSPEC-000010とはAuthority、Effect、失敗および回復を分ける |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000006
- Tree、Diff、Stage、Commit、Push確認および結果不明を利用者が区別できること。
- UIがAuthorityを独自発行せず、人間の確認結果だけをVersion Control Portへ渡すこと。
- Commit成立をRemote反映として表示せず、Push結果不明時に自動再送しないこと。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
