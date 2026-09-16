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

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | N/A | 同一素材の競合判断は改訂版競合として拒否し、並行Runtime処理を所有しない。 | [§3](#3-lifecycle) |
| Timing | PASS | 判断時点と対象版を記録し、取下げ後の新規利用へ旧判断を流用しない。 | [§2](#2-素材記録) |
| Resource Lifecycle | PASS | 候補、収載済み、派生成果物、取下げ記録の保持責務を分ける。 | [§3](#3-lifecycle) |
| External Boundary | PASS | 提供者の申告、判断者の確認、Repository収載、Release公開を別境界にする。 | [§1](#1-責務ブロック) |
| Failure／Recovery | PASS | 根拠不足はcandidateで停止し、取下げは新規用途を停止して影響先を追跡する。 | [§4](#4-失敗と停止) |
| State／Consistency | PASS | candidate、approved、restricted、withdrawnを区別する。 | [§3](#3-lifecycle) |
| Observability | PASS | 判断者、対象版、許可用途、根拠へ戻れるようにする。 | [§2](#2-素材記録) |
| Security／Trust | PASS | 確認記録から法的判断、公開、用途外利用のAuthorityを生成しない。 | [§4](#4-失敗と停止) |

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| 素材判断 | asset identityと根拠 | 判断者・用途・対象版が揃う | 生成手段だけで承認、用途空欄 | state、authority、evidence | 未確認時は収載Effect 0 | 法的助言は対象外 |
| 収載・公開 | approved assetとRelease | 許可用途内で別Authorityにより実行 | restricted公開、withdrawn再利用 | release relationとasset state | 影響先追跡または公開なし | 外部配布先の撤回能力 |

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

## 4. 失敗と停止

- ChatGPT等の生成手段だけから、第三者権利不存在や再配布権を推定しない。
- 確認記録はRepository収載、Release公開、派生利用のAuthorityではない。
- `restricted`と`withdrawn`を`approved`へ丸めない。
- 取下げ後は新規利用を停止し、既公開物への処置を人間判断へ戻す。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 9種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
