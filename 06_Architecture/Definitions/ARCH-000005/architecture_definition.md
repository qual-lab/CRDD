# Project・Portfolio状態投影のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000005`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。

| 区分 | 内容 |
|---|---|
| 状態Owner | Project Management Projection |
| 所有する責務 | Project／Milestone／Objective／Task状態と複数Project比較の読取り投影 |
| 所有しない責務 | 正本更新、Meeting候補採用、優先順位の自動決定 |
| 主な外部境界 | Project正本、Quality／Roadmap等の正本、Workbench／MCP |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000004](../../Analysis/UI-000004/architecture_analysis.md) | Project・節目・Portfolioの状況把握 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000006](../../Analysis/SPEC-000006/architecture_analysis.md) | Projectと節目の現在状態を投影する |
| [SPEC-000007](../../Analysis/SPEC-000007/architecture_analysis.md) | 複数Projectを比較可能な投影へ統合する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000004 | UI | Project Management Projection | UI契約はAuthorityを発行しない。利用者操作: Projectを選ぶ／根拠を見る／比較する | UI契約はEffectを定義しない。表示上の状態差: Task完了／Objective受入／Milestone受入を別にする。導線: Milestone→目的と受入条件→Task根拠→受入判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 単一または複数Projectの現在地を根拠と不完全性付きで判断できる。 → 結果と次の行動を認識する |
| SPEC-000006 | SPEC | Project Management Projection | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない | 読取り投影だけを返し、Project正本を変更しない。 | 競合・欠測・開示制限を正常値で補完しない。 | [情報源解決] -> [完全／partial／stale／conflicting] -> [根拠付きProject View] |
| SPEC-000007 | SPEC | Project Management Projection | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない | 読取り投影だけを返し、非開示Projectを探索・変更しない。 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 | [比較対象解決] -> [Project別Coverage保持] -> [比較可能／比較不能] |

## 5. 構造と依存方向

```text
[Project Management Projection]
├─ [SPEC-000006: Projectと節目の現在状態を投影する]
   [情報源解決] -> [完全／partial／stale／conflicting] -> [根拠付きProject View]
└─ [SPEC-000007: 複数Projectを比較可能な投影へ統合する]
   [比較対象解決] -> [Project別Coverage保持] -> [比較可能／比較不能]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000004 | Project Management Projection | UI契約はAuthorityを発行しない。利用者操作: Projectを選ぶ／根拠を見る／比較する | UI契約はEffectを定義しない。表示上の状態差: Task完了／Objective受入／Milestone受入を別にする。導線: Milestone→目的と受入条件→Task根拠→受入判断 |
| SPEC-000006 | Project Management Projection | Project情報を閲覧できる主体。投影は正本変更Authorityを持たない | 読取り投影だけを返し、Project正本を変更しない。 |
| SPEC-000007 | Project Management Projection | 各Projectを閲覧できる主体。比較から優先順位の決定を自動発行しない | 読取り投影だけを返し、非開示Projectを探索・変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000006: 競合・欠測・開示制限を正常値で補完しない。Effect: 読取り投影だけを返し、Project正本を変更しない。
- SPEC-000007: 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。Effect: 読取り投影だけを返し、非開示Projectを探索・変更しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000004 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000006 | 競合・欠測・開示制限を正常値で補完しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000007 | 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| 基準版なし | なし（v0.21新規） | Project Management Projection | 新規 | 実装Evidence未作成 | 物理SchemaとWorkbench実測が未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Project／Milestone／Objective／Task状態と複数Project比較の読取り投影」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 対象解決→Source観測→項目別投影→必要時に比較→結果返却を段階的な結合試験で確認する。
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
