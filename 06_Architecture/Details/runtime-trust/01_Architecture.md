# Runtime Artifactの信頼評価設計

成果物種別: Architecture詳細設計
詳細設計領域: runtime-trust
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | 準拠、完全性、Publisher、品質と利用者所有Trust Policyを別軸で評価する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Evidence Reader、Trust Evaluator、Policy Source、利用側を分ける。 | [§1](#1-責務と依存) |
| Interface Model | Required | 各評価軸と最終判断を構造化する。 | [§2](#2-評価契約) |
| Data Flow | Required | Artifact観測からPolicy評価までの出所を保持する。 | [§3](#3-評価フロー) |
| State Model | Required | verified、trusted、quality_assuredを独立状態にする。 | [§2](#2-評価契約) |
| Sequence | Required | Artifact／Policyの同一snapshotを確認してから判断する。 | [§3](#3-評価フロー) |
| Failure／Recovery | Required | unknown、Policy変更、Artifact変更時の再評価を扱う。 | [§4](#4-失敗と再評価) |
| Deployment | Required | 公式、Fork、企業署名、Local unsignedでPolicy入力が異なる。 | [§5](#5-配置profile) |
| Observability | Required | 軸別根拠と利用したPolicy revisionを返す。 | [§2](#2-評価契約) |
| Security Boundary | Required | Publisher証明と実行許可を分離し、利用者判断を奪わない。 | [§1](#1-責務と依存) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | ArtifactとPolicyを同じ評価snapshotへ固定し、途中変更時は再評価する。 | [§3](#3-評価フロー) |
| Timing | PASS | 観測時点とPolicy revisionを結果へ付け、古い判断を新しい実行へ流用しない。 | [§4](#4-失敗と再評価) |
| Resource Lifecycle | N/A | Runtime起動やProcess資源を所有せず、読取り評価だけを返す。 | [§1](#1-責務と依存) |
| External Boundary | PASS | Artifact、署名検証、準拠結果、Policy Sourceを独立入力にする。 | [§2](#2-評価契約) |
| Failure／Recovery | PASS | 一軸のunknownをtrustedへ畳まず、ArtifactまたはPolicy変更時に再評価する。 | [§4](#4-失敗と再評価) |
| State／Consistency | PASS | verified、trusted、quality_assuredを独立状態にする。 | [§2](#2-評価契約) |
| Observability | PASS | 軸別根拠と利用したPolicy revisionを返す。 | [§2](#2-評価契約) |
| Security／Trust | PASS | Publisher証明と実行許可を分離し、利用者判断を奪わない。 | [§1](#1-責務と依存) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `runtime-trust.axis-evaluation` | Flow／Consistency | 同一Artifact snapshot | 各軸が独立結果を持つ | 署名だけでtrusted、unknown許可 | UT／IT | Adjacent 1 Block | axis result、evidence、observed_at | 実行Capability 0 | 品質監査内容は別Owner |
| `runtime-trust.policy-decision` | Interface／Security Boundary | publisher rules、unsigned local rule | Deployment OwnerのPolicyだけを適用 | Qual-Lab固定許可、Fork一律拒否 | IT／ST | Direct Boundary | policy revisionとdecision reason | Policy変更時に旧判断失効 | OS Credential Store連携 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行の署名検証、Coordinator実行GateとCROS Trust Domainは正式入力ではない。Canonical詳細を固定した後、軸別評価と利用者Policyの実装を分類する。

## 1. 責務と依存

```text
[Artifact Evidence] ─┐
[Conformance] ───────┼─→ [Runtime Trust Evaluator] ─→ structured decision
[Quality Evidence] ──┤              ↑
[Publisher Proof] ───┘      [Deployment Owner Policy]

Publisher Proof ──x── Runtime実行資格そのもの
Evaluator       ──x── Humanの信頼判断を代行
```

## 2. 評価契約

| 軸 | 値 | 根拠 |
|---|---|---|
| Conformance | pass／fail／unknown | 対象Contractとrevision |
| Integrity | verified／invalid／unknown | hash、signature、artifact identity |
| Publisher | identified／unidentified／invalid | publisher identityと検証方法 |
| Quality | assured／not_assured／unknown | 対象版のQuality evidence |
| Trust | trusted／not_trusted／unknown | Deployment Owner Policyと軸別結果 |

## 3. 評価フロー

```text
Artifactを一回観測
       ↓
軸別Evidenceを同じArtifact Identityへ結合
       ↓
現在のTrust Policy revisionを取得
       ↓
軸別結果を保持したままPolicy評価
       ↓
根拠付きdecision（実行Effectなし）
```

## 4. 失敗と再評価

- 一つでも必要軸が観測不能なら`unknown`を保持する。
- Artifact bytes、identityまたはPolicy revisionが変わったら再評価する。
- Qual-Lab公式表示、完全性Pass、準拠Passのどれか一つから`trusted`を推定しない。

## 5. 配置Profile

| 配置 | Publisher | Policy例 |
|---|---|---|
| Qual-Lab公式 | Qual-Lab | 公式識別と利用者Policyを別に評価 |
| Organization build | 利用組織 | 組織Publisherを許可可能 |
| Fork build | 任意Publisher | 準拠・完全性・Policyで評価 |
| Local development | unsigned | 明示したLocal用途だけ許可可能 |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `runtime-trust.axis-evaluation`<br>`runtime-trust.policy-decision` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Publisher、Repository、Runtime Identity、Execution Source等のTrust軸を、独立評価とPolicy合成の共通契約へ揃える。 | 各軸のunknown、accepted、rejectedを保持し、一軸の成立を全体Trustへ拡張しない。 | Trust軸追加が独自Booleanや暗黙既定値を持ち、Policy判断を迂回する。 | `runtime-trust.axis-evaluation`<br>`runtime-trust.policy-decision` |
| Creation／Selection | Required | この観点を成立させる構造と責務が存在するため。 | Authority、入力または配置条件を満たした後にだけ具象・処理経路を選ぶ。 | 選択前の検証と選択後のIdentityを分け、未確認時はEffect 0とする。 | 選択条件の変更はTrust、Authorityまたは利用側契約へ波及する。 | `runtime-trust.axis-evaluation` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `runtime-trust.axis-evaluation` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `runtime-trust.axis-evaluation`<br>`runtime-trust.policy-decision` |
| Lifecycle Ownership | N/A | 本領域は独立した動的資源を所有しない。 | 本領域は独立した動的資源を所有しない。 | 資源所有を追加する場合はLifecycle契約を新設する。 | 現時点では非該当。 | N/A |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `runtime-trust.policy-decision` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
