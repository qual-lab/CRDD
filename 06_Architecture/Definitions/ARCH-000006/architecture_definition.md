# Meeting候補と正本への引渡しのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000006`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Meeting内の観測、候補、採用、却下を区別し、候補作成と正本更新のAuthorityを分ける。媒体ではなく項目の目的で候補種別を決める。

| 区分 | 内容 |
|---|---|
| 状態Owner | Project Operation Context |
| 所有する責務 | Meeting ItemからTopic／Decision候補を作り、出所と採否を追跡するLifecycle |
| 所有しない責務 | Meeting本文の意味決定、候補の自動採用、各所有正本の内部規則 |
| 主な外部境界 | Meeting正本、Topic／Decision等の所有正本、人間判断 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000009](../../Analysis/UI-000009/architecture_analysis.md) | Meeting・Topic・候補の処置 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000013](../../Analysis/SPEC-000013/architecture_analysis.md) | Meeting内容を候補化し所有正本へ昇格する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000009 | UI | Project Operation Context | UI契約はAuthorityを発行しない。利用者操作: 候補化する／比較する／採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける。導線: Meeting→Item→候補→既存Topic比較→採否→所有正本 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 会議内容から継続論点や候補を見つけ、採否へ進める。 → 結果と次の行動を認識する |
| SPEC-000013 | SPEC | Project Operation Context | 候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする | 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。 | 文字列一致だけで統合・分割せず、会話を自動採用しない。 | [観察／会話] -> [候補] ├ 採用 -> [所有正本更新] ├ 却下 -> [候補履歴] └ 保留 -> [判断待ち] |

## 5. 構造と依存方向

```text
[Project Operation Context]
└─ [SPEC-000013: Meeting内容を候補化し所有正本へ昇格する]
   [観察／会話] -> [候補] ├ 採用 -> [所有正本更新] ├ 却下 -> [候補履歴] └ 保留 -> [判断待ち]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000009 | Project Operation Context | UI契約はAuthorityを発行しない。利用者操作: 候補化する／比較する／採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける。導線: Meeting→Item→候補→既存Topic比較→採否→所有正本 |
| SPEC-000013 | Project Operation Context | 候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする | 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000013: 文字列一致だけで統合・分割せず、会話を自動採用しない。Effect: 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000009 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000013 | 文字列一致だけで統合・分割せず、会話を自動採用しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| 基準版なし | なし（v0.21新規） | Project Operation Context | 新規 | 実装Evidence未作成 | 候補SchemaとOwner Adapterが未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「Meeting ItemからTopic／Decision候補を作り、出所と採否を追跡するLifecycle」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 観測→候補→判断→採用時だけ所有正本へ引渡しを段階的な結合試験で確認する。
- Meeting本文のコピー、出所喪失、自動採用、対象Owner不明を理由別に反証する。
- Process Recoveryは非該当。引渡し失敗は候補状態を保持して再判断可能にする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/project-operation/01_Architecture.md)
