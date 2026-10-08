# Develop責務・依存関係の対応案

成果物種別: 変更計画・現行調査
状態: Draft（Architecture採用・実装移管は未完了）
対象変更: [CHG-000082](../change.md)
基準改訂版: `76d2c03603922512fa128a60f81b615073dc3a73`
維持責任者・採用決定権限: Qual-Lab

## 親フォルダ移動の到達点 — 2026-10-09

人間の指示に従い、個別File責務精査より先に残る親フォルダ移動を実施した。`40_Develop/mcp`を`40_Develop/mcp-server`へ、`40_Develop/workbench`を`40_Develop/workbench-server`へ移動した。移動前後60Fileの対応を照合し、欠落0件。MCPの30Fileは内容不変、Workbenchの24Fileは内容不変、6Fileは物理Path参照・表示例・生成Bundleの更新である。package名、Protocol、Tool、SymbolおよびCanonical IDは変更していない。

直接import、Tool入口、配布閉包、CheckerのPath認識、Test CatalogとRunnerのOwner→物理Path対応を更新した。Owner名は維持する。過去対象版の記録は一括置換しない。移動後のMCP／Workbench／Runnerの静的確認、CROS／Checker／Orchestratorの型確認、Workbench build、差分空白確認は成功。MCPは50/50、Runnerの対象契約は37/37成功した。WorkbenchのIntegrationは32/33成功後、残る一契約を文書修正後に再実行して成功した。前回のProject Context整理で欠落した必須表と日程リスク表示を修復し、検査を弱めていない。Coordinator全試験型の既知18指摘は持ち越しのままである。

最終確認ではWorkbench Integrationを全件再実行し33/33成功した。限定独立レビューでRunnerの試験段階Path判定に旧Parent語彙一件を検出したため、新名へ追従し、両Serverの誤段階申告を拒否する反例を追加した。Runner静的確認と台帳21/21が成功し、限定再レビューPass・追加必須指摘0件となった。

物理的な親フォルダ移動の区切りに到達したため、ここで停止する。全親フォルダ内のFile名・個別責務・追加移動の精査は未着手。CROS REST／Gateway撤去、利用側の機能再編、5C、全体回帰、署名E2EおよびCHG全体は未完了であり、この移動確認をその完成証明へ拡張しない。

## 持ち越しの処置 — 2026-10-09

人間の承認により、Orchestrator／Coordinator／Dockerの追加是正を大規模改修への入力として持ち越す。[判断の正本](../change.md#持ち越し判断--orchestratorcoordinatordocker2026-10-09)に従う。以下の過去の「次に実装する」「判断待ち」は現在の実行指示ではない。実施版・期限は未設定、担当責任者・再開判断者はQual-Labである。

確認済み: 段階1〜4、5A／5Bの局所完了。同Process配送、新Processの受領・終了、保存途中の再入場、履歴相関が残る下位整理後再入場は局所試験・限定独立レビューで確認した。実Docker、全体回帰、全Source独立レビューまたはRelease成立へ拡張しない。

| 持ち越す残件 | 現在の限界・改修への入力 |
|---|---|
| 履歴相関欠測・marker残存 | 保持期間後の再入場と下位出版後marker残存は未完了。履歴必須条件を変える案は未採用・未実装。 |
| 実資源の回復接続 | 現行Repository Snapshotとexact Identityへの切替は未完了。旧AppData回復入口を置換済みとしない。 |
| 旧入口・旧試験刷新 | 旧二試験Fileの型指摘18件が残る。互換shimで隠さず、改修時に新契約へ対応付ける。 |
| 本番利用側の一体接続 | 局所成立を全Consumerの成立とせず、未接続範囲と必要な回帰を維持する。 |
| 全体・実境界の検証 | 全回帰、Reality Audit、固定全Source独立レビュー、実Docker・署名E2Eは未完了。 |

| 段階 | 持ち越し後の処置 |
|---|---|
| 1〜4 | 確認済みの設計・限定レビューを保持。大規模改修で意味が変わる範囲は再照合する。 |
| 5A／5B | 局所完了の範囲を保持。全体完了には拡張しない。 |
| 5C | 追加是正を持ち越し。未完了のまま保持する。 |
| 5D〜F | CROS／MCP／Workbench等の独立した整理は継続候補。Coordinator呼出し・実行契約・配布閉包に依存する部分は保留し、着手前に処置を分ける。全移管後のFile責務精査前停止は未到達。 |
| 6 | 全体回帰・Reality Audit・固定全SourceレビューのGateは未達。独立範囲の確認と全体完成を区別する。 |
| 7 | Runtimeに依存する署名・実AI・回復E2Eを持ち越し。既存結果は旧対象版の根拠として保持する。 |
| 8 | CHG全体の完了・Release判断は未成立。持ち越しを検証免除にしない。 |

再評価契機は大規模改修の目的・責務・維持Capabilityの確認、または現行Runtimeを必要とする計画・Release判断である。今回Source・Architecture契約・QA期待値は変更しない。

## 新Processの再開接続の順序 — 2026-10-09

旧回復入口はAppData形式を読んでおり、現行Repository内Snapshotへ切替が必要である。着手前の読み取り専用照合で、現在RootのSnapshot Readerと固定上位ACK Readerは再利用できる一方、元Host・Controller結果へ依存した終端限定Contextは新Processで未成立と確認した。保存値から旧Capabilityや真正結果を偽造しない。

| 順序 | 処置・完成範囲 | 現在状態 |
|---|---|---|
| 1 | 現在Rootから登録済み結果参照を読む。元要約・必要集合を同Processと共通検査し、処置Authorityを作らない。 | 内部Reader・子Process読取り・拒否時の本文保全を接続。最新実Filesystem二契約成功（89,219.3014ms、失敗・取消・skip 0）、対象静的確認・固定三Fileの限定独立レビューと試験差分再レビューPass。 |
| 2 | 保存済み終端・清掃・解放・Owner無効化・要約／履歴を照合し、同じ元版と対象だけへ結合した終了限定Contextを取得する。 | 準備入口を接続。準備だけでは状態更新せず、受理・整理は順序3の限定Writerへ接続する。 |
| 3 | 上位の保存済みACKをfresh取得し、同じ結果の受理と操作整理だけを接続する。 | 終了限定Writer、本番上位の受領・終了二経路、別Processのpending再構成を接続。履歴相関が残る整理後の再入場も局所試験・限定独立レビューPass。履歴期限後と出版後marker残存は未完了。 |
| 4 | 実資源が残る対象を、現行Snapshotのexact ID・固定計画と既存回収Ownerへ接続する。 | 未実装。配送待ちの終了と混同せず、未知Createを名前だけで解決しない。 |
| 5 | 上位組立て・旧試験を新経路へ切り替え、旧AppData回復入口・領収書finalizerを撤去する。 | 上位の受領・終了組立てを新形式へ切替済み。実資源回収の旧入口と旧試験刷新は未完了。旧形式fallbackを作らず、CLI／Workbenchへ耐久ACKを要求しない。 |

新しいState・Registry・Lock・汎用Recoveryは追加しない。順序1の読取り成立をfresh ACK・回収・5C全体の完成へ昇格しない。

整理後に上位確定が中断した場合の限定接続を追加した。固定上位Readerの十一項目ACKと現在Repository結合、対象回復ID／nonceを持つ操作・回復・配送参照の明示不存在、既存終端履歴のexact回復ID・結果Hashを共通Readerの既存Kernel Lock内で確認する。状態と履歴の安定Identity、排他解放が共同成立した場合だけ配送残件不存在を返す。上位終了はContextを再構成できない場合だけこの観測へ進み、Task再実行・本文更新・旧Capability復元を行わない。実Filesystem二契約と上位接続一契約は成功（100,338.1419ms、失敗・取消・skip 0）。同じ整理済み状態を新子Processで確認し、不正ACK・別Hash・別結合・履歴欠測／重複・pending・対象残存を拒否した。上位の専用追加反証一契約（226.9651ms）、標準入口一契約（457.3147ms）、ACK共用化後の既存モデル四契約（309.7472ms）も成功した。Source型・対象Biome・差分確認は成功し、全Test型は旧二Fileの18指摘のみ。固定六Fileの限定独立レビューPass・必須是正0、始終Hash一致。Source `E9605FC7…AFB7`、モデル `7CE37C53…5D6E`、実試験 `5F54E54C…D1F1`、上位Source `9DB705C2…BAC2`、上位試験 `EFC987D0…4DC1`、Architecture `63DFC68D…28D4`。実試験中の変更はHelper Header追記のみで処理意味・期待値を変更していない。この結果を実資源清掃・過去のProducer ACK保存・Task成功・全体E2Eへ昇格しない。履歴保持期限後の相関欠測、下位出版後marker残存、実資源回収と旧入口／試験刷新は残る。

保存途中の別Process再入場は、終了限定入口だけで既存`state.pending.json`と`state.lock`を照合する形で接続した。LockはRepository結合を含む固定本文・通常File・単一リンク・安定Identityを要求し、候補は固定上位ACKから導出した受理候補または受理済み現在版からの整理候補へ完全一致させる。通常Readerの拒否、準備時の本文不変、Writer内でのfresh照合を維持した。初回二回の局所試験では既存Lockマーカーの一律拒否により準備が停止したため、終了限定の正規マーカーだけを確認するよう是正した。最新版の実Filesystem二契約は成功（113,688.7646ms、失敗・取消・skip 0）。新子Processの受理候補／整理候補からの再開、別マーカー・不正候補・Reader欠測の拒否と本文保全を確認した。Source strict型・対象Biome・差分確認は成功し、全Test型は旧二Fileの既知18指摘のみ。固定Source `DD9A4C2B…FC05`、試験 `90EB56FE…4AA`、Architecture `2818C60E…3BEA`の限定独立レビューPass・必須指摘0。未受理現在版と同じpendingを無条件に処置する一般経路は、正規Writerからの再現例を確認できず追加していない。整理後の上位確定中断、保持期限後の相関欠測、実資源回収と5C全体は未完了である。

中断後のSource照合では二つの欠落を確認した。`readCoordinatorStateSnapshot`は`state.pending.json`を一律に拒否し、新Processの準備が既存Writerへ到達しない。さらに`prepareRuntimeOwnedCoordinatorRecoveredSettlement`は現在操作を要求するため、下位整理成立後に上位確定が中断すると再入場が停止する。着手前の読み取り専用確認により、保存途中は現在版・固定ACK候補・現在ACK版からの整理候補への完全一致を限定準備へ渡し、整理後は固定上位ACK・現在参照不存在・既存履歴要約Hashを共同確認する最小経路を選んだ。履歴を資源配列の代替にしない。30日等の設定保持期間後に相関行が整理された場合の終了保証は未成立であり、保持契約との整合を残件として明示した。Owner設計へ三段落を反映し、固定Architecture `3D9BF72F…05E73`の限定設計レビューはPass、必須指摘0。実装・局所反証・Sourceの独立確認はこれからであり、設計の確認だけを回復成立とは表示しない。

上位の受領・終了接続は、本番組立てが固定したRoot・Repository結合と同じ一回取得の安全な入力Snapshotへ限定した。受領側は上位exact世代・Task・Attempt・settled義務を確認し、下位の五項目参照と排他解放を照合する。終了側は十一項目ACKを正規decoderで照合し、保存済みacknowledged義務の全項目一致と固定八項目Readerを終了限定Writerへ渡す。下位のcompleted・保存確認・排他解放がすべて成立した場合だけ閉じた終了結果を返す。旧AppData領収書への接続とfallbackはこの二経路から除いた。

接続試験と既存Objective／回復試験の三Fileは16契約成功（99,932.0028ms、失敗・取消・skip 0）。独立レビューで、固定コピー前の元入力読取り一件を検出し是正した。getter／Proxy／nullのEffect前拒否、下位読取り中の元入力変更でも初回相関を保持する反証を追加し、限定再レビューPassとなった。是正後の専用接続試験は直接一契約成功（210.267ms）。下位Root・Filesystem・Writerはこの接続試験では模擬であり、別試験の実Filesystem成立と合算して実Docker成立を主張しない。標準runner用の自己試験子Processでは、初回に継承された試験環境による再帰skip警告を検出したため、試験環境を分離し子試験実施と終了結果を確認する形へ是正した。通常入口一契約成功（469.6665ms）、直接入口一契約成功（194.6159ms）。新試験を既存カタログとSymbolへ登録し、カタログ構造指摘0・両Source型・対象Biome・差分確認は成功した。登録・試験入口の追補限定レビューもPass、必須指摘0。保存途中のfresh再入場、下位整理後に上位確定が中断した場合、残存実資源回収、旧試験刷新と実E2Eは残る。

順序3では、同じ私有Contextの固定元版・ACK候補・整理候補を共用Writerへ接続した。受理保存の成功・本文確認・排他解放がすべて成立した場合だけ、その確認済みACK版を整理の元版とする。Writerは更新Lock内で元版または自分の候補との完全一致、固定Readerのfresh ACK、既存モデルのexact候補、登録済み終端・履歴相関を照合する。元Host／Controllerの観測を保存値から偽造せず、旧live経路の真正条件を維持した。実子Processで受理・整理・同Context再入場を実行し、整理後の新Context生成を拒否した。親の実FilesystemではReader欠落・例外・読戻し変化、偽Context／live混用、受理出版失敗、受理後の整理出版失敗、各段の出版後排他解放欠測、失敗時の本文保全と同候補再入場を確認した。履歴は再追加・改変していない。下位Dockerと上位ACK本文は模擬境界であり、本番fresh組立て・実資源回収・旧入口切替は未完了である。

追加試験の型確認ではモデル関数のimport漏れ、Lintでは試験変数の型注記不足を是正した。排他欠測反証の初回再試験は、共有試験カウンターが後続live試験へ残り一失敗となった。追加ブロックの終了時に既定へ戻して再実行し、最新二契約が成功した。Runtime条件の緩和はない。Source `0196B2AA…F80786E`、試験 `6C32902B…9E55C66`、Architecture `EB307366…70CD80`の固定版を限定再レビューPassとした。Source型・対象Biome・差分確認は成功し、全Test型の旧二File十八指摘は維持する。以下の順序2時点の「ACK・整理未完了」は内部Writer範囲について本段落で更新する。

順序2では既存私有Contextを`live / recovered`へ分け、元Owner用の全十一入口を`live`取得へ限定した。新Process用結合は元管理Capability・Controller結果を復元せず、現在Rootと保存済み終端、登録済み結果、確認済み履歴相関と固定Readerだけを保持する。Readerは準備時に呼ばず、状態・履歴の本文は更新しない。親と新子Processの準備成功、コピーRoot・不正参照・Reader欠落の拒否、元live終了入口への混用拒否、本文不変を確認した。初回追加実試験は一失敗だったが、子Processの起動方式を既存成功試験と同じstrip-types＋async IIFEへ揃えた後、二契約成功した。具体的な初回失敗原因は未断定であり、Runtime条件の緩和はない。Source `E48128E7…2BA5F3`、試験 `90D614E5…711744D`、Architecture `59EDEA60…CCBACC`の固定版を限定独立確認した。対象Source型・Biome・差分確認は成功し、全Test型は旧二Fileの既知十八指摘だけが残る。ACK保存・操作整理・新Process保存途中の再入場・残存実資源回収は未完了である。

追加試験の初回静的確認では既存変数との名前衝突を是正した。最初の実試験は二契約成功したが、資源不明反証に非正規状態値を使用していたことを再照合で検出し、正式`unknown`へ修正して再実行した。受理済み参照の読取りも追加した。unknown反証は「不明資源を含む不整合Snapshotから参照を返さない」範囲であり、拒否原因を資源条件一つだけへ限定した実証ではない。Source Hash `9F50D643…4478A`、最終試験Hash `68B68A95…8086DA`、Architecture Hash `893435B5…477A2`は固定値と一致。下位資源・Providerは使用せず、fresh終了処置の確認は残る。

## 本番同Processの結果配送接続 — 2026-10-09

本番組立てを、Task開始直後の元Control捕捉→全結果参照の読取り→上位終端とACKの同世代保存→固定Readerによる下位終了整理へ接続した。通知はAttempt内で一回だけ受領し、捕捉・通知例外でも元Taskの完了・取消・清掃待機を続ける。公開結果へ閉包やCapabilityを追加せず、新しい共有State・Registry・Lockも作っていない。

| 確認 | 根拠と限界 |
|---|---|
| 局所反証 | 実Filesystemを用いる十二場面と同期捕捉の二契約が成功（47,072.882ms、失敗・取消・skip 0）。二重通知、捕捉欠落、読取り失敗、誤操作・重複参照、Reader構築例外、保存前失敗・保存後応答不明、部分整理失敗、取消を区別した。下位Ownerは模擬であり、実Docker成立ではない。 |
| 関連回帰 | 最新接続のTask Runtime・単一Task Adapter・上位実行・本番組立ての四Fileは251契約成功（234,364.9485ms、失敗・取消・skip 0）。全Repository回帰や実Provider試験ではない。 |
| 保存と整理 | 保存未確認では下位completeを呼ばない。部分整理失敗でも全件読取りを繰り返さず、保存済みACK・元Task結果・下位pendingを維持する。Taskを再実行しない。 |
| 是正 | 初回追加試験で、十一項目ACKを八項目の固定Reader構築へそのまま渡す不一致を検出した。構築入力を八項目へ明示抽出し、拒否条件を弱めず再確認した。 |
| 静的確認 | 対象Source型・Biome・差分確認が成功。Coordinator全Test型には旧二Fileの既知18指摘が残り、全Test型成功とは表示しない。 |
| 独立レビュー | 固定十一Fileの限定独立レビューPass、必須是正0。対象Hashの一致を確認した。同Process接続の評価であり、fresh Process、旧回復入口切替、実Docker／E2E、5C全体は対象外。 |

結果参照0件の`not_required`は、真正Taskの清掃済み終端・所有操作なし・両handoff集合0件だけを表す。Provider Effectなしの証明ではない。別Processからの再開と旧回復入口の置換、旧試験刷新、実境界確認が残る。以下の2026-10-08時点の「本番未接続」は、この同Process範囲について本節で更新する。

## 通常Taskの受領本文と上位保存接続 — 2026-10-08

通常Taskの受領は回復義務へ偽装せず、既存Taskの必須`resultAcceptances`配列へ分離した。新しいFile・State台帳・Registry・Lockは作っていない。初期生成・新Attempt・回復後ready・Owner喪失・再計画／置換へ空配列を伝播し、旧受領を再利用しない。

既存Snapshot Writerは元世代の次世代一件だけを受け付ける。この実契約へ合わせ、受領集合は未保存の通常終端候補へ一括固定し、終端とACKで世代を二度進めない。同じ本文の再入場は初回受領世代を維持する。保存codecは欠落・旧形式・重複・未来世代・別Attempt等を拒否し、固定Readerは通常受領と回復ACKを明示分岐する。物理Writerも同Attemptの集合本文不変を照合し、初回ProjectのACK持込みを拒否する。正式な失敗Task置換だけは旧ACKを空にでき、新Taskへ継承しない。有限履歴は既存終了要約だけを維持し、受領本文の書庫にしない。

| 確認 | 現在の根拠と限界 |
|---|---|
| モデル | 正常・失敗・取消、0／1／2結果、初回世代、同じ本文の再入場、別対象・重複・未清掃の拒否を追加した。最新Orchestrator試験本体82契約が成功（6,299.9362ms、失敗・取消・skip 0）。全Repository回帰ではない。 |
| 固定Reader | 追加反例を含む専用一契約が成功（450.4705ms）。通常／回復の重複、非終端、未清掃、未解決、読取り失敗を成功へ補完しない。保存Readerは明示模擬である。 |
| 実保存 | Windowsの自己所有Git Rootで、通常終端＋二結果ACKを同じSnapshotへ保存・排他解放後読戻しする一契約が成功（3,687.1379ms）。欠落、重複、別対象、集合内世代不一致、同Attempt本文変更・部分削除、初回ACK持込み等を拒否し元bytesを維持した。順序変更と実再計画関数による置換保存は成功し、固定Readerから保存済み本文を取得した。Docker・Providerは使用しない。 |
| 型・Lint | Orchestrator型、対象Biome、Coordinator Source型・差分確認が成功。Coordinator全Test型は旧二Fileの既知18指摘だけで、新規指摘はない。 |
| 独立確認 | 固定七Fileの限定再レビューPass・追加必須指摘0。集合内世代不一致、物理Writerの本文変更許可、正式再計画の遮断、初回ACK持込みを是正し再確認した。最新保存Source `6F410F2E…0BE39`・実保存試験 `F2EF8C6D…640B7E`の終了Hashは一致。全体完成へ昇格しない。 |

是正中の型確認でTask IDの誤fieldと試験consumerの文字列型拡大を検出し修正した。最新版では新規型指摘はなく、旧二Fileの既知18件だけが残る。

本番組立てのTask捕捉→全結果読取り→上位終端＋ACK保存→下位受理・終了整理は未接続である。新配列の保存確認だけから実Provider E2E、fresh Process回復または5C完了を主張しない。旧保存形式の物理移行はフロントAIへ委ね、Runtimeの互換補完を追加しない。

## 元終了OwnerとTaskの耐久結果配送接続 — 2026-10-08

元Docker終了Ownerへ、fresh結果参照の読取りと、固定上位ReaderによるACK受理・終了整理を接続した。Taskには実行中の元Controlを捕捉する同Process限定の配送閉包を追加した。新しい台帳・共有State・Registry・Lockは追加していない。上位の実保存との一体接続、新Process回復、実Dockerおよび5C全体は未成立である。

| 確認対象 | 結果と範囲 |
|---|---|
| 元終了Owner | Controller／Ownerの局所109契約が成功（2,329.3994ms、失敗・取消・skip 0）。元Context・Host・Controllerを照合し、ACK保存未確認では整理しない。整理失敗後も元入力で再入場し、完了後もfresh ACK照合を省略しない。Owner境界は明示模擬であり、実保存との一体確認ではない。 |
| 初回試験の不一致 | 追加したOwner試験で、模擬Leaseが解放済みに更新されずHost準備を拒否した。既存fixtureと同じ元Lease遷移へ修正した。Sourceの回収条件は緩めていない。 |
| 元Ownerの限定独立レビュー | 必須指摘0件・限定Pass。Owner `AAD57F7E…C5ED3`、公開内部入口 `1D3D1A53…2494`、試験 `E2112920…8812`、当時の詳細設計 `8B58E629…5FC5D33`の固定版を確認した。その後のTask接続へ結果を流用しない。 |
| Task内配送 | 局所162契約が成功（1,790.6469ms、失敗・取消・skip 0）。完了時のControl削除と再捕捉拒否、終端前拒否、元Owner相関、部分集合拒否、排他未確認拒否、ACK失敗後の再入場、CLI／Workbench拒否、0件拒否を確認した。上位保存とDockerは模擬境界。 |
| 静的確認 | Source strict型、対象Biomeが成功。全Test型は旧二Fileの既知18指摘が残り、新規指摘はない。 |
| Taskの独立確認 | 必須指摘0件・限定Pass。Source `C64C710E…9C2225`、試験 `C13BD86D…8E7D64`、詳細設計 `8C6186C2…E22B2D`の開始／終了Hashが一致した。元Control寿命、毎回終端確認、相関・集合全件確認、本番依存、部分失敗再入場を確認した。実上位保存・実Docker・全体Passへ昇格しない。 |

上位は結果集合を保存してから各結果をACKで終了する。部分終了後は同じ閉包と保存済み参照で再入場し、全件読取りをやり直して未配送結果を失わない。本番Orchestratorの通常終了Taskへこの順序を接続する処置は次の未完了項目であり、通常結果を資源回復失敗として扱うための新Stateは作らない。

## 1. 結論と境界

トップフォルダは責務領域を表し、実行形態と責務分類を別軸で明示する。現行の名前・Package数を固定前提にせず、統合・用途別サブモジュール化・名称補正を比較する。全体をapplications/services等へ移すこと、常駐するものをすべて製品Applicationと扱うこと、新Packageを分類だけのために作ることは推奨しない。2026-10-07の人間の追加指定に基づく全体Before／After案を§10以降に示す。

現在の重点は、WorkbenchのAI実行組立て、Project Runtimeの本番接続、CROS RESTとMCPのShared Server組立てである。ファイル名からOwnerを決めず、公開入口化だけで足りる箇所と意味・実装の移管が必要な箇所を分ける。最新の整理方針はworkbench-server、mcp-server、domain-model、orchestrator、ai-adapterを責務で分け、実行の主従とコード依存をOrchestrator → Coordinator → AI Adapterへ揃えることである。共通Domain三領域の統合とNative内部整理を含め、詳細と決定状態は§10以降に示す。実装移管は未完了である。

本表は現行Sourceを新しい正解として採用するものではない。既存Architectureと人間が採用したCapabilityを基準に、現行構造との差を処置する計画である。Layerは実行Processや配布単位を決める規則ではなく、責務分類として用いる。Serviceは同じProcess内の関数呼出しでも成立し、専用子Processを要求しない。

## 2. 変更経路と着手前確認

| 項目 | 処置 |
|---|---|
| 現在の作業 | 読取り調査と対応案の記録。Source、公開API、保存形式、Authorityは変更しない。 |
| 後続の変更分類 | 複数Subsystemの責務・公開境界・利用側へ影響する再編。単なる配置変更とは区別する。 |
| 正本 | [Architecture](../../../../06_Architecture/01_Architecture.md)、各Details、[Coding Standards](../../../../06_Architecture/99_Coding_Standards.md)。本案で正本を置換しない。 |
| 着手前整合確認 | 親が既存正本と公開入口を照合し、読み取り専用確認者が重点三境界を確認した。Draftの方向は整合。完成後独立レビューではない。 |
| 後続の独立確認 | 責務・依存・Capability保持の独立レビュー、文書／直接伝播確認、不足／影響監査。固定候補と対象集合を確定して実施する。 |
| 今行わない確認 | Source不変のため回帰・実E2E・署名を実行しない。工程契約・準拠基準自体は変更しないため、準拠監査を自動追加しない。 |
| 人間判断 | v0.22内での整理方針は承認済み。Shared Serverを第三の製品入口として固定せず、共有配置として扱う再評価方針を§18に記録する。REST／Gatewayの具体的撤去は要求・利用側・成立済み能力を照合して判断する。 |

## 3. 全18領域の一次対応

分類は主責務を表す候補であり、一領域に複数性質が存在してよい。状態の意味を所有することと保存場所を解決することを分ける。

| 現行領域 | 主な分類案／実行形態 | 所有する意味・状態 | 予定処置 |
|---|---|---|---|
| workbench | 製品Application／Server＋Browser | 表示、画面要求、Connection。AI実行Authorityは生成しない。 | AI組立ての公開入口化。画面向け変換の移管候補を評価する。 |
| mcp | 製品Application／stdio・HTTP待受け | Protocol、Request、Session・Transport lifecycle | Protocol Ownerを維持。Shared Server組立てを区別する。 |
| coordinator | Service／Task単位実行 | AI実行、Provider、候補、取消・実行資源 | 汎用実行を保持。Project本体の接続とUI固有処理を分離評価する。 |
| project-runtime | Service／呼出し単位 | Objective、Task、Decision、Acceptance、進行と再入場 | 状態・進行Ownerを維持し、本番接続のOwnerを具体化する。 |
| cros | 横断Service＋通信Adapter／呼出し・HTTP | Repository集合、Credential、Exposure、権限内Federation | 横断意味と通信・Gateway組立てを区別する。 |
| project-operation | Domain API／呼出し | Topic、Meeting操作とOwner Artifactからの投影 | 現状維持候補。Project Contextを第二の正本にしない。 |
| execution-intelligence | Domain API＋分析／呼出し | 実行記録、欠測、非Authorityな評価候補 | 記録・照会・分析を維持。実行制御を移管しない。 |
| ai-runtime | 構成Domain API＋Library／呼出し | Profile Catalog、採用Revision、解決結果 | 単なるProvider実行Libraryではない。構成管理と解決を保持する。 |
| runtime-data | 保存境界Library／呼出し | Root、保存先、用途別配置・保持契約 | 業務状態の遷移を引き取らない。Owner別Storeと区別する。 |
| version-control | Library／呼出し・Git Process | Git観測・操作の境界 | 現状維持候補。Git永続状態はGitのOwnerである。 |
| crdd-domain-library | Library／呼出し | Artifact、Relation、Symbol等の共通契約 | 現状維持候補。Project進行を追加しない。 |
| platform-access | Native基盤／限定子Process | OS観測・限定操作のprotocolと資源 | 保護実行物・固定子入口を維持し、呼出し側の意味を引き取らない。 |
| artifact-signing | 署名Library／呼出し | 署名対象・鍵利用・署名結果の契約 | Release Tooling利用とRuntime検証を区別。名前だけで一括移管しない。 |
| official-asset-governance | 開発・公開Tooling候補／呼出し | 素材の権利・用途確認 | 現状維持候補。製品Runtime利用の必要性を利用側から確認する。 |
| checker | Tooling／単発 | 機械検査規則と結果 | 現状維持候補。Domain LibraryのConsumerとして扱う。 |
| semantic-coverage | Tooling／単発 | 意味Coverageの生成Projection | 設計・実装・試験を正本として維持する。 |
| verification-runner | Tooling／単発・試験子Process | 試験選択・実行・未実施結果 | 現状維持候補。Quality／Release判断を引き取らない。 |
| visual-preview | Tooling／一時HTTP待受け | Visual確認用配信・Browser観測 | 常駐することを理由に製品Applicationへ変更しない。 |

## 4. 現行の直接依存

`40_Develop`内のTypeScript相対参照をSource／bin等、scripts、testsへ分けた一次抽出である。表はSource／bin等の領域間参照を示す。型参照と値参照をまだ分離しておらず、呼出し・Effectの発生を意味しない。Dynamic importの非literal、固定子入口、Native protocol、Tool入口、設定・配布閉包までの全依存Graphではない。

| 利用側 | 現行の直接依存先 |
|---|---|
| workbench | ai-runtime、coordinator、cros、execution-intelligence、mcp、project-operation、project-runtime、version-control |
| mcp | ai-runtime、cros、project-operation、project-runtime |
| coordinator | ai-runtime、execution-intelligence、project-runtime、runtime-data、version-control |
| cros | ai-runtime、project-operation、project-runtime、runtime-data、version-control |
| ai-runtime | runtime-data |
| execution-intelligence | runtime-data、version-control |
| runtime-data | version-control |
| checker | crdd-domain-library、runtime-data、version-control |
| crdd-domain-library | version-control |
| official-asset-governance | crdd-domain-library |
| semantic-coverage | crdd-domain-library、version-control |
| verification-runner | version-control |
| visual-preview | runtime-data、version-control |
| artifact-signing、platform-access、project-operation、project-runtime、version-control | この抽出方法では他領域のTypeScript相対参照なし。外部Effectや外部依存の不存在を意味しない。 |

Coordinator scriptsにはartifact-signing、mcp等への参照がある。開発用検証の参照を製品Runtimeの逆依存と混同しない。一方、薄い`template/tools/crdd-mcp.ts`はCoordinator公開入口でProject操作を組み立てており、実装移管時にはこの配布側接続も追従対象にする。

## 5. WorkbenchとCoordinatorの対応

対象はCoordinatorの`src/workbench-ai`全14Fileと、Workbenchの`bin/workbench.ts`の内部8File参照である。WorkBench Source全体が内部参照しているとは主張しない。

| 現行のまとまり | 目標Owner／処置 | 保持するもの |
|---|---|---|
| bin/workbench.tsのProvider実行・候補Executor組立て | まずCoordinatorの用途限定公開組立て入口を利用する。内部8Fileの再公開だけでなく、利用側が必要な操作契約へ絞る。 | Codex／Claude助言・候補、Profile固定、実行許可、取消と終了後確認 |
| workbench-ai-request-application.ts | 汎用依頼の開始・観測・取消OwnerとしてCoordinator維持候補。UI名だけで移動しない。 | Process内依頼状態、取消Signal、秘密非永続化 |
| workbench-ai-repository-composition.ts | 固定Project Contextの読取り・画面向け要求変換と、実行・送信保証を分割評価。前者はWorkbench移管候補、後者はCoordinator。 | 許可参照、Profile改訂、Task Packet、送信同意、境界外拒否 |
| workbench-candidate-application.ts | Candidate本体操作はCoordinator、表示・要求変換はWorkbench。Owner境界で分割評価する。 | 未採用候補、採否Authority、削除・回復結果 |
| advice-task／execution-plan／runtime-packet／resultの4File | 実行契約と画面固有投影を照合。契約Ownerに合わせて維持または限定分割。 | 実行意図、結果の事実・分析・推論の区別 |
| dispatch／provider-adapter／provider-executor／provider-command／provider-output／production-runtime／change-candidate-runtimeの7File | §15の最新方針で再分類する。Provider固有処理はai-adapter、共通実行・隔離・資源回収はCoordinatorへ分ける。File丸ごとの維持・移管を名前だけで決めない。 | Provider構成、結果正規化、候補隔離、資源回収 |

初期比較の最小代替は公開組立て入口化だけであった。2026-10-07、人間はProvider固有処理をai-adapterへ分離する方針を了承したため、現在の予定は公開入口化だけではない。汎用依頼状態までAdapterへ移さず、公開入口を作るだけでSourceの責務混在全体が解消したとも扱わない。

## 6. Project Runtime接続19Fileの対応

| 現行のまとまり | 目標Owner／処置 |
|---|---|
| project-runtime-durable-foundation／history／acceptance-decision-store／decision-recovery-store／integration-record-adapterの5File | Project Runtimeの状態・保存Adapterへ移管候補。Runtime Dataへ業務状態を移さない。共有Lock・保存primitiveは既存Ownerを照合し、複製しない。 |
| project-runtime-objective-intake.ts | Objective受付・進行はOrchestrator側。Provider実行接続はCoordinatorが提供する公開実行APIの呼出しへ分ける。 |
| project-runtime-composition-root.ts | 状態照会、Decision、Acceptance、候補統合、Docker回復、Windows保存を分割判定。Projectの本番組立てをCoordinatorの公開操作として恒久所有しない。 |
| project-runtime-public-adapter.ts | Client Principal観測を呼出し側の認証・Platform境界と照合。Projectの状態意味へOS認証を混ぜない。具体的配置は要確認。 |
| acceptance-authority／decision-capability／execution-authorizationの3Adapter | Project判断の契約と、実行Authorityの発行・消費を区別。名称だけでAuthority Ownerを移管しない。 |
| execution-host／single-task／task-recovery／candidate-integration／docker-project-recovery-settlementの5File | Coordinator固有実行・候補・Docker部分は維持候補。進行状態のsettlementはOrchestrator側。Coordinatorの公開実行・取消・通知契約を利用し、Coordinator本体からOrchestratorへの参照を作らない。 |
| windows-decision-store／windows-platform-adapterの2File | Project保存・Platform AdapterはProject Runtime移管候補。Coordinator由来の保護保存・Kernel Lock依存を先に照合し、移動だけで解消しない。 |
| execution-intelligence-adapter.ts | Project実行イベント→Execution Intelligenceの接続としてProject側移管候補。Coordinator実資源観測は実行側に保持する。 |

以前の「Project Runtime本体はCoordinatorをimportせず、Project側Portへ実行Adapterを注入する」案は、2026-10-07の人間との確認により置き換える。OrchestratorはCoordinatorの公開APIを直接importして呼び出し、必要なイベントハンドラーを登録する。Coordinatorは渡された関数を呼ぶが、Orchestratorをimportしない。別のPort層、汎用Event Bus、新永続State、新Lock Frameworkを追加しない。

既存Coordinator CLIのProject操作は能力として保持するが、上位の受付・組立てと下位Coordinator実行を区別して再配置する。旧呼出し元を保持するためにCoordinator本体へOrchestrator逆依存を残さない。既存commandの振分け先と起動入口の移管方法は、全Consumerの対応付け時に確定する。

## 7. CROS、MCP、Shared Serverの対応

| 現行箇所 | 目標責務／処置 |
|---|---|
| cros/runtime、project-federation、Credential・Registry群 | CROS横断Serviceとして維持。Repository正本・Project進行を引き取らない。 |
| cros/remote-transport.ts | REST Server、Client、Federation／Profile接続が同一Fileにある。通信と意味処理を分割評価し、CROS内の用途別Moduleとして残せるかを先に確認する。 |
| mcp/adapters、protocol、transports | MCP要求変換・Protocol・Transportとして維持。CROSの意味やProject進行を再定義しない。 |
| mcp/composition/cros-project-context-application.ts | CROS Service→MCP操作のAdapterとして維持候補。 |
| mcp/composition/cros-shared-server.ts | REST＋MCP＋Gatewayの三Listenerを同一Originへ合成するApplication組立て責務。MCP protocol本体と分ける。物理Ownerは未確定。 |

Shared ServerをCROSへ丸ごと移すと、現行MCP→CROSにCROS→MCPを追加し得る。初期案では専用Application Package等も比較したが、最新の再評価方針は§18の二系統の公開入口と共有配置への縮小である。既存Compositionを独立製品として移管・固定せず、REST／Gatewayが必要な具体的利用側と要求を先に照合する。

## 8. 保持するCapabilityと検証への接続

| 境界 | 保持対象 | 必要な確認 |
|---|---|---|
| Workbench AI | Codex／Claude助言、変更候補、観測・取消、Candidate操作、Profile固定、秘密非表示 | 公開入口の契約、実構成の局所試験、取消・異常・回収、必要な署名付きProvider E2E |
| Project Runtime（Orchestrator候補） | Objective→Task、状態照会、Decision、Acceptance、候補統合、再入場、state/history、Windows安全保存、実行知接続 | Coordinator公開API・通知契約、別呼出し再入場、保存失敗、Authority搬送、既存実Provider経路 |
| Shared Server | 同一OriginのREST／MCP、Bearer認可、Exposure、固定Route、Origin、部分起動失敗・終了時回収 | 実HTTP両経路、非認可・境界外、Listener／Socket／Request終了後観測 |

これは必要確認の一覧で、現在の実行結果ではない。過去のEvidenceは対象版・範囲を保持し、新配置や新Ownerの成功根拠へ自動流用しない。既知Graph停止、Docker回復縮小の本番未接続、公式CLI実境界未確認を本再編で解消済みと表示しない。

## 9. 実施順序と未確定事項

1. 本対応案と公開入口・状態Ownerを確認し、Shared Server配置を具体化する。
2. 現行Capabilityの過去Evidence、全Consumer、型／値／子Process／Native／配布閉包を照合し、ファイル・関数単位の移管表を固定する。
3. Architecture DetailsとQuality検証義務を先に更新し、独立確認を通す。
4. Workbench公開接続→Project Runtime接続→Shared Server組立ての順で、各変更の依存を確認して実装する。単なる移動と意味変更を分ける。
5. 静的確認、局所反例、影響回帰、固定候補の独立レビュー・伝播監査を完了し、必要な署名・実E2Eへ戻る。

OPEN: Shared Server縮小に伴うREST／Gatewayの利用側移管、Project Runtime保存からCoordinator共有primitiveを利用する境界、依頼・結果型の最終Ownerは未確定。全Consumerと実行閉包を照合した後に判断する。これらが決まるまで該当Sourceの撤去・移管を開始しない。

## 10. Package境界と親フォルダ名のBefore／After案

人間は、Domain Library、Project Operation、Runtime Dataの親フォルダ統合・責務別サブモジュール化、および親フォルダ名全体の再評価を了承した。以下は計画上の採用方針と残る候補を区別する表であり、改名・実装移管の完了またはArchitecture正本更新済みを意味しない。

| 現行 | 推奨する親フォルダ候補 | 処置・理由 |
|---|---|---|
| crdd-domain-library ＋ project-operation ＋ runtime-data | domain-model | 2026-10-07、人間が三領域の親フォルダ統合と§11の責務別構成を了承した。旧Package名を内部にそのまま並べず、モデル・解析・CRUD・保存共通部品を再分類する。用途別公開入口と状態Ownerを維持する。 |
| ai-runtime | ai-adapter内のProfile管理Module | 人間は独立ai-profile親フォルダを作らずai-adapterへ統合する方針を指定した。Catalog管理・保存・選択・解決・利用可能性投影とProvider接続は内部Moduleで分ける。 |
| Coordinator内のProvider固有実装 | ai-adapter | 人間が分離方針を了承した。AI固有のコマンド・入力・出力・エラー・認証手順差を吸収する。Coordinator共通実行・Docker資源管理は移さない。 |
| mcp | mcp-server | stdio／HTTPで待ち受ける製品入口を明示する。通信Adapter・要求型も含む。Shared Server全体のOwnerと同一視しない。 |
| workbench | workbench-server | 人間が指定した名称。常駐入口を示す。Browser UIも同じPackageへ含み、Server／Browserの責務は内部で分ける。 |
| coordinator | coordinator | AIの単発実行を編成する既存概念と一致。AI ProfileやProject進行を所有する意味へ広げない。 |
| project-runtime | orchestrator | 2026-10-07、人間が最終Folder名をorchestratorとして確定した。目標からTaskを進め、順序・判断待ち・再開を管理する上位実行調整役。Coordinatorとの主従関係は§14による。実装移管は未完了。 |
| cros | cros | 複数Repositoryを横断する採用済み製品概念を維持。Registryだけを指す名前へ狭めない。 |
| execution-intelligence | execution-intelligence | 記録と根拠付き評価を表す採用済み概念を維持。実行制御と区別する。 |
| version-control | version-control | Git実装と差替え可能なVersion Control境界を表す。 |
| platform-access | platform-access | 一つのNative Packageと実行物を維持し、process／filesystem／docker-desktop／protocolの責務で内部を整理する。§17参照。 |
| artifact-signing | artifact-signing | 意味非依存の署名部品としての責務を表す。Coordinator専用品へ改名しない。 |
| official-asset-governance | official-asset-governance | 公式素材の権利・用途管理であり、汎用Artifact解析とは別の判断責務を持つ。 |
| checker | checker | 機械検査の利用目的が明確。DomainモデルのOwnerにはしない。 |
| semantic-coverage | semantic-coverage | 設計・実装・試験の意味Coverage生成を表す。 |
| verification-runner | verification-runner | 試験の選択・実行を表す。製品Taskの実行と混同しない。 |
| visual-preview | visual-preview | Visual確認に限定する。一般Web Serverや検証Frameworkへ広げない。 |

この案では三Package統合で二つ減り、ai-runtimeをProvider固有処理と合わせてai-adapterへ再編するため、18Packageから16Packageとなる。件数削減は目的・完成条件ではない。Shared Server専用Packageは現在の目標案に追加しない。各Packageがprivate、同じNode.js基準、同じRepository内で配布されていることは統合可能性の根拠の一部であり、それだけで独立境界不要と証明しない。

### 推奨案の物理構造

```text
40_Develop/
├ workbench-server/           Browser UIも同じPackageに含む
├ mcp-server/                 通信Adapterを含む常駐MCP入口
├ coordinator/
├ orchestrator/               人間が確定した名称。実装移管は未完了
├ cros/
├ domain-model/               三領域統合。下記の責務別サブモジュール
├ ai-adapter/                 Profile管理とAI固有差の吸収を内部で分離
├ execution-intelligence/
├ version-control/
├ platform-access/
├ artifact-signing/
├ official-asset-governance/
├ checker/
├ semantic-coverage/
├ verification-runner/
└ visual-preview/
```

Application／Service／Domain API／Library／Toolingは設計上の分類として残し、物理的な親Directoryを追加しない。名前の候補が確定しても、ARCH-ID、QA Local Item、Topic／MTG ID、protocol、CLI、設定keyを命名変更へ便乗して改変しない。

## 11. 統合するDomain Modelのサブモジュール案

| サブモジュール候補 | 現行Owner・内容 | 統合後の責務境界 |
|---|---|---|
| artifact | Domain LibraryのArtifact Model、Markdown解析、Schema、Relation Graph | 共通構造の解析・検証。Topic状態・Project受入判断を生成しない。 |
| reality-traceability | Domain LibraryのSymbol、Annotation、Graph | Source／Test観測・Relation。Project進行を所有しない。 |
| quality-change-control | Domain Libraryの品質候補固定、確認集合、Gate統合、再入場 | 品質の判定モデル。Quality Centerの表示用解析と混同しない。 |
| project-context | Project OperationのProject／Release／Quality Projection ReaderとSource投影 | 正本から現在値を読む・投影する。新しいRisk／Decision正本を作らない。 |
| topic | Project OperationのTopicモデル、Repository、Application | Topicの登録・編集・削除・一覧・取得、Relation、CHG昇格。 |
| meeting | Project OperationのMeetingモデル、Repository、Application | Meetingの登録・編集・削除・一覧・取得、Outcome処置とAction移管。Topicとの連携契約を保持する。 |
| 候補採否モデル（配置要確認） | project-operation.tsのCandidate／採否部分 | Owner Artifactへの候補採否。Coordinatorが持つCode Candidate本体・Storeとは区別する。 |
| storage | Domain Libraryの保存Root・排他・Owner不存在確認、Runtime Dataの一時保存共通部品 | 安全な保存、Lock、短命ファイルの確定・清掃。Coordinator／Orchestratorの実行状態の意味や回復方針は引き取らない。 |
| repository | Domain LibraryのRepository観測、Runtime DataのRepository Manifest・Root・配置解決 | Repository識別・読取り・保存範囲。Gitによる検証はversion-controlを利用し、逆依存を作らない。 |
| configuration | Runtime Dataのツール設定読取り・検証 | 設定の構造と読取りを共通化する。各ツールの設定意味・採用判断・状態Ownerは変更しない。 |
| outcome.ts | Domain Libraryの中立な処理結果 | 共通結果だけを表す。Checker FindingやRelease判断を共通型へ混ぜない。 |

上表は意味の対応であり、File名の最終移管表ではない。候補採否部分を単独Packageにする理由は現時点でない。Domain Model内部のサブモジュール間依存を許す場合も、下位の解析・観測から上位のTopic ApplicationやStoreへ依存させない。

公開面は用途別入口を維持する。Checkerはartifact、Semantic Coverageはartifact／reality-traceability、CROS・MCP・Workbenchは必要なproject-context／topic／meetingを使う。合併後のroot index.tsへすべての実装を集め、利用側をroot importへ寄せない。package exportsの宣言だけでは相対Pathによる越境を防げないため、実際のimport集合と公開境界の契約試験も追従する。src配下は過剰な階層化を避け、既存Coding Standardsの深さ制約へ照合する。

Domain Modelは意味・解析・操作をまとめるPackageであり、型定義だけの置場でも、Process内にすべてのProject状態を保持するSingletonでもない。現在のTopic／Meeting正本、Quality／Release正本、Repository Root、現在状態・履歴・候補の保存Ownerを統合Package名から変更しない。

## 12. 比較した代替と未確定事項

| 代替 | 利点 | 残る問題／現在の推奨 |
|---|---|---|
| 現行三Packageを維持し名称・境界だけ明示 | 変更面が小さい。下位共通部品を独立利用しやすい。 | 意味の近い解析・Project運営・保存契約の配置が分散する。人間が示した統合意図を満たさないため、比較対象として保持する。 |
| domain-modelへ統合し用途別入口を維持 | Package境界を減らし、共通構造と固有意味の関係を一か所で説明できる。 | 共通利用側が業務Storeを巻き込む危険がある。用途別importを維持する条件で推奨する。 |
| 統合に加えて新しい共通基盤Packageを作る | 純粋DomainとFilesystem基盤を物理分離できる。 | 現在の独立配布・利用理由の確認が不足し、Package追加と移行面が増える。今回は採用しない。 |

初期案のproject-domain、後続のcontext案は最新の推奨名としない。人間の指摘に基づきproject接頭辞を分類理由にせず、domain-modelを最新提案名とした。project-runtimeの代替として提示したworkflowも推奨しない。現在はOrchestratorとして責務とCoordinatorとの主従関係を説明する。

以前の読み取り専用追加整合確認は、統合＋用途別入口維持、当時のai-profile候補、通信Adapterを含むmcp-serverの説明を対象とした。下位primitiveの即時抽出とruntime-storageへの範囲縮小は推奨しないという結果を保持する。その確認を最新のOrchestrator直接依存・通知契約の独立確認へ流用しない。これは実装・完成レビューではない。

OPEN: 候補採否モデルのサブモジュール配置、Shared Server縮小時の利用側対応、各公開契約と全File移管表は未確定。workbench-server、mcp-server、orchestratorの名称、domain-modelへの三領域統合、Profile管理を含むai-adapterへの再編は人間了承済みであり、未決の方針に含めない。必要な判断後にSource／tests／package名／公開入口／配布・署名閉包／Symbol Path／Architecture Details／利用Workflow・Tool・設定参照の全移管表を固定する。安定IDと履歴Evidenceの当時のPathは改名しない。

## 13. 次のGate

Before／After案の方向と最終名称を人間が確認した後、§9の順序へ進む。新たな依存や共通primitive移管を導入する場合は着手前照合を更新する。現在の試験結果を別Package構成へ流用して完成を主張しない。

統合の受入条件は、既存公開能力が対応付きで維持され、用途別入口から必要なModuleだけを利用でき、依存循環がなく、Topic／MTG操作・Projection解析・Artifact／Graph・品質Gate・Symbol観測・Root／Lockの既存保証が新構成で確認されることである。単に新FolderができたことやPackage数が減ったことを完了としない。

## 14. OrchestratorとCoordinatorの主従・公開契約

2026-10-07、人間は「Orchestratorが必要とする実行契約をCoordinatorに用意し、Orchestratorが呼び出し、イベントハンドラーを登録して通知を受ける」方式を指定した。実行時の主従とコードの直接依存を同じ方向へ揃える。

```text
Coordinator単体の利用
  → 公開実行API → AI実行・Review → 結果

Orchestratorからの利用
  ├ 公開実行・取消APIを呼ぶ
  └ 進捗・完了等のイベントハンドラーを登録する
             ↓
         Coordinator
             ├ 個々のAI実行・Review・取消を管理する
             └ 登録されたハンドラーへ通知する
```

| 所有者 | 公開・所有する責務 | 所有しないもの |
|---|---|---|
| Orchestrator | 目標、Task順序、Queue、判断待ち、進行状態、再開方針。Coordinator公開APIの呼出しと通知の利用。 | Provider固有実行、Docker資源制御、Coordinator内部実装。 |
| Coordinator | 単発AI実行、Review、取消、実行Identity、実行結果・進捗通知、登録解除と通知lifecycle。単体利用可能。 | Orchestratorの目標・Queue・業務判断・再開方針。Orchestrator実装へのimport。 |

ハンドラーを呼ぶことは、CoordinatorからOrchestratorのPackageを参照することではない。イベントの型と登録・解除APIはCoordinatorが公開し、Orchestratorは自分の関数を登録する。Coordinatorは登録された関数を呼ぶだけで、上位の具象型や状態を知らない。抽象化の見栄えだけを理由に別Port Package、Event Bus、専用Processまたは新しいAdapter階層を追加しない。

公開契約の具体化では、実行要求・結果・取消・登録解除を対応させ、正常・失敗・取消・遅延通知・ハンドラー例外と終了後処置を確認する。通知を受けただけで実行成功や資源回収を推定せず、結果とcleanupの事実を保持する。ハンドラー例外の処置、最終結果の返却方法、通知順序・終端後通知の扱いは未設計であり、実装前にCoordinatorの既存契約と照合して固定する。新規保証が既に実装済みとは主張しない。

CoordinatorからOrchestratorへの現行参照を消す際は、Project操作のCLI・MCP・本番組立て等の上位利用側を移管表へ含める。単体Coordinator利用とOrchestrator経由利用の両方を検証し、既存Capabilityを失わずに依存を整理する。

## 15. AI固有差と実行記録の分担

2026-10-07、人間はAI固有実装をCoordinatorから分離し、ai-adapterへ閉じる方針を了承した。CoordinatorからなくすのはCodex／Claude専用実装であり、Coordinator自身の共通実行管理ではない。

| 担当 | 責務 | 所有しないもの |
|---|---|---|
| ai-adapter内のProfile管理 | Provider・Model・推論強度・用途のCatalog、管理・保存・選択・解決、利用可能性の投影 | Provider実行、認証秘密、実行Authority |
| ai-adapter内のProvider接続 | Provider固有コマンド生成、入力変換、出力解析、エラー正規化、認証手順差、利用量等の観測の共通形式化 | Task順序、Docker全体の資源管理、実行履歴の独自保存 |
| coordinator | 共通Adapterを用いた実行・Review・開始・取消・終了・隔離・資源回収。個別実行の記録接続 | Provider固有出力形式、Orchestratorの進行状態 |
| orchestrator | 目標・複数Taskの順序、判断待ち、再開、全体進行の記録接続 | AI固有コマンド、個別Processの回収 |
| execution-intelligence | 共通実行記録の保存・読取り・集計、欠測を保った評価候補 | Provider制御、実行許可、採用判断 |

```text
Orchestrator → Coordinator → AI Adapter
                    ├→ AI Adapter内のProfile選択・解決
                    └→ Execution Intelligence（個別実行記録）
Orchestrator ─────────→ Execution Intelligence（全体進行記録）
```

AI Adapterは共通結果・エラー・利用量等を返し、Execution Intelligenceへ直接履歴を書かない。Coordinatorが自身の開始・取消・回収観測と合わせて記録する。取得できない情報は未観測のまま渡す。Orchestratorの全体進行記録と同じ個別実行事実を二重に計上しないよう、記録Identity・粒度を実装前に照合する。

Provider固有の終了方法はAdapterが表現し、実際の停止・終了確認・回収はCoordinatorが管理する。AI AdapterからCoordinatorへの逆importを作らない。新しいAIの追加は原則AdapterとProfile設定で対応できる境界を目指すが、新しい必要保証がある場合までCoordinator不変を保証しない。

現行の記録接続はCoordinator内の`src/project-runtime/execution-intelligence-adapter.ts`と本番組立てにある。上表は目標分担であり、記録接続の分離が実装済みとは表示しない。

## 16. Repository契約とGit操作の分担

Domain ModelのCRUD・ファイル保存と、Gitによる確定・公開を分ける。データモデルが編集のたびにCommit／Pushする構造にしない。

| 担当 | 直接利用の目的・範囲 |
|---|---|
| domain-modelのartifact／topic／meeting等 | モデル・内容検証・CRUD。Git操作を業務モデルへ混ぜない。 |
| domain-modelのrepository接続 | Repository識別・保存範囲・Root確認。Gitによる検証・取得が必要な処理に限りversion-controlを利用する。 |
| version-control | Git固有のRoot検証、Revision、差分、固定Snapshot、Commit／Push等の明示操作。domain-modelへ逆依存しない。 |
| Workbench Server | ツリー・差分・ステージ状態の読取り、明示的なGit操作の受付。BrowserがGitを直接実行しない。 |
| Orchestrator | 作業進行に伴う基準版確認、承認条件に従った候補適用・確定。 |
| Coordinator | AI実行に必要な固定版・Snapshot確認。CRUDごとの自動Commitはしない。 |
| Checker | 検査対象Repository・Revision・変更範囲・固定版の確認。Git機能の利用を維持する。 |
| Execution Intelligence | 記録先Repositoryの検証・保存範囲の利用。現在のversion-control参照はRoot検証と型利用が主で、履歴分析・Pushを意味しない。 |

表示のための読取りは公開APIを直接利用できる。一方、Orchestratorが所有する候補採用をWorkbenchが別経路で適用せず、Workbench → Orchestrator → version-controlとする。Commit／Pushをどの入口へ公開するかは既存採用能力とAuthorityへ照合し、本計画を新操作の実装許可にしない。

検証済みRootの共通契約をdomain-modelへ無条件に移す案は採用しない。version-control自身が使う技術的検証結果まで移すと逆依存を作るためである。技術的Root検証結果はversion-controlに保持し、domain-modelがRepositoryの意味・保存範囲へ接続する。新しい共通型Packageは追加しない。Execution Intelligenceの直接Git依存を薄くする場合も、型だけを移して実処理の依存を隠さず、Root検証の接続まで対応付ける。

## 17. Platform Accessの調査結果と限定整理

現行は汎用OS操作の全集ではなく、Coordinator向けWindows Native補助実装である。通常のFilesystem・Path・Process・Docker CLI操作はNode／TypeScriptで扱い、必要な保証をNodeだけでは得にくい操作をRustへ委譲する。

| 現行のまとまり | 調査した責務 | 予定処置 |
|---|---|---|
| windows_owned_child.rs | Windows Job、子Process開始・終了・取消、Handle回収 | processとして整理。共通実行方針はCoordinator側に保持する。 |
| windows.rs／windows_directory.rs | 主体・ACL・Directory実体・Provider Home等のOS観測 | OS共通観測と用途固有の検査を見分ける。Provider固有選択はAI Adapter側との対応を確認する。 |
| docker_repair.rs／docker_authenticode.rs | Docker実行物の署名・Identity検査、Process観測、停止・起動の限定命令 | docker-desktopとして整理。復旧全体の判断をNativeへ追加しない。 |
| windows_terminal.rs | 回復の終端記録に関する保存・読取り・世代・保護・namespace検査 | 画面端末と誤解する名称を見直す。Windows保存操作とCoordinator専用記録検査を内部Moduleで識別する。 |
| protocol.rs／terminal_protocol.rs／host_namespace_protocol.rs／main.rs | TypeScriptとの固定要求・応答、入力検査、振分け | protocolと入口を整理。Protocol自体はOS固有機能ではなく接続契約である。 |

読取り調査時、windows_terminal.rsは8,413行、windows.rsは2,350行、docker_repair.rsは2,031行であった。試験とHeaderを含む行数であり、行数だけから不要・過剰と判定しない。

```text
platform-access/
└ src/
   ├ process/          Job・Process・終了後確認
   ├ filesystem/       Directory・ACL・安全な保存
   ├ docker-desktop/   Docker固有観測・限定操作
   ├ protocol/         要求・応答・用途別検査
   └ main.rs           固定入口
```

上記は責務別配置候補であり、Rust Module名・最終File名は移管表で確定する。一つのNative Package・実行物を維持し、新Frameworkや別Packageを作らない。公開入口・Protocol・署名対象の契約を維持し、Source配置が署名入力へ影響する場合は必要な再検証を行う。

### 保存処理と記録検査を分ける意味

WindowsのファイルOpen・ACL検査・書込み・確定・Handle終了と、Coordinator専用記録の形式・保存先・世代の検査を、内部File／Module上で見分けられるようにする。後者を直ちにTypeScriptへ移したり、汎用保存基盤へ置換したりする必要はない。誤対象への書込みを防ぐNative側の用途限定検査は維持する。Coordinatorが記録の意味・保存指示を所有することと、Nativeが要求を再検査することは両立する。

### NodeとNativeの使い分け

通常のPath構築・絶対化・リンク解決・属性確認はNodeの標準機能で扱う。Path文字列の正規化を実体同一性の証明にせず、一律の大文字小文字変換にも依存しない。Handleへ対象を結合した操作やWindows固有ACL・Jobの保証が必要な箇所だけNativeを利用する。すべてのPath処理へNative検査を追加しない。

Platform Accessを多数の上位Moduleが直接操作する構成にしない。Coordinatorや必要な保存Adapterが限定したNative要求を発行し、上位には共通結果を返す。今回の整理だけで既存の復旧縮小・本番切替・実E2Eが完了したとは扱わない。

## 18. Shared Server／CROS公開入口の再整理案

状態: Draft。対象: v0.22 Architecture Closure。2026-10-07の人間の提案を再評価方針として記録する。現行実装が要求から逸脱したという原因仮説や、RESTが不要という結論は未検証であり、Sourceの存在だけから採否を決めない。

### 結論・目標構成

主要な公開入口は、人間向けWorkbench ServerとAI／Machine向けMCP Serverの二系統とする方向で再評価する。Shared Serverを独立Product・Subsystem・第三のServer Runtimeとして追加せず、Workbench／MCP／CROS能力／Repository群を共有Hostへ配置する運用形態として扱う。

```text
Local PC または Linux等の共有Host
├ Workbench Server ← Human
├ MCP Server       ← AI／Machine Client
│       │
│       └── 同じ内部Capabilityを利用
├ CROS（Repository横断能力）
├ Orchestrator／Coordinator等
└ CRDD Repository群
```

| 区分 | 役割 | 今回追加しない責務 |
|---|---|---|
| Workbench Server | 人間の確認・操作入口。Browser表示とServerの内部APIを保持する。 | CROS専用外部REST製品の代替を無条件に主張しない。 |
| MCP Server | AI／MachineのProtocol入口。Machine Clientによる利用に毎回AIを介在させない。 | REST／Gatewayを含む共有Host全体のOwnerにしない。 |
| CROS | Registry、Credential／Exposure、権限内Context Federation等の横断能力。 | Server、REST、Shared Hostと同一視しない。横断分析・推薦の将来候補を今回の実装許可にしない。 |
| 共有配置 | Local構成をLinux等の共有Hostへ置く配置・運用。必要性に応じてDocker、TLS、Reverse Proxy、Supervisorを用いる。 | 自動Deploy、Repository Clone／Update管理、Backup、新公開API、独立Runtime。 |

CRDDのRepository単体利用と、CROSの複数Repository横断利用を区別する。共有配置をDomain Architectureへ混ぜず、Linux／Docker／Cloud／Localの違いだけで内部能力を重複実装しない。

### 現行との差と検討対象

現行の`mcp/src/composition/cros-shared-server.ts`は、CROS REST、MCP、loopback Gatewayの三Listenerを組み立て、TLS終端後の同一Origin経路へ接続している。これは実装上の事実である。一方「元の要求は二入口だけだった」「内部RESTがなくても全採用能力を維持できる」は、上流正本と過去の採用・検証結果への照合対象である。

| 現行 | 目標候補／処置 |
|---|---|
| CROS専用REST入口 | 内部利用だけならCapability直接呼出しへ置換候補。MCPで代替できない実Consumerがあるか確認する。 |
| 汎用Gateway相当のRouting | 第三Surfaceが不要なら撤去候補。必要な認証・Origin・HTTP共通処理は各Serverまたは配置基盤へ対応付ける。 |
| 三ListenerのSame-Origin Composition | 同一Originの必要理由を確認し、不要な合成・中継・Lifecycleを縮小する。 |
| MCP配下の共有Host組立て | MCP自身の起動・終了へ限定する候補。WorkbenchまでMCPの子Ownerにしない。 |
| REST経由のWorkbench内部利用 | 同一実行環境では内部Capability直接呼出しを優先候補とする。Remote接続の既存能力は別途対応付ける。 |

二系統という分類はWorkbench内部のJSON APIや静的Asset配信を禁止する意味ではない。またSame-Originを一律廃止する意味でもない。Browserの接続・認証・Origin要件と、REST＋MCPを同一Gatewayへ合成する必要性を分けて評価する。共有Host配置による認証・TLS・Exposure要件も撤去理由にはしない。

### 追加公開入口の判断基準

Workbench／MCPでは満たせない具体的Consumer Requirementが確認された場合だけ、RESTその他の公開入口を検討する。「将来便利」「RESTの方が軽量」だけでは追加しない。MCP非対応System連携、Webhook、外部SDK、一般公開API、大量・高頻度通信等は探索例であり、必要性・性能・適合性を確認済みとは扱わない。

### 撤去判断前の全数照合

| 確認対象 | 判断に必要な根拠 |
|---|---|
| 1. REST Consumer | 呼出し元、公開Route、設定、Remote Client、試験・配布入口の全利用側。 |
| 2. REST固有要求 | 対応するREQ／UI／SPEC／ARCHと、MCP・内部呼出しで代替できない条件。 |
| 3. Gateway責務 | Routing、認証、Origin、Body制限等の現在のOwnerと代替先。 |
| 4. Same-Origin | 必要なBrowser／Client条件、非適用例、配置条件。 |
| 5. 共有固有State／Lifecycle | 起動、部分失敗、Request／Socket／Listener終了と保存Stateの有無。 |
| 6. MCPのHost所有 | MCPだけのLifecycleと他入口のLifecycleを分けられるか。 |
| 7. 直接Capability利用 | 同一Process／Remote配置ごとの接続、認証・Exposure・Repository選択。 |
| 8. 成立済みCapability | 過去Evidence、置換Owner・実装、利用側、必要な実境界検証。 |

削除候補にする条件と実際に削除できる条件を分ける。具体的Consumer・要求を確認できないものは候補とするが、情報不足を不存在証明にしない。特に既存のRemote Context、Topic／Meeting CRUD、Profile管理、Bearer認可、Exposure、明示Repository選択、取消・終了後回収を置換経路へ対応付ける。未対応の採用能力がある間はREST／Gatewayを撤去済み・代替済みとしない。

次の作業はこの八観点の調査と内部File対応表であり、新Server・Deploy Toolの実装ではない。成立済み要求を二入口＋内部能力で維持できる場合に限り、余分なComposition・Transport・Lifecycleを削除する方針を具体化する。Architecture／Quality正本、設定、Workflow、公開入口、署名閉包と試験へ伝播し、独立確認を経てSourceの撤去へ進む。

## 19. Shared Server八観点のSource照合と配置対応案

2026-10-07の読取り調査。対象はCROS Remote Transport、MCP Shared Composition／認証接続、Workbench Remote呼出し、配布入口と代表試験である。試験Sourceを確認したが、この調査では試験を実行していない。全Subsystem全Fileの確定移管表ではない。

### 結論

RESTには現在の実Consumerがあるため、未使用物として即削除できない。一方、確認した上流要求は同じCapabilityへの到達・Remote認可を要求しており、RESTとGatewayの三Listener構成を固定する根拠は今回の定義照合では確認できなかった。目標は能力を減らさず、RESTで提供している能力をMCPまたは同一Hostの内部呼出しへ移すことである。

| 現行Remote能力 | Workbenchの接続 | MCPの現行対応／不足 | 縮小時の処置候補 |
|---|---|---|---|
| Portfolio／Project Context | readRemotePortfolioによるREST GET | CROS MCP Compositionは同じcreatePortfolioProjectionを利用し、Project Context一覧・取得へ渡す。 | WorkbenchのPortfolio読取りをMCPへ接続し、表示・部分可視・選択Identityの互換を検証する。 |
| Topic／Meeting CRUD | remote-topic-meeting.tsからMCPを呼ぶ。 | Credential／Exposureで許可されたRepositoryのApplicationをRequestごとに解決する。 | 既存MCP経路を維持。同一Host内部呼出しも同じ認可境界を通す。 |
| Runtime Activity | readRemoteRuntimeActivityによるREST GET | 調査したCROS MCP CompositionにはruntimeActivityReader依存がない。 | 既存の観測・Cursor・件数制限・欠測をMCPで提供する接続が必要。単なるRoute削除は不可。 |
| AI Profile一覧・更新 | readRemoteAiProfileCatalog／executeRemoteAiProfileMutationによるREST GET／POST | 調査したMCP Application依存にはProfile管理がない。 | ai-adapter内の共通Profile管理へMCP Adapterを接続。systemAdmin検査と秘密非開示を維持。 |

根拠: `cros/src/remote-transport.ts`の/v1/portfolio、/v1/ai-profiles、/v1/projects/<project-id>/runtime-activity、`workbench/src/workbench-server.ts`の対応呼出し、`mcp/src/composition/cros-project-context-application.ts`のprojectContext／topicMeetingRepositoryResolver接続。MCPが既に全Remote能力を代替できるとは主張しない。

### 八観点の判定

| 観点 | 今回分かったこと | 判定・残る確認 |
|---|---|---|
| 1. REST Consumer | Workbench ServerがPortfolio・Activity・Profile管理を使う。Topic／MeetingはMCPを使う。 | 実Consumerあり。内部利用に必要な能力とTransportを分離する。外部Consumer全数は公開案内・履歴まで後続照合。 |
| 2. REST固有要求 | REQ-000040はWorkbenchとMCPが同じApplication Capabilityを利用する要求、REQ-000041とARCH-000013はRemote認証・利用範囲・Access Recoveryを規定する。 | 調査した定義からREST固定の必要性は未確認。利用側をMCPへ置換する方向。不存在の全域証明ではない。 |
| 3. Gateway責務 | 固定Route中継、Forwarded情報／Origin検査、Body制限、Proxy Request管理、health応答。 | Domain能力ではない。必要な制約をMCP HTTP／配置のTLS境界へ対応付け、Proxy自体は撤去候補。 |
| 4. Same-Origin | RESTとMCPを同一HTTPS Originへ束ねる現行契約・試験がある。確認したWorkbench Remote通信はServer側fetchである。 | このRemote経路のためだけにBrowser Same-Originを要求する理由は未確認。Workbench自身のBrowser／Server契約は別に維持する。 |
| 5. State／Lifecycle | CompositionはListener・Socket・Proxy Request・close PromiseをProcess内で所有する。 | 調査したCompositionに独立した永続State保存はない。記録・Credential Storeの不存在を意味しない。必要な終了保証はMCP Listenerへ移す。 |
| 6. MCPのHost所有 | Shared CompositionがCROS REST、MCP、Gatewayの三Listenerと部分起動失敗・終了を管理する。 | REST／Proxy撤去後はMCP自身のLifecycleへ限定する候補。Workbench起動・終了を子Ownerとして取り込まない。 |
| 7. 直接Capability利用 | Portfolio生成とTopic／MeetingはMCP CompositionでCROS内部Capabilityを利用済み。 | 同一Host直接呼出しは可能。別HostのWorkbenchにはNetwork接続が必要で、すべてをローカル関数呼出しへ置換しない。 |
| 8. 成立済み能力 | REST／MCP同一Origin、固定運用設定起動・終了、Bearer Portfolio、Activity、systemAdmin Profile管理に代表試験がある。 | Transport固有試験と能力保証を分離し、能力の新経路試験を先に用意する。今回再実行・全Evidence照合は未実施。 |

配布入口の注意: `template/tools/crdd-cros-server.ts`はShared CompositionへpublicOrigin、port、registry、exposure、Topic／Meeting Resolverを渡すが、aiProfileAdministrationとruntimeActivityReaderは渡していない。したがってREST実装と局所試験の存在だけから、この配布入口でProfile／Activityの本番接続が成立済みとは扱わない。新MCP入口では宣言済み能力の接続範囲を明示的に閉じる。

代表試験: `mcp/tests/integration/cros-shared-server.integration.test.ts`、`mcp/tests/system/cros-shared-server-entry.integration.test.ts`、`mcp/tests/system/cros-projection-non-disclosure.contract.test.ts`、`cros/tests/integration/remote-transport.contract.test.ts`、`cros/tests/integration/shared-server-config-file-adapter.contract.test.ts`。過去のPassは新構成へ流用しない。

### File単位の一次配置対応

| 現行File・まとまり | 目標Owner／予定処置 | 保持条件 |
|---|---|---|
| cros/src/remote-transport.ts | 分割。Portfolio・認可済みActivity等の意味はCROS、Profile操作はai-adapterを利用するCROS認可接続、HTTP要求・応答はmcp-server側へ。旧REST Server／Clientは代替成立後に撤去候補。 | Credential、Exposure、非開示、Cursor、結果検査を落とさない。共通処理をRESTとMCPへ二重実装しない。 |
| mcp/src/composition/cros-project-context-application.ts | mcp-server内のCROS能力接続として維持・拡張候補。 | RequestごとのCredential／Exposure再検証。Context／Topic／MeetingとActivity／ProfileのAuthorityを分ける。 |
| mcp/src/composition/cros-shared-server.ts | 三Listener組立て・Proxyは撤去候補。必要なMCP起動、部分失敗処置、終了保証はMCP Serverの既存Transportへ対応付ける。 | TLS配置・Origin・取消・Socket／Request終了を消さない。File名変更だけで不要構成を残さない。 |
| mcp/src/transports/streamable-http-transport.ts | mcp-serverのHTTP Transportとして維持。 | CROS固有の業務判断をTransportへ埋め込まない。 |
| workbench/src/remote-topic-meeting.ts | workbench-serverのRemote MCP Client接続として維持候補。共通接続処理の抽出要否は反復の実態で判断。 | Repository明示選択、Relation認可、秘密非公開。汎用Gatewayを新設しない。 |
| workbench/src/workbench-server.tsのREST呼出し部分 | workbench-server内でMCP呼出しへ置換候補。同一Host構成では認可済み内部呼出しも比較。 | 画面Read ModelをCROSへ移さず、Remote切断・欠測・表示の意味を維持。 |
| cros/src/shared-server-config-file-adapter.ts | CROSのRegistry／Exposure／Repository Binding構成と、MCP配置設定を分離して再配置候補。 | CROS専用構成はCROSが所有。設定Fileの最終名称・場所・Front AI移行は未確定。 |
| template/tools/crdd-cros-server.ts | mcp-serverの正式起動入口への置換・整理候補。 | 薄い入口、全能力の接続、OS管理CROS RootとRepository単体利用を維持。 |
| template/tools/cros-shared-server-config-example.json | 見える設定例として、新しいCROS構成／MCP配置契約へ更新候補。 | 実Fileを維持する人間指定を保持。不要確定前に削除しない。 |
| cros/src/index.ts／mcp/src/index.ts、利用側・関連試験 | 公開exportと全importを追従。REST固有試験は新経路への能力対応後に整理。 | 名前だけを変えて旧公開面を残すか、新配置の成功と誤表示しない。 |

OPEN: 全外部Consumer・過去採用Evidence、Activityの具体的本番Reader、Profile管理の新MCP操作契約、設定の最終配置、全File／関数対応は未確定。独立レビュー・Source変更前にこれらを埋める。現在は再編調査の一段階であり、全親フォルダ内部整理の完了ではない。

## 20. Workbenchの表示APIとCROS接続の区別

2026-10-07の追加確認。REST撤去候補はWorkbench ServerからRemote CROSへのIntegration経路であり、BrowserからWorkbench Serverへの表示・操作APIではない。MCPはAI専用ではなく、Remote CRDD／CROS能力のMachine向け公開境界として扱う。Workbench Server自身もRemote側から見ればMachine Clientである。

| 経路 | 方針 | 注意点 |
|---|---|---|
| Browser → Workbench Server | 表示・操作用APIとして維持 | Browser認証、操作Authority、Origin、画面Read Modelを維持する。APIが存在することを第三の独立製品Surfaceとは数えない。 |
| Workbench Server → 同一ProcessのCROS | 共通の認可済みCapabilityを直接呼ぶ | Transportの省略をCredential／Scope／Exposure検証の省略にしない。 |
| Workbench Server → 別Process／Remote CROS | MCPによる接続へ置換候補 | 同一Hostであっても別Processなら関数を直接呼べない。Remote結果の検査・取消・接続失敗も保持する。 |
| 外部Machine／AI → CROS | MCP Serverから同じ内部Capabilityを利用 | AIを毎回介在させない。MCP非対応Consumerの新要求は別途評価する。 |
| Workbench Server → CROS REST | 必要な能力を上記経路へ対応付けた後の撤去候補 | Portfolio／Activity／Profile管理の現行利用を置換するまで削除しない。 |
| 第三のCROS REST／汎用Gateway | 現時点の目標構成には追加しない | 全外部Consumerの未確認を「存在しない」と言い換えない。§19の残る照合を完了する。 |

```text
Local・同一Process
Browser → Workbench API → 認可済みCROS Capability

Remote・別Process
Browser → Workbench API → MCP Client → MCP Server
                                         ↓
                              同じ認可済みCROS Capability

AI／Machine Client ─────────→ MCP Server
```

共通化するのはAuthorization／Scope／能力の意味と結果契約であり、Transportは同一実装に強制しない。Workbench側の共通呼出し入口が必要なら、既存のLocal接続とMCP接続を選ぶ薄いModuleで足りるかを確認する。別Port Package、Remote接続Framework、Event Bus、新Stateを分類のためだけに追加しない。「Port」は呼出し境界を説明する語であり、新しい依存逆転層の採用を意味しない。

Remote Workbench接続は現行Source・試験にあるため、特殊ケースであることだけを理由に削除しない。一方Shared配置の標準形はWorkbench／MCP／CROS／Repository群を同じHostへ置く候補とし、同一Processにするかは配置・運用の判断として分ける。LocalとRemoteの両方を必ず常時起動する構成や、自動Remote Fallbackを追加しない。

後続のArchitecture正本更新ではMCPのMachine向け境界、Workbenchの表示API、CROSの共通認可済みCapabilityと接続方式を明示する。本節は目標設計の補強であり、既存CROS認可処理がすでに一つの共通公開入口へ集約済みとは主張しない。

## 21. REST／Gateway廃止の移管単位と実装前Gate

2026-10-07、人間は「縮小」ではなくREST／Gatewayをなくす目標を明示した。§18〜20の撤去候補は、現在の採用された目標ではCROS専用REST Server／Clientと三Listener Gatewayの廃止である。ただしCapability移管・新経路検証が完了する前に削除しない。過去実装を保持する比較案と、現在の目標を混同しない。

### 完成時に残す構成

```text
Browser → Workbench Serverの表示・操作API
                       ├→ 同一Processの認可済みCROS能力
                       └→ MCP Client → Remote MCP Server → CROS能力
AI／Machine Client ─────────────────→ MCP Server → CROS能力

共有配置: Workbench Server／MCP Server／CROS／Repository群
外部TLS終端等: Deploymentの責務。CRDD固有Gatewayは作らない。
```

MCP Serverだけを公開する共有起動とWorkbench起動を分け、MCPがWorkbench全体を所有しない。Repository単体stdio／localhost MCPも維持し、CROS構成の存在を単体利用の必須条件にしない。

### 移管単位の具体案

以下の新File名は配置案であり、実装済みPathではない。責務ごとの入口を作るためにすべてを新Fileへ増殖させることはせず、既存Fileへの合流が自然な場合はそちらを選ぶ。

| 一次キー: 現行File／関数 | 処置・配置先案 | 廃止・保持する内容 |
|---|---|---|
| cros/src/remote-transport.ts のCrosExposureSnapshot | cros/src/repository-exposure.tsへ移管候補 | Exposureの共通型を廃止Transportから切り離す。ConfigとMCPが同じ型を利用する。 |
| 同FileのCrosRuntimeActivityReader／観測型・検査 | cros/src/runtime-activity.tsへ移管候補 | 認可済みRepository集合、Cursor、20件既定／50件上限、欠測、未信頼結果検査を保持。Source Eventの記録Ownerは移さない。 |
| 同FileのstartCrosRemoteTransport | REST専用Listenerとして廃止 | Credential／Session／Exposure検査とPortfolio生成は共通CROS公開能力へ接続。HTTP HandlerをそのままDomainへ移さない。 |
| 同FileのreadRemotePortfolio／readRemoteRuntimeActivity／readRemoteAiProfileCatalog／executeRemoteAiProfileMutation等 | Workbench ServerのMCP Client接続へ置換 | CROSのREST Clientと/v1 Routeを廃止。新通信結果の意味・検査は保持し、通信用ClientをCROS Domainへ混ぜない。 |
| mcp/src/adapters/application-adapter.ts | mcp-server側の既存合成入口へActivity／Profile Adapterを接続 | tools/listと実Routingを対応させる。非管理者にProfile管理能力を渡さない。 |
| mcp/src/protocolとadapters | runtime-activity、ai-profile用の局所契約を追加する案 | 既存Local Item・要求へ対応する操作のみ。Tool名、入力、成功・欠測・拒否・取消結果は設計Gateで確定。 |
| mcp/src/composition/cros-project-context-application.ts | CROSの各能力を同じRequest認可へ接続するCompositionに改名・拡張候補 | Portfolio／Context／Topic／Meetingを維持しActivity／Profileを接続。単なるContext名へ全用途を押し込めない。 |
| mcp/src/composition/cros-shared-server.ts | 廃止 | REST Listener、Proxy Request、三Listener合成、Gateway healthを廃止。MCP自身の起動・終了は既存Transportを利用。 |
| cros/src/shared-server-config-file-adapter.ts | cros/src/repository-registry-config.tsへRepository／Workspace／Exposure部分を移管候補 | Repository Root、Context Identity、重複・Binding検証を保持。publicOrigin／portはMCP Server配置設定へ分離。 |
| template/tools/crdd-cros-server.ts | 独立Server入口を廃止し、crdd-mcp.tsの共有CROS能力接続へ置換 | 組立て本体はmcp-serverの正式bin／src。toolsは薄い入口とし、CROS Domainに新Server binを作らない。 |
| template/tools/cros-shared-server-config-example.json | CROS構成とMCP配置の見える設定例へ置換 | 現在のJSONを新内容の正本にしない。新名称・配置は設計Gateで固定し、旧設定清掃はFront AI手順へ接続。 |
| workbench/src/remote-topic-meeting.ts／workbench-server.ts | Remote MCP接続を共通化できる最小箇所へ整理 | 既存Topic／Meeting、明示Repository選択、View Modelを保持。巨大なRemote Frameworkや自動Fallbackは追加しない。 |

### 設定と配布・文書の対応

| 現行の設定・接続 | 目標での処置 |
|---|---|
| shared-server.jsonのrepositories／workspace_ids／revision | CROSのRepository公開構成として保持。Credential Registryと混ぜない。CROS固有のOS管理Rootは既存契約を照合し、今回の名前変更だけでRepositoryへ移さない。 |
| public_origin／listen_port | MCP Serverの配置構成へ移す。TLS秘密鍵は通常構成へ入れない。Root・固定名・Schemaの最終案は未確定。 |
| WorkbenchのbaseUrl／mcpBaseUrl | CROS REST Endpointを廃止し、明示したMCP接続先へ統一する案。CredentialはProcess内で扱い、Browser Read ModelやURLへ混ぜない。 |
| CROS／MCP公開index、Checkerの命名試験、Version ControlのConsumer Closure試験 | 旧File／export／入口の参照を新構成へ追従。検査を弱めて削除を通さない。 |
| template/AGENTS.md、19_Workflows/04_MCP_Server.md | Shared Server三Listenerの起動手順を、MCP共有配置とWorkbenchの別起動へ置換。通常単体入口とHost限定Access Recoveryは維持。 |
| CROS／MCP／Runtime Data／WorkbenchのArchitecture Details、Quality Definitions | 能力Owner・新接続・撤去対象と検証義務を更新。過去Evidenceの当時のPath・結果は改変しない。 |
| package graph、配布・署名閉包、Symbol Relation | 廃止Source／設定／入口の参照と新接続を全数照合。今回の名称案だけで再署名・E2E成功を主張しない。 |

旧構成の実行時Fallback・互換Serverは追加しない。既存設定・入口の移行と清掃は、Front AIが変更前の利用状況・未解決参照を確認して処置する手順へ明記する。Credential、正式Evidence、Repository内容を旧Gatewayの生成物と一緒に削除しない。

### 新経路で保持する保証と反証

| 保証 | 必須反証・観測 |
|---|---|
| 認証と内容Accessの分離 | 無効／失効Credential、systemAdminだが内容Grantなし、Exposure変更、対象Repository不明を区別。拒否時に非開示Contextを漏らさない。 |
| Portfolio／Topic／Meeting互換 | Partial／Unavailable、Repository選択、Relation越境、Cursor／一覧、削除・昇格を同じ意味で扱う。 |
| Activity | Reader未接続、破損・欠測・不正Cursor／limitを成功へ畳まない。Reader接続を本番入口で確認する。 |
| Profile管理 | 管理権限なし、古いRevision、無効Profile、削除条件、設定保存失敗。AI Adapterの実Storeへ本番接続する。 |
| Transport／配置 | MCP localhostと共有TLS配置を区別し、Origin・Body上限・認証・切断・遅延完了・取消を確認。 |
| 終了 | MCP Listener・Request・Socketの終了を実観測。旧Proxy不存在とServer終了を、成功結果だけから推定しない。 |

追加調査で、既存MCP HTTPは127.0.0.1 bindを固定し、allowedOriginsをlocalhost系へ限定していることを確認した。したがって三Listener Gatewayを削除して既存MCPをそのまま公開すればよいとは言えない。外部TLS終端から固定loopback MCPへ接続する配置とOrigin・Host検証を先に設計し、CRDD固有Proxyを増設せず必要な保証を閉じる。既存の安全なlocalhost利用を緩めて共有配置を実現しない。

### Gateと現在状態

1. 設計Gate: CROS共通認可能力、Activity／Profile MCP契約、設定・入口、TLS／Origin配置、全移管表を固定しArchitecture／Qualityへ反映する。
2. 独立確認Gate: 現行Capability・過去Evidenceと新経路の対応、廃止対象、利用側、保存・認可・終了保証を確認する。現段階の読取り調査を独立Passにしない。
3. 実装Gate: 同一ProcessとRemote MCPの接続を成立させ、局所反例・影響回帰を確認後、旧REST／Gatewayと専用入口を撤去する。
4. 完成Gate: 廃止参照0、能力接続の全数確認、正式入口の実境界試験、必要な独立再レビュー・伝播監査を完了する。

現在は移管案の具体化までである。Tool名・設定契約・本番Activity Reader・共通認可公開API・過去Evidence全数照合はOPEN。次はこれらの正本設計と照合を行い、親フォルダ内部の全File棚卸しへ接続する。Source撤去、設定変更、署名、Docker操作、実E2Eは実行していない。

## 22. 公開能力・設定・本番接続の具体化案

この節はCommit `3389345e`で記録した案の次段階であり、Source実装前の契約候補である。新しい要求を追加する目的ではなく、旧RESTが提供していた能力と既存採用能力を二入口へ接続する。

### CROS共通呼出し境界

LocalとMCPは同じCROS公開能力を呼び、Requestごとの認証・利用範囲検証を共通化する。公開能力は認証済みAccess Contextと現在のExposureから対象を解決する。入力のRepository IDやsystemAdmin flagだけでアクセスを許可しない。Raw Tokenは接続境界で検証し、Source投影・結果・ログへ返さない。

| 能力 | 入力・結果の責務 | 具象の接続先 |
|---|---|---|
| Project一覧・Context取得 | 許可されたPortfolio、Project別Context、不完全性・Owner Relation | 既存CROS Federation＋domain-model/project-context |
| Topic／Meeting操作 | 明示Repository、CRUD・Relation・Outcome・昇格と結果 | domain-model/topic／meeting。現行MCP経路の認可保証を保持。 |
| Runtime Activity取得 | Project、Cursor、limit、Source別公開可能な現在状態・Event・欠測 | Orchestrator公開状態Query＋Execution Intelligence公開記録。CROSが許可Repositoryだけを渡す。 |
| AI Profile管理 | 管理能力、採用Revision、一覧・作成・更新・削除、保存結果 | ai-adapter内のProfile管理とCROS Owner Store。systemAdminから内容Accessを作らない。 |

能力ごとの関数・結果を用い、すべてを任意commandの汎用executeへまとめない。共通認可は既存Credential／Session／Exposure処理の合流を優先し、新たな権限Frameworkや永続Session DBを作らない。取消と待機後の結果・保存Effectは既存能力の意味を引き継ぎ、取消されたという通知だけで書込みEffect 0を主張しない。

### MCP操作の候補

| 操作候補 | 入力 | 適用・保持条件 |
|---|---|---|
| 既存crdd.list_projects／crdd.get_project_context | 既存Schemaを維持 | Portfolio表示に必要な結果の対応を確認。新Portfolio Toolを重複追加しない。 |
| 既存Topic／Meeting Tool群 | 既存Repository指定・操作Schema | Domain統合後も同じ能力へ接続。Transportの都合で安定IDを変えない。 |
| crdd.get_runtime_activity（新名称候補） | projectId、任意cursor、limit（既定20・最大50） | Project Context、Runtime State Query、Event一覧の意味を区別し、欠測・継続読込を保持。 |
| crdd.list_ai_profiles（新名称候補） | 一覧用入力 | CROS管理能力で検証。Token・Credential verifier・Host Pathは返さない。 |
| crdd.create_ai_profile／crdd.update_ai_profile／crdd.delete_ai_profile（新名称候補） | Profile操作、expectedRevision、必要な削除確認 | 既存Administrationの操作と確認条件を正確に搬送。任意Provider・実行Path・CLI引数の登録機能へ広げない。 |

Tool名はここでは提案値であり、既存Protocol値を無断変更しない。新操作はtools/list、Routing、入力検査、結果検査、Role別可視性とAuthorityの全対応を固定してから追加する。既存Profile Mutationを一つの汎用更新Toolへする案と上表を比較し、既存操作の意味と利用側可読性を保つ最小契約を選ぶ。

### 設定の分担案

| 設定単位 | 内容 | 保持場所・移行の境界 |
|---|---|---|
| CROS構成（cros.json候補） | revision、Repository RootとWorkspace公開範囲。検証後にRegistry／Exposureを生成する。 | 既存OS管理CROS Config Rootを基本とする。Repositoryに他Repositoryの管理構成を埋め込まない。Credential Storeとは別。 |
| MCP Server配置（mcp-server.json候補） | listenPort、共有配置のpublicOrigin、許可Origin等の必要なHTTP配置値 | 同じ共有Hostの運用Config Rootが候補。Repository単体stdio／localhost利用にこのFileを必須化しない。 |
| Workbench Remote接続 | 明示MCP Endpoint、接続・切断、CredentialのProcess内扱い | REST baseUrlとmcpBaseUrlの二重管理を廃止。自動接続先推定・Fallbackはしない。 |
| 配布する設定例 | CROS構成例、MCP配置例を見えるJSONとして提供 | template/toolsの現行規則へ照合し、実Fileを維持する。例はRuntime実設定ではない。 |

二Fileに分ける理由はCROSの公開Repository構成とMCPのHTTP配置のOwner・変更理由が異なるためであり、機能ごとの小Fileを大量に追加するためではない。最終名、JSON key、Rootと読取り順はArchitecture更新時に確定する。Front AIは旧shared-server.jsonを読んで非秘密構成を分け、Credential／Root検証・参照を確認して旧Fileを清掃する。Sourceに旧Schema読取りFallbackを作らない。

### TLS・Origin接続の最小案

共有Hostでは外部のTLS終端が/mcpだけを固定loopback MCP Listenerへ転送する構成を第一候補とする。REST RouteとCRDD固有Gatewayを置かない。Server間Machine ClientはBrowser Originを必須にはしないが、Origin付きRequestは現在の許可Originへ照合する。Forwarded値を無条件に信用せず、TLS終端で上書きされる配置条件とMCP側のHost／Origin検証を対応付ける。既定localhost Modeは現在の制限を維持する。

これはReverse Proxy製品選択、TLS鍵管理、自動Linux Deployまたは任意Network公開の実装許可ではない。外部TLS配置と実Hostの受入条件を確定できなければ共有起動の成立を主張しない。

### 本番接続で検出した欠落とOwner

現行非試験Sourceを調査すると、CrosRuntimeActivityReaderは型・依存・呼出しだけで、専用の本番具象Readerを確認できなかった。Workbenchのruntime-activity.tsにはRepository状態QueryとExecution Intelligence読取りがあるが、画面View Model・Git公開観測も同Fileに含む。そのままCROSへimportするとCROS → Workbenchの逆依存を作るため採用しない。

| 対象 | 是正案 | 確認方法 |
|---|---|---|
| Activity本番Reader | Orchestrator状態とExecution Intelligence記録の公開Queryを用いる具象接続をCROS能力組立てへ用意。Workbench表示変換はWorkbenchに残す。 | 正式MCP起動入口から実Repositoryの状態・記録を読み、欠測とCursor継続を確認する。 |
| Profile本番Store | 既存CROS Owner Profile Store／Administrationをai-adapterへ移管しMCPの管理能力へ接続。 | 正式入口から管理者のCRUDと非管理者拒否、Revision競合・保存失敗を確認する。 |
| 認可共通化 | Portfolio／Topic／Meeting／ActivityのRepository解決と、ProfileのsystemAdmin判定を適切に共有する。 | 同一ProcessとMCPで同じRole・Exposure条件を与え、非開示・拒否が一致することを確認する。 |
| 起動・終了 | MCP自身の一ListenerとRequest／Socket lifecycleへ必要な保証を対応付ける。 | 部分初期化失敗、切断・取消・終了要求、待機後の資源状態を観測する。 |

現在、人間の追加判断が必要な事項を新たに確定してはいない。上記は既存目的に沿った具体案であり、未確定Schema・TLS配置・操作名称は正本設計と独立確認で処置する。実装着手前には複数Ownerの着手前整合確認を更新し、旧能力の過去Evidenceとの全数対応を完了する。

## 23. 責務再編を完了させる計画

計画対象: CHG-000082内のv0.22責務再編・Architecture Closure。計画基準: Commit `3389345e`と、その後の§22の契約具体化案。計画固定時は正本反映・Source移管未着手だった。段階1〜4と5A／5Bの局所完了を保持し、5C追加是正は2026-10-09の人間判断により持ち越した。5D〜Fと移管後のFile責務精査、段階6〜8は未完了。現在の処置は[冒頭の処置表](#持ち越しの処置--2026-10-09)に従う。本節の段階番号は既存CHG Phase番号を置換せず、今回の作業順を示す。

### 完了の意味と範囲

今回の完了は、了承された責務構成がArchitecture・Quality・Source・Test・設定・配布入口へ一致して伝播し、既存採用能力と必要な実境界の成立を確認できた状態とする。単なる移動完了、型検査Pass、旧経路の安全な拒否から全体完了を推定しない。完了後に人間がPR／統合／Releaseを判断できる状態へ渡すが、本計画だけでそれらの実行許可を推定しない。

対象は全18現行領域の内部配置照合と、16親フォルダを目標とする採用済み再編である。動かす必要がない領域は「維持＋理由」を対応表へ残し、件数を減らすために変更しない。主な変更は次のとおり。

- Domain Library／Project Operation／Runtime Dataをdomain-modelへ統合し、責務別Moduleへ整理する。
- ai-runtimeのProfile管理とCoordinator内のProvider固有実装をai-adapterへまとめる。
- Orchestrator → Coordinator → AI Adapterの依存と単体Coordinator利用を成立させる。
- Workbench／MCPをServer名称へ揃え、Browser APIを維持しCROS REST／Gateway／専用Shared Server入口を廃止する。
- Platform Accessは既存Native検査と実行物境界を保ち、名称・内部Moduleを整理する。
- Execution Intelligence、Version Controlと各呼出し側の責務・公開依存を整理する。

新しいAI機能、User Account、Trust Policy Framework、Event Bus、汎用Recovery Framework、Repository自動Deploy、Backup、汎用REST／Gatewayは対象外。Workbench UX／IAの新たな追込みも別の目的であり、今回の接続維持と画面非破損確認に混ぜない。

### 段階・成果物・通過条件

| 順序 | 作業 | 成果物・担当Owner | 次へ進む条件 |
|---|---|---|---|
| 1. 基準能力と影響範囲の固定 | 全18領域の公開能力、利用側、過去Evidence、現在Gapを棚卸し。全Fileを維持／改名／移動／分割／統合／廃止へ処置する。 | 本計画の対応表とCHG現在範囲。Fileを一次キーにし、分割時はSymbol／関数まで指定する。 | 採用能力に移管先または維持理由がある。未知Consumer・必須Gateに影響する未処置Gapを識別できる。 |
| 2. ARCH基本設計の更新 | ARCH Definitionsの責務・境界・主要Component・依存・Handoffを照合更新。REQ／UX／IA／UI／SPECへは不一致箇所だけ戻る。 | 06_Architecture/Definitionsと必要なAnalysis／Relation。 | 合意した責務・二入口・CROS共有配置の意味が正本へ反映。単なるFolder変更でARCH-IDを新設しない。 |
| 3. Details・配置・Qualityの具体化 | 各領域の公開API、内部File配置、保存Owner、起動・終了・取消、MCP操作、設定、Front AI移行を固定する。 | Architecture Details、Coding Standardsの必要差分、Quality Analysis／Definitions、Workflow・設定例の更新計画。 | 全File／Consumer対応、実装順、必須評価Checklist、失敗・欠測・後条件の検証義務が揃う。Sourceを先に正解にしない。 |
| 4. 設計の独立確認 | 固定設計を責務・依存／Capability保持、文書・直接伝播、不足・影響の観点で確認する。 | 独立レビューと適用監査、統合した是正表。 | 必須確認を全件完了し、是正後の固定版がPass。未処置事項を「担当あり」だけでPassにしない。 |
| 5. 依存順の実装・局所検証 | 下記の順序で本体・公開入口・試験・設定・Symbol・配布閉包を同時に移管する。全親フォルダの改名・移管後、親フォルダを一つずつ精査し、File名・責務・責務に応じた配置を是正する。 | 40_Develop、薄いtemplate/tools入口、関連正本と親フォルダ別のFile処置表。 | 各まとまりで型・整形・Lint・構造／Trace検査、正常・境界・失敗・取消の局所試験が成功。全親フォルダの精査・処置を終えてから段階6へ進む。旧経路を残す互換Frameworkを作らない。 |
| 6. 全体回帰・現実照合・独立再レビュー | Portable／Host試験を分けて実行し、新構成の能力・Relation・公開入口・保存・終了条件を監査する。 | Quality／Reality Audit現在投影、必要な正式結果要約。 | 対象全回帰、Checker、宣言能力の本番接続、固定Source独立レビュー・必要監査がPass。実環境未評価は識別し、全体Passへ畳まない。 |
| 7. 固定候補の署名・実E2E | 署名前提を先に検査し、人間の外部端末で必要なCoordinator閉包だけ署名。最終候補の実経路を確認する。 | 署名Manifest、実境界結果とQualityのEvidence接続。 | 必須実E2Eと回収後条件が成立。失敗は一次原因を保持し、同じ不明状態で全E2Eを繰返さない。 |
| 8. 完了処置 | 旧参照・未接続・現在Gapの処置、文書・Reality Audit・CHG現在地、Front AI移行手順を確定する。 | CHGの完了判定、正本・品質現在値、変更Summary。 | 必須Gate未達0。残存事項は現在の採用範囲と影響を明示。人間の判断前に統合・Release済みと表示しない。 |

段階1〜3は内部棚卸しを並行してよいが、基本設計→詳細設計→検証義務の依存を維持する。全Fileの完了表は同じ文書内で更新し、実行ごとの巨大なEvidence書庫を増やさない。

### 実装順序

| 順序 | まとまり | 先行条件・保持する能力 |
|---|---|---|
| A | domain-model統合、Version Control公開境界の必要整理 | Root検証・Lock・設定・Artifact・Symbol・Topic／Meetingの意味を保持。基盤を先に作りConsumer移管へ接続する。 |
| B | ai-adapter（ProfileとProvider接続）、Platform Access内部整理 | Coordinator逆importなし。Codex／Claudeの実行入力・結果・認証・取消差、Native検査・Protocolを維持。独立可能な配置変更だけ先行できる。 |
| C | Coordinator共通実行、Orchestrator移管、実行記録 | 単体／上位経由の両経路、公開通知、取消・回収、state／history・Queue・判断・候補採否を接続。既存Docker回復縮小の残件をここへ対応付ける。 |
| D | CROS共通能力、MCP Server本番接続・共有配置 | Activity Reader／Profile Store、Role・Exposure、MCP HTTP／TLS配置、全能力一覧を接続。現行REST能力の置換を先に成立させる。 |
| E | Workbench ServerのLocal／Remote接続、REST／Gateway撤去 | 表示API・純粋CSR・画面意味を維持し、MCP経路と同一Process経路を確認後に旧実装・設定・入口を廃止する。 |
| F | 残る領域・全Consumer・配布側の締め | Checker、Semantic Coverage、Signing、Runner、Visual Preview、素材管理等を対応表どおり更新または維持。旧Package名・Path参照、型／値／子Process／設定／署名入力を全照合する。 |

途中のCommitは、局所確認と整合した設計・Source・試験を含む安全なまとまりで行う。中間Commitの存在を全体完成としない。Pushは人間の指定に従い、PR統合・Releaseは別の判断とする。

### 最終実境界の確認集合

- Coordinator単体の採用済みCodex／Claude実行・Review経路、必要な組合せ、取消・回収。
- OrchestratorのObjective→Task、状態照会、判断、候補生成・採否・再入場と、Coordinator接続。
- Workbenchの助言／候補、Local／RemoteのContext・Topic／Meeting・Activity・Profile操作、Role別拒否と秘密非開示。
- MCPのRepository単体stdio／HTTPと共有CROS接続、TLS／Origin／Exposure、切断・終了後の資源状態。
- 影響する実Windows Native保存・Process・ACL境界、署名閉包と公式CLIの実利用。
- Workbenchの構成・Asset・表示に影響した範囲の実Browser確認。全Visual Profileの再評価要否は変更した意味と既存義務から決め、コード移動だけで新画面を作らない。

対象経路を段階1で現在のQuality Local Itemと採用能力へ全数対応付け、固定集合として扱う。Provider送信は現在有効な許可境界を確認し、不足する承認だけ人間へ求める。Pass取得のためにモデル・Provider・Timeout・回復機構を場当たり的に変更しない。Linux配置が採用能力の必須実境界なら、その実環境確認が必要でありWindows試験で代替済みとしない。利用環境・Authority不足は明示して判断へ戻す。

### 既存Gap・失敗時の扱い

現在CHGに残るSnapshot本番Writer、Host終端接続、旧保存撤去、限定unknown終了、Graph停止、専用反例試験等を段階1で採用範囲と照合し、今回のOwner・試験へ対応付ける。既知Gapを名称変更で消さず、現在の必須義務と無関係な将来候補も自動吸収しない。Reality Auditの件数は再実行結果から更新し、未実行の旧数値を新構成の現在値にしない。

失敗時は最初の失敗境界を局所再現してから是正し、その意味から影響回帰を導出する。新しいState／Authority／保存場所／Consumerを追加する是正は設計へ戻し、必要な着手前照合と独立確認をやり直す。単なる反復でGateを増やさず、過去unknownの消去や未実施をPassにすることで収束させない。

完了計画に新しい日程を捏造しない。既存v0.22目標日2026-10-03は経過しており、現在の期限リスクを保持する。段階1〜3の対応量と実環境条件が確定した時点で所要見通しを提示する。計画固定時の着手点は段階1・2だった。現在は段階4の独立確認結果の是正・再確認を行い、Pass後に段階5の依存順実装へ進む。

## 24. 段階1の基準母集団と着手前確認 — 2026-10-07

段階1の棚卸しを完了した。基準Commit `463dd4a1ffd86e8bf5c58bb37a92e2ba11984621`の全18領域・830Fileを[ファイル棚卸し](261007_develop-file-inventory.md)へ固定し、全Fileの予定処置、分割対象の関数責務、非import利用側、能力・過去Evidence・新Owner、必須実経路と現在QA項目を対応させた。各行は設計前の移管計画であり、公開API・詳細配置は段階3で確定する。相対importの312関係・173利用側だけを全Consumer集合と扱わず、追加した起動・設定・配布・署名・Workflowの対応も用いる。

### 着手前整合確認

変更分類は責務・公開境界・保存・配布・移行をまたぐ非自明な再編である。Architecture、Quality、Coding Standards、Workflowと実装利用側を照合する。必要な確認は責務／依存とCapability保持の独立レビュー、文書・直接伝播監査、不足／影響監査である。準拠基準自体の変更は現時点で含まず、準拠監査を一律追加しない。Filesystem書込み範囲は現在Repositoryのみ。外部送信・Docker操作・署名・Releaseは今回の棚卸しでは行わない。

読み取り専用確認者は段階1の範囲を妥当としたが、完成後独立レビューPassではない。次の指摘を棚卸しへ取り込む。

| 確認対象 | 確認した現在の根拠 | 保持・追加する処置 |
|---|---|---|
| 回帰Runnerの分類 | verification-runnerのtest-catalogとregression-runner | Owner union、正規表現、changedPath分類、実行Root、engine、Host集合を新16領域へ接続する。importだけを更新して試験脱落を起こさない。 |
| Coordinator公開入口 | coordinator/src/index.tsは現在Project Runtime操作中心 | 単体実行、上位利用、bin、配布入口、private importを別に照合する。公開API追加だけを旧逆依存撤去済みとしない。 |
| CROS管理者回復 | credential-access-recovery本体・保存Adapter・CLI | administrator_recovery／full_access_reset、Host限定判断、stale計画、保存・記録失敗をREST撤去に巻き込まない。 |
| CROS契約能力 | runtime、tool-registryの公開Export | Context Package、Handoff／再開、Repository操作、AI計画、登録Toolを維持または理由付き内部限定へ処置する。試験Consumerしか確認できないものを本番接続済みとしない。 |
| 低頻度利用側 | 署名準備・対話署名・Manifest・Promotion・Graph・Trace・Nativeのscripts | 固定閉包、新Owner／Path、取消・再入場まで対応させる。通常実行だけで署名経路を閉じない。 |
| 過去四経路と回復 | [正式結果要約](261006_release-test-retention-phase4.md) | 四経路履歴、送信確認Timeout、模擬Provider回復と実Provider取消を分ける。欠ける署名Identityを推測補完しない。 |
| 現在品質の分母 | [Quality Center](../../../../07_Quality/01_Quality_Center.md) | 設計177 Local Item、移管46中13観測／33未観測、全体算定OPENを維持。過去176項目・Symbol616等を現在値として流用しない。 |

### 履歴から保持する保証と限界

- [Shared運用根拠](260928-1114_phase5-shared-server-production-boundary.md)はloopback、模擬TLS Header契約、Origin拒否と終了後資源までである。Internet／LAN、証明書運用、特定Reverse Proxy、Linux実配置を確認した根拠ではない。
- [Remote Context MCP根拠](260927-2029_phase4-remote-project-context-mcp.md)はProject Runtime Toolを意図的に公開しない構成を確認している。Activity／Profile追加時も許可Tool一覧、管理権限と内容Accessの分離、Requestごとの失効／Exposure再観測を保持する。
- PROJECT_CONTEXTの旧投影を現在Sourceの成立証明にしない。各Owner Evidenceの対象版・観測限界から現構成への適用を再評価する。

### 親フォルダ移管後のFile精査 — 2026-10-08追加

人間の追加指示により、段階5のA〜Fによる全体の改名・移管が終わった後、段階6の全体回帰前に、目標構成の全親フォルダを一つずつ精査する。既存のCHG意図である責務再編の詳細化として扱い、親フォルダ名の変更だけで再編完了としない。

開始前の停止条件: 2026-10-08の人間指示により、段階5A〜Fの改名・移管と必要な局所確認が一通り終わった時点で、File責務精査へ自動移行せず作業を止める。移管の完了状況、残件、精査対象の親フォルダ一覧を人間へ提示し、再開指示を待つ。この停止はCHG全体の完了を意味しない。現在は段階5Cの移管中であり、この停止地点には未到達である。

各親フォルダについて、現在の実Source・公開入口・呼出し側を確認して次の対応表を作り、処置後の局所検証まで終えてから次へ進む。既存の一次棚卸しは調査入力とし、移管後の実体に対する精査結果として流用しない。

| 対象File | 実際の責務・利用側 | File名の評価 | 責務の評価 | 配置の評価 | 処置と確認方法 |
|---|---|---|---|---|---|
| 親フォルダからの相対Path | 所有する意味、入力・出力、Effect、主要Consumer | 維持／改名と理由 | 維持／分割／統合と理由 | 維持／移動先と理由 | 正本・公開API・試験・Symbol・配布への影響と局所検証 |

精査では、名前から責務を理解できるか、一つのFileへ異なる責務が集まっていないか、別Fileに同じ責務を重複実装していないか、責務Ownerと配置が一致するかを確認する。`src`の階層上限、責務別`types.ts`、明示Exportの`index.ts`、`bin`／`scripts`／`tests`の境界は現行Coding Standardsへ従う。Fileの長さや件数だけを分割理由にしない。

一意な改名・移動は既存の意図と能力を維持して実施する。分割・統合でAPI、依存、状態Owner、AuthorityまたはEffectの意味が変わる場合は、Sourceを先に正解とせず、対象Architecture／Qualityと利用側への影響を確認する。未承認の能力変更や判断が分かれる境界は人間判断へ戻す。安定Meaning IDや既存protocol値を物理名に合わせて改名しない。

完了条件は、全親フォルダ・全Fileに維持理由または具体的処置があり、必要な改名・責務整理・移動が実施済みで、公開面・直接Consumer・試験・Symbol・配布の接続と局所検証を確認できることとする。既存の段階6の独立レビュー・監査と段階7の実E2Eは維持する。

### 既存Gapの引継ぎ（対応表）

| 残件 | 今回のOwner／順序 | 閉じるための根拠 |
|---|---|---|
| Snapshot本番Writerと最新現在状態保存 | Coordinator、C | 実Producerから保存・読戻し・再入場への接続。codec単体Passで代替しない。 |
| Host終端と旧保存撤去 | Coordinator／Platform Access、B・C | 本番経路から終端条件を作り、現在状態への反映と旧保存非使用を観測する。 |
| 限定unknown終了とDocker回復縮小 | Coordinator、C | 過去unknownを消さず、現在実資源・旧Owner再入場抑止と限定処置を検証する。汎用Recoveryを追加しない。 |
| 専用反例二件 | domain-model保存／Coordinator、A・C | 別Ownerの最初の候補ではEffect 0・領域なし、公開前保存失敗＋Lock解放失敗では最初のretry拒否をそれぞれ観測する。 |
| 全体Graph停止 | Coordinator／全Consumer、F・6 | 未結合子Processと必要な閉包を実接続へ照合し、Graph検査を再実行する。 |
| 公式CLI切替後の認証・取消 | AI Adapter／Coordinator、B・C・7 | 未改造公式実行物の実認証・取消・回収を確認する。旧専用Buildの結果を流用しない。 |
| V6署名・TTY・実子Process | Signing／Coordinator／Platform Access、F・7 | 前提一致した固定候補から外部対話端末・昇格・清掃まで確認する。 |
| Workbench候補・Reviewerの未完了 | Workbench Server／Orchestrator／Coordinator、C・E・7 | 採用済み候補操作・Reviewer経路の必要な実E2Eと最終状態を確認する。 |
| Activity／Profile本番未接続と共有MCP | CROS／MCP Server、D・E | 正式入口からReader／Storeへ到達し、Role・Exposure・Origin・取消・終了を確認する。 |
| 回帰Runnerの登録／実行集合差 | verification-runner、F・6 | 登録18領域に対し実行一覧12領域。欠ける6領域・Catalog29試験Fileを含め、選択集合が実実行へ全数到達することを確認する。選択件数だけを全回帰成功へ畳まない。 |

現在、人間の追加判断が必要な事項は確認していない。段階1の固定集合には、現在QA項目だけで具体経路を覆えないActivity／Profile、共有TLS・HTTP終了、縮小目標と不一致な旧Recovery／改造CLI義務も識別し、段階3のQuality補強と段階6／7の実確認へ接続した。次は段階2のArchitecture基本設計を更新する。棚卸し完了を設計採用・Source移管・全体Passにしない。

Provider／Workbench AIの39FileとDomain統合三領域について、[関数・責務単位の処置](261007_develop-file-inventory.md#providerとworkbench-aiの関数単位照合)を追加した。同表の粗い一次候補より、本文側の具体的境界を優先する。AI固有記述と実行Authorityを分け、取消受付をcleanup完了に読み替えず、Domainの長いFileを長さだけで分割しない。Sourceの移管・設計採用・完成後レビューは未実施である。

## 25. 段階2の着手前整合確認と現在処置 — 2026-10-07

読み取り専用の確認者は、採用済みOwner・依存・Handoffを基本設計へ反映する範囲を着手可とした。追加の人間判断は確認していない。確認対象は横断モデルと18 ARCH定義、上流の正式入力とAuthority／Effect境界であり、完成後の段階4独立レビューとは区別する。

| 照合結果 | 編集時に保持する条件 |
|---|---|
| CoreとApplicationの依存 | 意味Coreの独立性を維持し、ApplicationのOrchestrator → Coordinator → AI Adapter直接呼出しを明示する。Port／DI Frameworkを追加しない。 |
| 搬送と共有認可 | SPEC-000011のstdio／localhost HTTP入力をRemote全域へ書き換えない。共有MCP・認可はARCH-000013との共同成立条件として扱う。 |
| Domain統合 | Package統合だけを理由にTopic／Meeting／Project状態Ownerを統合しない。CRUDからCommit／Pushを発行しない。 |
| Trustと候補 | 独立評価軸を保持し、Trust Policy Framework未採用と混同しない。候補本体はCoordinator、採用はOrchestrator、人間の採否Authorityは別に保つ。 |
| 記録と回復 | 実行観測とAttempt観測を分け、AI Adapterを共通Writerにしない。Primary Failureをcleanup結果で上書きせず、限定unknown終了を一般化しない。 |

発火例は同一Processでの認可済みCROS内部利用、非発火例はCROS設定を要求しないRepository単体利用、境界例は同一Hostでも別ProcessならMCP利用、情報不足例はRoot・認可・実状態不明でEffect前停止である。Browser向けRESTは維持する。

更新した10定義について、正式入力の第2・3節を基準Commitと文字列比較し、全10件で不変を確認した。作業差分の空白検査も成功した。これは正式入力を無断変更していない限定確認であり、意味妥当性・全伝播・独立レビューPassを示さない。

Component／依存、Interface／公開Surface、状態・データ流れ、故障／回復、配置／実行の横断モデル、14定義の担当境界、固定入口の全18責務の担当表、Analysis15文書の担当欄46箇所を更新した。担当欄以外の正式入力本文・Authority・Effect・失敗条件は維持した。基本状態遷移の旧矛盾（回復再入場から新規実行、一律completed）はSPEC-000004／005／028へ照合して是正した。Source・試験・署名の変更は行っていない。

読み取り専用の段階2引渡し確認は、責務・依存・二Surface・保存／候補／履歴・回復遷移の基本設計を段階3へ渡せるとした。指摘したChecklistの評価結果、正本リンク二件、途中状態の記録を是正する。Checklistは固定項目を増やさず、既存Handoff項目へ正式な理由付きOPENを記録し、詳細API・利用側接続・段階4レビューを未完了として保持する。これは完成後の独立設計レビューPassではない。

全Checkerは2026-10-07に1,176 Markdown、18,575リンク、2,373アンカーを検査し1,591件Failとなった。多数の旧移動リンク、Quality集合・適用不整合、既存Details未評価と今回のChecklist形式指摘を分ける。全体品質Passを主張せず、今回の形式・リンク是正後の局所再確認と、段階3〜6での残件処置へ接続する。

### 段階2の完了判定

段階2の基本設計更新を完了し、段階3へ引き渡す。読み取り専用確認の全結果を統合して是正し、Checkerを再実行した結果、全体は1,579件Fail、今回の変更対象に対するFindingは0件だった。Definitionの固定Checklist契約は維持し、詳細HandoffのOPENは理由付き評価結果として残した。独立設計レビュー、Details／API／QA具体化、Source移管、全回帰・実境界・署名E2Eは未完了である。

| 段階2の条件 | 確認結果 |
|---|---|
| 全責務の実装担当 | 固定入口で18 ARCH-IDを全数対応。14定義を更新し、残るChecker／契約移行／品質閉包／素材管理の四責務は意味Ownerを維持した。 |
| 正式入力・Authority・Effectの保持 | 更新定義とAnalysisの正式入力を基準版と比較。Analysis15文書46担当欄の変更は上流契約へ波及していない。 |
| 依存・公開境界・Handoff | 5横断モデルで直接依存、二Surface、共有配置、候補・状態・記録・保存・限定回復を対応させた。 |
| 基本状態の反証 | 回復再入場によるProvider新規実行と一律成功化を排除し、SPEC-000004／005／028へ照合した。 |
| 機械確認 | 全体Failは保持。変更対象Finding 0、差分空白検査成功、Source変更0。 |
| 次工程 | 段階3で詳細API、配置、全Consumer、設定・移行、QA義務を具体化し、段階4の固定設計監査へ渡す。 |

## 26. 段階3の着手前整合確認と編集順 — 2026-10-07

読み取り専用確認者の全結果を統合し、採用済み責務を詳細設計へ具体化する範囲を着手可とした。追加の人間判断は確認していない。これは段階4の独立設計レビューではない。

詳細設計21領域をSource親16領域へ機械的に圧縮しない。契約移行、品質・変更制御、Runtime Trust等の横断的意味は保持し、実装Package、意味責務、保存Ownerを区別する。10種類の詳細成果物、8種類のEngineering Concern、**7種類**のImplementation Structure観点を全数評価する。

| 編集順 | 正本の具体化 | 保持する境界 |
|---|---|---|
| 3A | Domain Modelの公開入口、Topic／Meeting CRUD、投影、設定・保存部品 | Package統合で意味Ownerを潰さず、CRUDからGit確定・公開を発行しない。用途別公開入口から不要な業務処理を読み込まない。 |
| 3B | AI AdapterとNativeの責務、Provider差、秘密保管、取消・回収 | AdapterのProvider差とCoordinatorの実行Authority・Docker資源を分ける。Nativeは実際のOS原語だけを所有する。 |
| 3C | Orchestrator／Coordinatorの公開操作、通知、状態・履歴、CLI | 上位からの直接呼出しと登録ハンドラーを用い、通知完了を状態保存やTask完了の証明にしない。元の失敗とcleanupを分離する。 |
| 3D | CROS／MCP Server／Workbench Serverの共通能力、認可、設定・終了 | Browser向けRESTは残す。Server間REST／Gatewayは能力の移管先を確認して撤去し、同一Processの内部呼出しと別ProcessのMCPで共通認可を保つ。 |
| 3E | 全利用側、配布・署名閉包、フロントAI移行、QA引渡し | 旧Meaning・導出キー・Local ItemはFolder改名だけで再採番しない。旧形式はフロントAIが処置し、Runtimeへ恒久互換を追加しない。 |

各公開操作はOwner、公開入口、利用側、入力／結果、Authority、Effectを対応させる。状態を持つ操作では正常、失敗、取消、親喪失、遅延・重複通知、終了後資源を確認する。固定候補前に既存能力・過去根拠と新配置の検証義務を分け、旧版のCovered／PASSを未確認の新接続へ流用しない。

移行手順は停止、現在資源・未解決参照の確認、必要情報の保全、exact対象の清掃、新世代初期化、読戻しの順で具体化する。設計候補の具体化中はSource移動・署名・外部AI依頼を行わない。段階3の完了判定とコミットは、3A〜3E、直接伝播、Checklist実評価と機械確認が揃った後に行う。

### 現在の具体化範囲

Domain Modelの用途別公開面、既存操作から新Ownerへの対応、CRUD保存と通知・改訂の順序、Root軽量化と不要な推移依存の反例を詳細正本へ反映した。活動Context詳細はTopic／Meetingの意味・状態を保持し、独立Package、逆依存するCROS Router、Server間REST前提を新Ownerへ対応させた。

AI Adapter詳細はCatalog／Profile管理とProvider別計画・出力変換を分け、公式CLI、秘密保管、実行Authority、Docker資源、取消通知と実停止、共通履歴Writerの境界を具体化した。公開Symbol全数、全Consumer、設定・署名閉包、QA全数対応はまだ未完了であり、対象Checklistへ理由付きOPENを記録した。段階3を完了または独立レビューPassとは表示せず、次は保存配置、Orchestrator／CoordinatorのAPI・通知・状態詳細を具体化する。

詳細設計のARCH Relation追加を統合対応表の順方向・逆方向へ伝播した。Checkerのreportに実Finding集合が含まれることを実装と出力で確認し、全1,579件Failを保持したうえで今回の変更対象Findingは0件だった。差分空白検査は成功し、Source・設定・配布入口の変更は0件である。これは文書構造の限定確認であり、詳細設計の独立レビューやSource回帰の成功ではない。

Domain／AI Adapterの途中成果は`c95506ce`へチェックポイントとして保存した。以降は段階完了時にコミットし、未完了の詳細設計を完成として記録しない。

Orchestrator詳細では、旧Application／Core／Port／internalの汎用配置を責務別Folderへ置き換え、Orchestrator → Coordinator公開APIの直接依存と単体Coordinator利用を具体化した。既存CLIコマンドは薄い配送から上位へ振り分け、Coordinator libraryの上位再exportは撤去する。公開Objective、状態参照、判断継続、候補採用の既存Symbolと新Ownerを対応し、開始通知・保存確定・取消・親喪失・遅延／重複通知・Primary Failureを区別した。詳細設計02の論理Interface IDは維持し、保存・統合・Transport・Nativeの新担当へ対応させた。保存状態・回復不変条件の全表、全Consumer、QA全数対応は継続中で、段階3の完成判定は未成立である。

この具体化後のCheckerは全1,579件Fail、今回変更した4文書のFinding 0で、差分空白検査も成功した。状態・資源詳細のInterface／Record／資源／Lock／Authority／Effect／状態／遷移／結合／不変条件／失敗注入／実装／検証IDの集合を基準Commitと比較し、249種類が同一であることを確認した。ID保持は意味妥当性や全移管の成立証明ではなく、無断再採番をしていない限定確認である。Source・設定・署名に変更はない。

Coordinator詳細を再編候補へ更新し、単体利用・Task開始／取消・助言／候補・exact回復・署名検証の公開操作境界と、Coordinator所有の通知型を具体化した。現在の公開indexに上位Project操作だけが残る点を実Sourceで確認し、Orchestrator移管後は下位公開面へ置き換える必要を明示した。Provider差はAI Adapter、共通保存はDomain Modelへ対応し、上位import・構成・再exportを禁止した。V6定数と署名domainがSourceへ接続済みであることも確認し、旧V5・旧候補配置を新規入口へ適用しないよう区別した。全回復方式、署名閉包、通知呼出し点、設定とQAの詳細照合は継続中で、段階3の完成や公開API実装済みとはしない。

### 3Dの詳細化 — CROSとMCP

2026-10-07、ARCH-000013の二Surface・同一Process直接呼出し／別Process MCPの契約と、現行CROS公開入口・REST処理・MCP構成を照合した。CROS詳細を再編候補へ更新し、REST／Gateway／専用Serverを残さない配置、共通能力のOwner、認可と結果の境界、ツール別の`cros.json`／`mcp-server.json`、可視設定例の分割、各Serverの終了責務を具体化した。MCP詳細も`mcp-server`配置、Orchestrator／Domain Model／CROSへの公開依存と本体構成Rootへ対応した。旧Gateway成功を新経路の証明にしない。Profile／Activity等の全Tool Schema、Workbench Client接続、QA全数対応と設定例実変更は未完了であり、段階3を完了扱いしない。

この詳細化後のCheckerはRepository全体1578件Failで、CROS／MCP詳細と本計画に対するFindingは0件だった。差分の空白検査も成功した。全体Passや新経路のSource接続・実境界成立を示す結果ではない。

### 3Dの詳細化 — Workbench接続

現行Workbenchの実Sourceから、Portfolio／Profile／ActivityがREST、Topic／MeetingがMCPという二経路と、`baseUrl`／`mcpBaseUrl`を確認した。Workbench詳細へ単一の明示MCP Endpoint、同一Processの認可済みCROS呼出し、能力別の移管Owner、接続世代・失効・遅延結果・取消と保存Effectの分離、CSRを維持した責務別配置を追加した。既存`list_projects`はID・状態・Source数だけで完全Portfolioを返さないため、一覧／詳細・検索・Source表示のSchema対応は未完了として明記した。RESTの単純置換を完成としない。現在、人間の新しい採否判断を要する事項は確認していない。

Workbench更新後のCheckerは全体1578件Fail、Workbench詳細・本計画・詳細Mapに対するFindingは0件だった。続いてMCP詳細へActivityとProfile一覧／作成／更新／削除の閉じた入力・結果候補を追加し、現行AI Profile MutationとActivity型の意味を維持した。Credential管理の全SchemaとPortfolio表示の対応は継続中であり、まだ3D全体を完成扱いしない。

### 3Dの判断履歴 — Credentialの秘密受渡し

現行Credential公開型、Workbench管理変換とMCPの秘密非公開契約を照合した。一覧・Grant変更・失効は非秘密だが、発行／rotationは生Tokenを一度返す。MCP Client／AI履歴への非残存を現在契約では証明できないため、Remote Token搬送を実装せず人間判断へ戻す。選択肢と影響はMCP詳細§3.3に記録した。一般MCP結果への秘密追加、専用配送Framework、Token永続保存は未採用である。Portfolioについては既存Toolのページ契約、Source表示とQuery／revision拘束Cursorを詳細化した。段階3の完了・コミットは判断解決と残る設計確認後に行う。

2026-10-07、人間は発行／rotationをHostまたは同一Process Workbenchへ限定する案を採用した。Remote MCP／Workbenchは一覧・Grant変更・失効を提供し、生Tokenを返す操作は提供しない。初期管理CredentialはCROSの明示構築時に管理可・内容Grantなしで発行する。MCP起動だけで発行しない。この判断待ちは解消した。

同日の人間確認により、単体／CROSは`--cros`の有無で明示し、設定存在から自動切替しない。両Modeは同じRepository一覧・`repositoryId`必須の対象操作Schemaを使う。単体は自身の一件のみを返しWorkbenchで自動選択する。CROSは現在許可された集合から選択し、サーバー起動用CRDDリポを自動公開しない。Project連合・管理操作に不要なRepository入力は追加しない。MCP／Workbench／CROS詳細へ反映し、未実装を成立済みとは表示しない。現在、この判断単位について追加の人間判断は必要ない。残る3Eの利用側・配布・署名閉包・移行・QA対応を続ける。

### 3Eの詳細化 — 配布・署名の新閉包

2026-10-07、現行の`RUNTIME_SIBLING_COMPONENTS`、配布Launcher集合、V6準備入口、正式適用と固定一時領域を照合した。Coordinator詳細に残るV5全体観測・旧release候補Pathを現在のV6最小集合と分離し、新Ownerの公開入口・metadata・登録子入口・実呼出しを同時に切り替える対応表を追加した。全`40_Develop`やWorkbench Browser Bundleを無条件に署名しない。QA-000010へ既存五Local Itemの反例・観測・終了条件を具体化した。実装上の旧兄弟一覧・上位逆依存・旧全体観測の撤去は段階5、実署名・TTY・昇格は段階7の未完了義務として保持する。未実行結果を追加していない。

3Eは全利用側の具体API、残るQA項目、保存・限定終了の設計とフロントAI移行手順の照合を継続する。今回の署名設計整理だけで段階3完了・独立レビューPass・Release可能としない。

同日、②の保存切替済み基準と今回の新配置を分離した。Orchestratorの保存Rootは`.crdd/orchestrator/`、Tool設定は`.crdd/config/orchestrator.json`とし、同名の配布例・Schemaへ対応する。四File、受付世代、30日既定と設定可変、未解決参照保護の保証は保持する。旧Path・設定の読取り、必要値の保全と清掃はフロントAIへ渡し、Sourceに旧形式探索・Snapshotの無断コピー・二重Writerを残さない。詳細設計と共通配置Ownerへ伝播し、実物移行済みとは表示しない。

### 段階3の途中コミット前確認

2026-10-07、人間の指示により現在の詳細設計を途中コミットする。段階3の完了とは扱わず、以降は各段階の完了時にコミットし、採否・範囲変更・リスク受容等の人間判断が必要な場合に停止する。

差分の空白検査は成功した。CheckerのRepository全体のエラーは1578件で、直前確認の1580件から今回変更した署名節への参照切れ2件を是正した。変更対象内に残る23件は、CHG本文の今回変更していない旧Source配置への参照である。全体Pass、独立レビュー完了または段階3完了を主張しない。Source変更・Runtime実行・署名・外部AI依頼は本コミットに含めない。

### 3Eの直接伝播確認 — 旧Port方式とBrowser配布

2026-10-07、要求正本REQ-000005に旧Port反転方式を必須とする記述が残っていた。人間が採用した直接公開API・登録ハンドラー方式と整合するよう、要求は公開入口限定と下位から上位への逆依存禁止へ修正した。探索記録EXP-000014ではv0.20の判断を履歴として保持し、現在の置換判断と未完了のSource移管を分離した。REQ品質分析の二導出行とQA-000001／QA-000006へ直接伝播した。履歴管理等の別契約にあるPortは今回の対象ではなく変更しない。

QA-000006のERB-IT-021では、Workbench Browser Bundleの新配置・Git収載・配布集合・直接起動の四観測を維持し、Coordinator署名Treeへの無条件収載要求を除いた。旧Build成功は新配置のPassにせず、新四段階をOPENとした。Local Itemの識別情報とServerのBrowser実行依存禁止は維持する。Source変更、署名、Provider依頼、E2Eはこの処置に含めない。

### 3Eの品質集合整理 — 廃止済み改造CLI

2026-10-07、QA-000006の文章では除外済みだったERB-IT-024〜029が現行検証表に残り、Checkerが現行Local Itemとして数えていた。採用済み公式CLI方針に従って六行を現行表から除き、詳細は記録済み基準Commitで保持する。IDの再利用、旧成功の流用、公式CLI内部の保証追加は行わない。維持する公開起動・通知と結果・取消／親Process喪失は031／UT-023／ST-030へ接続し、Quality Integrationの導出行と全数行へ伝播した。故障注入IT-002は観測内容に沿って異常へ分類し、条件区分表を一致させた。

現行13定義のLocal Itemは171件（16／17／14／20／9／25／16／7／12／14／8／7／6）である。これは設計集合の再算定であり、過去Releaseの母集団やPass数を変更しない。全Checkerは1574件Fail、QA-000006の条件区分指摘四件とQuality統合の集合不一致二件は解消した。一方、runtime-trustの旧詳細導出キーに対する段階Coverage不一致は残り、全体Passとしない。差分の空白検査は成功した。旧Docker Repair履歴方式と縮小後方式の置換、QA全数対応および段階3完了は継続中である。

### 3Eの回復縮小・履歴・移行の具体化

2026-10-07、旧Dockerの引継ぎ連鎖と現在方式の責務を分離した。Coordinator詳細に、操作・資源Identityと一次失敗、必要な検証付き再起動、明示的Host修復、旧Releaseのhandoff／continuation、旧Taskの再送禁止の処置表を置いた。旧方式の長い節は移行元の基準設計と明記し、新Runtimeの要求として旧形式を再実装しない。旧引継ぎ専用ST-011／IT-012は移行履歴へ退役する予定だが、Source切替前の基準集合を成功扱いで消さず、現在方式の003／004／014／030へ保証を対応させて段階5で全Consumerと集計を一括確定する。明示Host修復のNative安全条件は009／014で維持し、Task回復から暗黙発火させない。

Coordinatorの通常履歴はTool別coordinator.jsonで既定30日・設定可変とし、時刻・相関、一次失敗とcleanup、未解決参照の保護、state除去前の要約保存確認と再入場を具体化した。件数・容量で通常履歴を削除する条件や新しい履歴サービスは追加しない。共通配置Ownerへ伝播し、WorkflowへフロントAIによる停止・現在観測・保全・exact清掃・新形式初期化・公開入口読戻しの六手順を追加した。実移行は段階5の固定候補と独立確認後であり、現在の物理Rootを操作していない。

基準Sourceも再照合した。認証Probeはdocker-effect-runtime.tsでcreateとstartを分離し、network none・read-only・Home readonly・Workspaceなしの計画を持つ。一方、作成要求済みIDなしのremoveExactResourceはfalseで止まる。限定終了は名前による強制削除でなく、同じ固定計画・Snapshot・旧Ownerとstart不能・要求終端・実観測に接続する必要がある。遅延createが停止Containerを残し得る場合の義務保持も設計へ明記し、空一覧やOwner終了だけで清掃完了としない。

Task開始・取消の実ConsumerをSourceから再照合し、CLI、Workbench候補実行、上位の本番構成、署名検証スクリプト、拒否試験、配布閉包のSymbol照合をCoordinator詳細§2.3へ対応させた。不透明control・元の完了Promise・通知・上位保存を分け、単体利用を維持する。Task関数Headerが実行Effectを持たない旨を記載している不一致は、段階5の入口移管時に是正する対象とした。これは新API実装や取消E2Eの成功を示さない。

候補保存・読取り・保存確定・破棄・回復、診断と明示介入、Runtime検証Capabilityの発行・消費・失効をCoordinator詳細§2.4へ対応させた。内部exportの一括公開を避け、上位の採用判断と下位の候補保存を分離した。保存排他の取得順と受付・要求前・観測後・取消／清掃・結果搬送・終了要約の六時点も固定し、QA-000006へ要求前保存拒否／Effect後保存失敗／解放失敗／revision競合／fresh再入場の反証を追加した。

AI Adapter詳細ではProvider計画・Turn予算・出力変換・助言・Claude認証・Profile公開型／Storeの実Consumerと既存Local Itemを対応させた。Codex専用配布IT-031をClaude認証の証拠へ流用せず、Claude認証はUT-016／IT-008／IT-017、共通Provider契約はIT-001／002／006とST-005／030へ対応する。移管前の実測を移管後のPassとして再利用しない。

確認時の全Checkerは1574件Fail、今回確認したCoordinator／AI Adapter／QA-000006にはFinding 0件、差分の空白検査は成功した。実装切替、署名、実Provider依頼・E2Eは行っていない。段階3全体の完成と独立レビューPassは未成立であり、残るDomain統合・二Surfaceの全ConsumerとQA対応を続ける。

### 段階3の完了判定 — 2026-10-08

詳細設計・公開API・配置・保存Owner・通知／取消・全利用側・設定例の更新計画・フロントAI移行・Quality引渡しの具体化を完了した。Domain統合は旧三領域の公開集合と実Consumerを用途別入口へ対応し、型だけのFileと実処理を持つoutcomeを区別した。二Surfaceは単体／CROSで同じRepository指定契約を保持し、Profile、Activity、Credential、TLS／OriginおよびHTTP終端の反証を既存QAへ対応した。HTTP終端はstdio終端と分けてEST-ST-013を追加した。

現行設計集合は13定義・172項目（16／17／14／20／9／25／16／7／13／14／8／7／6）である。Quality Centerと現実照合の設計数へ伝播し、過去のRelation・試験結果を新設計のPassへ流用していない。Checklistの固定項目名を維持し、評価根拠を本文へ分離した。再Checkerは1,572件Fail・Warning 0であり、今回更新した詳細設計と検証定義のFindingは0件。Quality Integrationに残るruntime-trustの旧詳細導出キーの段階Coverage不一致は既知の現実照合残件で、段階6へ維持する。差分の空白検査は成功した。

読み取り専用の着手前・引渡し確認は独立設計レビューではない。段階3の設計完了をSource移管、実接続、全体Quality Ready、署名E2EまたはRelease可能と表示しない。次は固定Commitを対象に段階4の責務・依存・能力保持、文書・直接伝播、Gap／Impactの三確認を実行する。全結果を統合するまで設計を修正せず、必要な是正と再レビュー後に段階5へ進む。現在、人間による追加判断は必要ない。

### 段階4の指摘統合と是正 — 2026-10-08

固定Commit `4f85f0563c531cd78e8b7e5df67b8e886e1471c0`を、責務・依存・能力保持、文書・直接伝播、Gap／Impactの三観点で独立確認した。前二観点は是正必須、Gap／Impactは設計範囲でPass・軽微指摘ありだった。全結果を統合し、次の四処置を三確認者へ再提示して、方針競合なし・編集開始可を確認した。これは是正後の再レビューPassではない。

| 処置 | 指摘の原因と正しい状態 | 編集対象・確認方法 |
|---|---|---|
| R1 型専用File | 採用済みの責務別`types.ts`と旧Coding Standardsの禁止が競合していた。一つの責務・公開契約に閉じる型だけを`types.ts`へ置き、実処理を持つ`outcome.ts`と明示再公開の`index.ts`を区別する | Coding Standards §3.2／§8を修正。無関係な型集積と実行値の混在は禁止を維持。機械検査・実Sourceの追従は段階5へ残す |
| R2 Launcherの検証範囲 | Domain詳細が一般Toolにも全配布署名を要求していた。一般Toolは同じRepository Root・公開入口・必要Identityを確認し、保護対象CoordinatorだけV6の実行閉包・Native検証へ接続する | Domain詳細§6の表と直後の段落を修正。実体・リンク拒否、単独コピー拒否、Coordinator検証は維持 |
| R3 保存Owner | Candidate／Recoveryという名称だけではOS Runtime Rootを選べない。Repository所有の現在状態・候補・回復参照はRepository-local、User／Host所有の認証Home・秘密・CROS Registryだけ用途限定OS Rootとする | Coding Standards §3.1を配置Ownerへ接続。物理移行・認証情報変更・新保存Frameworkは行わない |
| R4 現在地と初期計画 | 初期計画の「未着手」と現在の段階1〜3完了が混在していた。初期830File表は移管前計画であり、確定したDetailsと関数優先表を照合して段階5で全数移管する | 本計画§23、棚卸し冒頭・末尾を修正。Source移管、実観測、段階4再確認の未完了は維持 |

変更分類は採用済み設計・内部規約の整合是正であり、準拠表明、公開Surface追加、決定権限、Release採用を変更しない。独立三観点の再確認を維持し、実装・実境界監査は段階6〜7で実施する。現在、追加の人間判断は必要ない。

代表例として、同一責務の型だけは`types.ts`、実検証処理は責務名File、無関係な型混在は拒否、Owner不明は未解決とする。一般Launcherに署名Manifestは一律要求せず、Coordinatorの必要Manifest欠落・Identity不一致・観測不能は停止する。Repository Candidateはlocal保存、Provider Homeは用途限定OS保存、所有主体不明の保存先は自動決定しない。これらの境界を機械検査成功だけで意味上Passにしない。

### 段階4の完了判定 — 2026-10-08

是正後の固定候補（基準Commit `4f85f056`＋四MDの内容Hash）を三確認者が独立再レビューし、責務・依存・能力保持、文書・直接伝播、Gap／ImpactのすべてがPass、必須残件0件となった。四MDの固定Hashは順に、Coding Standards `9ccd68aa89af3a10bdff3e2547504b52c5249301`、Domain詳細 `821e7aa134961562c61380f5419e487fd786a5ed`、棚卸し `cfceef3b850a2bf4f0c5e3554e69dcd5d096da6c`、本計画 `d4348bc9f55baa24b4464cf54ec8ceafc6d618b6`であり、確認者は一致を確認した。本節はその結果の記録であり、設計契約を追加変更していない。

Checkerは2,118File・1,176Markdown・18,622リンク・2,393アンカーを確認し、全体1,572件Fail・Warning 0を維持した。変更四MDのFindingは0件、差分の空白検査も成功した。全体Checker成功、新規機械契約の実装済み、実保存・Native・Provider・TLS・署名E2Eの成立を示す結果ではない。

段階4を完了し、次は段階5AのDomain統合・Version Control公開境界から順にSourceを移管する。段階5〜8の実装、全回帰、現実照合、署名実境界、Release引渡しは未完了であり、現在、人間による追加判断は必要ない。

### 段階5Aの統合前基準確認 — 2026-10-08

段階4完了Commitは`8af65cdd`。統合対象三Packageの公開入口とSource母集団を再確認し、Source配置変更前に102試験を実行した。最初のRepository直下起動では13件失敗したが、12件はpackage相対FixtureをRootから起動した試験構成上の参照ずれであり、各packageの正規作業Directoryからの再実行でDomain Library 39件、Runtime Data 44件がすべて成功した。実Process死・Lock競合の確認を省略・成功扱いしていない。

残るProject Operation一件は、現行Project Contextの先行要約に`v0.21.0`という文章を固定期待する試験だった。五場面・三Identity・表・リンク非搬送の確認を維持し、現在正本から取得した先行要約とReader結果の同値性を確認する形へ是正した。Project Operation全19件が成功した。三Packageの102件成功は統合前の基準であり、新配置・公開Symbol・全Consumerの実接続や段階5完了の証明ではない。移管時にはpackage相対Fixture、公開契約試験、設定・配布・Symbol参照も同時に対応する。

### 段階5Aの移管中確認 — 2026-10-08

段階5Aは進行中であり、段階5全体の完了ではない。旧Domain Libraryの物理配置を`domain-model`へ移し、Root公開面を共通結果だけに限定した。Repository観測は公開入口・実装・型、保存排他は公開入口・実装へ分離した。Project Contextの投影・三Parser・候補意味判断と対応する三試験を同じPackageの`project-context`へ移管し、実Sourceから得た利用側importを付け替えた。Meaning ID、試験IDと同一実体のSymbol IDは維持し、現在OwnerとPathを更新した。

Topic／Meetingの混在Markdown Readerを、各責務の`types.ts`・Markdown処理・公開入口へ分割した。Metadata・表の共通解析だけはArtifact内の一実体で保持し、公開Barrelへ露出しない。旧Rootへの互換再exportを追加せず、意味処理を使う全importを新入口へ変更した。実体が二つへ分割された旧File Symbol `project-operation.domain.topic-meeting-record`だけは終了し、参照元を`domain-model.topic-markdown`と`domain-model.meeting-markdown`の両方へ接続した。設計MeaningとQA義務を新設していない。Project Contextの公開15型も責務内の`types.ts`へ集約し、Runtime変換と区別した。

| 確認対象 | 実測結果 | 未完了との境界 |
|---|---|---|
| Domain全試験 | 51件成功。整形・型・Lint成功 | Topic／MeetingのCRUD公開面とRuntime Dataの統合は未完了 |
| Topic／Meeting残存試験 | 8件成功。整形・型・Lint成功 | 共通保存実体と責務別CRUD公開面への移管は未完了 |
| 利用側型接続 | CROS、MCP、Workbench、Checker／配布入口で成功 | 実起動・署名E2Eを示さない |
| 公開面と逆依存 | 全`40_Develop`利用側を列挙するDomain公開面12試験とChecker公開面・逆依存2試験で成功 | 他の命名・Header規則の全件是正は未完了 |
| Verification Runner | 整形・型・Lint成功。Catalog試験17成功・3失敗 | 現在13指摘が残る。Runtime Dataの設計アンカー2件、未登録試験7件、Windows実Process Profile不足4件。今回移したDomain試験のPath欠落ではないが、後続移管・全体Gateで是正する |

その後、Topic／Meetingの共通CRUD実体と対応する既存8試験をDomain Modelの保存責務へ移した。共通の公開値は`storage/types.ts`へ分離し、Topic／Meetingそれぞれに種別固定のCRUD生成入口を追加した。意味処理と保存実体の内部依存は実装Fileへ直接接続し、公開Barrel経由の循環を避けた。処理の複製、結果語彙の変更、反対種別への書込み許可は追加していない。

追加した公開面の実Filesystem試験と移管済みCRUD試験は9件成功し、Domainの整形・型・Lint、Workbench／MCP／CROSの型確認も成功した。不正種別IDおよび反対種別Markdownは既存の例外契約で拒否され、登録済み件数は変わらないことを確認した。上表の51件と公開面12件はこの追加前の全体結果であり、現在の全試験成功へ流用しない。

続いてMCP、Workbench、CROSと配布入口・関連試験を種別固定の公開面へ切り替えた。CROSは認可済み集合だけでRelation Ownerを解決し、書込みはSource Repositoryへ限定する既存挙動を保持した。旧Project Operationの入口、Package登録、型検査母集団、実配布参照と再生成可能な依存Directoryを撤去し、旧Packageの不存在を確認した。実行leaseの`project-operation`という既存状態値、Meaning ID、試験ID、過去の固定履歴はPackage名と区別して維持した。

現在のDomain全60試験（整形・型・Lintを含む）、MCPの認可・横断Relation・CRUD関連7試験、Workbench実HTTP関連29試験、Checker公開入口／逆依存2試験は成功した。MCP、CROS、Workbench、Checker／配布入口の型確認も成功した。Verification Runnerは型確認成功、Catalog試験17成功・3失敗で既知13指摘を維持し、新しいOwner／試験Pathの欠落は追加されていない。これらは署名・実Provider E2Eまたは全製品回帰の成功を示さない。

Runtime Dataの設定・Schema・保持設定Readerは`configuration`、読取り専用Path解決と領域観測は`repository`、領域確保と一時操作は`storage`へ移管した。読取り公開入口から保存操作をRuntime importしない境界を維持した。利用側54Fileのimportを用途別入口へ機械的に変更し、Domain Modelの型確認は成功した。移管した設定・Path・領域の17試験、一時操作の24試験も成功した。一時操作試験の初回はRepository Rootから起動したため9件がfixture探索で失敗し、既存契約のPackage起動位置で再実行して24件成功を確認した。これをRuntime挙動の是正または全回帰成功とは扱わない。

続いて旧Runtime Data Packageを撤去し、分割されたPath Reader／領域Writer／結果境界を実体別Symbolへ対応させ、同一実体のSchema・一時操作・試験IDを維持した。利用側閉包4試験、Checker公開面・逆依存4試験、Version Control閉包10試験は成功した。Coordinator、Checker、Verification Runner、CROS、MCP、Workbench、Execution Intelligence、AI Runtimeの8Packageで型確認が成功した。Catalogの既知13指摘は、実在する7試験の登録、4つのWindows実Process Profile、2つの現在設計アンカーへ対応させ、Catalog20試験成功・指摘0を確認した。未実行のHost試験や実E2Eが成立したという意味ではない。

Domain全試験は初回103成功・公開面契約2件失敗であり、採用済みの用途別公開集合と保護署名のexact私有入口を期待値へ対応させた。次の全試験は104成功・1件失敗で、移管前に直列実行していたRuntime Data試験を並列化したことで共有Ignore登録が衝突した。元の試験実行契約を移管先へ維持して直列化した。その後の公開`npm test`は整形・型・Lintと全105試験が成功し、取消・親Process喪失・世代切替・保存排他・公開面も含めて再確認した。配布閉包の実接続と段階5Aの完成条件照合を終えるまで同段階を完了としない。今回のSource変更はまだコミットしていない。

### 段階5Aの配布閉包接続不足 — 2026-10-08

配布閉包の局所3試験は未成立。Domain Modelへの移管後、Coordinatorの兄弟Package登録と配布fixtureに同Packageが欠落しており、最初は`platform_provisioner_runtime_dependency_outside_execution_set`で停止した。実到達Sourceだけを検証する既存方式を維持してPackageとfixtureを接続した後、3試験とも`platform_provisioner_runtime_dependency_child_url_unbound`で停止した。署名、Docker操作、Provider依頼は行っていない。

Source照合では、`storage/index.ts`から読み込まれる`filesystem-store-root.ts`が、同じ保存責務の`filesystem-store-kernel-lock-worker.ts`を固定相対URLで起動する。一方、Coordinatorの子処理検査はCoordinator所有の登録済み起動Wrapperだけを許可するため、この既存Domain Workerを閉包へ接続できない。Worker import検査も同じ登録集合だけを許可している。親フォルダ移管によるPath欠落と、移管先の公開入口から到達する既存子処理の検証接続不足を分ける。

次の是正対象は、この固定WorkerのSource Owner・起動点・実体・必要依存を配布閉包検査へ接続すること。Domain ModelからCoordinatorへの逆依存、全Domain Sourceの一律署名、未登録Worker一般の許可、排他制御の削除または試験期待値の弱化は行わない。Domain側のWorker lifetimeと保存排他契約は維持し、改名・移管だけでは配布接続を完了としない。固定参照の改変、Worker欠落、別Targetへの差替えを拒否する局所反証と、元の配布閉包3試験を確認してから段階5Aの完了照合へ戻る。

固定保存Ownerの一つの直接Worker起動と、同じ保存責務のWorker実体を配布検査へ接続した。Domain Sourceの起動処理は変更せず、固定の`Worker` import・起動元・相対参照・起動数を検査する。参照改変、別Owner、alias、import欠落、別Module import、追加起動とWorker側のimport拡張を拒否する試験は成功した。一般Workerの許可、逆依存、全Domain Sourceの署名は追加していない。

配布閉包の局所4試験は成功した。途中に見つかった試験入力の二つの旧構成参照（兄弟Packageからの相対importと、固定`tmp/signature/work`以外の署名Root）を現在構成へ対応させ、欠落拒否の期待値は維持した。その後、代表8種の実行primitive違反を各公開検査と署名CLIで秘密入力前に拒否する試験も成功した。型確認と整形確認は成功し、変更した検査・試験3FileのLintも成功した。これらは実署名、実Worker lifecycle全体、実Provider E2Eまたは段階5A全体完了の根拠ではない。

全静的確認は、`scripts/check-platform-access-coverage.ts`のProcess起動登録との不整合で停止している。同Fileの移管前HEAD Sourceを現在検査へ入力しても同じ拒否となったため、Domain import移管による新規失敗とは区別する。Native検証Toolの現在の起動と登録集合を照合して是正し、静的確認全体を再実行する。旧Rootへ依存する署名試験の対応は、試験File全体の確認を終えるまで完了としない。

署名契約File全体は21件成功・失敗0で終了した。試験用鍵と自己生成fixtureによる確認であり、正式署名・外部TTY・実Provider E2Eの実施ではない。その後の検査登録変更とは対象改訂版を区別する。

Native Coverageの停止原因は、検査済みCargo出力の`testExecutables`を列挙して呼び出す既存一箇所の登録漏れだった。固定呼出し形、同集合の列挙と実行前Hash検査を登録へ対応させた。任意実行物への差替え、列挙元変更、Hash検査の除去を拒否する局所試験は成功した。候補昇格には旧`launch.ts`の固定Hashも残っていた。現行`runPromotion`をメモリ内で旧名へ戻した場合に旧二Hashへ一致することを確認し、単一`coordinator.ts`へ更新した。`main`は現在の引数検査、Repository検証、signature保存先とexact回復参照の搬送、同一端末Lifecycleを読み取り照合して現行Graphへ接続した。単一入口・昇格操作・signature指定の改変拒否も成功した。Domain Workerを含む局所3試験、Coordinatorの二つの型確認、全Source整形、変更2FileのLintと差分破損検査は成功した。

全検証Toolの再照合では残る4Fileの登録不整合を検出した。`verify-native-protection.ts`の現在のCargo起動形、`verify-native-terminal-fixtures.ts`と`verify-native-terminal-namespace.ts`の未登録起動、`verify-project-runtime-real-providers.ts`の結果搬送Graphである。各Sourceの実責務・所有・入力・終了後条件を照合する前にHashだけを更新しない。全Graphの拒否を維持し、全静的確認・段階5Aの全Gate・後続段階を完了としない。

最新の検査Sourceによる配布閉包の再確認は12件成功・失敗0で終了した。Domain固定Worker、開発版の実体・Root・入力・Package差替え、文書差分の実行Identity非混在、署名状態の自己申告拒否、分離後component閉包と欠落の秘密入力前拒否を確認した。全検証Toolの残る4Fileはこの12件の対象外であり、全Graph成功へ流用しない。

### 検証Toolの配置登録再照合 — 2026-10-08

全検証Toolの構造Graphは37Source、検証用Process起動16箇所、本番用26箇所で受理された。Native保護・端末検証の現行配置と実際の起動所有者を登録へ反映した。実Provider検証の残る停止は、旧`security`配置を前提とした検査値だった。現行Sourceの二つの参照Pathだけを旧配置へ戻したメモリ上の計算で旧登録値を再現し、処理変更ではなく配置変更による差分と確認して更新した。

全Tool集合の一致、Native保護、Native Coverage、候補昇格に加え、二つのNative端末Toolの固定Cargo引数・一意な実行物・実体照合・終了通知・shell禁止・Owner外Node入力を改変する反証を確認した。関連5試験が成功した。Coordinatorの公開checkは整形739File、型、Lint、全Tool Graph、Runtime／Project Runtime設計トレースの全段階で成功した。Lintの既存情報表示54件は失敗またはWarningではなく、今回まとめて自動修正していない。

Domainの公開npm testも再実行し、静的検査と全105試験が成功した。旧三Packageへの実装importは残らず、Version Controlに残る旧Path文字列は廃止確認の拒否試験だけだった。配布閉包検査の全契約試験は最新版で終了コード1となった。旧`src/security`・`src/provider`配置を参照する試験FixtureのENOENTと、署名保護flowの反証試験失敗を確認した。失敗の全数分類と是正が必要であり、段階5Aは未完了である。これは構造検査と局所契約の結果であり、実Native、署名、Provider E2Eまたは段階5全体の完了ではない。

### 配布閉包の全件失敗を受けた局所是正 — 2026-10-08

全件試験で検出した失敗について、署名反証の検索対象が旧`main()`宣言のままで改変が作用しないことと、子入口・模擬LauncherのFixtureが作成していない旧配置へ書き込むことを確認した。実装の拒否条件を弱めず、現行関数宣言と`host-runtime`／`docker-runtime`のOwnerへ負例を対応させた。模擬認証Moduleは参照先である`src/provider`を明示して作成する。署名反証には、改変前後が同一でないことの確認を追加した。

署名保護・Launcher・module字句解析の四契約と、配置不一致で停止した子入口21契約が成功した。改変作用確認追加後の署名二契約も再確認した。Coordinatorの正式`npm run check`は全段階成功、既存Lint情報54件は維持する。配布閉包の全契約は修正後に再実行するため、この局所成功だけで段階5Aを閉じない。

### 段階5Bの着手前補正案 — 共通入力Snapshot

読取り専用の責務・依存確認と親による正本／Source照合で、Codex／Claude計画がCoordinatorの`plain-data-snapshot.ts`へ依存していることを確認した。同じ実体をAuthority、CLI、Recovery、診断、Native入力等も利用する。Provider計画だけの部品ではないため、AI Adapterへ実体を置いて他のCoordinator境界をProvider領域へ依存させない。Coordinator内維持またはコピー追加も、今回の逆依存撤去と単一Ownerの条件を満たさない。

| 対象 | 段階5Bで具体化する処置 | 保持条件・反証 |
|---|---|---|
| 共通Record／Array入力防御 | `domain-model/src/plain-data/plain-data-snapshot.ts`へ単一移管し、`plain-data/index.ts`だけから` snapshotPlainRecord`／`snapshotPlainArray`を公開する。Package Rootの共通Outcome集合は増やさない | Proxyをtrap前に拒否、getter未実行、exact own key・prototype・enumerability、Array上限・hole・余剰key拒否、返却status／reason／null、浅い不変Snapshotを維持。nested値全体の安全性へ保証を強めない |
| Ownerと利用側 | Domain詳細の責務・公開集合、AI Adapterの依存、全File対応を更新してから移管する。Coordinator／AI Adapterは同じ用途別公開入口へ直接依存し、旧入口shimを残さない | Store／Writer・Provider Process・Authority発行を推移的に読み込まない。既存ARCH-ID・QA導出キーをFolder変更だけで改名しない |
| 試験と配布 | 既存Snapshot単体とAuthority等のgetter／Proxy負例、Host Terminal直接import、動的模擬Providerの固定Path、型所属・静的依存・署名閉包を追従する | 新公開集合の完全一致、Coordinator逆importと旧deep importの不存在、実利用側の入力拒否と終了後条件を確認する |

ConfigurationはManifest／設定、RepositoryはRoot観測、Storageは保存・排他が責務であり、共通Snapshotの雑多な置場へ拡張しない。独立Package追加は配布・設定管理を増やすため採らない。他の三Subsystemの類似Snapshotをこの移管だけで一括統合しない。この確認は着手前照合であり、段階6のSource独立レビューPassではない。段階5Aの全件検証終了後、正本公開契約を具体化して段階5Bへ進む。

### 段階5Aの局所完了判定 — 2026-10-08

修正後の配布閉包契約は全133件成功、失敗・取消・skip・todoは0、所要628,450.998msで終了した。旧配置Fixtureと空振りする署名反証の失敗は、現行Sourceへ作用する負例として再確認済みである。Domain公開`npm test`の静的検査＋105件、利用側8Packageの型接続、Catalog20件、Runner41件成功・UAT一件未実行、移管Graph反証5件、Coordinator公開静的検査の確認範囲を合わせ、段階5Aの実装移管と局所検証を完了とする。

旧三Packageの実装importと旧三フォルダは不存在、69Fileの対応表を実移管先へ更新した。公開Rootは共通Outcomeだけを維持し、Topic／Meeting・保存・観測・設定を用途別入口へ接続した。未実行UAT、全体回帰・Reality Audit・固定Source独立レビュー、実Native・署名・実Provider E2Eは段階6／7へ保持し、段階5Aの局所完了を全体完成・Release可能へ読み替えない。段階5Bの共通Snapshot正本補正は着手準備であり、実体移管はまだ未実施である。

### 段階5B着手 — 共通入力Snapshotの単一移管

段階5AはCommit `3373192`へ固定した。続いて共通入力Snapshotの本文を変更せず、Domain Modelの`plain-data`へ移管した。Coordinatorの55File・58箇所のimport／固定検証Pathを用途別公開入口と新実体へ対応し、strict型検査の旧File登録も更新した。既存Symbol IDとARCH Relationを保持してManifest Ownerだけを移した。旧入口shim・コピー実装は追加していない。

DomainとCoordinatorの公開静的検査が成功した。両Provider計画・Snapshot反証24件、Domain公開面12件、既存Coverage登録6件が成功し、新入口は既存二関数だけを公開する。本文のLF正規化後同一性を確認した。段階5BのProvider固有実装・Profile管理・全Consumer・配布閉包・Native整理は未完了であり、この部分移管を段階5B完了としない。固定候補のSource独立レビュー・実署名E2Eは引き続き段階6／7で行う。

### 段階5BのProfile・Provider純粋処理移管 — 2026-10-08

旧AI Runtimeの14Fileと、CoordinatorのProvider計画・結果変換・課金方針の6FileをAI Adapterへ移管した。Catalog、Profile管理、Codex、Claudeの用途別入口を分け、Rootは純粋なCatalog・Provider記述・Profile解決・助言変換を公開する。保存・管理操作をRootへ戻さず、既存Symbol IDとQA IDを保持して実装のManifest Ownerと試験カタログの物理Owner／Pathを更新した。

新配置のAI Adapter公開`npm test`は静的確認と全13件が成功した。純粋公開集合の完全一致、保存・管理操作を含めないRoot、同梱JSONの欠落・破損拒否を確認した。試験カタログとRunner契約37件、既存利用側からの両Provider計画・結果変換・課金方針31件も成功した。旧Fixtureの参照位置だけを新配置へ追従し、拒否条件を弱めていない。

さらに助言CLI計画とProvider出力抽出の二FileをAI Adapterの`advice`へ移し、11利用側を共通公開入口へ接続した。結果Schemaと項目SchemaはCoordinatorの結果Ownerに残して明示入力で搬送する。Provider側が共通結果の意味を所有する逆依存を作っていない。二Symbolの安定IDも保持した。実配置と旧実体不存在を確認して、棚卸しの22行を予定から実移管へ更新した。

Coordinatorの型・公開静的検査、助言CLI／出力／Packet／実行計画／両Docker準備の60契約が成功した。Schemaの内容一致に加え、別の明示Schemaを渡すとその値がCLIへ搬送される反証を既存契約へ追加し、三契約を再確認した。実Provider・Dockerを起動した結果ではない。公開静的検査の既存Lint情報54件は維持する。

Profile解決File、Provider別Family選好と固定認証方針、Claudeのlogin／status引数とProbe判定をAI Adapterへ移した。Coordinatorは作業分類・リスク・推論強度、実観測、実行権限、Home・Lock・Process・回収を保持する。旧Profile Symbol IDはOwnerだけ移し、分割した認証方針・Probeには新FileのSymbolと既存QA試験のRelationを接続した。AI Adapterの静的検査と全13件、Coordinatorの選択・認証・Lifecycle関連48件が成功した。認証CLI記述の不変性と四条件の部分一致・欠落・解析不能拒否を追加し、認証の15契約も成功した。更新後のCoordinator公開静的検査は全段成功、既存Lint情報54件は維持する。これは局所検証であり、実認証・実Dockerを行った結果ではない。

Provider間の共通JSON解析をClaude Fileから`ai-adapter/src/output`へ抽出した。解析本文は維持し、専用型は`types.ts`へ分けた。Codex・Claude・助言とCoordinatorの全利用側は`output/index.ts`へ直接依存し、Claude公開面からの再exportを残さない。両Providerの結果、助言抽出、Task構造化結果の38契約と型接続が成功した。共通解析の重複key、escape同値key、入れ子重複、末尾データと不正文法の反証を追加し、既存QA項目から新Symbolへ接続した。MCP等の別Parserは今回一括統合しない。

二Providerの禁止環境変数集合を各CLI計画Ownerへ移し、Codexのlogin status／CODEX_HOMEとClaudeのauth statusをAI Adapterの固定認証記述へ接続した。Claude再認証の五つの固定環境値も同じ認証Ownerへ移管し、値と順序を保持する。Docker側は固定記述を消費するだけとし、Home、Mount、権限、Prepared Capability、取消・回収はCoordinatorに残す。両Providerの準備・認証・CLI計画64契約と型接続が成功した。新しいCodex認証記述には既存QA試験からSymbol Relationを接続し、CLI引数・環境値の完全一致と不変性を追加した31契約も成功した。

Provider利用可能性の五軸判定と観測Snapshot検査をAI Adapterの`profile/eligibility.ts`へ分離した。Coordinatorは観測の組立てとRuntime候補の公開を保持し、既存公開契約・理由値を変更していない。AI Adapterの静的検査と13契約、Coordinatorの型接続と選択・判定33契約が成功した。未観測、accessor・Proxy、余分なkey、観測例外の拒否と、認証preflight／Quota確認を確認済みへ昇格しない条件を維持する。新Symbolと既存QA試験のRelationを接続した。

Task結果のProvider固有搬送解釈を`ai-adapter/src/output/task-envelope.ts`へ移した。Codex JSONLのイベント・Command終了分類とClaude ResultのTurn・Usage・Reviewer本文搬送を同じ処理本文で保持し、共通Executor／Reviewer Schema、Review整合性とRemediation CapabilityはCoordinatorに残す。元関数と移管後の処理本文の同一性、公開集合、Symbol／QA接続を確認した。両Provider出力・Task結果28契約、Coordinator型接続、AI Adapter静的検査・13契約が成功した。実Provider・Dockerの実行結果ではない。

Provider専用Homeの相対名を各認証記述へ接続した。CoordinatorのOS Root、保護、Mount、排他・回収は移管しない。関連46契約と型接続、AI Adapter静的検査・13契約が成功した。Codex seccomp要求の固定Identityは既にAI AdapterのCLI計画へ移管されており、Coordinatorの実体・Hash・Path検証は維持する。

NativeのDocker発行元検証を`docker-desktop/publisher.rs`へ移管した。Windows APIによる検査本文を変更せず、同Packageの`docker_desktop::publisher`へ参照、設計、Symbolと試験台帳を追従した。旧Fileと移管後の内容同一性、旧Native参照の不存在を確認した。明示Windows targetの型確認とFormatter検査、通常Native44件とCLI6件、試験台帳20契約が成功し、専用Ownerからの明示起動を要する23件は未実行として保持する。実Docker起動・再起動・署名は行っていない。

Nativeの三つの固定搬送形式を`protocol/access.rs`、`host_namespace.rs`、`host_record.rs`へ移した。Rootの旧Moduleは残さず、実装・fixture・入口の参照、安定Symbolと試験台帳のPath、既存Coverage対象のPathを新配置へ接続した。Protocolのbyte・magic・revision・flagsと判定本文は変更していない。Windows向け型確認、Formatter、通常Native44件とCLI6件、試験台帳20契約が成功した。明示起動専用23件は未実行であり、Coverage率や実署名の成功を主張しない。

Nativeの所有子Processを`process/owned_child.rs`、system directory観測を`filesystem/windows_directory.rs`へ移した。spawn／wait／取消／timeout／Owner handle closeと終了観測の本文を保持し、子試験のexact Module名を追従した。Windows API観測を環境変数解決へ置換していない。Module参照名と整形を除く内容同一性、旧実体不存在を確認した。通常Native44件とCLI6件、試験台帳20契約、Formatter・Clippyが再成功した。

続いて固定Known Folderの四つの取得関数と共通取得処理を`filesystem/windows_directory.rs`へ分離した。Shell API、固定GUID、UTF-16長さ上限とShell割当メモリの解放を保持し、Docker利用側は新Ownerを直接参照する。五関数の基準版との本文同一性と旧実装不存在を確認した。Coverage対象へ移管先を追加し、移動によって既存対象の検証母集団を減らしていない。通常Native44件とCLI6件、試験台帳20契約、Formatter・全target Clippyが成功した。明示起動専用23件とCoverage計測、署名・実Provider E2Eは未実行である。

Handle／Descriptor／hash resource所有、Directory IdentityとACL AccessCheckの九関数を`filesystem/protection.rs`、Token／SID／認証Session／主体分類の十二関数を`process/principal.rs`へ分離した。利用側は同じOS検査を使用し、Docker mutexは主体Ownerを直接参照する。21関数の本文を基準版と全数照合し、限定可視性と整形以外の変更、旧位置の重複実装がないことを確認した。Coverage母集団へ二移管先を追加した。通常Native44件とCLI6件、全target Clippyが成功した。

固定Home／Candidate Store／Runtime Stateの十関数と関連型を`filesystem/provider_home.rs`へ分離し、Native入口は新Ownerを直接呼ぶ。共有のACE内SID読取りを`filesystem/protection.rs`へ移した。十一関数の本文を基準Commitと照合し、既存Protocol Module移管への参照追従・整形以外の本文変更と旧位置の重複定義がないことを確認した。CoverageとSymbol Relationを追従し、通常Native44件・CLI6件、全target Clippy、試験台帳20件とCoordinator公開静的検査が成功した。静的検査の既存Lint info 54件は失敗・警告ではない。Host保存処理の分割、Root dispatch整理、段階5B全体確認は残る。ignoredの実環境23件、署名・実Provider E2Eと独立Sourceレビューは今回の局所成功に含めない。

Docker Desktop修復の本体を`docker-desktop/repair.rs`へ移管し、固定Native入口、exact子試験名、CoordinatorのSource確認試験、安定試験ID、Symbol、Coverage対象と文書リンクを新配置へ接続した。続いてArtifactの固定Path・署名・ハッシュ・実体照合とProcessのPath・作成時刻・scope観測を`identity.rs`へ分離した。限定停止・開始・再起動、mutexと固定Protocolは`repair.rs`が保持し、Engine readinessとTask義務をNativeへ移していない。Module参照・同一親内の限定可視性と整形を除く基準版との本文同一性、旧実体と重複実装の不存在を確認した。Coverage母集団へ移動先を追加し、任意Path／Process操作APIを公開していない。通常Native44件とCLI6件、全target Clippy、関連Coordinator契約93件、試験台帳20契約が成功した。明示起動専用23件、Coverage計測、Docker実操作・署名・実Provider E2Eは未実行である。

Host処理の実体を`filesystem/host_record.rs`へ移し、旧`windows_terminal.rs`を撤去した。windows親へのglob依存を明示importに置き換え、入口から直接接続した。fixture所属・exact子起動名・静的Graph／本文／起動引数Hash・台帳・Symbolを追従した。Module参照・限定可視性・整形を正規化して、本番処理全体の本文一致を確認した。旧windowsに適用していたfixture専用dead-code許容はHost処理だけへ保持した。通常Native44件・CLI6件、全target Clippy、台帳・Oracle23件、Coordinator公開静的検査が成功した。保護付き保存の`protected_file.rs`、固定Namespace・対象観測の`host_namespace.rs`への分割は残り、この物理移動を最終配置としない。

残るProvider固有処理とDocker実行Adapter、全File対応、全利用側型確認、配布閉包およびNative整理は残る。これらの局所成功を段階5B完了、Source独立レビュー、実署名または実Provider E2Eの成功へ読み替えない。段階5A〜F完了後は、人間指定どおりFile責務精査の開始前に停止して報告する。

### 段階5BのHost低位操作・Namespace値判定の分離 — 2026-10-08

保護付きHandle操作・ACL照合・Descriptor構成・上限付き読取りの九関数を`filesystem/protected_file.rs`へ、固定NamespaceのIdentity型と値・対象名・一時親Pathの三判定を`filesystem/host_namespace.rs`へ移した。十二関数を基準Commitと照合し、Module参照・限定可視性・整形以外の本文変更がないことを確認した。設計、Symbol Relation、Coverage対象を新Ownerへ接続した。

通常Native44件・CLI6件、全target Clippy、試験台帳・Oracle23件とCoordinator公開静的検査が成功した。実環境専用23件は未実行、Coverage率・署名・実Provider E2Eは未確認である。保存Stage・OS Namespace観測の分離と段階5B全体確認は残る。全体移管後、親FolderごとのFile責務精査を開始する前に人間へ報告して停止する。

### 段階5BのRoot観測移管 — 2026-10-08

Root用途別観測を`filesystem/root_observation.rs`へ移し、旧Rootの`windows.rs`を撤去した。Native入口から用途別Ownerを直接呼び、台帳の安定ID、Coverage対象と設計参照を追従した。Root観測関数の本文一致、通常Native44件・CLI6件、全target Clippyと台帳・Oracle23件を確認した。これはRoot dispatchの移管確認であり、Host保存Stage・OS Namespace観測の分離と段階5B全体の完了は残る。

### 段階5Bの保存Stage・親guard移管 — 2026-10-08

保存Stageと部分処置receipt／失敗型を`filesystem/protected_file.rs`へ、保持Directory chainと部分取得失敗型を`filesystem/host_namespace.rs`へ移した。共有の終了不明状態はNamespace guard側に一つだけ保持し、記録の容量判定も同じ状態へ接続する。公開Protocol・理由・flagを変更せず、必要な可視性を同filesystem内へ限定した。既存fixture専用の二つの親guard入口は`cfg(test)`へ限定した。

五型・二実装・名前生成関数の本文を基準Commitと照合し、既存Module移管、限定可視性、fixture入口分類と整形以外の変更がないことを確認した。Native通常44件・CLI6件、全target Clippy、台帳・Oracle23件が成功した。固定child初期化・対象観測の移管と段階5B全体確認、実環境専用試験は未完了である。

### 段階5Bの固定Namespace初期化移管 — 2026-10-08

固定child種別、初期化の部分receipt／失敗型、作成本体とNamespace専用要求を`filesystem/host_namespace.rs`へ移した。公開Native入口は同Ownerを直接呼ぶ。存在・不存在・観測不能の二判定は`filesystem/protected_file.rs`へ移し、旧値や失敗理由を保持した。三型・六関数の本文一致、Native通常44件・CLI6件、全target Clippyと台帳・Oracle23件が成功した。Namespace初期化fixtureの安定ID・exact起動名は変更せず、新実装OwnerへのRelationを追加した。対象観測と段階5B全体確認は残る。

### 段階5Bの対象観測移管 — 2026-10-08

十一／十二実体のSnapshot・部分取得・終了結果の四型と、対象照合・観測・既知file照合の八関数を`filesystem/host_namespace.rs`へ移した。記録受付は同Ownerの観測結果を既存Protocolへ搬送する。四型・八関数の本文一致、Native通常44件・CLI6件、全target Clippy、台帳・Oracle23件を確認した。fixture専用の八対象終了合成wrapperだけを`cfg(test)`へ限定した。Native内部の予定分割を配置表へ反映したが、残るProvider固有Adapter・利用側・配布閉包を含む段階5B全体は未完了である。

### 段階5Bの助言Profile照合移管 — 2026-10-08

承認済みのProvider差分離に従い、Workbench助言のRole・Model・推論強度・Provider／Offering検査と五項目のexact Identity照合を、AI Adapterの`profile/profile-execution.ts`へ移した。CoordinatorはTaskのProfile対応、Catalog改訂・Hash・Prompt、Repository非共有・Tool禁止、Executor呼出しと取消・回収を保持する。照合へ渡すIdentityは五項目だけに限定し、Task・Prompt・Path・Authorityを渡さない。受理・拒否条件、既存契約文字列と理由値は変更せず、新Frameworkや実行Capabilityを追加していない。

着手前に公開契約、二Consumer、Rootの完全一致試験、Symbolと既存ERB-UT-023の対応を照合した。正常値、Offering不一致、Roleなし、空Model、推論強度許可集合なし、全五項目の単独不一致とTask不一致を反証した。AI Adapterの整形・型・Lintと全13試験、Coordinatorの助言計画・Provider Command・Executor・本番組立て33試験が成功した。Coordinator公開静的検査も成功し、既存Lint情報54件は維持する。最終の限定搬送・Task反例追加後の型接続と差分の空白検査も成功した。段階5Bの残るDocker準備統合・利用側・配布閉包、段階6の固定Source独立レビューと段階7の署名E2Eは未完了である。File責務の全面精査へは移行していない。

### 段階5Bの固定Model・環境値検査移管 — 2026-10-08

両Docker Adapterに重複していたModel構文検査と固定環境検査を、AI Adapterの`profile/profile-execution.ts`と`profile/provider-environment.ts`へ単一化した。小文字識別子・128文字上限、Provider別禁止名、非文字列・NULの拒否を維持する。環境は一回の`Object.entries`で取得した組を元順序で返す。Coordinator側は同じ組をDocker引数へ変換し、Proxy・Home・Mount・資源名、権限、取消と回収を保持する。禁止集合のコピー、Provider別検査関数、互換shimは残していない。

公開集合とSymbol・ERB-UT-023・Details・全File対応を追従した。AI Adapterの静的検査と全13試験、両ProviderのDocker準備・CLI計画とProfile反証54試験が成功した。Coordinatorの公開静的検査・Tool Graph・二つの設計トレースも成功し、既存Lint情報54件を維持した。差分の空白検査と旧検査実体の不存在を確認した。構文の128／129文字境界、禁止名全数、空環境・空文字値、非文字列・NUL、順序、一回取得を局所確認した。これらは実Docker・実Provider・資源不存在の実測ではない。汎用Docker準備の統合、全Consumer・配布閉包と段階5B全体の完了判定は残る。全親フォルダのFile責務精査には入っていない。

### 段階5Bの共通準備Lifecycle移管 — 2026-10-08

両Providerの取消・二時計期限・一回消費を`docker-runtime/provider-preparation-lifecycle.ts`へ単一化した。既存二WeakMapを直接操作し、管理Capabilityの参照一致、30秒境界、失効→Mount解放→所定の参照除去の順序とProvider別結果を維持する。解放未確認の参照保持、失効不成立時の既存処置、具体計画型の一回返却も変更していない。新しい保存状態や回復Frameworkは追加していない。

両Provider、管理不一致、期限直前／期限到達、単調時計期限、逆行・非有限時刻、Mount解放未確認、失効不成立と再消費を局所確認した。Coordinator公開静的検査と関連48試験が成功し、既存Lint情報54件を維持した。両Providerの既存試験Symbolを共通実体へ接続した。Dockerコマンド組立て・準備統合、全利用側・配布閉包と段階5B全体は未完了であり、実資源不存在・独立Sourceレビュー・署名E2Eの成立を示さない。File責務の全面精査には入っていない。

### 段階5Bの共通Dockerコマンド移管 — 2026-10-08

両Providerに重複していたbind Mountと九コマンドの組立てを`docker-runtime/provider-docker-command-plan.ts`へ移した。Provider固有の認証環境・CLI・init要求・検証済みSeccomp条件は呼出し側で取得し、共通処理は既存Docker引数と順序だけを所有する。Prompt搬送、モデル照合、Authority発行、Home Leaseと実Process所有は今回変更していない。独立した実行Frameworkや汎用外部command入口は追加していない。

移管直前の実コマンド本文と新実体をメモリ内で比較し、両Providerのprobe／Executor／Reviewer／助言、init・Seccompの組合せ32配列で全九コマンドの同値性を確認した。各配列・コマンド・argvの凍結、Mountの五拒否例も確認した。整形・型・公開静的検査と両Provider関連50試験、試験台帳20試験が成功し、既存Lint情報54件を維持した。Symbol、Detailsと全File対応を追従した。汎用準備の統合、全利用側・配布閉包と段階5B全体の完了判定は残り、実Docker・署名E2EやSource独立レビューの成立は主張しない。全親FolderのFile責務精査の開始前に停止する指定は維持する。

### 段階5Bの共通Docker資源名移管 — 2026-10-08

両Providerの同じ乱数型・byte長検査と資源名生成を`docker-runtime/provider-docker-resource-plan.ts`へ単一化した。乱数Owner・取得回数、8／32byte、64桁小文字Home Hash、Provider別prefix、63文字上限と既存labelを維持した。Mount・Model・Authorityと実要求は移しておらず、名前から実資源所有・不存在や削除権限を推定しない。旧二つの乱数関数と命名ブロックは撤去した。

両ProviderのHome形式、資源名の63／64文字境界、Buffer以外、byte長違い、一回取得、取得例外を既存PRL-UT-014へ追加した。Coordinator公開静的検査と両Provider準備・取消関連33試験が成功し、既存Lint情報54件を維持した。Details・全File配置表・Symbolを同じOwnerへ対応した。準備本体ではClaudeの作業量確認と成功結果の追加項目が差として残るため、これらを保持して共通資源・Authority処理を統合する。段階5B全体、利用側・配布閉包と後続段階は未完了であり、全面的なFile責務精査には入っていない。

### 段階5Bの共通準備本体移管 — 2026-10-08

両Providerの受理・Mount有効化・Packet消費・Home取得・計画生成・Authority照合・候補保存を`docker-runtime/provider-docker-preparation.ts`へ単一化した。二つの固定呼出し側はProvider別計画・拒否結果・成功結果とClaude作業量確認を接続する。既存二WeakMap、opaque参照、例外時の失効→Mount解放→再throwを保持し、新しいStore、動的接続FrameworkまたはDocker要求を追加していない。呼出し側Header、Details、Symbol／既存QA試験Relationと配置表を実処理へ対応した。

移管直前の二実装と共通処理をメモリ内で64条件比較し、結果field、例外、失効・解放・保存の順序の一致を確認した。mode不一致、回復参照、Mount、Packet、時計、計画、Authority各field、取得・発行・保存例外を含む。両Provider準備、委譲結合と境界Matrixの37試験、Coordinator公開静的検査が成功し、既存Lint情報54件を維持した。実Docker・Provider実行や資源不存在の実測ではない。残る計画構築・Factory、全利用側と配布閉包を含む段階5B全体は未完了。段階5A〜F後のFile責務精査前停止を維持する。

### 段階5Bの利用側・配布閉包確認 — 2026-10-08

共通準備本体移管後、AI Adapterの公開静的検査と全13試験、CROS／MCP／Workbench／Project Runtime／Checker／Artifact Signing／Semantic Coverage／Version Controlの八Package型接続が成功した。試験台帳20契約と配布閉包の関連16契約も成功し、Domain固定Worker、分離後componentの実行Identity、開発版実体照合、子入口迂回の拒否を確認した。配布閉包の全契約は次の確認として実行し、関連集合の成功だけで全件成功や段階5B完了としない。

残るProvider別の`buildPlan`とFactoryには、Provider固有CLIの直接実装ではなく、AI Adapter記述とCoordinatorのMount・Egress・Capabilityを結ぶ組立てが残っている。Coordinator共通実行への統合予定とAI固有差の取り残しを区別して照合する。今回の確認は移管接続の局所結果であり、実Native専用試験、Source独立レビュー、署名・実Provider E2Eの未評価は維持する。

### 段階5Bの全配布閉包確認と共通Factory移管 — 2026-10-08

共通準備本体移管後の配布閉包全133契約は成功した。失敗・取消・未実行・TODOは0、所要時間は724,369.6623msである。関連16契約だけの確認とは区別し、この固定Sourceにおける全集合の結果として保持する。Native通常44件・CLI6件と全target Clippyは成功したが、実環境専用23件は未実行であり、署名・実Provider E2Eの成功は主張しない。

その後、両Providerに重複していた局所検証Factoryを既存の`provider-docker-preparation.ts`へ移した。準備三モード、取消と消費の引数順序、Provider別失敗理由、凍結、本番Authorityなしを保持し、新しい接続Frameworkや保存状態を追加していない。旧二実装とのメモリ内20条件比較で正常・例外の結果と呼出し順序が一致した。初回の型推論で具体結果型が失われたため是正し、最終のCoordinator公開静的検査と関連37契約が成功した。既存Lint情報54件は失敗・Warningと区別して維持する。

全133契約はFactory移管前の結果であり、最新差分の全件再実行結果へ流用しない。残る計画構築と共通実行組立て、段階5B全体の完了判定、5C〜F、Source独立レビュー・全体回帰・署名E2Eは未完了。全移管後、File責務精査へ入る前に止める人間指定を維持する。

### 段階5BのClaude固有引数移管 — 2026-10-08

Coordinatorに残っていたClaudeのModel・effortオプションと固定argvの結合を、AI Adapterの既存`claude-execution-plan.ts`へ移した。選定・Model構文・Task／助言Identityの受理はCoordinator、CLI固有の引数順序はAI Adapterとして境界を保持する。助言専用argvは既存の固定Commandを使い、この結合を通さない。新しい拒否条件、Model変更、fallback、実行権限は追加していない。

元配列の不変、完成argvの順序と凍結を既存ERB-IT-001の契約試験へ接続した。Coordinatorの型と固定計画・両Provider準備42試験、AI Adapterの静的検査と全13試験が成功した。共通計画構築と段階5B全体の完了判定は継続中であり、実Docker・Provider実行・署名E2Eの成功は主張しない。

### 段階5Bの局所完了判定 — 2026-10-08

最新の共通Factory・Claude固有引数を含む固定Sourceで、配布閉包全133契約が成功した。失敗・取消・未実行・TODOは0、所要時間648,235.2783msである。前回724,369.6623msの結果とは対象差分を区別する。AI Adapter全13契約と静的検査、Coordinatorの型・計画・両Provider準備42契約、Factory20条件の同値比較、共通準備64条件の同値比較を確認した。Native内部は通常44件・CLI6件、全target Clippy、Protocolと既存本文の配置照合が成功している。Native実環境専用23件、署名・実Provider E2Eは今回の局所Gateに含めず、段階6／7の義務を維持する。

段階5Bの予定範囲であるProfile・Provider固有の計画、入力、認証方式、結果変換とPlatform Access内部配置は移管済みである。AI AdapterからCoordinatorへの逆Source importは追加していない。Provider別のCLI固有実装をCoordinatorへ残さず、現行の二つのDocker AdapterはAI Adapter記述とCoordinatorのMount・Egress・選定Identity・Capability・公開結果を結ぶ組立てとして残る。この共通実行の統合は§23で当初から段階5Cへ置いた責務であり、最終目標から除外しない。二つのProvider専用組立てFileを移管全体の完成配置として固定しない。

段階5Bの局所Gateを完了とし、次は段階5CのCoordinator共通実行、Orchestrator移管と実行記録へ進む。全親フォルダの改名・移管完了、全面File責務精査、Source独立レビュー、Reality Audit、署名E2E、CHG全体完了を意味しない。5A〜Fの移管と必要な局所確認が終わった時点で一旦止める人間指定を維持する。

## 段階5Cの上位Attempt記録移管 — 2026-10-08

基準は段階5B完了Commit `3ea50c54`。段階4で確認済みのOwnerを適用し、Coordinator内の上位Attempt記録変換をOrchestrator側のTask責務へ移した。物理親フォルダの改名は後続の同段階で行う。関数名、Eventの機械値、保存契約、Root検証、欠測分類とWriter結果は変更しない。記録からAuthorityを生成せず、Provider・Dockerの起動や回復、保存状態の世代はこの差分で変更しない。

着手前に直接利用側（三つのSource／Test）、厳密型Project、Symbol Owner、詳細設計とTrace投影を照合した。二つの関数を上位公開入口へ接続し、Coordinator組立てと二つの結合試験から内部Path参照を除去した。旧Symbol IDは再発行せず、新OwnerへPathを移した。Headerの保存Effectを「なし」とする旧誤記は実際のWriter委譲へ訂正した。

確認結果は移管先の整形・厳密型・Warning拒否Lint、Coordinator本体と試験の厳密型、公開変換の四試験、既存組立て・全フローの十三結合試験が成功。欠測Providerと逆転・非有限Clockを補完しない追加反証を含む。十三結合試験は57,772.9417ms、失敗・取消・未実行0。段階5Bの全133配布契約を今回差分の再実行結果として流用しない。

本差分は既存の固定Ownerに沿う実装移管で、新たな決定権限・安全条件・外部Effectを追加しない。完成後の固定Source独立レビューと必要な文書・不足／影響監査は段階6に維持する。準拠基準は変えないため準拠監査を一律追加しない。現時点で追加の人間判断は不要。5Cの共通実行組立て、公開通知、上位本番接続、保存・回復縮小は未完了であり、5C全体Passとしない。全5A〜Fの移管後、各親フォルダのFile精査前に一旦停止する。

## 段階5Cの共通計画構築・受入判断移管 — 2026-10-08

両Providerに重複していた実行計画構築をCoordinatorの`src/docker-runtime/provider-docker-execution-plan.ts`へ移した。AI Adapterが固定CLI・環境・Model記述、Coordinatorが選定・操作・Mountの相関と資源・command構築を所有する。Codex ExecutorのSeccomp、認証環境・Proxy差とClaudeの仕事量・引数差を保持した。新しいAuthority、保存状態、Docker要求または回復Frameworkは追加していない。

固定Sourceの公開静的検査、両Providerの既存51試験が成功した。メモリ内の旧新104条件比較では、返値、拒否、乱数・Seccomp確認の順序と例外分類が一致した。比較は計画値の局所確認であり、実Docker、実Providerまたは全E2E成立を証明しない。全配布133契約は段階5Bの基準結果であり、この差分の全回帰結果へ流用しない。

上位の受入判断Principal照合をOrchestratorの現行`project-runtime/src/decision/acceptance-authority-adapter.ts`へ移した。既存関数本文、拒否条件とSymbol IDは保持し、内部Path参照を公開入口へ置き換えた。新設された対象は移管先の試験であり、QA Local Itemは既存PRL-IT-008を使用する。移管先の整形・厳密型・Lint、受入判断6試験とCoordinatorの公開静的検査が成功した。本番組立て・全フローの十三結合試験も59,707.4112msで成功し、失敗・取消・未実行・TODOは0だった。Coordinatorの既存Lint情報54件はWarning・失敗と区別して維持する。旧実装へのSource参照と差分の空白破損はない。

共通実行・公開通知、Orchestrator全組立て、保存・回復縮小と5C〜Fの移管は未完了である。現時点で追加の人間判断は不要。全移管と必要な局所確認の後、各親フォルダのFile精査へ入る前に停止する。

## 段階5Cの上位実行要求接続移管 — 2026-10-08

Project／Milestone／Task／Attempt／Operation／Revisionの相関を扱う実行許可Adapterを、Orchestratorの現行`project-runtime/src/task/execution-authorization-adapter.ts`へ移した。発行・失効処理そのものはCoordinatorが保持する。上位Adapterは既存callbackへ委譲し、不透明な結果を複製・永続化せず返す。既存関数本文と理由値、拒否時の発行0、発行不明・失効不明の処置は変更していない。委譲Effectを「なし」とするHeaderだけを実処理へ訂正した。

全直接利用側を公開入口へ接続し、安定Symbol IDは変更せずOwnerとPathを移した。署名Source閉包の四相関検査と反証入力も新OwnerのPathへ追従した。初回型確認で追加の試験利用側五箇所が見つかったため是正し、Coordinatorの公開静的検査を最初から再実行して成功した。Orchestratorの整形・厳密型・Lintも成功した。旧実装PathへのSource参照と差分の空白破損はない。

署名閉包の宣言集合、Capability搬送の反証、移管componentの実行Identityの三契約は34,004.2232msで成功した。静的検査成功後の上位実行・採用・再計画・回復の79試験は198,882.7373ms、本番組立て・全フローの13試験は72,262.2363msで成功し、各集合とも失敗・取消・未実行・TODOは0。これは実署名や実Providerの試験ではない。初回静的失敗に続いて実行された三試験の成功は、この確認の完了根拠へ流用していない。

5C全体と5D〜Fは未完了。公開APIの通知・全本番組立て・保存縮小・親改名の義務を維持し、全移管完了後にFile精査へ入る前に停止する。

## 段階5Cの人間判断コード移管と単一Taskの依存照合 — 2026-10-08

人間判断の一回利用秘密値と照合Hashの生成をOrchestratorの現行`project-runtime/src/decision/decision-capability-adapter.ts`へ移した。32byteの暗号乱数、base64url、SHA-256、凍結、既存発行・置換・失効契約を維持し、秘密値をログやEvidenceへ追加していない。全直接利用側四箇所を公開入口へ接続し、既存Symbol IDはOwnerとPathだけを移した。DetailsとTrace投影も追従した。

移管先の整形・厳密型・LintとCoordinator公開静的検査が成功した。判断生成、再計画・一回判断と本番全フローの13試験は42,932.8519msで成功し、失敗・取消・未実行・TODOは0。全配布閉包、実署名、実Providerと固定Source独立レビューの成立へ昇格しない。

次の単一Task AdapterはOrchestrator本番組立てだけでなくCoordinatorのWorkbench候補実行にも使われている。そのままOrchestratorへ移すと下位から上位へのvalue依存を追加するため、まだ移していない。既存の開始・取消・完了・回収をCoordinatorの共通実行として保持し、上位Attempt・Revision相関と結果投影を分ける。既存Provider開始通知はDocker Controllerの実Process開始観測点にあり、Taskの`started`返却と同一視しない。公開通知の接続ではこの観測点を利用し、新しいイベント基盤を作らない。

5C〜Fの移管、親改名と必要な局所確認は未完了であり、全移管後のFile精査前停止は維持する。

## 段階5Cの共通取消・完了待機抽出 — 2026-10-08

開始済みTaskの受付確認、取消の一回搬送、元の完了待機とabort監視解除をCoordinatorの`src/task/task-completion-observation.ts`へ抽出した。Taskの開始・入力検証、上位Attempt・Revision相関、完了結果の検証・投影は既存Adapterに保持し、公開API全体の切替完了とは表示しない。取消の例外・非同期拒否をcleanupの成立へ補正せず、元の完了Promise拒否をunknownとして保持する。新しいAuthority、Provider要求、保存状態や回復機構は追加していない。

Coordinator公開静的検査が成功した後、既存の取消・不正shape・回復結果の検証に監視解除の直接観測を加えた25試験が1,315.6076msで成功した。失敗・取消・未実行・TODOは0。実AbortSignalの監視が成功・拒否の双方で0となること、同じ制御参照へ取消が一度だけ搬送されることを確認した。実Process・Docker資源の不存在、全回帰、独立レビューやE2Eの成立はこの試験から推定しない。

5C〜Fは未完了。共通開始・公開通知・全本番組立てと親改名の完了まで進め、全移管後のFile精査前に停止する。

## 段階5Cの共通単一TaskとWorkbench接続 — 2026-10-08

単一Taskの開始・完了形状検証、既知のEffect前拒否、回復参照と取消後の閉結果をCoordinatorの`src/task/task-attempt-runtime.ts`へ分離した。共通処理から上位のAttempt・判断権限・RevisionおよびOrchestratorへのimportを除き、これらの検証と結果相関は上位Adapterに残した。Workbench候補実行は共通処理へ直接接続し、偽の上位Attemptや判断権限IDを生成しない。Root・Revision・Profile・Pathの既存観測とCapabilityの発行・失効は保持した。

公開静的検査成功後、単一TaskとWorkbench候補実行の28試験が1,497.9967msで成功した。失敗・取消・未実行・TODOは0。拒否理由、未知結果の停止、exact回復、取消の一回転送、監視解除と未信頼候補返却を維持した。これは実署名・実Provider・全回帰や独立レビューの成立を意味しない。上位Adapterの物理移管、公開API通知と本番組立て、残り5C〜Fは未完了。全移管後のFile精査前停止を維持する。

## 段階5Cの上位単一Task Adapter移管 — 2026-10-08

上位相関AdapterをOrchestratorの現行`project-runtime/src/task/single-task-adapter.ts`へ移した。直接利用側、厳密型確認の母集団、Details、Registryと棚卸しを同じOwnerへ更新し、既存Symbol IDを保持した。Coordinator共通処理はTask専用の`src/task/index.ts`から公開し、静的import閉包四Fileに上位Sourceがないことを確認した。Coordinatorルートに残る旧上位再exportは全本番組立て移管後に撤去する未完了事項であり、今回の専用入口を全体完成の代替としない。

最初の操作は安全確認で、移管先名称と循環参照の懸念により拒否された。操作は迂回せず、§8・§14の承認済みOwner・依存方向を再照合した。現行`project-runtime`がOrchestratorへの改名対象であることを確認し、上位再exportを推移的に読むCoordinatorルートではなく、上位依存のないTask専用入口を先に分離した。依存経路を変更した後に移管した。

両Packageの公開静的検査が成功した。単一Task、Workbench候補と上位実行の77試験が36,778.3322ms、本番組立て・全フローの13試験が70,646.0462msで成功し、両集合とも失敗・取消・未実行・TODOは0。完了待機中の可変入力による上位相関の置換を反証し、開始時の相関を保持した。Source旧Path参照と差分の空白破損はない。署名閉包全回帰、実署名、実Provider、独立レビューは今回の試験から推定しない。

5C〜Fと全移管は未完了。次は上位組立て・保存、共通公開通知・実行記録の接続を継続する。全移管後の親FolderごとのFile責務精査前停止を維持する。

## 段階5Cの上位Host・回復接続移管 — 2026-10-08

上位実行の時刻・安定識別子とProcess安全操作の組立てを、Orchestratorの現行`project-runtime/src/task/execution-host-adapter.ts`へ移した。Process世代、回復参照の生成・照合と終了不明時の実行停止状態はCoordinatorの既存Ownerに保持し、Task専用公開入口から利用する。Repository結合と回復遷移の接続も`src/task/task-recovery-adapter.ts`へ移した。Dockerの実Recovery・ack・finalizeは既存のCoordinator操作が所有する。二つの移管関数はHEADの基準本文と一致し、新しい回復状態、AuthorityやFrameworkを追加していない。

利用側、型確認、Symbol、Details、Registryと棚卸しを更新した。回復接続の移管時に一部ファイルの書込みが失敗したため、適用済み範囲を確認して残りを補い、両Packageの公開静的検査を最初から再実行して成功した。旧Source Path参照と差分の空白破損はない。

Host移管後の上位実行・再計画・Process安全状態の66試験は45,604.2325msで成功した。回復接続も移管した最終Sourceでは、Host接続・Objective受付／再入場・回復の18試験が123,424.8221msで成功し、両集合とも失敗・取消・未実行・TODOは0。回復の中断再入場、exact参照、未知Effectと候補の処置を確認した。これらを実Docker・実Provider・署名E2EやSource独立レビューの成立へ昇格しない。

残る5Cの上位組立て・保存移管と共通通知・実行記録、5D〜Fを継続する。全移管後のFile責務精査前停止を維持する。

## 段階5Cの保存移管前の回復依存切離し — 2026-10-08

保存基盤の利用側を照合した結果、CoordinatorのDocker回復入口から上位の耐久Task状態を読む依存を確認した。保存基盤だけを先に移すと下位からOrchestratorへの逆依存が残るため、上位状態との回復結果照合を既存の`project-runtime/docker-project-recovery-settlement.ts`へ集約した。既存のRuntime所有応答確認・終了整理は公開せず、この上位確定接続だけが内部操作へ委譲する。Root・観測器・実行器の差替え入口は追加しない。上位ファイルの物理移管は保存基盤と合わせて後続で行い、現在の配置を最終状態としない。

移した二関数はHEAD基準の関数本文と一致した。下位入口に上位状態読取り依存がないことを静的反証へ追加し、利用側と試験Relationを追従した。回復条件、世代、exact参照、保存内容、Docker操作は変更していない。初回試験は内部操作の公開露出を検出したため、公開せず既存内部操作へ委譲する接続へ是正した。また旧配置のimport式と並び順が残った静的閉包試験を現在配置へ追従し、必要な内部利用側だけを全数比較する契約を維持した。修正後の公開権限非露出・内部利用側閉包の二契約は556.8719msで成功した。初回の広い試験集合を修正後のPassへ流用しない。

修正後の固定Sourceで関連128契約を最初から再実行し、323,903.9893msで128成功、失敗・取消・未実行・TODOは0となった。公開境界二契約の局所再確認に続き、上位受付、exact回復、混在義務、中断再入場と再試行も確認した。最終静的検査は成功し、既存Lint情報54件を維持した。実Docker・実Provider・署名E2E、全回帰やSource独立レビューの成立へ昇格しない。

5C〜Fと全移管は未完了。全移管と必要な局所確認の後、File名・責務・配置の全面精査前に人間へ報告して停止する。

## 段階5Cの共通安定読取り移管 — 2026-10-08

上位保存をCoordinatorの非公開保存部品へ逆依存させないため、`state-storage/bounded-file-snapshot.ts`をDomain Modelの`src/storage/bounded-file-snapshot.ts`へ移した。Coordinator現在状態、上位の耐久保存・統合記録と既存試験はstorage公開入口を利用する。安定Symbol IDを維持してOwnerだけを移し、Coverage対象と棚卸しを追従した。容量上限・読取り前後の実体照合・descriptor終了の実コードと型はHEAD基準に一致する。書込み、Root Authority、業務状態や回復方針はこの部品へ追加していない。

Domain ModelとCoordinatorの公開静的検査が成功し、Coordinatorの既存Lint情報54件を維持した。読取りの反例と既存候補採用の関連実行は9件、51,122.4436msで成功した。この集合にはWindows実環境専用の状態保存を含めず、当該Fileの終了成功を保存能力の実測へ昇格しない。Coverage母集合・未到達義務の五契約は193.1289ms、保存利用側の閉包四契約は748.3503msで成功した。すべて失敗・取消・未実行・TODOは0で、別途除外したHost試験の未評価は維持する。

上位保存と本番組立ての物理移管、公開通知・親改名と残り5C〜Fは未完了。全移管後のFile責務精査前停止を維持する。

## 段階5Cの上位判断値検査移管 — 2026-10-08

現行Snapshotが旧個別保存WriterのModuleから判断値検査だけを利用していたため、受入判断Record・Envelopeを`project-runtime/src/decision/acceptance-decision-record.ts`、未解決判断Intentを`src/decision/decision-recovery-record.ts`へ切り離した。現行保存はOrchestrator公開入口を利用し、旧個別保存Moduleを読み込まない。三つの検査関数はHEAD基準の本文に一致し、契約値、世代・Source・Identityの判定、保存形式と回復条件は変更しない。新しいWriter、状態、DirectoryやAuthorityは追加していない。

OrchestratorとCoordinatorの静的検査が成功した。移管で残った未使用型・定数を除去し、最終結果は既存Lint情報54件だけでWarning・Failは0。既存の判断保存・現行単一状態保存を通る本番結合八契約が80,829.5414ms、上位の受入判断六契約が380.4379msで成功した。両集合とも失敗・取消・未実行・TODOは0。Source Symbolと、実際に検査を経由する既存試験Relationを追従した。

旧個別保存Writerは試験利用側に残るため、廃止済みとは表示しない。次は当該試験を現行Snapshot Portへ切り替えて旧Writerを撤去し、上位保存・本番組立てを物理移管する。5C〜Fと全移管は未完了で、実署名・実Provider E2Eや独立SourceレビューのPassを主張しない。全移管後のFile責務精査前停止を維持する。

## 段階5Cの旧判断Writer撤去 — 2026-10-08

旧受入判断Writerと旧判断回復Writerの試験利用側を、現行の単一Snapshot保存へ切り替えて二つのSourceを撤去した。受入判断の再読取り・二世代Hash連鎖と、回復記録の再読取り・重複拒否・exact比較交換を維持する。旧世代Directoryの未知Fileという反例は廃止配置へ依存するため、現在の回復値への未知欄挿入へ置換した。外側の内容Hashは更新して一致させ、内部契約検査で拒否し保存bytesを変更しないことを確認する。受入判断も同様に外側Hashを一致させた前世代Hash改ざんを拒否する。旧DirectoryのWriter・互換入口を新配置に残していない。

試験Fixtureを検証済みRepository-local tmpへ限定し、終了時のexact Root再確認と不存在確認を追加した。現行設計台帳、実装意味Relation、試験Symbolと棚卸しを追従した。旧Source Symbolの意味と試験接続は現行耐久基盤へ移し、値検査は既に移管したOrchestratorを参照する。保存Consumerの全数比較を維持し、三つの本番保存Factoryの接続を明示検査する。過去の固定Evidenceや旧配置実測を現行へ書き換えていない。

初回静的検査はPort結果のunknown型を試験から直接参照した四箇所を拒否した。試験の結果型注記を直した後に再実行し、Coordinatorの整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件だけでWarning・Failは0となった。Domain Modelの整形・型・Lintも成功した。撤去後の固定Sourceで判断回復・公開受入判断・本番全フローの八契約が56,423.5578ms、最終Consumer閉包四契約が705.3208msで成功した。両集合とも失敗・取消・未実行・TODOは0。自己所有Fixtureの不存在、現行Source・Registry・詳細設計からの旧Writer Path参照不存在と差分空白破損0を確認した。

これは旧判断Writer二件の撤去と利用側切替の局所完了であり、保存基盤全体・本番組立ての物理移管、公開通知、親改名や5C〜Fの完了ではない。実署名・実Provider E2E・全回帰・固定Source独立レビューは未完了を維持する。全移管と必要な局所確認が終わった後、親FolderごとのFile名・責務・配置の全面精査前に停止して報告する。

## 段階5Cの上位結果値検査移管 — 2026-10-08

現行Snapshotが旧結果WriterのModuleから利用していた結果値検査を、Orchestratorの`src/storage/result-record.ts`へ移した。保存結合と結果Recordの型は型専用の`src/storage/types.ts`へ分け、現在保存にも用いるRecordを`ProjectRuntimeResultRecord`として明示した。現行耐久基盤は上位公開入口を利用し、旧結果Writer／ReaderのModuleを値検査のために読み込まない。型名以外の検査関数本文はHEAD基準に一致し、固定欄、結合ID、結果Identityと内容Hashの判定は変更していない。Filesystem処置、受領・採用判断、状態やAuthorityを値検査へ追加していない。

初回Coordinator型検査は、旧Reader／Writer自身が引き続き利用する識別子定数の欠落七箇所を拒否した。旧処理の局所判定を復元して再実行し、OrchestratorとCoordinatorの整形・型・Lintが成功した。Coordinatorの能力Graphと設計台帳も成功し、既存Lint情報54件だけでWarning・Failは0。Source Symbolと、検査を経由する旧結果境界試験のRelation、詳細設計と棚卸しを追従した。

最終Sourceの結果記録境界・候補統合・本番全フロー17契約が61,537.1837msで成功し、失敗・取消・未実行・TODOは0。未知欄・Hash・結合不一致、途中置換・消失、alias・容量・不正UTF8、同一再送・異内容衝突、明示採用・Revision不一致・取得根拠不正の既存反例を確認した。この実行には旧Reader／Writerの試験が含まれるため、撤去完了とは表示しない。現行保存から旧Moduleへの依存不存在と差分空白破損0を確認した。

次は旧結果Writer／Readerの試験利用側切替と撤去、保存基盤・本番組立ての物理移管を継続する。5C〜Fの移管、全体回帰、固定Source独立レビュー、実署名・実Provider E2Eは未完了。全移管後のFile名・責務・配置の全面精査前停止を維持する。

## 段階5Cの旧結果Writer／Reader撤去 — 2026-10-08

旧個別結果Writer／Readerの唯一の試験利用側を現行Snapshot結果Portへ切り替え、旧Sourceを撤去した。同一候補の再送はstate.jsonを変更せず、完全な正規候補Identityを保持する。異内容の同一Identityは最初の結果を置換せず拒否し、不正な結合入力は保存Effect前に拒否する。旧results Directoryを生成しない。設計台帳・実装Symbol・試験Relation・Git利用側閉包を現行保存Ownerへ追従し、同じOwnerへの重複Relationを除去した。

旧形式移行専用Readerの五試験は、フロントAIが旧形式移行を扱い本番Sourceは新形式だけを扱う方針に従い廃止した。旧Directory列挙・旧世代抽出を新形式の互換機能として残さない。現行保存のFilesystem反例は耐久基盤試験へ残るが、今回そのHost専用試験を実行したとは主張しない。保存基盤に残る旧State／Queue／Lease処理の撤去と、基盤自体の物理移管は次の残件である。

追加反例の初回実行は五件中一件失敗した。終了Queueの整理後も結果を保持できる契約に対し、存在しないQueueへの参照を一律破損と誤判定した試験だった。反例を実在Queueと異なるMilestoneへの結合へ修正し、未知欄・内部Hash破損とともに外側Hash一致でも停止し保存bytesを保全することを確認した。保存実装の検査や拒否条件を弱めていない。修正後の五件は2,961.7788msで成功した。

撤去後の結果保存・候補統合・本番組立て十三契約は91,013.4999ms、Git利用側の全数閉包十契約は748.4007msで成功した。いずれも失敗・取消・未実行・TODOは0。Coordinatorの整形・型・Lint・能力Graph・設計接続は成功し、既存Lint情報54件を維持した。Orchestratorの整形・型・Lintも成功した。これは現行作業ツリーの局所確認で、固定Source独立レビュー・全体回帰・署名・実Provider E2Eの結果ではない。

5C〜Fと全移管は未完了。全移管と必要な確認が終わった後、親FolderごとのFile名・責務・配置の全面精査前に停止して人間へ報告する。

## 段階5Cの旧State／Queue／Lease移行Reader撤去 — 2026-10-08

旧State／Queue全世代の抽出Reader、旧Lease証拠と物理残存の抽出Reader、および専用型を撤去した。旧形式移行をフロントAIへ限定する方針に従い、本番に移行互換機能を残さない。旧形式専用の六試験と旧Reader専用の領域置換二経路を廃止し、現行Snapshotの不存在・観測不能・途中置換を確認する三試験は維持した。観測不能のFixtureも旧個別Stateではなく新版state.jsonへ切り替え、停止後の現在bytes保全を確認する。

未解決Lease・Queue・結果の保存結合試験は廃止せず、明示初期化、新版State／Queue Port、新版Lease取得と現在Snapshot読取りから前状態を作る形へ切り替えた。v2の現在受付世代、取得意図・証拠と動的なSnapshot改訂番号を使用し、旧Readerから抽出したv1値を前提にしない。受付変更、結果・意図欠落、Owner・結合不一致、世代飛越、pending不一致、rename失敗と保存bytes保全の反例を保持した。試験が注入した短命pendingだけを終了hook前に片付け、同じLeaseの解放結果を確認する。

最初の限定実行は上記三読取り反例とWindows保存結合の四件が9,031.299msで成功した。続くSnapshot関連十四契約は38,623.4077msで全件成功し、初期化・独立採用、終了Queue整理・旧受付拒否、固定pending再入場、部分形式拒否、Root結合・OS排他と値検査を確認した。いずれも失敗・取消・未実行・TODOは0。これは名前で選択した集合であり、保存基盤全試験や全Native試験の成立を示さない。Windows実環境試験はこの集合に含まれる選択対象だけを実行した。最終の整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件だけを維持した。旧Reader名のSource／配布入口参照不存在と差分空白破損0を確認した。

旧個別State／Queue／Lease Writer、試行部分形式codecと、それらを使う旧試験はまだ残る。次に現行Portへの試験接続を照合して撤去し、保存基盤・本番組立ての物理移管を続ける。5C〜F、全体回帰・固定Source独立レビュー・署名・実Provider E2Eは未完了。全移管と必要な確認の後、全面的なFile名・責務・配置精査前に停止して人間へ報告する。

## 段階5Cの試行部分形式撤去と現行保存試験の接続 — 2026-10-08

未使用のState／Queueだけを扱う試行部分形式codecと専用型・定数・試験を撤去した。Sourceと配布入口に利用側がないことを確認し、本番の完全Snapshot検査は変更していない。旧個別Writerは残るため、保存基盤全体の撤去完了とはしない。

Queue優先順位の四試験を現行初期化・State／Queue／Lease Portへ切り替えた。実行中Ownerを横取りせず、対話要求を優先し、同一Bindingの複数Projectに同時Ownerを作らない。三子Processの競合では一件だけが取得し、他二件は安全な競合拒否となる。取得したLeaseの解放完了・手動回復不要と、終了後の取得Owner不存在を確認する。Fixtureと同期用Fileは検証済みRepository-local tmp内に閉じ、子Processのcloseを待って自己所有Rootを清掃する。

取得Owner不存在の追加確認は初回に返却形を誤解して一件失敗した。Portの結果はnull自体ではなく`{ acquisition: null }`であるため、試験側を契約に一致させた。保存実装や競合拒否条件は変更していない。修正後の四件は11,881.2339msですべて成功し、失敗・取消・未実行・TODOは0だった。

State保存・再読取り、古い世代の再送拒否、破損本文と不可能なTask状態の拒否を扱う四試験も現行Portへ切り替えた。反例では外側Hashを一致させても内部契約違反を拒否し、拒否前後でstate.jsonのbytesを保全する。旧世代Directoryを生成しない。四件は4,814.0543msですべて成功し、失敗・取消・未実行・TODOは0だった。型検査は成功したが、これを保存基盤全試験・全回帰・固定Source独立レビューの成功へ昇格しない。

変更後のSnapshot関連十三契約は27,206.2606msですべて成功した。撤去した部分codec専用試験を除き、前回選択集合の現在契約を維持した。初期化・独立採用、受付世代・終了整理、固定pendingの再入場、未解決保存結合とOS排他を確認し、名前で選択したWindows専用試験を含む範囲だけの結果として扱う。Coordinatorの整形・型・Lint・能力Graph・設計台帳も成功し、既存Lint情報54件だけでWarning・Failは0だった。

次は残る旧Writer利用試験の現行契約への対応と撤去、基盤・本番組立ての物理移管を続ける。5C〜F、全体回帰・Reality Audit・独立Sourceレビュー・署名E2Eは未完了。全移管と必要な接続確認後、親FolderごとのFile名・責務・配置の全面精査前に停止して報告する。

## 段階5Cの現行保存反例・Queue所有結合の追従 — 2026-10-08

旧世代Directoryを前提にしていたEnvelope検査を、現行state.jsonの必須欄欠落・未知欄・不正Schema・不正改訂番号・Hash破損・未確定pendingの六反例へ切り替えた。不正Schemaと改訂番号では外側Hashを再計算して一致させても拒否する。Readerは不正保存を修復・上書きせず、本文とpendingのbytes、Directory内容を保全する。廃止された世代Fileの名前・欠番・任意残存の列挙自体は新版の互換契約へ移植しない。世代の比較交換と固定pending再入場は現在保存の別試験が引き続き所有する。

Queueの未知recordKind、別Repository Bindingの読取り、同一要求再送・異内容衝突と不透明Leaseの結合検査も現行Portへ切り替えた。単一Snapshotは一つのBindingを所有し、異なるBindingからの読取りとPort構築を拒否して保存bytesを変更しない。取得前の偽造Lease、古いQueue世代、存在しないQueueへの取得、解放後Leaseの再利用を拒否する。旧Queue Directoryを生成しない。

Lease試験の初回実行は、存在しないQueueへの取得理由を旧方式の競合拒否と期待して失敗した。現在方式ではQueue結合を取得前に検査し`project_runtime_lease_binding_invalid`で止める。試験の期待理由を現行契約に合わせた後、当該一件は2,595.2969msで成功した。保存実装、拒否条件、Authorityは変更していない。

今回切替分と前回のState検査を合わせた八契約は13,947.5679msで成功し、失敗・取消・未実行・TODOは0だった。静的検査は切替後に不要となった旧選択APIのimport一件を警告として検出した。撤去後のCoordinator整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件だけでWarning・Failは0だった。自己所有Fixtureの不存在と差分空白破損0も確認した。これらの成功を全保存試験、全体回帰、独立Sourceレビューや移管完了へ昇格しない。旧Writer利用試験・基盤物理移管・5C〜Fを継続し、全移管後の全面File精査前停止を維持する。

## 段階5CのQueue結合・Lease排他・終了保存失敗の追従 — 2026-10-08

旧Queue世代FileのIdentity検査を、現行Queueと取得意図の相関検査へ切り替えた。Project ID／Queue IDを外側Hash一致のまま変え、再送・更新の四反例で拒否と保存bytes不変を確認した。試験が注入した不正値だけを自己所有Fixtureの正常値へ戻し、同じLeaseの解放を確認してからRootを回収する。旧世代File列挙を新形式の互換能力として残さない。

実行LeaseとProject単位の採用Leaseの排他も現行Portへ接続した。操作Leaseの重複、採用Leaseの重複と不正Queue結合を拒否し、別種のLeaseを独立解放・再取得できる。採用は現在契約の固定Queue識別子`canonical`を使用する。

解放後の終了保存失敗は、解放意図保存の後にstate.pending.jsonからstate.jsonへの終了確定だけを失敗させて確認した。解放結果は同じexact回復参照を保持し、現在保存の未解決段階、終了候補pendingと実排他不存在を別々に確認した。保存が未確定のまま再取得を成功へ畳まず、再取得拒否後も現在値とpendingのbytesを保全する。初回は段階行を一行だけと誤期待して失敗したため、保持された全段階が同じOwner・回復参照へ結合する現在契約へ試験側を修正した。実装の状態・拒否条件や回復方式は変更していない。

修正後の三契約は14,483.8846msで全件成功し、失敗・取消・未実行・TODOは0。静的検査で検出した試験の型注記不足と追加Lint情報を是正した後、Coordinatorの整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件だけでWarning・Failは0となった。自己所有Fixture不存在と差分空白破損0を確認した。旧Writerの残る利用側と物理移管は未完了。全移管後のFile責務精査前停止を維持する。

## 段階5Cの終了Process・未結合取得・採用Leaseの追従 — 2026-10-08

子Processで取得して終了したOwnerの三試験を現行Portへ接続した。Queueへ所有を結んだ後のOwner損失は`recovery_required`へ移し、Queue結合前の取得中断はQueueを`queued`に保ちながらexact回復参照を確定する。再入場は旧Markerを再作成せず、現在保存から二重処置・改訂増加なしで完了する。採用Leaseは現在契約の`canonical`結合を使い、Queue操作と混同せず同じ回復参照で閉じる。三経路とも実排他Directory不存在と次の取得・解放を確認した。旧Reader／Writer、旧世代FileやMarkerへの書込みを試験から外した。

初回の子Process実行は現行Snapshot Lock取得不能で止まった。原因は試験の`--input-type=module`が内部Workerへ継承されることだった。入力なしの固定FixtureをWorkerとして起動する比較では、同引数ありで`ERR_INPUT_TYPE_NOT_ALLOWED`、なしでFixture自身の入力拒否へ到達した。不要な同引数を試験から外すと同じ保存・回復処理が成功した。生のProvider出力やSecretを収集せず、保存実装、Worker Framework、Timeoutと回復方式は変更していない。上位還元はN/A: 試験専用evalの起動引数による不成立であり、本番契約へ新しい回復機構を追加する根拠ではない。局所診断では結果の状態・理由だけを公開し、最初の拒否を観測可能にした。

三契約は10,450.9594msで全件成功し、失敗・取消・未実行・TODOは0。Coordinatorの整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件だけでWarning・Failは0。自己所有Fixture不存在と差分空白破損0を確認した。旧Writerの残る競合・境界・再入場試験と基盤・本番組立ての物理移管は未完了。5C〜Fを継続し、全移管と必要な接続確認後の全面File精査前停止を維持する。

## 段階5Cの生存Owner競合・取得確定前中断の追従 — 2026-10-08

生存Ownerへの後発取得と、物理排他作成後・取得確定前の中断を現行Snapshot Portへ移した。採用Leaseは固定Queue識別子`canonical`へ結合する。競合拒否では現在状態のbytes不変と回復参照非発行を確認し、取得確定前中断では子Processの終了後に現在保存のexact回復参照で閉じ、再取得・解放まで確認した。子Processの終了通知だけでなく標準出力・標準エラーの閉鎖を待ち、失敗時も自己所有Processの終了待機を済ませてからFixtureを回収する。

試験補助Fileの利用側六箇所がすべて現行保存を使うことを確認し、旧Markerの公開前停止hookと旧保存形式への自動切替を撤去した。旧形式移行はフロントAIの処置とし、新形式の試験に互換分岐を残さない。本番保存契約・回復条件・Timeout・外部Effectは変更していない。上位還元はN/A: 既存の現行排他・再入場契約へ試験を追従した変更で、新しい本番保証は導入していない。

切替直後の二契約は5,347.3929msで成功。旧形式分岐撤去後の基盤28契約は成功した（試験runner表示は対象名に一致する試験を持たない二Fileの終了を加えて30件、55,532.0039ms）。さらに補助Fileを使うObjective再入場・実行中受付・採用直列化・不正取得根拠保全の四契約が24,808.155msで成功した。Coordinatorの整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件のみでWarning・Failは0。差分空白破損0。これを全保存方式・全体回帰・独立Sourceレビューの完了へ昇格しない。旧Writer試験の残り、基盤・本番組立ての物理移管と5D〜Fは未完了であり、全移管後の全面File責務精査前停止を維持する。

## 段階5Cの取得読戻し・清掃失敗・Queue結合前解放の追従 — 2026-10-08

旧取得Markerの読戻し失敗を現行取得予約後の実排他読戻し失敗へ、旧一時Marker清掃失敗を現行実排他清掃失敗へ置き換えた。新形式に存在しない旧資源や互換処理を復活させない。取得意図・実排他・exact回復参照を保全し、注入解除後の再入場、実排他不存在と次の取得・解放を確認した。子ProcessがQueueへ所有を結ぶ前に解放失敗して終了するケースも現行Portへ接続した。Queueはqueuedを保ち、回復参照はresultReferenceへ搬送する。

初回静的検査の型絞り込み不足一件と、三試験初回の操作Port戻り値の誤期待一件を試験側で是正した。修正後の三契約は9,621.9841msで成功、失敗・取消・未実行・TODOは0。Coordinator整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件のみでWarning・Failは0。差分空白破損0。上位還元はN/A: 既存現行契約への試験追従であり、本番保証・回復条件・Timeoutは変更していない。旧Writer試験の残りと物理移管・5D〜Fは未完了。局所成功を全体回帰・独立Sourceレビューとせず、全移管後の全面File精査前停止を維持する。

## 段階5CのIdentity不一致と取得前保全の追従 — 2026-10-08

旧取得・解放Markerの不一致を現行取得意図のOwner／回復参照不一致へ置き換えた。外側Hashを一致させた二反例でも回復前に拒否し、Owner観測を発行せず保存bytesと実排他名集合を保全する。取得前の不正状態、未確定pending、既存排他の三反例も現行形式へ接続した。取得Identityを確定できない場合は回復参照を捏造せず、既存内容を保全する。旧一時Markerと互換形式は再導入していない。上位還元はN/A: 既存の現行入力検証・排他契約へ試験を追従した変更で、本番保証は変更していない。

二契約内の五反例は9,596.9029msで成功した。静的検査が検出した不要な旧回復API import一件と追加Lint情報二件を是正した後、Coordinator整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件のみでWarning・Failは0。旧Writerを使う終了確定・回復根拠検査等と物理移管・5D〜Fは残り、全移管後の全面File責務精査前停止を維持する。

## 段階5Cの終了確定・長い回復参照・解放済み再入場の追従 — 2026-10-08

Queue所有解除、長いDocker回復参照の搬送、解放後の終了確定中断、exact Queue結合の終了証拠拒否を現行保存へ接続した。物理解放前の終了確定拒否は保存bytesを保全し、解放後も正式確定までQueue所有を残す。長い回復参照は切詰めず保持する。証拠内と外側のHashを再計算したQueue結合不一致と、終了証拠欠落の反例で内容保全・Owner観測非発行を確認した。

追従中に本番接続不足を検出した。旧経路で成立していた統合待ちQueueの解放後再入場が、新経路では実行中状態以外として拒否された。既存の終了確定Portへ接続し、同じQueue世代・Owner・終了証拠・実資源不存在の検査を再利用して是正した。初回接続の受付世代引渡し不足も検出・是正し、観測済み世代を渡している。新しい回復方式や状態を追加せず、統合待ちと結果参照を保持して所有だけ解除する。上位還元はApplicable: 終了確定とOwner喪失の分離をDetailsへ明示し、取得意図不存在だけで終了を推定しない契約へ接続した。

最終四契約は12,250.9188msで成功、失敗・取消・未実行・TODOは0。追従で不要になった旧API import二件を撤去した後、Coordinator整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件のみでWarning・Failは0。差分空白破損0。初回拒否と接続是正の失敗履歴を成功へ書き換えない。固定Source独立レビュー・全体回帰・残る旧Writer試験と物理移管は未完了であり、全移管後の全面File精査前停止を維持する。

## 段階5Cの回復根拠破損・Owner不明・一般再開拒否の追従 — 2026-10-08

旧個別回復Fileの破損反例を現行状態内の不正回復証拠へ移し、外側Hash一致でも保存bytes・実排他名集合を保全して拒否することを確認した。Ownerの生存／観測不能は保存bytes不変で拒否し、通常再開要求、偽造Leaseと別Queue結合でQueue世代を進めない反例も現行Portへ接続した。実在しないQueueは現行契約の結合不正として拒否し、旧世代File列挙を現在のQueue世代照合へ置き換えた。上位還元はN/A: 既存の現行検証・回復条件へ試験を追従した変更で、本番保証は追加していない。

三契約は最終7,420.2904msで成功、失敗・取消・未実行・TODOは0。不要になった旧API import四件と追加Lint情報を撤去した後、Coordinator整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件のみでWarning・Failは0。旧API直接利用は保存サイズ上限試験が残り、旧Writer撤去・物理移管・5D〜Fと全面File精査前停止を維持する。

## 段階5Cの保存容量境界の追従 — 2026-10-08

最後の旧State API直接利用だった容量境界試験を、現行Snapshot保存Portへ接続した。16MiB−1と16MiBの保存・読取り成立、16MiB＋1のEffect前拒否を実FileのByte数で確認した。超過拒否では基準状態のbytes不変、pending不存在、未保存Project不存在を別々に確認し、旧states Directoryを生成しない。旧Envelope補助と不要importを撤去した。上位還元はN/A: 既存の現行容量契約への追従で、新しい保証を追加していない。

一契約内の三境界は3,292.7519msで成功した。撤去後のCoordinator整形・型・Lint・能力Graph・設計台帳は成功し、既存Lint情報54件のみでWarning・Failは0。利用側棚卸しでは、基盤試験以外に再計画・実行の二Fileが旧Writerを直接importすることを検出した。名前だけで旧API撤去済みと判断せず、この二利用側を現行Portへ接続してから撤去する。物理移管・5D〜Fと全面File責務精査前停止は維持する。

## 段階5Cの最後の利用側接続と旧Writer撤去 — 2026-10-08

再計画・人間判断の九契約と、実行・取消・相関検査の48契約を現行Snapshotへ接続した。試験RootはRepository-local `.crdd/tests`に作り、自己所有Fixtureを終了時に回収する。実行後の一時読取り不明は現行ReaderのFile open境界へ注入し、停止結果と物理Lease不存在、Queue所有解除、再入場でのOwner観測非発行を確認した。旧Directoryへの異物追加は現行保存に存在しないため再導入していない。初回の注入位置不一致と、旧方式の「所有が残る」という誤期待を記録し、現行の保全・清掃条件を弱めていない。

九契約は43,865.658ms、48契約は185,023.3581msで成功した。両利用側の接続後、旧State／Queue／Lease Writer・旧Factoryと専用Marker／世代File補助を撤去した。初回の型確認で、現行Queueも利用する遷移定義の巻込みを検出し、同じ定義を共通位置へ保持した。未使用補助と暗黙型を是正した後、撤去後の現行保存・排他・回復・容量28契約は85,925.9922msで成功した。保存戦略の公開説明も単一現在Snapshotへ合わせ、その説明と上位未完成表示の一契約は250.3934msで成功した。

最新の整形・型・Lint・能力Graph・設計台帳は成功、既存Lint情報54件のみでWarning・Failは0。これらは局所接続確認であり、全体回帰・固定Source独立レビュー・署名・実Provider E2Eではない。旧形式移行はフロントAIが扱い、旧Writerの恒久互換を残さない。保存基盤の物理移管、5Cの残る本番接続と5D〜Fを継続する。全移管・接続確認後、全面File責務精査前に人間へ報告して停止する。

## 段階5Cの現在状態・履歴保存の物理移管 — 2026-10-08

現在状態と履歴保存の実装をCoordinatorからProject Runtime（改名後のOrchestrator）へ移した。新配置は`src/storage/current-state-store.ts`と`history-store.ts`で、上位利用側は`storage/index.ts`を通す。保存用Host排他だけをCoordinatorの`host-runtime/index.ts`から利用し、保存責務をCoordinatorへ戻さない。旧Source二Fileは撤去し、Stable Symbol、設計台帳、直接利用側と閉包試験を新配置へ接続した。親Directory、データRootと設定Fileの改名、残る本番組立ては未完了であり、物理配置の移管だけを段階5C完成としない。

移管後の現行保存29契約は89,860.5817msで成功した（runner表示30件には対象試験を持たない一Fileの終了を含む）。Git利用側閉包十契約は814.1995ms、Domain利用側閉包四契約は期待集合の並び順是正後757.5383msで成功した。Queue優先順位四試験も成功した。実環境試験の登録集合では、既存の六File・36件という期待値と現在の八File・39件の不一致を検出し、実際の登録集合へ追従した二契約が188.0509msで成功した。この集合確認を39件の実環境試験実行と扱わない。

履歴保存はWindows実Filesystemで全十契約を実行し、9,706.7737msで成功した。保持期間設定、二段確定、期間境界、重複・内容衝突、pending再入場・不整合保全、破損・時計逆行、Root固定、fsync／rename失敗、alias・観測不能拒否を確認し、自己所有Fixtureを回収した。Docker、外部Provider、署名は使用していない。最新のProject RuntimeとCoordinatorの整形・型・Lint・設計台帳検査は成功し、既存Lint情報54件のみでWarning・Failは0。初回の閉包期待値・登録集合の失敗を消さず、局所確認を全体回帰・固定Source独立レビュー・E2Eへ昇格しない。5Cの残る接続と5D〜Fを継続し、全移管後の全面File責務精査前停止を維持する。

## 段階5Cの上位回復終了確定の物理移管 — 2026-10-08

上位Taskの回復終了確定をCoordinatorの`project-runtime/docker-project-recovery-settlement.ts`からProject Runtime（改名後のOrchestrator）の`src/task/docker-recovery-settlement.ts`へ移した。exact保存世代・Project・Milestone・Task・Attempt・Operation・回復参照と耐久応答の照合は上位が所有し、Docker実資源の回復確認・終了整理は既存Coordinator内部処理に残す。処理本文と既存Stable Symbol IDを保持し、本番組立て、三試験File、設計と配置台帳を追従した。下位回復操作をPackage公開入口へ追加していない。

初回七契約は六成功・一失敗、37,365.4264msだった。失敗は前段の保存移管で追加したHost排他公開入口がPackage期待一覧へ未反映だったためであり、回復の実行条件を緩めず現行設計へ追従した。内部回復利用側の走査へ新上位配置を含め、Host公開入口に回復応答確認操作が漏出しない反証も加えた。再実行は七契約すべて成功、41,169.871ms、失敗・取消・未実行・TODOは0。exact回復再入場、混在義務の処置、上位応答の不正形状拒否と公開Authority非露出を確認した。Project RuntimeとCoordinatorの整形・型・Lint・設計台帳は成功し、既存Lint情報54件のみでWarning・Failは0。旧Source参照と差分空白破損は0。Docker再起動・実Provider・署名は行っておらず、全体回帰や固定Source独立レビューの完了とは扱わない。残るHost組立て、親Directory・保存Root切替、5D〜Fを継続し、全面File責務精査前停止を維持する。

## 段階5CのWindows保証選択とHost観測の分離 — 2026-10-08

旧Windows Platform Adapterを、Orchestratorの`src/task/windows-platform-adapter.ts`とCoordinatorの`src/host-runtime/windows-platform-observation.ts`へ分離した。上位は保証集合・完成／部分対応判定・Repository Root解決と固定接続を所有し、下位はProcess生存観測・Platform識別・子Process環境導出を所有する。既存関数の判定本文、Provider Home・Docker回復・Native観測の下位Ownerと部分対応表示を保持し、新しいFallback・Authority・外部Effectを追加していない。本番組立て、Workbench候補利用側、Symbol、設計対応とGit利用側集合を追従した。

初回は単体九契約と走査構文一契約が成功し、独立性三契約が失敗した（合計13件、2,727.4214ms）。原因は移管済み保存・具象Adapterを含むSubsystem全体を純粋Coreとして走査していたことである。正本の責務境界から純粋な業務契約五領域を母集団にし、Coreの推移依存閉包とOS依存禁止を維持した。保存・Task・判断Adapterと公開barrelは別分類とし、未知の領域を無言で除外しない反証を追加した。この是正はCoreへOS依存を許す変更ではない。

再実行の全13契約は2,735.6059msで成功、失敗・取消・未実行・TODOは0。Git利用側閉包十契約は704.8148msで成功した。型・整形・Lint・設計台帳も成功し、既存Lint情報54件のみでWarning・Failは0。旧Sourceへの実装参照と差分空白破損は0。全Source独立レビュー・実Provider E2Eではなく、残る本番組立てと5D〜F、全移管後の全面File責務精査前停止を維持する。

## 段階5Cの本番組立て・受付・判断・候補統合の物理移管 — 2026-10-08

残るCoordinatorの上位業務五FileをProject Runtime（改名後のOrchestrator）へ移した。本番組立ては`task/composition-root.ts`、公開操作は`task/public-adapter.ts`、Objective受付は`task/objective-intake.ts`、候補統合は`task/candidate-integration-adapter.ts`、保護判断保存は`storage/protected-decision-store.ts`が所有する。既存判定本文、保護方式、CAS、候補の固定Snapshot、exact回復・取消条件を保持し、全relative importの元解決先と直接利用側を追従した。旧業務Sourceは不存在で、CoordinatorのRoot再公開と利用者入口の切替は残るため依存方向の完成を主張しない。

移管後の候補統合・本番組立て・Objective受付・保護判断保存27契約は110,808.6882msで全件成功した。Git閉包と保存利用側閉包では初回に移管後の期待一覧の順序不整合を検出し、対象集合を減らさず順序を追従した。最終Git十契約は746.3674ms、保存四契約は708.946msで成功した。署名閉包の組立てSource位置と実行能力の搬送反証を新Ownerへ追従し、最新二契約は1,952.1025msで成功した。前段で採用済みのHost排他公開入口について、Package本文検査が旧CLI-only期待のままだった箇所も是正し、現在のCLI／Host二入口以外は受理しない。固定Fixture七箇所を同じ期待へ追従した。実署名・正式配布・全Package回帰の成立は別に残す。

Project RuntimeとCoordinatorの型・整形・Lint・設計台帳は成功し、既存Lint情報54件のみでWarning・Failは0。差分空白破損0。実ProviderやDocker再起動は行わず、局所成功を全Source独立レビュー・全体回帰・E2Eへ昇格しない。公開利用側、本番共通実行・通知、保存Root・親Directory、回復縮小と5D〜Fを継続し、全面File責務精査前停止を維持する。

## 段階5Cの公開業務Owner接続 — 2026-10-08

Coordinator Rootから上位業務七操作の再exportを撤去し、共通単一Task操作・結果型とNode実行条件だけを公開した。Orchestratorの`task/public-adapter.ts`をPackageの`./application`へ登録し、MCP配布入口とWorkbench状態観測を直接接続した。既存Principal観測、要求・結果Schema、判断、Authority検証、取消・回収の処理本文は変更していない。Core用Rootへ具象業務面を再exportせず循環を避ける。新しい公開Symbolと対応試験を既存`PRL-IT-012`へ接続した。

公開値の完全集合と直接Consumerを照合する二契約は403.6089ms、Workbenchの実ローカルHTTP状態表示一契約は1,403.3077msで成功した。Orchestratorの整形・型・Lint、Coordinatorの静的全入口検査、Workbench型とMCP配布入口の型確認も成功した。Coordinatorの既存Lint情報54件を維持し、Warning・Failは0。実ProviderやDocker処置は発行していない。

公開入口Allowlistの初回確認では、先行移管したDomain安定読取りModuleの期待値漏れを検出した。移管済みModuleを固定集合へ追加し、上位公開・保存・Task・Host入口の集合も追従した。FixtureはRepository内の自己生成領域だけを使い、終了後に自分の実体を回収する。修正後の一契約は275.9628msで成功した。この一検査を全Source命名検査や全体回帰へ昇格しない。

CLI内部の上位呼出し、全公開利用側・親Directory・保存Root切替、共通実行・通知と5D〜Fは残る。全体回帰・固定Source独立レビュー・Reality Audit・署名E2Eは未完了であり、全親フォルダ移管後の全面File責務精査前に停止する人間指定を維持する。

## 段階5Cの業務CLI配送移管 — 2026-10-08

Coordinator内部CLIのProject初期化・Objective受付をOrchestratorの`src/cli/project-command.ts`へ移した。配布入口は直接Project操作と`interactive`／`automation`の配送を保持し、既存の端末・機械出力条件を照合する。単体Coordinatorの業務経路と上位Source importは撤去した。共通入力Readerの128KiB・厳格UTF-8・一意JSONと入力エラーを`cli/request-input.ts`へ、既存応答表示を`cli/command-report.ts`へ抽出した。処理本文・取消解除・入力理由を保持し、常駐Process・追加Launcher・互換Aliasは作っていない。

公開配送と入力拒否三契約は2,193.4077ms、新品初期化・同世代再初期化を含む選択五契約は2,908.3093msで成功。配布能力集合と静的Runtime閉包二契約は24,130.7955ms、業務Core独立性四契約は164.6523msで成功した。Orchestrator整形・型・Lint、配布入口型とCoordinator静的検査も成功。Coordinator整形指摘一件は是正し、既存Lint情報54件、Warning・Failは0。

Git利用側閉包の初回は新CLIの一覧漏れで一失敗し、接続後十契約は727.8692msで成功。全CLI初回は旧Indexから削除済みSourceを複製する未署名Fixtureで一失敗した。現在の追跡・未追跡Source集合と宣言済み削除へ合わせ、旧AI親名も更新。自己生成負例をRepository内testsへ置き、終了後に回収する。修正後十四契約は4,541.2781msで全件成功した。選択名不一致により空Fileだけが選択された一実行は検証成立に算入しない。

実Provider、署名、全体回帰、固定Source独立レビューやCHG完成は未成立。共通実行・通知、保存Root・親Directory改名と5D〜Fは残る。全親移管後・全面File責務精査前の指定停止を維持する。

### 段階5Cのツール設定名切替 — 2026-10-08

Orchestratorの設定を`.crdd/config/orchestrator.json`へ改名し、設定例・Schema・Git allowlist・設定Reader・履歴利用側・現行設計・配布AI入口を追従させた。設定値は`schemaRevision: 1`、`historyRetentionDays: 30`を保持する。公開Readerは`readOrchestratorConfig`とし、旧名aliasや旧設定Readerは残さない。Execution Intelligenceの設定と判定は独立のまま維持する。

- 着手前照合: 採用済みOrchestratorへの改名だけを適用し、期間、Schema値、削除Authority、未解決義務、Root検証、読取り失敗の扱いは変更しない。旧環境の移行はフロントAIの手順とし、本番Readerで変換しない。
- 検証: 設定Readerの実Filesystem一契約が成功（391ms）。旧`project-runtime.json`だけが残っても読まず30日既定値を返し、新設定があれば新値を採用する。旧Fileを自動変更・削除しないことも確認した。
- 履歴接続: Windowsの保持期間設定・期限根拠一契約が成功（762ms）。Domain Model、Orchestrator、Execution Intelligenceの型検査が成功し、差分空白検査も成功した。
- 残件: `.crdd/project-runtime`の物理データRoot、Source親Directory、残る共通実行・通知と5D〜Fは未完了。今回の二契約を全体回帰、独立レビュー、署名またはE2Eの成立に読み替えない。全移管後、親フォルダ内のFile責務精査前に停止する。

### 段階5Cの保存Root参照切替 — 2026-10-08

Domain Modelが宣言する保存用途と公開Path属性を`orchestrator`へ切り替え、現在状態・履歴・候補統合の保存利用側を`.crdd/orchestrator`へ接続した。一時Lease領域は`tmp/orchestrator-leases`へ追従し、配布ひな型のTop Directoryも変更した。既存のSchema、Meaning、Root Hash算出、仕事Identityと業務APIは改名だけで変更しない。旧Rootを読むFallbackは設けない。

- 確認: Pathの実Filesystem八契約（328ms）、履歴保存のWindows十契約（9,602ms）、名前付き保存領域の不存在・観測不能・途中置換と公開初期化の四契約（2,397ms）が成功した。Domain Model、Orchestrator、Coordinatorの型接続が成功した。Domain整形のquoted key一箇所を検出・是正した。
- 実物: 旧Repository Rootには空のSnapshot v2とLockの二Fileが残る。SnapshotのProject／Queue／Lease／結果／判断／回復／未搬送履歴集合は空である。今回は移動・削除・新受付世代の初期化を行っておらず、実Repository切替完了とはしない。
- 未完了: 旧実物のフロントAI処置、親Source Directory、共通実行・通知、5D〜F、全回帰と独立確認は残る。局所成功を全移管完了へ昇格せず、全移管後のFile責務精査前に停止する。

### 段階5Cの現行Snapshot限定 — 2026-10-08

保存Root切替後のReader／WriterからSnapshot v1の受理契約を撤去し、現在の必須全区画を持つv2だけへ固定した。Schemaと仕事IDを再採番せず、旧形式変換を本番へ残さない。移行・旧実物の保全と清掃はフロントAIが担当する。過去Attemptを新仕事へ自動継承しない。

- 現行読取り・pendingからの一重確定・部分形式／旧形式拒否の三契約が成功（2,970ms）。OrchestratorとCoordinatorの型検査が成功した。
- 追加反証として、Hashが正しく旧必須区画が揃うv1 Envelopeを実Fileへ配置した。読取りと再初期化がblocked、元bytes不変となる一契約が成功（1,319ms）。不正Hashだけによる拒否を旧Schema拒否の根拠にしていない。
- 最新Sourceの整形と差分検査が成功した。冗長なv2条件の一般整理、全保存回帰、固定Source独立レビュー、実Repository切替は今回完了としない。親Directoryと5D〜Fの移管を続け、File責務精査前の停止を維持する。

### 段階5CのOrchestrator親Directory改名 — 2026-10-08

`40_Develop/project-runtime`を`40_Develop/orchestrator`へ物理改名し、Package名を`@qual-lab/crdd-orchestrator`へ変更した。直接参照49File、分割されたPath指定、配布Fixture、Symbolと試験台帳の物理Pathを追従させた。業務API、Canonical ID、Semantic Key、試験Owner・semanticTags・producerOwner等の安定分類は改名だけでは変更しない。Runnerは既存の分類を新しい実Directoryへ解決し、旧実DirectoryへのFallbackを持たない。

- 検証: Orchestrator、Coordinator、MCP、Workbench、Verification Runnerの型接続が成功。OrchestratorとRunnerの整形・型・Lintが成功した。
- 公開入口三契約（2,194ms）、Domain利用側四契約（733ms）、Git利用側十契約（721ms）が成功した。公開入口試験の初回旧Path期待値一件は是正済み。
- 試験台帳の初回二失敗は分類と物理Pathの混同、その後の二失敗は新しい公開入口試験の登録漏れによるものだった。物理Path解決と正式登録を是正し、台帳全二十契約が成功した（2,624ms）。Registry分類名までの一括変更は安全確認で拒否されたため採用せず、すでに編集したRunner分類も元の安定値へ戻した。
- 残件: 旧実Runtime Rootの処置、残る共通実行・通知、5D〜Fと全体固定確認は未完了。現時点はFile責務精査の開始点ではない。

### 段階5CのCLI拒否経路の基準版照合 — 2026-10-08

基準版HEADのCLIと移管後の配布入口を照合し、未対応Nodeの拒否表示に意味差を検出した。直接Project起動は従来どおりJSON指定時のみ標準出力へJSONを返し、それ以外は標準エラーへ必要版を表示して終了2とする。interactive／automation配送は既存の起動判定へ委ね、未対応Nodeでは標準エラーと終了64を保持する。外部Effect、入力上限、AuthorityまたはProvider設定を変更していない。

- 公開Owner・直接Consumer・入力拒否の三契約が成功（2,872.5113ms）。最後の契約で直接起動のJSON／非JSONとautomation配送の未対応Node三例を追加確認した。子Process内の版観測だけを模擬し、実Node更新やProvider実行はしていない。
- Orchestratorおよび配布入口の型検査は成功した。今回の結果を全体回帰、独立レビュー、署名やE2Eへ昇格しない。
- 通知調査では既存observeStartedが上位受付状態の耐久記録であり、Provider Process開始の通知ではないことを確認した。共通Taskからの開始・完了通知接続は引き続き未完了として扱い、既存受付確認を実Process開始の根拠へ読み替えない。
- 現在投影の移管前表示を追従した。5C〜Fの残作業を続け、全面File責務精査の直前に停止する。

### 段階5Cの通知接続に関する着手前整合確認 — 2026-10-08

読み取り専用確認者へCoordinator／Orchestratorの通知・取消・保存境界を委譲し、結果を一括統合した。結果は保証範囲と相関を限定した上で着手可能であり、完成後の独立レビューやSourceのPassではない。

- 現行の上位observeStartedは制御Handle返却後にrunningを保存し、設計の実開始通知条件へ未接続である。
- 既存の真の観測点はDocker Process Controllerのhandle.started成功後である。ただし観測対象はNode spawn・PID・stdioを持つProvider接続用Docker CLIであり、コンテナ内AIの開始や要求受理ではない。
- 上位Operationと下位のOP識別子は別である。登録閉包の相関を維持し、下位識別子を上位へ直接等値比較しない。
- 最小接続はTask単位ハンドラーの登録と既存Controllerへの搬送。共有Reporter、下位から上位へのimport、Event Bus、通知DBや新Recovery機構を追加しない。
- 初回Executor通知、Reviewer非二重遷移、通知false／例外、待機中取消、遅延・重複・異Identity・終端後、通知欠落Fixtureとcleanup不明を局所反証する。元の完了Promiseと結果検査を維持し、通知だけでQueue・Leaseを解放しない。
- Owner設計へ保証範囲と処置を具体化し、移管前の配置説明八段落も現行実物へ追従した。Source接続・試験は未完了。5C〜Fを継続し、全面File責務精査前の人間指定停止を維持する。

### 段階5CのController呼出し単位開始通知 — 2026-10-08

Docker Process Controllerの既存開始APIへ呼出し単位の登録ハンドラーを追加した。既存のHost Process開始観測成功と診断Reporterの処置後に固定通知を搬送し、共有productionStateのReporterを差し替えない。通知false・例外は既存の開始観測失敗、Process終了と資源回収へ接続する。元の完了待機を維持し、終端時に登録参照を解放する。新しいRecovery、Event Bus、通知DBや外部Effectを追加していない。

- 最初の局所二契約は397.9979msで成功。診断後の搬送、呼出し分離、準備拒否時の通知0、false・例外とcleanupを確認した。
- 通知待機中の同じ制御参照への取消を追加し、Controller全99試験が成功（1,836.4275ms）。未実行・取消・TODOは0。CoordinatorのSource／Test型検査、整形、差分空白検査も成功した。
- 下位の観測契約だけの接続であり、Task API・Orchestrator状態への搬送と本番全経路は未完了。Mockの99成功を実Provider、実Docker、署名E2Eまたは全体品質のPassへ昇格しない。通知失敗を資源不存在やEffect 0の根拠にしない。
- 全移管後のFile責務精査前停止を維持する。現時点はその停止地点ではない。

### 段階5CのTask開始通知引数の搬送 — 2026-10-08

Coordinator Taskの本番・開発・試験用入口へ呼出し単位の通知登録引数を接続し、Executor／Reviewerの既存Controller開始APIへ渡す。登録なしの単体呼出しを維持し、不正な登録値は実行Capability消費・開発枠予約前に拒否する。Task終端時にはControlの登録参照を解放する。Task受付をProcess開始として通知しない。

- 追加の局所二契約が成功（392.4027ms）。同一関数の二段階搬送、未登録時のundefined、準備失敗時の開始境界未到達、受付時通知0、不正登録のEffect前拒否を確認した。
- Coordinator Source／Testの型検査と整形、差分空白検査は成功した。実Docker、Provider要求、署名または全体回帰は実施していない。
- 下位Controllerの全99契約も再確認して成功（1,859.3028ms）。Windowsの実子Process終了二例を含むが、Dockerは模擬であり実Provider E2Eではない。
- これは引数搬送の確認であり、Orchestratorのrunning保存、通知の重複・遅延・終端後処置、待機中取消と全本番組立ての完了ではない。既存の即時observeStartedは引き続き是正対象であり、部分接続を完成と表示しない。
- 5C〜Fを継続し、全移管後のFile責務精査前停止を維持する。

### 段階5Cの開始通知と上位保存・取消の接続 — 2026-10-08

共通Taskは開始APIのHandle返却時に上位observeStartedを呼ばず、登録閉包を既存Controllerへ渡す。初回ExecutorのHost Process開始通知で上位保存を一回だけ待ち、重複・Reviewer・是正Executorは同じ保存結果へ結合する。終端後の通知は拒否する。通知待機を取消監視の登録より先に置かず、元のTask完了を待つ。通知必須の呼出しで通知なしの成功が返る場合は候補を公開せずblockedとするが、確認済みcleanupを不明へ変更しない。下位の一次失敗理由と回復参照は維持する。

- 単一Task Adapter全29試験が成功（1,307.4485ms）。追加三契約で受付時の保存0、初回保存1、重複・Reviewer・是正・終端後、通知欠落、保存false／例外、待機中取消と監視解除を確認した。
- Coordinator Source／TestとOrchestratorの型検査、整形、差分空白検査が成功した。
- 初回の上位実行集合では、開始通知を出さず成功だけ返す旧fixture一件を検出した。また依存・競合試験が長時間進まなかったため、親PIDとexact試験Pathを確認した当該子Processだけを停止した。この集合を完了や全体Passへ換算しない。Docker・Provider・既存Runtimeを操作していない。
- 通知欠落fixtureを明示通知へ追従し、該当Single Task接続一契約が成功（4,580.4812ms）。長時間停止していた依存・競合試験も単独再確認では成功（7,475.9972ms）。初回停滞の原因は確定しておらず、集合全体の再確認を残す。
- 模擬本番組立ても明示通知へ追従し、候補統合境界を使う代表一契約が成功（34,965.7631ms）。実Provider開始・署名E2Eの証明ではない。
- 共通実行の全経路、保存・回復縮小、旧実Rootの処置と5D〜Fは引き続き未完了。全移管後のFile責務精査前に停止する。

### 段階5Cの現在状態Producer切替に関する着手前整合確認 — 2026-10-08

読み取り専用確認を現在Sourceへ照合し、新Snapshotは初期化準備とWriterのみで本番未接続であることを確認した。beginだけを二重保存へ置き換える案は採用しない。同じOperationの開始から結果受理までを一つの保存所有線へ切り替え、未接続中は旧Owner撤去・5C完了を表示しない。新Framework、旧形式Reader、追加Docker再起動またはProvider要求は追加しない。

| 接続順 | 新Snapshotで保持する内容 | 完了前に必要な接続 |
|---|---|---|
| 現在状態の取得 | Repository結合、版・本文Hash、保存途中の区別 | 現行Rootを再観測するReader。空領域・読取り不能を初回扱いしない |
| begin | exact Identity、nonce、同じ回復参照 | Repository操作Ownerから保存先を借用し、保存確認前にHost・外部要求を進めない |
| 要求・観測 | 五purposeの意図、発行、receipt、一次失敗 | 要求前保存、実発行と結果観測を分け、Provider開始から外部送信を推定しない |
| 終端 | purpose別の不存在根拠、Host清掃、Lease解放 | 集約booleanではなく同じ資源の観測を搬送し、旧active File Gateを同じ操作の終端根拠へ置換 |
| 搬送・受理 | 同じresultId、Consumer、耐久受理Hash | 応答喪失時は結果だけ再搬送し、Providerを再実行しない |
| 終了整理 | 終了要約、回復・搬送義務の終了 | 現行遷移検査の無条件削除拒否を弱めず、終端証拠と有限履歴へ接続 |

CLI回復・Inventory、Orchestrator本番構成と上位耐久受理、Coordinator単体Task、Workbench助言、署名閉包・Symbol・Catalogを利用側集合とする。過去の複数回復試験は当時の限定根拠であり、新保存方式の成功根拠へ流用しない。旧実Runtime Rootの移行は停止・未解決参照・保全対象を確認するフロントAIの処置とし、本番へ恒久互換を追加しない。これは着手前確認であり独立レビューPassではない。現在、この接続方針に追加の人間判断は必要ない。

### 段階5Cの現在Snapshot読取りと通知集合再確認 — 2026-10-08

現在の操作Ownerから検証済みRepositoryを借用する`readRuntimeOwnedCoordinatorStateSnapshot`を既存保存Runtimeへ追加した。Writerと同じ短期排他下で固定Root・通常File・hardlink数・bounded本文・版／Hash・前後実体を確認し、解放確認後だけ値を返す。保存途中のpending／lock、未知の内容、明示不存在、Owner失効や観測不能では値を返さず、作成・修復・旧形式探索を発行しない。

- Source／Testの型検査、変更二Fileの整形・Warning拒否Lintが成功した。最初はRootに検査実行物がなく起動できなかったため、既存Coordinator packageの固定入口を確認して実行した。依存の追加・更新は行っていない。
- 実Windows Filesystem保存一契約へ、保存済み版・Hashの読取り、不正Owner、不在、pending保全、hardlink、Owner失効を追加し成功した（4,731.302ms、集合5,017.646ms）。自己生成Repository内だけを使用し、Docker・Providerを操作していない。
- 前ターンから実行中だった上位実行集合を同じsessionで待機し、全48件の成功と終了を確認した（267,518.5422ms）。依存・競合ケースも集合内で成功した。先行する中断集合の原因確定や全体回帰Passを意味しない。
- Readerは内部保存部品であり、本番Producer、fresh Process回復入口、終端証明、有限履歴、結果受理への切替は未接続である。旧Writerを撤去せず、部分接続を5C完了へ昇格しない。Symbol／能力Graphの最終接続は本番切替と合わせて確認する。
- 全移管後のFile名・責務・配置精査前停止を維持する。

### 段階5Cの初回Operation候補構築 — 2026-10-08

固定Identity本文から既存codec・遷移検査を使い、初回Operationを次Snapshotへ追加する純粋部品を接続した。回復IDは同じ基本情報本文Hashへ結合し、元版Hash、他操作、未解決回復と未受理搬送を保持する。全purposeの未要求・未観測を明示し、候補構築から保存・Host遷移・Docker要求を発行しない。

- 初回試験でHost遷移意図を初回操作へ含める不整合を検出し、既存の初回遷移制約を維持したまま別checkpointへ分けて是正した。追加した「辞書順Identity自体を不正とする」負例も誤りだった。確定本文を一度選ぶ初回構築と、確定後の本文変更拒否を混同せず、末尾LF欠落・不正nonceへ負例を修正した。
- 既存構造試験へ初回・既存空Snapshot・二操作の順序と元操作保全、重複、別Repository、不正元本文を追加し全三契約が成功した（217.1186ms）。Source／Test型検査、変更二Fileの整形・Lintも成功した。
- 現行本番beginは旧Journal・active pointer・Host開始接続をまだ使用する。新部品を二重保存として差し込まず、要求・回収・搬送を同じ所有線へ切り替える次の作業へ接続する。本番Producer切替・5C完了・独立レビューPassは未達である。全移管後のFile精査前停止は維持する。

### 段階5CのProvider共通本番依存と拒否結果 — 2026-10-08

両Providerに残っていた本番Mount・Packet・選定・Authority・時計・乱数の依存組立てを`docker-runtime/provider-docker-composition.ts`へ集約した。組立てから取得・消費・発行を実行せず、Providerごとの二WeakMapとCodex専用Seccomp接続を保持する。同形のEffect前拒否結果は既存共通準備Fileへ単一化し、公開field・理由値・null／falseを変更していない。新FileのSymbolと既存試験Relationを接続した。

- 着手前に詳細設計、二Providerの全本文、共通準備・Lifecycle型と本番依存を照合した。変更分類は公開契約を維持する実装移管であり、Authority、外部要求、保存方式や新しい非同期境界を追加していない。固定Source独立レビューと必要な文書・不足／影響確認は段階6へ維持し、準拠基準を変えないため準拠監査を追加しない。追加の人間判断は不要である。
- Source／Test型検査、変更範囲の整形・Warning拒否Lint、差分の空白確認が成功した。両Providerの既存契約と共通組立ての反証は全34件成功した（562.1256ms）。本番依存の固定field・関数参照・凍結、Store非共有と拒否結果の全Effect falseを確認した。Docker・外部Provider・署名は実行していない。
- 責務分離後Runtime componentの静的依存閉包一契約が成功した（29,355.9684ms、集合29,651.9279ms）。これは同契約の限定結果であり、全133配布契約の最新再実行、署名閉包の全体完成または実E2Eを意味しない。
- 二Providerの固定呼出し側・具体型と成功結果の統合、Snapshot本番保存・回収・搬送、5D〜Fは未完了である。新共通組立てだけを5C完了へ昇格しない。移管完了後のFile責務精査前停止を維持する。

### 段階5Cの具体計画型と準備状態Factory移管 — 2026-10-08

二Providerに重複していた具体計画・消費済み選定・Task・準備状態を既存`docker-runtime/types.ts`へ移し、状態生成を共通本番組立てFileへ単一化した。Provider literal、購読種別、Claudeだけの作業量とCodexだけのSeccomp接続を保持する。固定呼出し側は具体Provider型への結合だけを残し、同じ構造を再定義しない。状態生成から資源取得・Packet消費・Authority発行を実行しない。

- 同じ依存から生成した二つのCodex OwnerとClaude Ownerで、二Storeの非共有、管理参照の隔離と状態の凍結を既存契約へ追加した。最新両Provider集合は全34件成功した（478.0116ms）。Source／Test型検査、変更五Fileの整形・Warning拒否Lint、差分空白確認も成功した。
- SeccompをCodex限定の条件型へ戻す際、Factoryの明示戻り型と条件型・optional fieldの組合せで型検査が失敗した。入力の固定Provider型と具体Store型を維持し、実際の構築値から戻り型を推論する形へ是正した。契約を広げるcastやClaudeへのSeccomp適用は追加していない。
- この移管はProvider状態の所有線を単一化する局所変更である。計画と成功結果の固定呼出し側集約、本番Snapshot保存・回収・搬送、5D〜F、全体回帰・固定Source独立レビュー・署名E2Eは残る。直前の配布閉包限定結果を最新全体検証へ流用しない。全移管後のFile責務精査前停止を維持する。

### 段階5Cの固定Provider準備組立て接続 — 2026-10-08

共通準備Runtimeへ二Providerの本番・局所試験入口を接続した。準備順序、独立Store、取消・一回消費、具体計画と公開結果のProvider差を維持する。新OwnerをSymbolへ登録し、既存両Provider試験から接続した。Taskの回復相関の搬送assertionも追加した。

- 初回Source／Test型検査は条件型から共通依存を抽出するoptional fieldの不整合と旧型参照で失敗した。共通状態をProvider固有追加依存から分け、準備の型引数を明示して是正した。型設定や拒否条件は弱めていない。
- 是正後のSource／Test型検査と変更範囲のWarning拒否Lintが成功した。両Provider準備34契約は全成功（473.0645ms）。Docker Effect、選定Grant、Task Runtimeの利用側188契約も全成功（4955.0858ms）。実Docker・外部Provider・署名E2Eは実行していない。
- Snapshot本番保存・回収・搬送、5D〜F、全体回帰と固定Source独立レビューは未完了。全移管後、File責務精査前に停止する人間指定を維持する。

### 段階5Cの共通本番OwnerとTask利用側接続 — 2026-10-08

二Providerの本番Adapter生成を共通Runtimeへ移し、既存Provider入口とTask本番準備を同じProvider別Ownerへ接続した。Task利用側の二分岐・重複引数搬送を撤去した。取得ごとのStore再生成、他ProviderとのStore共有、局所試験Factoryと本番Storeの共有は追加していない。固定APIの意味と既存公開関数は保持する。

- 本番Ownerの同一参照、Provider間の別参照と凍結を既存契約へ追加した。Source／Test型検査、変更五FileのWarning拒否Lintは成功した。準備・Taskの194契約は全成功（1543.8862ms）。Process Controller・Docker Effectの116契約も全成功（5308.0413ms）。実Docker、外部Provider依頼と署名は行っていない。
- 準備Ownerの接続をSnapshot本番切替へ拡張していない。保存・回復縮小、5D〜F、全体回帰・Source独立レビュー・実E2Eは残る。全移管後のFile責務精査前停止は未到達であり維持する。

### 段階5Cの一資源checkpointと発行後不明の保持 — 2026-10-08

Snapshotの開始本文に加え、同じ回復参照の一資源だけを次版へ搬送する純粋な更新候補生成を既存モデルへ追加した。他資源、Host、一次失敗、結果を保持し、元版Hashと改訂を検査する。旧遷移集合に欠けていた要求発行後の応答不明を処置し、`issued → unknown`を許可した。過去unknownを未発行へ戻す処置や要求再発行は追加していない。

- 開始→意図保存→発行→応答不明→Identity確定を確認し、意図保存前の発行、発行前の作成結果、unknownの未発行化、既知Docker ID置換、別参照・Repository・purpose、追加field、getter入力を拒否した。既存モデル三契約が成功した（216.9309ms）。Source／Test型検査も成功した。Lint一件を表現上同値のoptional chainへ是正し、Warning拒否Lintは成功した。
- モデルと既存UTのSymbol Relationを接続した。これは値変換の限定検証である。物理Writer・実Producerの全checkpoint、Host終端、結果搬送・履歴確定・終了除去とfresh Process再入場はまだ未完了。旧記録との二重書込みを追加せず、開始だけの切替を本番完成としない。5D〜Fと移管後の精査前停止は維持する。

### 段階5Cの資源checkpoint実保存接続 — 2026-10-08

資源更新候補を既存Reader／Writerへ接続した。短期読取り後に排他を解放し、exact回復参照と現在操作IDを照合して次版を構築する。保存側で元版とRoot・Ownerを再検証し、競合時は古い候補の再試行を行わない。独立したStore、Lock方式、旧記録への二重書込みを追加していない。

- 自己生成RepositoryのWindows実Filesystemで、操作開始保存と意図保存→発行→応答不明の三checkpointを確認した。保存確定・Lock解放・Filesystem Effectの各結果を個別確認し、古い版・別参照・不正Owner・unknownの未発行化を拒否し、本文保全とstate.jsonだけの終了配置を確認した。既存IT一契約は成功（10567.0394ms、集合10850.8943ms）。Source／Test型検査、変更二Fileの整形とWarning拒否Lintも成功した。
- Host／DockerのIdentityと観測はこの試験では自己生成のモデル値であり、実資源の終端証明ではない。保存RuntimeとITのSymbol Relationを接続した。実Producerの全checkpoint、Host終端、結果搬送・履歴確定・終了除去とfresh Process再入場はまだ未完了。5D〜Fと移管後の精査前停止を維持する。

### 段階5Cの実回収側Receipt欠測補完撤去 — 2026-10-08

Producer接続の照合で、旧Effect回収が欠けたpurposeを`submitted: false / dockerId: null`へ補完していたことを特定した。五purposeの完全Receiptを確認するまで資源処置を行わない形へ切り替え、五つのfallbackを撤去した。完全な未要求評価は維持し、欠測から不存在を主張しない。変更した回収関数Headerも実Effectと拒否条件へ合わせた。

- 全五purposeを一つずつ欠測させ、回収未確認、Docker要求0、config未除去を確認した。Effect全18契約が成功（5612.5572ms）。Controller全99契約も成功（1718.6659ms）。Source／Test型検査、変更二Fileの整形・Warning拒否Lintは成功した。実Dockerと外部Providerは操作していない。
- 現実資源の各不存在は旧回収側で確認しているが、上位へは依然としてcontainer／networkの集約boolを返している。旧集約不存在記録、Host進行、Lease終了、結果受理と終了要約を同じSnapshotへ接続する本番切替は未完了。欠測拒否を5C全体完了へ昇格しない。全移管後の精査前停止を維持する。

### 段階5Cの資源別回収結果の搬送 — 2026-10-08

- 実Effectのexact Receipt経路は五資源の`not_requested / absent / unknown`を区別して返す。Receipt欠測と非exact経路は`null`であり、欠測を未要求へ補完しない。
- Controllerは結果を変更せず回収記録の呼出し先へ渡す。既存の保存実装はまだ旧集約方式であるため、Snapshotへの本番保存成立とは扱わない。
- 変更後のEffect／Controller全117契約は成功（6,907.6937ms、失敗・skip 0）。完全な五資源結果、欠測、回収不能、同名replacementと搬送値の同一性を確認した。本番・試験型検査、変更五Fileの整形・Lintと差分検査も成功した。
- Docker命令はFixtureで観測した。Controller試験に含むWindows子Process境界は実測だが、Docker実資源の不存在や実Provider E2E成功へ昇格しない。新Snapshot保存・終端接続、5D〜F、全体回帰・独立Sourceレビューは未完了である。

### 段階5Cの全回収観測の単一改訂保存 — 2026-10-08

- 五資源の回収結果を一つの元版・次版へまとめ、既存Snapshot Writerを使う接続を追加した。一資源checkpointと保存Ownerを共用し、新しいLock・DB・旧形式fallbackを追加していない。
- 元操作・計画名・現在ID・固定順序を照合し、未要求を不存在へ変換しない。ID未確定の不存在は通常回収で拒否する。根拠Hashは相関用であり、現在観測の証明と混同しない。
- 最新のモデル三契約とWindows実保存一契約は成功（合計四契約、14,153.8522ms、失敗・skip 0）。欠測・重複・順序違い・別ID／別名／別Root／別参照・accessorを拒否し、unknown保持、単一改訂、Host不変と拒否時の本文不変を確認した。
- 本番／試験型検査、整形、Lint、差分検査も成功した。初回Lint警告三件はTestの非null断言であり、明示assertへ是正した。実Docker・Provider・署名は実行していない。
- 本番Producer、Host・Lease・搬送終端と旧保存撤去は未完了。5C完了や独立レビューPassへ昇格しない。5D〜F完了後のFile責務精査前停止を維持する。

### 段階5CのHost checkpoint保存接続 — 2026-10-08

- Host処置前本文と観測済み次世代の保存接続を追加し、一資源・全回収と同じSnapshot Writerを共用した。処置前記録なしの世代更新、未確定意図消去と巻戻しを拒否する。
- 最新モデル三契約とWindows実保存一契約は全四件成功（17,020.2571ms、失敗・skip 0）。Host更新時の資源不変、順序拒否、保存・読戻しと拒否時のEffect非発行を確認した。本番／試験型検査、整形・Lint・差分検査も成功した。
- Host Tokenと記録は試験モデル値であり、実Host処置やDocker不存在の証明にはしていない。本番ProducerのHost・Lease・搬送終端、旧保存撤去、5D〜Fと固定Source独立レビューは残る。全移管後のFile責務精査前停止は未到達である。

### 段階5Cの実行・一次失敗・終端評価の保存接続 — 2026-10-08

- phase、Lease、実行Effect、一次失敗、最終結果、要約Hashの固定六fieldを、同じ現在状態Writerへ接続した。Identity・資源・Hostや回復／搬送一覧を変更する入力は受理しない。
- 局所モデル三契約は成功（259.1209ms）、Windows実保存一契約も成功（20,089.625ms）。一次失敗の保存・読戻し、資源とHostの不変、失敗上書き・unknownの未発行化・項目欠測・未知fieldの拒否と拒否時の本文不変を確認した。
- 本番／試験型検査、整形・Lintは成功した。観測値は試験モデルであり、実Provider EffectやLease解放の証明ではない。保存接続部だけからSnapshot本番切替・全終端接続・5C完了を主張しない。
- Controller／Host／Lease／搬送Ownerの一体接続、旧保存撤去、5D〜F、全体回帰と固定Source独立レビューは残る。File責務精査前の人間指定停止は未到達である。

### 段階5Cの回収・搬送参照集合の保存接続 — 2026-10-08

- 回収義務と結果受理checkpointを同じ操作Owner・元版へ結合し、既存Snapshot Writerへ接続した。他操作、別結果への差替え、確定受理Hashの巻戻し、欠測と重複を拒否する。終端証明が未接続の間は参照削除を維持して拒否する。
- 最新モデル三契約は成功（293.0038ms）、Windows実保存一契約は成功（23,314.3973ms）。参照追加、同じ結果の受理Hash更新、操作本文の不変、拒否時の保存本文不変を確認した。本番／試験型検査、整形・Lintも成功した。
- 結果受理Hashは試験値であり、実Consumer受理や回収義務解決の証明ではない。実Docker・Provider・署名を実行していない。本番の全更新・fresh再入場・終端除去と旧保存撤去、5D〜F、固定Source独立レビューは残る。

### 段階5Cの本番終端保存接続の照合 — 2026-10-08

通常保存の`currentBinding`は生きているHost管理Capabilityを確認する。一方、本番TaskはHost作業領域を清掃した後にDockerの清掃Receipt・finalizeを行う。この順序を新Writerへそのまま接続すると終了後の保存Ownerが失効するため、開始だけの切替は行わない。

| 接続対象 | 次の処置 | 保持する制約 |
|---|---|---|
| 清掃前のRepository結合 | 既存結合をexact操作・回復参照と保持中Contextへ固定する。 | 通常Ownerの検査を緩めず、新しいProvider／資源要求Authorityを作らない。 |
| Host清掃後の保存 | 同じWriterの内部I/Oを終端限定の借用で共用する。清掃不明も同じ参照へ保存する。 | genuineな清掃結果を操作・Root・nonceへ照合し、別操作の結果を流用しない。 |
| 上位受理・終了整理 | Orchestratorの耐久読戻しと固定historyの保存読戻しを接続する。 | 五資源・Host・回復・全受理・要約が揃う対象だけを除去し、一般の削除拒否は維持する。 |
| fresh再入場 | 明示したVerified Repository Rootと保存済み結合、既存回収Ownerの現在観測を照合する。 | 旧Capabilityや発行revisionを復活させず、intentの存在から清掃成功を推定しない。 |

読み取り専用の着手前確認と上記の最小接続方針を照合した。完成後の独立レビューPassではない。状態モデルと既存Host終端記録の33契約は成功（404.6134ms、失敗・skip 0）したが、実Docker不存在・上位受理・本番終端保存の成立へ拡張しない。今回の検証で実Docker、Provider、署名を実行していない。

次の切替単位は清掃前保存から清掃後Receipt、上位受理、終了整理までの一連のProducerであり、未接続の個別保存入口の追加だけでは完了としない。5D〜Fは未完了であり、全移管後のFile責務精査前停止にはまだ到達していない。

### 段階5CのHost清掃結果と対象操作の結合 — 2026-10-08

既存の真正な清掃結果へ、実際の対象と清掃前の操作ID・Root・nonceを内部保持するよう変更した。既存のstatus検証を維持し、本番Taskは清掃要求に渡した同じ対象を結果分類へ渡す。await前に対象を固定し、別操作の真正結果・偽造結果を清掃確認へ流用しない。新しい公開結果やProvider権限は追加していない。

本番Taskと実子Processの167契約は全成功（2,980.9068ms）。その後、二操作の真正結果を相互に拒否し、清掃後の通常Owner失効・作業領域不存在を確認する反例を追加した。更新した実Process／Filesystemの八契約は全成功（2,945.4629ms、失敗・skip 0）。本番／試験型検査と変更三FileのWarning拒否Lintも成功した。検証範囲を既存ERB-IT-003とSymbol Relationへ接続した。

実Dockerの不存在をこの結果から主張しない。終端限定Writer、上位受理・history読戻し、fresh再入場と旧保存撤去はまだ未完了である。5D〜Fと、全移管後のFile責務精査前停止を維持する。

### 段階5CのHost清掃後と共用Writerの接続 — 2026-10-08

清掃前の既存Repository結合とHost結果照合を内部Contextへ固定し、通常保存と終端限定保存の物理I/Oを単一のWriter本体へ接続した。通常Ownerの失効は維持し、終端側から初期化、新操作、資源要求、他操作変更、参照の未証明除去を拒否する。清掃不明の記録は保存可能だが、Host確認だけでDocker資源終端・全cleanup確認へ昇格しない。

最新の局所集合172契約は全成功（25,906.6859ms、失敗・skip 0）。実Host清掃後に通常Ownerが失効したまま終端更新が保存されること、偽Context・未確認清掃結果・実行再開・共同根拠のない全cleanup主張の拒否と本文保全を確認した。別操作の真正清掃結果も拒否した。本番／試験型検査、変更五Fileの整形・Warning拒否Lintと差分検査は成功した。Dockerは模擬であり実Provider・署名を実行していない。

保存接続を本番Producer全体の置換済みとは扱わない。旧保存の撤去、上位耐久受理・history読戻し・終了除去、fresh再入場と5D〜Fは未完了である。全移管後のFile責務精査前停止は維持する。

### 段階5CのCoordinator履歴保持設定の接続 — 2026-10-08

Coordinatorの期間設定を既存Domain ModelのTool別Readerへ接続した。実設定は`.crdd/config/coordinator.json`、配布例とSchemaは採用済み配置に作成した。非秘密設定の明示追跡allowlistと配布AI入口を追従し、他Toolの設定を流用しない。保持期間から未解決状態・Candidateの削除許可を発行しない。

設定と利用側閉包の五契約は全成功（787.6009ms）。不存在の30日、独立した指定値、不正値の非補完、hardlink・読取り失敗の拒否と本文保全を確認した。Domain Modelの型検査と変更三FileのWarning拒否Lintは成功した。初回にCoordinator用の型設定名を誤用した二検査は実行不能であり、Domain Modelの正式`tsconfig.json`へ訂正して再検査した。

横断命名・Trace集合は19件中17件成功・2件失敗で全体Passではない。現在の状態保存ITに欠けていたFile Headerを補い、Trace再検査は先へ進んだが、`coordinator:integration:native-protection-entry`の実試験／Test Catalogに対応するSymbol欠落で停止した。もう一件は`types.ts`を旧禁止判定へ渡す契約差であり、採用済み型専用配置規則とCheckerの接続が残る。未処置指摘を弱めず、移管後の全体接続確認へ保持する。

設定Readerの提供だけで履歴保存・受理・終了整理の本番成立を主張しない。これらとfresh再入場、旧保存撤去、5D〜Fが残る。全移管後のFile責務精査前停止は未到達である。

追加照合では、Coordinatorの実設定、配布例、Schemaの二項目閉集合・未知項目拒否・期間上限を契約試験へ接続した。期間上限はミリ秒換算の安全な整数境界と一致し、設定本文を変更せず検査する。設定二契約と既存利用側閉包四契約は六件すべて成功（838.0531ms）、対象Fileの整形・Warning拒否LintとDomain Modelの型検査も成功した。これは設定配布の局所確認であり、履歴Writerの本番接続、横断命名・Traceの二残件、5D〜Fの完了を意味しない。

### 段階5Cの型専用配置検査の追従 — 2026-10-08

採用済みCoding Standards §3.2／§8と旧命名検査を着手前に照合し、`types.ts`の名前だけの禁止が新配置の内容検査を遮断していることを確認した。規範・公開API・Authorityは変更せず、既存検査の実装追従として扱う。型宣言、型専用Import／Exportを受理し、実行値、Class、namespace、副作用Import、値Exportおよび型宣言0を拒否する。責務の意味的一致は構文だけで証明せず、予定されたSource独立レビューへ残す。今回の局所変更に署名・実Provider E2E・準拠監査は適用せず、CHG全体の段階6のレビュー／監査集合は維持する。

既存全Source検査へ同じ構文判定を接続し、現在の型専用13Fileは通過した。その後のHeader・識別子検査は332指摘で失敗した。旧名拒否が先に停止していたため今回到達可能になった指摘であり、332件全てを今回発生した回帰と断定しない。TraceのNative Symbol欠落も未処置であり、横断検査全体をPassとはしない。File名・責務・配置の全面精査は開始していない。

新しい命名契約と型専用構文契約の二件は全成功（311.8349ms）。20構文の正例・反例と`types.tsx`の拒否を確認し、対象の整形・Warning拒否LintとChecker型検査も成功した。初回の型検査はTypeScript 7のImport属性名の違いで失敗し、固定APIの`phaseModifier`へ是正して再確認した。局所fixtureはRepository-local tests内の自己生成Rootだけを回収し、不存在を確認した。実行ログや個別結果の書庫は追加していない。

### 段階5CのHost清掃後の共用読戻し接続 — 2026-10-08

既存の終端保存計画と通常Readerを照合し、Host清掃後に通常Ownerが失効した後の元版取得を同じ内部終端Contextへ接続した。ReaderのI/O本体は共有し、固定Root・bounded本文・実体Identity・短期排他・解放確認を維持する。Contextから任意Path、別参照、新しい操作またはProvider起動権限を作らない。終端対象の存在・同じ操作Identityも読み戻し時に確認する。

実Host清掃後の読取り、偽Context、対象欠落、Repository観測失敗、保存途中保全を追加反例で確認した。最新の実Filesystem保存ITとSnapshot三契約は全四件成功（24,304.7272ms、失敗・skip 0）、本番／試験型検査と変更二FileのWarning拒否Lintも成功した。初回の試験型検査で存在しない返却`bytes`を参照した誤りを検出し、正式ReaderのSnapshotと本文Hashを照合する試験へ修正した。通常Owner失効、終端限定Writerおよび未証明除去拒否は変更していない。

本番Producerの一体切替、上位耐久受理と履歴保存・読戻し、終了除去、fresh Process再入場は未完了である。この接続をDocker実回収・履歴本番成立・5C完了としない。5D〜Fと全移管後のFile責務精査前停止を維持する。

### 段階5Cの履歴Ownerと終端保存の照合 — 2026-10-08

Coordinator現在状態モデルの一次失敗・結果の閉集合、共用Reader／Writer、Orchestratorの履歴Writerと終了読戻しをSourceで照合した。上位履歴は業務結果の分類と別Owner排他へ依存するため、Coordinatorから流用すると逆依存となる。現在状態の保存primitiveだけを共用し、Coordinator固有の終了要約・時刻・同一性・期間整理・読戻しを[Architectureの終了履歴契約](../../../../06_Architecture/Details/coordinator/01_Architecture.md#終了履歴の導出と現在状態の整理)へ具体化した。

次の接続では、清掃不明の診断保存と操作除去の許可、元状態読取りと更新排他、一次失敗と後続清掃、通常履歴と未解決状態を分ける。再入場で記録時刻を更新して期限を延長せず、期限外も全行検証後に整理する。既存Orchestratorの固定行長や結果語彙をそのままコピーする方針は採用しない。

これは設計・Source照合であり、履歴Writer実装・試験成功・5C完了を示さない。一般の参照除去拒否は維持し、本番Producerの一体切替、履歴保存・耐久受理・終了整理・fresh再入場と5D〜Fを続ける。File責務精査前停止には未到達で、精査は開始していない。Docker・Provider・署名・実残存の削除・コミット・プッシュは行っていない。

### 段階5Cの終了要約導出の実装 — 2026-10-08

`prepareCoordinatorStateHistorySummary`を既存の現在状態モデルへ接続した。正規Snapshotとexact対象を照合し、実行中・結果未確定・別Repository・別参照・既存要約Hash不一致を拒否する。要約は操作ID・nonce・回復参照・固定Identity Hash・一次失敗・結果・Host清掃・Leaseの閉集合であり、Host PathやNative証明本文を複製しない。導出元Hashを返して後続Writerの元版照合へ接続する。

これは純粋導出の実装であり、履歴Fileの保存・時刻確定・期間整理・終端除去は未接続である。清掃不明を要約へ保持しても削除許可を作らない。最新の本番／試験型検査、変更二Fileの整形・Warning拒否LintとSnapshot三契約は全成功（228.4868ms、失敗・skip 0）。一次失敗の完全保持、要約Hash変化、固定要約の再導出一致と元本文不変も確認した。最初の静的検査はRepository直下に検査実行物がないため開始できず、Coordinator Packageの固定実行物へ訂正した。全体回帰・Source独立レビュー・実E2Eの完了とはしない。

### 段階5Cの履歴固定時点の反証と訂正 — 2026-10-08

終了要約の導出後、`summarySha256`の変更禁止と清掃不明から確認済みへの遷移を照合した。未解決診断を同じ固定要約へ保存すると、後の清掃完了が別要約になり終了処理を妨げる。履歴Writer実装前の読み取り専用確認でこの反例を再確認し、途中診断はstateと既存診断sink、historyは最終要約だけへ訂正した。新しい診断Identityや履歴母集団は追加しない。

固定にはHost・Lease・五資源の終端だけでなく、旧OwnerのEffect不能と遅延Createの無害化の実根拠を要求する。Helper返却は導出値だけであり、この許可を作らない。未受理でも最終履歴保存は可能だが全受理まで参照除去を拒否する。時刻と保存確認、保持期限越えの再試行、設定変更・時計逆行、pendingの再入場、二File間中断、新pendingと既存Readerの拒否契約を残る接続反例へ追加した。

現在の要約Hashだけでは時刻・保存確認・期限整理済みを区別できない。このGapを正本へ明示し、既存上位Writerの期限外入力の黙示処置をコピーしない。今回の確認は着手前整合であり完成後独立レビューPassではない。本番一体切替、履歴Writer、終了整理、fresh再入場と5D〜Fは未完了。全移管後のFile責務精査前停止を維持する。

### 段階5Cの履歴時刻・保存確認の現在状態接続 — 2026-10-08

読み取り専用着手前確認を統合し、操作内へ必須nullableの`history`を追加した。固定時刻、時刻込み行Hash、保存確認booleanだけを持ち、要約Hashとの両null／両非null、最終結果、正規UTC、閉じた三項目、exact行のHashを検証する。初回true、時刻・Hash差替えとtrueからfalseへの巻戻しを拒否し、確認状態を行Hashへ含めない。通常lifecycleからの要約単独固定も拒否した。

履歴専用候補は共同終端評価の構造前提を確認するが、実終端や保存の許可ではない。一般Writerはhistory変更を保存前に拒否する。固定Owner・遅延Create・実保存の証明を接続していない入口から確認状態を迂回更新できない。この拒否は本番接続までの未実装境界であり、履歴の本番成立とは扱わない。

初回モデル試験では旧HashだけのFixtureが新相関により拒否され、時刻込みの正規候補と半端状態の負例へ置き換えた。実保存試験では挿入位置の誤りを型検査で検出し終端後へ移した。その後、lifecycle Fixtureへ余分なhistory項目を入れたため保存契約が拒否し、六項目を維持する形へ訂正した。最新の実Filesystem保存ITとSnapshot三契約は全四件成功（24,526.0178ms、失敗・skip 0）。本番／試験型検査、変更四Fileの整形・Warning拒否Lintも成功し、一般Writerの迂回拒否時の元本文不変を確認した。履歴公開後・確認checkpoint前の中断、期限整理の順序、本番一体切替と5D〜Fは残る。全移管後のFile責務精査前停止を維持し、Docker・Provider・署名を実行していない。

### 段階5Cの実終端根拠と再要求拒否の照合 — 2026-10-08

読み取り専用確認を現行Sourceと再照合した。旧`recordRuntimeOwnedDockerAbsence`は五purpose観測を受け取らず集約booleanだけを保存する。旧完了CapabilityはHost遷移・pointer除去・実HomeLease解放までの限定根拠であり、実cleanupやHost清掃の代替にならない。またEffect Runtimeは清掃成功後にContextを削除し、有効な管理Ownerから再作成できるため、Context不存在を新Effect不能とする案は採用しない。

Architectureへ、実cleanup返却の同操作・同計画相関、五purposeのexact観測、実Host清掃・Lease解放と終了後の再要求拒否を共同照合する接続表を反映した。新DB・Lock Framework・汎用Recoveryを追加せず既存Ownerと終端Contextへ閉じる。これは着手前確認の統合であり、実装済み・独立レビューPassではない。実Docker・Provider・署名・削除は行っていない。

次の実装対象は、同Attemptの再要求拒否と実cleanup根拠の接続、その後の履歴Writer・本番Producer一体切替である。5D〜Fは未完了で、全移管後のFile責務精査前停止は未到達である。

同じ計画の再要求拒否を既存Effect Runtimeへ実装した。清掃処理の最初のawait前に管理Capabilityと計画Identityを停止集合へ固定する。清掃成功後のContext削除と清掃観測欠測の両方で同じ計画の再起動を拒否し、Docker要求数が増えないことを確認した。初回の管理Capability全体を止める案はClaudeからCodexへの既存接続を試験で破ったため撤回し、計画単位へ訂正した。修正後のEffect／Controller全117契約は成功（6,682.6807ms、失敗・skip 0）。本番／試験型検査と変更二Fileの整形・Warning拒否Lintも成功した。実Dockerは使っていない。

実cleanup返却の真正相関、既発行要求の遅延終端と履歴Writerへの共同接続は残る。再要求拒否だけを実終端・5C完了またはSource独立レビューPassへ昇格しない。

### 段階5Cの実清掃返却と本番Controllerの相関接続 — 2026-10-08

既存Effect Owner内に実清掃返却objectと管理Capability・回復Capability・計画Identityの相関を保持し、五purposeの完了観測だけを返す照合を接続した。本番と模擬Runtimeは私有集合を共有しない。本番Controllerの終端経路は照合された観測を使い、不一致・例外でabsence記録、Mount完了と回復完了を拒否する。新しい保存File、Lock、回復DBは追加していない。

コピー・別操作・別計画・別Runtimeと、本番Ownerによる模擬結果拒否を確認した。関連119契約は全成功（5,745.8163ms、失敗・skip 0）。初回の試験型検査でnullableな完了値の未確認を検出し、assertionへ訂正して本番／試験型検査を再確認した。変更四Fileの整形・Warning拒否Lintと差分検査も成功した。追加のBiome複合checkは四FileのImport順で停止したため成功とは記録せず、既定の独立した整形・Lint検査と区別する。

実Docker・Provider・署名を実行していない。既発行要求の遅延終端、Host清掃・Lease解放との共同証明、履歴Writer・現在状態終了整理・本番Producer切替と5D〜Fは残る。全移管後のFile責務精査前停止は未到達であり、精査は開始していない。

追加Source照合で旧absence記録の拡張は廃止形式の延命になるため行わず、Controllerの元の完了結果に終端観測を内部保持した。完了時の制御Context除去を維持し、同じ管理Capability・操作ID・回復参照だけへ観測を借用する。本番と模擬の集合を分離し、コピー、別操作、別回復参照を拒否する。現在状態Writerへの実接続は未完了である。

更新したController全101契約は成功（1,639.1465ms、失敗・skip 0）。完了後の観測保持、終了済み制御の取消拒否、本番Ownerによる模擬結果拒否と既存公開結果を確認した。本番／試験型検査と変更二Fileの整形・Warning拒否Lintも成功した。旧Fileの追加、実Docker・Provider・署名は行っていない。

終端Writerへ元の本番Controller結果の照合を接続した。清掃前Contextの管理Capability・操作ID・回復参照から借用した観測を、更新排他内の元Snapshotと候補資源集合へ照合する。観測と候補が一致しない、元結果がない、コピーJSONだけの場合は保存前に停止する。他操作・参照除去・履歴更新の拒否と元版・実体照合は維持した。

実Filesystem保存ITとSnapshot三契約は全四件成功（25,603.7232ms、失敗・skip 0）。構造上許可される資源変更でも、元結果なし／偽成功値で拒否され、元本文が保全されることを確認した。本番／試験型検査と変更二Fileの整形・Warning拒否Lintも成功した。実Dockerの肯定経路は未実施であり、本番Producer一体切替、Host／Home共同証明、履歴Writer、fresh再入場と5D〜Fの残件は解消済みとしない。

HomeLeaseの実解放根拠を既存Recovery Ownerから終端観測へ接続した。`release()`の成功直後だけ、元の回復Capability・管理Capability・操作ID・回復参照へ非Authorityの事実を保持する。旧record消費でこの事実を消さず、後続の完了処理失敗と解放済みの事実を区別する。終端Writerは根拠なしの`released`遷移を拒否し、全清掃成功にはHost、五purpose、Mount、HomeLease、回復完了の共同照合を要求する。新しいFile・Lock・回復Frameworkは追加していない。

Controllerと実Filesystem保存の102契約、実Lease解放の限定一契約が成功した。解放前の拒否、元Capabilityだけの肯定、コピー・別Owner・別操作・別回復参照の拒否、finalize後の根拠保持を確認した。本番／試験型検査、変更七Fileの整形・Warning拒否Lint、差分検査も成功した。初回の型検査は存在しない`tsconfig.json`指定で未実行となり、実在する`tsconfig.strict.json`で再実行した。Docker、Provider、署名は実行していない。新Process再入場、解放失敗・後続失敗の追加反証、本番Producer一体切替、履歴Writer・終了整理、5D〜Fは未完了である。

解放と後続回復の反証を追加した。独立Controllerで解放観測false・例外・trueと回復完了失敗を組み合わせ、全清掃を成功へ丸めず、trueの解放事実だけを保持した。Controller全102契約は成功（1,685.9898ms、失敗・skip 0）。既存production正常回収とOwner喪失の二契約も成功（1,719.718ms、失敗・skip 0）し、実解放の根拠保持とabandonを正常解放根拠へ昇格しないことを確認した。試験型検査と変更二FileのWarning拒否Lintも成功した。模擬の失敗注入を実HomeLease失敗試験と同一視せず、新Process再入場の保証にも昇格しない。

履歴固定の着手前確認では、正常なCreate受理・exact ID回収と真正な未要求だけを終端根拠に使い、ID不明の終了を一般化しない方針を確認した。初回falseも要約・時刻を固定するため、五資源の差分がない場合も照合する。既存Writerへこの限定checkpoint入口を接続し、同じ元状態からの再導出、対象一件以外の差分拒否、初回true拒否を維持した。履歴行I/O、prune、新Process再入場と操作除去はまだ接続していない。

実Filesystem保存IT一件は成功（25,862.7975ms）し、元Controller結果なし・偽成功値ではstate本文を変更せずhistory Fileも作らないことを確認した。正規正常経路のcheckpoint物理保存肯定は未実測であり、接続完了とは主張しない。Effect／Snapshot関連23契約は成功（5,203.0129ms、失敗・skip 0）。五purposeそれぞれのID不明で、Process終端だけから真正成功結果を発行しない反証を追加した。本番／試験型検査、変更三Fileの整形・Warning拒否Lint、差分検査も成功した。初回Lintで試験の非null強制一件を検出し、実assertionへ訂正して再確認した。

### 段階5Cの履歴全行検査・期間整理候補 — 2026-10-08

固定Snapshotから時刻込みの正規行を生成し、UTF-8・末尾LF・全行Schema・UTC・要約相関・重複を検査するモデルを接続した。設定期間による整理候補は期限境界を保持し、未確認行を期間外でも保護する。未確認行欠落や同じ回復参照のHash不一致は拒否し、確認済みで既にない行を再追加しない。読取り容量は停止条件であり、容量による整理規則を追加していない。

Snapshotの局所三契約は成功（290.6602ms、失敗・skip 0）。本番／試験の型、整形・Warning拒否Lintも成功した。初回の反例で正規JSONと同じ文字列を不正値としていたため試験が失敗し、先頭空白の非正規本文へ訂正した。本文検査を緩めていない。期間境界・設定変更・破損・未確認行保護の結果はメモリ内モデルの根拠であり、実Fileの保存成功ではない。

保存接続の読み取り専用着手前照合では、初回追加の根拠を実際のnull→false遷移だけに限定し、同じ操作の別Contextと共有して最初のI/O前に消費する方針へ補正した。既存falseの再保存を未発行根拠にせず、pendingは元履歴と候補の全体Hash・固定時刻・設定へ結合する。対象行だけが一致して他の行が失われたpending、自動再発行、排他内の公開Writer再呼出しは許可しない。これは着手前確認であり、完成Source独立レビューではない。

履歴の物理Writer、確認trueの実保存、操作除去、本番Producer一体切替と5D〜Fは残る。Docker・Provider・署名は実行していない。File責務精査は開始しておらず、人間指定の停止地点は維持する。

### 段階5Cの履歴物理Writer接続 — 2026-10-08

履歴公開を既存Snapshot Writerの同じ更新排他へ接続した。null→falseの実固定・保存読戻し・排他解放成功だけから初回追加根拠を同じ管理Owner／回復参照へ保持する。既存falseの再保存では再発行せず、最初の履歴write前に消費する。pendingは元履歴全本文・実体、候補全本文・固定時刻・設定とstate候補に結合し、全行を検査して未確認行を保護する。履歴をflush・置換・exact読戻しした後だけstate trueへ進む。操作・参照除去は依然拒否する。

読み取り専用の再照合で、既確認の期限後再呼出しと既存行のflush省略を検出した。wrapperと更新排他内の両方で同じ既確認Snapshotを識別し、新しい履歴I/Oにしない枝へ是正した。未確認の既存行にも同じdescriptorの実体照合・fsync・close・全行読戻しを要求した。一般Readerがpendingを拒否する場合は、元Owner内の固定候補だけからWriterで再照合する。fresh Processの根拠なし再公開や履歴からの状態復元は追加していない。

型・整形・Warning拒否Lintが成功した。初回Lintのoptional chain指摘は是正した。最新Sourceで保存ITとモデルの四契約が成功（26,151.4831ms、失敗・skip 0）し、追加した公開入口も元結果なし・偽成功値ではEffectを発行しない。ただし正常checkpoint／履歴公開の物理肯定、history公開後state失敗、別Context再入場、pending他行喪失、fsync／close失敗の注入は未実測であり、履歴能力完成・Source独立レビューPassとは扱わない。本番Producer、操作除去と5D〜Fは残る。Docker・Provider・署名を実行せず、File責務精査前停止は維持する。

### 段階5Cの終了整理候補と本番切替先の確認 — 2026-10-08

Sourceの参照元を確認すると、新Snapshot Writerはまだ本番Task／Docker Ownerから呼ばれていない。実開始は`beginProductionRecovery`、資源の途中記録と終了は旧Recovery Owner、Host終端はTaskの`cleanupOperation`へ接続されている。切替ではこの一連を新保存へまとめて置換し、旧Journalと新Snapshotの二重書込みを恒久化しない。内部Wrapper追加だけで本番切替済みとは表示しない。

その前提として終了整理の値候補を追加した。実行・Effect不明・清掃未確認・Host pending・Lease未解放・履歴未確認・一Consumerでも未受理なら拒否し、そろった対象操作と同じ回復・搬送参照だけを一改訂で除く。他操作と元版相関を保持する。一般の遷移検査と物理Writerの除去拒否は緩めていない。各Consumerの実受理と必要集合は本番Ownerで別途照合する。

本番／試験型・整形・Warning拒否Lintと局所モデル三契約が成功した。初回の肯定FixtureにはEffect unknownが残っていたため拒否され、肯定Fixtureを既知評価へ訂正して、不明評価の拒否試験を維持した。三Consumerの受理／未受理を明示し、候補生成を物理削除成立へ昇格していない。正常履歴公開・中断の物理試験、終了整理Writer、本番一体切替と5D〜Fは残る。Docker・Provider・署名を実行せず、File責務精査は開始していない。

### 段階5Cの履歴Filesystem肯定・中断試験 — 2026-10-08

既存Windows保存ITへ履歴の肯定・中断試験を追加した。Docker終端観測だけをNode試験workerのModule差替えで模擬し、本番照合APIやWriterに試験用の迂回入口を追加していない。Host清掃、Repository結合、FilesystemとOS排他は実物を使う。履歴固定・公開・確認true、fsync失敗時の未確認維持、pending本文破損の拒否、履歴公開後state保存失敗から別Contextによる再入場、初回時刻維持、二重追加防止、整理済み確認行を再生成しないことを確認した。偽の終了結果は拒否し、最後に短命FileとLockが残らないことを確認した。

保存ITとモデル計四契約は成功（23,739.25ms、失敗・skip 0）。Host試験専用の実行設定へModule差替えフラグを追加した。実行設定の固定期待値を持つ契約試験が初回失敗したため、対象試験の閉集合を変更せず同じフラグへ接続し、二契約の成功を再確認した。本番／試験型、変更試験の整形・Warning拒否Lint、差分空白検査も成功した。これは実Docker終端、本番Producer接続、履歴全能力または完成独立レビューPassの証明ではない。close失敗・他行を含むpendingの保全、Consumer受理、終了整理Writer、本番一体切替と5D〜Fは未完了である。Docker・Provider・署名は実行していない。File責務精査前停止は維持する。

### 段階5Cの開始保存接続 — 2026-10-08

本番の旧開始・Host遷移・資源要求／応答・清掃・最終終了を読み取り、新現在状態へ置き換える八境界の対応をCoordinator詳細へ明記した。開始保存の内部入口は、既存Reader・初回領域作成証明・Writerを使用して同じ操作を直接確定する。本番Recovery Ownerはまだ旧保存であり、部分的な二重書込みは導入していない。

読み取り専用Source確認で、初期化Effectが最終結果から失われる点と、Reader前停止・重複拒否でexact回復参照が失われる点を検出した。初期化／WriterのEffectだけをORし、有効な同じ操作Identityの参照をReader前に固定する形へ是正した。再確認で両指摘はSource上解消、新指摘なしとなった。初回保存・既存版追加・重複同参照・破損保全に加え、初期化後のWriter拒否で未確認・Effectあり・参照保持・state未作成を確認した。保存ITとモデル四契約は成功（43,867.0619ms、失敗・skip 0）、本番／試験型・整形・Warning拒否Lint・差分空白検査も成功した。Reader解放不明の注入は未実測であり、Source再確認を実測へ昇格しない。本番一体切替・終了整理・5D〜Fは未完了、完成独立レビューPassではない。Docker・Provider・署名は実行していない。

## 段階5Cの操作Identityから旧保存結合の分離 — 2026-10-08

現在状態モデルの固定操作情報を`crdd-coordinator/operation-identity/v1`へ分離し、旧AppDataの`runtimeStateBinding`を外側Snapshotと一致する`repositoryBinding`へ置き換えた。Home・ユーザー・Host・予定資源と回復IDの書式は保持し、旧Validatorを緩めたり旧四HashへRepository Hashを代入したりしていない。旧形式の移行はフロントAIが扱う。

旧Schema、旧項目混入、別／欠落Repository結合、不正Home・Host・資源を拒否する反例を追加した。実Filesystem保存とモデルの四契約はすべて成功（24,366.4585ms、失敗・skip 0）。本番／試験型検査、三Fileの整形・警告拒否Lint、差分空白検査も成功した。Docker終端は既存試験内模擬であり、実Provider検証や本番切替済みの主張はしない。

読み取り専用の着手前確認で、Orchestratorの回復受理・状態型・Objective受理にも旧結合が残ることを確認した。本番開始Producer、Receipt、Host遷移、履歴確定、上位受理、再入場と旧Writer撤去は一体切替の残件である。新モデルと旧本番が併存する途中状態を完成とは扱わない。5D〜Fと、全移管後のファイル責務精査前停止も未到達である。

## 段階5Cの開始Reader排他解放欠測の確認 — 2026-10-08

実Named Pipe排他を取得・解放したうえで、解放の観測結果だけを試験内でfalseへ置き換えた。開始Reader後にWriterや初期化へ進まず、保存Effectなし・保存未確認・排他解放未確認を返し、元のstate.jsonと同じ回復参照を保持することを確認した。取得回数は一回で、実排他の解放は別に確認済みである。これは解放観測欠測の反例であり、OS資源残存事故の実測ではない。

初回は試験内のquery付きimport文字列が型解決不能となった。実行用URLと型参照を分離して是正し、再検査した。試験型・整形・警告拒否Lint・差分空白検査は成功し、実Filesystem保存契約一件は成功（24,416.4081ms、失敗・skip 0）。本番切替と全体回帰の未完了は維持する。

## 段階5Cの終了搬送の着手前照合と空集合の誤判定是正 — 2026-10-08

旧受理経路をcomposition-root → task-recovery-adapter → settlement → objective-applicationまで照合した。新形式へ保持するのは、固定結果と必要搬送先の登録、上位耐久保存後のfresh読戻し、同じAttempt・操作・回復参照・結果の受理反映、履歴・全終端確認後の対象除去と次Attemptへ進む順序である。旧AppData結合、Receipt inode、companion、二段File GCとtombstone容量管理は再実装しない。既存上位Reader／Writerを使用し、受理Authority Frameworkや汎用registryを追加しない。

照合で、搬送集合が空でも純モデルの終了候補が成立し、同じ操作のConsumerに異なる結果IDを保持できる不足を検出した。空集合の終了を拒否し、同じ操作の全搬送先が同じ結果IDへ結合する検査と反例を追加した。モデル三契約は成功（277.15ms）、実Filesystem保存一契約も成功（25,791.389ms）。本番／試験型、整形・警告拒否Lint・差分空白検査も成功した。

これは終了モデルの不足是正であり、必要搬送先の本番登録、上位保存・読戻し、再起動後受理、除去後の応答喪失と追加Effectなしの再確認は未接続である。固定Source独立レビュー、実Provider E2Eや全体Passは主張しない。

## 段階5Cの実Hostからの開始Identity構築 — 2026-10-08

実HostをRepository内に作成した初回試験で、開始Identity構築がnullとなった。旧token ReaderがOSの一時Rootから保存先を逆算していたことが原因である。試験のTEMP設定を変更せず、同じ管理Capabilityが保持する実Host記録を読み取る内部経路へ是正した。読取り前後の記録Hash・実体Identity・状態検査を維持し、任意Pathや新しい処置Authorityは追加していない。

実HostとRepository結合から構築したIdentityを開始Writerへ保存し、Repository内Host Path、旧結合項目の不存在、tokenと記録Hashの一致、別操作・未発行Owner・Ownerコピー・不正世代の拒否を確認した。最終の実Filesystem契約一件は成功（27,703.8638ms、失敗・skip 0）。本番・試験の型検査、三Sourceの警告拒否Lint、整形と差分空白検査も成功した。最初の整形呼出しは作業Directoryに対するPath指定を誤り、正しい相対Pathで再実行した。

これは開始情報構築と実保存の局所確認である。本番のHome Lease取得、開始Producer、結果登録・上位耐久受理・終了整理の一体切替は未完了であり、実Docker・Provider依頼・署名は実行していない。5D〜Fと全移管後のFile責務精査前停止を維持する。

## 段階5Cの固定結果と必要搬送先の実保存 — 2026-10-08

結果公開前の登録入口を既存現在状態Writerへ接続した。同じ操作Owner・回復参照・読取り版に、固定結果IDと空でない必要搬送先を結合し、全搬送先を未受理で保存する。回復義務を維持し、任意の受理Hashを入力させない。新しい保存File、registryや受理Authorityの仕組みは追加していない。

Repository内の実state.jsonで二搬送先の保存・読戻し・排他解放、空集合・重複・未知Consumer・不正結果ID・受理Hash混入・登録後の結果差替えの拒否と元File保全を確認した。実Filesystem契約一件は成功（26,707.28ms、失敗・skip 0）。本番／試験型、整形、警告拒否Lintと差分空白検査も成功した。

本番結果Producerはまだ旧経路であり、今回の入口追加を結果公開前の本番接続済みとは扱わない。上位耐久受理、応答喪失後の再入場、終端整理Writerと本番一体切替は未完了である。5D〜FおよびFile責務精査前の停止境界を維持する。

## 段階5CのRepository内Host実遷移と上位受理照合 — 2026-10-08

開始経路の照合で、所有中Hostの開始・完了遷移にも旧token ReaderのOS一時Root前提が残っていた。同じ操作Ownerの実Root・記録・世代を検証する経路へ置換し、tokenのRoot名・nonce・現在Hash相関と記録実体検査は維持した。任意Root入力や一般回復Authorityは追加していない。

Repository内の実Hostで開始・完了遷移、記録Hash変更、完了後host_only、未発行Owner・別操作・古いtoken拒否を確認した。実保存契約一件は成功（33,101.6878ms）、Host遷移・世代・Lock取得の既存局所68試験も成功（684.5059ms）。本番／試験型、整形、警告拒否Lint・差分空白検査が成功し、自己生成試験領域の残存はない。実Docker／Providerは操作していない。

上位受理の読み取り専用照合では、既存Project・Task・Attempt・操作・回復・保存世代相関を維持し、旧AppData結合とReceipt inodeを新Repository結合・固定結果IDへ置換する最小案を確認した。結果本文・受理本文の符号化、利用形態別必要Consumer集合、更新排他内のfresh上位確認は具体化が残る。提案を採用済みSchemaとは扱わず、本番開始・結果公開・耐久受理・終端整理の一体切替は未完了とする。

## 段階5CのHost開始予定・実遷移・確認保存の接続 — 2026-10-08

開始Identityの保存後、Host開始予定を同じstate.jsonへ保存してから実Hostを遷移させ、実token再観測後だけ予定を解消する内部入口を接続した。保存確認・排他解放・Host要求と確認を区別し、同じ回復参照を保持する。別Fileや新Authorityの仕組みは追加していない。

実Host・実Filesystem上で、開始前例外と開始後応答喪失だけを試験内注入した。最初の失敗は予定を保存したままHost未変更、次の失敗はHost開始済み・予定未解消となる。再入場は同じ実後継tokenを照合して結果保存だけを行い、開始呼出しを増やさないこと、保存確認後の再発行拒否を確認した。初回静的検査のnullable型とoptional chain指摘を是正し、固定Sourceの最終実保存契約一件は成功（35,932.7698ms、失敗・skip 0）。本番／試験型、整形、警告拒否Lintと差分空白検査も成功した。

これは同じProcessの開始Ownerと保存・実Hostの接続であり、別Process回復、本番Home LeaseとDocker開始Producer、結果公開・耐久受理・終了整理の一体切替は未完了である。実Docker、外部AI依頼、署名は行っていない。全移管後のFile責務精査前停止は維持する。

## 段階5Cの固定終端要約による結果登録 — 2026-10-08

結果IDを既存の固定操作要約SHA-256に接続した。任意の結果本文やSnapshot全体のHashを受け付けず、履歴時刻・改訂番号・一時File Identityを結果IDへ混ぜない。真正Host清掃と同じController終端を照合し、更新排他内で同じ候補を再導出する。別の結果Fileや受理Frameworkは追加していない。

実Filesystem試験で、二搬送先の未受理登録、同じ登録の再入場によるstate.jsonの本文・実体維持、必要集合の差替え拒否を確認した。元清掃結果・元Controller結果のコピー、空集合と重複も拒否する。初回は、再登録時のFilesystem操作をfalseと期待して一件失敗した。既存Writerは短命state.lockを作成・回収するため、操作ありとstate.json更新なしを分ける期待値へ是正した。最終の実保存・モデル四契約は成功（38,296.8675ms、失敗・skip 0）。本番／試験型、整形、警告拒否Lintと差分空白検査も成功した。

Docker終端は試験内模擬で、Host清掃・Repository結合・保存・OS排他は実物である。この結果IDは操作終端要約であり、候補採用やTask全体の成功ではない。利用形態別必要Consumer集合、上位耐久受理、終端整理Writerと旧本番の一体切替は未完了。5D〜Fと全移管後のFile責務精査前停止は未到達であり、全体Pass・完成独立レビュー・実Provider E2Eとは扱わない。

## 段階5Cの結果ID不変性と上位受理の切替順序 — 2026-10-08

読み取り専用の着手前確認で、上位受理本文を既存相関八項目と新Repository結合・結果ID・固定Consumerの十一項目に限定する案、既存上位Readerでのfresh確認、保存Lockを解放して下位更新へ進む順序を確認した。型だけを先行変更せず、結果取得・上位保存・読戻し・受理更新と本番Producerを同じ切替候補で接続する。旧形式のunionや二重保存は追加しない。Coordinator詳細へ切替契約を反映したが、本番接続済みや完成レビューPassとはしない。

固定結果の反例試験を追加し、履歴確認・改訂後も同じ結果IDを保持し、受理済みの再登録が元本文を維持することを確認した。実保存・モデル四契約は成功（40,950.2599ms、失敗・skip 0）。試験内変数名の静的検査失敗は、実際の登録読戻し変数へ修正した。さらに終了候補が任意の同一結果IDでも成立する不足を検出し、固定終端要約IDとの一致を必須化した。全搬送を同じ別Hashにした反例を追加し、最新モデル三契約は成功（256.8626ms）。本番／試験型、警告拒否Lintは成功した。最後の終了条件是正は純モデルだけを変更しており、実保存試験の先行結果を本番終了Writerの証明へ拡張しない。

本番Home Lease、開始・資源観測Producer、上位受理、終了整理とfresh Process接続は未完了である。実Docker・Provider・署名は行っていない。移管5D〜Fとファイル責務精査前停止も未到達である。

## 段階5Cの固定結果取得と通常Writerの迂回拒否 — 2026-10-08

任意結果IDを登録する旧汎用入口を撤去し、固定終端登録だけを保持した。新しい内部Readerは同じ登録済み終端Contextから現在状態を読み、固定要約との一致と排他解放を確認して、登録済みConsumerの最小結果参照だけを返す。偽Context、コピー、未登録・未知Consumerは値なしで拒否する。

読み取り専用確認で、通常の参照更新と共用物理Writerから搬送集合・受理Hashを変更できる迂回を検出した。通常更新では集合を不変にし、物理Writerでも真正固定登録以外の差分を拒否した。任意登録・受理Hash更新の反例は本文を維持して停止し、回復参照だけの通常更新は成立する。最新の実Filesystem・モデル四契約は成功（37,006.7434ms、失敗・skip 0）。Docker終端は試験内模擬であり、本番結果公開・上位耐久受理・終了除去の証明ではない。

是正後の読み取り専用再照合では、共通Writerと通常checkpointの迂回拒否、真正登録・結果Reader・再入場・回復義務更新の保持に新しい局所Source指摘はなかった。これは完成監査ではない。撤去済み関数名をArchitectureから新入口へ追従し、本番／試験型、整形・警告拒否Lintも成功した。

本番接続の全数検索では、新終端Context・登録・取得の利用側はまだ実保存試験に限定されている。Orchestratorの`task/composition-root.ts`は旧Receipt取得／終了確定へ接続し、`application/project-runtime-objective-application.ts`が旧AppData結合・Receipt Hash／Identityを上位保存する。次の切替は、この組立て・上位保存・既存Reader・下位受理を同じ候補で変更する。新型だけの先行有効化や通常Writerの一般緩和は行わない。

全移管後のファイル責務精査は未開始で、停止境界には未到達。本番Producerの一体切替、上位受理、5D〜Fを継続する。

## 段階5Cの上位受理本文からの候補導出 — 2026-10-08

既存モデルへ`prepareCoordinatorStateProjectAcceptanceSnapshot`を追加した。正本の十一項目を閉集合として符号化し、同じRepository・操作・回復参照・固定結果と登録済み`project_runtime`搬送へ結合する。正規JSON・UTF-8・末尾LFのHashは入力Hashではなく本文から導出する。同じ受理の再入場は元版を返し、初回受理Hashの差替えを拒否する。他Consumer、回復義務と操作は保持する。

最新モデル三契約は成功（269.86ms、失敗・skip 0）。欠落全十一項目、旧Receipt項目・追加Hash・時刻の混入、別結果・操作・結合、未登録と既受理の差替えを反証した。getterとProxyは評価せず拒否する。本番／試験型、整形・警告拒否Lintは成功。読み取り専用のSource照合でも新しい局所指摘はなかった。

この候補生成は上位の実保存を証明しない。別Task・Attempt・世代の反例は既受理Hashの差替え拒否であり、初回受理が実際の上位保存と一致することは本番Reader接続が確認する。

着手前の読み取り専用照合を受け、既存終端Contextへ同期上位Readerを固定し、専用受理Writerから共用物理Writerの更新排他内でも再取得・exact候補再導出する経路を追加した。一般Writerの搬送差分拒否は維持し、新registry・File・逆importは追加しない。上位保存Lockを解放してから下位へ入り、下位更新中は短期の上位読取りだけを行う。

実Filesystem試験では偽／ReaderなしContext、Readerのnull・Promise・例外、初回読取り後の受理消失、対象一搬送の保存と他搬送保全、同じ受理の再入場を確認した。保存rename失敗後は同Contextが発行した候補だけを私有メモリへ保持し、元本文・pendingとfresh上位受理の再照合で保存完了する。再入場時の上位読取り失敗ではpending・元本文を維持する。初回の再入場枝の挿入先不一致を自身のSource照合で見つけ、履歴checkpointから受理入口へ移してから実試験した。最新の保存・モデル四契約は成功（41,494.403ms、失敗・skip 0）。本番／試験型、整形・警告拒否Lintも成功した。

是正後の読み取り専用Source／Oracle照合でも、専用受理保存と同Contextのpending再入場に新しい局所指摘はなかった。確認者は実試験を再実行しておらず、完成レビューではない。

上位Ownerへ`createProjectResultAcceptanceReader`を追加し、既存上位Readerの保存確認済み結果から同じTask・Attempt・操作・回復義務の十一項目を返す同期閉包を具体化した。固定八項目のコピー、欠落・追加・Getter・Proxy拒否、旧ACK、別対象、受理本文全項目欠落と相関差、無効Hash・世代、現在世代進行後の初回受理世代保持、blocked・null・例外を反証した。初回試験型確認ではquery付きimportの型解決と配列要素の未確定を検出し、動的URLと存在確認へ是正した。最新の保存実Filesystem・モデル・上位Reader五契約は成功（32,941.4524ms、失敗・skip 0）。Coordinator試験とOrchestrator本番の型、整形・警告拒否Lint、差分形式検査も成功した。固定Source／Oracleの読み取り専用確認に新しい局所指摘はなく、確認者は実試験を再実行していない。

終了整理の専用入口`completeRuntimeOwnedCoordinatorSettlement`を共用物理Writerへ接続した。固定元本文からpure終了候補を再導出し、真正Host・同Controller・Lease・五資源、上位受理と履歴相関を更新排他内で照合する。通常Writerの任意除去は拒否する。処置後の同Contextだけが元本文とexact候補を保持し、元版／同pending／保存済み候補に再入場する。未接続のCLI・WorkbenchはHashだけで完成にせず停止する。履歴行が明示的に無い場合は既確認を保持し、再追加しない。

初回の終了試験は五契約中一件失敗（27,339.0681ms）。既存fixtureの三Effectがunknownのままでpure除去が正しく拒否した。実装条件は緩和せず、登録・履歴固定前に別の既知終端fixtureを明示し、受理済み単独Consumer fixtureから各Effectだけunknownに戻す拒否反例を追加した。独立確認で見つかった未接続Consumer反例の原因混在は、Project受理Hashを保ちWorkbenchだけ非nullとし、pure候補肯定後の専用Writer拒否へ是正した。試験型・Lint指摘も是正した。

最新五契約は成功（45,076.5432ms、失敗・skip 0）。終了保存へのrename前失敗と実rename後throwによる合成応答喪失、上位受理欠測時の本文／pending保全、同ACK復元後のexact再入場・排他解放、別Context拒否、既確認履歴の明示的欠落を実Filesystemで確認した。型・整形・警告拒否Lint・差分形式は成功。固定Sourceと是正後Oracleの読み取り専用再確認に新しい局所指摘はなかった。確認者は実試験を再実行しておらず、完成レビューではない。

新Reader試験の上位Storage出口とDocker終端は模擬、Host清掃・Repository結合・下位保存・OS排他は実物である。終了肯定は直接配置した単独Consumer fixtureの保存境界確認であり、登録集合の本番変更や全Consumer接続の実証ではない。実上位保存decoder、旧ACK型／本番Producerの一体切替とfresh Process再入場は未接続・未観測であり、局所結果を実Consumer成立・5C完了・全体Pass・実E2Eへ昇格しない。5D〜Fとファイル責務精査前の停止境界も未達である。

終了専用Writerへ排他解放の観測欠測反例を追加した。出版後応答喪失からの再入場で実KernelLockを解放し、その返却値だけをfalseへ差し替える。保存確認true・解放確認falseでも結果はblocked、理由は`coordinator_state_lock_release_unconfirmed`となり、除去後本文とpending／整理済み履歴の不存在を保つ。次の同Context再確認だけがcompletedとなる。これは実OSの解放失敗や資源残存の証明ではない。

初回は更新排他の解放を二回と期待して五契約中一件失敗（40,545.9434ms）。保持済み終了候補の再入場では開始Readerを呼ばず、更新Writerの一回だけになることをSourceと読み取り専用確認で照合した。Source条件を緩めず注入位置と期待回数だけを修正し、最新五契約は成功（42,485.4472ms、失敗・skip 0）。試験型・整形・警告拒否Lint・差分空白確認も成功した。追加のBiome checkは既存import順のassist指摘で停止し、所定の整形・Lintとは区別する。無関係なimport一括変更は行っていない。是正後Oracleの読み取り専用確認には追加指摘がなく、確認者自身の再実行や完成監査とは扱わない。

### 本番一体切替の実接続境界

2026-10-08のSource全数検索では、新しい保存・固定結果・受理・終了入口を本番開始Ownerや上位組立てから呼び出す接続はまだ存在しない。次の対応はファイル責務精査ではなく、5Cの本番保存方式切替である。下記を同じ候補で接続し、旧形式のunion、二重保存、旧Rootへのfallbackを残さない。

| 境界 | 現在の本番経路 | 同時に切り替える対象 |
|---|---|---|
| 開始とHome排他 | `beginProductionRecovery`がWindows RuntimeState Rootを観測し、旧開始Writerへ渡す | 実Home観測・Leaseは保持し、Repository結合・開始Identity・新開始Writerへ接続 |
| 操作の私有相関 | `DurableRecord`が旧Root、操作Directory、pointer、base inodeを保持 | 同じ操作Owner・Home LeaseとRepository内現在状態への相関へ置換 |
| Host・資源の遷移 | 旧submission／receipt／absence／mount保存 | 現行checkpointと実Controllerの同じ回復参照へ接続 |
| 結果の公開 | 旧completion receiptとacknowledged receipt | 固定終端要約ID・本番利用形態の必要搬送集合を公開前に登録 |
| 上位取得・保存 | `task/composition-root.ts`、Objective application、coreのACK型、storage decoderが旧Receipt形式 | 新十一項目の取得・保存・読戻しを一体変更し、固定上位Readerへ接続 |
| 受理と終了 | 旧ACK確定・個別Directory回収 | 真正清掃・Controller結果・保存済み上位受理・履歴を新専用Writerへ接続 |
| 別Process再入場・他公開利用側 | 旧inventory／相関Reader、CLI・Workbench経路 | 現行現在状態の再発見と実利用側の受理へ接続し、旧Writer／Reader撤去を確認 |

上位型やdecoderだけの先行変更では既存Producer出力を読めなくなる。新しい内部入口の局所成功を切替完了とせず、開始から公開結果・再入場まで実接続した候補を検証する。

### 本番利用形態と受理条件の未決事項

本番利用側の照合で、全利用形態に耐久受理を要求する設計と、現在の結果保持契約の食い違いを確認した。これは新保存入口の配線不足だけではなく、単体利用の終了条件に関わるため人間判断へ戻す。現在の判定条件を変更したり、新しいReceipt Storeを実装したりはしていない。

| 利用形態 | 現在の実接続・保存Owner | 未確定な点 |
|---|---|---|
| 単体CLI | `coordinator-command.ts`のTask処理はcompletionを待ち、取消監視を解除し、stdoutまたは人間向け表示へ返す。結果の上位耐久保存はない。 | 端末への返却以外に、Process終了後の結果再取得まで必須とするか。 |
| Workbench AI依頼 | `workbench-ai-request-application.ts`は現在Process限定のMapへ結果を保持し、本文のProcess外保存を行わない契約である。 | AI依頼結果のProcess終了後再取得を追加要求するか。Candidate Storeの保全を結果受理と混同しない。 |
| Orchestrator | Objective applicationがACKを現在状態へ保存し、Task／Attempt／世代を再確認して終了へ進む。 | 既存の耐久受理を新十一項目へ一体切替する。耐久保存自体は維持対象。 |

現在Architectureの全Consumer耐久受理・空集合拒否をそのまま当てはめると、CLIとWorkbenchにも新たな耐久結果Ownerが必要になる。Candidate Storeは未採用候補本体の保全・採用を所有し、操作終端要約のConsumer受理を代替しない。読み取り専用の品質確認でもこの区別と判断の必要性を確認した。

推奨候補は、Orchestratorでは保存済み受理を維持し、単体CLI／Workbenchは資源終端・必要なCandidate保全・終了要約を確認した上で既存の返却方式を使うことである。その場合、一時的な回答のProcess終了後再取得は保証せず、閲覧確認や新しい結果保存をDocker回復の終了条件に追加しない。対案は全利用形態の耐久結果保存を新たに要求することであり、保存Owner・最小本文・保持と清掃・再取得入口の設計が必要になる。採用判断前に推奨を正式規則へ昇格しない。

採用済み（2026-10-08）: 人間は用途別の終了条件へ賛成し、Producerのcleanup lifecycleをConsumerのpresentation／任意保存へ依存させないことを明示した。CLI・Workbenchはtransient、Orchestratorはdurable ACKとする。一時回答のProcess終了後再取得は追加要求せず、Candidate・一次失敗・回復義務は別途保全する。Coordinatorは上位File／DBを直接知らず、同じ結果に結合したConsumer ACKを受理する。新しい耐久結果Storeや汎用受領Frameworkは追加しない。

Architecture詳細へ固定対応・資源終端と配送待ちの分離・降格拒否を反映し、QA006の既存`ERB-IT-003`へ通常返却、ACK欠落、降格・登録漏れ、別ACK、応答喪失、Candidate不明と期限到達の反例を接続した。過去の結果・Local Item件数は変更していない。読み取り専用の着手前確認も、正当なtransient利用と登録漏れを区別し、固定組立てだけで方式を決める必要性を確認した。

Sourceは固定対応を`coordinatorConsumerCompletionPolicy`へ集約し、既存の結果登録・decoderのConsumer語彙検査を同じ判定へ接続した。保存形式へ任意policy項目は追加していない。固定三利用側、不正文字列・非文字列・降格object・getter・Proxyの反例を追加し、単体四契約は成功（275.9567ms）。最初の本番型確認は存在しないtsconfig.jsonを指定して停止したが、正規のtsconfig.strict.jsonで再確認し成功した。試験型・整形・警告拒否Lint・差分空白確認も成功した。

保存経路と固定方式判定を合わせた六契約は成功（49,291.643ms、失敗・省略0）。Host／Filesystem／OS Lockは実物を用いたが、上位Reader出口とDocker終端は模擬であり、実Providerの根拠ではない。読取り専用の限定レビューでは方針、固定判定、反例、設計と品質項目の整合を確認した。確認者は試験を再実行しておらず、この結果を完成監査Passと扱わない。

続く接続では、内部Settlement Context生成に既知の利用側を必須とし、非公開Contextへ固定した。同期耐久Readerはproject_runtimeだけ許可し、欠落・未知・降格objectとCLI／Workbenchへの耐久Reader接続を拒否する。既存のReaderなし耐久Contextは受理・終了時に拒否される。型、整形、Lint、差分確認と六契約は成功（40,585.9576ms、失敗・省略0）。読取り専用の限定再確認で追加指摘はなかった。確認者の試験再実行、完成監査または実Provider確認ではない。

この時点の変更はContextへの値固定までだった。続く切替で、本番未採用Draftのoperation-identity/v1へ必須consumerを追加し、既存の固定本文Hash・exact回復ID・不変遷移へ接続した。同じv1識別子のDraftを最新形態だけに更新し、consumer欠落版の補完・互換Readerは追加しない。過去固定試験結果を新版の根拠へ流用せず、旧IDを新Identityへ付け替えない。Settlement生成では保存済みConsumerとの一致を要求する。

既知三利用側、欠落・未知・降格object・余剰policy、Hash再計算を伴うConsumer途中変更、別Contextの利用側不一致を反証した。旧Consumer欠落のstate.json／state.pending.jsonを実Filesystemへ置いた場合も内容を上書きせず停止する。六契約は成功（42,029.5476ms、失敗・省略0）。初回Lintは新試験の非null表明二警告で停止し、明示assertへ是正後に型・Lint・単体四契約を再確認した（334.2325ms）。上位Reader出口・Docker終端の模擬、本番未接続の限界は維持する。

限定再確認では、Identityの閉集合・Hash／回復ID結合、保存Consumer一致、再Hash途中変更拒否と旧保存物の保全停止に追加指摘はなかった。確認者は試験を再実行しておらず、全体独立レビューまたは5C完成とは扱わない。

結果登録も保存Identityへ接続し、必要集合を耐久操作の`[project_runtime]`と一時返却操作の空集合へ限定した。登録入力は期待集合への厳密一致を要求する。decoderと型のpendingはproject_runtimeだけとし、保存操作のConsumer一致、操作ごとに一件・全体64件を要求する。一時返却の空集合は真正終端・固定要約を確認して元Snapshotを返し、新改訂・ACK・配送待ちを生成しない。返却／完了確認済みにはしない。

旧多Consumerの登録正例は正式な耐久一Consumerへ置換し、再登録・ACK保持・空集合降格拒否を確認した。一時返却はpending無し・元byte維持・完了拒否、異Consumer混入はdecoder拒否として検査する。旧Workbench受理不足のWriter反例は、不正な耐久ACK Hashと固定上位Readerの不一致を拒否する反例へ置換した。初回六契約は五成功・一失敗（46,622.7135ms）。保存経路二契約は成功し、失敗は新transient fixtureが要約Hashに対応する履歴を欠いたことによる。実装検査を弱めず既存の履歴候補生成へ修正し、単体四契約が成功した（294.0591ms）。最終型・Lint・差分確認は成功。上位Reader出口／Docker終端の模擬限界は維持する。

限定レビューで、一時返却の完了拒否を確認する試験に、履歴未確認と三Effect不明という別の拒否条件が混在していることを検出した。実装を弱めず、三Effectを既知の未開始・未発行へ固定し、既存の履歴候補生成で履歴確認済みのfixtureへ是正した。配送待ち無しを単独で検査する単体四契約は成功（327.9207ms）。試験型・整形・Lintも成功した。読取り専用の再確認で指摘解消・追加指摘なしとなった。確認者は試験を再実行しておらず、全体完成監査とは扱わない。

次の終了判定は保存Identityと内部Contextの利用側一致をwrapperと更新排他内Writerの両方で確認し、保存済み候補への再入場でも維持する。耐久利用だけexact pendingと固定Owner Readerのfresh ACKを要求し、一時返却はReader無し・対象pending無しに限定する。真正終端、資源分類、Lease解放、Owner無効、固定要約・履歴および元版／候補相関は共通条件とする。整理成功を画面への返却成功へ読み替えず、返却失敗・応答喪失からProvider Effectを再発行しない。着手前の読取り専用確認でこの縮小案との整合を確認し、追加の人間判断は不要となった。Sourceへの終了判定適用は未完了である。

終了候補と限定Writerへ用途別方式を適用した。保存Identityから方式を導出し、wrapper・更新排他内・保存済み候補再入場の利用側一致を確認する。Orchestratorだけ耐久pendingとfresh ACKを要求し、CLI／Workbenchは対象pending・Reader無しで整理する。真正終端、履歴、五資源分類・Leaseと元版／候補相関は共通維持し、一般Writerの除去を許可しない。終了整理を実返却の証明にはしない。

初回Source型確認はoptional Readerへ明示undefinedを渡す型不整合で停止し、Readerがある場合だけ引数Propertyを渡す形へ是正した。既存六契約は成功（38,745.108ms）、一時返却の実Filesystem Writer試験追加後も六契約成功（51,428.1297ms）。保存後の解放確認欠測の反例追加では五成功・一失敗（44,134.6618ms）となった。原因は試験側が初回の読取り排他へ欠測を注入し、意図した更新Writerまで到達していなかったことだった。限定レビューでSource条件維持を確認し、初回一時返却だけ第2解放を注入対象にする是正案へ整合した。

是正後は読取り解放成功・Writer実解放成功／返却確認false・解放回数2・保存確認true／解放確認falseを共同検査し、同じContextの保持候補再入場で成功、別Contextの対象欠落で拒否を確認した。注入はfinallyで復元し、従来の耐久再入場の第1解放注入を変更していない。最新六契約は全成功（46,657.9365ms、失敗・省略0）。本番・試験型、四Fileの警告拒否Lintと差分確認も成功した。Host・Filesystem・OS排他は実物、Docker終端と上位Reader出口は模擬であり、実Providerまたはfresh Processの根拠ではない。

是正後の限定再確認ではSource・Oracleの追加指摘はなく、Architectureの旧「project_runtimeだけ肯定」と全方式fresh ACKの説明に同期漏れ一件を検出した。固定三用途の内部対応と耐久方式だけのfresh ACKへ是正し、本番未接続・模擬境界・fresh Process未確認を維持した。指定二段落の再確認で指摘解消・新指摘0件となった。確認者は試験を再実行しておらず、全体完成レビューではない。

本番組立てへの接続は未完了である。旧上位ACKにはruntimeStateBinding／receiptContentHash／receiptContentIdentityが残り、current-state-storeのdecoderとTask受理処理も一体切替対象である。

OPEN: 本番組立てへの固定方式結合、transient実返却、durable ACKの保存Owner内確認と下位受理、pendingを耐久配送だけへ限定する保存形式・Writerの一体切替。この局所の固定方式判定を本番配送・回収の完了と扱わない。実Docker・Provider・署名・追加の耐久Storeは今回操作していない。全移管後のファイル責務精査前停止は維持する。

### 上位仕事IDと下位実行IDの相関是正（2026-10-08）

上位Task／Attemptの論理操作IDとCoordinatorの実行操作IDが異なる本番経路に対し、結果参照と受理照合が実行IDだけを使っていた欠落を確認した。既存の保存Identityの`recoveryCorrelationId`がある場合にはその値だけを投影・照合し、独立操作で値がない場合だけ保存済み実行IDを使う。実OP、Host／Controller／Writer、終了要約のIdentityは変更しない。別Mapping Storeや新しいACK項目は追加していない。

型検査と四FileのLintは成功した。六契約の初回結果は5成功・1失敗（45,443.8694ms）であり、実Filesystem／OS排他のITは成功した。UTの不正回復ID試験が末尾を常に`0`へ置換していたため、新しいHashの末尾が既に`0`となって無変更だった。末尾を必ず別値へ置換する試験へ是正後、UT四契約は全成功（361.2993ms、失敗・省略0）となった。Biomeの総合checkは既存import整列の三指摘で停止し、Lint成功と形式整列完了は区別する。

読取り専用の局所再確認はSource・Archの必要是正なしとした。ITは異なる実OPと論理IDの正例、および未受理状態での実OP代用拒否と本文非変更を確認した。相関なし独立操作のfallbackはSource上維持したが、今回の追加試験で実証したとは表示しない。本番Producer・上位ACK切替、全回帰・実E2E、完成独立レビューは未完了である。

### 上位受理本文の共通検査（2026-10-08）

Orchestrator coreへ新しい十一項目の`ProjectResultAcceptance`と閉集合decoderを追加し、新結果受理Readerの重複形式検査を置換した。固定Task／Attempt結合と現在保存世代の上限確認はReaderへ残し、旧領収書形式は受け付けない。旧保存型・Application・最終終了Adapterの切替はまだ未完了であり、二形式を最終契約として維持しない。

追加UTは全十一項目の欠落、空値・過長・型不一致、Hash、世代、利用側、旧／余分項目、getter非実行とProxy拒否を確認した。最初の試験はnull prototypeを通常Objectと比較して1失敗となり、値一致とnull prototypeを別に検査して是正した。Orchestrator全UT72件成功（2,393.4897ms）、型・三Fileの警告拒否Lint成功。下位の実Filesystem／OS排他と上位Readerの二ITも成功（47,768.7797ms）した。Docker終端・上位保存Readerの模擬を含む局所範囲であり、実Provider E2Eや本番移管の完了を意味しない。

読取り専用の局所再確認は必要是正0件とした。decoderの形式成立と保存済み受理を区別し、次の保存Owner・Application・finalize切替でも初回世代、fresh読戻し、Repository結合・固定結果ID照合を維持する。全体の完成レビューではない。

### 上位の保存型・遷移・Application切替（2026-10-08）

`ProjectDockerRecoveryAcknowledgement`を新しい十一項目の受理型へ統一し、現在状態decoderとcore遷移へ共通検査を接続した。保存decoderは受理のProject・節目・Task・初回世代を保存状態へ照合する。再実行準備でAttempt／操作IDを解除しても受理本文と初回世代を保持し、保存decoderは過去受理を現在の空Attemptへ無理に一致させない。Applicationは下位の固定五項目結果参照だけから上位受理を構成し、論理操作・回復参照・利用側・Hashを検査する。

局所レビューは、coreがdecoder前に生のtaskIdを読む点と、本番旧ACK消費が新本文拒否より先に記録を変更する点を検出した。coreは検査済み本文だけへ統一し、getter／Proxyの直接入力を呼出し0・blocked・元state保持で確認した。本番旧消費入口は新結果投影接続までEffect前停止とし、旧領収書の消費を新ACKへ補完しない。この停止は移管途中の安全条件であり、成立済みCapabilityまたは完成状態ではない。

最新Orchestrator全UT72件成功（2,328.1055ms）、型と六Fileの警告拒否Lint、Coordinator本番・試験型、差分検査が成功した。保存scope追加後の15IT／STは成功（152,639.5404ms）し、不正Project／節目／Task、未来世代、旧項目の保存拒否と元状態保持を実保存経路で確認した。ただし実行開始後にcoreの生入力是正と本番停止を編集したため、最新候補全体の試験Passへ流用しない。初回のretry-ready追加UTはHost義務のrequired→recoveringを飛ばして失敗し、正規遷移を通るfixtureへ是正した。実Provider、署名E2E、本番Producer・結果投影・最終終了Adapter、旧方式撤去は未完了である。

二指摘の是正後、読取り専用再確認は追加是正0件となった。最新候補で保存・受理・再入場の対象一契約も成功（14,825.9618ms、失敗・省略0）した。ここでは実保存とmock結果投影を確認しており、Effect前停止中の本番経路を完了とは表示しない。

## 段階5Cの固定利用側伝播 — 2026-10-08

通常CLI、Workbench候補、Orchestratorの本番組立てから利用側を固定し、共通Task管理情報→Provider準備→共通実行計画へ接続した。助言はWorkbench固定、開発ProjectRuntime入口は耐久受理用途固定とした。要求JSONや相関IDから方式を推測せず、未知用途を処理開始・Mount有効化前に拒否する。署名Capability消費と唯一の本番開始は既存関数内に維持した。

- Coordinator Source／TestおよびOrchestratorの型検査、変更SourceのLintが成功した。
- 両Provider準備、Workbench候補、共通Taskの局所試験は追加後199件成功。利用側と相関IDの独立性、不正用途時のMount有効化0、Executor／Reviewerの固定値一致と不正用途時のOperation作成0を確認した。
- 読取り専用接続確認は必要是正0。確認者は試験を再実行していない。追加した最後のTask伝播試験は実装者が実行した根拠として区別する。
- 本番開始Identityへの保存、結果参照、Orchestrator受理ACK、最終終了Adapterの一体切替は未完了。局所成功を5C完了、全体品質Pass、署名E2E成功へ昇格しない。

## 段階5Cの計画・開始Identity一致 — 2026-10-08

新Identity組立ての計画型に固定利用側を必須化し、開始Ownerの利用側と一致する場合だけRepository／Hostを借用するよう変更した。両側の欠落・未知値・異用途を真正Owner・正常nonceのまま単独で変える拒否例を追加した。旧本番beginと旧保存処理はまだ置換していない。

Windows実Filesystemの現在状態保存・pending再入場一契約が46,285.0646msで成功した。Source／Testの型検査、変更二Fileの整形・Lintと差分空白検査も成功した。Docker観測・上位Reader等の模擬部分と実Filesystem／排他を区別し、実Provider E2Eの結果とは扱わない。

本番Controllerの接続点を再確認した結果、開始だけを先行切替して旧資源記録へ戻すことはできない。次の処置を同じ保存Ownerへ対応させてから本番切替する。

| 本番の現在接続 | 新しい接続先 | 未接続部分と保持する条件 |
|---|---|---|
| `beginRecovery → beginRuntimeOwnedDockerRecovery` | `saveRuntimeOwnedCoordinatorOperationStart`と`beginRuntimeOwnedCoordinatorHostSubmission` | 本番は旧Owner。Home Lease取得、同じ回復参照、Host要求前保存を一体で接続する。 |
| `markResourceSubmission → markRuntimeOwnedDockerResourceSubmission` | `checkpointRuntimeOwnedCoordinatorResource` | 本番は旧Owner。要求前予定保存と、要求呼出し後の結果不明を区別する。 |
| 本番の`recordResourceNotIssued`は未登録 | `checkpointRuntimeOwnedCoordinatorResourceNotIssued` | 専用保存は局所確認済み。Controllerの元通知を同期callback中に照合し、一般Writerへ迂回させない。 |
| `recordResourceReceipt → recordRuntimeOwnedDockerResourceReceipt` | `checkpointRuntimeOwnedCoordinatorResource` | 本番は旧Owner。exact Docker IDと応答出自を保持し、予定保存だけから受理を推定しない。 |
| Effect側の`inspectReceipts → inspectRuntimeOwnedDockerResourceReceipts` | `readRuntimeOwnedCoordinatorResourceRequests` | Readerは局所確認済み。所有Process停止後に再取得し、旧個別Fileへfallbackしない。 |
| `recordDockerAbsence`・`recordMountCompletion` | 元清掃・Mount結果を照合する`completeRuntimeOwnedCoordinatorHostSubmission`と清掃checkpoint | 本番は旧Owner。booleanの保存を実資源不存在の証明へ置換しない。元結果の搬送と検証を保つ。 |
| `completeRecovery`・`verifyHomeLeaseRelease` | Host通常復帰後の実Lease解放とLifecycle checkpoint | 本番は旧Owner。保存上の終端と実Lease解放を分け、別Repositoryの同じHomeへの競合防止を落とさない。 |
| `prepareRuntimeOwnedDockerHostCleanup`・`finalizeRuntimeOwnedDockerRecovery` | 清掃前に確保した終端Contextと`completeRuntimeOwnedCoordinatorSettlement` | 本番は旧Owner。実Host清掃の確認、旧OwnerのEffect不能、結果配送の保存操作を接続する。 |
| CLI／Workbenchの結果返却 | 固定利用側の一時返却と結果登録 | 本番終了接続は未完了。閲覧・任意保存ACKを要求せず、配送失敗からProviderを再送しない。 |
| Orchestratorの受理・終了 | `acceptRuntimeOwnedCoordinatorProjectResult`と終端整理 | 保存Owner内の耐久ACK確認を本番へ接続する。実OPと上位相関IDを分け、ACK待ちをDocker清掃不明へ戻さない。 |

この表はSource上の置換接続の確認であり、実装済み一覧ではない。新しいReceipt Store、二重保存または互換Readerは追加しない。

2026-10-08の再照合では、Controllerの本番依存集合とEffectの本番Readerが上表の旧Ownerを参照していることを確認した。したがって、新APIの存在や局所試験成功を本番切替済みとは判定しない。切替前に、開始・五資源記録／再読取り・元清掃／Mount結果・Host復帰／清掃・Lease解放・結果配送を一つの保存Ownerで閉じる。開始だけ、または未発行callbackだけを先行して新保存へ接続しない。

切替の先行確認は、同じ認証Homeの排他とProcess喪失後の残存保護である。現在のKernel Leaseが生存Processを排他できることと、Owner喪失後に残るDocker資源を検出できることは別保証である。2026-10-08の着手前再照合では、既存Home Leaseによる生存Ownerの排他と、同HomeのProvider本体の固定名create拒否・失敗後start停止を保持する最小解へ整理した。認証probeはreadonly、proxyとnetworkはHomeをMountしない資源として区別する。この開始拒否を全五資源不存在、一般的な横断回復または遅延旧startの解決へ拡張しない。共有State、Pointer Store、Registryや新Lock Frameworkは追加しない。未再現の遅延旧startは人間判断どおり切替Gateにしない。

本番切替では既存`durableRecords`の値を、元計画・管理Owner・実OP・exact回復参照・実Home Lease・清掃前Settlement Contextへ置換する。旧AppData Root、個別Journal、稼働pointerとそのReaderへのfallbackは残さない。新しいProcess内Storeを横に追加せず、全callbackとEffect Readerを同じOwnerへ切り替える。Host清掃前にContextを取得し、元ControllerとHost結果を終端保存へ渡す。Orchestrator専用の耐久受理Readerは上位組立てから接続し、CLI／Workbenchへは渡さない。新Processの一覧読取りと、実資源回収Authorityの取得は別の接続として検証する。これらは確認済みの実装方針であり、本番切替の完了ではない。

再確認した実Sourceでは、Provider Homeは`ProviderHomes/<provider>`のUser所有共通領域を直接Mountする。Mountの使用中MapはProcess内、Kernel LeaseはProcess生存中の排他であり、どちらもProcess喪失後のRepository横断記録ではない。固定Provider Container名の重複拒否はProvider Home Identityの先頭16桁に依存し、認証Probe・Network・Proxyの名前は試行ごとの乱数である。既存Effectのexact inspectは既知ID・当該試行の所有ラベルを検査するもので、未知の過去試行をHome横断で発見するReaderではない。これらからRepository-local保存だけで横断保護が成立したとは判定しない。

2026-10-08の人間判断: 共有案内File追加は現時点では不承認。認証領域の共用と実行・回復状態の共有管理を分け、新共有State／Registry／Lock／Recovery管理は必要性が立証されるまで実装しない。既存Home／Host排他、資源観測、新規実行拒否による最小解を優先する。旧案を判断待ちとして再要求しない。

再調査では、生存Aは既存Home Kernel LeaseでBを排他できる。同じ物理Homeの残存本体は固定名create競合と失敗後停止でBの本体起動を拒否する。auth ProbeはHome readonly・network none、Proxy／NetworkはHome未Mountかつ試行名分離であり、全五資源不存在や全RepositoryのRecovery一覧をBの開始条件にする必要性は未立証。残存作業領域もBが再利用しなければ容量・Aの清掃義務として分離する。

読取り専用専門確認も共有State追加を推奨していない。残る具体的反証は、旧startが再利用された本体名を対象にすることと、同PathのHome置換で物理Identity由来の本体名が変わることである。既存startは名前指定、exact inspectはMount先とRWを検査するがSourceを照合しない。保存済みexact Container IDへのstart結合、Home Lease下の共用Home使用本体の観測・新規拒否、論理Homeに対する命名安定性を既存構造内の候補として比較する。一回の空観測を遅延create不存在の証明にしない。親喪失・遅延要求・Home置換の実環境挙動は未実測であり、仮説を再現済み障害や新共有管理の必然性へ昇格しない。今回Source変更・Docker／Provider Effect・追加削除は実施しない。

2026-10-08の追加判断: 遅延した旧起動要求が新しい同名Containerを触るという未再現の仮説は、実際に発生した場合に調査する。現時点で先行是正、新しい共有保存、命名変更、追加Recoveryの実装理由にしない。既存のHome排他、計画・所有者照合、create失敗後の停止、既知資源の清掃と一次失敗保持は維持し、5Cの単一保存Ownerへの本番接続を再開する。実際に観測した要求結果不明や残存を成功へ書き換える判断ではない。

再開時の局所回帰では、Source／Testの型検査とController・現在状態保存の計108契約が成功した（69,442.7426ms、失敗・取消・省略0）。実Filesystem保存・pending再入場は68,675.6203msで、Controller内のDocker依存は模擬である。この再確認を新保存Ownerの本番切替や署名E2Eの完了へ昇格しない。直接参照を調べた結果、終了Context作成・結果配送登録・終端整理の新入口にはまだ本番利用側がなく、旧begin・資源記録・Host清掃と一体で接続する必要がある。開始だけの先行切替や旧新二重保存は行わない。

### 段階5Cの正常作成応答の直接確定 — 2026-10-08

本番Controllerの既存順序に対し、新モデルが中間のissued保存を必須化していた接続欠落を是正した。新callbackや保存物を追加せず、正常create応答のexact IDだけを保存済みintentからidentifiedへ直接確定できる辺を追加した。元・先はunobserved、absenceなし、出自はdocker_create_resultに限定する。予定なし、ID欠落／不正、再照合由来、present／unknown観測、absence混入の七反例を拒否する。既存issued／unknown辺と確定IDの変更拒否は維持する。

Source／Test型・二File警告拒否Lint・モデル四契約（298.4759ms）が成功し、固定二Fileの限定独立レビューは指摘0件だった。変更後の実Filesystem二契約も成功（81,710.4074ms、失敗・取消・省略0）。レビューは試験を再実行しておらず、実行根拠と区別する。これは保存候補の遷移是正であり、実create応答の真正性、Controllerから新本番Ownerへの接続や5C全体の完成ではない。次は既存本番Owner内の全callback・Effect Reader・元Host結果・結果配送を一体接続し、開始だけの切替と旧新二重保存を行わない。

## 段階5CのController入口・要求予定保存 — 2026-10-08

Controllerの実行計画に固定三用途の利用側を必須化し、欠落・未知値を回復開始とAuthority消費前に拒否する。資源要求予定の保存は制限確認と直前取消確認の後に置き、保存後にも取消を再確認する。制限拒否、予定保存失敗、実起動失敗はそれぞれの一次失敗段階を保持し、清掃結果で上書きしない。

- Controller103契約が成功。制限拒否対象の要求予定不存在、不正制限時の予定保存0、不正用途時の回復開始0を確認した。
- CLI取消と現在状態保存14契約が成功（49,998.2939ms）。Windowsの実Filesystem保存・pending再入場は49,492.2573msであり、Docker終端観測等の模擬と区別する。
- Source／Test型検査、変更三Fileの警告拒否Lint、局所レビューが成功。レビューは必要是正0件で、試験は実装者が実行した根拠として区別する。
- 意図保存後の取消・未発行終了を新モデルで閉じる処置、Host通常状態への復帰、同じ認証領域の別Repositoryとの競合確認、本番保存Ownerの一体切替は未完了。今回を5C全体、署名E2Eまたは全終了保証の成立とは扱わない。

## 段階5CのMount元完了結果搬送 — 2026-10-08

Host通常復帰はControllerの最終結果生成前に必要なため、最終結果を前提にする循環を避ける。既存Mount Owner内へ成功した元結果の非Authority相関を保持し、Controllerの`recordMountCompletion`へ元結果を渡す接続を追加した。永続記録、新Lock、新回復Frameworkを追加していない。

Mount結果のコピー・null・別管理Owner・別Mount・別実OP・別Home・別isolated Runtime・本番Runtimeへのisolated結果混入・失敗結果は拒否する。同じ元結果の再照合は処置の再発行なしで許可する。Controllerは成功時だけ元Objectを一回搬送し、失敗時は回復完了へ進めない。

関連114契約が成功（2,152.4718ms、失敗・省略0）。Source／Test型検査、変更四Fileの整形と警告拒否Lintも成功した。試験はMount／Controllerの模擬依存を含む局所範囲であり、実Docker不存在や本番保存切替の証明ではない。Host通常復帰・本番保存Ownerの一体接続は残る。

固定四Fileの読取り専用局所レビューは新指摘0件。114試験は実装者の実行根拠として区別し、本番保存Ownerが新照合をまだ利用していないことを確認した。次のHost復帰接続では、元Mount結果と真正五資源清掃の共同前提を維持する。

## 段階5Cの終了Ownerへの元結果搬送 — 2026-10-08

Controllerの回復終了callbackへ、同じ計画・元清掃・元Mount結果を外側だけfreezeして渡す接続を追加した。別Store、Receipt、Lock、Authorityや新しい成功条件は追加していない。旧本番Ownerは追加引数を未使用であり、新保存への一体切替とは区別する。

Source／Test型・警告拒否Lint・差分空白検査が成功し、Controller106契約が成功（2,165.0329ms、失敗・省略0）。追加試験は元objectとOwnerの同一性、外側freeze、清掃不一致・Mount失敗・記録失敗時の終了callback 0を確認した。固定二Fileの局所独立レビューは修正必須0件。模擬清掃を含む搬送契約の結果であり、実Docker・本番保存・別Repositoryの残存保護の成立へ昇格しない。

## 段階5CのHost通常復帰接続 — 2026-10-08

開始と通常復帰のHost遷移を同じ内部予定保存経路へ接続した。通常復帰は保存Identity／計画、元清掃・Mount結果と全清掃評価を照合し、五資源checkpoint確定後に予定保存・実Host遷移・後継観測・確認保存へ進む。元結果の再照合は処置の再発行を伴わず、通常復帰済みの再呼出しは保存前に拒否する。Host領域清掃やHome Lease解放まで成立したとは扱わない。

局所レビューCQ-H01は、先行する清掃保存後にHost観測が失敗すると発行済みFilesystem Effectを返却から失う点を検出した。発行済みEffectだけを後続結果／catchへ単調保持し、保存確認・排他解放・Host確認を成功へ昇格しないよう是正した。固定候補の再確認は新指摘0件。

最新二契約は成功（54,224.0744ms、実Filesystem契約53,728.7218ms）。コピー・nullの結果、各清掃fieldのfalse／欠落／unknown、清掃保存後のHost観測欠測、実遷移前失敗、実遷移後の応答喪失と同じ予定での再入場を確認した。型・整形・警告拒否Lint・差分検査も成功。最初の試験はfixtureの五purpose順序が本番契約と逆で失敗し、正規順序へ是正した。後片付けで元例外を隠さないよう試験所有Hostを正規手順で終了する処置も追加した。

HostとFilesystemは実物、清掃・Mount元結果verifierは模擬である。本番保存Ownerはまだ旧方式であり、真正清掃・Lease・Host領域清掃・最終結果・耐久ACKとの一体切替、fresh Process、5D〜Fと全体検証は残る。

## 段階5Cの資源要求読取り接続 — 2026-10-08

単一現在状態から同じ操作の五資源要求を取得するReaderを追加した。未要求だけをfalseとし、予定保存・発行済み・結果不明はID未確定のまま要求ありを保持する。確認済みexact IDも変更せず返す。Owner、Repository、実操作、回復参照、decode、排他解放の照合に失敗した場合はnullとし、旧保存形式や名前ベース清掃へfallbackしない。

実Filesystem二契約が成功（56,518.2201ms、主契約56,036.522ms、失敗・省略0）。全五purpose×五request、exact ID保持、偽Owner・別回復参照、欠落・重複・不正IDの拒否を確認した。25組の投影試験は自己生成Snapshotを直接配置するReader検証であり、全Writer遷移の実証ではない。Source／Test型検査、整形・警告拒否Lintが成功し、読み取り専用局所レビューは新指摘0件。初回Test型検査では試験のpurpose名誤りを検出し、正規名へ是正した。本番inspectReceiptsはまだ旧Ownerであり、一体切替の完了は主張しない。

## 段階5Cの同Snapshot開始競合 — 2026-10-08

同じ認証領域の未終端操作が残るSnapshotへの新操作追加を、既存の遷移検査で拒否した。元版・次版双方の清掃、Host、Lease、Owner、五資源と回復義務を検査し、清掃済みの耐久ACK待ちだけは開始を妨げない。旧decoderを厳格化せず、旧状態の読取り・回収を維持する。新Store・Lock・Authorityは追加していない。

局所独立レビューのCQ-SH01（元版だけ検査し、同更新で資源義務を戻す候補を許す）を是正し、直接候補の反例を追加した。是正後のモデル四契約が成功（292.036ms）、Source／Test型・警告拒否Lintと差分空白検査も成功した。実Filesystem二契約も是正後に再実行し成功（55,968.2251ms、失敗・省略0）。再レビューは修正必須0件。試験の模擬境界、別Repository・Process喪失後・遅延Createの未確認は維持し、本番Owner切替や実Docker保証へ昇格しない。修正前ITの成功は是正後根拠へ流用していない。

## 段階5Cの要求前取消の元通知 — 2026-10-08

予定保存後の同期取消を、Docker要求の呼出し後の結果不明と分離した。未発行通知は元管理Owner・回復Capability・実操作・exact回復参照・purposeへ結合し、保存callback中だけ照合可能とする。callback終了・例外で失効し、コピー・対象差・isolated通知の本番混入・要求呼出し後throwからの生成を拒否する。新永続保存やGeneric Recoveryを追加していない。

最新Controller105契約が成功（1,872.2345ms、失敗・省略0）。予定保存callback内の取消、対象要求発行0、元通知の同期寿命、保存false／throwと要求呼出し後throwで通知0を確認した。Source／Test型、整形・警告拒否Lint・差分検査も成功し、局所レビューは新指摘0件。初回型検査で試験結果null確認の不足を検出・是正した。本番callback、`not_issued`保存と通常Writer迂回禁止、旧Owner一体切替は未接続であり、未発行処置全体の完成とはしない。

未発行保存の専用入口・通常Writer迂回禁止・終端条件への伝播も局所接続した。最新モデル／実Filesystem六契約が成功（61,790.2942ms、主契約61,233.048ms、失敗・省略0）。予定からだけ未発行へ遷移し、既発行・結果不明の未発行化、再要求と不存在観測の捏造を拒否する。Source／Test型・整形・警告拒否Lintが成功し、固定四Fileの局所レビューは新指摘0件。元通知の肯定は試験内模擬、保存・一般Writer／checkpointからの迂回拒否は実Filesystemであり、本番callback接続の証明と区別する。初回ITは既存Controller差替えのexport不足で失敗し、既存exportを保持して是正した。読取り排他解放欠測を早期失敗結果に保持する反例も追加した。本番Ownerの一体切替は未完了。

## 段階5CのTask元完了・Host清掃結果搬送 — 2026-10-08

各終了Capabilityへ投影前のController元結果を保持し、分類成功したHost元清掃結果とともに既存callbackへ搬送した。新Store・共有State・Lock・回復Frameworkは追加していない。分類不能・例外ではreceiptとfinalizeへ進まず、保存済み清掃予定の回復参照を保持する。protocol failureは清掃確認から正常成功へ変更しない。

Task全161契約が成功（1,647.1846ms、失敗・取消・省略0）。Source／Test型、変更二Fileの警告拒否Lint、差分空白検査が成功した。初回は160成功・1失敗で、WAL有効化後も旧参照を期待した試験を検出した。保存なし・あり双方でexact参照と記録／finalize未発行を確認する試験へ是正した。追加のBiome checkでは既存import順序二件が残り、check全体成功とは表示しない。

固定二Fileの独立レビューはFinding 0。元結果同一性は模擬fixtureを用いた搬送契約の確認であり、実Docker・本番保存Owner置換・5C完成を証明しない。旧本番Ownerは追加引数を未使用で、本番開始・資源callback・Reader・Host／Lease終端・利用側受理・fresh Process再入場の一体切替が残る。

Task二Fileのimport順序は、その後の機械整理で解消した。Source／Test型と161契約を再確認して成功（1,625.4327ms）。既存の搬送レビューと機械的順序変更を区別する。

## 段階5Cの既存Repository借用と助言終了搬送 — 2026-10-08

終端保存の第二Repository結合Capabilityを廃止し、既存管理Ownerの検証済み結合を同じ既存索引から借用する。新索引・Authority・Storeを追加せず、清掃後初回借用拒否と、清掃前Contextからの終端限定保存を維持した。全十一試験呼出しを新引数へ接続した。初回は清掃後Ownerの検証例外を直接漏らして一件失敗したため、既存のcatch済み借用経路へ是正した。修正版実Filesystem二契約は成功（74,643.1035ms）、型・三Fileの警告拒否Lintと固定独立レビューFinding 0を確認した。

Workbench助言の別終了経路にも元Host清掃・元Controller結果の同一性を保持して搬送した。Protocol失敗の清掃確認はblockedを維持し、分類不能はreceipt／finalizeへ進まない。全十三契約が成功（347.9404ms）、型・整形・警告拒否Lintと固定独立レビューFinding 0。元結果検証は模擬依存の局所範囲であり、実Docker終端・本番保存Owner置換の根拠ではない。

Source照合により、fresh Processの回復・一覧・相関・再起動入口はまだ旧AppData Rootを読むことを確認した。CLIの既存検証済みRoot、Orchestratorの既存composition Rootを現在Ownerへ接続し、同じRepository結合・exact参照の新Snapshot読取りへ切替する必要がある。任意Path、旧Root fallback、保存値からのCapability復元や新しい共有管理は追加しない。

## 段階5Cの新Process現在状態読取り — 2026-10-08

既存の検証済みRepository Rootから、操作管理Authorityを復元せず現在状態を読む内部経路を追加した。通常読取りと同じRepository結合Hash、短期排他、保存形式と前後観測を用いる。偽Capability、別Repositoryの保存値、Root差替え、欠落、pendingを空状態へ丸めない。新しい共有State、索引、Lockや旧AppData fallbackは追加していない。

初回の子Process試験は排他取得で失敗した。試験の`--input-type=module`がファイル型Workerへ継承され、`ERR_INPUT_TYPE_NOT_ALLOWED`となることを局所再現した。試験をdynamic importによる起動へ修正し、本番のLock処理・期限・判定は変更していない。修正版の実Filesystem二契約は成功（87,322.6524ms、失敗・取消・省略0）。Source／Test型、対象三FileのBiome check、差分空白検査も成功した。

本確認は新Processでの読取りと拒否境界に限る。本番回復入口への接続、書込み・終了整理、実Docker資源回収、5C完成を証明しない。固定三Fileの独立レビューはPass、Finding 0、確信度は高。開始／終了Hash一致を確認した。Repository Ownerは`1db660f56098b5b99a77329786736992b17d58c709502b313f9359226f5267ce`、State Runtimeは`97798544c0704ca6ba42cbd8d0d96f9d908c52dc362ed0ab07344c6361566ce7`、ITは`aebddb8b5bf7383ab94748797a070e902bfd190366b16df16da52b734d8ddbc7`。実子Processの肯定は初回・空操作集合の読取りであり、資源回収や操作復元の根拠ではない。

## 段階5Cの本番下位計画への利用形態伝播 — 2026-10-08

本番下位保存Ownerの`ProductionPlan`と開始判定に必須利用形態が欠けていたため、既存の固定三用途を型・実行時判定へ伝播した。新Identity helperだけのintersectionを撤去し、同じ計画型へ統一した。helperの第四引数と計画内Consumerの一致条件は維持する。欠落・未知値をCLIへ自動補完せず、Provider Home／Runtime State観測前に拒否する。正常な試験計画と実子Process fixtureには利用形態を固定した。

環境観測を差し替えた局所二契約は成功（390.3617ms）。他項目が有効な計画のConsumerだけを欠落、null、未知文字列、数値、object、booleanへ変更し、本番入口のnull拒否と観測0を確認した。Controllerと両Providerの関連141契約も成功（1,939.6799ms、失敗・取消・省略0）。Source／Test型と対象三FileのBiome check、差分空白検査は成功した。初回型検査で試験fixture一件の必須項目欠落を検出・是正した。

回復契約File全体の114契約も成功（138,467.0778ms、失敗・取消・省略0）。実Filesystemと独立Processの回帰を含むが、Docker runnerは模擬であり実Docker E2Eの根拠ではない。固定三Fileの限定独立レビューはPass、Finding 0、確信度は高。開始／終了Hash一致を確認した。Sourceは`212a85ad88da9e0013823cdc0d9ddac1f13883d68e1faec7191524dd0f724986`、ITは`01931c7f36bfafc5050905d41101584507719802d10bfb32864833bc4fb45af0`、fixtureは`1ece605532341d0bd2b5d29d0c13607f74f3e9c3b96b0020659524095e5a58e7`。これは下位計画の欠落補完であり、旧保存方式の切替、新しい共有管理、Home Lease／回復ID／Journal契約の変更、5C全体完成ではない。追加の人間判断はない。

## 段階5Cの元一次失敗の終端搬送 — 2026-10-08

既存Controllerの終端観測へ、清掃前に固定した`primaryFailure`の元objectを保持し、同じ完了結果・管理Owner・実OP・開始時回復参照だけへ返すよう接続した。公開結果、終了条件、登録条件は変更しない。五資源の検証済み観測がない経路は従来どおり未登録であり、診断搬送を資源回収成功や全失敗経路の保存成立へ読み替えない。

正常時nullと十失敗×三清掃条件の同一性を確認し、Controller全106契約が成功した（1,805.1364ms、失敗・取消・省略0）。追加試験の初回は完了公開結果の空回復IDを借用へ渡して失敗したため、開始時の元IDを使う試験へ是正した。本番照合は緩和していない。Source／Test型、二Fileの整形・Lintと差分空白検査も成功した。

固定二Fileの限定独立レビューはPass、指摘0件。開始／終了HashはSource `995ba2f61ee8549fa9a2e0f9bc2a5bd93b4c77b310db9e95c2be9c5ff438c72c`、Test `0fbdd70adca2cecbf8a04ab71ef070161a451a77a8bd1cbe74c264fed666b346`で一致した。レビュー者の試験再実行、実Docker、本番State Writer接続または5C全体の完成は主張しない。次は既存本番保存Ownerの全callback・Reader・Host／Lease終端・用途別結果配送の一体切替である。

## 段階5Cの終端保存と元一次失敗の照合 — 2026-10-08

終端Writerで、保存候補の一次失敗を元Controller観測の全七項目とnullへ照合した。元観測がない場合は前版診断からの変更を拒否し、診断を変更しない既存保存は維持する。元Controller診断の初回保存肯定、診断欠落と七項目それぞれの改変拒否・保存本文不変を実Filesystem試験へ接続した。Architectureの診断接続へ契約を反映した。

Source／Test型、整形・Lint、差分空白検査が成功し、実Filesystem二契約も成功した（79,408.2995ms、失敗・取消・省略0）。初回は負例の別理由がモデルの固定語彙外だったため、Writer到達前に拒否された。有効な別理由へ修正して、Writerの真正照合で拒否されることを再確認した。固定二Fileの独立レビューはPass、指摘0件。開始／終了HashはSource `97dec02baaf578cfdebddfa0a4a2f96e87a49d47cb85798a0b0a20612819fbba`、Test `68b7f8ada3776627ed4f04b587968720359a0088ba4430721f6c84541b39cafd`で一致した。元Controller観測の肯定部分は模擬であり、本番Owner一体切替・実Docker・5C完成とは区別する。

## 段階5Cの終了処理接続と固定根拠の再入場 — 2026-10-08

既存Writerを使う終了driverを追加した。元Controller／Host観測から終端保存、履歴固定・公開、用途別配送へ進み、Orchestratorへの返却前にはACKを待たない。各保存失敗の理由・確認fieldと累積Filesystem Effectを保持する。完了後の再入場は同Contextの既存完了候補だけを利用し、記録不存在から成功を推測しない。本番Ownerからの呼出しはまだ未接続である。

独立レビューのCQ-DRV01は、固定済み不存在根拠のHashを再生成して全byte比較する誤拒否だった。既存履歴契約と同じ資源request／ID／観測の意味比較へ是正し、固定根拠を保存し直さない。CQ-DRV02は追加FixtureのID出自欠落で、試験側のreceiptSourceだけを補った。途中の二回の試験失敗はいずれもFixture前提不足であり、Sourceの検査は緩和していない。

是正後は型・整形／Lint・差分空白検査と実Filesystem二契約が成功した（63,225.926ms、失敗・取消・省略0）。固定済みID付き不存在資源のdurable再入場、別ID・不明観測拒否、transient完了後再入場と偽／fresh Context拒否を確認した。限定再レビューは新指摘0件、Source `b5c3fce12fa632c263e525726e09e4aebed84a8dd502cfc9ddfdd7d2201797fb`、Test `1ee6e4ccfe4c69045eb0e16fe0d493642ea89e553926250ad160a11e5c8a9e55`。Docker終端は模擬であり、driver初回全経路、本番Owner一体切替、実Docker、5C完成は未確認として残す。

### 終了driverの初回接続確認 — 2026-10-08

未固定の既知終端Fixtureから、終端保存→履歴固定／公開→用途別配送を一回のdriver呼出しで確認した。CLI／Workbenchは一履歴行を残して操作・配送を除去し、Orchestratorは未受理配送と結果参照を返す。返却前のACK Reader呼出し0、同Context再入場で現在本文・履歴不変、コピーContext／Host／Controller結果の拒否を確認した。

初回は、前段で回収済みの履歴FileへのunlinkがENOENTとなった。ENOENTだけを不存在として処置する試験準備へ是正した。次に、同じ管理Owner・回復IDの確定履歴を未固定化して別時刻で再作成するFixtureが既存の履歴相関条件に拒否された。初回試験専用の世代・IdentityHash・exact回復IDを清掃前Contextと終端Fixtureへ固定して是正した。Sourceの再追加防止・保存条件は変更していない。

最新の型・整形／Lint・差分空白検査と実Filesystem二契約が成功（109,026.4804ms、失敗・取消・省略0）。限定Source／OracleレビューはPass、新指摘0、Source `b5c3fce12fa632c263e525726e09e4aebed84a8dd502cfc9ddfdd7d2201797fb`、Test `612c2f0f5071f3994e6ed18631326bdb9b81ce9c7e568f51800225ce3263343a`。これは模擬Docker終端からの初回接続確認であり、本番発生点の実行評価、全callback・ReaderのOwner一体切替、実Docker、5C完成は引き続き未成立である。

### 固定資源の受理後終了と本番接続の残件 — 2026-10-08

完了Writerにも、再生成した不存在根拠Hashを固定本文と全byte比較する誤拒否が残っていた。資源のrequest／Docker ID／観測の意味を照合し、固定された根拠Hashは上書きしない処理へ是正した。正式ACK不足時の状態保持と、同じ結果IDのACK受理後に操作・配送を除去する追加試験を含め、実Filesystem二契約が成功した（89,573.0115ms、失敗・取消・省略0）。型、整形／Lintと差分空白検査も成功した。限定独立レビューは必須指摘0件、Source `23139904f64d43fd2c8538ea6aee542c8dc4498c9680503d69b8991a9bcac2b4`、Test `3f8d957854968d92f72b60d86274f2902257704086a62487cab3e32bf3dfed5a`。Docker終端は模擬であり、本番接続の成立根拠ではない。

追加の負例は、正式ACK保存後の完了入口へ別Docker IDと観測不能を与え、両方で処置なし・保存本文不変を確認した。元のIDと不存在観測へ戻すと完了できる。追加後の実Filesystem二契約は成功（94,333.1461ms、失敗・取消・省略0）、試験の型・整形／Lint・差分空白検査も成功した。追加ITの限定独立確認は指摘0件、Test `09ad59d4df74942cbf85a04a221692655c9ed2e634307fd183f7ee7d2a9aa42f`、Sourceは直前と同一である。

本番切替では、次の既存経路を一体で変更する。新しい共有State、Registry、Lockまたは回復Frameworkは追加しない。

| 現在の本番経路 | 最新形式への処置 | 維持する条件 |
|---|---|---|
| Docker開始OwnerのAppData観測・操作別記録 | 検証済みRepositoryと実操作Identityから単一現在状態へ保存する。 | 実Provider Home排他、初期Host、同じ操作・回復参照、保存失敗時の停止。 |
| submission／receipt／absence／mount callback | 要求・受理・終端の実発生点を同じ現在状態へ接続する。 | 未発行と観測不能を分け、起動通知から外部送信を推定しない。 |
| Task／助言のHost清掃・旧finalize | 元ControllerとHost結果で既存終了driverを呼ぶ。 | 清掃をACK待ちにせず、元の失敗・資源ID・Lease解放根拠を保持する。 |
| Orchestratorの受領・終了整理 | 既存の実行閉包で元Contextを保持し、保存済み上位ACK Readerを受理・完了へ接続する。 | 文字列IDからContextを復元せず、Coordinatorから上位保存Ownerへ逆依存しない。 |
| 新Processの回復・相関・再起動入口 | 検証済みRepositoryの最新現在状態だけを読む。 | 読取り成功を回復成功と扱わず、旧Readerへfallbackしない。 |

本表の作成時点では、Orchestratorの受領入口が`project_runtime_result_acceptance_not_connected`で停止し、終了整理にも旧領収書の処理が残っていた。Docker開始Ownerの置換状況は次節に記録する。本表全体は未完了の切替対象であり、5C完了・旧方式廃止済みとは扱わない。

### 本番開始・通常終了Ownerの置換 — 2026-10-08

本番開始Ownerを、実Provider Home排他→固定Identity→Repository内開始Snapshot→清掃前Context→Host開始へ置換した。旧開始の操作Directory、active pointer、追加RuntimeState排他と旧Observer試験入口を除去した。既存のProcess内Owner保持を最新Contextへ置換し、別Registryや新しい共有Stateは追加していない。

本番submission／receipt／absence callbackは同じSnapshotへ接続した。要求前取消の真正通知も本番callbackへ登録した。通常終了は元計画・元Docker清掃・元Mount結果でHost復帰を確認し、実Lease解放を確認してからHost清掃へ渡す。元Host結果と元Controller結果を終了driverへ接続し、transientとdurable pendingを区別する。これは切替中のSourceであり、上位ACK Reader、実行評価の全発生点、新Process回復入口の置換を完了していない。

Source型・三Fileの整形／Lint・差分空白検査は成功した。Controllerと最新状態の局所回帰は108／108成功（89,618.394ms、失敗・取消・省略0）。実Filesystemは使うがDocker終端は模擬であり、実Docker・外部AI・署名Effectは発行していない。独立確認対象はSource `14167383608397b2046e16cb6537ce668ce38b68874573952658322ecc193430`、公開接続 `7b9904b7bf51e312c2be60074471d2414f8c027223e36948cf5b7c0921440d64`、Controller `85bb316ac0e1e5c163401c3b118eef40d67d1c5fcb75d69f350e31b9adecf9e5`である。

試験全体の型検査は未成功。旧Observer入口を使うFixture／回復試験、元結果を渡さない旧呼出しと資源辞書の型境界に移行残件を検出した。旧入口を復活させたり任意引数で旧成功を再現せず、新形式の前提・元結果へ試験を移行する。局所108件の成功を旧試験移行・全5C・全回帰の成功へ拡張しない。

### 本番終了Ownerの失敗再入場 — 2026-10-08

固定した三Sourceの独立確認は要是正となった。必須指摘は、開始保存失敗時のLease Owner保持（CQ-5C-Q01）、Host復帰後の後続失敗で復帰を再要求する経路（Q02）、一回限りのHost清掃Capability消費後の保存失敗（Q03）、終了driver失敗時の元結果喪失（Q04）の四件である。新しいMap、保存領域、Lock、Schemaや旧形式fallbackは追加せず、既存Owner内の元入力と進行状況を保持する。

Q04のSource是正は限定再確認で成立した。既存終了Contextが真正Host／Controller結果を確認して元objectを固定し、不正入力は固定せず、固定後の差替えを拒否する。本番Ownerもdriver呼出し前に照合済み元入力を保持し、保存途中の停止結果を失わず再入場へ渡す。Source型・対象三Fileの整形／Lintと差分空白検査は成功した。実Filesystem二契約は成功（84,709.3338ms、失敗・取消・省略0）。限定再確認のSource追加指摘は0件、state-runtime `8d31510273647dd935de1bd9de97f16b5856ffb2a65ec438824bd909fdd5d6c2`、internal `0b9a780eff4bef998066097c2e9c4d2725eb13282c3756efb7282489fca0334e`、IT `198d4a39c8051ee233e32c7acaba890f2079c9ed8afb9601f8de43aa7792e49d`である。

二契約にはcaptureの真正入力・コピー拒否を追加したが、本番receipt入口→driver部分保存後の停止→同Capabilityのfinalize再入場を共同観測する反例は不足する。Q04の本番失敗試験、Q01〜03、旧試験移行、実行発生点、上位ACKとfresh回復入口は未完了であり、全5Cの完成根拠にはしない。

### 復帰後と清掃予定保存の再入場 — 2026-10-08

Q02は、真正Host復帰成功を同じOwnerへ元入力・固定Identityとともに保持した。後続保存失敗からの再入場では実Hostの`host_only`と現在token・保存Identityを再照合し、復帰を再要求せずLeaseと後続保存へ進む。清掃開始後のcomplete再要求は拒否し、清掃Capabilityを再発行しない。Q03は、消費直後の元tokenと固定pending候補を既存Ownerへ保持し、再消費せず既存Writerで同候補を再確認する。保存・読戻し・排他解放の共同確認前にはCallerへtokenを返さない。

限定Source再確認は追加指摘0件、internal `0238b6f10f4d58b64e045de653e9e4d17864c046f8dcaaf15420ee6ad6d2ef68`。新しいMap、Store、Schema、Lockを追加していない。既存Writerは元版のrevision／payloadHashとpendingのexact候補本文を排他内で照合するため、古い候補を別版へ上書きしない。

本番Owner入口を直接呼ぶ局所反例試験を追加した。下位のHome、Host、保存Writerと終了driverは模擬である。Host復帰後のLifecycle保存失敗からの再入場で復帰・Lease解放各一回、清掃開始後のCapability再発行なし、token消費後の保存失敗で未返却・同候補再入場・再消費なし、終了driver停止後の元入力／Effect保持と差替え拒否を確認した。対象の整形／Lint・Source型・一契約が成功（442.0869ms、失敗・取消・省略0）。Test `bde59b7bc880d78ebe2d7353bd1fd5d0f718c686bdac192e0d18d275dfcffe2b`。全試験型検査は旧入口・旧呼出しの移行残件により未成功で、新規試験の型エラーはない。

Q01の開始失敗Owner保持、実Filesystemでの出版後応答喪失／解放欠測／別pendingの共同反例、全本番接続は残る。局所模擬試験を実境界・全5C完成の証明へ拡張しない。

### 開始失敗時のOwner保持と試験接続 — 2026-10-08

Q01は、固定Identityと回復参照を導出した後、開始保存前から既存OwnerへLease、Identity、元保存結果、失敗理由と解放確認を保持する処理へ是正した。Context未準備・Host開始未成立のOwnerは通常処置から拒否し、保持済みLeaseを扱うabandonだけが再確認する。解放のfalseや例外を成功へ丸めず、元の開始失敗を消さない。

限定Source再確認は追加必須指摘0件。internal `6986cd5caf1c73483e3ca6b7e6453f3e171ce276f465da22067473d7c33b8cc9`、Test `9388ca33bfb61283da22c1a273a229eb22116f6827bc3dfc78020b3ebadf580f`、Symbol `fca0c9710a93160c62c164c44bcc0be14bc5b5d31d90c512158d5aa81fc1355d`、Catalog `6660b13cf249592ec3463bdfbdd336e82cd06ef0c8325a66f220e8095945ea1a`。Test Headerを固定Test形式へ是正し、Catalog／Symbolを各exact一件、QA-000006／ERB-IT-003へ登録した。通常portable起動でもModule mockを使用できる構成へ接続した。Source型・対象Lint・局所一契約が成功（427.7669ms、失敗・取消・省略0）。

開始保存失敗／Context準備失敗とLease解放不明から、同じCapabilityでLease解放を再確認する反例を追加した。Host開始0、開始未成立Ownerの通常処置拒否を確認したが、下位は模擬であり実Kernel Leaseの解放成立ではない。終了driverの模擬結果は毎回Filesystem Effectありで、返却fieldの搬送を確認する。初回Effectを後続のEffectなし失敗へ累積する反例とは区別する。

Caller未接続も確認した。Controllerの既存停止結果Readerは三fieldだけを許し、Capability付き開始停止を不正Identityとして元理由を置換する。Owner内保持だけを本番完成とは扱わず、真正な初期化停止の照合・元理由・Owner寿命をCallerへ最小接続する。固定Identity確定前の失敗、実Filesystemの部分出版・別pending・解放欠測、旧試験移行と全本番接続も未完了である。

### 開始停止のCaller接続と局所確認 — 2026-10-08

Controllerの停止Readerへ、固定Identity確定済みの元Owner・管理Capability・Home・回復参照・元失敗理由の照合を接続した。照合済み停止は元理由の既存安全分類と同じ回復参照を返し、清掃未確認を維持する。公開結果の寿命へ既存Ownerを結合するが、処置入口は元Capabilityとのobject一致を必須とし、結果aliasからの処置を拒否する。新しい共有State、Registry、Lockは追加していない。

Ownerの偽造・別回復参照・管理Owner差替え・別Home・別理由・公開結果aliasを拒否する反例、およびControllerの照合成功／拒否／例外／未接続を追加した。対象整形・LintとSource型検査、Controller＋本番Owner模擬境界の108契約が成功（2,226.2511ms、失敗・取消・省略0）。公開結果に内部Capabilityを含めず、Docker要求0を確認した。下位のOwner、Host、保存境界は模擬であり、実Docker・実Kernel Lease・全5C完成を証明しない。

限定独立レビューは二指摘（CQ-CALL-Q01: 五field停止の三fieldへの降格、CQ-CALL-Q02: 二段目結合の失敗見落とし）を検出した。キー集合からOwner必須形を固定し、欠測・accessor・manual未成立を拒否した。停止結果を先に生成し、真正照合と寿命結合を一回で行い、確認後だけ清掃処置へ進める。追加反例を含む同108契約が再成功（2,220.2853ms、失敗・取消・省略0）、Source型・対象Lintも成功した。是正後の独立再レビューは実施中である。

別途、Docker Effect試験の欠落Receipt負例をRuntime検査へ渡す型境界を明示した。負例の入力と判定、本番Sourceは変更していない。Effect局所20契約は成功（5,135.9511ms、失敗・取消・省略0）。全試験型検査の残件は旧回復入口と呼出しを持つ二Fileの18件で、Caller／Owner追加試験には型エラーがない。

是正後の限定再レビューはPass、CQ-CALL-Q01／Q02解消・追加必須指摘0件である。固定対象の始終HashとHEAD `3ea50c54f72127d1cfcccacd6591e0912beb5b06`が一致した。Controller `7e2d878719c4eda12b3ba56b088e8e26b9d1aa281f4fd7cb58370aabebfd6d15`、internal `c3e122ef76c0cf12d1d030d104833adf782e7e844c5459c13968cce58262dae2`、facade `3001a0e64eed027d1d0c0f9adde35c4b9ba249545f9dd77dfbc99c8a84fd6120`、Controller Test `e4779e49d9a0c8ee9c7ee4e169395dc1966c423d92c85919d84ee034eb75616b`、Owner Test `8bc525687a852a8d7919d0b99f65b711822bce3ca3919c52d55184f3fea13029`。確認者はSource／Oracleを読取り確認し、108実行結果は担当実行根拠として受領した。

実Filesystem共同反例、実行評価の発生点、上位ACK Reader、新Process回復入口および旧形式試験の移行は残る。全試験型検査・全回帰・署名E2Eは今回の結果へ含めない。

### Host開始停止の追加反例 — 2026-10-08

通常終了条件の判断待ちとは独立して、既存初期化OwnerのHost開始停止を模擬境界の反例へ追加した。元のHost停止理由、同じCapabilityと回復参照の照合、未初期化Ownerの通常処置拒否、Lease解放falseからの同Owner再確認、公開結果aliasの非Authority化を確認した。Host開始要求は初回一回で、Lease再確認時に再発行しない。下位Hostは処置前停止を模擬し、実Hostの部分成立・応答喪失を証明しない。

Sourceは変更せず、対象Testの整形・Lint、Source型、一局所契約が成功（406.2272ms、失敗・取消・省略0）。追加Oracleの限定独立確認はPass、追加指摘0件。Test始終Hash `5be26c20dfb791e5e2dfd28bf1f2a1de1308ac03abe553ab5137659628b1a6b5`は一致し、Source三Hashも前回固定版と一致した。通常終了Gate変更、実Docker、fresh Process、全5C完成へ根拠を拡張しない。

### 実行評価と通常終了Gateの不整合 — 2026-10-08

状態: 人間承認済み・限定実装／独立確認済み。2026-10-08に、過去unknownを履歴へ保持し、現在回収完了と分離して通常整理する限定方針が承認された。以下の不整合表は是正前の調査結果であり、現在の実装結果は末尾に示す。

| 確認した事実 | 現在の影響 |
|---|---|
| 本番Controllerが確認する開始通知は、attached実行用Docker CLIのOS Process開始である。 | Container内AI開始やProvider通信受理へ昇格できない。 |
| 現在の実行評価は開始前の初期値から本番発生点へ未接続である。 | 初期値のままの局所成功を過去Effect不存在の根拠にできない。 |
| `prepareCoordinatorStateCompletionSnapshot`は`providerStart / externalSend / sharedWrite`のいずれかが`unknown`なら通常整理を拒否する。 | 観測限界を正しく保存すると、資源回収済みでも現在状態が残り続け得る。 |
| 通常履歴確定と配送登録のGateは、この三fieldのunknownを拒否していない。 | 履歴・配送と最終整理で終了条件が不整合である。 |
| 終了要約と履歴行は一次失敗・結果・Host清掃・Leaseを保持するが、この実行評価を保持しない。 | 整理条件だけを緩めると、過去に不明だった事実を失う。 |

最小修正案は、過去の実行評価と現在の資源終端を分離することである。過去の三fieldはunknownを維持したまま終了要約へ保持し、正常Task成功・要求未発行へ書き換えない。現在状態の整理は、元の真正終端結果、五purposeの既知IDと明示的な不存在、Host清掃、実Lease解放、旧OwnerのEffect不能、履歴確定、用途別の受領条件をすべて維持する。ID未確定Create・要求結果unknown・資源観測unknownは従来どおり通常整理を拒否する。Provider本体起動前の限定unknown終了Classは変更・一般化しない。

この案は単なる型修正ではなく通常終了条件の意味を変更するため、人間の採用判断と変更後の独立確認を必要とする。採用後に、最新Draftの履歴Schema、実行checkpoint、通常完了Gate、反例試験を同じ意味単位で変更する。旧履歴への恒久互換Readerは追加せず、移行はフロントAIが行う。新しい共有State、Registry、Lock、回復FrameworkまたはProvider内部観測機構は追加しない。

必要な反例は、過去unknownの保持、現在資源unknown／ID未確定の拒否、元Task結果と一次失敗の不変、履歴未確定の拒否、Orchestrator未受理の拒否、要求前取消と要求後停止の区別である。

読み取り専用計画照合は完了し、既知資源をすべて回収した通常終了に限定する候補として整合を確認した。ただし「過去の書込み有無が不明」と「現在も残る未解決の書込み影響」を区別する人間判断が必要で、後者の終了を許可する案ではない。要約固定後の実行評価変更は旧要約Hash・旧ACKを流用せず拒否する。新操作の競合Gate、一般更新による操作除去禁止、unknownの未発行化禁止、限定Create不明終了Classは変更しない。最新履歴Schemaへ切替え、旧ローカル内容はフロントAIの移行対象とする。

現行モデル四契約を再実行し、3field unknownで通常整理を拒否する現在のOracleを確認した（347.9401ms、失敗・取消・省略0）。最初の静的確認で既存import順指摘一件を検出し、import順だけを修正後、対象Lint・Source型・同四契約を再実行して成功した。現行の拒否を修正後の正しさとして流用しない。通常終了Sourceの意味変更・実Docker・全5C完成の証明ではない。

承認後、終了要約を`crdd-coordinator/operation-summary/v2`、履歴行を`crdd-coordinator/history-row/v2`へ切替え、実行評価の五fieldを元の結果・一次失敗とともに保持した。通常整理から除いたのは過去三fieldのunknown拒否だけであり、Create結果、ID、資源観測、Owner、Host、Lease、履歴と用途別受領条件の確認は維持した。整理前に要約を再導出し、固定後の評価変更に旧HashやACKを流用しない。旧履歴Readerは追加していない。

モデル四契約が成功（335.2924ms）、実Filesystemの現在状態保存／pending再入場と同じAttemptの上位受理Readerの二契約が成功（93,648.315ms）。いずれも失敗・取消・省略0。Source型と対象Lintも成功した。実Filesystem試験は自己生成対象を使用し、実DockerやProviderへの依頼は発行していない。

限定Source独立レビューはPass、追加必須指摘0件。モデルSourceの始終Hashは`f2c7d9ab16f542204a38410c0947c3e991255f09790a42cb6ef33bc1d0e589d2`で一致した。関連固定HashはUnit `27ee959b6761719aa947504b8128e8db2aaa3bf53e61f0803d95aeea925a65ca`、Integration `e321fbb82dc1673bade3a864d647d27434b2e74ce989f294cfe0fb98c02a71d1`、Architecture `ecf8a93d71aa1863f678977853e8f9fe21d7a7e17086ca7538fe571cae6773d0`。現在も残る未解決の書込み影響の不存在、実行評価の本番発生点、fresh Process回復、上位ACKの本番接続、全5Cまたは実Docker E2Eは、この限定Passの対象外である。

### 実行評価の発生点への本番接続 — 2026-10-08

既存ControllerのProvider開始要求直前へ、同じ操作・回復参照の同期評価保存を接続した。既存の短命通知集合に用途を加え、資源未発行通知とProvider要求前通知を相互流用しない。既存Ownerは元通知を照合し、初期三評価だけをunknownへ進め、既知評価と他のlifecycle値を保持する。保存確定・排他解放が未確認なら要求を発行せず、保存後の同期取消でも要求を停止する。保存済みunknownは未発行へ戻さない。新しいMap、共有State、Registry、Lock、Provider内部観測機構は追加していない。

Controller／Ownerの局所109契約が成功（1,968.5619ms、失敗・取消・省略0）、Source型・対象五FileのLintと差分空白確認も成功した。追加反例は保存拒否・例外・再入取消・要求例外・spawn失敗、通知コピー・別操作・失効、保存確認・排他解放不明、既知評価保持・要約固定後拒否である。実行にはNode v24.19.0の`--experimental-strip-types --experimental-test-module-mocks --test`を用いた。標準出力はTool実行記録に保持し、この文書へ全文複製しない。全試験型検査は旧回復入口と呼出しを持つ二Fileの18件で停止し、新規変更の型エラーはない。

限定Source独立レビューはPass、追加必須指摘0件。始終HashはController `0cf683e6a7f036fe07df60322017fab28c6ba14dcd6ccab2f4469dd0db1eceff`、内部Owner `7a7f80e58c918b0915664f0ba37869748da61090341309b6c3966ff9be83bdd4`、公開接続 `171d72a367a0b7520ab22572d4f0a99b34a777d66687183ae98d6aac7ce70f83`、Controller試験 `90e55c0a6677717218ed28b951af7e710ed5b17f628243a38f7c7b39e753bb13`、Owner試験 `d2ed836e3a79c729f044b05ecb8528d14b511074f0e8180dc3805963302477b2`、Architecture `e85099f7d677e6746ad2562abc8e1f29058fb24bf051b6a45f0b21a35aee8187`で一致した。

Ownerの通知照合と保存は模擬、Controllerの通知相関はisolatedで確認した。Windows子孫Processの取消試験は実Processを使用したが、Docker清掃は模擬である。実Dockerでの本番Controller→本番Owner→物理Writerの一体接続、現在残る共有書込み影響、fresh Process回復、上位ACKと全5Cは未成立である。外部Provider依頼、Docker起動／再起動、署名は発行していない。

本番Module接続後のモデル／実Filesystem回帰も六契約すべて成功（77,679.2622ms、失敗・取消・省略0）。実Filesystem保存・pending再入場と同じAttemptの受理Readerを再確認したが、Docker終端は従来どおり模擬であり、上記の未成立範囲は変わらない。

### 耐久受領Readerの同Process結合 — 2026-10-08

清掃前に保持した元の終端Contextへ、固定Orchestrator Readerを一度だけ結合する内部接続を追加した。真正Context・同じexact回復参照・`project_runtime`だけを許可し、同じ関数の再入場以外の差替えを拒否する。結合自体はReader、保存、Docker処置を実行せず、ACK成立を作らない。新しいState、Map、Registry、Lockは追加していない。

Source型、対象二FileのBiomeと差分空白確認は成功した。全試験型検査は既知二Fileの18件で停止し、新規型エラーはない。限定Source独立確認はPass、必須是正0件。始終HashはSource `bc70f18695174f644b1cc72f02abe2ac3a9d00f181eaa913ed1487d61f311b4b`、最新試験 `2482cc5b2226da95fa9a865b25b24d39c88c426f135f5f01aab1d3a4f98354fe`、Architecture `7be41624d8d6b9a8307284aaef273582c0b339ed6350e0d698633c770b7f1f44`で一致した。最新実Filesystem二契約は成功（75,292.5149ms、失敗・取消・省略0）。後結合でも受理時にACKを二回fresh照合し、同じ本文を保持する正例、null ACK時の保全、偽Context・別参照・差替え・非関数・一時返却Consumerの拒否を確認した。Docker終端は試験内模擬であり、実Provider依頼は発行していない。

次の本番接続には、Task完了時に破棄される制御参照と、既存Docker終了Ownerの寿命を接続する必要がある。公開回復IDから新Capabilityを作らず、元Taskが保持する終了Ownerで固定結果参照の取得、上位ACK保存・読戻し、同じ真正終端による整理を行う。現在のOrchestrator組立ての未接続停止と旧領収書finalizerはまだ置換しておらず、本番ACK、fresh Process回復、全5C、実Docker E2Eの完成は主張しない。

## Checklist





- [x] 全18領域を一次対応表へ処置した。
- [x] 常駐性、責務、保存場所、意味Owner、Package境界を区別した。
- [x] Source／bin、scripts、testsの直接参照を分けた。
- [x] Workbench AI14FileとProject Runtime接続19Fileを対応させた。
- [x] 公開入口化だけの最小代替と、循環依存の反例を確認した。
- [x] 読取り専用着手前確認の結果を計画へ反映した。
- [x] 全18領域のPackage境界と親フォルダ名を再評価し、統合・改名・維持を区別した。
- [x] 統合後の用途別公開入口、技術基盤、保存Ownerと依存拡大の反例を説明した。
- [x] 追加の読み取り専用確認を反映し、新Package追加を分類だけで採用していない。
- [x] 最新の名称指定・名称候補・改名保留を区別し、旧推奨名と旧Port注入方針を置き換えた。
- [x] Orchestrator → Coordinatorの直接依存、単体利用、公開APIと登録ハンドラーによる通知の責務を記録した。
- [x] AI固有差をai-adapterへ分離し、Profile管理・共通実行・実行記録のOwnerを区別した。
- [x] 三領域のdomain-model統合と責務別構成を反映し、runtime-dataを共通置場として残さない。
- [x] CRUD・保存とGit確定・公開を分け、Root型移管による逆依存を避ける方針を記録した。
- [x] Nativeは既存検査を維持した内部整理とし、保存汎用化や即時移管を必須にしていない。
- [x] Profile管理をai-adapter内部へ統合する最新指定を反映した。
- [x] Shared Serverを共有配置として再評価し、二入口の目標とREST／Gateway撤去前の八観点を明記した。
- [x] Workbench内部API、Remote能力、認証・Origin・Lifecycleの保証を二入口化で消さない条件を記録した。
- [x] Shared周辺八観点のSource照合を記録し、実REST ConsumerとMCP未接続能力を識別した。
- [x] Shared周辺の一次File対応表と、配布入口におけるProfile／Activity未接続を記録した。
- [x] Browser表示APIとServer間Integrationを区別し、同一Process直接呼出し／別Process MCPの共通認可境界を記録した。
- [x] REST／Gatewayの廃止目標、関数単位の移管案、設定・配布・文書の対応と完成Gateを記録した。
- [x] 既存MCPのlocalhost制限を確認し、Gateway削除だけでは共有TLS配置が完成しないことを明示した。
- [x] 共通CROS能力、MCP操作候補、ツール単位設定と本番Reader／Storeの接続案を具体化した。
- [x] Activityの画面実装をCROSへそのまま移す逆依存を避け、調査で本番Readerを確認できなかった範囲を明記した。
- [x] 基本設計からSource・署名E2E・完了までの成果物、依存順、通過条件と現在Gapの扱いを計画した。
- [x] 未確定Owner・実行依存の未調査範囲をOPENとして明示した。
- [x] N/A: 初期Draft記録時にはSource回帰・署名・実E2Eを実行していない。その後の実施状況は各段階の確認記録で区別する。
- [x] 段階1の全File予定処置、分割関数、Consumer、保持能力・過去Evidence、必須実経路と現在QA項目を棚卸しへ対応させた。詳細API・配置の確定は段階3へ残す。
- [x] 段階4の固定設計独立レビュー三観点と是正後再確認を完了した。Source移管・実境界の完了とは区別する。
