# Runtime Artifactの信頼評価設計

成果物種別: Architecture詳細設計
詳細設計領域: runtime-trust
状態: Candidate（v0.21.0）
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

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | ArtifactとPolicyを同じ評価snapshotへ固定し、途中変更時は再評価する。 | [§3](#3-評価フロー) |
| Timing | PASS | 観測時点とPolicy revisionを結果へ付け、古い判断を新しい実行へ流用しない。 | [§4](#4-失敗と再評価) |
| Resource Lifecycle | N/A | Runtime起動やProcess資源を所有せず、読取り評価だけを返す。 | [§1](#1-責務と依存) |
| External Boundary | PASS | Artifact、署名検証、準拠結果、Policy Sourceを独立入力にする。 | [§2](#2-評価契約) |
| Failure／Recovery | PASS | 一軸のunknownをtrustedへ畳まず、ArtifactまたはPolicy変更時に再評価する。 | [§4](#4-失敗と再評価) |

## Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| 軸別評価 | 同一Artifact snapshot | 各軸が独立結果を持つ | 署名だけでtrusted、unknown許可 | axis result、evidence、observed_at | 実行Capability 0 | 品質監査内容は別Owner |
| Trust Policy | publisher rules、unsigned local rule | Deployment OwnerのPolicyだけを適用 | Qual-Lab固定許可、Fork一律拒否 | policy revisionとdecision reason | Policy変更時に旧判断失効 | OS Credential Store連携 |

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

