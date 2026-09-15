# 現行実装との照合

成果物種別: Quality分析
状態: Reality Audit Ready — Not Started
維持責任者: Qual-Lab

## 1. 目的

[全Canonical定義のQuality分析](../canonical-definition-mapping/quality_analysis.md)と各[検証定義](../../Definitions/)を基準に、現行Source、Test Catalogおよび実境界Evidenceがどこまで対応するかを照合する。既存実装や試験の存在から検証義務を逆算しない。

```text
[157件のCanonical入力]
          ↓
[Quality Mapping]
          ↓
[検証定義とLocal Item]
──────────────────── ここまでを先に固定
          ↓
[Source／Test／Evidenceとの照合]
          ↓
[Implemented／Executed／Passed／Evidenceあり]
```

## 2. 判定の単位

検証目標全体を一つの`Covered`へ丸めない。各Local Itemについて次を別々に判定する。

| 判定軸 | 意味 |
|---|---|
| Designed | Canonicalな検証項目、正常・境界・失敗、観測、終了後条件が定義済み |
| Implemented | 対応する実装と試験入口を確認済み |
| Executed | 対象改訂版と条件を固定して実行済み |
| Passed | 期待した理由、観測および終了後条件で合格済み |
| Evidence | 結果、対象改訂版、未確認範囲および根拠を追跡可能 |

`Safe Reject`、試験ファイルの存在、以前の版のPass、別のGuardによる偶然の拒否は、目的のLocal Itemの`Passed`を意味しない。

## 3. 照合方法

| 入力 | 照合する内容 | 禁止する推定 |
|---|---|---|
| Source | Owner、境界、Effect、状態、失敗・回復の実装位置 | ファイル名やDirectory名だけで実装済みとする |
| Test Catalog | 対象、段階、実境界、Lifecycle、選択条件 | 登録件数から意味Coverageを推定する |
| Test | 刺激、観測、期待理由、終了後条件 | 最終statusだけで意図したGuardの成立を推定する |
| Evidence | 改訂版、環境、実行結果、未確認、残存Risk | 過去版や別条件の結果を現在へ流用する |

## 4. 現在状態

| 対象 | 状態 | 理由 | 次の処置 |
|---|---|---|---|
| 13検証目標のLocal Item | Canonical・独立レビューPass | 157件のMapping、Source ID固有条件および60 Local ItemとのRelationを固定した | Local Item単位でSource／Test／Evidenceとの照合を開始する |
| 現行Source／Test | 未照合 | Canonical設計を固定し、既存資産を正解として採用せずに照合を開始できる状態になった | Local Item単位で照合する |
| 実行結果／Evidence | 未評価 | v0.20.1の結果をv0.21の合格へ流用しない | 必要な試験を実行した後に結合する |

以前のArchitecture限定Sliceで示した`Covered 4／Partial 6／Missing 1`は、17 ARCH-IDだけを入力にした暫定対応であり、現在の157件Mappingに対する品質状態ではない。現在判定へ使用しない。

## 5. 基準版から引き継ぐ実行知の能力

v0.20.1の実行知はEvent生成、Repository-local Storeへの不変保存、並行Writerの競合処理、Repository Root確認、Project Runtimeからの記録および限定並列実行の評価を成立済み能力として持つ。これらは現在のread-onlyなCanonical実行知へ逆輸入せず、削除または置換判断の前に過去Evidenceと現行実装を照合する。

| 成立済み能力候補 | 現行照合先 | 現在判定 |
|---|---|---|
| 閉じたEvent生成と入力拒否 | execution-intelligenceの生成・検証試験 | 未照合 |
| 不変保存、再送冪等、衝突拒否 | Repository-local Store試験 | 未照合 |
| 並行Writer、Lock、一時file、失敗残存 | Storeの実Process／故障注入試験 | 未照合 |
| 検証済みRepository Rootへの保存 | Version Control境界とStore結合試験 | 未照合 |
| Project Runtimeからの記録と再読取り | Coordinator利用側結合試験 | 未照合 |
| 限定並列Attemptと統合結果の評価 | bounded integration試験 | 未照合 |

基準版の詳細根拠は[CHG-000062の検証結果](../../../99_Roadmap/Changes/CHG-000062/Evidence/260905_execution-intelligence-verification.md)から辿る。過去の合格をv0.21の合格へ流用せず、Capability、Owner、置換実装、利用側および必要な実境界検証を対応付ける。

## 6. 完了条件

- 全Local Itemが一つ以上のCanonical Source IDまたは横断Architecture成立条件へ接続されている。
- 各Local ItemがTest Catalogまたは人間確認へ接続され、未実装・未実行・未確認を区別できる。
- 自動試験は期待する理由、観測および終了後条件を確認する。
- 実境界を必要とする項目は段階的なITから必要なSTへ接続する。
- PT／LTは人間が対象、環境、上限、費用、中止およびcleanupを明示した場合だけ実行する。
- 現在の品質状態は本書の集計ではなく、Local Itemと最新EvidenceからQuality Centerへ投影する。
