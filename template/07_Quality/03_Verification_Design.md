# 検証設計（Verification Design）

成果物種別: Quality横断計画
状態: Draft
維持責任者: `<担当責任者>`

## 1. 本書の責務

Quality工程全体で、検証対象をどの段階へ割り当て、どの条件で実行・記録・評価するかを示す。個別の検証条件はQuality Definition、上流からの導出はQuality Integration、現行Source／Test／Evidenceとの対応はReality Auditが所有する。

| 本書が所有する | 本書が所有しない |
|---|---|
| 対象範囲、段階選択、実行・停止・記録・評価の共通方針 | 個別Toolの検証ケース、具体Source／Test Path、実行結果、現行適合判断 |

## 2. 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 検証義務・試験Level／Boundary対応図 | 検証義務、試験段階、外部境界 | 何をどの深さまで確認するかを示す | | | | | | |
| 状態・分岐・Block別Coverage図 | 状態、分岐、構成要素 | 部分成立を全体成立へ誤認しない | | | | | | |
| 検証結果・判断接続図 | 検証結果、品質判断、次の処置 | 実行結果を品質判断へ接続する | | | | | | |

処置は`作成`、`既存参照`、`非該当`、`作成不能`から選ぶ。`非該当`と`作成不能`は、理由、影響および再評価契機を記載する。

## 3. 対象と入口

| 入口 | 本書で確認すること | 詳細の所有者 |
|---|---|---|
| 工程別Quality Analysis | 全Canonical IDの処置 | `Analysis/<工程>/quality_analysis.md` |
| Quality Integration | Source固有条件を失わない統合 | `04_Quality_Integration.md` |
| Quality Definition | 成功・失敗、段階、Local Item、観測、終了後条件 | `Definitions/QA-*/quality_definition.md` |
| Architecture | Component、境界、状態、故障、配置の検証対象 | Architecture成果物とQuality Integration |

## 4. 試験段階と外部境界の到達範囲

| 試験段階 | 適用／非適用の理由 | 入口と終点 | 主な観測 | 完成主張の上限 |
|---|---|---|---|---|
| 単体試験（UT） | | | | |
| 結合試験（IT） | | | | |
| 総合試験（ST） | | | | |
| 受入試験（UAT） | | | | |

外部境界を含むLocal Itemは、`N/A`、`Direct Boundary`、`Adjacent 1 Block`、`Related 2 Blocks`、`System/E2E`、`User Acceptance`の閉集合から到達範囲を選ぶ。E2Eは試験形態、回帰試験（RT）は選択・再実行方式として扱う。

## 5. 実行・停止条件

| 対象 | 方針 |
|---|---|
| 通常検証 | `<対象改訂版、構成、初期状態、入口、観測、終了後条件>` |
| 外部境界 | `<要求から終了後状態までの相関方法>` |
| 取消・失敗・回復 | `<部分成立、観測不能、cleanup、再入場の扱い>` |
| PT／LT | `<適用判断。実行時は人間の明示指示、上限、中止条件、費用・Credit、cleanupを要求>` |
| 未指示のPT／LT | `<Passへ読み替えず、通常監査を止める条件を限定>` |

## 6. 評価と記録

| 状態 | 意味 |
|---|---|
| Designed | |
| Implemented | |
| Executed | |
| Passed | |
| Evidence | |

個別結果は直接証明するChangeまたはReleaseの`Evidence/`へ置く。本書へ具体的なTest Pathや実行結果を追記しない。

## 7. 網羅と完了条件

- `<Canonical ID全件の処置>`
- `<Source固有条件からLocal Itemまでの追跡>`
- `<UT／IT／ST／UATとRT／PT／LTの適用判断>`
- `<外部境界の段階到達、観測、終了後条件>`
- `<Reality AuditとQuality Centerへの接続>`

## 8. 対象外・未決事項

| 項目 | 理由 | 影響 | 担当責任者 | 再評価契機 |
|---|---|---|---|---|
| | | | | |
