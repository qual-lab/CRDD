# Workspace利用範囲とRepository FederationのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000013`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

credential_required／restricted／unavailable／unknownを区別し、Credential→Session→Workspace Grant→Exposure→Repositoryの順で利用範囲を決める。

| 区分 | 内容 |
|---|---|
| 状態Owner | CROS Session／Workspace Resolver |
| 所有する責務 | CredentialからのSession Grant、Workspace、Repository Exposure、Source-aware Federation |
| 所有しない責務 | User Role階層、Repository内部ACL、System AdminからContent Accessの推定 |
| 主な外部境界 | Remote Client、Credential Store、複数Repository |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000008](../../Analysis/UI-000008/architecture_analysis.md) | Workspace接続と利用可能範囲 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000012](../../Analysis/SPEC-000012/architecture_analysis.md) | 接続資格からWorkspace利用範囲を確定する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000008 | UI | CROS Session／Workspace Resolver | UI契約はAuthorityを発行しない。利用者操作: 接続する／Workspaceを選ぶ／再認証する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）。導線: 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 接続資格で許可されたWorkspaceだけを利用できる。 → 結果と次の行動を認識する |
| SPEC-000012 | SPEC | CROS Session／Workspace Resolver | Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する | 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。 | 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。 | [未認証] -> [Credential検証] -> [Session＋Workspace Grant] ├ current -> [利用可能範囲] └ stale／invalid -> [拒否・存在非開示] |

## 5. 構造と依存方向

```text
[CROS Session／Workspace Resolver]
└─ [SPEC-000012: 接続資格からWorkspace利用範囲を確定する]
   [未認証] -> [Credential検証] -> [Session＋Workspace Grant] ├ current -> [利用可能範囲] └ stale／invalid -> [拒否・存在非開示]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000008 | CROS Session／Workspace Resolver | UI契約はAuthorityを発行しない。利用者操作: 接続する／Workspaceを選ぶ／再認証する | UI契約はEffectを定義しない。表示上の状態差: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）。導線: 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 |
| SPEC-000012 | CROS Session／Workspace Resolver | Credential発行時に固定されたWorkspace Grant。管理Capabilityと内容Grantを分離する | 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000012: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。Effect: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000008 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000012 | 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| 基準版なし | なし（v0.21新規） | CROS Session／Workspace Resolver | 新規 | 実装Evidence未作成 | Personal／Shared Server実装とRemote MCP実測が未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「CredentialからのSession Grant、Workspace、Repository Exposure、Source-aware Federation」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 接続→認証→Grant確定→Exposure照合→Repository解決→切断時失効を段階的な結合試験で確認する。
- 接続成功からの過剰Grant、Repo名・Pathの漏洩、stale Exposure、管理者への暗黙Content Accessを理由別に反証する。
- Project Task Recoveryは非該当。Session切断後のTaskはProject Runtimeの再取得契約へ渡す。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

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
