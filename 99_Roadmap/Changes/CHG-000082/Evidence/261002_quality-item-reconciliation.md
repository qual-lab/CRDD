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

## 現行Profile選定の局所再確認 — 2026-10-04

`PRL-UT-014`のうち、Profile解決、配送候補と選択許可の部分を現行作業Treeで再確認した。三試験fileの28件は、失敗・取消・スキップ0で成立した。これは当初の176件の固定照合とは別の追加根拠であり、上記の独立確認結果を今回の追加範囲へ流用しない。Local Item全体、公開Transport、実Providerまたは全体品質のPassにはしない。

| 確認対象 | 実行した根拠 | 観測した意味と限界 |
|---|---|---|
| 実CatalogとProfile解決 | `provider-model-profile-runtime.contract.test.ts`、6試験 | 既定／追加Family、未知値・余分key・accessor拒否を確認した。実Catalog・実ResolverからSelection Grantまで、二Front Provider×二Executor Providerの自動／明示適合／未知ID／Provider違い／tier違い、およびCodexの役割違いの22場面を確認した。8場面は採用、14場面は拒否。一回消費と再利用拒否、Catalog不変、Provider Authority非発行・実行許可なしを確認した。Operation確認、時計、乱数と利用可否は局所fixtureであり、本番Operation Authorityと実Taskを確認したものではない。 |
| 配送候補とExecutor／Reviewer選定 | `delegation-route-selection.contract.test.ts`、15試験 | 明示Profile保持、四配送経路、未知の利用可否で推測fallbackしないこと、独立Reviewerの条件とExecutor実行前の選定を確認した。公開入口からReviewerまでのProfile誤伝播の不存在は、この結果だけで証明しない。 |
| 選定規則 | `provider-model-selection-runtime.contract.test.ts`、7試験 | 説明可能な選定、未解決方針の低推論化防止、不正分類の拒否、速度・再選定境界を確認した。実モデルの性能・外部環境の成立は対象外である。 |

整形確認→Coordinator Source／Testの型検査→三試験fileのLintを先に実施し、すべて終了値0であった。続いて主要入力10fileのHashを固定して上記28試験を実行し、終了後のHash一致を確認した。Node.js 24.19.0、基準HEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`の作業Treeを使用し、固定後の実行時間は390.3117msであった。新しいProvider依頼、Docker再起動、旧Host Root削除、署名変更は行っていない。

原記録はRepository-local `.crdd/verification/chg-000082-host-terminal-production-261003/profile-resolver-current-261004.json`、SHA-256 `08f6f1fcbc4de554b65659bf4bddece143873de8eabca7d430365748d2d4fb65`である。原記録はPhase 5の固定候補確認まで保持し、必要な非秘密結果を本Evidenceへ残す。未解決参照の解消後に限定清掃する。前回の公開契約・搬送31試験と今回の28試験は対象・実行時点を分け、合算を個別義務の完成根拠にはしない。

次は`PRL-IT-012`の全入口とReviewer非伝播、`PRL-IT-005`のCandidate Identity／Integration Recordを現行入力・Oracle・終了後条件へ照合する。旧108件の残る適用照合、旧未観測22件と移管未観測33件、旧Host三件の非使用と新実Task停止は維持する。

## Candidate記録の直接観測の補強 — 2026-10-04

`PRL-IT-005`のIntegration Record保存境界を再確認した。既存試験は正規Candidate Identityの保存成功と衝突拒否を確認していたが、記録が一件だけであることと衝突後の元byte不変を直接確認していなかった。この不足だけを同じ試験fileへ補い、Production実装・Canonical義務・Authorityは変更していない。

| 条件 | 追加した直接観測 | 結果 |
|---|---|---|
| `candidate.<64hex>.<64hex>`の正常保存 | 完全なIdentityを再読取りし、保存Directoryが当該Record一件だけであることを確認した。 | 成立。短縮・再採番・追加Record・pending残存はない。 |
| 同じIdentityで異なる内容の保存要求 | 初回Recordのbyte列を保存し、衝突拒否後のbyte一致とDirectoryの一件性を確認した。 | 成立。元Recordを書き換えず、別Recordも追加していない。 |

整形→Coordinator Source／Testの型検査→Lintを終了値0で実施後、四試験を再実行した。Pass 4、失敗・取消・スキップ0、606.5007ms。一時Repositoryは事前に範囲確認したRepository-local `.crdd/verification/chg-000082-quality-record-261004/tmp`へ限定し、試験終了後に同Root直下の残存0を観測した。Sourceと試験の主要入力二fileは実行前後で一致した。新しいProvider依頼、Docker操作、旧Host Root削除、署名変更は行っていない。

原記録は同じRepository-local検証Directoryの`integration-record-current.json`、SHA-256 `611d62905877cd2e027e7af1097e6341e3e2c972e4807e58277f49d7bbec5e62`である。Phase 5固定候補確認まで保持し、参照解消後に限定清掃する。保存Adapterの四試験からTask State／Candidate Storeの全Consumer、改変・短縮Identity、Scope／Authority／cleanupの反例、Local Item全体または最終独立確認の成立は推定しない。旧独立確認は追加した試験・根拠のレビューに流用しない。

## Executor限定Profile搬送の四組合せ — 2026-10-04

`PRL-IT-012`のうち、実Coordinator状態機械からExecutor／Reviewer選定へのProfile搬送を補強した。既存CaseのCodex Executor一組合せを、Front Provider二種×Executor Provider二種の四組合せへ拡張した。Production実装、Profile Catalog、Canonical義務またはAuthorityは変更していない。

| 条件 | 直接観測 | 結果・限界 |
|---|---|---|
| 四正常組合せ | Front Provider、Executorの指定ProviderとProfile ID、Reviewerの役割・subjectProvider・Profile `null`・独立Provider要求、選定二回。 | 四組合せとも完了した。選定依存は合成であり、実Catalog／Grant、公開UI・CLI・MCPや実Providerへ拡大しない。 |
| 不正Profile `latest` | 入力拒否、選定0、Operation作成0、Provider Process開始0。 | Task入力契約で拒否した。件数はfixtureの発生点であり、実OSやNetworkの不存在証明ではない。 |

Formatter→Coordinator Source／Test型→Lintは全てexit 0。名前を限定した既存一Case内で四正常組合せと一拒否を確認し、1件成功・失敗・取消・skip 0、303.345msだった。実行前2026-10-03T19:52:50.1956549Zと実行後19:52:57.7614373Zの選択七入力Hashは一致した。完全依存閉包、全試験file、Coverage、Local Item全体や独立完成レビューは未確認である。

原記録はRepository-local `.crdd/verification/chg-000082-host-terminal-production-261003/profile-executor-only-matrix-261004.json`、SHA-256 `d039855a4fcb13c21cec2038c89f9f443337e481aee6ee6ef9d2c0848b672378`。Phase 5の固定候補確認まで保持し、必要な非秘密根拠を本Evidenceへ残す。旧独立確認や先の28試験を今回の改訂へ流用せず、全入口のProfile搬送、Authority／結果のTransport同等性、元E2Eと全体品質の未成立を保持する。Provider依頼、Docker操作、旧Host削除、署名変更は行っていない。

## Candidate Identity照合の拒否とbyte不変 — 2026-10-04

`PRL-IT-005`のうち、実Candidate Storeから採用Adapterへ渡すIdentity照合の反例を既存ITへ追加した。Production実装、Canonical条件、AuthorityおよびQA集計は変更していない。汎用Integration RecordのIdentity字句契約をCandidate専用へ狭めず、候補の存在・内容一致は既存Store／採用Adapterの責務として確認した。

| 条件 | 実際の観測 | 結果・限界 |
|---|---|---|
| 完全な正規Candidate ID | 発行IDとの完全一致と139文字の保持、再Bindingと正常採用。 | 完全なIDを受理した。Candidate IDから採用Authorityは発行していない。 |
| 四ID反例 | 一文字短縮、末尾hexの改変、prefixの大小文字変更、余分な末尾区切り。実StoreのreadとAdapterのbind、adoptを実行した。 | 全件nullで拒否した。未知IDの網羅を主張せず、四同値分割の反例とする。 |
| 四Metadata反例 | 内容Hash違い、基準Revision違い、変更Path不足、許可外Path混入。実Adapterのadoptを実行した。 | 全件nullで拒否した。Authorityや上位Applicationの拒否理由をこの戻り値から推定しない。 |
| 八拒否後の不変 | 毎回、Repository二fileのbyte相当の内容、Git dirtyなし、Store全名前集合と通常fileの全byte列を直接再読取り。 | 変更は観測されなかった。OS全体の資源不存在、Process／Network Effect 0または第三者との競合を証明するものではない。 |
| 記録Adapterの既存四試験 | 同一再試行、完全IDを持つ一件、Identity衝突後のbyte不変、不正Path拒否。 | 別Adapter試験として再実行した。候補採用から記録までの一本の結合試験ではない。 |

Formatter→Coordinator Source／Test型→Lintはexit 0。最初の型確認では再帰一覧のstring／Buffer overloadが不明確だったため、encodingを`utf8`へ明示し、静的段階からやり直してから試験した。二file五Caseは成功5・失敗0・取消0・skip 0、3192.8601msだった。改変八条件は既存一Case内であり、Local Itemを八件増やした意味ではない。Gitのuser-home ignoreアクセス警告と改行変換警告は結果から削除していない。

追加ITのSHA-256は`20a96b9c805f0205ffdbbdc71b5f25cd7d32db104e95c8437d3e04f48079cf2f`。選択五入力の実行前後Hashは一致した。試験は検証済みRepository内の既存用途限定tmpへTEMP／TMPを固定し、終了後の同tmpは空だった。旧Host三件には触れていない。原記録は`.crdd/verification/chg-000082-quality-record-261004/candidate-identity-current.json`、SHA-256 `c8b89bd3409439cf0a9bf075e46e9ac7237dc09f910bfdbb6f40594de2351ee2`。Phase 5固定候補確認まで保持し、2026-10-11までに参照・保持要否を再評価する。名前だけによる削除は行わない。

ProductionのWorkbench採用入口はStore再読取りとBinding一致を確認した後だけPersistence／採用Applicationへ進むことをSource照合したが、今回その公開入口は実行していない。改変ID拒否時の上位結果field・記録0、Task State、Authority、cleanupおよび全Consumerの現行適合は未完了であり、`PRL-IT-005`全体のPassへ昇格しない。新しい実Task、署名、Docker再起動と旧残存削除は行っていない。

Header／Trace検査は初回18成功・1失敗（59229.1435ms）で、追加TraceをSymbol関係へ反映していなかった。既存test-suiteの`localTestIds`へ追加した後も昇順不一致で18成功・1失敗（54818.4504ms）となった。現在は`PRL-IT-005, PRL-IT-012`の昇順へ修正し、失敗した全Test SourceのTrace検査一項目を限定再実行して1成功・失敗・取消・skip 0（324.1601ms）を確認した。Checkerを弱めていない。Symbol JSONはBiomeの既存除外対象であり、対象fileのFormatter成功とは扱わず、JSON構文parseとTrace検査を行った。現在Symbol SHA-256は`3778ef7cc0a46891ef46198a43eae053defad02fbc5ee61e6e760c287b02a9ec`。

別確認者は、固定した試験・Production Source・Symbol関係・結果書戻し前の本節から、反例の差、拒否発生点、byte不変Oracle、QA接続と過大主張の有無を読み取り専用で確認し、今回の試験補強に限りPass・指摘0とした。二失敗と最小結果追記が確認範囲を変えないことも整合した。全体技術レビュー、文書監査、Gap／Impact監査の代替にはしない。原記録は同検証Directoryの`candidate-identity-trace-review.json`、SHA-256 `0ded1c2db74e73361ef7b5a3f3081c82e3ea75b1502aaa45e020ed288ee7088d`。保持・再評価条件は前段と同じである。

## 複数Recoveryの順次処置と先行未確認 — 2026-10-04

`PRL-IT-013`のうち、同じTaskにDocker回復二件とHost義務一件がある場合の再入場を、既存Objective intake ITで補強した。実Repository保存層と実Applicationを通し、Production実装・Canonical義務・Authorityは変更していない。任意IDを利用者が選ぶ新操作を追加したものではなく、Applicationが同じObjectiveの既存義務を一件ずつ処置する経路の確認である。

| 条件 | 直接観測 | 結果・限界 |
|---|---|---|
| 二Docker回復が通常成立する | exact IDの順序、保存済みphase、受領した二ID、Task実行回数、Host義務の全field。 | 二件とも受領済みとなり、Host義務は元の内容・requiredのまま外部回復として返した。Task実行は初回一回だけだった。 |
| 先頭Docker回復が未確認 | 後続呼出しなし、二件目のrequired保持、受領0、再入場時の先頭ID再使用。 | 未確認時は後続を処置しなかった。次回は同じ先頭IDから再開し、二件の受領後もHost義務は変更しなかった。 |

Provider実行、Docker回復と受領は合成Portである。既存helperがruntime_process義務を保存State上でsettleしており、実Process消失・世代交代を証明しない。一Objective・一Taskの範囲であり、別Task、全Host／Home Inventory、実Docker清掃、OS資源不存在または`PRL-IT-013`全体の成立は未確認である。

Formatter→Coordinator Source／Test型→Lintは終了値0。最初の限定実行は1成功・失敗／取消／skip 0、2581.0688ms。その後静的段階を再確認し、四入力の完全Hashを固定した再実行も1成功・失敗／取消／skip 0、2761.7383msだった。四入力の前後Hash一致とRepository内の用途限定tmp直下の残存0を観測した。Test SHA-256は`da20bf5d0214dd355a9753570f50bc3a7a840eb310bfc860e7b220d04e702def`。Symbolの既存suiteへ`PRL-IT-013`を追加し、全Test SourceのTrace検査を限定再実行して1成功・失敗／取消／skip 0、280.6838msだった。Symbol SHA-256は`6815cde2d00ab1f7b4cf151e7f3454006b6834bfb9e8bf7deb9a3447d7bebcac`。全依存閉包・全回帰・Coverageを確認した結果ではない。

原記録はRepository-local `.crdd/verification/chg-000082-quality-record-261004/multiple-recovery-current.json`、SHA-256 `e31dca19ea1286ea29ce7c55a571b9ea1961d1900e0e4ba5c0cf178022ecb8cd`。Phase 5固定候補確認まで保持し、2026-10-11までに参照と保持要否を再評価する。名前だけで削除しない。新しいProvider依頼、Docker再起動、旧Host三件の削除、署名変更とQA集計更新は行っていない。旧独立確認を今回の補強へ流用せず、全体技術レビュー・文書監査・Gap／Impact監査は未完了のまま維持する。

作成担当とは別の確認者が上記の固定対象、Production、QA、原記録と本節を読み取り専用で確認し、試験補強の範囲でPass・指摘0とした。先頭未確認、exact ID再使用、Host不変、追加Task実行抑止と合成境界の説明がOracleへ接続していることを確認した。既存Helperの準備責務Traceは維持可能であり、呼出し先IDの和集合を機械追加していない。結果書戻し前の本Evidence SHA-256は`9ea8fa9093a534bdb826b811f0c69dba7842696ad3120f173a4d99d47bd2606a`。確認記録は同検証Directoryの`multiple-recovery-review.json`、SHA-256 `a6032fcb2c21ba09cd65bd22f75f0ef329558f24efa4378f3d113e489be5bd2c`である。

同じ固定版で既存の単一Recovery・受領中断Caseと今回の複数Caseを限定回帰し、2成功・失敗／取消／skip 0、4847.1235ms、選択四入力のHash一致と用途限定tmp直下0を確認した。回帰原記録は`multiple-recovery-regression.json`、SHA-256 `93c064e62bf4106a48390e5e5ff22320a5b7af62e9e081bcd36cf9760e72f30f`。二記録の保持・再評価条件は前段と同じである。本段の最小結果書戻しは確認者と整合済みで、全体監査、実処置、Local Item全体またはReleaseの判定を変更していない。

## Recovery一覧と対象限定処置の現行再確認 — 2026-10-04

前節のApplication確認とは別に、`PRL-IT-013`へ既に接続されているjournal／Runtimeの七Caseを現行作業Treeで再実行した。新しい試験・Productionコード・Canonical条件は追加していない。

| 境界 | 確認した範囲 | 観測結果・残る限界 |
|---|---|---|
| journalの対象限定resume | cleanup、base move、base commit move、pointer deleteでexact Recovery IDを指定する。 | Aの処置中にBのanchor bytesと`dev / ino / birthtimeNs`が不変。結合情報違いは変更前に拒否しanchorを保持した。試験所有のNode子Processで中間状態を作り、Repository内の実Filesystemを使用した。 |
| 複数Homeの一覧 | 異なる論理Homeでbase moveの中間状態を二件作る。 | 両exact IDを一覧化した。Identity／利用者結合値とLockはfixtureであり、実Host保護namespaceの適合確認ではない。 |
| exact Docker構成検査 | 完全一致とreplacementを合成runnerへ渡す。 | 一致時の削除発行1、replacement時0。実Dockerの資源不存在や回復完了を示さない。 |

Formatter→Coordinator Source／Test型→対象二fileのLintは終了値0。七Caseは成功7・失敗／取消／skip 0、2672.7416ms。選択六入力の完全Hashは前後一致し、Repository内の検証済み用途限定tmp直下は0件だった。公開CLI／WorkbenchのComposition、全TaskのScope、全Local Itemと独立確認は未成立のまま保持する。直前節の限定レビューを今回の観測へ流用せず、最終技術・文書・Gap／Impact監査で対象とする。新しいProvider依頼、Docker再起動、旧Host三件の削除、署名変更とQA集計変更は行っていない。

原記録はRepository-local `.crdd/verification/chg-000082-quality-record-261004/recovery-inventory-selection-current.json`、SHA-256 `3cd50fbbc9b4dd1f4731247f9d7c037e5b050c19d26817a03b8c1651b545fc9d`。Phase 5固定候補確認まで保持し、2026-10-11までに参照と保持要否を再評価する。名前だけによる削除は行わない。

## Profile搬送の入口別照合 — 2026-10-04

Profileを失わず搬送する局所境界とWorkbenchのHTTP入口を現行版で確認した。局所36試験とHTTP一試験は成功したが、`PRL-IT-012`全体の成立へは昇格しない。Productionコード、QA義務、Profile CatalogとAuthorityは変更していない。

[Project Runtime詳細設計](../../../../06_Architecture/Details/project-runtime/01_Architecture.md)は、公開Objective（CLI／MCP）とWorkbenchの変更候補（Single Task）を別操作として定義している。UI、CLI、MCPという媒体名だけで両操作を同一化せず、各操作の入力・結果・Authorityを同じ操作の範囲で比較する。今回の照合は既存契約の検証であり、新しいUI Objective入口や別のProfile選択方式を追加しない。

| 境界 | 今回の根拠 | 残る確認 |
|---|---|---|
| 公開Objective→Task入力 | 実入力検査・builder・Task snapshotで、任意三項目の八組合せ×Front Provider二種を確認した。 | 公開CLIとMCPの実搬送を含む一本の結合確認ではない。 |
| MCP Objective handler→Application Port | 明示IDの完全保持、省略時の非生成、不正入力の認証・Core呼出し0、取消Signal、閉じた結果と回復集合を確認した。 | 認証・Coreは合成Port。stdio／HTTPの実Transportから現行Catalog・Selection Grantへの結合は未確認。 |
| Workbench HTTP→AI Application Port | 送信未確認の拒否、助言／変更候補の別入力、指定Profile、許可Path、状態と四区分の結果を実Serverで確認した。 | AI Applicationと候補操作は合成Port。Browser操作、実Coordinatorとの結合とProvider成立は未確認。 |
| Workbench Application／候補Executor→Task Port | 助言／変更候補の配送分離、未知Profile・不正入力拒否、取消後の遅延完了拒否、指定ProfileのTask搬送、未採用Candidate結果を確認した。 | Task Portは合成。Builtin Catalogのfixtureは採用済み外部Profileや6.1 Sol／6 Luna移行の実境界証明ではない。 |
| Task→Executor／Reviewer選定 | 前節の四組合せでExecutor限定搬送とReviewerへの非伝播を確認した範囲を維持する。今回の36試験にはその再実行を含めない。 | 各公開入口から現行Catalog・Grant・Task選定までを同じ実行で結合する必要がある。 |
| 公開CLI | 現行Sourceはstdin入力を読み、同じ公開Objective関数へ渡す。 | Source接続は実行結果ではない。正常入力・不正Profile・結果fieldと終了条件の実CLI観測は今回未実施。 |

Formatter→型→Lintを終了値0で確認後、四fileの局所36試験を実行した。固定記録の再実行は成功36・失敗／取消／skip 0、1220.0045ms、2026-10-04 05:25:38〜05:25:44 UTC。続いてWorkbench試験のFormatter→型→Lintを終了値0で確認し、名前限定の実HTTP一試験は成功1・失敗／取消／skip 0、2890.8114ms、05:27:22〜05:27:28 UTCだった。Node.js 24.19.0、HEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`、Root Tree `0dc1df1a8dee2ec27c94f18500d59c06c2c44977`、Object Format `sha1`のdirtyな作業Treeを使用した。選択入力・実行物とGit状態は、それぞれの固定実行前後で一致した。完全な推移的依存閉包、全回帰やCoverage率の確認ではない。

最初の採取は私のコマンド指定に誤りがあり、未引用のGit Tree式をPowerShellが別引数へ変換し、Hash表示も短縮された。HTTP側の最初の採取ではロゴPathが誤っていた。試験自体は成功したが、これらは入力固定の根拠に使わず、引用・JSON表示・実ロゴPathを訂正した後の前後一致を持つ再実行だけを上記へ採用した。不完全な採取とGit警告も原記録へ保持した。

原記録はRepository-local `.crdd/verification/chg-000082-quality-record-261004/profile-boundary-current.json`、SHA-256 `b974f534a420cb84657496a4ca2570a1d1be7813078c298fc51c4d68e4551b6d`。Phase 5固定候補確認まで保持し、2026-10-11までに参照と保持要否を再評価する。用途限定tmpには既存Microsoft診断の`.trn`十fileが残り、送信・内容・由来の全確認はしていない。tmp全体の不存在や秘密不存在を主張せず、名前だけで削除しない。

新しいProvider依頼、Docker操作、共有ACL変更、旧Host三件処置、署名、Commit／Pushは行っていない。Quality Centerへ共有ACL移行の判断待ちを反映したが、13／46と全体OPENは変更しない。今回の結果は最終技術レビュー・文書監査・Gap／Impact監査で確認する。過去の限定レビューを新しい結果へ流用せず、同じ小境界への個別監査反復も追加しない。

## 旧Traceability JSONの廃止条件再確認 — 2026-10-04

旧二JSONは現在も必要な利用側を持ち、廃止条件は未成立である。[Reality Auditの移行判定](../../../../07_Quality/05_Current_Implementation_Reality_Audit.md#11-旧runtime-traceability-jsonの移行判定)と[採用済みRoadmap](../../../01_Roadmap.md#12-v0220--project運営複数repository)を維持し、削除や全Subsystemへの旧形式展開は行わない。

| 確認したこと | 結果 | この結果では証明しないこと |
|---|---|---|
| 既存Migration Inventoryのルート項目 | Coordinator 11項目、Project Runtime 16項目を分類し、Finding 0。同じ入力の二回の結果は一致した。 | 下位Propertyの値・関係の同等性、各Ownerへの移行完了。 |
| 設計IDの所在 | 設計配列のID欠落0。Project RuntimeのInvariantは現行33件であり、旧表示32件を算定Ownerで訂正した。 | IDが本文にあることだけによる、抽出完全性や意味の一致。 |
| 値の変化への反証 | メモリ上だけで`interfaces[0].owner`を別値へ変更しても、Inventoryは元入力と完全一致しFinding 0だった。実ファイルへの変更はない。 | 正本側の欠陥、新しいOwnerの採用、または本番実装の変更。既存Inventoryが値の同等性を判定しないという観測に限定する。 |
| 現行利用側 | Coordinatorの二検査Script、二契約試験と試験支援、CheckerのProfile／fixture、Architecture参照、Semantic Coverage移行入力に旧Pathが残る。 | 参照箇所の件数だけによる完全な動的利用側の不存在。 |

着手前は既存§11.1〜11.3、Semantic Coverage詳細設計の正本／生成物境界と実Inventoryを照合した。今回の変更は結果の明確化と現行件数の訂正であり、廃止Gate、QA義務、設計、Schema、Source、Authorityと利用側は変更しない。編集の対応は、現行Invariant件数を§11.1へ、値の同等性を証明しない限界を同節へ、実行条件・反例と利用側を本節へ残す。旧JSONを正解としてCanonicalへ逆輸入せず、次に必要なのは正本から生成した値・関係と旧投影の比較、および利用側置換である。

実行はNode.js 24.19.0の読み取り専用診断で終了値0。HEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`、Root Tree `0dc1df1a8dee2ec27c94f18500d59c06c2c44977`のdirtyな作業Treeで、選択六入力のSHA-256は前後一致した。完全な推移的依存閉包、回帰試験、生成器による全Property抽出または廃止Gate合格の確認ではない。元JSON、設計文書とProduction Sourceを診断で変更していない。

原記録はRepository-local `.crdd/verification/chg-000082-quality-record-261004/legacy-retirement-current.json`、SHA-256 `8ed545223d661ec7177871c237e1050d79171b6b19787f1548228b54031e6eea`。Phase 5固定候補確認まで保持し、2026-10-11までに参照と保持要否を再評価する。名前や経過時間だけで削除しない。Provider依頼、Docker操作、共有ACL変更、旧Host三件処置、署名、Commit／Pushは行っていない。13／46と全体OPENは変更せず、最終技術レビュー・文書監査・Gap／Impact監査は未完了のまま保持する。

## 正式検証の画面なし実行の現行確認 — 2026-10-04

採用済み[Roadmapの画面なし実行（Headless）](../../../01_Roadmap.md#12-v0220--project運営複数repository)は未完了である。既存の結果保存を未実装扱いにせず、公開入口の配送条件と正式検証の成立を分けた。今回の変更は本節、Roadmapの対応状態とCHGの参照だけであり、起動条件、署名、外部送信承認、保存先Authority、QA義務と品質集計は変更しない。

| 境界 | 今回の直接観測・Source照合 | 残る確認 |
|---|---|---|
| 四経路の公開入口 | `template/tools/crdd-coordinator.ts verify-routes`をパイプ接続した実子Processは終了値64、stdoutなし、`coordinator_launch_terminal_output_required`で停止した。公開入口から署名検証・Provider実行へ進んでいない。 | 既存承認を検証し、承認不足では送信せず停止する画面なし実行経路。端末条件を無条件に削除してよいという根拠ではない。 |
| 配送計画 | 画面なしの四経路拒否、端末ありの配送、未定義`--headless`拒否、復旧検証・一般Taskの機械出力配送、署名の端末必須の六条件を純粋関数で確認した。 | `ready`は配送計画だけであり、実行許可、署名成立や試験合格ではない。 |
| 保存用投影 | blockedの合成結果から生出力・Host Path・Credential・任意fieldの四つの合成値が除外され、cleanup未完了と回復要求は保持された。 | 実Provider結果の全field、実Writerの耐久保存、CI／Remoteの情報境界。四値だけの確認から秘密不存在を推定しない。 |
| 既存結果Writer | 検証済みRepository内の保存領域へ開始・結果・完了を分け、開始保存失敗ではcallbackを呼ばず、終了保存失敗では実行結果と保存状態を分けるSourceを照合した。 | 今回Writerは実行していない。保存先・結果公開のAuthorityと画面なし利用側までの結合確認。 |

着手前は品質保証§1.3／§1.4／§5.3、Roadmap、Coordinatorの公開Launcher、一般署名検証と結果Writerを照合した。記録は既存進捗表示の具体化であり、新しい正式契約を採用しない。全体技術レビュー・文書監査・Gap／Impact監査で確認し、準拠基準を変更しないため準拠監査をこの局所記録だけに追加しない。署名・認証の人間入力は画面なしに移さず、保存成功を実行成功へ変換しない。

Formatter→Source型→Lintは終了値0。その後の読み取り専用診断は終了値0、Node.js 24.19.0、2026-10-04 05:45:48〜05:45:49 UTC。HEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`、Root Tree `0dc1df1a8dee2ec27c94f18500d59c06c2c44977`、Object Format `sha1`のdirtyな作業Treeで、選択八入力HashとGit状態は診断前後で一致した。実子は同期joinしsignalなしで終了した。完全依存閉包、保存領域の全残存、実CI／Remote、正式署名実行またはLocal Item全体を確認した結果ではない。

原記録はRepository-local `.crdd/verification/chg-000082-quality-record-261004/headless-entry-current.json`、SHA-256 `324419306f20f1a05102552b3ba3c391101d7f05d8a6929ea415291123575686`。Phase 5固定候補確認まで保持し、2026-10-11までに参照・保持要否を再評価する。名前や経過時間だけで削除しない。Provider依頼、Docker操作、共有ACL変更、旧Host三件処置、署名、Commit／Pushは行っていない。今回の拒否確認を正式検証の合格やRelease可能へ昇格しない。

## Checklist

- [x] 旧版と現行版、一次表と補足参照、補集合と実測を分けた。
- [x] 176一意項目、追加20・削除0、移管46と四区分を全数照合した。
- [x] 行一致、Relation、旧観測主張を現在Passへ変換していない。
- [x] 実行前後の入力・実行物・Git状態と再生成可能な旧objectを固定した。
- [x] 候補照合を現在品質の第二正本または新しいRegistryにしていない。
- [x] 三対象固定版の文書・品質・判断境界を独立確認し、候補照合の範囲で限定Pass、Finding 0を記録した。
- [ ] OPEN: 108件の現在適用、旧未観測22件と移管未観測33件の成立、全体品質の確定は未完了。
- [x] 現行Profile選定の局所28試験と主要入力の前後一致を記録し、公開Transport・実Provider・個別義務全体および独立確認の未成立を分けた。
- [x] Candidate記録の一件性と衝突後のbyte不変を試験で直接観測し、実Consumer全体と最終独立確認の未成立を分けた。
- [x] ProfileのExecutor限定搬送を四正常組合せと不正指定の選定・開始0で確認し、合成依存、選択七入力および個別義務全体の未成立を分けた。
- [x] 候補照合の八拒否とStore／Repository不変を実Adapterで確認し、別の記録Adapter試験、未実行の公開入口、個別義務全体と最終独立確認の未成立を分けた。
- [x] 候補試験追加の限定独立確認とTrace関係の是正結果を記録し、全体監査へ流用していない。
- [x] 複数Recoveryの順次処置、先行未確認後の後続保持とexact ID再使用を実保存・Applicationで確認し、合成Port・別Taskと全Inventoryの未確認を分けた。
- [x] 複数Recovery試験の限定独立確認と単一Recoveryを含む二Caseの限定回帰を記録し、全体成立へ拡大していない。
- [x] journalの対象別不変、複数Home一覧と構成不一致拒否の既存七Caseを現行版で観測し、実Docker・公開Compositionと独立確認の未成立を分けた。
- [x] Profileの局所36試験と実HTTP一試験を入口別に対応付け、別操作、合成Port、採取誤りと未結合境界を明示した。
- [x] 旧二JSONの現行ルート項目・ID所在と利用側を確認し、値の同等性を判定しない反例と廃止未成立を分けた。
- [x] 四経路の画面なし公開入口拒否を実子で確認し、配送計画・合成投影・WriterのSource接続と正式検証未成立を分けた。
