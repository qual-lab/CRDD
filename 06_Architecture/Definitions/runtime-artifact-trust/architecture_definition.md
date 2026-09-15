# Runtime Artifactの信頼評価のArchitecture定義

成果物種別: Architecture定義
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

verified／trusted／quality_assuredを別軸にし、Qual-Lab署名を実行資格へ集約しない。Forkや企業署名、許可されたLocal unsignedを利用者所有Policyで評価する。

| 区分 | 内容 |
|---|---|
| 状態Owner | Runtime Trust Evaluator |
| 所有する責務 | CRDD準拠、Artifact完全性、Publisher、利用者Trust Policy、公式識別の独立評価 |
| 所有しない責務 | 利用者に代わる信頼判断、外部送信、候補採用 |
| 主な外部境界 | Runtime Artifact、署名検証、Deployment OwnerのTrust Policy |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000013](../../Analysis/UI-000013/architecture_analysis.md) | Runtime信頼判断と公式識別 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000018](../../Analysis/SPEC-000018/architecture_analysis.md) | Runtimeの信頼要素を独立評価する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000013 | UI | Runtime Trust Evaluator | UI契約はAuthorityを発行しない。利用者操作: 検証する／信頼方針を選ぶ／詳細を見る | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。導線: 成果物（Artifact）→各根拠→利用者方針→導入判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 配布元、改ざん有無、準拠、利用者の信頼方針を分けて判断できる。 → 結果と次の行動を認識する |
| SPEC-000018 | SPEC | Runtime Trust Evaluator | Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する | 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 | [Artifact] -> [準拠／完全性／Publisher／Trust Policy／品質を別評価] -> [trusted／untrusted／unknown] |

## 5. 構造と依存方向

```text
[Runtime Trust Evaluator]
└─ [SPEC-000018: Runtimeの信頼要素を独立評価する]
   [Artifact] -> [準拠／完全性／Publisher／Trust Policy／品質を別評価] -> [trusted／untrusted／unknown]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000013 | Runtime Trust Evaluator | UI契約はAuthorityを発行しない。利用者操作: 検証する／信頼方針を選ぶ／詳細を見る | UI契約はEffectを定義しない。表示上の状態差: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。導線: 成果物（Artifact）→各根拠→利用者方針→導入判断 |
| SPEC-000018 | Runtime Trust Evaluator | Deployment OwnerがTrust Policyを所有する。Qual-Lab署名は公式配布者の識別だけを保証する | 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000018: 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。Effect: 読取り評価だけを返し、Runtime実行Capabilityを自動発行しない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000013 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000018 | 一要素のPassから全体信頼を推定せず、不明を許可へ畳まない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の署名済みRuntime Identity | Artifact Signing／Coordinator release trust | Runtime Trust Evaluator | 保持・Trust分離候補 | [artifact-signing:integration:private-key-signing](../../../07_Quality/04_Test_Catalog.json)、[coordinator:integration:sign-release-manifest](../../../07_Quality/04_Test_Catalog.json) | 利用者所有Trust Policyは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「CRDD準拠、Artifact完全性、Publisher、利用者Trust Policy、公式識別の独立評価」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- Artifact観測→各軸検証→Policy評価→構造化判断を段階的な結合試験で確認する。
- 署名への保証集約、unknownのtrusted化、公式表示から実行許可生成、Fork排除を理由別に反証する。
- Task Recovery・外部送信は非該当。再評価はArtifactまたはPolicy変更時に行う。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../artifact-signing/01_Architecture.md)
- [現行照合先](../../coordinator/01_Architecture.md)
