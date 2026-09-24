# SPEC Detail

成果物種別: SPEC Detail統合投影
状態: OPEN
維持責任者: Qual-Lab

## 1. 目的と移行境界

v0.21.0でCanonical化した29件のSPEC Definitionを、新しいSPEC Detail契約へ適用する現在状態を示す。

v0.21.0は当時のSPEC工程契約に基づいてRelease済みであり、本書の`OPEN`は過去Releaseの失敗または遡及的な非準拠を意味しない。BHVを既存SourceやWIPから逆算せず、v0.22のCanonical Definitionから再導出する。

## 2. SPEC Definitionの処置

| SPEC ID | SPEC Definition | Detail適用 | BHV | 理由／戻り条件 |
|---|---|---|---|---|
| `SPEC-000001` | 事前検査を実行し意味レビューへ案内する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000002` | 委任範囲と権限を確定して受理する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000003` | 委任した仕事の状態と判断要否を返す | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000004` | 失敗後の再試行と回復を安全に選別する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000005` | 残存資源を清掃し終了後を確認する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000006` | Projectと節目の現在状態を投影する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000007` | 複数Projectを比較可能な投影へ統合する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000008` | 実行事実と評価を区別して取得する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000009` | 実行基盤の故障境界と利用可能範囲を診断する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000010` | Repositoryと実行対象のBindingを解決する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000011` | 複数入口で同じ依頼・結果契約を保つ | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000012` | 接続資格からWorkspace利用範囲を確定する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000013` | Meeting内容を候補化し所有正本へ昇格する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000014` | Repositoryに適合する標準Toolを解決する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000015` | AIモデル構成を検証し実効選択を決める | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000016` | 実行時データの配置・保持・清掃を制御する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000017` | Task情報と結果を同じ仕事へ引き継ぎ再取得する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000018` | Runtimeの信頼要素を独立評価する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000019` | 責務変更後の利用側閉包を検証する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000020` | 変更・監査・試験・品質の閉包を評価する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000021` | 外部送信の同意範囲を検証して送信する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000022` | 過去情報と現在有効な意図を区別して解決する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000023` | 文書の物語・構造・図と工程引継ぎを検査する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000024` | 公式素材の由来・権利・用途を確認する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000026` | 外部処理の結果を元の仕事へ持ち帰る | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000027` | 持ち帰った候補を所有正本へ昇格する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000028` | Taskの取消と終了確認 | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000029` | 判断待ちTaskへの判断返却 | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |
| `SPEC-000030` | 実行事実を同じ契約で記録する | OPEN | 未発行 | v0.22の対象範囲をDefinitionから確定する |

## 3. BHV Inventory

現在は未発行である。v0.21のSPEC Definition、Architecture、Source関数またはWIPをBHVへ機械変換しない。

## 4. UI／SPEC Detail対応

現在、BHVおよびSCR／PRT／Interactionは未発行である。未発行を`N/A`やCoverage済みへ畳まない。

## 5. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| BHV発行 | OPEN | SPEC工程Owner | Detailed Behaviorを固定できない | v0.22 SPEC Definition固定後 |
| UI Detail対応 | OPEN | UI／SPEC工程Owner | Detail Coverageを判定できない | SCR／PRT／InteractionとBHV発行後 |
| Architecture Handoff | OPEN | 工程移行判断者 | 新Detail Contractでの通常Handoff不可 | Detail対応レビューPass後 |

## 補足分析

v0.21 SourceとTestは、Canonical BHV成立後のReality Auditで比較する。既存実装の粒度をBHV発行基準にしない。

## Checklist

- [x] v0.21のSPEC Definition 29件を全数処置した
- [x] 過去Releaseの成立と新契約のOPENを区別した
- [x] Source、ArchitectureまたはWIPからBHVを逆算していない
- [x] 未根拠のBHVを発行していない
- [x] UI Detail対応を未発行のままCoverage済みへ畳んでいない
- OPEN: v0.22 SPEC Definition固定後にBHVを導出する
