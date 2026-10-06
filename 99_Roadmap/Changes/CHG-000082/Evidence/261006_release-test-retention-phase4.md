# Runtime Data整理④ — 固定入口と終了済み生成物

成果物種別: 変更検証記録
対象: `CHG-000082`、整理④
状態: 固定入口の局所是正・19件回帰と二観点の独立再確認はPass。archive4件は回収済み。実端末・旧Signer試験1件・整理④全体は未完了。
維持責任者: Qual-Lab

## 結論と範囲

### 最新処置 — Release展開物の全廃棄

2026-10-06の人間指定により、verificationの整理と実行JSONの恒久保存見直しをいったん分離し、Repository-local `release`／`release-staging`を全て廃棄した。下記の旧保全判断はこの指定以前の履歴であり、現在の保全一覧ではない。候補ごとのRepository全体展開を継続する方針も採用しない。

処置前にexact Root、非reparse、非使用ProcessとProject Runtimeの現在処理なしを確認し、読取り専用の独立整合確認を行った。release 62候補とrelease-staging 1候補、114118 File・1959612219 bytesを回収し、両Rootの不存在を確認した。本体Manifestとのhardlink一件は候補側の名前だけを除き、本体のHash `8be590d91244a724dd4755077d567335ec1d38b14d05af04ac5e0b82dab85cc3`不変とリンク先一件を確認した。Git管理Source、本体Manifest、秘密鍵、認証、verification、tests、tmpは変更していない。

古い一時wrapperが参照する展開候補も退役した。旧Pathの再実行や旧署名候補の存在を前提に検証を開始しない。通常試験は現行Sourceで行い、署名付き実行に必要な入口・Runtime・設定の集合とHashを調査して、全体コピーを必要としない方式を別途設計する。署名・実E2E・全体整理の完了は主張せず、コミット・プッシュは人間指定により停止する。実行別JSONや新しい清掃Evidence Fileは追加しない。

署名用の端末補助をCoordinatorの固定TypeScript入口へ集約する。署名本体の保証は維持し、現在必要な署名済み候補・E2E入力・正式根拠を保全する。古い名称や時刻だけで一括削除しない。

変更分類は既存工程の整理と入口実装である。Coordinator詳細設計、Runtime Dataの終了契約、Workflow、Quality定義を所有正本として接続する。着手前に入口と保持の二観点を読み取り専用で確認した。完成後はArchitecture／Qualityと文書／移行影響を独立確認する。準拠基準・Release判断は変更しないため準拠監査とRelease監査は行わない。実署名、Provider E2E、Docker再起動、ACL変更は今回の実行対象外である。

## 固定署名端末入口

`40_Develop/coordinator/scripts/sign-release-terminal.ts`へ配置する。既存署名Commandを同一Processで呼び、未知・重複引数と非TTYを拒否する。現在UTCと明示期限を整え、署名終了後だけEnter待ちを所有する。既存の秘密入力・非秘密事前検査・署名・配置の順序を変えない。候補別PS1／CMD、追加子Process、結果Store、自動再試行は作らない。

以前の一時`SIGN_EXIT` File／Transcriptは新入口に引き継がない。終了結果は端末で読み、窓喪失時は既存Manifest検証へ戻す。これを署名結果の永続保存や強制終了時の回収保証と表示しない。

## 既存集合の処置

| 対象 | 判断と理由 | 今回の処置 |
|---|---|---|
| `tmp/v022-project-persistence-{04750a30,1ce6d9c5,c097598a,c7c5a250}.tar` | 4つの入力CommitとNative Git blobが存在する配布archive。164,746,560 byte。現行E2Eのarchive参照なし。 | 再生成byte一致、非使用、許可Rootと非aliasを確認して回収する。 |
| `release/v022-project-persistence-1ce6d9c5` | ②最終署名候補とproduction初期化の根拠。 | 保全。archive回収と展開Tree回収を分ける。 |
| ②の旧展開候補3件 | 最終候補へ置換済みだが、生成Manifestと参照終了の確認が残る。 | 今回は保全し、後続の処置対象とする。 |
| `release/v022-candidate-result-d36a9dec`と対応E2E入力 | 固定／動的E2Eが実参照する。 | 保全。固定署名入口の追加で退役済みとしない。 |
| Native固定試験実行物と検証原記録 | Sourceが固定Pathを参照し、CHGがPath＋Hashで必要根拠を参照する。 | 保全。再生成入口・参照終了を確認するまで回収しない。 |
| アクセス拒否Fixture3件 | 観測不能であり、不存在・不要ではない。 | ACL変更や強制回収をしない。 |
| v0.20 stagingと残るRelease／tests | 利用側と終了条件が未判定。 | 未処置。年代だけで削除しない。 |

初回案では`tests`と`verification`を残す区分だったが、2026-10-06の人間判断で見直した。`verification`を新規保存先から廃止し、一時的な署名・試験の段階結果・診断を`tests`、正式な根拠を対象CHG／Releaseの`Evidence/`へ分ける。唯一の根拠や固定Source参照を失う移動は行わず、全てをJSONLへ変換しない。

①の保全一覧は290トップFile・63Directoryだったが、②後の現在値は306トップFileである。追加16件を隠さず、今回の固定入口と再生成物回収で増加の原因を処置する。既存E2E一時Script全ての正式入口化が終わったとは表示しない。

## 清掃の実施結果

2026-10-06、上記配布archive4件を回収した。各Fileは`git archive --format=tar <入力Commit>`の再生成byteとSHA-256が一致した。許可Root、親Directoryと対象の非Reparse、Process引数の非参照および排他的読取りを確認し、exactな4Fileだけを削除した。終了後の不存在を確認した。回収量は164,746,560 byte（約157MiB）である。

| 入力Commit | 回収前SHA-256 |
|---|---|
| `04750a30` | `2fcea58fce6d4c999a4579dd0ba21382b6fe53db586db7beb5669ac69b045966` |
| `1ce6d9c5` | `68053e9bd5bd73d157c0c930239c26bcc7f53a607c64edfd50b901cbf6099932` |
| `c097598a` | `a4f71f83ce898bcb5afc0d652a57eee7b05806ad3475785630bb1b8121aa3731` |
| `c7c5a250` | `8b70fcdbbbd7b5674599c6c4cc0cdc3ebee8a65fc63d5ecce9c8cf3a5d54dfc2` |

署名済み展開Tree、旧署名wrapper、E2E入力、Native原記録と観測不能Fixtureは不変である。元の290File保全例外へ新規物を加えた運用上の逸脱は、固定入口の利用で再発を止める。既存全入力の退役や整理④全体の完了を、この4件の回収から推定しない。

## 初回検証と独立確認

固定候補`2151ec4c4b7725cfba240b34e7691992ccb86f12d3b3d602732c4a7801bd7644`（基準Commit `823cb32d`、変更10File）をArchitecture／Qualityと文書／移行影響の二観点で独立確認した。全結果を統合し、是正案を両確認者へ提示して整合後に編集を再開した。

初回の型・整形・Lint・保護経路Graph・両Traceability確認は成功。文書Checkerは1173 Markdown、18500リンク、2344アンカー、Error／Warning 0。局所回帰30件は21成功／9失敗であり、全体Passではない。

| 指摘 | 原因と是正方針 | 変更しないもの |
|---|---|---|
| 画面保持の入力監視残存 | readline内部Listenerがclose後に残る。補助入口が所有する有限のListenerだけを接続し、全終端でexactに解除する。 | raw状態、既存秘密Reader、署名順序。 |
| 非同期出力失敗 | writeの同期throwだけでは非同期errorを捕捉できない。所有writeの確定まで観測し、表示不能時は待機を終了、既存署名結果を保持する。 | 署名Authority、入力契約、自動再試行なし。 |
| QA配置と導出元説明 | 新Localを通常検証項目へ移し、境界一覧へ追加。詳細設計§9からの直接導出とARCH領域の追跡参照を区別する。 | 既存ID、Semantic Key、ARCH定義の意味。 |
| 既存Signer試験の改訂版不整合 | 18件中1件は旧署名Source `1ce6d9c5`の非export mainを新Verifierで検査し、秘密入力前に`capability_graph_mismatch:main:export`で拒否した。対象SourceとVerifierの版を整合して再検証する必要がある。 | key pinningのOracle、検査条件。skipや受理拡大で成功化しない。 |

新入口を接続するためのmain引数受付とexact export登録はRuntime実行Identityを変える。旧署名候補のコードを上書きせず、新コードの正式署名・実端末確認を未評価として残す。既存の署名鍵不一致試験を成功と表示する前に、適切な固定改訂版で再実行する。

## 是正後の局所確認

入力監視は所有する`data`／`end`／`error`と取消Listenerへ限定し、既存Listenerとraw状態を保全した。出力監視はCommand期間から終了表示まで接続し、所有writeのcallback／error確定後に解除する。型・整形・Lint・保護経路Graph・両Traceability確認を先に再実行し、成功後に新入口の19件を実行した。19成功、失敗・取消・skip 0。非同期出力失敗の6経路、入力の全終端、既存資源保全と再試行0を確認した。

QAの挿入位置是正によってAIT-IT-015が正式集合へ入り、全体投影の4不整合をCheckerが検出した。定義だけを増やして終えず、Quality Integrationと現在設計数を177件へ伝播した。過去の176件の固定観測を変更せず、新項目のsymbol manifest／実端末／正式署名は未評価として維持する。現在の設計数を全体Pass数と表示しない。

既存Signer回帰の改訂版不整合1件は未達のまま残す。この記録で既存18件全成功、正式署名準備完了または整理④完了を表示しない。

是正後の固定候補は`ad534b833b65c3c7d5fa0ee9c26be03032c1fd19b4b2c797f8bbe674767e4250`（基準Commit `823cb32d`、変更13File）。Architecture／Qualityと文書／移行影響の独立再確認は、ともに局所範囲でPass、必須指摘0。Architecture／Quality確認者は19件を独立再実行し、非同期Writable失敗の反例でも署名結果code0と所有Listener残存0を確認した。文書Checkerの再実行は1173 Markdown、18500リンク、2344アンカー、Error／Warning 0。これは正式署名、実端末、旧Signer試験1件、残る清掃やReleaseの完了を含まない。

### `verification`廃止の現在の処置

| 対象 | 変更または保全 |
|---|---|
| Runtime Data公開Path | `verification` Areaと定数を除去し、`tests`へ一本化する。互換Aliasを追加しない。 |
| 試験結果保存と実Provider試験 | 新規結果を`tests`へ保存する。UUID、開始／結果／完了の相関、版、Hash、容量拒否と失敗結果を維持する。 |
| 一時物のEvidence昇格 | 一時結果の複製では清掃を許可しない。実CHG／Release Evidenceのexactな相対Path、非alias、bytes／Hash、Operation IdentityとOwner世代へReceiptを結合する。 |
| フロントAIの手順 | 結果確認、必要根拠の正式記録または不要判断、参照終了・非使用・回復義務確認、清掃・不存在確認。中断残存は次回開始時に再確認する。 |
| 検証結果のschema | `verification`という概念・結果field・関数名は保存先ではないため変更しない。 |
| Native固定試験と旧原記録 | 固定実行物・固定Path・歴史的Hash参照を保全する。新規結果保存の停止だけで旧物理Rootの回収完了を主張しない。 |

着手前に保存実装と保持・移行、文書・品質の観点を照合した。受付条件を緩めるのではなく、結果保存と正式昇格の境界を別々に検証する。既存のRDL検証項目とRecorder契約を使用し、保存先変更のために新しいQA IDや共通清掃Frameworkは作らない。

保存先変更の静的確認は、CoordinatorとRuntime Dataの整形・型・Lint、保護経路Graphと両Traceabilityが成功した後に回帰へ進んだ。Runtime DataのPath・利用側閉包・一時Operationは31件、Recorderは14件、合計45件すべて成功した。現行TypeScriptの旧Path定数・`paths.verification`・`runtimePaths.verification`は残存0。4つのAdapterにある`verification`は配布検証の結果fieldであり、Pathと誤認して変更していない。実Provider試験の正常／例外結果の保存先だけを変え、保護経路Graphのmain固定Hash2値をその差分へ合わせた。

文書Checkerは1173 Markdown、18502リンク、2345アンカー、Error／Warning 0。旧Native試験の固定実行物・Source中の固定Path、歴史的根拠の物理回収は未完了である。新しいSourceの局所成功を旧署名候補の変更、実Provider E2E合格や旧`verification` Rootの不存在へ読み替えない。今回の差分を固定して、保存・品質と文書・移行の独立確認へ渡す。

初回独立確認の固定差分Hashは`03b31e60e9f15919da8875506a7695b25fde249acc6e4640a1bec0efed992bda`。二監査を全件終了し、次の3是正を統合して両確認者と整合した後に適用した。

| 指摘 | 是正 | 維持する境界 |
|---|---|---|
| Operationと別Repositoryの同Hash根拠を受理できる | 作成・再入場時に検証済みRootを保持し、根拠の読取り前と清掃前に同一Rootを必須化した。 | 別Repositoryへの許可拡大、任意絶対Pathや旧Aliasを追加しない。 |
| Current Behaviorの保存先伝播漏れ | 新形式のCLI説明を`tests/<UUID>/`へ揃え、旧配布物の場所・版・Hashは歴史として保全した。 | 保存相関、失敗結果、正式Evidenceの意味は不変。 |
| 試験Directory階層の規約競合 | 新規案内を`tests/<run-id>/`へ統一し、必要な実行単位別の分離はその内部へ置く。 | 既存の固定Native入力を今回移動しない。 |

是正後は全静的検査を先に通し、作成・再入場の交差Root負例2件を含むRuntime Data33件とRecorder14件、計47件が成功した。交差Rootの根拠File読取り0、Receipt非発行、元source・制御bytes不変と清掃拒否を確認した。同じRootの正式根拠と既存の再Hash反例も維持している。型に合わせた負例弱化や署名Oracleの変更は行っていない。

是正後の固定差分Hashは`3f5dd9fedd5d721fb98968ddf010bf4ea26661bf53007658028d1b08ba156ad8`（基準Commit `823cb32d`、27File）。保存・品質と文書・横断影響の独立再確認は、今回の移行範囲に限定してともにPass、必須指摘0。保存・品質確認者は交差Root反例2件を独立再実行して2成功を確認した。47件全体の独立再実行とは区別する。旧Native固定参照・物理Root回収、旧Signer1件、実端末・正式署名・Provider E2Eと整理④全体は未完了である。

## 旧Recorder原記録の移管・回収計画

対象は旧`verification/<UUID>/`の開始・結果・完了JSONだけとする。過去の場所・判定・Hashは変更しない。正式根拠14件は既存OwnerのEvidenceへ`261006_recorder-<UUID>-<種別>.json`としてbytesを保全する。不要16件は参照終了と回収済み結果を確認して回収する。現在状態への接続が未確認の3件は保全する。以下は処置前の固定一覧であり、回収完了を示さない。

| UUID | 処置先／処置 | 過去の結果 | complete / result / started SHA-256 |
|---|---|---|---|
| `0f6d3947-810a-4b78-ae65-22e2ce682e75` | `99_Roadmap/Changes/CHG-000066/Evidence/` | `completed` | `c5ce514895455209b8bcde1abd45dd5aa1cac48a7e4e1d5e7ffa0daaa446b3f7`<br>`976959e557d36b14e72c03cb9172b00adf2814167ccdf8ea3baf64c4ba4b0385`<br>`e774de6d985a46ea49fd5012ce64c9db5ea0d4340aad262e986238b3ec5fa2fd` |
| `e5da5210-b402-4a67-a7d2-b06868dc4690` | `99_Roadmap/Changes/CHG-000066/Evidence/` | `completed` | `7bf7b90d56505c1112dfbd35767ff2c62418b37a635e91b8bcf99e4219c49e9c`<br>`8bce648aeb402e52ff1b5a7a64fbe0bfb8497a4414f3258ed7397eae1488a8bf`<br>`51c0881986ec8e911b7e45c6fcf0ed04452b0fe8845d9ca739498eee952b43d4` |
| `c79d2537-9854-47b3-bdec-50be729a6835` | `99_Roadmap/Changes/CHG-000071/Evidence/` | `completed` | `4a26e973cfd34ccdaaef94f2fb954ee6009ef5404bd858fa8dc9856b56c80cea`<br>`16bd8a4a8ce1f5e7c081ff218d3d16361ad81986499215ebd3c7a6f3279ff0e9`<br>`552df91efd6c7a8401ac26e493eaca079c92475f97fbedc0395af3f1b3b0bdd2` |
| `ab5f2da9-0154-4c78-bb68-b799ae8bd4ee` | `99_Roadmap/Changes/CHG-000071/Evidence/` | `completed` | `7da266f121f35cca0342a0bacb22d86696839510a30a3b8d9c0cd852334e31da`<br>`e69b4dab7532e4568434f52614ce51a546127a910fdc8b23bbd9f612662555ae`<br>`bed496f27ddd4d015c7db93ba8d82871beb1336d2a1b9af18b48a29908a53090` |
| `bfa25994-d041-4902-875a-d02b32a55d84` | `99_Roadmap/Changes/CHG-000076/Evidence/` | `completed` | `50d07cd051a46e9bc53345743629e416d616044b5881d8ddea602fff1f9699ab`<br>`5d288e4c86d1992a66d599fb07de42c16e0bfcc17bee08915eb808c6eec4edd4`<br>`7fb6dbb7f372d350b6d73748aaef5221d2219078cabbbd92cad91a489337d7d2` |
| `4480ca02-e4af-4cc8-b8cb-d483fd7883e2` | `99_Roadmap/Changes/CHG-000077/Evidence/` | `completed` | `1e2067c4531360cf9cd0ba06a1aad71b332c3e027de621b84f759125d91a93a9`<br>`13a40ad2b74dfd1826a2e5bee68d6fcfea20c6a71c7e6079c1f60debb7b57083`<br>`8f5528345cbffc146dbed07a9dfc10f2414778b4db16b58904c9ab5bb4923581` |
| `750919c2-114a-4c9e-b8ec-c80dc715d9d4` | `99_Roadmap/Changes/CHG-000077/Evidence/` | `completed` | `1bf8cc9aba7e5412b2d0582bb6f2e11a2b4a0d2ecbdcb3f53bdf22685811c56b`<br>`564c967c36ad1b0c5f226a17825feb57e70e62a1e9c4798743777f2135f2f87f`<br>`2a5358e0b9f8fffb4b1290d7a6ec5960e31db99a27b5fdeb6febcf5bc4db7f95` |
| `9ed009ad-54c8-46fd-9379-8186f08a96ef` | `99_Roadmap/Changes/CHG-000079/Evidence/` | `completed` | `a4038da147f425cd16cf3a2f8285230d9f840041ea57f89d444369e5718b454e`<br>`185944c5235ae5d4a42415c98c375406e89082b52e9351bb29a4365605f637df`<br>`00f4e1ccdb011a586b5a07e39f9f501e7705f94b70ab76c415fade45cf2ff12c` |
| `d4febf8d-537a-44ae-bb3f-677ab33718d5` | `99_Roadmap/Changes/CHG-000079/Evidence/` | `completed` | `6e939b80053cc36f9719936c2cbe67751b16a04e55ba695f50d5b717628b7d32`<br>`64db810e33aa05be1cccc198465b9c5761e17727ea333b4a9cc2844035fd15d6`<br>`e836ad5750f29b53ff65c849d721b4e6e445299b444368be5cfcf958b37f8004` |
| `468082f5-63c6-489d-af86-00bc628241fc` | `99_Roadmap/Changes/CHG-000080/Evidence/` | `blocked` | `11dff9c5df7fac98961fd61ad954521a5b777fbf705a42a2b8b0840076e42f0a`<br>`9ede1949ba017e3f5f1d24b096079bfdff0019ca5a31db199b300f9c5d64073b`<br>`78f9a7c8718ba91f103116809d9e45de558990c5c2c960e11731fecde98e4f06` |
| `8a651704-41ca-4290-948b-521f63008253` | `99_Roadmap/Releases/v0.21.0/Evidence/` | `completed` | `2cce3690d9529378b938232234318ee2de3137888954b62027b4e6d6a0770e82`<br>`3d476e27970edf1df2849d785aae60789161cad4f2e43121dba9256c9e1c95a6`<br>`78f734ca7522c6c48e76e95bc21d5ca0a0b2fb295f0bbb454547a0e2450cb0fa` |
| `d7aa9851-0054-4d47-b021-1afb5d65b14d` | `99_Roadmap/Releases/v0.21.0/Evidence/` | `completed` | `e82e96a19a52e2796a3bc181e5729a348f3221e27711b3207eabc13fe1f60b7e`<br>`91e1b1f77755b314dcec9c4f4d3aecfb2c50f633725cc01a9f623f98263c402f`<br>`aac13ed7e4a292d2b87754f2d299da7d550599beceda0d8bab04c44dc73f580c` |
| `144359d8-d916-4228-b6a6-f78bb1a46143` | `99_Roadmap/Changes/CHG-000082/Evidence/` | `blocked` | `d1a5f978f7b81d67f2ba7ffdd58bf722fc59a2d69236f83d5ebce814ec00ca20`<br>`1869acd848053d2bb80a1a9ede90685ecf544b73b71c45297fe08a5f0ba4f452`<br>`cc9d10755fe6b3aba4a39129c27880011aa5fccfcde00d5318319f01a22059cc` |
| `5ed92d8c-2dd7-41ae-9d37-b6d1c2fbcd01` | `99_Roadmap/Changes/CHG-000082/Evidence/` | `completed` | `44544b34c4465fcfccba3c2f65e0b9879282c4d53ff9575f9ada81d791a7e0b8`<br>`b31888e5502be7deae6589676a5604ba4eb861ac003ccd948035286e641e1a37`<br>`33bcd11f90a2386a60981080ec7bb5127a0ad741ea45be66e65f8d2bffb9fc8c` |
| `1750d261-9e26-4cff-b959-b6f94cc78d99` | 不要判断後に回収 | `completed` | `ebed5076af2b019b3e5ceef9772a7fe31db0fa66dfa4ab856fd8b434fddb4ebc`<br>`1139d4a5d274372e66e45daa40d81649cd8ef53c0b41b9b8e17d71d8c7a8b16b`<br>`c78d2f73af00f8d78a390d6298702505a1de7b63fbebda19ca315ffc7c127933` |
| `22e735bb-6244-4aa0-b957-1a3816d3378c` | 不要判断後に回収 | `blocked` | `7fb6cea6b5099b331cf1d374c9c79aa889cdd6251a44e24913c20164e827e86a`<br>`8d8d715e3b494d753f4388f5fcd1d890b9d4974907f67c77655d21f74d11ad35`<br>`d374c179f12461c9b26a72d41a964e957da3de59c81b30c57539b552ac49b1f8` |
| `31cf5337-a3af-48f5-bcb9-973cf40a3ca1` | 不要判断後に回収 | `blocked` | `0c435b8f91184bab166e9bd4946135f5ce52ad26c4aae64967aa517b377a5069`<br>`c0b60fa98c23f80fbf2980425560512aa5e5d899359e2c6a3afcdf428a635424`<br>`10fb2377fd244226144a5780374d20cfd770ed6ad783663886c3b146fbc850c3` |
| `36bdda29-67a8-4855-93d6-2a76cd30ad24` | 不要判断後に回収 | `blocked` | `0a9d0e11824b4e4773c07573d7102551bbdf8fb6610ba09ab4539be06245d5ba`<br>`71e3bfe842ca5e94a9d4cc819cecb6fdaff693dac8ce171b5a176bd0b24447d9`<br>`4780b71321d5fb43593bf9ac0559142f4f44af27dba85a1da639a8a2bb966cec` |
| `5e3c6a17-db9d-4cd8-b307-6955b4e2bb70` | 不要判断後に回収 | `completed` | `0a8a95b1cf62fd0d84785180a8d8b18570cfd86f936444a6bcdf026d9f5a292e`<br>`57291514ab881ab27340cb7aecc4a3b5d74984269f7d00b58b259b1f1285f6c3`<br>`18cbd7b20b4a3e9dd2f5abeb4c85c9463c64499a4dd6ebfac105c867c5188bea` |
| `606c3ecb-fe6c-4c53-beb3-409e256d03c2` | 不要判断後に回収 | `completed` | `661194f10d0ecfbed35fa9a969e5ca8ebc46c24379c3df0fc830cc95a3ce6771`<br>`72cc39dd5622ad5f9abf95d64f300b6a9e910df5dc084eb140a9c696d40a807a`<br>`770645d5477e1092177a06f1adb881067bb444ef0d1e7155810f5dcd11f03a85` |
| `61e8fe4d-d418-471b-8f9b-7394d69a9ae8` | 不要判断後に回収 | `blocked` | `08b6ad3ad742f47c422e9f27a07a81697b50fc41482972498a0a14e18dc575b1`<br>`de848b3f08ede41ed04b979b7febbaae66ec0fc7c041100dd9147eb50e1b530c`<br>`785b19df504fd996cfb930bc4552c0c8b9fbef6fb4ede606968e502099592f6c` |
| `8d28a022-96ef-47bc-97c2-ac0ba32e2c17` | 不要判断後に回収 | `completed` | `264c6b784e059f8519c316f5b498a386d352421a78587fdfd41d8dc07ab241db`<br>`807ea904f56c580c5091ae4a8fdf7a73cd77e2734ab3d8f655f5e147a0970598`<br>`d09144e7b516fece8ec170a6c10f6bf7509d82ce53c670910d74412584efbd9e` |
| `8f771b04-0ffc-4112-b6d0-288cf523e2e5` | 不要判断後に回収 | `blocked` | `0ea8692b75c2960222e9c8024d31d2ad746006bbb79916cad5a6a984cfd0eca1`<br>`f3bfbcebaa85fce8c97441c23143e480af7904a039f23ef759d4db581a208071`<br>`a69b0423d29cd0219e2142a2f887e054edb5342fcbe9a8e2d435f385bf804824` |
| `a09e0c0b-f2f0-411c-a2d9-abeacfc0a0e5` | 不要判断後に回収 | `completed` | `78c7b8f3019cec95c6359d51cf09181bce7abdae79019cf0fd80c8dbec4128b8`<br>`fab813c86cde2c92f64d2e6e6c1566bb2726bdede1a12ce087dd4c9b8b0d517d`<br>`2c766348833bd6369be229c98a89ede3d86d3be74b1c93f84e44b41651d7a83a` |
| `afedb6fb-68b2-4260-9fc0-55192b5d94ff` | 不要判断後に回収 | `blocked` | `8394dbedcc49843c482e26a6a7e305a66ba126dacd7a48b1576ebed84c54012d`<br>`01081265a7a36b00c412d8545f755cea2681867ec2a9ff061c95807671112e42`<br>`04b78e5ad655bcf077e708e04226359e32e96dcc45537897663cac156cf55e50` |
| `bbe66d1e-f850-4dac-9bae-5314b93c4155` | 不要判断後に回収 | `completed` | `95a13c1de68a2ce4a2d448aac1f760442c2edd549b601d50da078176779236a7`<br>`fae97d463634df7e9b5be63040e5ed8bee297eebbd54773512e55f8dccf0019f`<br>`59a028e491964c036dda6fd32033b0891a0bfb1d3ca20015de3a88b86199690f` |
| `dcefb79f-1838-4482-9ebb-82bf3eaaa0a9` | 不要判断後に回収 | `completed` | `31077416ce0ab62f26f9ccbe3474db2b1051f54135e7a38517de798fced4772b`<br>`16864e087138f984b0f0a85d7731f24a53f42d1aa0ab0e7a4029ab7891d442ad`<br>`9d574ec24cecdf5d3e0c79cc6f36132dff7f22427a61bb35c2f6ba019fadffdf` |
| `e10f591f-7fef-485c-b8b8-9ae07271467c` | 不要判断後に回収 | `completed` | `65ef9e895d0e92779e03a4f22ca66396662f84e14b7551d7a58e248ba8f6605e`<br>`b7929ab931283d2ca0ec9b08504be78b33757b5a65c4f1b2675df0c5613fe944`<br>`60568c0b7d1a13fb7f12dcb0187753db1e0a1652f11fd9bd1be8ddf6c7e288b5` |
| `f9c3ea85-7645-491f-88fc-e9d9560fad39` | 不要判断後に回収 | `completed` | `d612f21a0fccde76ed8c80fafb04dcf9cf38cdf283b029feb96806ad8f5980f3`<br>`a4d3cf4e9bfb2bcbdff7d9c299f2c8805b4f6f049f34a1e4cd159e55c1a69c6f`<br>`6959eff7071cf0c07c59646f9e0eacc3236147f89e026e16ecc5a5d5a574f8e7` |
| `fda4a0ed-3ca7-445f-876b-89597c6f21d9` | 不要判断後に回収 | `completed` | `ac999c8297ec09b6d7217e2448c54297e5ff94a38c3f008419dbe48517e836a2`<br>`0380c7b7ff782f2f0a386c82e407b02815f4ba23cb42437ed052910428cf61ca`<br>`4e4970d288ed3a72eaa1a402dd399447fcc9f168f7c79ac542dc9e25b9f1d277` |

保全対象: `2f9a8609-1e2f-4f98-be80-13dea73caf97`、`b19ab9ed-732f-4942-bc18-6e2325150763`、`ffa2e577-1c9d-44c6-8bfd-0a8546a7d3b5`。回復を要する過去結果を成功へ変更しない。

### 旧Recorderの限定回収結果

2026-10-06に上記30件を処置した。14件の原記録42ファイルを各OwnerのEvidenceへbytes不変で保全し、全SHA-256一致を確認した。CHG-000076／000077／000079には既存CHG配下のEvidenceを作成した。不要16件は過去結果の資源回収確認あり・手動回復不要、正式参照・一時スクリプト参照なしとして処置した。過去のblockedをcompletedへ変更していない。

Repository Root、全祖先の非ReparsePoint、exactな3ファイル集合、通常File・hardlink数1、固定Hash、他ProcessのUUID参照なしを処置前に再確認した。複製中は元Fileを読取り共有だけで保持し、削除直前に再Hashと排他openを確認した。再帰削除は使わず90ファイルと空Directory30件を回収し、各不存在を確認した。元領域から297,647 bytesを回収したが、正式Evidenceへの42ファイル保全分を含むため、これをRepository全体の純減量と表示しない。

未解決3件、Native固定実行物・観測不能Fixture、残る旧Root、署名候補と認証は保全した。旧Root不存在、全E2E、正式署名または整理④全体の完成を、この限定回収から推定しない。移管・保持と文書・Owner整合の独立確認を実施する。

旧Recorder移管の独立確認は、保持・移管と文書・Owner整合の両観点で限定Pass、必須指摘0だった。両確認者が正式42ファイルのHash・ID・結果相関、元30Directory不存在、未解決3件保全を全数確認した。文書確認者は14件すべての既存Owner参照と新保存先の一意な再構成を確認し、JSON内に機密値・Provider生出力・会話・Host絶対Pathを検出しなかった。削除前の観測を独立再実行した結果ではなく、処置後の現在状態と固定表の確認である。

移管後のCheckerはRelease原記録6ファイルの案内リンク不足を1件検出した。Release一覧へexactな6リンクを追加し、再実行は1173 Markdown・18508リンク・2345アンカー、Error／Warning 0となった。ステージ済み・未ステージの差分検査も成功した。JSON原記録や既存の署名・E2E判定は不変である。

## v0.21終了コード控えの限定回収

28フォルダ・33ファイルは署名候補入力や回復状態ではなく、終了コードだけの控えである。Source・Workflow・CHG・一時実行Script・現在のCoordinator／Project Runtime／Candidate／一時Operation状態からの参照と、他Processの対象名参照は0だった。終了値、サイズと原Hashを以下へ集約し、原Fileと空Directoryだけを回収する。終了コードから資源回収成功や全E2E成立を推定しない。Transcriptを持つ10フォルダ、Native試験物と未解決Recorder3件は対象外である。

| 旧フォルダ／File | 終了値 | bytes | SHA-256 |
|---|---|---|---|
| `v021-auto-repair-04d0aea4-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-docker-continuation-2769cd08-signing/signing-result.txt` | `SIGN_EXIT=0` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-docker-continuation-f63cc177-signing/signing-result.txt` | `SIGN_EXIT=1` | 16 | `856243237ff1a93634fa169c9a40543cd2e5514137b6e1f9c8cc61f92ed812ff` |
| `v021-engineering-completeness-authenticate-claude/authenticate-claude-exit.txt` | `AUTHENTICATE_CLAUDE_EXIT=2` | 31 | `099c0a15f7538f8fc4113a8b7dadc5f1d6c7e7a07c5b4084d3a9d38f3fdb63bf` |
| `v021-engineering-completeness-b7c7841d-authenticate-claude/authenticate-claude-exit.txt` | `AUTHENTICATE_CLAUDE_EXIT=2` | 28 | `afaef017ca26f5a9d5ded798f3cb8f0ced25c2b75ea3754867f1f59b411ae402` |
| `v021-engineering-completeness-eb7dee90-signing/signing-result.txt` | `SIGN_EXIT=1` | 16 | `856243237ff1a93634fa169c9a40543cd2e5514137b6e1f9c8cc61f92ed812ff` |
| `v021-engineering-completeness-f7344143-authenticate-claude/authenticate-claude-exit.txt` | `AUTHENTICATE_CLAUDE_EXIT=0` | 28 | `02bbb74e731cc45080b5090618aeb719cc20d1d52af1e22e64eba6bfd0685306` |
| `v021-engineering-completeness-f7344143-signed-matrices/recovery-matrix-exit.txt` | `RECOVERY_MATRIX_EXIT=0` | 24 | `497921568d8e69fb6c808abb531c88e93ec194d19a30d9cc5d42f3a93374744f` |
| `v021-engineering-completeness-f7344143-signed-matrices/route-matrix-exit.txt` | `ROUTE_MATRIX_EXIT=0` | 21 | `517271fa4dcbc069295bc88802aafb75a8e93fecb38e2e61aa12a4479d7c65f2` |
| `v021-final-419fe21b-signed-matrices/recovery-matrix-exit.txt` | `RECOVERY_MATRIX_EXIT=0` | 24 | `497921568d8e69fb6c808abb531c88e93ec194d19a30d9cc5d42f3a93374744f` |
| `v021-final-419fe21b-signed-matrices/route-matrix-exit.txt` | `ROUTE_MATRIX_EXIT=0` | 21 | `517271fa4dcbc069295bc88802aafb75a8e93fecb38e2e61aa12a4479d7c65f2` |
| `v021-final-419fe21b-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-final-472a7862-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-final-4a950aa2-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-final-c4d5e23c-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-final-f67938d5-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-hung-repair-0fc7f76f-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-phase6-40f4e4aa-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-reviewer-shape-e38f42af-real-reviewers/reviewer-boundary-exit.txt` | `REVIEWER_BOUNDARY_EXIT=0` | 29 | `35ca234f7e16c44430638132005aaf1e205a902fc1babf8efab1060a31bbdc9d` |
| `v021-reviewer-shape-e38f42af-routes/route-matrix-exit.txt` | `ROUTE_MATRIX_EXIT=0` | 24 | `c7c7af8b39f7c16bbae34eb8e027c55cbddeca7c2c573687846bc3dbae44f409` |
| `v021-reviewer-shape-e38f42af-signing/signing-result.txt` | `SIGN_EXIT=0` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-source-a-01eb00a6-signed-e2e/docker-repair-exit.txt` | `DOCKER_REPAIR_EXIT=2` | 22 | `8fe24ff859d4610fa67690bd1b33be0be32c85acbc1641c3970919239b8ad82c` |
| `v021-source-a-01eb00a6-signed-e2e/recovery-matrix-exit.txt` | `RECOVERY_MATRIX_EXIT=0` | 24 | `497921568d8e69fb6c808abb531c88e93ec194d19a30d9cc5d42f3a93374744f` |
| `v021-source-a-01eb00a6-signed-e2e/route-matrix-exit.txt` | `ROUTE_MATRIX_EXIT=0` | 21 | `517271fa4dcbc069295bc88802aafb75a8e93fecb38e2e61aa12a4479d7c65f2` |
| `v021-source-a-01eb00a6-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-source-naming-1713a9ee-signing/signing-result.txt` | `SIGN_EXIT=1` | 16 | `856243237ff1a93634fa169c9a40543cd2e5514137b6e1f9c8cc61f92ed812ff` |
| `v021-source-naming-5f05b605-signing/signing-result.txt` | `SIGN_EXIT=1` | 16 | `856243237ff1a93634fa169c9a40543cd2e5514137b6e1f9c8cc61f92ed812ff` |
| `v021-source-naming-f12d6dce-signing/signing-result.txt` | `SIGN_EXIT=0` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-source-naming-signed-matrices/recovery-matrix-exit.txt` | `RECOVERY_MATRIX_EXIT=0` | 27 | `d7cddef148ca8e44360edb84f88661f90e463d7cb9c846afefef4e25a9089fc4` |
| `v021-source-naming-signed-matrices/route-matrix-exit.txt` | `ROUTE_MATRIX_EXIT=0` | 24 | `c7c7af8b39f7c16bbae34eb8e027c55cbddeca7c2c573687846bc3dbae44f409` |
| `v021-startup-6f07d342-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-startup-b7fe9b49-signing/signing-result.txt` | `SIGN_EXIT=1` | 13 | `5716cc4809e955077d14e11d983cd01ee3277050e202e03eb170830f51544f88` |
| `v021-timeout-repair-3d258c44-signing/signing-result.txt` | `SIGN_EXIT=0` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |

この表は処置前の固定集合である。移管前の旧Recorder原記録とは別に、数値控えの内容を保存した。失敗値は変更せず、未知の資源状態を成功へ読み替えない。

### 終了コード控えの回収結果

2026-10-06に上記28フォルダ・33ファイル・616 bytesを回収した。直前に検証済みRepository Root、全祖先の非alias、exactなFile集合、原Hashと終了値、他Process参照なし、排他openを再確認した。再帰削除はせず、各Fileと空Directoryだけを削除し、各不存在を確認した。失敗値1／2を成功へ変更していない。数値控えの回収からRuntimeのcleanup成立は推定しない。

### 固定Native試験の移行前確認

旧Path13箇所の置換と旧binary移動だけでは、現在の試験能力の移行を証明できない。Cargoが生成するexe suffix二種は改訂版のIdentityではなく、新Build結果からcrateのtest executableを一意に解決する必要がある。Protectionの一時Node Ownerは分離前のmodule名とSourceだけを使い、現行の`windows::protection_tests`とfixture Sourceを固定していない。0件実行や入力固定漏れを成功にしてはならない。

| 区分 | 処置 |
|---|---|
| 通常の非ignored回帰 | 現行入口を維持する。 |
| 自己生成対象の限定Native試験 | Namespace、Target、Save、Capacity、Current Candidate、Cold、Publication、Disposition、Known File、Protection。現行Source入力・新Build・同一実行物の親子接続と原Oracleを維持した限定Ownerが必要である。任意command受付や新Frameworkは作らない。 |
| 当時の残存を読む診断 | Retained Readback／Mutation等は歴史診断として保全する。新Rootで同じ状態を自己生成せずに通常回帰へ転用しない。 |
| 旧Owner／binary／原記録 | 当時のHashの歴史入力として保全し、現行再実行入口と混同しない。 |

この確認は読み取り専用であり、Native Source変更、新Build・ignored実行、旧実残存三件の処置、固定OS Root・ACL・署名・Docker・Provider操作を行っていない。観測不能Fixture三箇所を名前や期間だけで回収しない。

## 端末TranscriptとNative中間物の限定回収計画

着手前に保持・移管と文書・Native利用側の二観点を照合した。新しい清掃FrameworkやRuntime機能は作らず、以下の固定集合だけを処置する。Source、Authority、署名Manifest、認証、Provider／Docker、ACLと現在の回復状態は変更しない。

### 古い端末Transcript

10フォルダ・22ファイルは既存Source・正式根拠・一時Script・現在の回復状態からの参照がなく、現在のProcess参照もなかった。原文にはPCのPathと秘密入力案内が含まれるためGitへ複製しない。典型Secretパターンの非検出は秘密不存在の保証ではない。工程完結性のOwnerはCHG-000080であり、既存Release根拠と移管済みの完全Recorderを保全する。必要な非秘密のIdentity・失敗理由・終了値と原Hashだけをここへ保存する。

| 旧フォルダ | 終了値 | 当時の結果 |
|---|---|---|
| `v021-engineering-completeness-84818015-signing` | `SIGN_EXIT=1` | `release_manifest_distribution_tree_mismatch` |
| `v021-engineering-completeness-915b964f-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-94fcb40-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-99e00e2b-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-b7c7841d-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-c583a53f-signing` | `SIGN_EXIT=1` | `release_manifest_package_observation_failed` |
| `v021-engineering-completeness-d5df0814-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-daa64baf-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-f7344143-signing` | `SIGN_EXIT=0` | 署名結果revision 3・created |
| `v021-engineering-completeness-signed-matrices` | `RECOVERY_MATRIX_EXIT=0`<br>`ROUTE_MATRIX_EXIT=2` | 不完結なMatrix断片。全成功・資源回収成立を推定しない。 |

| 当時の署名Source | Manifest SHA-256 | 配布内容Root SHA-256 | Runtime Identity SHA-256 | Native実行物SHA-256 | Source Tree |
|---|---|---|---|---|---|
| `915b964fb519ac00e4e3d3a242668f652c53ec0e` | `40bae605e5ec69e318f47f1da9625359d1b050a2ee69b9d7735aa544bf8b2053` | `c6b5f55c8b33f86936ac375eece27481daaaf79142636b09f9da5144b3fed347` | `d3aa00f6a388479d4667544e8c08095c6a4556a028d29e948ea0aad6b472f8cd` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `9b5c048a69c389bee53f0dc37982c4a4922c3d01` |
| `94fcb40ba6a9b98400646d6f4829c7d67e4f66fb` | `536c92b249677cf519c9cb0025a4cc55a4e3ffbc12941e2ed7d21aed03a3f18c` | `f3a5a14aa61a7e30f22caa8534a50c326c68f18215d7c0265b876ace400b6607` | `6640bdbeb92d2ad44c7b65c45e7cf9de325987393c83c48cb28eaa85690ce5f1` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `ac1e7cbb413a652b7b3c44623377060861c8c218` |
| `99e00e2b1f21fa288a5ab85d372ba021878b63d3` | `9854f0d09d880455e2302b5fd028a1b753ff2a6fed174701cabf73752e56698e` | `d080b3f7560269320d13b54c20b1723f4f16a579604c5a8740f54f0614c46dd2` | `ee2e3722063f23750dc42a05a465c397a0de59cfb9ab37ba35e2bd54c38a5a7d` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `4871e2dedb57f4b70d41608fb5b62ec3d6da75d8` |
| `b7c7841d5a47466776a061a7ac7c49c633990d28` | `5c3418d53c3778d5fece6c520622a75642bd7fb84c66f615c0785a0a439bb3c3` | `977b93e7bde395cf029db870f633984e3bb6f0f60ecb6472d0b57de77e59ebb1` | `8553f577edef087e4835b3034e97abb5de6ecf7b6e42d5286d7094f1fe6be318` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `be1e500c11072d076fcf55b4db436add37a662e7` |
| `d5df081404dcd137d6a315b0acbe0fa0a33de547` | `35edbd1dd0dbf7f0ae8f94a94e0e78074a5e23719708862cf124ac9c2c2fb086` | `10a06e07884c83ac58c53ad501df0afafcd2d3f75df3c7146174ee67cac5296f` | `a19ddbbfed3fa8b607f7bb27f6591a50a5829560fc4f0ce00dc0b92d27042564` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `e3cc6d342d6dcc3ec061033e6bb4c17dc1de63f1` |
| `daa64baf7f287d63fcf468a3507905701732a3c0` | `066c93a3b0f33c96a8e0a18340c2f69e6d19e1a582a788d6e8f1cc59d3fba075` | `f1ee1dde2a38817f851221b8083cfa4be7691bec6a3bda84247eac17557dd915` | `44244a2acafec7c42df91c21d91d95df504ef86484a5f6d6e875f8ce681a0a2b` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `204a0d6e96a93aa2fac2ceeebf8fbf0418ec8ea8` |
| `f73441435d93e7e7bc099370e82c1278689033b9` | `8a724421900669dab0ac1e22ad8521fe78bc2048d4f03a809cecbe5ad195566b` | `e712a8daaf135d6482cb7faef0e0afdcf8e870bbfe180174602534aee6790235` | `cf11ad32749f0856a91bbf1e18aebad0eff34e29018c77a080cf6340f237d433` | `9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0` | `327329e6f01b6cae5767e0fdebe6b8aa0c509c1d` |

| 旧フォルダ／File | bytes | 原SHA-256 |
|---|---|---|
| `v021-engineering-completeness-84818015-signing/signing-result.txt` | 13 | `5716cc4809e955077d14e11d983cd01ee3277050e202e03eb170830f51544f88` |
| `v021-engineering-completeness-84818015-signing/signing-transcript.txt` | 1214 | `d16638868f8f50badceb192ec263695ce1d40a172db4b43dad68e2873841531b` |
| `v021-engineering-completeness-915b964f-signing/signing-result.txt` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-engineering-completeness-915b964f-signing/signing-transcript.txt` | 2385 | `a1fe67e4e407df4ffa93799fe613c846ace4428239895a707ac80e5bfc511fbf` |
| `v021-engineering-completeness-94fcb40-signing/signing-result.txt` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-engineering-completeness-94fcb40-signing/signing-transcript.txt` | 2394 | `9d3939ab6f4dc215b927cbfb4b4e7c611cccfa31c1769c7762d2ddedd7ac2c80` |
| `v021-engineering-completeness-99e00e2b-signing/signing-result.txt` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-engineering-completeness-99e00e2b-signing/signing-transcript.txt` | 2393 | `d74d215a7acfa95e27ed4db1298d4ce4f267710247985b6a71197c7fc5be8758` |
| `v021-engineering-completeness-b7c7841d-signing/signing-result.txt` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-engineering-completeness-b7c7841d-signing/signing-transcript.txt` | 2396 | `443be116cfc41398bd7105280e42bbe70bd1e95733848ebdaedbca7421f7198c` |
| `v021-engineering-completeness-c583a53f-signing/signing-result.txt` | 16 | `856243237ff1a93634fa169c9a40543cd2e5514137b6e1f9c8cc61f92ed812ff` |
| `v021-engineering-completeness-c583a53f-signing/signing-transcript.txt` | 1211 | `f6fb95bbb1843761a519398a202a6802203c440473b72bffd52c7bf78be44263` |
| `v021-engineering-completeness-d5df0814-signing/signing-result.txt` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-engineering-completeness-d5df0814-signing/signing-transcript.txt` | 2396 | `d1abcdaa939ffe8979a4bf2207cff3a9dd8cfc38eb63b34b214e61e885c72b61` |
| `v021-engineering-completeness-daa64baf-signing/signing-result.txt` | 16 | `6b955c5bc8b071a67d2e6b4a10f3168799c2b1b59a14c3a01ff7f9e687edf980` |
| `v021-engineering-completeness-daa64baf-signing/signing-transcript.txt` | 2393 | `0b5f70f11203357e7d98fb99ee28523c183e74f61d61d7224b03dd680fa19638` |
| `v021-engineering-completeness-f7344143-signing/signing-result.txt` | 13 | `967982a421668f82b145674e36ef0c26774a6a85748eb0e45998addd98a7f668` |
| `v021-engineering-completeness-f7344143-signing/signing-transcript.txt` | 2396 | `6c974a925771abf92bcd89b3d66640a0596de0fabd320071eaa9e6fd0ce6c19d` |
| `v021-engineering-completeness-signed-matrices/recovery-matrix-exit.txt` | 27 | `d7cddef148ca8e44360edb84f88661f90e463d7cb9c846afefef4e25a9089fc4` |
| `v021-engineering-completeness-signed-matrices/recovery-matrix-transcript.txt` | 2038 | `a4c4d1f1b42d6b810112cae0c2aaf01734a373e7ffa2f519df2cb077e103e20b` |
| `v021-engineering-completeness-signed-matrices/route-matrix-exit.txt` | 24 | `690f9a5848c2dddcf6d901e08d73c9f8a9ca3c92a44ed1ee7fedaf3eaf4716ee` |
| `v021-engineering-completeness-signed-matrices/route-matrix-transcript.txt` | 2012 | `9aac8e07fd9be9b835b0caaddeb02abfd70d6e4278b5fa53b224db8853dc2975` |

### Nativeの再生成中間物

五つの既知`target/`内の通常File・hardlink数1で、拡張子が`.rlib`／`.rmeta`／`.obj`／`.exp`／`.lib`の中間物462件だけを回収する。これらへの現在の実行依存は確認されず、原Cargo返却中のPathはBuild履歴として保全する。全exe／dll／PDB152件と旧Owner・原記録は残し、約2MBしか減らない`.d`・fingerprint JSON・build診断等へ処置を拡大しない。

| 旧フォルダ（各`target/`） | 回収File | bytes | 回収集合Hash | 保全File | 保全集合Hash |
|---|---:|---:|---|---:|---|
| `chg-000082-native-capacity-261003` | 112 | 170923137 | `eff6f8ea95002fd5285f6a73f15623a59bb3294ace96bfbc681760eeca81cf65` | 491 | `069b3ecfa08a4c79195ac7f587cea30e969ebfcbaf8398562fb4c0fb7b901abb` |
| `chg-000082-native-protection-261003` | 79 | 119970100 | `d20f690ca9159e8ff2f08ee0a470722623b06d4ef39f8dd7b8aa1b14678825d1` | 383 | `5f3c7a4ee175daab1a28f24bdad8ee882005ac9d0c1f687dc523eec9f9057149` |
| `chg-000082-native-test-owner-261003` | 112 | 170923303 | `9f51d20e65390dce6590b7d3b95dd9fb6349867519a13fd80daf08b98cc36b56` | 489 | `19a488e988afe902d948117f4d73cea7d8a0ebc4e913e9d4f41b821368891365` |
| `chg-000082-terminal-current-261003` | 79 | 124477599 | `d59fb5ea0624b8efa55933a43713fe26f12fadae1921ed3a184ada8a1b717ee4` | 383 | `4e4d6821c2a8a59e78530779b8a458849fda2582c982fed0522a338f737476f5` |
| `chg-000082-terminal-publication-261003` | 80 | 124477863 | `33c6a3f4489c9fb3de3ade09a3705a1f4ee2cc672a97bd028bd205ea61d05db6` | 388 | `98faf86b91e33420f66fbaea542cb7e924348ce22e8bab8d1b762abbb799319d` |

集合Hashは各Fileのtarget相対Pathを`/`区切り、File Hashを小文字hexとし、`Path|bytes|SHA-256`をPathのOrdinal順に並べ、LFで結んだUTF-8（末尾LFなし）のSHA-256である。処置前に集合一致、全祖先とFileの非alias、非使用と排他openを確認する。回収後に保全集合Hashと対象の不存在を確認する。Target全体の再帰削除、`cargo clean`、親Root移動は行わない。EPERM三箇所と未知／参照中の対象は保全する。この処置は容量縮小であり、Native試験の移行・再実行や旧Root撤去ではない。

### TranscriptとNative中間物の回収結果

2026-10-06にTranscript側の22ファイル・空Directory10件・23,414 bytesを回収し、各不存在を確認した。原文はGitへ複製していない。固定された結果・失敗理由・終了値・原Hashを上記へ保存し、署名Manifestと完全Recorderは保全した。終了コード控え28件も、固定表33行と元28Directory／33Fileの不存在を独立確認し、限定Passとなった。

Native中間物は五つのtarget内の462ファイル・710,772,002 bytes（約678MiB）を回収した。最初の処置前照合はHash不一致で削除前に停止した。原因は行全体の並び順とPathだけのOrdinal順の差であり、固定規約へ合わせた比較で全集合一致を確認してから処置した。全Fileの非alias・hardlink数1、非使用・排他openと各削除直前Hashを確認し、再帰削除は使わなかった。target親Directoryは回収せず、保全File2,134件の集合Hashが全五領域で処置前後一致した。全実行物・Debug情報・診断・旧Owner・原記録を処置対象にしていない。

この回収はNative再実行入口の刷新や旧verification Root不存在を証明しない。固定Source13参照、旧実行物を使う診断、未解決Recorder3件、観測不能Fixture三箇所と残る旧版Runtimeは保全している。実OS端末・署名・Provider E2Eと④全体の完成判定は未成立のままである。

端末記録・保持の独立確認とNative中間物・利用側の独立確認は、ともに限定Pass、必須指摘0だった。前者は集約した署名Identity7件、失敗2件とMatrix断片の限界、原記録22件／終了控え33件の不存在を確認した。後者は保全集合2,134ファイルを全数再Hashし、全五領域で一致、回収対象拡張子の残存0、全exe／dll／PDB152件存在を確認した。Native SourceのHEAD差分なしと旧Path13参照の維持も確認した。処置前の排他性を独立再実行した結果ではない。

処置後の旧Rootは上位48フォルダ、読取り可能3,586ファイル・1,052Directory・788,742,700 bytes（観測できた下限）である。観測不能3箇所とalias 0を別々に記録する。元の上位116フォルダから今回までに68フォルダを回収した。最終文書Checkerは1173 Markdown・18508リンク・2345アンカー、Error／Warning 0、差分検査も成功した。Native固定試験の再実行入口整備・残る旧Runtimeの退役と旧Root撤去は未完了である。

## Native保護試験の正式入口と終了処置

自己生成対象の保護・共有拒否一件だけを正式TS入口へ接続した。他の固定Native診断や旧verificationの物理領域は置換・削除していない。初回実測は正常親一件、二回目は正常親一件・Root／run／exe／cwd不一致の拒否四例・Case 0件を合格にしない反例を確認した。静的型・Formatter・Lint、Rust Clippy（Warningを失敗）と新Buildを先に実施した。

| 前回run | 正式結果 | 結果SHA-256 | 再生成物の処置前集合 |
|---|---|---|---|
| `native-protection-d34db0a0-7075-4343-8469-294247634f73` | 正常実測（本書の正式要約へ集約） | `630c501018f564e1dc8379c1fce8c0ef9877fef84cb26e5a3d59cf9b4c70628a` | 782 File・116 Directory・262518758 bytes、集合Hash `6be7a59a3d39264f69bc35f4e6e1ac206ca849a637be8ba4ebc91f4aff9ac3f5` |
| `native-protection-f3102251-221e-44f7-bf42-2dd2a66ce11e` | 正常と拒否反例（本書の正式要約へ集約） | `3e10db80ebcd72bd8c19ee61ab63639d8a0b956ef6e3b1c386d9aee0fdbe8ec4` | 782 File・116 Directory・262535664 bytes、集合Hash `5928d81fecd3a22fd7cf321e5897ebf19d356732bf9aff2f59899addcf8a7a78` |

結果はbyte不変で正式保存した。両結果は当時の直接入力15件を保持し、後から追加した`build.rs`／`rust-toolchain.toml`を確認済みへ書き換えない。独立レビューでpackage cwdの競合、表の分断、直接入力二件の不足と終了処置未接続を検出した。指定箇所を是正し、Workflowで前回の正式保存・終端・参照・非使用確認・exact回収を必須にした。新入口は前回残存で新run生成前に停止し、最初に秘密・Host絶対Pathを持たない`started.json`を保存する。

成功・Build失敗・中断を模した局所fixture三状態で、同じpreflight関数が新規生成0・元bytes不変で拒否した。直接入力の同じHash判定関数で一致・差・読取り不能を確認し、契約試験2件は成功した。模擬状態の確認を実Build失敗／実中断後の回復成功へ読み替えない。package入口もRepository Rootへ到達し、未処置の前回二runを拒否した。

回収前の照合ではCargoが生成したhardlink対を検出し、通常File条件では削除前に停止した。BigIntのFile Identityで再観測し、各run内24 Path／12組のexe・PDB対だけが`nlink=2`、全リンクが同じexact run内で閉じると確認した。Number精度によるIdentity比較は使わない。集合Hash規約は上記Native中間物と同じであり、bytesはPathごとの合計で物理容量ではない。

この二runだけは、実行Process／現在参照なし、正式結果のHash、非reparse・既知リンク閉包、排他open、削除直前Hashと残るリンク集合を確認して、leaf Fileと空Directoryを非再帰で回収する。未知リンク、参照中・観測不能では停止する。旧領域・他run・署名・認証・Dockerへ操作を拡張しない。物理回収と是正後package実測の完了は後続記録で判定する。

### 是正後の実測と回収結果

前回二runは上記の照合後にそれぞれ782 File・116 Directoryを回収し、Rootの不存在と正式結果の保全を確認した。その後、是正済みpackage入口から`native-protection-7d17427f-8e2c-47c1-b8d5-fba0f11bc9ae`を実行し、終了値0を確認した。Root／run／exe／cwd不一致の拒否四例、Case 0件の拒否、正常親一件を確認した。正常観測は113msで、親／子終端、worker終了値71／72、handle close、fixture不存在と入力不変を確認した。Production統合、親消失時の回復、署名またはProvider E2Eの成立は主張しない。

| 正式保存物 | SHA-256 |
|---|---|
| 是正後の実測結果（本書の正式要約へ集約） | `86cb1ceb4ca24a937d97f5a7b63f392516331991764a9bdf66615c1a382f3897` |
| 開始記録（本書の正式要約へ集約） | `a869c92cbf5e2273aa7d8776b69d8fd4e543801b47013c65ef8e41740ecd785f` |

実測OwnerのSHA-256は`0ee73a702288d518785313371f6953701c87c7a7248a152e4fb9da6f63b365ff`、Rust fixtureは`be1595514788b07342158330192446e5dedece1fcdae67a539917b05c0a79d07`である。直接入力17件には`build.rs`と`rust-toolchain.toml`を含む。正常Case前後の不変確認をBuild工程全体の不変保証へ広げない。

最新runも二つの記録をbyte不変で正式保存してから、非使用、全FileのHash、非reparse、同じrun内で閉じるhardlink12組、排他openと各削除直前の状態を照合し、783 File・116 Directoryを非再帰で回収した。処置前集合Hashは`84990273972a6f1d3aba0b4c5d80ae4e4da7df7df6c77fdb6e51cfdaf502ce46`、Path bytes合計は262519781である。三つの今回runは全て不存在、正式保存した四記録は保全済みである。旧verification内の固定試験物や観測不能対象はこの処置に含めない。

## 移管JSONの正式要約と終了処置 — 2026-10-07

人間承認により移管JSON46File（Recorder14実行42File、Native4File、157,884 bytes）を恒久保存せず、本節と既存Native実測節へ集約する。前節の移管先・Hashとbytes不変保全の記載は当時の履歴であり、現在のFile存在を示さない。過去の判定・時刻・版・限界を変更せず、現在版のPassへ昇格しない。

### Recorder実行別の根拠

時刻はUTC。開始・結果・完了は同じrecordIdと開始時刻に結合し、完了記録のresultSha256を結果FileのSHA-256と照合してから回収する。repositoryAtStartは実行版の証明ではない。署名Identity未記録やunknownは推測で補わない。

| 元実行参照 | 開始 → 終了 | 種別 | 過去の結果／理由 | 完了／試行 | 原結果の対象版 |
|---|---|---|---|---|---|
| 0f6d3947-810a-4b78-ae65-22e2ce682e75 | 2026-09-12T05:10:00.567Z → 2026-09-12T05:21:57.891Z | routes | completed / signed_route_matrix_completed | 4/4 | Commit 672a3e76c8607ced6ab2abaaeaa09a0e848de3d0 / Manifest 36cd6852de5048e885cf947a72436dee355f414e94b51f3f92fbcb9522e5a8fb / 実行Commit 672a3e76c8607ced6ab2abaaeaa09a0e848de3d0 |
| e5da5210-b402-4a67-a7d2-b06868dc4690 | 2026-09-12T05:21:58.645Z → 2026-09-12T05:22:36.653Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| ab5f2da9-0154-4c78-bb68-b799ae8bd4ee | 2026-09-13T14:52:48.672Z → 2026-09-13T14:53:34.753Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| c79d2537-9854-47b3-bdec-50be729a6835 | 2026-09-13T14:35:29.994Z → 2026-09-13T14:46:39.455Z | routes | completed / signed_route_matrix_completed | 4/4 | Commit be8f93540b64a7bdfdff578b349fac43530c6efe / Manifest 57f6c47b8da94a99376f0384b5a9af3d03856d7cf7f0363b29ee2faa7aad947d / 実行Commit be8f93540b64a7bdfdff578b349fac43530c6efe |
| bfa25994-d041-4902-875a-d02b32a55d84 | 2026-09-20T17:03:28.264Z → 2026-09-20T17:03:59.387Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| 4480ca02-e4af-4cc8-b8cb-d483fd7883e2 | 2026-09-20T17:50:31.621Z → 2026-09-20T18:01:35.013Z | routes | completed / signed_route_matrix_completed | 4/4 | Commit e38f42af4b63c7cbbeffb20acd27f290e0568a7a / Manifest c7b102dbddec239c7115913b321151eb733ca5c0e3e2c60479c33826bc524ed3 / 実行Commit 9d2a441322a658d7f48c3065665385ec0e1ae46d |
| 750919c2-114a-4c9e-b8ec-c80dc715d9d4 | 2026-09-20T17:44:21.261Z → 2026-09-20T17:49:25.644Z | reviewer-boundary | completed / signed_reviewer_boundary_integration_completed | 2/2 | Commit e38f42af4b63c7cbbeffb20acd27f290e0568a7a / Manifest c7b102dbddec239c7115913b321151eb733ca5c0e3e2c60479c33826bc524ed3 / 実行Commit 9d2a441322a658d7f48c3065665385ec0e1ae46d |
| 9ed009ad-54c8-46fd-9379-8186f08a96ef | 2026-09-20T23:25:39.169Z → 2026-09-20T23:26:14.252Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| d4febf8d-537a-44ae-bb3f-677ab33718d5 | 2026-09-21T04:06:50.087Z → 2026-09-21T04:13:13.625Z | routes | completed / signed_route_matrix_completed | 4/4 | Commit f12d6dcef30b6b34c8d806d7001519d7a7cda18a / Manifest 949acd7444c1f1b766328216f9c960f15e91a87a6e18959f3f5c4769298b5b76 / 実行Commit 44949b7fe703c6f0ad48d8d154cb14cd5984ed58<br>Package Content Root 3da17a1da394e5d548062c5648ab1544c49fd39f7d61f309dc56f44ae6163e1c / Runtime Execution Identity f91a18db4cd2aeae1b5aa5f35144f5b059da771b921f170dfa79bf351bf4c1b3 |
| 468082f5-63c6-489d-af86-00bc628241fc | 2026-09-24T10:19:53.414Z → 2026-09-24T10:21:51.759Z | routes | blocked / signed_route_matrix_incomplete | 0/1 | Commit 01eb00a63dcab09b4b32a41bf142bab70897cd8c / Manifest 6b0a08c081c836d321526ecf32d716ae6e64754dd9b5e59a4019bc537cd6f352 / 実行Commit 7362268eecbbc744fc08f809a3a0976fe16ac805 |
| 144359d8-d916-4228-b6a6-f78bb1a46143 | 2026-10-04T12:10:06.884Z → 2026-10-04T12:12:05.840Z | reviewer-boundary | blocked / signed_reviewer_boundary_integration_incomplete | 0/1 | Commit d36a9dec73250705019ab97e7a3c1cfd85b09292 / Manifest 1087e142ccd5731a7cbb1772335135fd7be9ef63ca66156a0d918988b50984d1 / 実行Commit a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2 |
| 5ed92d8c-2dd7-41ae-9d37-b6d1c2fbcd01 | 2026-10-04T12:12:11.519Z → 2026-10-04T12:12:54.193Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| 8a651704-41ca-4290-948b-521f63008253 | 2026-09-24T10:18:35.916Z → 2026-09-24T10:19:06.125Z | recovery | completed / signed_recovery_matrix_verified | N/A | 署名Identity未記録 |
| d7aa9851-0054-4d47-b021-1afb5d65b14d | 2026-09-24T10:23:02.444Z → 2026-09-24T10:30:28.909Z | routes | completed / signed_route_matrix_completed | 4/4 | Commit 01eb00a63dcab09b4b32a41bf142bab70897cd8c / Manifest 6b0a08c081c836d321526ecf32d716ae6e64754dd9b5e59a4019bc537cd6f352 / 実行Commit 7362268eecbbc744fc08f809a3a0976fe16ac805 |

### 統合した検証内容と限界

14実行は結果返却、cleanupConfirmed=true、manualRecoveryRequired=falseだった。これは当時の結果で、現在実資源の再観測ではない。回復Matrix以外はprocessRestartRequired=false、effectStateUnknown=false、recoveryIdentityAmbiguous=false、canonicalRepositoryChanged=false。回復Matrixのそれらの未記録値は未確認のまま保持する。resultsComplete／scenariosComplete／recoveryFieldsCompleteはtrueだったが、個別観測のnullやunknownを補完する根拠にはしない。

| 対象 | 保存する観測・限界 |
|---|---|
| 完了した四経路Matrix | forward／reverse／same-codex／same-claudeの4/4完了、retryableRouteAttemptCount=0。各結果は候補内容一致・候補破棄、cleanup確認、手動回復不要、正本変更なし、是正なし。Reviewerの細かい判断や投影分類は未記録。 |
| 完了したReviewer境界 | 2/2完了、cleanup確認、手動回復不要、正本変更なし。細かなReviewer判断は未記録。 |
| 未完了の四経路／Reviewer境界 | 1試行・0完了、coordinator_task_external_send_confirmation_timeoutで停止。四経路はforwardのroute_nonconforming、retryableRouteAttemptCount=0。候補破棄=falseを候補残存の証明にしない。未完了義務を残し、cleanupから検証成立を推定しない。 |
| 回復Matrix共通 | timeout／output_limit／invalid_output／nonzero_exitはそれぞれdocker_isolation_probe_timeout／docker_isolation_probe_output_too_large／docker_isolation_probe_invalid_output／docker_isolation_probe_failedでblocked、Operation Directory残存=false。cancelはdynamic_fake_provider_cancellation_verifiedとしてverified、Directory残存=false。模擬Providerの試験であり実Provider取消の成立ではない。個別cleanup fieldは未記録であり、全体cleanup=trueと同一視しない。 |
| cleanup観測不能後の再入場 | freshRecoveryCompleted=true、Directory残存=false。初回判定・詳細はRecorder未記録で復元しない。 |
| 親Process消失後の再入場 | childProcessTerminationObserved=true、freshRecoveryCompleted=true。Directory残存と個別manualRecoveryRequiredは未記録。 |
| Native三実測 | 前節の正常／拒否反例、直接入力15件→17件、Owner／fixture Hash、処置後不存在を維持する。最新runは2026-10-06T10:05:29.960Z→10:05:30.073Z、Root・run・exe・cwd不一致とCase 0件を拒否。handle close、worker終端、fixture不存在を観測。Production統合・厳密期限保証・親喪失回復・署名E2Eは未成立。 |

原HashとOwner対応は前節の固定表を参照する。Hashは削除前の原物識別であって、削除後のbyte単位再検証可能性を意味しない。重複本文は新しいJSON／JSONL書庫や実行別MDへ移さない。今後の段階結果はRepository-local .crdd/testsで一時保持し、対象版・確認内容・結果・限界だけを既存CHG／Release根拠へ昇格する。他の正式機械根拠を一律に廃止しない。

2026-10-07、全46Fileの許可Root内実体、祖先非alias、通常File・hardlink数1とProcess参照0を確認した。Recorder14実行のrecordId／開始時刻／完了記録のresultSha256相関は全件一致した。限定独立再レビューPass後、削除直前の全Hash一致を再確認してexactな46Fileを回収し、全件不存在を確認した。新しい書庫・移行JSON・実行別Evidenceは作成していない。

処置後のCheckerは1173 Markdownを確認し、今回のJSON案内・集約先リンクに指摘0、Release Evidence案内不足も解消した。全域には先行変更の旧入口／旧Build関連リンク8件と、Quality Relation・件数・適用判断8件の計16件が残る。今回の限定Passを全域Passへ拡張しない。差分の空白検査は成功した。

## Checklist

- [x] 署名済み展開Treeと再生成archiveを区別した。
- [x] 現行E2E入力、固定Native試験物、唯一の根拠と観測不能対象を保全した。
- [x] 署名本体と端末補助の責務を分け、新しい回復Frameworkを作らない方針を固定した。
- [x] 固定入口の局所実装・19件回帰・二観点の独立確認を完了して結果を記録した。
- OPEN: 実Windows端末と正しい固定版での既存Signer試験1件は、必要な次候補の検証へ接続する。旧版Fixtureの拒否を鍵不一致Oracleの合格へ読み替えない。
- [x] 対象archive4件の削除直前確認と終了後不存在を確認し、回収結果を記録した。
- [x] 新規試験結果保存を`tests`へ切り替え、正式根拠の昇格・受理・安全清掃を規則、詳細設計、Workflowと配布入口へ伝播した。
- [x] 同一Repositoryの正式根拠を要求し、別Rootの同Hashを受理しない反例を検証した。
- [x] 47件の局所回帰と二観点の独立再確認を記録し、実E2Eや物理回収と区別した。
- [x] 旧Recorder14件の正式根拠を移管し、不要16件を回収、未解決3件を保全して二観点で独立確認した。
- [x] 古い終了控え・端末記録を必要情報へ集約し、38フォルダと55ファイルを限定回収した。
- [x] Native中間物462件だけを回収し、保全2,134件のHash不変を独立確認した。
- OPEN: 未判定の残るRelease／tests、旧`verification`原記録と固定Native利用側は、後続の参照終了確認まで保全する。
