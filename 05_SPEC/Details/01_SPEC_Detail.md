# SPEC Detail

成果物種別: SPEC Detail統合投影
状態: 更新候補（2026-10-12の鍵提示方式をUI／SPEC Detailまで伝播・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）。旧限定Pass／Hashは履歴。Architecture／Quality／Source・実画面・全体Readyは未成立）
維持責任者: Qual-Lab

## 1. 目的と移行境界

Canonical化した30件のSPEC Definitionを、SPEC Detail契約へ全件移行した。BHVはSource、ArchitectureまたはWIPから逆算せず、各SPEC DefinitionのTrigger、Precondition、Authority、State、Effect、Result、FailureおよびRecoveryから導出した。

```text
30 SPEC Definition
       ↓ 全件処置
30 BHV
       ↓
32 UI Detail Relation
       ↓
18 ARCH責務 + 13 Quality検証目標
```

登録解除・鍵の受け渡し未確認の判断を既存SCR-000008／PRT-000008とBHV-000012へ限定再伝播中である。対象件数は増やさず、未変更31 Relationと旧全数処置・Workbench Pilot Gateは更新前固定版の記録として保持する。最新Definition対応は限定レビュー済みだが、今回のDetail・横断投影は旧固定版の限定Passは当時の履歴。今回の鍵提示方式は候補伝播・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）である。Architecture／Quality／Source・実画面・実E2Eは未追従・未成立。

初回Host設定は既存SCR-000008／PRT-000008／BHV-000012の別操作へ具体化する。件数・未変更31 Relation・旧Gateは不変。最新UI-000008／SPEC-000012の初期化4状態・元試行と個別結果・通常回復との分離を詳細と対応投影で扱う。旧初回設定の限定伝播は当時の独立再レビュー済み・残指摘0で、Architecture／Quality／Source・実画面・実E2Eは未成立。

## 2. SPEC Definitionの処置

| SPEC ID | SPEC Definition | Detail適用 | BHV | 理由 |
|---|---|---|---|---|
| `SPEC-000001` | 事前検査を実行し意味レビューへ案内する | Applicable／Covered | [BHV-000001](BHV-000001/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000002` | 委任範囲と権限を確定して受理する | Applicable／Covered | [BHV-000002](BHV-000002/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000003` | 委任した仕事の状態と判断要否を返す | Applicable／Covered | [BHV-000003](BHV-000003/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000004` | 失敗後の再試行と回復を安全に選別する | Applicable／Covered | [BHV-000004](BHV-000004/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000005` | 残存資源を清掃し終了後を確認する | Applicable／Covered | [BHV-000005](BHV-000005/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000006` | Projectと節目の現在状態を投影する | Applicable／Covered | [BHV-000006](BHV-000006/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000007` | 複数Projectを比較可能な投影へ統合する | Applicable／Covered | [BHV-000007](BHV-000007/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000008` | 実行事実と評価を区別して取得する | Applicable／Covered | [BHV-000008](BHV-000008/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000009` | 実行基盤の故障境界と利用可能範囲を診断する | Applicable／Covered | [BHV-000009](BHV-000009/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000010` | Repositoryと実行対象のBindingを解決する | Applicable／Covered | [BHV-000010](BHV-000010/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000011` | 複数入口で同じ依頼・結果契約を保つ | Applicable／Covered | [BHV-000011](BHV-000011/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000012` | ユーザー資格と現行Roleで利用範囲を確定しAccessを回復する | Applicable／Covered | [BHV-000012](BHV-000012/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000013` | Meeting内容を候補化し所有正本へ昇格する | Applicable／Covered | [BHV-000013](BHV-000013/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000014` | Repositoryに適合する標準Toolを解決する | Applicable／Covered | [BHV-000014](BHV-000014/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000015` | AIモデル構成を検証し実効選択を決める | Applicable／Covered | [BHV-000015](BHV-000015/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000016` | 実行時データの配置・保持・清掃を制御する | Applicable／Covered | [BHV-000016](BHV-000016/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000017` | Task情報と結果を同じ仕事へ引き継ぎ再取得する | Applicable／Covered | [BHV-000017](BHV-000017/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000018` | Runtimeの信頼要素を独立評価する | Applicable／Covered | [BHV-000018](BHV-000018/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000019` | 責務変更後の利用側閉包を検証する | Applicable／Covered | [BHV-000019](BHV-000019/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000020` | 変更・監査・試験・品質の閉包を評価する | Applicable／Covered | [BHV-000020](BHV-000020/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000021` | 外部送信の同意範囲を検証して送信する | Applicable／Covered | [BHV-000021](BHV-000021/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000022` | 過去情報と現在有効な意図を区別して解決する | Applicable／Covered | [BHV-000022](BHV-000022/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000023` | 文書の物語・構造・図と工程引継ぎを検査する | Applicable／Covered | [BHV-000023](BHV-000023/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000024` | 公式素材の由来・権利・用途を確認する | Applicable／Covered | [BHV-000024](BHV-000024/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000026` | 外部処理の結果を元の仕事へ持ち帰る | Applicable／Covered | [BHV-000026](BHV-000026/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000027` | 持ち帰った候補を所有正本へ昇格する | Applicable／Covered | [BHV-000027](BHV-000027/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000028` | Taskの取消と終了確認 | Applicable／Covered | [BHV-000028](BHV-000028/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000029` | 判断待ちTaskへの判断返却 | Applicable／Covered | [BHV-000029](BHV-000029/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000030` | 実行事実を同じ契約で記録する | Applicable／Covered | [BHV-000030](BHV-000030/behavior.md) | Canonical Definitionから導出 |
| `SPEC-000031` | Repository差分を選びCommit・通常Pushする | Applicable／Covered | [BHV-000031](BHV-000031/behavior.md) | Canonical Definitionから導出 |

## 3. BHV Inventory

| BHV | 目的 | Source SPEC | UI Detail Coverage |
|---|---|---|---|
| [BHV-000001](BHV-000001/behavior.md) | 事前検査を実行し意味レビューへ案内する | [SPEC-000001](../Definitions/SPEC-000001/spec_definition.md) | Covered |
| [BHV-000002](BHV-000002/behavior.md) | 委任範囲と権限を確定して受理する | [SPEC-000002](../Definitions/SPEC-000002/spec_definition.md) | Covered |
| [BHV-000003](BHV-000003/behavior.md) | 委任した仕事の状態と判断要否を返す | [SPEC-000003](../Definitions/SPEC-000003/spec_definition.md) | Covered |
| [BHV-000004](BHV-000004/behavior.md) | 失敗後の再試行と回復を安全に選別する | [SPEC-000004](../Definitions/SPEC-000004/spec_definition.md) | Covered |
| [BHV-000005](BHV-000005/behavior.md) | 残存資源を清掃し終了後を確認する | [SPEC-000005](../Definitions/SPEC-000005/spec_definition.md) | Covered |
| [BHV-000006](BHV-000006/behavior.md) | Projectと節目の現在状態を投影する | [SPEC-000006](../Definitions/SPEC-000006/spec_definition.md) | Covered |
| [BHV-000007](BHV-000007/behavior.md) | 複数Projectを比較可能な投影へ統合する | [SPEC-000007](../Definitions/SPEC-000007/spec_definition.md) | Covered |
| [BHV-000008](BHV-000008/behavior.md) | 実行事実と評価を区別して取得する | [SPEC-000008](../Definitions/SPEC-000008/spec_definition.md) | Covered |
| [BHV-000009](BHV-000009/behavior.md) | 実行基盤の故障境界と利用可能範囲を診断する | [SPEC-000009](../Definitions/SPEC-000009/spec_definition.md) | Covered |
| [BHV-000010](BHV-000010/behavior.md) | Repositoryと実行対象のBindingを解決する | [SPEC-000010](../Definitions/SPEC-000010/spec_definition.md) | Covered |
| [BHV-000011](BHV-000011/behavior.md) | 複数入口で同じ依頼・結果契約を保つ | [SPEC-000011](../Definitions/SPEC-000011/spec_definition.md) | Covered |
| [BHV-000012](BHV-000012/behavior.md) | ユーザー資格と現行Roleで利用範囲を確定しAccessを回復する | [SPEC-000012](../Definitions/SPEC-000012/spec_definition.md) | Covered |
| [BHV-000013](BHV-000013/behavior.md) | Meeting内容を候補化し所有正本へ昇格する | [SPEC-000013](../Definitions/SPEC-000013/spec_definition.md) | Covered |
| [BHV-000014](BHV-000014/behavior.md) | Repositoryに適合する標準Toolを解決する | [SPEC-000014](../Definitions/SPEC-000014/spec_definition.md) | Covered |
| [BHV-000015](BHV-000015/behavior.md) | AIモデル構成を検証し実効選択を決める | [SPEC-000015](../Definitions/SPEC-000015/spec_definition.md) | Covered |
| [BHV-000016](BHV-000016/behavior.md) | 実行時データの配置・保持・清掃を制御する | [SPEC-000016](../Definitions/SPEC-000016/spec_definition.md) | Covered |
| [BHV-000017](BHV-000017/behavior.md) | Task情報と結果を同じ仕事へ引き継ぎ再取得する | [SPEC-000017](../Definitions/SPEC-000017/spec_definition.md) | Covered |
| [BHV-000018](BHV-000018/behavior.md) | Runtimeの信頼要素を独立評価する | [SPEC-000018](../Definitions/SPEC-000018/spec_definition.md) | Covered |
| [BHV-000019](BHV-000019/behavior.md) | 責務変更後の利用側閉包を検証する | [SPEC-000019](../Definitions/SPEC-000019/spec_definition.md) | Covered |
| [BHV-000020](BHV-000020/behavior.md) | 変更・監査・試験・品質の閉包を評価する | [SPEC-000020](../Definitions/SPEC-000020/spec_definition.md) | Covered |
| [BHV-000021](BHV-000021/behavior.md) | 外部送信の同意範囲を検証して送信する | [SPEC-000021](../Definitions/SPEC-000021/spec_definition.md) | Covered |
| [BHV-000022](BHV-000022/behavior.md) | 過去情報と現在有効な意図を区別して解決する | [SPEC-000022](../Definitions/SPEC-000022/spec_definition.md) | Covered |
| [BHV-000023](BHV-000023/behavior.md) | 文書の物語・構造・図と工程引継ぎを検査する | [SPEC-000023](../Definitions/SPEC-000023/spec_definition.md) | Covered |
| [BHV-000024](BHV-000024/behavior.md) | 公式素材の由来・権利・用途を確認する | [SPEC-000024](../Definitions/SPEC-000024/spec_definition.md) | Covered |
| [BHV-000026](BHV-000026/behavior.md) | 外部処理の結果を元の仕事へ持ち帰る | [SPEC-000026](../Definitions/SPEC-000026/spec_definition.md) | Covered |
| [BHV-000027](BHV-000027/behavior.md) | 持ち帰った候補を所有正本へ昇格する | [SPEC-000027](../Definitions/SPEC-000027/spec_definition.md) | Covered |
| [BHV-000028](BHV-000028/behavior.md) | Taskの取消と終了確認 | [SPEC-000028](../Definitions/SPEC-000028/spec_definition.md) | Covered |
| [BHV-000029](BHV-000029/behavior.md) | 判断待ちTaskへの判断返却 | [SPEC-000029](../Definitions/SPEC-000029/spec_definition.md) | Covered |
| [BHV-000030](BHV-000030/behavior.md) | 実行事実を同じ契約で記録する | [SPEC-000030](../Definitions/SPEC-000030/spec_definition.md) | Covered |
| [BHV-000031](BHV-000031/behavior.md) | Repository差分を選びCommit・通常Pushする | [SPEC-000031](../Definitions/SPEC-000031/spec_definition.md) | Covered |

各BHVは一つのSource SPECを詳細化する。複数SPECが同じArchitectureまたはQuality目標へ収束しても、Trigger、Authority、Effect、FailureまたはResultが独立して変更・検証できるためBHVを統合しない。

## 4. UI／SPEC Detail対応

[UI／SPEC Detail対応](02_UI_SPEC_Detail_Correspondence.md)に32 Relationを維持する。BHV-000012↔SCR-000008の旧初回設定対応は当時の限定Pass。今回の鍵提示方式対応は限定再レビュー済み（鍵提示方式伝播差分、全重大度0）。他の31 Relationは変更せず、更新前の全件評価を現在版全体のPassへ読み替えない。

## 5. Architecture／Qualityへの引き渡し

- Architecture: 各BHVをSource SPECが接続済みのARCH責務へ配置制約として渡す。今回の固定8操作・操作別Input／Authority／Effect／Output、次要求の認可、登録／公開／削除の区別と鍵境界は未伝播である。初回設定では初回Hostの信頼された入口とMCP／自動起動0、双方未初期化確認、元試行と作成UUIDの結合、作成／発行／記録／Host提示／exact同鍵の初回確認用限定接続確認／確認の保存・読戻し・清掃の別、途中再入場の別UUID・追加鍵・自動再初期化0、発行／記録不明は元試行再観測だけ・確定後のHost提示またはexact同鍵の初回確認用限定接続確認不明は別明示Host指定交換、通常交換Recoveryとの分離を次段へ渡す。Architectureは未追従。初回完了と通常Authorityは全条件の確認後だけとし、未確認・失敗・観測不能では成立させない。具体Owner・観測方式・Schema・未解決段階の処置はArchitectureで確定する。
- Quality: 各BHVのNormal、Boundary、Failure、UnknownおよびRecoveryを既存の検証義務へ統合する。今回のRole別肯否・操作固有前提／結果・鍵負例は次段で再導出する。初回設定では初回Hostの信頼された入口とMCP／自動起動0、双方未初期化確認、元試行と作成UUIDの結合、作成／発行／記録／Host提示／exact同鍵の初回確認用限定接続確認／確認の保存・読戻し・清掃の別、途中再入場の別UUID・追加鍵・自動再初期化0、発行／記録不明は元試行再観測だけ・確定後のHost提示またはexact同鍵の初回確認用限定接続確認不明は別明示Host指定交換、通常交換Recoveryとの分離を検証義務として渡す。Qualityは未追従で、正式項目のNot Runを維持する。初回の提示・限定接続・保存・読戻し・清掃の個別反例を導出し、未確認・失敗・観測不能で初回完了表示0・通常Authority0を確認する。
- Source／Test: Canonical BHV成立後のReality Auditで照合し、BHVを実装から逆算しない。

## 6. 未確認事項・人間判断・戻り条件

| 項目 | 現在状態 | 判断者／Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 追加のv0.22固有BHV | N/A: 現在のCanonical Definition 30件はBHV-000031を含め全件詳細化済み | SPEC工程Owner | 追加IDの未処置はないが、初回設定Detailの限定Passは今回更新前固定版の履歴。現在の鍵提示方式Detailは候補伝播済み・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）、後工程の伝播は未完了 | 新しいSPEC Definitionを追加した時 |
| 実装との一致 | OPEN | Reality Audit Owner | Canonical Detailの成立には影響しない | v0.22 Reality Auditで照合する時 |

## 補足分析

本移行はv0.21 SPEC Definitionの意味を変更しない。v0.22ではBHV-000031を追加済みであり、現在のCanonical Definition 30件はすべてDetailed Behaviorへ接続した。今後の追加は、新しいCanonical Definitionを先に固定してから行う。

今回更新した登録解除・鍵の受け渡し未確認の判断のDetailと投影は旧固定版の限定Passは当時の履歴。今回の鍵提示方式は候補伝播・限定再レビュー済み（鍵提示方式伝播差分、全重大度0）。以下の旧全数項目を最新候補全体のPassへ読み替えない。

## 鍵提示方式の現在伝播 — 2026-10-12

鍵提示方式の現在差分は[BHV-000012](BHV-000012/behavior.md)へ候補伝播した。通常提示と観測外の本人引渡しを分け、初回だけ同鍵の限定接続確認の保存・読戻し・清掃後に通常Authorityへ進む。具体Owner・方式・SchemaはArchitectureへOPEN。今回の1 Relationは限定再レビュー済み（鍵提示方式伝播差分、全重大度0）。他31 Relation・旧Hash／全数結果は今回へ流用せず、Source・正式検証・全体Readyは未成立。

## Checklist

- [x] 現行SPEC Definition 30件を全数処置した
- [x] 30 BHVをSource SPECから導出した
- [x] Trigger、Precondition、Authority、Input、Validation、State、Sequence、Effect、Output、FailureおよびRecoveryを全件評価した
- [x] UI Detailとの双方向Coverageを評価した
- [x] ArchitectureとQualityへの伝播先を示した
- [x] Source、ArchitectureまたはWIPからBHVを逆算していない
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
