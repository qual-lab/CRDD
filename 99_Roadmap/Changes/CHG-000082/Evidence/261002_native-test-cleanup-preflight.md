# Native試験の所有一時領域清掃 — 着手前確認

成果物種別: 変更の調査・計画記録
変更ID: `CHG-000082`
記録日: 2026-10-02
基準Commit: `a14b0d6461d3dfb295dd4dca954a9ee83015ffcf`
維持責任者: Qual-Lab

## 結論

既存Native試験の清掃観測Gapは、末尾の不存在確認だけでは閉じない。終了確認に失敗すると、一時領域の自動削除が先に走り得るため、**取得時から自動削除を抑え、所有TaskとHostの終了を確認した後だけ明示清掃する**方向へ計画を修正する。

この記録はSource編集前の調査結果であり、実装採用、試験合格、旧Host残存三件の削除許可または実Task再開ではない。Windows再起動を利用する限定回復方式は人間判断待ちであり、その判断をこの別の試験Gapの確認から推定しない。

## 変更経路と対象

| 項目 | 今回の処置 |
|---|---|
| 分類 | 保存結果で判明した試験終了後条件の不足に対する着手前調査。 |
| 保持する意味 | 元の六Host scenario、起動Policy、結果Oracle、正常・異常の区別を維持する。 |
| 調査対象 | `run_crdd_host_scenario`の試験自身が取得したHome／Workspace。実在する旧三Rootは対象外。 |
| 正本／利用側 | Coordinator詳細設計7.5.1、QA-000006のERB-IT-025〜029、固定試験Patch、Build入力固定、既存の限定適用Evidence。 |
| 着手前確認 | 親のSource／Quality／実行環境意味の照合と、読取り専用の技術確認。完成後監査として流用しない。 |
| 今回実行しない操作 | Source編集、Rust compile、Docker／Native／Provider実行、実Root清掃、署名、実Task再開。 |
| 必要な独立確認 | 本記録の技術解釈、文書・追跡、品質・直接影響を同じ固定版で確認する。準拠基準、配布Identityを変更しないため全回帰・再署名を本調査の確認に使わない。 |

既存のGapと実行結果は[Native二十一試験の品質適用記録](260930-1853_codex-model-host-migration-preflight.md#native二十一試験のquality適用と清掃観測gap2026-10-02)を保持する。過去の合格、Hash、未充足条件は変更しない。

## 固定Sourceと一次情報

| 対象 | 確認したIdentity／限界 |
|---|---|
| 公式Source Archive | `.crdd/tmp/codex-01592-migration/official-source.tar.gz`、SHA-256 `b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`。Archive内Cargo.lockのtempfileは`3.27.0`、crate checksumは`32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd`。 |
| 起動Patch | `40_Develop/coordinator/runtime/codex-advice-startup.patch`、SHA-256 `1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb`。変更なし。 |
| 試験Patch | `40_Develop/coordinator/runtime/codex-advice-startup-test.patch`、SHA-256 `03e916f0371b80cf4f7038b54f3b81356218d277acc506dd3f473a4acc15cc31`。変更なし。 |
| 試験入力一覧 | `40_Develop/coordinator/runtime/codex-advice-startup-test-inputs.sha256`、SHA-256 `f812775b4254a47376adcc99491c7752869daed403df39d7b998ae95cdf51b80`。変更なし。 |
| APIの一次情報 | tempfile公開tag v3.27.0の[TempDir実装](https://raw.githubusercontent.com/Stebalien/tempfile/v3.27.0/src/dir/mod.rs)と[Builder実装](https://raw.githubusercontent.com/Stebalien/tempfile/v3.27.0/src/lib.rs)。公開API名と版だけで調査し、Repository本文、診断log、秘密値は送信していない。公開tagの意味確認をCargo.lockのexact crate bytesとの暗号一致へ読み替えない。 |

## 判明した不足と修正方向

| 現行Source／APIの意味 | 反証・影響 | 次単位の方向 |
|---|---|---|
| Helperは通常のTempDirを取得し、shutdown／終了待機後にassertする。 | assert失敗のunwindでもDropが削除を試みる。「終了未確認なら保持」が未成立。 | Task／Host取得前、Root生成時から自動清掃を無効化する。失敗後のkeep追加だけでは閉じない。 |
| TempDirのDropは削除Errorを無視する。 | Drop実行から清掃成功を推定できない。 | closeの結果とRoot不存在を別々に観測する。 |
| closeは削除結果を返し、TempDirを消費する。自動清掃無効でも明示削除は実行する。 | close失敗時も同じTempDirを再利用できない。 | 処置前に所有Pathを保持し、二Rootを個別に処置・観測する。無条件の再削除にしない。 |
| keepは自動清掃を無効化しPathを返す。 | Path保持は非使用証明や回復Authorityではない。 | 保持対象・失敗理由・未確認条件を記録し、自動再入場許可を作らない。 |
| resources_settledは空集合でも成立し得る。 | 未登録を終了済みへ畳むと、Root削除の前提が崩れる。 | 必須Roleの登録・終了とHost終端を、空集合の集計だけから推定しない。 |

## 次単位で閉じる条件

| 場面 | 必要な処置／反証 |
|---|---|
| Root取得途中の失敗 | 取得済み対象と未取得対象を分ける。元失敗を保持し、作成途中の残存を消失扱いしない。 |
| 正常完了 | 必須Role・全所有Task・Host終端を確認後、HomeとWorkspaceを明示清掃し、それぞれの不存在を確認する。 |
| error／timeout／panic | 元結果を保持する。終了確認の成否を独立評価し、終了未確認なら削除0・保持を強制する。清掃成功をscenario成功へ昇格しない。 |
| 一Rootだけ清掃失敗 | 他Rootの処置と観測を独立に記録し、部分成立を全体成功へ畳まない。 |
| 不存在観測が失敗 | 明示不存在と観測不能を区別する。exists=falseへの畳込みを拒否する。 |
| 新候補の作成 | 試験Patch・生成Source・入力一覧・Builder／利用側のHashを同じ候補へ対応付ける。旧署名候補と旧Evidenceは不変。 |
| 実測 | Source採用後に静的Gate・局所反証・必要な実Host境界を順に確認する。実行範囲と停止Gateを事前照合し、現段階では実行しない。 |

変更ファイル単位ではなく、取得、登録、終了、処置、観測、結果搬送の各意味から反証を導く。現在は計画修正であり、これらの条件を実装済みとは表示しない。v0.22の観測済み`11 / 46`、全体`119 / 176`と新実Task停止を維持する。

## 限定独立確認の結果

技術解釈、文書・追跡、品質・直接影響の三観点は、同じ固定二文書への読取り確認を完了し、全て限定Pass、Finding 0であった。確認対象はこの結果追記前のEvidence SHA-256 `7578a168a6321e862e23c894b995f10ec6a7f57e44f9c7eb4c5eaa750389b67b`と、CHG本文`4a047cc3798fcc8ee086c4e3f3abde4560db2c9f9170b01e91f5fdc8c603fb5a`で、各確認の開始・終了Hashが一致した。

Passは調査記録の技術解釈と適用境界だけを対象とする。確認者は試験・Source編集・実Root操作を実行せず、Source採用、清掃、Local Item成立または実Task再開を承認していない。三結果の統合後、この節とChecklistだけを結果書戻しとして追記した。確認対象Hashと追記後Hashを取り違えず、元の記録、許可範囲と残るOPENを維持する。三確認者はこの結果だけの書戻しを整合済みとした。

## 後続調査: 依存実物とRoot利用者の追加確認（2026-10-02）

基準Commitは`ffc341207464e65eb5a5f8d35470495eaaa4941e`。初回の調査結果・限定Pass・対象Hashは上記の履歴として保持する。この追補を旧確認の対象またはSource修正の合格へ遡及適用しない。

### 結論

tempfileのexact crate bytesを照合できた。一方、**Session終了のboolとCode Modeの登録Roleだけでは、Homeを使う全処理の終了を証明できない**反例を確認した。Source編集前の計画を、書込み処理の実終了まで含む観測へ戻す。削除処理を先に追加しない。

| 確認対象 | 新たに確認した根拠 | 計画への影響 |
|---|---|---|
| tempfile `3.27.0`の実物 | 公開crateをRepository-local `.crdd/tmp/native-cleanup-crate-261002/`へ取得。SHA-256 `32497e9a4c7b38532efcdebeef879707aa9f794296a4f0244f6f69e9bc8574bd`は固定ArchiveのCargo.lockと一致。 | 公開tagのAPI説明だけでなく、Buildが要求する実物との一致を確認した。Source候補のcompile・実測とは別の根拠である。 |
| 生成時の自動清掃抑止 | 実物の`src/lib.rs`でBuilderの`disable_cleanup`をDirectory生成へ搬送する。`src/dir/mod.rs`でDropは同値がfalseの場合だけ削除を試み、明示closeは同値にかかわらず削除結果を返す。両fileのSHA-256はそれぞれ`d182721b62c126916b73bb4865ced5d3637bd1a4a77d27ea9e9708973e5f9493`、`d144325a6528a9a6e7c78a42e0eec42ee401c3b834ef5851376323725756f219`。 | 取得時の抑止と明示清掃を分離する当初方向を維持する。失敗後のkeepだけでは代替しない。 |
| 実Session試験の保存処理 | 固定Archiveの`core/src/session/tests.rs`はHomeを使う`LocalThreadStore`を実Sessionへ渡す。`core/src/session/handlers.rs`は保存処理のshutdownがErrでも通知を送った後にtrueを返す。 | Session終了のtrueをHome非使用の証明にしない。実際の保存処理の終了結果を別に観測する。 |
| 書込みActorの失敗 | 固定Archiveの`rollout/src/recorder.rs`は、drain失敗時にはWriterを生存させて再flush／shutdownを可能にする。成功経路は実WriterのJoinHandle待機へ進む。 | 正常な終了通知だけでなく、Writer生存時には削除0で保持する反証が必要である。 |
| 終了待機の取消 | 同fileの`wait_for_exit`はJoinHandleをtakeしてからawaitし、Handleがない場合にはOkを返す。 | 後追いの再shutdown成功を実joinへ読み替えない。元の終了処理で実際に確認した結果を保持し、timeout／取消／観測不能では清掃しない。 |
| 初期化途中の失敗 | 固定Archiveの`thread-store/src/live_thread.rs`は初期化GuardのDropから非同期のdiscardを起動し得る。 | `owned_session == None`を「Task未作成」へ畳まない。早期error／timeout／panicでは、未確認の利用者が終わる前にRootを削除しない。 |

公式Sourceの根拠は、SHA-256 `b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a`を再確認した既存Archiveから直接読んだ。新しいProvider依頼、Docker操作、Native実行および旧三Rootの変更は行っていない。crate取得は公開名・版だけで行い、内部Source、診断結果または秘密値を送信していない。

### 現在の編集前Gate

読取り専用の着手前確認を一旦完了した。Home／Workspaceを実際に使う処理の終了観測は、まだ全件へ接続できていない。既存Code Mode Observerが持たない保存処理等を、Role名の追加だけで観測済みにしない。元の終了呼出しと実join結果を試験用観測へ接続し、shutdown自身のpanicもscenarioのpanicとは別に捕捉する計画へ修正する。

| 対象 | 確認済みの範囲 | 未成立の条件／予定処置 |
|---|---|---|
| Code ModeのTaskとHost | 固定試験Patchは、必須Roleの非空登録・終了とHost終端を確認する。 | Session全体やFilesystem処理の終端へ拡張解釈しない。既存の六scenarioとOracleを維持する。 |
| 保存Writerと初期化Guard | 上表の固定Archive確認で、失敗時Writer生存と初期化失敗後の非同期discardを確認した。 | 元shutdownの結果・実joinを保持する。Session未取得や後追いの再shutdown成功を非使用証明にしない。 |
| MCP事前準備Worker | 固定Archiveの`core/src/session/mcp_prewarm.rs`は取消要求後にWorkerをawaitする。ただしjoin Errorを警告へ吸収し、呼出し元へ終了結果を返さない。 | このWorkerの結果搬送と、取消された処理の背後Filesystem利用は別に確認する。shutdown全体のboolへ畳まない。 |
| Skills／ConfigのFilesystem利用 | 専門確認で同期配置と非同期Filesystem利用を確認した。ただし下位処理の終端保証を今回すべて固定Archiveへ照合できたわけではない。 | Future終了・取消と背後処理の終了を同一視しない。下位保証はOPENとし、Root清掃の許可条件に用いない。 |
| StateDB | 当該Session fixtureは`LocalThreadStore`へ`None`を渡す。 | このfixtureからDB Workerの新設を推定しない。他fixtureや全Providerへの非該当へ一般化しない。 |

次の実装単位は、取得時の自動清掃抑止と、終了観測後の明示清掃を分ける。先に自動清掃を抑止する場合も、保持対象の所有、停止条件、容量・保持、再入場を固定してから試験する。正常結果でRootが残れば清掃未成立を明示し、Container終了だけを二Rootの清掃確認へ読み替えない。明示清掃は、上記の未確認処理まで終了を確認できる候補が成立した後に限る。

Source、起動Patch、試験Patch、入力一覧、Builder、旧署名候補および過去のNative二十一試験は変更していない。局所反証・新Native試験・Local Itemへの適用は未実施であり、観測済み件数と新実Task停止を維持する。旧三Rootの限定回復方式の人間判断と、この試験自身の清掃是正を混同しない。

### 追補の限定独立確認

作成担当と別の確認者が、技術解釈、文書・追跡、品質・直接影響の三観点を一つの固定対象へ確認した。初回追補のSHA-256は`61f0fc5ae8cb799d098a3ef0ccfc14be6aca2a1a6d94669816fefe6863ab333b`で、技術と品質・直接影響は限定Pass、文書はMinor Finding `DOC-01`一件だった。原因はChecklistの旧完了行が追補を含む現在版へ読めることだった。

全結果を統合し、確認者と是正方針を整合した後、指定されたChecklist一行だけを変更した。新固定対象のSHA-256は`5a4771b6bd2b54ce296191e1cd6120d3315d885e635ec205315af59756346434`。確認者は開始・終了Hash一致、変更が指定一行だけであること、および三観点の限定Pass、新規Finding 0、`DOC-01`のResolvedを確認した。

本節と追補用Checklistは全確認終了後の結果だけの書戻しであり、上記Hashは書戻し前の固定対象を指す。この追補を初回記録の確認対象へ加えず、旧結果へ新Hashを遡及適用しない。Source採用、清掃、Local Item成立、全Recovery、実Task再開およびReleaseは本確認の対象外である。結果だけの書戻しは確認者と整合済みである。

## 追加確認: Build失敗後の保持と再識別の不足

基準Commitは`1428fab522634141a3027ba79d2cc97f50fe99a3`。この追補は失敗経路のSource読取りと計画上の不足を記録するものであり、新しいRunnerの採用、Source修正または清掃の実測ではない。親の照合と別の読取り専用確認者による着手前確認は、境界を補正した上で記録編集の着手可とした。

### 今回確認した事実

| 対象 | 読取りで確認したこと | 未保証の範囲 |
|---|---|---|
| [Native試験Builder](../../../../40_Develop/coordinator/runtime/codex-advice-builder.Dockerfile) | `startup-verification-run`は`/bin/bash -eu`と`pipefail`を使用する。timeout、試験、teeまたはgrep等の失敗ではRUNが失敗し、依存する後段`startup-verification-artifacts`のCOPYによる正常な成果物書出しは完成しない。 | 失敗時に別経路で得られるlog、Build基盤内の物理Rootの残存・消失、耐久的な再識別は未確認。書出し失敗を「全log消失」や「Root不存在」へ読み替えない。 |
| [Build入力準備](../../../../40_Develop/coordinator/scripts/prepare-codex-advice-build.ts) | Context生成、固定入力照合、Manifestと保持条件の記録を所有する。結果は`buildExecuted: false`で、Build起動・待機・失敗後の書出しを実行しない。 | Context生成後からManifest保存・結果搬送までの途中失敗、Build／親Process喪失後の再識別と再入場は閉じていない。Contextの七日保持条件をNative試験Rootの保持保証へ流用しない。 |

読取り対象のRepository上bytes SHA-256は、Dockerfileが`5255258d06ae861ea8e06a72468bbdf2ff6b81f2471a6eff70b1f6d802a31185`、準備Scriptが`9da0cc21e678ae3046c92b6dca9961e6423580f446b54e623307a2dcf55ac3bf`である。準備ScriptはDockerfile等をLF正規化してContextへ保存するため、これらを実行時Context内bytesのHashとは扱わない。今回Contextは新規作成していない。追補前の本記録SHA-256は`1c79271e506690b80b07907972781fa21879f374fdb518399e451671812f27cc`であり、旧独立確認の対象Hashは変更しない。

### 検討結果と次の確認条件

読取り専用の技術検討では、同じ固定試験Binary内でchild fixtureを自己起動し、終了後に親がRootを処置する案が提示された。これは検討案であり、採用・実装・実測ではない。childの実終了を確認できても、別ProcessのHost終了、外側Runner／Buildの親喪失、耐久参照、成果物書出しおよび再入場を証明したことにはならない。

| 対象資源 | 次の設計・確認で必要な対応 | 現在状態 |
|---|---|---|
| Native試験のHome／Workspace | 取得主体、全利用者、終了根拠、清掃Authorityと直接不存在観測へ対応付ける。 | 既存の清掃後条件は未成立。 |
| child案で追加し得るreceipt保存域とその親Root | 実際に追加する場合は所有者・保持・再識別・終了後条件へ含める。既存二Rootの清掃成功だけで全資源cleanとしない。 | 検討案。実在・実装を推定しない。 |
| Build Contextと診断成果物 | 既存の保持条件と、途中失敗・親喪失時の結果搬送／再識別を照合する。ログはEvidenceであり削除Authorityではない。 | Contextの保持記載だけでは失敗経路全体を閉じない。 |
| 共有Docker cacheその他の非所有資源 | 本変更の清掃対象へ含めない。 | 回収範囲は拡張しない。 |

次のSource編集前には、正常終了だけでなく、部分取得、試験失敗、timeout、panic、親喪失、古い／不一致の参照、結果搬送失敗、観測不能を同じ所有資源集合へ接続する必要がある。耐久参照を得られない場合はRootやAuthorityを推測せず停止する。具体的な契約はCoordinator詳細設計とQA-000006へ戻し、本記録へreceipt Schemaや回収手順の第二正本を作らない。

本追補の完成後の技術・文書・品質／直接影響確認は未実施。Source、Patch、入力一覧、Builder、旧署名候補、旧Native二十一試験と品質件数は変更しない。旧本文の`11 / 46`と`119 / 176`は当時の基準時点の記載であり、現在品質の投影には使用しない。ERB-IT-025〜029の清掃後条件未成立、新実Task停止、旧三Rootの方式採否・実処置の判断待ちは維持する。調査記録だけのため実OS試験、全回帰、再署名または準拠監査は行わず、旧限定Passをこの追補へ流用しない。

### Build失敗後の保持・再識別追補の独立確認

作成担当と別の確認者が、基準Commit `1428fab522634141a3027ba79d2cc97f50fe99a3`からの本記録一文書差分を固定して確認した。技術独立レビュー、文書監査、品質・直接影響の三観点は全て限定Pass、Finding 0、確信度は高である。固定対象SHA-256 `a88b84b32d555d778f4747f78f9271c04162e4d9af8d4e4c7ff07150e68b616e`、参照SourceのHashとHEADは確認開始・終了で一致した。追加リンクの実在と差分空白検査も確認した。

前節の「完成後確認は未実施」は、この結果追記前の状態を指す。全三結果を統合した後、この節と該当Checklist一行だけを結果として書き戻した。確認者と整合済みで、確認時Hashを追記後Hashへ置き換えていない。限定Passは調査記録の技術解釈と境界だけであり、Source採用、実行、Root利用者の閉包、保持・清掃の成立、Local Item成立、実Task再開またはReleaseには適用しない。旧結果・Hash、残るOPEN、停止と人間承認の境界は変更しない。

## Checklist

- [x] 固定Source、Patch、入力一覧と旧検証結果の境界を確認した。
- [x] 自動Drop、明示close、保持を区別した。
- [x] 終了未確認時の削除を防ぐ条件を取得前へ戻した。
- [x] 元error／timeout／panic、部分清掃と観測不能を別に評価する計画を残した。
- [x] 旧三Rootの限定回復、試験Rootの清掃Gapと通信断の原因を混同していない。
- [x] 初回記録（確認対象SHA-256 `7578a168a6321e862e23c894b995f10ec6a7f57e44f9c7eb4c5eaa750389b67b`）の三観点の独立確認と結果統合を完了し、調査記録だけの限定Passとして残した。
- [x] 後続調査でexact crate bytesとCargo.lockの一致を確認した。初回確認時には未確認だったことを保持した。
- [x] Session終了bool、Code Mode登録RoleとHome書込みActorの実終了を区別し、清掃前提を破る反例を計画へ取り込んだ。
- [x] 追補の新固定対象を三観点で独立確認し、DOC-01を是正・再確認した。初回の対象Hashと合格範囲へ遡及適用していない。
- [x] Buildの正常な成果物書出し、失敗時の保持不明と入力Contextの保持条件を区別した。child案を実測済みと扱っていない。
- [x] Build失敗後の保持・再識別追補を新固定版で三観点から独立確認し、調査記録だけの限定Pass、Finding 0を記録した。旧限定Passへ流用していない。
- [ ] OPEN: Root利用者の閉包、新Source候補・反証・実測は未成立。着手前確認を統合してからSourceを編集し、実測へ進む前に停止Gateと実行範囲を再照合する。
