# Visual Previewの品質適用と集計不整合の処置

成果物種別: 品質適用・変更記録
変更ID: `CHG-000082`
基準Commit: `71f22c3ea4e124eda5b466ee5579ad0cd8e5af97`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

`ERB-IT-018`の[固定された直接境界根拠](261002_visual-preview-direct-boundary.md)を現在品質へ適用する。移管母集団46件の既観測11件にこの一件を加え、12件観測済み・34件未観測とする。全体集計の旧内訳は現集合と不整合のため、現在の全体件数は再照合中（OPEN）。Quality Ready、実Host回収、実Provider E2EまたはRelease可能へ昇格しない。

## 経路と着手前確認

品質結果の適用と直接投影の更新であり、Source、検証義務、Authority、署名候補と過去結果は不変。親は品質保証§1.3、Quality定義、算定文書、Symbol Relation、Discovery Scope、CHGおよび表示Parserを照合し、独立した読取り確認者の計画修正を全て統合後に編集した。これは完成後のレビューではない。

発火例は独立確認済み`ERB-IT-018`の根拠適用。非発火例はNative二十一試験の局所成功で、024〜030の未充足終了後条件を補わない。境界例はRelationあり・完成Evidenceなし、情報不足例は採用Scope対応未確定であり、いずれも合格へ畳まない。

完成後は六fileの同じ固定差分へ、品質・直接影響、文書・追跡、判断境界の三観点を全て確認する。準拠基準・Source・実行入口を変更しないため準拠監査、全回帰、再署名、Provider／Docker E2Eはこの確認集合に含めない。

| 対象file | 処置 |
|---|---|
| `07_Quality/05_Current_Implementation_Reality_Audit.md` | 一項目の根拠適用、旧集計と現在OPENの分離、誤った表の是正、Scope対応の追跡。 |
| `07_Quality/01_Quality_Center.md` | 現在品質と方式判断待ちを算定・承認Ownerから投影。 |
| `07_Quality/04_Quality_Integration.md` | 移管と採用範囲を分け、現在値は算定Ownerへ参照。 |
| `PROJECT_CONTEXT.md` | 同じ現在品質を五場面の入口へ投影。 |
| `99_Roadmap/Changes/CHG-000082/change.md` | 現在行に残る旧39件の表現をOwner参照へ直し、本記録を接続。 |
| 本記録 | 適用理由、計画修正、根拠、限界と確認結果。 |

## 根拠と算定の境界

| 確認 | 現在の処置 |
|---|---|
| Canonical定義 | 定義表の一意なLocal Itemは176件、重複行0。 |
| 移管一覧 | 一意集合46件、定義にないIDは0。既観測11件は変更せず、`ERB-IT-018`だけを追加する。 |
| Symbol Relation | 現物の全`symbol.json`から一意132件、Relationなし44件を読取り計測。存在は実行・完成の証明ではない。 |
| 非完成表の表示漏れ | 既観測`PPR-IT-002`を除外し、§13.1で未観測の`PPR-ST-005`（Hybrid／System E2E）を追加。どちらも新しい観測や義務の追加ではない。 |
| Relation外の根拠 | `ERB-ST-019`と`RFD-ST-015`は既に観測済みだが、現Relationなし集合に含まれる。旧「Relation外1件」の説明を現在へ使わない。 |
| 全体件数 | 旧119／176・57未観測は旧投影として分離。108＋12＝120／176・56未観測は算定候補で、残りRelationの現行Evidence適用を全件証明するまでは現在の全体集計にしない。 |
| v0.21 | 108／130、未観測22件は固定Baselineの履歴であり、本更新で再検証・変更しない。 |

今回追加する根拠の対象はLibrary→localhost HTTP→Browser相当Consumerの直接境界である。実Browser、署名CLI、悪意ある同時Filesystem差替え、全Repositoryの無書込み監視または旧Host三領域の非使用へ一般化しない。試験Sourceと製品Sourceは基準Commitから変更しない。

## 変更前から残るScopeと人間判断

移管一覧に載ることは、v0.22へ全機能が採用済みであることを意味しない。DiscoveryのEXP-000034とCHGの対象外は本格Trust Policy管理を除外する一方、`AIT-UAT-006`は利用者所有Policyを含む判断を要求する。Qual-Labが最終Quality／Scope Gateまでに意味ごとの採用範囲を照合する。定義削除、分母縮小、全項目N/Aまたは対象外機能の先行実装はしない。

限定Orphan Recoveryの追加方針は承認済みだが、旧領域の非使用に検証したWindows再起動境界と再利用防止を用いる方式は設計判断待ち。実再起動・既存三件削除は別承認であり、新実Task停止を維持する。本更新を処置Authorityにしない。

## 検証と独立確認

現行Markdownを製品の`parseRepositoryQualityProjectionMarkdown`へ入力し、必須七項目、12／46と34／46、全体未完成および方式判断待ちの保持を確認した。集合再計測は176定義・132 Relation・Relationなし44・移管46・未知ID 0で、旧非完成表の是正も確認した。実行前後の対象Hashは一致し、旧根拠へ結果を上書きしていない。

| 確認 | 実行結果と限界 |
|---|---|
| Consumer／集合 | Node `v24.19.0`、読取り専用ESM実行は各Exit 0。Consumer観測区間はUTC `2026-10-02T07:17:45.802Z`〜`2026-10-02T07:17:45.813Z`、集合計測は`2026-10-02T07:17:21.539Z`。全体Evidence成立は証明していない。 |
| Checker | Exit 1、Error 1／Warning 0。`stable-release-tag-identity-mismatch`のみ。公開v0.21 tagとv0.22作業HEADの既知差であり、全体Passへ変更しない。リンク・構造について追加Findingなし。 |
| 差分 | `git diff --check`はExit 0。Source、試験と検証義務は変更していない。 |
| 原記録 | Repository-local `.crdd/verification/chg-000082-quality-projection-261002/run.json`、SHA-256 `0eceae06f65bb21b894691ad221a89db1263e424861f957980a94bf027e76106`。実行コード、cwd、Node binary Hash、入力Hash、前後一致とToolが返したUnicode出力を保持する。生stdout／stderr bytesの分離保存とは主張しない。 |
| 保持 | Phase 5の結論固定と必要な非秘密根拠の正式Evidence保存まで原記録を保持。削除前に未解決参照を確認し、喪失した場合は再実行まで再識別根拠にしない。 |
| 独立確認 | 初回の三観点は全て完了し、文書のMinor Finding `QP-D01`一件を検出した。是正後の新固定版は再確認待ちであり、Passを先に記載しない。 |

### 初回独立確認と是正

初回対象はQuality Center `02cd423b9e82b4e4bee518ae828d05e0ded5b85f9555d125b4601a8be2b4889f`、Integration `258817d790ae155e8fbadd14b98cb6c540cc07d63ba7593a67017efcd34c19aa`、Reality Audit `b7c1b87bd5659d494cceee6d8a99a9aad373fd65c5bdde8d0a39b26e209dff13`、Project Context `b7670ac6361591f5e2863415dadb540e719e72029356d94aed38af71cdafe793`、CHG `aa76f205c31d616f7b34f279ef04af09fec79ca11909b5152ac1ebe45a5a1b19`、本記録 `821f1d4462b689ed332ee41a9c9c0cd19ea22506655602f2a058291f3284f8b5`。確認者は全件の開始・終了一致を確認した。

`QP-D01`の原因は、Quality Center下部で旧候補の実行値と未実施表示を現在状態へ混在させたことである。全結果を統合し、確認者と是正方針を整合後、当該表を履歴として明示し、直前のChecker／Reality Audit行も参照当時の限定結果へ戻した。旧件数、実行結果、Identityと根拠本文は保持し、現在七項目、12／46・34／46、全体OPEN、承認・停止境界は変更しない。

初回原記録の入力HashはConsumer実行時の途中版である。初回確認の六file全てを同じ最終版で実行したとは主張しない。新しいConsumer実行は別の`rerun.json`へ保存し、旧`run.json`を上書きしない。結果記入による本記録の後続差分も、実行時Hashへ遡及適用しない。

是正後のConsumer再実行はUTC `2026-10-02T07:24:43.792Z`〜`2026-10-02T07:24:43.805Z`、Exit 0。六文書、Consumer、参照根拠、十三QA定義と十八Symbol Manifestの計四十一入力Hashを前後照合し、全件一致した。七項目・現在値・停止条件と集合件数は初回と不変。新原記録は同じRepository-local保存先の`rerun.json`、SHA-256 `66323ab3074a947f418f52fe16aeddfc9061d663db128eca752abad76e775289`。初回`run.json`のHashは不変。今回の記録追記後のHashは、再実行時Hashとは区別して独立確認へ固定する。

### 限定再確認の完了

是正後の六文書固定版を、作成担当と別の確認者が同じ三観点で独立確認し、全観点の限定Pass、`QP-D01` Resolved、新規Finding 0、開始・終了Hash一致を確認した。Quality Centerの対象Hashは`bcd00267cc0a6ad01c8927c356577764f4f517ec805ec027e34cad91c64e7a68`、本記録は`8cbf6f43b7d48ec19d7ef5cbbb7e47419cf62a130bcaaa7e809f6cfad1e4e9df`。他四文書は初回固定Hashと一致し、旧`run.json`と新`rerun.json`も指定Hashから不変であった。

この対象Hashは結果書戻し前の版であり、実行時入力Hashと区別する。品質軸の旧結果本文・件数・Identityは変更せず、現在への適用OPEN、12／46・34／46、Trust Scope対応OPENおよび承認・停止境界を維持した。本節とChecklist一行だけを、全結果統合後の整合済み結果書戻しとして追加した。Source、旧Evidence、義務、Authority、Scopeと実操作は変更せず、全体QA、E2EまたはReleaseをPassへ昇格していない。

## Checklist

- [x] 変更経路、対象六file、保持条件と直接利用側を着手前に照合した。
- [x] 独立確認済みの一項目だけを現在品質へ適用した。
- [x] 旧集計と現在OPEN、移管一覧と採用Scopeを分離した。
- [x] Host方式の判断待ち、実操作別承認と新実Task停止を保持した。
- [x] 固定差分の機械確認と三観点独立確認を完了し、QP-D01の解消と限定Passを記録した。全体QA成立とは区別した。
- [ ] OPEN: 現在の全体件数と領域別内訳は、一意Local Itemごとの根拠適用を再照合後に固定する。
- [ ] OPEN: `AIT-UAT-006`と採用Scopeの対応はQual-Labが最終Quality／Scope Gateまでに照合する。
