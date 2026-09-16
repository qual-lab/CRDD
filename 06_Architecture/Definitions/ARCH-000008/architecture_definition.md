# 実行境界の診断のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000008`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。

| 区分 | 内容 |
|---|---|
| 状態Owner | Platform Access診断Port |
| 所有する責務 | 外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測 |
| 所有しない責務 | Provider Task、Docker修復、再起動、結果採用 |
| 主な外部境界 | OS Process、Docker、Network、外部CLI |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000005](../../Analysis/UI-000005/architecture_analysis.md) | 実行事実と故障境界の診断 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000009](../../Analysis/SPEC-000009/architecture_analysis.md) | 実行基盤の故障境界と利用可能範囲を診断する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000005 | UI | Platform Access診断Port | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別。導線: 実行→観測→根拠→評価→改善候補 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 実際に起きたことと故障箇所を根拠から切り分けられる。 → 結果と次の行動を認識する |
| SPEC-000009 | SPEC | Platform Access診断Port | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない | 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。 | 一つの失敗から全機能停止や原因を断定しない。 | [故障観測] -> [認証／起動／実行／取消／搬送／回復を照合] -> [確定箇所／未確定／利用可能範囲] |

## 5. 構造と依存方向

```text
[Platform Access診断Port]
└─ [SPEC-000009: 実行基盤の故障境界と利用可能範囲を診断する]
   [故障観測] -> [認証／起動／実行／取消／搬送／回復を照合] -> [確定箇所／未確定／利用可能範囲]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000005 | Platform Access診断Port | UI契約はAuthorityを発行しない。利用者操作: 診断を開く／証拠を絞る／回復へ進む | UI契約はEffectを定義しない。表示上の状態差: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別。導線: 実行→観測→根拠→評価→改善候補 |
| SPEC-000009 | Platform Access診断Port | 運用診断Capability。Provider Task、修復、再起動のAuthorityは含まない | 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000009: 一つの失敗から全機能停止や原因を断定しない。Effect: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000005 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000009 | 一つの失敗から全機能停止や原因を断定しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のProvider境界診断 | Coordinator／Platform Access診断 | Platform Access診断Port | 保持・分離 | [coordinator:integration:provider-execution-boundary-matrix](../../../07_Quality/Registry/test-catalog.json) | Provider非依存Port名は未確定 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 対象固定→境界別Probe→結果相関→終了を段階的な結合試験で確認する。
- 境界の一括失敗化、生stderr依存、観測不能のavailable化、診断から修復へのAuthority昇格を理由別に反証する。
- 修復・Recoveryは非該当。必要時は別の回復入口を案内する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/platform-access/01_Architecture.md)
- [現行照合先](../../Details/coordinator/01_Architecture.md)

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
