# 現行実装との照合

成果物種別: Quality現実照合
状態: <Blocked — Quality Design Review Pending／Pending — Not Started／In Progress／Complete>
維持責任者: `<担当責任者>`

## 1. 目的

Quality IntegrationとQuality Definitionsを基準に、現行Source、Test、機械可読RegistryおよびEvidenceがどこまで対応するかを照合する。既存実装や試験の存在から検証義務を逆算しない。

## 2. 判定の単位

| 判定軸 | 意味 |
|---|---|
| Designed | Canonicalな検証項目、観測および終了後条件が定義済み |
| Implemented | 対応する実装と試験入口を確認済み |
| Executed | 対象改訂版と条件を固定して実行済み |
| Passed | 期待した理由、観測および終了後条件で合格済み |
| Evidence | 結果、対象改訂版、未確認範囲および根拠を追跡可能 |

## 3. 現在状態

| 対象 | 状態 | 理由 | 次の処置 |
|---|---|---|---|
| `<QA-ID／Local Item>` | `<未照合／一部対応／対応済み>` | `<根拠>` | `<次の照合または検証>` |

## 4. 照合方法

| 入力 | 照合する内容 | 禁止する推定 |
|---|---|---|
| Source | Owner、境界、Effect、状態、失敗・回復の実装位置 | Path名だけで実装済みとする |
| Test Catalog | 対象、段階、実境界、Lifecycle、選択条件 | 登録件数から意味Coverageを推定する |
| Test | 刺激、観測、期待理由、終了後条件 | 最終statusだけで意図したGuardの成立を推定する |
| Evidence | 改訂版、環境、結果、未確認、残存Risk | 過去版や別条件の結果を現在へ流用する |

## 5. 基準版Capabilityの保持比較

| 成立済みCapability | 過去のEvidence | 新Owner／置換実装 | 利用側 | 必要な実境界検証 | 現在判定 |
|---|---|---|---|---|---|
| | | | | | |

削除・置換対象は、過去Evidenceと利用側を確認し、新しい根拠が揃うまで不要または置換済みと扱わない。

## 6. PT／LTの扱い

- PT／LTの適用判断が各Quality Definitionに存在することを確認する。
- `N/A`は理由を確認し、空欄を非該当として扱わない。
- 適用対象でも、人間の明示指示がなければ実行しない。
- 未指示の非実行を`Pass`へ読み替えず、明示した受入条件またはRelease Gateでない限り通常監査を停止しない。

## 7. 完了条件

- 全Local ItemがCanonical Sourceまたは横断Architecture条件へ接続されている。
- 各Local ItemについてSource、Test、Evidenceの対応・未対応・未確認を区別できる。
- 意図した刺激、観測、期待理由および終了後条件で評価できる。
- 実境界が段階的なITから必要なSTへ接続されている。
- 基準版Capabilityが新Owner、利用側および必要な実境界検証へ対応付いている。
- 現在の品質状態を最新EvidenceからQuality Centerへ投影できる。

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] Canonical Quality設計の固定後にだけReality Auditを開始した
- [ ] 基準版Capabilityと過去Evidenceを比較入力として特定した
- [ ] 現行Source、TestおよびRegistryをCanonical設計の正解として扱っていない
- [ ] 必要な検証をCovered、Partial、Missing、LegacyまたはGapへ分類した
- [ ] 未Commit状態とVersion Control Adapterの交換可能性を検証対象へ含めた
- [ ] 照合対象のRevision、実行条件および観測限界を固定した
- [ ] 不足Test、未実行項目およびEvidence Gapを追跡した
- [ ] PT／LTの適用と実行Authorityを評価し、明示指定がない場合は実行していない
