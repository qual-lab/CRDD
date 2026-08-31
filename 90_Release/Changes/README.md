# 未リリース変更トレース統合台帳

この台帳は、v0.18.0未リリース候補44件を、利用者にとって独立した変更意図、人間による採否、外部への移行、リリース時の処置という観点で整理し、正本となる変更記録（Canonical CHG）7件へまとめた記録である。台帳の役割は、旧IDから統合先の変更記録と当時の本文をたどることに限られる。現在の意味と状態は各変更記録が持ち、本台帳や旧IDを現在状態の第二の正本としては扱わない。

## まず読む場所

- v0.18.0 Candidateで現在何が変わるかを確認する場合は、次のCanonical CHG一覧から対象を読む。
- 統合済みの旧CHG IDがどこへ移ったかを確認する場合は、[統合済み旧ID](#統合済み旧id)を読む。旧本文そのものが必要な場合だけ、各entryの固定Commitから`git show`で復元する。
- SHA-256、固定byte、tag、旧Path等の機械検証情報は、通常利用者向け説明ではなく履歴Trustの検証入力である。現在のCapability、AuthorityまたはRelease状態をそこから推定しない。

この順序は履歴情報を削らず、現在状態、過去判断、機械検証の詳細を段階的に表示するための入口である。

<!-- crdd-change-trace-ledger-schema: 1 -->

本台帳の各`consolidated-chg-*`節と、後述する公開tag固定表・不変歴史参照表はSchema Revision 1の機械所有領域である。機械所有領域のfield欠落、重複、未知field、集合の過不足または順序違反は判定不能としてFail Closedにする。導入説明、既知制約およびCanonicalへの案内は人間可読領域であり、機械所有fieldとして解釈しない。

- 統合日: 2026-08-26
- 統合直前Commit: `718d8fbfebae29e5345b81bc61385a30950831b3`
- 統合直前Tree: `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`
- 公開済み固定履歴: `CHG-000001`～`CHG-000011`の11件。公開tag到達性を実体で確認し、状態表示にかかわらず統合対象外
- 公式公開tag固定集合: 28件
- 不変・非active歴史参照固定集合: 15 pair、15 source、4 target
- 統合前の未リリースCHG: `CHG-000012`～`CHG-000055`の44件
- 統合後: Canonical CHG 7件、統合済み旧ID 37件

| Canonical CHG | 題名 |
| --- | --- |
| [CHG-000012](CHG-000012_Current_Decision_Set.md) | 現在の判断集合と判断支援 |
| [CHG-000013](CHG-000013_Communication_Market_and_Adoption_Exploration.md) | 外部コミュニケーションの市場・採用探索 |
| [CHG-000014](CHG-000014_V018_Architecture_Candidate_Integration.md) | v0.18候補の統合とアーキテクチャ再基準化 |
| [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md) | Coordinator Runtime 1.0 |
| [CHG-000017](CHG-000017_Tools_Coding_Standards.md) | 内部ツールの開発規約と命名 |
| [CHG-000054](CHG-000054_Agent_Organization_Document_Architecture.md) | エージェント組織の文書構成 |
| [CHG-000055](CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md) | 長期発展方針と工程・文書の自己適用改善 |

### 公開済みの変更を調べる

以下は過去の判断を読むための案内であり、現在状態の一覧ではない。公開済み本文の内容・状態は変更しない。

- [人間判断提示・監査指摘統合](CHG-000001_Human_Decision_Presentation.md)
- [GitHubアンカーチェッカー互換性修正](CHG-000002_GitHub_Anchor_Checker_Correction.md)
- [初回レビュー・監査の網羅性](CHG-000003_First_Pass_Review_Audit_Completeness.md)
- [Checkerの階層構造互換性](CHG-000004_Checker_Hierarchical_Compatibility.md)
- [gitlinkサブモジュール検証](CHG-000005_Gitlink_Submodule_Verification.md)
- [着手前整合確認](CHG-000006_Pre_Execution_Alignment_Check.md)
- [複数箇所の是正適用](CHG-000007_Multi_Location_Remediation.md)
- [収束する是正と根拠同一性](CHG-000008_Convergent_Remediation_and_Evidence_Identity.md)
- [外部コミュニケーションとコンテキスト依存](CHG-000009_Communication_and_Context_Dependency.md)
- [初回固定候補の収束性](CHG-000010_First_Pass_Convergence.md)
- [専門探索・収束と外部情報境界](CHG-000011_Expert_Exploration_and_Convergence.md)

### 統合情報の読み方

- Canonical CHG: `CHG-000012`、`CHG-000013`、`CHG-000014`、`CHG-000015`、`CHG-000017`、`CHG-000054`、`CHG-000055`
- 旧ID: 永久欠番。再利用、別意味への割当または存在しなかったものとしての扱いを禁止
- 取得方法: `git --no-replace-objects show 718d8fbfebae29e5345b81bc61385a30950831b3:<旧Path>`

公開tagへ到達するCHG、公開済みv0.17.0、過去CHANGELOGおよび固定Evidenceの判定・byte・filenameは変更していない。旧CHG本文はGit固定改訂版と原文SHA-256からbyte単位で再構成できる。Canonical集合は7件、統合済み旧IDは37件であり、互換stubは持たない。

固定Evidenceに残る15件の旧Path表記は、標準Markdown上で解決済みのlinkではなく、**不変・非active歴史参照（Immutable Non-active Historical Reference）**である。GitHub、IDEおよび一般Markdown readerでは直接clickできない。現在状態はCanonical CHGを読み、旧本文が必要な場合だけ上記`git show`で復元する。Checkerは通常link件数へ含めず、統合直前Commit、HEAD、worktree、台帳entryおよび次のexact pairがすべて一致する場合だけ復元可能性を独立検証する。情報不足、不一致またはpairの過不足はFail Closedにする。

## 公式公開tag固定集合

公式Release tagは`v<major>.<minor>.<patch>`または`v<major>.<minor>.<patch>-p<patch>`の名前空間を使用する。次の28件は台帳導入前の履歴Trust subsetであり、各tagの欠落、移動、型変更およびIdentity差をFail Closedにする。この集合を「現在存在する公式tagの全件」またはCanonical CHGのRelease状態として解釈しない。新しい公式tagは確認済みRelease Identityに対する後続Effectとして追加でき、そのtag自身を同じtagged Commitへ自己参照的に追記しない。追加tagは公開済み`CHG-000001`～`CHG-000011`のpositive evidenceへ流用せず、37件の統合済み旧Pathへ到達しないことだけをnegative scanする。作成後のRelease状態は次の独立変更または外部post-release Evidenceが所有する。非公式名のlocal tagは履歴Trust subsetと公開判定へ含めないが、検査開始・終了間のtag集合変化は名前にかかわらず拒否する。Ref Object Typeはannotated tagの`tag`とlightweight tagの`commit`を区別する。

| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |
|---|---|---|---|---|
| `v0.1.0` | `tag` | `d7c44917849fa2b85d5b854017b3124e3611a0bc` | `e4c5b57055bf44f052e14695c6f08c252fc4cd17` | `b51a5ec6b96ad9f022d0c26592fab0c8fc76651a` |
| `v0.2.0` | `tag` | `1ea5e4765edd758fc1aceb8aa404b4d44ccb3388` | `37bd82cd3a015928ac636e3e7354cea2785c17de` | `f6481fece925c0bff01af674387a1772d647587f` |
| `v0.3.0` | `tag` | `6169aa8f5feba440f93e09e1e5e9e45032095dac` | `dba19922498fec5cf9640b89a99672f4c61c291e` | `079ec28624b6b24a927ae48e57cee0d16414250b` |
| `v0.4.0` | `tag` | `2af579bdf3d10ca12d3811377c3cb62d14cb943c` | `18b58f737354662e7896ebcdb1646beab5d0e423` | `fccdf25c3cc345786146f7bd76ef060360b8d049` |
| `v0.4.1` | `tag` | `77c84d0d4cc1e1a232dcb1d107da1289d1149d07` | `9fe9934e81d317e08ccce233400f9593ed057236` | `42cfdf056a4802326dbb0de543bebc79a665be9f` |
| `v0.4.2` | `tag` | `5e1ba14a0e4e9562cb03f0920aeb02006c03b8d3` | `a8d20b5ef91e188ee5cf828a174bf9c726140fe2` | `bc3135226fab9d286ea5edfc02c6b9f1bd7981b2` |
| `v0.5.0` | `tag` | `81f5e27eed09e8c11b8a88a1af12df14e95f62a2` | `3ea0a8133ac38479f341acf6eff8c442df92fb6e` | `44994eb7ad9ee27c83e9b6674d9182009bf77671` |
| `v0.5.1` | `tag` | `7b282b10940415e3c8b8fc9e1bd882710bc65a0b` | `98957811c35e756cb5aeb881504813846bd6dc02` | `7dd6c6528418276c355a8e7a6af0671fbce37dc5` |
| `v0.5.1-p1` | `tag` | `e2f70cb49af0b27460828f1820a9ea26579a7897` | `d4b1b935373ddea2d6b45680f014db80d19622ce` | `2fc7138b3780b64afbe998ad3b1b3c87c318031a` |
| `v0.6.0` | `tag` | `7db449b502d8262b797ce85c909518fd1b22494f` | `911c4ae514eef683cdffa2074fa6679c0aadafd2` | `449944b09d59ef20c0a240f63d266a5c975c319c` |
| `v0.6.0-p1` | `tag` | `1a59af0b7f7d4e1c6fa2f27da47e5320dc13dcfe` | `d0d57debf3f75ed404d7d5425d98e173c561797d` | `8cbbab7b050ca72e51fcfbeb1108af80d64e08bc` |
| `v0.6.1` | `tag` | `4bd14f62af84e9f3e88d027d6427ae26ac0fa96c` | `ba72a1de0917cc3a30afceee89151d28f098ded1` | `fde345d0052117cc74e30789bcd4890f4be642e7` |
| `v0.6.2` | `tag` | `1cd6919f627600a7b1831653fddabc78cecccb6f` | `4d2b1eebb287d312b7958ee8ba9c1d9730ca6537` | `43dfeb7a39c8b675a742065e344b7cb4b34787e1` |
| `v0.7.0` | `tag` | `f10c6def7b6862f150687cb6e484f5d57de4a07b` | `9fcd1f5426778b59367a7e50c3a42bfc2726179a` | `ac87f4fad2e4babba388e6395e22c417648f659d` |
| `v0.8.0` | `tag` | `2efe39c3d2fe698cf209b958c41a056e9fe54357` | `eb233339b994894321a3b9b9cca8558f8f35b451` | `8f16c8738b0fa3a44f133cbe3393c17296fd0417` |
| `v0.9.0` | `tag` | `8c98e225df5a436e9541fb2d23c5b5c6134cbc52` | `1f33e435f5a8d00dcbdf8998f2e1d731c036240d` | `ee9b67af3417336c8448799ae34fbf76703e4e69` |
| `v0.10.0` | `tag` | `9b7311e41d901cfa6aecfd79a5e3e6b9129fdbaa` | `b170f3a7f7a17a1fa5ef0678a50fe257aee3a842` | `30b44686e0beb6f1006866e4f8e3c066b5a29b8b` |
| `v0.11.0` | `tag` | `f1b20c0bbd396bf18b91c3d431c9cd677f5e02c9` | `a6c85bd3762b26c6d54cdc4c943b8c13c3c53853` | `79f54b821448aa54f38c32d22914242c435679d2` |
| `v0.11.1` | `tag` | `a3c893089fac999552a8c1b85e0546785e7cdb65` | `075de718262b058f81d1de3bb966bce7e1783ced` | `a7187abfe498eb5c1e569d8436815dfa4bec8e64` |
| `v0.11.2` | `tag` | `9546299dd527c991bcbc657af84e49dec4be2b0f` | `428956d9521179596c04b2e03e00632f46ea311a` | `b05e9757ef173c3f8a7348889205a7f1b4969a42` |
| `v0.11.3` | `tag` | `3f9506bcaee47614104817ecccf032e90de32287` | `586fbfebdbb4708489c43428d9e984d722b4204b` | `aa1fc74c18325c20f77c40b8269606ba56684b76` |
| `v0.11.4` | `tag` | `12776997bc4e24f6ee291626624b5494aae85853` | `fc16bf20016a204ad1a9802cc68081f56617cab1` | `9f55f9d7ae31b39f4afc4e99d7327796bbb007dc` |
| `v0.12.0` | `tag` | `bcd67e96cbbb14188772a91d096c6e0944f2fe59` | `ac11bf1cdda9e824a80b4211a21161aedb5796f7` | `44074cc2182b38bf9c89c434f24da4078d035894` |
| `v0.13.0` | `tag` | `16b593ab4bfdb9c853d91d49064bb4e562ddedf3` | `f5141430ba34c416e644a06dee171edc4cee6368` | `b17b6368bfdb05996aff3ec936d7df9abe5688ca` |
| `v0.14.0` | `tag` | `0773179fb2670b980ed80a9962cd1ba4433e4311` | `133e27843ffb4686d31d3bb59d8f0fbf2a692aa9` | `71cef2b9ebe48bbfaaf7663ef9bd1b5ccdcb85fe` |
| `v0.15.0` | `tag` | `d48cdd7d9f5b07f7171e8c57d3471aa43b0b8470` | `caab4aec6c5f3bc4d9b39bc4f18ed67cf121db18` | `f0bbb2df3ccf3f8d2eebb5488e42dccf612ee968` |
| `v0.16.0` | `tag` | `a4abf20045fcc63ef5e62e472b160cd50eafda93` | `f46b81cd66e059d5d55b4de0369869298160c2c4` | `f31ea6c3f2f31c07f83db0b526520177cf078e51` |
| `v0.17.0` | `tag` | `20542fe63c8c2cf18d1238eef0d9c44d5006dda2` | `6e61a5a5b6a820e4920994ba3d57dfa746360034` | `30cef5976d78fe748a9830f77cde8159ebd8ab76` |

## 不変・非active歴史参照固定集合

| Source Evidence | Target Old Path |
|---|---|
| `90_Release/Changes/Evidence/CHG-000035_Current_Review_Record_7da5b6c.md` | `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md` |
| `90_Release/Changes/Evidence/CHG-000036_Authenticode_Trust_Minimization_20260824.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_062294bb.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_0de33481.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_0ef4f73b.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_216afd45.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_2a671485.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_2ce29c02.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_38f6a310.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_76b90bcc.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_87c35af6.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_current.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000036_Verification_Run_Record_f5f25179.md` | `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md` |
| `90_Release/Changes/Evidence/CHG-000037_Claude_No_Network_Version_Probe_20260824.md` | `90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md` |
| `90_Release/Changes/Evidence/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice_20260824.md` | `90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md` |

## 公開済み固定履歴

公開tag到達性と統合直前の現行byteを分けて固定する。公開tagに初めて含まれた後、Release処置や後続記録が同じCHGへ加わった履歴があるため、過去tagのbyteと現行byteの単純一致は要求しない。本台帳以後は次の固定原文Identityを変更せず、不足または回帰は新しいCHGで扱う。

今回、人間が承認した後追加の「現在の移設先」13案内だけは、[CHG-000017の限定移行記録](CHG-000017_Tools_Coding_Standards.md#released-navigation-migration)に従い、新配置へ追従させる。固定Commit・byte数・SHA-256は下表に保持し、固定原文へ当該Markdown案内リンクだけを置換した期待内容と現在の全文を照合する。当時のコマンド、実行事実、判断、検証結果、周辺説明またはその他の本文変更は許可しない。記録のない文書は従来どおり固定原文との完全一致を求め、この13案内を不変・非active歴史参照へ算入しない。

| CHG | Path | 固定Commit | byte | SHA-256 |
|---|---|---|---:|---|
| `CHG-000001` | `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 7373 | `f569968819724d5765bec1d4cf4a3b10a11641082bd6e5c5878a2e5a054e6833` |
| `CHG-000002` | `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 8378 | `851bee26bdbb7c292b591ca5a87e8e9aaeed9c261776e34eba1cd03fbb84b1d3` |
| `CHG-000003` | `90_Release/Changes/CHG-000003_First_Pass_Review_Audit_Completeness.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 6758 | `ca6456a667e99951bd2ddf0c774ff9f2b7127d0d161ab631ffcd74933e80a450` |
| `CHG-000004` | `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 5664 | `3ce1df556590c7ef204eb8da2fd75232807b0030f7edd2089d905cbe97e55618` |
| `CHG-000005` | `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 8600 | `3339466c6810774effdf40900c141087366097f3ec7fde24789b97ea2ac23af3` |
| `CHG-000006` | `90_Release/Changes/CHG-000006_Pre_Execution_Alignment_Check.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 10022 | `0ac716ab301840e58a0a80d542db443cbad9aa453af864f884f63270789757ca` |
| `CHG-000007` | `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 18418 | `c3eb4344ff1ce7f372ef3e5c1a10cf4b8bede37183c5271cee8f60ba05026164` |
| `CHG-000008` | `90_Release/Changes/CHG-000008_Convergent_Remediation_and_Evidence_Identity.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 9038 | `82036eb74bf92628a4ad5ad8c964889c367aba05669ecca496748c5e8c983548` |
| `CHG-000009` | `90_Release/Changes/CHG-000009_Communication_and_Context_Dependency.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 12985 | `5d403c9145255c0a06702539ef3b20b0666b19ed338b28e2a2de3e03a378b078` |
| `CHG-000010` | `90_Release/Changes/CHG-000010_First_Pass_Convergence.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 15092 | `1af36f2eccd4fe6ca5c75c9b9f385dad0d40602b009f42a706fb97db95892686` |
| `CHG-000011` | `90_Release/Changes/CHG-000011_Expert_Exploration_and_Convergence.md` | `718d8fbfebae29e5345b81bc61385a30950831b3` | 19839 | `057820d95f85973fd7fc0a5b2a7a7f21c565722833cb3444677ada85c47c17ee` |

## 統合済み旧ID

<a id="consolidated-chg-000018"></a>

### CHG-000018 → CHG-000017

- 旧題名: 変更トレース: Biome診断の全解消とWarning再発防止
- 旧Path: `90_Release/Changes/CHG-000018_Biome_Advisory_Closure.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-16
- 変更分類: `non-breaking`
- 移行／Release境界: `migration_required: false`
- Canonical CHG: [CHG-000017](CHG-000017_Tools_Coding_Standards.md)
- 統合理由: TypeScript完全移行で導入したBiome品質Baselineの完了条件
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、5411 byte、SHA-256 `3fc1d4ae0cc808a0cca1fe0dd881868aa22fe8b45d4d357e099a090628da849e`
- 関連Evidence: [CHG-000018_Agent_Security_Review_1ce8ced.md](Evidence/CHG-000018_Agent_Security_Review_1ce8ced.md)、[CHG-000018_Current_Review_Record_1ce8ced.md](Evidence/CHG-000018_Current_Review_Record_1ce8ced.md)、[CHG-000018_Document_Audit_1ce8ced.md](Evidence/CHG-000018_Document_Audit_1ce8ced.md)、[CHG-000018_Gap_Conformance_Audit_1ce8ced.md](Evidence/CHG-000018_Gap_Conformance_Audit_1ce8ced.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000020"></a>

### CHG-000020 → CHG-000015

- 旧題名: 変更トレース: Rust成果物の署名済みRelease結合
- 旧Path: `90_Release/Changes/CHG-000020_Platform_Access_Release_Binding.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-17
- 変更分類: `breaking`
- 移行／Release境界: `migration_required: true`（CRDD公式RepositoryのRelease build／stagingだけ。採用Repositoryと公開CLIは対象外）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Windows保護Runtimeにおける署名済みRust成果物とRelease Identityの結合
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、30644 byte、SHA-256 `f7232495e8b561b7d2e17b546cae9fe8d4c8f7260fddc936ad9107c2af3f8ad8`
- 関連Evidence: [CHG-000020_Agent_Security_Review_6690d34.md](Evidence/CHG-000020_Agent_Security_Review_6690d34.md)、[CHG-000020_Current_Review_Record_6690d34.md](Evidence/CHG-000020_Current_Review_Record_6690d34.md)、[CHG-000020_Document_Audit_6690d34.md](Evidence/CHG-000020_Document_Audit_6690d34.md)、[CHG-000020_Gap_Conformance_Audit_6690d34.md](Evidence/CHG-000020_Gap_Conformance_Audit_6690d34.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000024"></a>

### CHG-000024 → CHG-000015

- 旧題名: 変更トレース: 動的Fake Provider失敗検証（Dynamic Fake Provider Failure Verification）
- 旧Path: `90_Release/Changes/CHG-000024_Dynamic_Fake_Provider_Failure_Verification.md`
- 統合前判断: 状態 `Ready for Verification`、判断／更新日 2026-08-19
- 変更分類: `breaking`（privateなFake failure reasonとcoverage母集団を固定し、旧generic failure表示を互換受理しない）
- 移行／Release境界: `migration_required: true`（Repository内実装、試験、package commandおよび説明を同時更新する。supported production consumer／Provider stateは0で永続変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 動的Fake Provider Lifecycleの失敗経路検証
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、9663 byte、SHA-256 `e999b882425869b5391ceca6c4fedf98ea420230663f42a46dde8fce3e40c59a`
- 関連Evidence: [CHG-000024_Docker_Failure_E2E_967f1b6.md](Evidence/CHG-000024_Docker_Failure_E2E_967f1b6.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000025"></a>

### CHG-000025 → CHG-000015

- 旧題名: 変更トレース: 動的Fake Provider取消検証（Dynamic Fake Provider Cancellation Verification）
- 旧Path: `90_Release/Changes/CHG-000025_Dynamic_Fake_Provider_Cancellation_Verification.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-19
- 変更分類: `breaking`（privateな取消観測契約とcoverage母集団を追加し、通常診断や実Provider取消との互換推定を認めない）
- 移行／Release境界: `migration_required: true`（Repository内実装、試験、package commandおよび現在説明を同時更新する。supported production consumer／Provider stateは0で永続変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 動的Fake Provider Lifecycleの取消・cleanup検証
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、15760 byte、SHA-256 `ce0a7482b8eb2a9c325b97ec18471853dca947e4a415a6bde57a3a16f70e183a`
- 関連Evidence: [CHG-000025_Agent_Security_Review_1c874af.md](Evidence/CHG-000025_Agent_Security_Review_1c874af.md)、[CHG-000025_Current_Review_Record_1c874af.md](Evidence/CHG-000025_Current_Review_Record_1c874af.md)、[CHG-000025_Docker_Cancellation_E2E_9c013ce.md](Evidence/CHG-000025_Docker_Cancellation_E2E_9c013ce.md)、[CHG-000025_Docker_Cancellation_E2E_bf3b37a.md](Evidence/CHG-000025_Docker_Cancellation_E2E_bf3b37a.md)、[CHG-000025_Document_Audit_1c874af.md](Evidence/CHG-000025_Document_Audit_1c874af.md)、[CHG-000025_Gap_Conformance_Audit_1c874af.md](Evidence/CHG-000025_Gap_Conformance_Audit_1c874af.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000026"></a>

### CHG-000026 → CHG-000015

- 旧題名: 変更トレース: 専用Provider Home保護基盤（Dedicated Provider Home Protection Foundation）
- 旧Path: `90_Release/Changes/CHG-000026_Provider_Home_Protection_Foundation.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-19
- 変更分類: `breaking`（private Provider lifecycle revision 2から3、private doctor `reportVersion` 4から5）
- 移行／Release境界: `migration_required: true`（Repository内producerとcontract testを同時更新し、旧revisionのalias／fallbackを設けない。supported production Provider Home stateは0で永続state変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 選択Local User／Provider単位の専用Provider Home保護
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、16289 byte、SHA-256 `a95e2886ad4d398c627ada0ebf5a89d4067f1fbccfd9fb343e3db42d4bad78f6`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000028"></a>

### CHG-000028 → CHG-000015

- 旧題名: 変更トレース: Claude実行計画基盤（Claude Execution Plan Foundation）
- 旧Path: `90_Release/Changes/CHG-000028_Claude_Execution_Plan_Foundation.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-22
- 変更分類: `breaking`（privateなProvider実行計画をClaude Codeへ先行限定し、任意CLI、任意prompt、Host CLI fallbackおよびAPI課金経路を受理しない）
- 移行／Release境界: `migration_required: true`（新規contract、試験、package command、TypeScript projectとCheckerの固定source母集団、READMEおよび脅威モデルを同時追加する。supported production consumer、認証sessionおよび実Provider stateは0で、永続変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Claude Subscription OAuth Vertical Sliceの実行計画基盤
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、14891 byte、SHA-256 `dfe0fb2ae6acc9a88864d0f4f5e8898ac64282a9c373689a0e4dd01d34a49723`
- 関連Evidence: [CHG-000028_Agent_Security_Review_01a92ba.md](Evidence/CHG-000028_Agent_Security_Review_01a92ba.md)、[CHG-000028_Current_Review_Record_01a92ba.md](Evidence/CHG-000028_Current_Review_Record_01a92ba.md)、[CHG-000028_Document_Audit_01a92ba.md](Evidence/CHG-000028_Document_Audit_01a92ba.md)、[CHG-000028_Gap_Conformance_Audit_01a92ba.md](Evidence/CHG-000028_Gap_Conformance_Audit_01a92ba.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000029"></a>

### CHG-000029 → CHG-000015

- 旧題名: 変更トレース: Provider Homeマウント許可ライフサイクル基盤（Provider Home Mount Grant Lifecycle Foundation）
- 旧Path: `90_Release/Changes/CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md`
- 統合前判断: 状態 `Verified`、判断／更新日 2026-08-22
- 変更分類: `breaking`（privateなProvider Home contractをrevision 2、Provider Lifecycle contractをrevision 5、doctor reportをversion 6へ更新し、Mount Grantの構造・状態・遷移・使用候補を固定する）
- 移行／Release境界: `migration_required: true`（新しい内部contractと試験を追加し、説明contract、doctor producer／exact test／README、固定source母集団を同時更新する。doctor version 5以前のalias／fallbackは設けない。supported production consumer、発行済みGrant、永続stateおよび実mountは0で、永続変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Provider Home Mount Grantの構造・状態・使用候補
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、13784 byte、SHA-256 `397ea47aeda00fbf281ee4dfb2de7a301984cdbab67f75331dcc415e2ccecab7`
- 関連Evidence: [CHG-000029_Agent_Security_Review_7e2a0f2.md](Evidence/CHG-000029_Agent_Security_Review_7e2a0f2.md)、[CHG-000029_Current_Review_Record_7e2a0f2.md](Evidence/CHG-000029_Current_Review_Record_7e2a0f2.md)、[CHG-000029_Document_Audit_7e2a0f2.md](Evidence/CHG-000029_Document_Audit_7e2a0f2.md)、[CHG-000029_Gap_Conformance_Audit_7e2a0f2.md](Evidence/CHG-000029_Gap_Conformance_Audit_7e2a0f2.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000030"></a>

### CHG-000030 → CHG-000015

- 旧題名: 変更トレース: Provider Homeマウント許可Runtime Store（Provider Home Mount Grant Runtime Store）
- 旧Path: `90_Release/Changes/CHG-000030_Provider_Home_Mount_Grant_Runtime_Store.md`
- 統合前判断: 状態 `Close without Release`、判断／更新日 2026-08-22
- 変更分類: `non-breaking`（未接続moduleの候補追加を評価し、不採用として現在成果物から除去した）
- 移行／Release境界: `migration_required: false`（production consumer、発行済みGrant、永続state、実mountおよび公開Schema変更は0）。この分岐のRelease処置は `Close without Release`
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 同じMount Grant Lifecycle内で棄却・撤去した先行Runtime Store分岐
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、5218 byte、SHA-256 `0a59fb6c549ec213fa21d7a2b0b2d79483a49261305182f0564b1889846cee55`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 棄却境界: 先行Store候補はAuthority provenance、Runtime所有clock、record／Filesystem Identity、失敗時Effectおよびalias／revoke ownershipを安全に固定できず、成果物と試験を現行Treeから撤去した。後続実装はこの方式の採用またはReleaseではない
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000031"></a>

### CHG-000031 → CHG-000015

- 旧題名: 変更トレース: Runtime所有Operation Context Capability（Runtime-owned Operation Context Capability）
- 旧Path: `90_Release/Changes/CHG-000031_Runtime_Owned_Operation_Context_Capability.md`
- 統合前判断: 状態 `In Review`、判断／更新日 2026-08-23
- 変更分類: `non-breaking`（新しいcontext／management APIを追加し、既存のprivate mount CapabilityとDocker隔離の回復遷移をfail-closedに強化する）
- 移行／Release境界: `migration_required: false`（公開Schema、永続形式、実mountおよびProvider process出力は変更しない。新しいcontext／management APIのproduction consumerは0だが、既存mount Capabilityのproduction consumerである`docker-isolation.ts`は直接影響を受ける）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime所有Operation Contextと管理Capabilityへの移行
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、22573 byte、SHA-256 `37c1dd451dd64222da2e0eaae8c956c48432b05aae933c40773e167573f7514f`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000032"></a>

### CHG-000032 → CHG-000015

- 旧題名: 変更トレース: 現在プロセス主体観測（Current Process Principal Observation）
- 旧Path: `90_Release/Changes/CHG-000032_Current_Process_Principal_Observation.md`
- 統合前判断: 状態 `In Review`、判断／更新日 2026-08-23
- 変更分類: `breaking`（private Rust wire protocolをrevision 2から3へ更新し、旧revisionのalias／fallbackを設けない）
- 移行／Release境界: `migration_required: true`（署名manifestのRust成果物Identityとprotocol revision、TypeScript decoderおよびRepository内fixtureを同時更新する。supported production active generationは0で、端末state変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: selected-user bindingに必要な現在Process主体観測
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、17022 byte、SHA-256 `7b65b961d40a95a8797f8b4ec18da601b465a1bf73615e9e573934da0fd16897`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000033"></a>

### CHG-000033 → CHG-000015

- 旧題名: 変更トレース: 有効化前準備一回実行契約（Pre-active Provisioning One-shot Contract）
- 旧Path: `90_Release/Changes/CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md`
- 統合前判断: 状態 `In Review`、判断／更新日 2026-08-23
- 変更分類: `breaking`（private Platform Provisioner Effect result／descriptor、Runtime Activation説明／recordおよびdoctor reportのSchemaを同時更新する）
- 移行／Release境界: `migration_required: true`（Effect contract revision 1→2、Runtime Activation revision 1→2、doctor report version 6→7、CLI result reason／keyおよびRepository内exact consumerを同時移行し、旧revision／versionのaliasまたはfallbackを設けない。supported production decoder、発行済みactivation record、永続stateおよび実Effectは0なので永続変換はない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Windows保護Runtimeの有効化前準備一回実行契約
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、15747 byte、SHA-256 `5ebd4e70c5eb3a87e81706fb0cab90e134adb4f8fdf58723d4e2f0ebc470c6c2`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000034"></a>

### CHG-000034 → CHG-000015

- 旧題名: 変更トレース: ネイティブ直接準備入口（Native Direct Provision Supervisor Entrypoint）
- 旧Path: `90_Release/Changes/CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md`
- 統合前判断: 状態 `In Review`、判断／更新日 2026-08-23
- 変更分類: `breaking`
- 移行／Release境界: `migration_required: true`（one-shot 1→2、Effect 2→3、Runtime Activation 2→3、doctor 7→8、package manifest 1→2、package filesystem descriptor 1→2、Release Identity descriptor 1→2、Release staging manifest descriptorの旧unversioned shape→2、署名結果 1相当→2。旧revision／versionのaliasまたはfallbackなし。supported production decoder、発行済みrecord、installed stateおよび実Effectは0なので永続変換なし）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Shell／Node依存を除いたNative Supervisor入口
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、12734 byte、SHA-256 `a3400a0088c353aa02c8fd26b4f6363cf5d6bdcfad1d0802ddf52e6b226aaded`
- 関連Evidence: [CHG-000034_Verification_Run_Record_c411738.md](Evidence/CHG-000034_Verification_Run_Record_c411738.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000035"></a>

### CHG-000035 → CHG-000015

- 旧題名: 変更トレース: ネイティブ準備入口の依存縮退（Native Provision Bootstrap Dependency Reduction）
- 旧Path: `90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md`
- 統合前判断: 状態 `In Review`、判断／更新日 2026-08-23
- 変更分類: `breaking`
- 移行／Release境界: `migration_required: true`（native entrypoint contract revision 1→2。manifest revision 2、V2署名domain、native result contract revision 1、one-shot revision 2、Effect revision 3、Runtime Activation revision 3およびdoctor version 8は維持する。旧entrypoint revision 1を署名済みmanifestごと拒否し、aliasまたはfallbackを設けない。発行済みproduction manifest、installed state、観測、Authority、CapabilityおよびEffectは0なので永続変換なし）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Native provision bootstrap依存の縮退
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、10095 byte、SHA-256 `d10f8b752f335c3f570930737b93f3dd1890f3520b3a8269c7ac7d289eef5774`
- 関連Evidence: [CHG-000035_Current_Review_Record_7da5b6c.md](Evidence/CHG-000035_Current_Review_Record_7da5b6c.md)、[CHG-000035_Verification_Run_Record_1d7bac2.md](Evidence/CHG-000035_Verification_Run_Record_1d7bac2.md)、[CHG-000035_Verification_Run_Record_f678428.md](Evidence/CHG-000035_Verification_Run_Record_f678428.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000036"></a>

### CHG-000036 → CHG-000015

- 旧題名: 変更トレース: AppContainer準備Worker候補（AppContainer Provision Worker Candidate）
- 旧Path: `90_Release/Changes/CHG-000036_AppContainer_Provision_Worker_Candidate.md`
- 統合前判断: 状態 `In Progress`、判断／更新日 2026-08-23
- 変更分類: `breaking`
- 移行／Release境界: `migration_required: true`（entrypoint contract revision 2、native result contract revision 2およびPA03／PR03は維持する。有効化前準備一回実行revision 3→5、Platform Provisioner Effect revision 4→5、Platform Access Adapter revision 2→3、private doctor reportVersion 9→11へ上げ、Runtime Activation revision 4は入れ子契約自身のrevisionで追跡する。旧revisionへのalias／fallbackは設けず、発行済みproduction stateは0なので永続変換なし。旧`SUPERVISOR_IMAGE_BLOCKED` reasonは過去結果として保持するが現sourceから発行しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: AppContainer Worker、Job／mitigation、OS EffectおよびHost復元
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、28501 byte、SHA-256 `c6040dac38a1c7745698ff8ef27f323b5637aecebc4612075c3ee0343ae540d5`
- 関連Evidence: [CHG-000036_Authenticode_Trust_Minimization_20260824.md](Evidence/CHG-000036_Authenticode_Trust_Minimization_20260824.md)、[CHG-000036_Verification_Run_Record_062294bb.md](Evidence/CHG-000036_Verification_Run_Record_062294bb.md)、[CHG-000036_Verification_Run_Record_0de33481.md](Evidence/CHG-000036_Verification_Run_Record_0de33481.md)、[CHG-000036_Verification_Run_Record_0ef4f73b.md](Evidence/CHG-000036_Verification_Run_Record_0ef4f73b.md)、[CHG-000036_Verification_Run_Record_216afd45.md](Evidence/CHG-000036_Verification_Run_Record_216afd45.md)、[CHG-000036_Verification_Run_Record_2a671485.md](Evidence/CHG-000036_Verification_Run_Record_2a671485.md)、[CHG-000036_Verification_Run_Record_2ce29c02.md](Evidence/CHG-000036_Verification_Run_Record_2ce29c02.md)、[CHG-000036_Verification_Run_Record_38f6a310.md](Evidence/CHG-000036_Verification_Run_Record_38f6a310.md)、[CHG-000036_Verification_Run_Record_76b90bcc.md](Evidence/CHG-000036_Verification_Run_Record_76b90bcc.md)、[CHG-000036_Verification_Run_Record_87c35af6.md](Evidence/CHG-000036_Verification_Run_Record_87c35af6.md)、[CHG-000036_Verification_Run_Record_current.md](Evidence/CHG-000036_Verification_Run_Record_current.md)、[CHG-000036_Verification_Run_Record_f5f25179.md](Evidence/CHG-000036_Verification_Run_Record_f5f25179.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000037"></a>

### CHG-000037 → CHG-000015

- 旧題名: 変更トレース: Claude無通信Version Probe（Claude No-Network Version Probe）
- 旧Path: `90_Release/Changes/CHG-000037_Claude_No_Network_Version_Probe.md`
- 統合前判断: 状態 `In Progress`、判断／更新日 2026-08-24
- 変更分類: `breaking`（private Claude Execution Plan revision 2→3。実Provider requestは有効化しない）
- 移行／Release境界: `migration_required: true`（発行済みProvider state、OAuth session、Mount Grantおよびproduction consumerは0。旧revisionへのalias／fallbackは設けず永続変換なし）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Claude固定配布物の無通信Version Probe
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、5929 byte、SHA-256 `81db56e5613b97ad7583d800b95985dd282edbaa5f65cf78bc6a1615ed0acf23`
- 関連Evidence: [CHG-000037_Claude_No_Network_Version_Probe_20260824.md](Evidence/CHG-000037_Claude_No_Network_Version_Probe_20260824.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000039"></a>

### CHG-000039 → CHG-000015

- 旧題名: 変更トレース: Runtime所有Provider Home観測（Runtime-owned Provider Home Observation）
- 旧Path: `90_Release/Changes/CHG-000039_Runtime_Owned_Provider_Home_Observation.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-24
- 変更分類: `breaking`（private Provider Home契約revision 2から3、別Provider Home wire revision 1を追加）
- 移行／Release境界: `migration_required: true`（Repository内producer／consumerを同時更新し、旧wireへのalias／fallbackを設けない。発行済み観測Capabilityとproduction Mount Grantは0）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime所有のProvider Home保護観測
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、8281 byte、SHA-256 `c28121dcbeb2e0a333b86048be0f92f6a556824ced5460b8eeee60248dabfbb3`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000040"></a>

### CHG-000040 → CHG-000015

- 旧題名: 変更トレース: Runtime所有Provider Homeマウント許可（Runtime-owned Provider Home Mount Grant）
- 旧Path: `90_Release/Changes/CHG-000040_Runtime_Owned_Provider_Home_Mount_Grant.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-24
- 変更分類: `breaking`（private Provider Home契約revision 3から4、Mount Grant Runtime契約revision 1を追加）
- 移行／Release境界: `migration_required: true`（Repository内producer／consumerを同時更新し、旧revisionへのalias／fallbackを設けない。発行済みproduction Grantは0）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime所有Mount Grantのissue／consume／revoke
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、7577 byte、SHA-256 `2cf28ecedd2c6e9620d515269d4ca160f050fee7b7d52846400dd9d4f28b6cca`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000041"></a>

### CHG-000041 → CHG-000015

- 旧題名: 変更トレース: 説明可能なモデル選定とClaude Docker Adapter候補
- 旧Path: `90_Release/Changes/CHG-000041_Explainable_Model_Selection_And_Claude_Docker_Adapter.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-24
- 変更分類: `breaking`（private Provider Home契約revision 4から5、Provider Home observation wire revision 1から2、Claude Execution Plan revision 7から8。Model Selection Runtime revision 1とClaude Docker Runtime Adapter revision 1を追加）
- 移行／Release境界: `migration_required: true`（Repository内producer／consumerを同時更新し、旧wire、Provider fallbackまたは黙示的モデル選定へのaliasを設けない。発行済みproduction Selection Grant、active mountおよび実Provider Operationは0）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 説明可能なmodel／effort選定とClaude Adapter
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、11998 byte、SHA-256 `b247b31c293a18a6ed3721506dc671063bb4360549dc692365cc482a3230a7fc`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000045"></a>

### CHG-000045 → CHG-000054

- 旧題名: 変更トレース: READMEのAI開発チームVision
- 旧Path: `90_Release/Changes/CHG-000045_README_AI_Development_Team_Vision.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-24
- 変更分類: `clarification`（既存の人間／AI決定権限、Context RepositoryおよびAgent非依存性を変えず、公開入口の理解順を目的→役割→差分→実践へ再構成）
- 移行／Release境界: `migration_required: false`
- Canonical CHG: [CHG-000054](CHG-000054_Agent_Organization_Document_Architecture.md)
- 統合理由: Agent Organizationの利用者向けREADME Vision
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4646 byte、SHA-256 `7228c31e1473d3c793d94e6e97eb6eb23dd2a4f5af141bb302b59276b636bf86`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000046"></a>

### CHG-000046 → CHG-000015

- 旧題名: 変更トレース: Runtime Provider適格性観測
- 旧Path: `90_Release/Changes/CHG-000046_Runtime_Provider_Eligibility_Observation.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Provider Eligibility Runtime revision 1を追加し、既存Selection Grant production入口へ接続）
- 移行／Release境界: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。永続成果物、Schemaまたは外部APIを変更しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime所有Provider適格性観測
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4025 byte、SHA-256 `ad0ad2527d215c2bf868cf647e7fb0a67fa6c26ded9c23712c90ab55d70222eb`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000047"></a>

### CHG-000047 → CHG-000015

- 旧題名: 変更トレース: Runtime Provider Model Profile解決
- 旧Path: `90_Release/Changes/CHG-000047_Runtime_Provider_Model_Profile_Resolution.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Provider Model Profile Runtime revision 1を追加し、既存Selection Grant production入口へ接続）
- 移行／Release境界: `migration_required: false`（発行済みproduction Selection Grantと実Provider Operationは0。旧Profile aliasまたは外部Schemaを移行しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime所有Provider Model Profile解決
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4371 byte、SHA-256 `1471686e28c98db365eec6d997e46899e8443113f998d54abe9d9c63e25b76e2`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000048"></a>

### CHG-000048 → CHG-000015

- 旧題名: 変更トレース: Runtime Docker Recovery接続
- 旧Path: `90_Release/Changes/CHG-000048_Runtime_Docker_Recovery_Connection.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Docker Recovery Runtime revision 1とProcess Controller revision 4）
- 移行／Release境界: `migration_required: false`（発行済みproduction OperationとDocker Effectは0。既存Host Recovery schemaを変更しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Docker Process Controllerとdurable Recoveryの接続
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、3856 byte、SHA-256 `62695a98bd34fe4c2ff00103e5c6d00a18187545832216469f11924785cc82b7`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000049"></a>

### CHG-000049 → CHG-000015

- 旧題名: 変更トレース: Runtime Docker Effect Executor
- 旧Path: `90_Release/Changes/CHG-000049_Runtime_Docker_Effect_Executor.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Docker Effect Runtime revision 1とProcess Controller revision 5）
- 移行／Release境界: `migration_required: false`（発行済みproduction OperationとDocker Effectは0。永続Schemaを変更しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: 固定Docker Effect Executorのproduction接続
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4035 byte、SHA-256 `e49e4a1f809b5ab0bc962da321ebcd6075fff3c90afea4be8f986ea8f4ce3a1c`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000050"></a>

### CHG-000050 → CHG-000015

- 旧題名: 変更トレース: Local Personal Authorityと上限付きProvider適格性
- 旧Path: `90_Release/Changes/CHG-000050_Local_Personal_Authority_and_Bounded_Eligibility.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Local Personal Authority Runtime revision 1、Provider Authority Runtime revision 2、Provider Eligibility Runtime revision 2）
- 移行／Release境界: `migration_required: false`（発行済みproduction Authority／Selection Grant／Provider Effectは0。永続Schemaを変更しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Local Personal Authorityと上限付きEligibility
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4404 byte、SHA-256 `787ef76699f15e601b8d582c4902f3ee6e472f26ff20d6ec0b8dafd82e9abe20`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000052"></a>

### CHG-000052 → CHG-000015

- 旧題名: 変更トレース: Coordinator→Claude Probe Runtime Facade
- 旧Path: `90_Release/Changes/CHG-000052_Coordinator_Claude_Probe_Runtime_Facade.md`
- 統合前判断: 状態 `Implementation in Progress`、判断／更新日 2026-08-25
- 変更分類: `additive`（Coordinator Runtime revision 1、Docker Process Controller pre-effect cleanup結果追加）
- 移行／Release境界: `migration_required: false`（発行済みproduction Coordinator Operationは0。永続Schemaを変更しない）
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: CoordinatorからClaudeへ到達するRuntime Facade
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4362 byte、SHA-256 `20394d4ccd00c3c5e2fdb2ccfcbafd29331122891a5f0e2fcad830edadaa15f5`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000016"></a>

### CHG-000016 → CHG-000017

- 旧題名: 変更トレース: CRDD内部ScriptのTypeScript完全移行
- 旧Path: `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-16、対象versionは当初未決
- 変更分類: `breaking`
- 移行／Release境界: Node.js 24.12以上のnative TypeScript実行、変換packageなし。後続のv0.18命名／Path移行が対象versionと外部移行を確定
- Canonical CHG: [CHG-000017](CHG-000017_Tools_Coding_Standards.md)
- 統合理由: v0.18内部ツール近代化の実装言語・実行Baselineであり、命名／Checker Path移行と独立Releaseしない
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、25856 byte、SHA-256 `1f62be439b87ef5e28d471470382527f61995491376eb046cbe767dd571885a2`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の段階検証とCanonical CHGのEvidenceを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000019"></a>

### CHG-000019 → CHG-000015

- 旧題名: 変更トレース: 最小RustプラットフォームアクセスCore
- 旧Path: `90_Release/Changes/CHG-000019_Rust_Platform_Access_Core.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-17
- 変更分類: `breaking`
- 移行／Release境界: CRDD公式Repositoryの開発／build環境だけ。採用Repositoryと公開CLIは対象外
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0のOS観測・Platform Trust内部境界
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、19744 byte、SHA-256 `1027fecc38e7751869b6bb5401d06138b5b459d0cdc6c663e0f585afe572aa0b`
- 関連Evidence: [CHG-000019_Agent_Security_Review_396206d.md](Evidence/CHG-000019_Agent_Security_Review_396206d.md)、[CHG-000019_Current_Review_Record_396206d.md](Evidence/CHG-000019_Current_Review_Record_396206d.md)、[CHG-000019_Document_Audit_396206d.md](Evidence/CHG-000019_Document_Audit_396206d.md)、[CHG-000019_Gap_Conformance_Audit_396206d.md](Evidence/CHG-000019_Gap_Conformance_Audit_396206d.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000021"></a>

### CHG-000021 → CHG-000015

- 旧題名: 変更トレース: 保護済み有効ポインターとWindows production接続
- 旧Path: `90_Release/Changes/CHG-000021_Protected_Active_Pointer.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-18
- 変更分類: `breaking`
- 移行／Release境界: CRDD公式Repositoryのv0.18 Windows machine stateとRelease工程だけ。採用Repositoryと公開Checkerは対象外
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0のWindows保護Runtime・有効化・復旧Lifecycle
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、25117 byte、SHA-256 `9da49c904ce9d57eb1a55b5d1dbe2df18d8f366a40a4e024d60c40c51cc3a6c9`
- 関連Evidence: [CHG-000021_Agent_Security_Review_d88a4c5.md](Evidence/CHG-000021_Agent_Security_Review_d88a4c5.md)、[CHG-000021_Current_Review_Record_d88a4c5.md](Evidence/CHG-000021_Current_Review_Record_d88a4c5.md)、[CHG-000021_Document_Audit_d88a4c5.md](Evidence/CHG-000021_Document_Audit_d88a4c5.md)、[CHG-000021_Gap_Conformance_Audit_d88a4c5.md](Evidence/CHG-000021_Gap_Conformance_Audit_d88a4c5.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000022"></a>

### CHG-000022 → CHG-000015

- 旧題名: 変更トレース: Providerライフサイクル基盤
- 旧Path: `90_Release/Changes/CHG-000022_Provider_Lifecycle_Foundation.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-18
- 変更分類: `breaking`（private contract revision）
- 移行／Release境界: Repository内producer／consumerを同時更新。supported production Provider stateは0
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0のProvider Identity、Home、認証およびLifecycle基盤
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、23851 byte、SHA-256 `7ee9de8bc62ecb5ad1c3b05acccc8ccde2e27a42b15e374b258c3f6576f4f0cf`
- 関連Evidence: [CHG-000022_Agent_Security_Review_f11ac73.md](Evidence/CHG-000022_Agent_Security_Review_f11ac73.md)、[CHG-000022_Current_Review_Record_f11ac73.md](Evidence/CHG-000022_Current_Review_Record_f11ac73.md)、[CHG-000022_Document_Audit_f11ac73.md](Evidence/CHG-000022_Document_Audit_f11ac73.md)、[CHG-000022_Gap_Conformance_Audit_f11ac73.md](Evidence/CHG-000022_Gap_Conformance_Audit_f11ac73.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000023"></a>

### CHG-000023 → CHG-000015

- 旧題名: 変更トレース: 動的Fake Providerライフサイクル観測
- 旧Path: `90_Release/Changes/CHG-000023_Dynamic_Fake_Provider_Lifecycle.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-19
- 変更分類: `breaking`（private contract revision）
- 移行／Release境界: Repository内producer、fixture、testを同時更新。supported production consumerは0
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0の成功／失敗／取消／cleanupを実Provider前に反証する診断Lifecycle
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、17216 byte、SHA-256 `3c46a8f64cd22b0d7c7ca721cc9dc79d7fa8b75f91b9e4012d73156e1426996b`
- 関連Evidence: [CHG-000023_Agent_Security_Review_dad6fb3.md](Evidence/CHG-000023_Agent_Security_Review_dad6fb3.md)、[CHG-000023_Current_Review_Record_dad6fb3.md](Evidence/CHG-000023_Current_Review_Record_dad6fb3.md)、[CHG-000023_Docker_Success_E2E_63e33e7.md](Evidence/CHG-000023_Docker_Success_E2E_63e33e7.md)、[CHG-000023_Document_Audit_dad6fb3.md](Evidence/CHG-000023_Document_Audit_dad6fb3.md)、[CHG-000023_Gap_Conformance_Audit_dad6fb3.md](Evidence/CHG-000023_Gap_Conformance_Audit_dad6fb3.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000027"></a>

### CHG-000027 → CHG-000015

- 旧題名: 変更トレース: Coordinator試験とpackage inventoryの安定化
- 旧Path: `90_Release/Changes/CHG-000027_Coordinator_Test_And_Package_Inventory_Stability.md`
- 統合前判断: 状態 `Verified`、判断日 2026-08-21
- 変更分類: `non-breaking`
- 移行／Release境界: Filesystem時刻・性能仮定を除去し、公開Schema／永続state／CLI grammarは不変
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Provider Home package観測のFilesystem raceとFake Provider取消Process lifecycleを閉じるRuntime安全是正
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、11070 byte、SHA-256 `b6679bb44495a22e9da627bb23373aab57bf73f37dfc76327938ccbd28d6e693`
- 関連Evidence: [CHG-000027_Agent_Security_Review_5057d8b.md](Evidence/CHG-000027_Agent_Security_Review_5057d8b.md)、[CHG-000027_Current_Review_Record_5057d8b.md](Evidence/CHG-000027_Current_Review_Record_5057d8b.md)、[CHG-000027_Document_Audit_5057d8b.md](Evidence/CHG-000027_Document_Audit_5057d8b.md)、[CHG-000027_Gap_Conformance_Audit_5057d8b.md](Evidence/CHG-000027_Gap_Conformance_Audit_5057d8b.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000038"></a>

### CHG-000038 → CHG-000015

- 旧題名: 変更トレース: Claude Subscription OAuth Vertical Slice
- 旧Path: `90_Release/Changes/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md`
- 統合前判断: 状態 `In Progress`、判断日 2026-08-24
- 変更分類: `breaking`（private Claude Execution Plan／Provider Lifecycle revision）
- 移行／Release境界: 発行済みproduction state、Mount Grantおよびconsumerは0。旧revision alias／fallbackなし
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0のcross-provider実行・レビューを構成するClaude公式Subscription接続
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、11796 byte、SHA-256 `dd2c3698fe79a9af99518110f05fa6622f9b88f9c996cfc032180d576005148d`
- 関連Evidence: [CHG-000038_Claude_Subscription_OAuth_Vertical_Slice_20260824.md](Evidence/CHG-000038_Claude_Subscription_OAuth_Vertical_Slice_20260824.md)
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000042"></a>

### CHG-000042 → CHG-000015

- 旧題名: 変更トレース: Provider非依存の委譲経路選定とSelection Grant
- 旧Path: `90_Release/Changes/CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md`
- 統合前判断: 状態 `Implementation in Progress`、判断日 2026-08-24
- 変更分類: `additive`
- 移行／Release境界: 発行済みproduction Selection Grantと実Provider Operationは0。黙示fallbackなし
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime 1.0内部の4経路、explainable selection、Model／effortおよび一回限りGrant
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、7648 byte、SHA-256 `0a2f4eb1e839982ad297016e3079480e48a7a7ac89da65ca0c8e456c7911709a`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000043"></a>

### CHG-000043 → CHG-000015

- 旧題名: 変更トレース: Docker Process Controller
- 旧Path: `90_Release/Changes/CHG-000043_Docker_Process_Controller.md`
- 統合前判断: 状態 `Implementation in Progress`、判断日 2026-08-24
- 変更分類: `additive`
- 移行／Release境界: production Effect executorと発行済み実Operationは0
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime 1.0のtimeout、cancel、process tree終了、Docker Effect、cleanupおよびRecovery制御
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、5066 byte、SHA-256 `b6af8ad6c35d8a7a39a52b3def90e248811f3adeb83a00f0d514f19bc545a9a7`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000044"></a>

### CHG-000044 → CHG-000015

- 旧題名: 変更トレース: Runtime Provider Authority Capability
- 旧Path: `90_Release/Changes/CHG-000044_Runtime_Provider_Authority_Capability.md`
- 統合前判断: 状態 `Implementation in Progress`、判断日 2026-08-25
- 変更分類: `breaking_private_revision`
- 移行／Release境界: 発行済みRuntime Authority、永続Profile／Registryおよび実Provider Operationは0。旧revision fallbackなし
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime 1.0のLocal Personal Authority、Eligibility、Provider実行CapabilityおよびEffect前Gate
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、6723 byte、SHA-256 `4289ae5fcb5760ccafe26de85ff56ca94dad7188a5cbb06ebf5e6e0ae68947fb`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000051"></a>

### CHG-000051 → CHG-000015

- 旧題名: 変更トレース: Runtime Repository／Revision結合
- 旧Path: `90_Release/Changes/CHG-000051_Runtime_Repository_Revision_Binding.md`
- 統合前判断: 状態 `Implementation in Progress`、判断日 2026-08-25
- 変更分類: `additive`
- 移行／Release境界: 発行済みproduction OperationとProvider Effectは0。永続Schema不変
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Runtime 1.0のLogical Repository、Instance、Object Format、base／current RevisionおよびEffect前再確認
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、4191 byte、SHA-256 `5b62dba297766e39800a2f90076c790bde14d1115ad14e103f94ee1d13b7ba7e`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

<a id="consolidated-chg-000053"></a>

### CHG-000053 → CHG-000015

- 旧題名: 変更トレース: Codex Subscription Runtime Adapter
- 旧Path: `90_Release/Changes/CHG-000053_Codex_Subscription_Runtime_Adapter.md`
- 統合前判断: 状態 `Implementation in Progress`、判断日 2026-08-25
- 変更分類: `additive`
- 移行／Release境界: 発行済みproduction Operationは0。永続Schema不変
- Canonical CHG: [CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md)
- 統合理由: Coordinator Runtime 1.0のcross-provider実行・レビューと逆方向経路を構成するCodex公式Subscription接続
- 固定原文: Commit `718d8fbfebae29e5345b81bc61385a30950831b3`、Tree `7b25b1889fa97d45f1b4cc0d2f6e0020ac336709`、6428 byte、SHA-256 `ce7ecf8a649429cf78386c210d9e3855306df7b52a4e7287ab5347fa9476337d`
- 関連Evidence: 専用Evidenceなし。統合前Git原文内の検証・監査記録とCanonical CHGを参照
- 旧ID処置: 統合済み・永久欠番

## 利用境界

現在状態、実装済み範囲、残存リスク、移行およびRelease判断はCanonical CHGを読む。本台帳、旧EvidenceまたはGit上の旧本文だけから、Authority、Capability、Effect、Gate open、統合、StableまたはReleaseを成立させない。旧原文Commitが公式Release tagから到達可能であることはRelease Gateで確認し、到達性を確認できない場合は旧全文をcontent-addressed archiveへ含めるまでReleaseしない。
