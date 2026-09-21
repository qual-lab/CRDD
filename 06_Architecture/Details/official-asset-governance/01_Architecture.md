# 公式素材の権利・用途管理設計

成果物種別: Architecture詳細設計
詳細設計領域: official-asset-governance
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000017](../../Definitions/ARCH-000017/architecture_definition.md) | 素材の出所、権利確認、許可用途、対象版、判断者と収載状態を同じIdentityで管理する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 提供者、判断者、記録、Repository、Releaseを分ける。 | [§1](#1-責務ブロック) |
| Interface Model | Required | 素材記録と判断結果の必須fieldを固定する。 | [§2](#2-素材記録) |
| Data Flow | Required | 提供から判断、収載、派生、取下げまで出所を保つ。 | [§3](#3-lifecycle) |
| State Model | Required | candidate、approved、restricted、withdrawnを区別する。 | [§3](#3-lifecycle) |
| Sequence | Required | 権利・用途確認より前に収載・公開しない。 | [§3](#3-lifecycle) |
| Failure／Recovery | Required | 根拠不足、用途外利用、取下げ後の扱いを定義する。 | [§4](#4-失敗と停止) |
| Deployment | Required | 公式Repository収載と公開成果物への配布を別Effectにする。 | [§1](#1-責務ブロック) |
| Observability | Required | 判断者、対象版、許可用途、根拠へ戻れるようにする。 | [§2](#2-素材記録) |
| Security Boundary | Required | 確認記録から法的判断、公開、用途外利用のAuthorityを生成しない。 | [§4](#4-失敗と停止) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 判断開始時の期待revisionと確定時の現行revisionを照合し、同一素材版への競合判断は後着側をEffect 0で拒否する。 | [§3](#3-lifecycle) |
| Timing | PASS | 判断時点と対象版を記録し、取下げ後の新規利用へ旧判断を流用しない。 | [§2](#2-素材記録) |
| Resource Lifecycle | PASS | 候補、収載済み、派生成果物、取下げ記録の保持責務を分ける。 | [§3](#3-lifecycle) |
| External Boundary | PASS | 提供者の申告、判断者の確認、Repository収載、Release公開を別境界にする。 | [§1](#1-責務ブロック) |
| Failure／Recovery | PASS | 根拠不足はcandidateで停止し、取下げは新規用途を停止して影響先を追跡する。 | [§4](#4-失敗と停止) |
| State／Consistency | PASS | candidate、approved、restricted、withdrawnを区別する。 | [§3](#3-lifecycle) |
| Observability | PASS | 判断者、対象版、許可用途、根拠へ戻れるようにする。 | [§2](#2-素材記録) |
| Security／Trust | PASS | 確認記録から法的判断、公開、用途外利用のAuthorityを生成しない。 | [§4](#4-失敗と停止) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `official-asset-governance.asset-decision` | Transition／Security Boundary | asset identityと根拠 | 判断者・用途・対象版が揃う | 生成手段だけで承認、用途空欄 | IT／UAT | User Acceptance | state、authority、evidence | 未確認時は収載Effect 0 | 法的助言は対象外 |
| `official-asset-governance.asset-publication` | Sequence／Transition | approved assetとRelease | 許可用途内で別Authorityにより実行 | restricted公開、withdrawn再利用 | IT／ST | Related 2 Blocks | release relationとasset state | 影響先追跡または公開なし | 外部配布先の撤回能力 |
| `official-asset-governance.revision-conflict` | Transition／Consistency | asset identity、期待revision、現行revision | 一致するrevisionへ一つの判断だけを確定 | silent overwrite、後着判断による上書き | UT／IT | Direct Boundary | 勝者revision、拒否理由、共有確定状態 | 敗者Effect 0、勝者状態を保持 | 複数判断者による競合反証 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

現行素材、権利確認文書、署名処理とRelease履歴は正式入力ではない。Canonical詳細を固定した後、素材Identityと判断・収載・公開の接続を分類する。

## 1. 責務ブロック

```text
[素材提供者] ── source／declaration ──→ [Asset Record]
                                              │
[決定権限者] ── rights／purpose decision ─────┤
                                              ▼
                                      candidate／approved／
                                      restricted／withdrawn
                                              │ 別Authority
                                     ┌────────┴────────┐
                                     ▼                 ▼
                              [Repository収載]     [Release公開]
```

## 2. 素材記録

| Field | 意味 |
|---|---|
| asset_id | 素材の安定Identity |
| source／creator statement | 出所と作成経緯。権利の自動証明ではない |
| rights basis | 収載・公開・再配布判断に使った根拠 |
| allowed purposes | 許可された用途と対象範囲 |
| decision authority／decided_at | 誰がいつ判断したか |
| target revision／release | どの素材版と公開版に適用するか |
| state | candidate／approved／restricted／withdrawn |

## 3. Lifecycle

```text
candidate
  ├─ 根拠・用途・判断者が揃う ──→ approved
  ├─ 用途を限定して承認 ─────────→ restricted
  ├─ 不明 ───────────────────────→ candidateで停止
  └─ 許可撤回 ───────────────────→ withdrawn
```

収載済み素材を変更した場合は新しい対象revisionとして再評価する。過去判断を無言で新素材へ継承しない。

判断開始時に対象素材の期待revisionを固定し、確定直前に共有状態の現行revisionを再観測する。一致した場合だけ次revisionへ更新する。競合する判断が先に確定していた場合、後着側は上書きせずEffect 0で拒否し、勝者revision、拒否理由および再評価先を返す。判断順序は法的妥当性や採用優先度を意味しない。

## 4. 失敗と停止

- ChatGPT等の生成手段だけから、第三者権利不存在や再配布権を推定しない。
- 確認記録はRepository収載、Release公開、派生利用のAuthorityではない。
- `restricted`と`withdrawn`を`approved`へ丸めない。
- 取下げ後は新規利用を停止し、既公開物への処置を人間判断へ戻す。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `official-asset-governance.asset-decision`<br>`official-asset-governance.asset-publication`<br>`official-asset-governance.revision-conflict` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Asset種別ごとの候補、採用、改訂版競合と公開を、正本Ownerと判断Evidenceの共通契約へ揃える。 | Asset種別が異なっても候補と正式版、採用Authority、Revisionおよび置換関係を分ける。 | 新しいAsset種別だけが独自の採用・公開経路を持ち、正本が二重化する。 | `official-asset-governance.asset-decision`<br>`official-asset-governance.asset-publication`<br>`official-asset-governance.revision-conflict` |
| Creation／Selection | Required | この観点を成立させる構造と責務が存在するため。 | Authority、入力または配置条件を満たした後にだけ具象・処理経路を選ぶ。 | 選択前の検証と選択後のIdentityを分け、未確認時はEffect 0とする。 | 選択条件の変更はTrust、Authorityまたは利用側契約へ波及する。 | `official-asset-governance.asset-decision` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `official-asset-governance.asset-decision` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `official-asset-governance.asset-decision`<br>`official-asset-governance.asset-publication`<br>`official-asset-governance.revision-conflict` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `official-asset-governance.revision-conflict` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `official-asset-governance.revision-conflict` |

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
