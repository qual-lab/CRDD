# Project・Portfolio状態投影と受入判断記録のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000005`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Project／Portfolioの状態を根拠と不完全性付きで読む責務と、Task根拠に基づくObjective／Milestoneの受入判断を記録する責務を分ける。読取り投影は正本変更Authorityを持たず、受入判断記録はObjective／Milestoneの受入・差戻し・判断待ちだけを扱う。Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 読取り投影: Project Management Projection。受入判断記録: Objective／Milestone Acceptance Decision Record |
| 所有する責務 | Project／Milestone／Objective／Task状態と複数Project比較の読取り投影。Project運営者が行ったObjective／Milestoneの受入・差戻し・判断待ちの記録 |
| 所有しない責務 | Task作成、Provider Effect、下位完了からの上位受入推定、Meeting候補採用、優先順位の自動決定、受入判断以外の正本更新 |
| 主な外部境界 | Project正本、Quality／Roadmap等の正本、Objective／Milestone受入判断Port、Workbench／MCP |

責務全体を一つの書込み可能なComponentとして扱わない。公開Portは次の二つに分ける。

| Port | Owner | 許可する処置 | 禁止する処置 |
|---|---|---|---|
| Project Management Projection Port | Project Management Projection | Project／Milestone／Objective／Task状態と複数Project比較を読取り投影する | Project正本の変更、受入判断の記録、優先順位の自動決定 |
| Objective／Milestone Acceptance Decision Port | Objective／Milestone Acceptance Decision Record | Project運営者が明示した受入・差戻し・判断待ちを対象Identityへ記録する | Task作成、Provider Effect、下位完了からの上位受入推定、SPEC-000006／SPEC-000007からの書込み |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000004](../../Analysis/UI-000004/architecture_analysis.md) | Project・節目・Portfolioの状況把握 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000006](../../Analysis/SPEC-000006/architecture_analysis.md) | Projectと節目の現在状態を投影する |
| [SPEC-000007](../../Analysis/SPEC-000007/architecture_analysis.md) | 複数Projectを比較可能な投影へ統合する |
| [SPEC-000002](../../Analysis/SPEC-000002/architecture_analysis.md) | Task完了後のObjective受入とObjective受入後のMilestone受入を別判断として扱う |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000004 | UI | Project Management Projection | UI契約はAuthorityを発行しない。利用者操作: Projectを選ぶ／Task根拠と受入条件を確認する／Objectiveを受け入れる・差し戻す・判断待ちにする／Milestoneを受け入れる・差し戻す・判断待ちにする／根拠を見る／比較する。 | UI契約はEffectを定義しない | Task完了やObjective受入だけからMilestone受入を推定する／欠測や古い値を完全な現在値と誤認する／単一Scoreや欠測した集計で健全性を断定する | Task完了／Objective受入／Milestone受入を別にする / Milestone→目的と受入条件→Task根拠→受入判断 / ；complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown） / プロジェクト→現在投影→不足・競合→情報源→次の判断 / ；complete／partial／開示制限（restricted）／stale／競合あり（conflicting） / Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） /  |
| SPEC-000006 | SPEC | Project Management Projection | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない | 読取り投影だけを返し、Project正本を変更しない。 | 競合・欠測・開示制限を正常値で補完しない。 | [情報源解決] -> [完全／partial／stale／conflicting]  -> [根拠付きProject View] |
| SPEC-000007 | SPEC | Project Management Projection | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない | 読取り投影だけを返し、非開示Projectを探索・変更しない。 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 | [比較対象解決] -> [Project別Coverage保持] -> [比較可能／比較不能] |
| SPEC-000002 | SPEC | Objective／Milestone Acceptance Decision Record | Project運営者がTask根拠からObjective受入を、Objective根拠からMilestone受入を判断する。下位完了から上位受入を推定しない | Objective／Milestoneの受入・差戻し・判断待ちだけを記録する。Task作成やProvider Effectは発行しない | Task完了をObjective受入へ、Objective受入をMilestone受入へ推定した場合はEffect 0で停止する | Task完了→Objective受入／差戻し／判断待ち→Milestone受入／差戻し／判断待ち |

## 5. 構造と依存方向

```text
 [Project Operation Sources]                 [Project運営者の明示判断]
            │ 判断根拠                                  │ Authority
            ▼                                           ▼
 [Project Management Projection]             [Acceptance Decision Port]
       Owner: 読取り投影                  Owner: Objective／Milestone
       Input: SPEC-000006／000007          Acceptance Decision Record
       Effect: 正本変更なし                Input: SPEC-000002
                    │                     Effect: 受入／差戻し／判断待ち
                    │                             │
                    ▼                             ▼
       [根拠・不完全性付きView]           [対象Identityへ限定記録]
       [Coverageを保った比較]             [Task作成／Provider Effectなし]

       ※ 両PortはAuthorityを共有しない。
       ※ Task完了→Objective受入→Milestone受入を自動推定しない。
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000004 | Project Management Projection | UI契約はAuthorityを発行しない。利用者操作: Projectを選ぶ／Task根拠と受入条件を確認する／Objectiveを受け入れる・差し戻す・判断待ちにする／Milestoneを受け入れる・差し戻す・判断待ちにする／根拠を見る／比較する。 | UI契約はEffectを定義しない |
| SPEC-000006 | Project Management Projection | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない | 読取り投影だけを返し、Project正本を変更しない。 |
| SPEC-000007 | Project Management Projection | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない | 読取り投影だけを返し、非開示Projectを探索・変更しない。 |
| SPEC-000002 | Objective／Milestone Acceptance Decision Record | Project運営者がTask根拠からObjective受入を、Objective根拠からMilestone受入を判断する。下位完了から上位受入を推定しない | Objective／Milestoneの受入・差戻し・判断待ちだけを記録する。Task作成やProvider Effectは発行しない |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。SPEC-000006／SPEC-000007はProject Management Projection Portだけを使用し、Objective／Milestone Acceptance Decision Portへ到達できない。SPEC-000002の受入判断記録は、読取り投影を正本更新可能にするAuthorityではない。

## 7. 失敗・回復・観測

- UI-000004: Task完了やObjective受入だけからMilestone受入を推定する／欠測や古い値を完全な現在値と誤認する／単一Scoreや欠測した集計で健全性を断定する Effect: UI契約はEffectを定義しない
- SPEC-000006: 競合・欠測・開示制限を正常値で補完しない。 Effect: 読取り投影だけを返し、Project正本を変更しない。
- SPEC-000007: 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 Effect: 読取り投影だけを返し、非開示Projectを探索・変更しない。
- SPEC-000002: Task完了をObjective受入へ、Objective受入をMilestone受入へ推定した場合はEffect 0で停止する Effect: Objective／Milestoneの受入・差戻し・判断待ちだけを記録する。Task作成やProvider Effectは発行しない

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000004 | Task完了やObjective受入だけからMilestone受入を推定する／欠測や古い値を完全な現在値と誤認する／単一Scoreや欠測した集計で健全性を断定する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000006 | 競合・欠測・開示制限を正常値で補完しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000007 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000002 | Task完了をObjective受入へ、Objective受入をMilestone受入へ推定した場合はEffect 0で停止する | 三段階の受入判断と非推定を、委任受付およびTask作成から分けて確認する |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000004 | REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000007: プロジェクト運営者／PMが「プロジェクトの現在地を根拠と不完全性付きで理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000020: プロジェクト運営者／PMが「複数リポジトリを不完全性付きで一つのプロジェクトとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000013: 経営・管理層が「複数プロジェクトを根拠付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000006 | REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000007: プロジェクト運営者／PMが「プロジェクトの現在地を根拠と不完全性付きで理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000020: プロジェクト運営者／PMが「複数リポジトリを不完全性付きで一つのプロジェクトとして見る」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000007 | REQ-000013: 経営・管理層が「複数プロジェクトを根拠付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 経営・管理層を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000002 | REQ-000002: プロジェクト運営者／PMが「複数AIへ任せる範囲と権限を理解する」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000003: プロジェクト運営者／PMが「目的と受入条件で節目を委ねる」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| 基準版なし | なし（v0.21新規） | Project Management Projection／Objective・Milestone Acceptance Decision Record | 新規 | 実装Evidence未作成 | 読取り投影の物理Schema／Workbench実測と、受入判断Port／Recordの実装・試験Evidenceが未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Project／Milestone／Objective／Task状態と複数Project比較の読取り投影」を所有するCore、Objective／Milestoneの受入判断だけを記録するPort、および外部境界を扱うAdapterを分ける。
- 対象解決→Source観測→項目別投影→必要時に比較→結果返却を段階的な結合試験で確認する。
- 受入判断Portは、対象IdentityとProject運営者の明示判断を検証してから、受入・差戻し・判断待ちのいずれか一件だけを記録する。読取り投影Portからの呼出し、Task作成、Provider Effectおよび下位完了からの推定がEffect 0になることを確認する。
- 受入段階の混同、欠測の正常化、Restricted Sourceの存在漏洩、古い値の現在値化を理由別に反証する。
- 取消・cleanup・Recoveryは非該当。再観測は新しい読取りとして扱う。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/project-operation/01_Architecture.md)
- [現行照合先](../../Details/cros/01_Architecture.md)

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
