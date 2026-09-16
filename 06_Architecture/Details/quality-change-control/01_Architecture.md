# 変更と品質状態の統合設計

成果物種別: Architecture詳細設計
詳細設計領域: quality-change-control
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000003](../../Definitions/ARCH-000003/architecture_definition.md) | 固定改訂版、必須確認集合、指摘、是正、Evidence、未確認範囲と現在Gateを一つの品質状態へ統合する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 変更追跡、確認者、品質状態投影と人間判断を分ける。 | [§1](#1-責務ブロック) |
| Interface Model | Required | 固定候補、確認結果、統合結果の契約を分ける。 | [§2](#2-入力と結果) |
| Data Flow | Required | 同じ固定改訂版の結果だけを統合する。 | [§3](#3-状態と処理順) |
| State Model | Required | fixed、under_review、changes_required、verified、decision_requiredを区別する。 | [§3](#3-状態と処理順) |
| Sequence | Required | 全必須確認の終了後にだけ統合・状態更新する。 | [§3](#3-状態と処理順) |
| Failure／Recovery | Required | 確認中断、別改訂版混入、再固定を扱う。 | [§4](#4-失敗と再開) |
| Deployment | N/A | 文書・試験・監査結果の統合契約であり、Process配置を成立条件にしない。 | [§1](#1-責務ブロック) |
| Observability | Required | 必須確認、未確認範囲、現在Gateを再構成可能にする。 | [§2](#2-入力と結果) |
| Security Boundary | Required | 専門判断、リスク受容、Release判断を統合処理から発行しない。 | [§1](#1-責務ブロック) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 一つの統合単位を固定改訂版と必須確認集合へ結び、別改訂版を混在させない。 | [§3](#3-状態と処理順) |
| Timing | N/A | 時間上限ではなく、必須確認集合の完了を状態更新条件にする。 | [§3](#3-状態と処理順) |
| Resource Lifecycle | N/A | Process、Lock、動的外部資源を所有しない。中断時に保持するのは追跡情報である。 | [§4](#4-失敗と再開) |
| External Boundary | PASS | 各レビュー、監査、試験は独立結果を返し、統合側が専門判断を上書きしない。 | [§2](#2-入力と結果) |
| Failure／Recovery | PASS | 中断時は未確認範囲を保持し、是正後は新しい固定改訂版で確認をやり直す。 | [§4](#4-失敗と再開) |
| State／Consistency | PASS | fixed、under_review、changes_required、verified、decision_requiredを区別する。 | [§3](#3-状態と処理順) |
| Observability | PASS | 必須確認、未確認範囲、現在Gateを再構成可能にする。 | [§2](#2-入力と結果) |
| Security／Trust | PASS | 専門判断、リスク受容、Release判断を統合処理から発行しない。 | [§1](#1-責務ブロック) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| 監査集合統合 | 固定改訂版と必須確認集合 | 全必須結果が同じ改訂版へ属する | 一部結果でPass、途中縮小、別改訂版混入 | revision、required set、result set | current gateを一意に表示 | 専門判断の妥当性は各監査 |
| 是正再入場 | finding、修正方針、新固定版 | 旧結果を流用せず再確認 | 解消済み判定の先取り、旧Pass流用 | finding状態と再固定revision | 未確認範囲またはverified | 人間のリスク受容 |

## 現行実装との照合

現行CHG、Quality Center、監査手順とCheckerは正式入力ではない。Canonical詳細を固定した後、状態Owner、機械検査、専門判断、Release判断の責務を`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

## 1. 責務ブロック

```text
[Change Tracking] ── fixed revision／required checks ──→ [Quality State Integrator]
       ↑                                                        │
       │                                                        ├─ current gate
[Remediation] ← findings ← [Independent Review／Audit／Test] ───┘

Human Authority ── risk acceptance／release decision ──x Integratorが代行しない
```

## 2. 入力と結果

| 契約 | 必須情報 |
|---|---|
| Fixed Candidate | revision、対象範囲、変更禁止範囲 |
| Required Check Set | check identity、owner、適用理由、非該当理由 |
| Check Result | 対象revision、Pass／Finding／Blocked、未確認範囲、Evidence |
| Integrated Quality State | 現在Gate、未解消Finding、人間判断、次の再入場条件 |

## 3. 状態と処理順

```text
fixed
  ↓ 必須確認集合を固定
under_review
  ├─ 全件終了・Finding 0 ──→ verified
  ├─ Findingあり ─────────→ changes_required ── 是正・再固定 ──→ under_review
  └─ 人間判断が必要 ──────→ decision_required
```

## 4. 失敗と再開

- 確認不能はPassでもFinding解消でもなく、未確認範囲として保持する。
- 是正で対象revisionが変わった場合、修正前の確認結果を新候補へ流用しない。
- Checker成功、試験件数、監査担当の割当だけから`verified`を生成しない。
- 人間判断が必要な場合は、現在候補から未決事項を再計算して返す。

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
