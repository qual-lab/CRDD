# 品質項目176件の固定候補照合

成果物種別: 品質照合・変更記録
変更ID: `CHG-000082`
基準Commit: `b280cfbbad274eb97367dad820e72399a81cf2e6`
基準Tree: `87c5f453ae8a0d6ddf6a8cd3599f6092090560ed`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

176項目を一意に照合し、旧版の観測主張を現在の合格へ自動転用しないための確認対象を固定した。現行算定Ownerが観測済みとする13件、移管の未観測33件、旧版未観測22件、旧版観測主張の現行適用未照合108件に分かれる。108件のうち六件は検証項目の一次行が変更されている。

これは**基準HEAD時点の固定照合候補**であり、現在品質の算定Ownerは[Reality Audit](../../../../07_Quality/05_Current_Implementation_Reality_Audit.md#12-relation是正結果)のままである。新しいRegistry、状態更新の正本または全体Passの根拠ではない。既存13件の実測を再実行・全再検証したものでも、旧108件の個別Evidence成立を新たに証明したものでもない。全体OPEN、13／46観測済み・33／46未観測、Host方式の設計判断待ちと新実Task停止は変更しない。

| 固定照合上の区分 | 件数 | 導出と限界 |
|---|---:|---|
| 現行Ownerの観測参照 | 13 | 現行§13.1と直前の適用記録。今回の抽出は再実測ではない。 |
| 現行移管の未観測 | 33 | 現行移管46件から上記13件を除いた集合。 |
| 旧版未観測・現行未照合 | 22 | 旧§13.3のHybrid 12件と旧§13.4のManual 10件。現在の義務成立は別に確認する。 |
| 旧版観測主張・現行適用未照合 | 108 | 旧156件から旧移管26件と旧未観測22件を除く補集合。旧Ownerの集計主張を識別しただけである。 |

四集合は重複0、欠落0で176件に一致する。旧156件から現176件への追加20件・削除0、現移管46件＝旧移管26件＋追加20件を確認した。現Symbol Relationは132項目、Relationなしは44項目である。Relationの存在は実行・Pass・現在適用を証明しない。

## 経路と着手前確認

同じCHGの品質全体集計OPENを閉じるための第一照合である。親は品質保証§1.3・§2.7・§2.8・§5.3、保守§3.1、現行算定Owner、QA定義、Symbolと公式旧tagを照合した。別の読取り専用確認者は、四分割、追加／削除、六差分、正本境界と禁止範囲を再現して着手可とした。完成後レビューとは分ける。

記録対象は本Evidence、Reality Audit§12への参照一段落、CHGの結果参照の三file。Source、試験、QA義務、Scope、過去Evidence、Quality件数・状態、Authority、署名とReleaseは変更しない。Repository-localの機械記録以外のRootへ書き込まず、Host処置、Provider依頼、Docker操作は行わない。

完成後は同じ三fileと原記録へ、文書・追跡、品質・直接影響、判断境界の三観点を固定する。Source・規範・Authority不変のため、全回帰、準拠監査、再署名、Provider／Docker E2Eをこの記録確認へ含めない。残る本来の義務の免除ではない。

本段階の発火例は候補集合と版差の記録である。個別根拠の現在適用は後続の評価で行う。Relationだけの追加は非発火、旧結果と変更された条件の組合せは境界例、入力・終了後条件・実行版が未確認の根拠は情報不足として未照合に残す。

## 六項目の優先照合

六件の差分は不足実装や試験失敗の確定ではない。変更された品質条件に対する現行根拠の適用性を優先確認する候補である。残る102件の行一致からも、Source、利用側、依存、環境、実行Identityと終了後条件が不変とは推定しない。

| Local Item | 追加・変更された意味 | 次に確認する根拠 |
|---|---|---|
| `PRL-ST-001` | Provider境界Event、統合待ちと人間受入の区別、Container／networkを含む終了後条件。 | 署名済み公開MCPの実Task記録が、全Eventと統合待ち・終了後条件を同じIdentityで証明するか。 |
| `PRL-IT-005` | 完全なCandidate IdentityとIntegration Record、拒否時Effect 0と正常時Record一件。 | 長い正規Identity・短縮／改変反例の実Consumer結果と、Record保存結果が一致するか。 |
| `PRL-IT-012` | UI入口、明示Profile ID、Executorだけへの選択搬送、Reviewer誤伝播拒否。 | 入口ごとの搬送、Authority・Effectと現在Profile構成が同じ固定版で確認されているか。 |
| `PRL-IT-013` | 複数Recovery Inventory、選択したexact Recovery、未選択Recovery変更0。 | 全Inventory・Scopeと対象別終了状態が記録され、単一Recovery試験だけに依存していないか。 |
| `PRL-UT-014` | Profile Resolver、明示／自動選択、未知IDとProvider／Role不一致。 | 現行Catalog・選択規則の正常／反例と外部Effect 0を確認した入力・実行版へ到達できるか。 |
| `ERB-IT-014` | 検証付き再起動、全Host／Home ScopeとLock順、Inventory差、未選択Recovery変更0。 | 再起動受理とEngine readyを分け、全Scope固定・fresh再確認・選択対象だけの収束まで観測したか。 |

## 根拠入口と版

旧版は公式tag `v0.21.0`が解決したCommit `e9947d4f733c3c46b90ee9f78c70898d1920bae9`。旧Reality Auditのblob OIDは`558d82ab73afae2796342fc810ed806b30295aac`である。旧§12は156／130／108の当時の集計、旧§13.1は26件の移管、旧§13.3／13.4は22件の未観測の一次表である。取得は同Commitの`git show <Commit>:<Path>`で再現でき、旧版本文を更新しない。

現行版は上記基準Commitと実行直前・直後で一致したPath別Hashに固定した。現行§13.1は[移管一覧](../../../../07_Quality/05_Current_Implementation_Reality_Audit.md#131-v022へ移管する46件)、13件の直前の適用と限界は[非開示境界の記録](261002_shared-gateway-non-disclosure.md)、集計不整合の契機は[前回記録](261002_quality-visual-preview-projection.md)から辿る。

下表の定義リンクは現在の検証項目一次章への入口であり、版は本節で固定する。各行の旧／現在一次行SHA-256、定義blob、Symbol ID、Test Pathと取得結果は原記録に保持した。根拠入口はOwnerの主張または未観測一覧への参照であり、個別実行結果が現在有効だという判定ではない。

## 全176項目の照合候補

<details>
<summary>定義の一次行、版差、区分、Symbol参照と根拠入口を展開</summary>

| Local Item | 定義一次章 | 実行形態 | 固定照合上の区分 | 旧一次行との差 | Symbol参照数 | 区分の根拠入口 |
|---|---|---|---|---|---:|---|
| `RCM-UT-001` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `RCM-UT-002` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `RCM-IT-003` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-IT-004` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-IT-005` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 6 | 旧版§12の補集合 |
| `RCM-UAT-006` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `RCM-IT-007` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-IT-008` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-IT-009` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-IT-010` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `RCM-IT-011` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-ST-012` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 1 | 旧版§13.3／13.4 |
| `RCM-IT-013` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-UT-014` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `RCM-IT-015` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RCM-UT-016` | [QA-000001](../../../../07_Quality/Definitions/QA-000001/quality_definition.md#5-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 6 | 旧版§12の補集合 |
| `CQS-IT-001` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `CQS-IT-002` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-IT-003` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-IT-004` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-ST-005` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-UAT-006` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `CQS-UAT-007` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `CQS-IT-008` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-ST-008` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-IT-009` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-ST-009` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-UT-010` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `CQS-IT-011` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `CQS-IT-012` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-ST-012` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-IT-013` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `CQS-ST-013` | [QA-000002](../../../../07_Quality/Definitions/QA-000002/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PRL-ST-001` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 4 | 旧版§12の補集合 |
| `PRL-UAT-002` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `PRL-ST-003` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `PRL-ST-004` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `PRL-IT-005` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 10 | 旧版§12の補集合 |
| `PRL-UT-006` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 21 | 旧版§12の補集合 |
| `PRL-UT-007` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PRL-IT-008` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `PRL-ST-009` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PRL-UAT-010` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `PRL-IT-011` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PRL-IT-012` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 8 | 旧版§12の補集合 |
| `PRL-IT-013` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 4 | 旧版§12の補集合 |
| `PRL-UT-014` | [QA-000003](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 18 | 旧版§12の補集合 |
| `PPR-IT-001` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `PPR-IT-002` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 現行Ownerの観測参照 | 一致 | 7 | 現行§13.1 |
| `PPR-IT-003` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-IT-004` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-ST-005` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Hybrid | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `PPR-UT-006` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 9 | 旧版§12の補集合 |
| `PPR-UAT-007` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `PPR-UAT-008` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `PPR-UAT-009` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `PPR-IT-010` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `PPR-UT-011` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `PPR-IT-012` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-UT-013` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-UT-014` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-UAT-015` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `PPR-UT-016` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `PPR-UT-017` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `PPR-IT-018` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `PPR-IT-019` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 2 | 現行§13.1 |
| `PPR-UAT-020` | [QA-000004](../../../../07_Quality/Definitions/QA-000004/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `CPR-IT-001` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `CPR-UAT-002` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Hybrid | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `CPR-UAT-003` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Hybrid | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `CPR-IT-004` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `CPR-ST-005` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Hybrid | 現行移管の未観測 | 変更 | 0 | 現行§13.1 |
| `CPR-IT-006` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 変更 | 2 | 現行§13.1 |
| `CPR-UAT-007` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `CPR-IT-008` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 7 | 現行§13.1 |
| `CPR-UT-009` | [QA-000005](../../../../07_Quality/Definitions/QA-000005/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 1 | 現行§13.1 |
| `ERB-IT-025` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-026` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-027` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-028` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-029` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-ST-030` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-024` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-001` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 11 | 旧版§12の補集合 |
| `ERB-IT-002` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `ERB-IT-003` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-IT-004` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `ERB-ST-005` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `ERB-IT-006` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-UAT-007` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `ERB-IT-008` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-ST-009` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `ERB-IT-010` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `ERB-ST-011` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 1 | 旧版§13.3／13.4 |
| `ERB-IT-012` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `ERB-ST-013` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `ERB-IT-014` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 変更 | 6 | 旧版§12の補集合 |
| `ERB-ST-015` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-UT-016` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-IT-017` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERB-IT-018` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 1 | 現行§13.1 |
| `ERB-ST-019` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Hybrid | 現行Ownerの観測参照 | 新規 | 0 | 現行§13.1 |
| `ERB-IT-020` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 1 | 現行§13.1 |
| `ERB-IT-021` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 2 | 現行§13.1 |
| `ERB-ST-022` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Hybrid | 現行Ownerの観測参照 | 新規 | 1 | 現行§13.1 |
| `ERB-UT-023` | [QA-000006](../../../../07_Quality/Definitions/QA-000006/quality_definition.md#4-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 10 | 現行§13.1 |
| `RFD-IT-001` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `RFD-IT-002` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RFD-ST-003` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Hybrid | 現行移管の未観測 | 変更 | 1 | 現行§13.1 |
| `RFD-ST-004` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 現行Ownerの観測参照 | 一致 | 3 | 現行§13.1 |
| `RFD-IT-005` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `RFD-UT-006` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `RFD-UAT-007` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `RFD-IT-008` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 5 | 旧版§12の補集合 |
| `RFD-IT-009` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `RFD-ST-010` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `RFD-IT-011` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `RFD-IT-012` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `RFD-IT-013` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 9 | 旧版§12の補集合 |
| `RFD-IT-014` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Automated | 現行Ownerの観測参照 | 新規 | 2 | 現行§13.1 |
| `RFD-ST-015` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Hybrid | 現行Ownerの観測参照 | 新規 | 0 | 現行§13.1 |
| `RFD-ST-016` | [QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md#3-検証項目) | Hybrid | 現行移管の未観測 | 新規 | 0 | 現行§13.1 |
| `RDL-IT-001` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `RDL-ST-002` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RDL-IT-003` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RDL-IT-004` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `RDL-UT-005` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 6 | 旧版§12の補集合 |
| `RDL-UAT-006` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `RDL-IT-007` | [QA-000008](../../../../07_Quality/Definitions/QA-000008/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `EST-IT-001` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `EST-IT-002` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `EST-ST-003` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `EST-IT-004` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `EST-ST-005` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `EST-UAT-006` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `EST-UAT-007` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `EST-UAT-008` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `EST-UAT-009` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `EST-IT-010` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `EST-ST-011` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 現行移管の未観測 | 一致 | 1 | 現行§13.1 |
| `EST-ST-012` | [QA-000009](../../../../07_Quality/Definitions/QA-000009/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-001` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-002` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-003` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-ST-004` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 2 | 旧版§12の補集合 |
| `AIT-UT-005` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 19 | 旧版§12の補集合 |
| `AIT-UAT-006` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Manual | 現行移管の未観測 | 一致 | 0 | 現行§13.1 |
| `AIT-IT-007` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-008` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 7 | 旧版§12の補集合 |
| `AIT-IT-009` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-ST-010` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-UT-011` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-UT-012` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-013` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AIT-IT-014` | [QA-000010](../../../../07_Quality/Definitions/QA-000010/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `OAG-UAT-001` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `OAG-UAT-002` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `OAG-ST-003` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `OAG-UAT-004` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `OAG-IT-005` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `OAG-IT-006` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `OAG-IT-007` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `OAG-UT-008` | [QA-000011](../../../../07_Quality/Definitions/QA-000011/quality_definition.md#3-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERP-IT-001` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 3 | 旧版§12の補集合 |
| `ERP-IT-002` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERP-IT-003` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERP-ST-004` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERP-IT-005` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `ERP-UT-006` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Automated | 旧版観測主張・現行適用未照合 | 一致 | 4 | 旧版§12の補集合 |
| `ERP-UAT-007` | [QA-000012](../../../../07_Quality/Definitions/QA-000012/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `AUH-UAT-001` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Manual | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `AUH-IT-002` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Hybrid | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AUH-IT-003` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Hybrid | 旧版観測主張・現行適用未照合 | 一致 | 1 | 旧版§12の補集合 |
| `AUH-ST-004` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `AUH-ST-005` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |
| `AUH-ST-006` | [QA-000013](../../../../07_Quality/Definitions/QA-000013/quality_definition.md#4-検証項目) | Hybrid | 旧版未観測・現行未照合 | 一致 | 0 | 旧版§13.3／13.4 |

</details>

Symbol参照数はmanifestにある正方向Symbol Relationの数であり、Test Case数、実行数または合格件数ではない。0件も未実施や失敗を単独で意味せず、Manual／HybridやRelation外の根拠を個別に確認する。

## 実行・保持

| 項目 | 記録 |
|---|---|
| 実行区間 | UTC `2026-10-02T08:13:41.013Z`〜`2026-10-02T08:13:42.610Z`。Exit 0。 |
| 実行物 | Node `v24.19.0`、`git version 2.54.0.windows.1`。各実行物のSHA-256を入力snapshotへ含めた。NODE_OPTIONS／NODE_PATHは未設定。 |
| 固定入力 | QA十三定義、Symbol十八manifest、算定文書、品質保証・保守規則と二実行物の計36入力を前後照合し一致。HEAD／Treeとdirty集合も不変。旧定義十三fileと算定文書はexact Commit／blob OIDで識別した。 |
| 取得方法 | 定義の検証項目章の第一cellだけを一次項目として抽出。旧Hybrid／Manual表も第一cellだけを使い、補足の参照IDを混ぜない。現移管集合と追加集合の包含・和集合、四区分、重複と欠落をassertした。 |
| 原記録 | `.crdd/verification/chg-000082-quality-item-reconciliation-261002/run.json`、SHA-256 `96f03e9c88b82a1efe95dd822732fd808f2fdfa126525164f21d05338376f71d`。全実行コード、command、cwd、結果、36入力の前後snapshot、Git取得37操作の引数・Exit・出力Hashを保持する。旧objectの内容はGitから再生成できる。 |
| 初期診断 | 補足参照IDを含める抽出ではHybrid 17となりassertが停止した。第一cell抽出へ是正後、12件を再現した。初期の17を義務増加や品質欠落の件数にしない。 |
| 保持・無効化 | Phase 5の結論固定と必要な非秘密根拠の正式保存まで原記録を保持し、未解決参照を確認せず削除しない。入力変化・記録喪失時は再照合する。候補表の単独更新で現在状態を確定しない。 |

## 残る照合

旧108件は、定義条件、Sourceと利用側、実行Identity・環境、入力、Oracle、終了後条件と無効化条件を実行根拠へ個別接続する。現在有効と証明できない項目は未照合のまま残し、変更が実証されて旧結果を適用できない場合は算定Ownerで要再確認とする。自動回帰の成功件数を個別適用へ代用しない。

旧未観測22件と現移管未観測33件は、既存の実施責任と必要な機械・人間・実境界評価を維持する。Trust Scope対応、Host方式採否、実再起動と実削除の別承認、新実Task停止を本照合から解除しない。

## 独立確認の完了記録

作成担当とは別の確認者が同じ三対象と原記録を読取り専用で確認し、文書・追跡、品質と直接影響、判断境界の三観点をすべて完了した。全観点は候補照合の範囲で限定Pass、Finding 0。着手前確認は流用していない。

| 固定対象 | 結果書戻し前のSHA-256 |
|---|---|
| 本Evidence | `b8bb410dd200dd7e6f151e0a177c13e58f377045daffb0b13f455f5082c46036` |
| Reality Audit | `863359f0e563c7ae4366e883817cb95aaa5f53bab01d7c99b0fb3a097c18f4af` |
| CHG本文 | `57b3aa6b4dce48dd7333e124bf110dc2ae73b0f0c8f8bcb8ebe23eb9c0539c6e` |
| 原記録 | `96f03e9c88b82a1efe95dd822732fd808f2fdfa126525164f21d05338376f71d` |

全対象の開始・終了Hashは一致した。176一次行の区分・定義章・版差・Symbol参照数と原記録への一致、旧版の再識別、入力の前後一致、および品質・許可・停止の不変を確認した。個別Evidenceの現在適用、全体QA、Source、実回復またはReleaseのPassではない。

全確認完了後、この節とChecklistの該当一行だけを結果として書き戻した。確認者とこの最小書戻しを整合済みであり、既存二文書、原記録、残るOPENおよび実行時Hashは変更していない。

## Checklist

- [x] 旧版と現行版、一次表と補足参照、補集合と実測を分けた。
- [x] 176一意項目、追加20・削除0、移管46と四区分を全数照合した。
- [x] 行一致、Relation、旧観測主張を現在Passへ変換していない。
- [x] 実行前後の入力・実行物・Git状態と再生成可能な旧objectを固定した。
- [x] 候補照合を現在品質の第二正本または新しいRegistryにしていない。
- [x] 三対象固定版の文書・品質・判断境界を独立確認し、候補照合の範囲で限定Pass、Finding 0を記録した。
- [ ] OPEN: 108件の現在適用、旧未観測22件と移管未観測33件の成立、全体品質の確定は未完了。
