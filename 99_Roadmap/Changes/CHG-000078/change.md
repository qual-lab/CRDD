# Canonical設計と現行実装のReality Audit

変更ID: `CHG-000078`
状態: `Pilot Classification Complete — Independent Review Pending`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `quality_reality_audit`

## 1. 変更の目的

CanonicalなArchitecture／Quality設計を、現行Source、Test Catalog、実試験およびEvidenceと照合する。既存実装を設計の正解として逆輸入せず、設計上の意味ごとに実装、検証設計、試験、実行結果およびEvidenceの状態を分けて判定する。

```text
[Canonical Architecture Meaning]
                 ↓
[Implementation Symbol] ──→ [現行Source]
                 │
                 ├────────→ [Quality Local Item]
                 │
                 └────────→ [Test Symbol] ──→ [Test／Evidence]
                                      ↓
                     Covered／Partial／Missing／Legacy／Gap
```

## 2. 対象範囲

最初のPilotはSemantic Coverage基盤で固定済みのCoordinatorとProject Runtimeだけを対象とする。17件の意味単位を全数処置し、方法と判定語彙が成立してから他Subsystemへの展開を判断する。

| 対象 | 含むもの | 現段階で含まないもの |
|---|---|---|
| Canonical | Architecture Details、Quality Definition／Local Item | 現行Sourceから推測した新しい設計意味 |
| Reality | `symbol.json`、Source、Test Catalog、Test、対象改訂版付きEvidence | ファイル名や試験件数だけによる完成推定 |
| Pilot | Coordinator 8意味、Project Runtime 9意味 | 他Subsystemへの一括展開 |
| 実行 | 決定論的な読取り、生成、局所試験 | PT／LT、未承認の外部Effect |

対象改訂版はCommit `3f2567bd54f00fe638bfc8ff9e7f3695fd8eba66`とする。以後の是正は別の新しい固定候補として再照合し、対象改訂版を暗黙に差し替えない。

## 3. 判定契約

| 判定 | 意味 |
|---|---|
| `Covered` | Canonicalな意味、実装Owner、Quality Local Item、必要なTest／Evidenceが同じ意味で接続される |
| `Partial` | 一部の層は接続されるが、必要な意味、境界、反例、TestまたはEvidenceが不足する |
| `Missing` | Canonicalな意味を実現・検証する現在の対応先を確認できない |
| `Legacy` | 現行実装または試験は存在するが、現在のCanonicalな理由へ接続されない |
| `Implementation Detail` | Canonicalな意味を変えない実装詳細で、独立した意味IDを必要としない |
| `Gap` | Canonical側または照合契約自体が不足し、現実側の採否を安全に判定できない |

`observed`はRelationが存在するという観測であり、`Covered`、実装完了、試験実行または合格を意味しない。

## 4. Gate

| Gate | 状態 | 完了条件 |
|---|---|---|
| Pilot入力固定 | Complete | 対象改訂版、17意味、Source Hashおよび判定語彙を固定する |
| Projection鮮度 | Complete | 現在のCanonical入力からSemantic Coverage Bundleを再生成し、古いSource Hashを解消する |
| 意味と実装の照合 | Complete for Pilot | 16意味を実装Ownerへ接続し、Runtime Trust消費1件を実装欠落として分離した |
| 意味と試験の照合 | Initial Execution Complete | 16意味を実試験へ接続し局所確認済み。Sandbox内のProcess取消失敗は通常ユーザー境界で2／2 Passし、実行環境差として分離した |
| Evidence照合 | In Progress | 局所実行結果を記録済み。固定候補Commitと独立レビュー結果を結合する |
| Pilot独立レビュー | Not Started | 判定、Gap、非目標および展開判断を独立確認する |
| 全Subsystem展開 | Blocked by Design | Pilotの方法と判定語彙がPassするまで開始しない |

## 5. 初期観測

開始時の生成済みBundleは、意味集合とRelation集合を保持していたが、CoordinatorとProject Runtimeの`sourceSha256`が現在のCanonical文書と一致していなかった。生成Toolで再生成するとHashだけが更新され、17意味とRelation集合は変化しなかった。

これは設計意味の差ではなく、生成Projectionの鮮度差である。Git履歴で再現できる情報を別の手編集正本へせず、Canonical入力から再生成したRegistryを照合入力にする。

| 初期観測 | 件数 | 現在の扱い |
|---|---:|---|
| Canonical意味 | 17 | 全数をPilotで処置する |
| 実装Relationあり | 16 | 意味一致は未判定 |
| 実装Relationなし | 1 | `coordinator.runtime-trust-consumption`をMissingと断定せず、OwnerとConsumerを確認する |
| Test Relationあり | 3 | Test内容とLocal Itemの意味一致は未判定 |
| Test Relationなし | 14 | 試験不存在と断定せず、Catalog／Test／Annotationの不足を区別する |

初回分類は`Covered 1／Partial 15／Missing 1`だった。実在するSourceと試験を確認してRelation Ownerを是正した結果、16件は実装／試験Relationへ接続された。局所実行では16件の対応試験が期待どおりPassした。Sandbox内で失敗したWindows Process取消2条件も、必要なProcess権限を持つ通常ユーザー境界では2／2 Passした。`coordinator.runtime-trust-consumption`は、Runtime Trust Policy activationとProvider launch integrationが現行Sourceで`not_implemented`と明示されている実装欠落である。

## 6. 局所検証

| 確認 | 結果 | 未確認または失敗 |
|---|---:|---|
| Semantic Coverage | 14／14 Pass | なし |
| Project Runtime | 60／60 Pass | 実Docker等の外部境界は本局所試験の対象外 |
| Coordinator Pilot対象（Sandbox内） | 223／225 Pass | Windows Process取消2条件はProcess境界の権限制約で失敗 |
| Process取消2条件（通常ユーザー境界） | 2／2 Pass | 子Process終了と終了後不存在を確認 |

期待値は緩めず、Sandbox失敗を実行条件付きの観測として保持する。Runtime Trust消費は、署名済みE2Eの成功から成立を推定しない。

## 7. 現在状態と構造変更

本変更では、手編集するCanonical設計、生成するSemantic Coverage Bundle、Reality Auditの判定、実行Evidenceを別の成果物として維持する。RegistryのSource Hash更新は設計変更ではない。

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`07_Quality/05_Current_Implementation_Reality_Audit.md`](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)
- [`07_Quality/Registry/semantic-coverage-pilot.json`](../../../07_Quality/Registry/semantic-coverage-pilot.json)
- [`40_Develop/coordinator/symbol.json`](../../../40_Develop/coordinator/symbol.json)
- [`40_Develop/project-runtime/symbol.json`](../../../40_Develop/project-runtime/symbol.json)
- [`40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts`](../../../40_Develop/semantic-coverage/tests/unit/semantic-coverage-pilot.contract.test.ts)
- [`99_Roadmap/01_Roadmap.md`](../../01_Roadmap.md)
- [`99_Roadmap/02_Changes.md`](../../02_Changes.md)
- [`99_Roadmap/Changes/CHG-000078/change.md`](change.md)

</details>

## Checklist

- [x] Canonical設計を現行実装の存在から変更していない。
- [x] 対象改訂版とPilot範囲を固定した。
- [x] 17意味を全数処置する入口を作った。
- [x] 生成Projectionの古さと意味差を区別した。
- [x] 実装Relationの存在と実際の責務一致を全数確認した。
- [x] Quality Local Item、Test Symbol、Test Catalogおよび試験内容を全数確認した。
- [ ] 実行結果とEvidenceを対象改訂版付きで評価する。
- [ ] Gapを所有工程へ返し、Reality側だけで意味を補完しない。
- [ ] Pilotの独立レビューを完了する。
- [ ] 全Subsystemへ展開するかをPilot結果から判断する。
