# Platform Accessの構造・Native接続再編

対象: CRDD v0.22 / CHG-000082 第二段階
基準Commit: `3e5bd9135`
状態: 既存TypeScript配置の移管・限定回帰・独立レビュー完了。Native接続抽出・Rust再配置は後続単位
決定権限: Qual-Lab

## 1. 採用方針と実行境界

人間の添付MDと追加合意を設計入力とする。Platform Accessは独立Packageを維持し、上位はTypeScript公開APIを呼び、その内部でRust Native Helperへ接続する。Rustは機能別のWindows実装を責務Folderの`mod.rs`から`#[cfg(windows)]`でビルド時に選択する。Linux／macOSの実装・空Stub・Driver Registry・Factoryは追加しない。

変更分類は、既存Capabilityの責務移管と構造Refactor。Architecture・Quality・Coding Standards・Source・公開API・Build・試験・Symbol・Catalog・既知Consumerを同じ単位で追従する。通常保存・Authority・Binary Protocol・失敗理由・回復参照の意味は変えない。現在Repositoryだけを書込みRootとする。実Docker操作・外部AI・②保持物削除・過去Evidence更新・Releaseは対象外。

親の照合と読取り専用確認者により、技術搬送と上位判断の分離、前後の開発観測確認、部分Effect・終了不明の保持、Cargo入口と検査母集団の追従を着手前に確認した。追加の人間判断は現時点で不要。技術・品質の独立レビュー、文書と直接伝播の確認を各固定単位で行う。標準工程・準拠表明・Release条件は変えないため準拠監査・Release監査は追加しない。実境界の操作が必要な場合は、その対象とEffectを別に提示する。

## 2. 移管対応表

| 現在の所有者・処理 | Platform Accessへ移す責務 | 上位へ残す責務 |
|---|---|---|
| Coordinator `platform-access/adapter.ts`・`protected-root-protocol.ts` | それぞれの固定要求・応答・nonce・長さ・版の技術契約 | 上位判断と用途。異なるProtocolを似たbyte処理だけで統合しない |
| Coordinator `platform-access/protected-root-windows-adapter.ts` | 固定Nativeの起動、Artifact前後確認、Root観測の搬送 | Root用途・初期化許可・WeakMap Capability発行／消費 |
| Coordinator `provider/home-windows-adapter.ts` | Home観測要求・応答検査・Native搬送 | Provider選択・10秒鮮度・Mount Capability発行／消費／失効 |
| Coordinator `host-execution/terminal-windows-adapter.ts` | 記録保存・読取り・対象観測の用途固定搬送と相関 | 終端記録の意味・Recovery判断・同じ回復参照・再入場と清掃許可 |
| Coordinator `host-execution/recovery-namespace-windows-adapter.ts` | 親観測・期待Identity結合・初期化の技術処理 | 用途・作成時点・処置判断 |
| DI `desktop/native-process.ts`・`native-process-lifecycle.ts` | 補助子取得、専用環境、固定Protocol、EOF／release／abort、子とstdioの終了 | 修復／再起動の承認・対象操作・回数・Engine再観測・Checkpoint |
| DI `desktop/runtime-directory.ts`・`repair-directory-disposal.ts` | OS実体・アクセス・Identityの技術観測 | Operation・退避・継続・保持・削除の判断とCheckpoint |
| Orchestrator `storage/protected-decision.ts`・`platform/windows-adapter.ts` | 新しい技術観測Ownerへの接続を照合 | 既存の上位Capability利用を技術APIと混同しない |

開発用Native観測のborrowは上位に残し、現在の前後二回確認を維持する。Native実行後の再確認に失敗したらCapabilityを発行しない。PAからCoordinator・DIへimportしない。DIの既存Policy Hashは上位が取得し、用途固定のPA操作へ値として渡す。任意argv・raw frame・任意実行物を受け付ける公開APIは作らない。

Native応答、Protocol完了、子Process終了、全stdio終了、cleanup成立は別の観測として維持する。初期化・保存の発行後失敗で部分receiptや`filesystemEffectIssued: null`を未発行へ畳まない。同期／非同期の方式変更、再送・timeout延長を移管へ混ぜない。

## 3. 目標配置

追加の人間判断により、Native実行物確認をPA内部へ閉じ、上位のArtifact token公開・管理を減らす。Root／Home、Host記録、Docker補助子、開発Session、出所診断の全Consumerを移管した後に公開begin／verifyを撤去する。単なるHandleへの改名・新Registryは行わない。通常操作の起動前後確認・固定Artifact・失敗時の発行事実は維持する。

```text
platform-access/
├ src/
│  ├ index.ts                         意味操作を明示公開
│  ├ artifact/identity.ts              Native成果物の同一性観測
│  ├ filesystem/                       entry・system-directory・local-app-data
│  ├ process/                          environment・termination
│  ├ host-record/                      既存の記録・namespace技術接続を移管
│  ├ docker-desktop/                   既存の補助子・固定Protocol・終了処理を移管
│  └ native/
│     ├ build.rs                       Cargoコンパイル前の準備
│     ├ main.rs                        固定CLI受付
│     ├ protocol/                      access・host_namespace・host_record
│     ├ filesystem/
│     │  ├ mod.rs                      cfgによる実装選択
│     │  └ windows/                    entry・root・保護・Known Folder
│     ├ process/
│     │  ├ mod.rs
│     │  └ windows/                    child・principal
│     ├ host_record/
│     │  ├ mod.rs
│     │  └ windows/                    対象・namespace・記録File・保存と既存排他
│     └ docker_desktop/
│        ├ mod.rs
│        └ windows/                    identity・publisher・repair
├ tests/                               TS・Rust試験を責務別に配置
│  ├ integration/native-cli.rs          固定Native CLIの結合試験
│  ├ integration/windows-entry-diagnostic.rs  明示限定のWindows診断
│  └ fixtures/                         Rust・TSの試験入力
├ Cargo.toml / Cargo.lock
├ rust-toolchain.toml
└ package.json / tsconfig.json
```

OS別Folderへ移しても同じ保証を他OSへ継承しない。非Windowsの現行拒否を維持し、実装時だけLinux／macOSを追加する。Host Record内部は依存を照合し、保存と不可分な容量予約を機械的に別責務へ切らない。既存排他を分離する場合は保存責務の`storage/lock.rs`へ置き、Lockを新設しない。単一の巨大`windows.rs`、転送だけのTS APIは作らない。

Cargo rootと`target/<target>/{debug,release}`を維持する。`[[bin]].path`、`package.build`、`[[test]]`を新配置へ明示接続し、Cargo Workspaceは作らない。Source／testsの移動と同じ単位でFixture相対Path、Rust実体の閉集合、Symbol、Catalog、coverage、Build／配布検査を切り替える。CRDD署名方式の退役とWindows Publisher検証は別能力であり、後者を削除しない。

## 4. 実行単位と検証

1. 既存PAのTS実装を機能別へ移す。公開名・型・戻り値・処理本文を維持し、直接Source読取り・動的import・`import.meta.url`のRoot導出を照合する。
2. Coordinator／DIに残るNative接続を用途別に抽出し、本番Consumerと試験を接続する。上位Capabilityと開発観測は残す。
3. Rustをnativeへ移し、責務別Windows配置へ接続する。Host Recordの実装と試験を責務で整理する。
4. Root API・Header・Coding Standards・Catalog・Symbol・利用側・Buildを全数再照合し、局所・回帰・独立レビューを行う。

基準版ではTSの静的14Fileと通常試験10件が成功した。Host専用試験・Rust・Docker復旧・全体QAはこの基準確認に含めない。

移管で確認する反証は、欠落／改変Artifact、前後Root・File差、偽token、Protocolの旧版・異種・欠測・余分frame、nonce不一致、起動前拒否、開始後取消、EOF・timeout・Process／stdio終了不明、発行後の保存部分Effect、同じ回復参照、未対応OSの明示拒否である。既存の固定形式と失敗条件を維持し、試験数から不存在や回収成功を推定しない。

物理移管や局所試験の成功だけでPA全体完成とは表示しない。実Nativeの再BuildはHashが変わり得るため、Build成功と固定配布成果物の有効化を分ける。古い配布成果物へ新しい実装成立を推定せず、必要な実境界確認と採用条件を別に満たす。

## 5. 最初のTS配置単位の結果

既存6実体を`artifact/identity.ts`、`filesystem/{entry,system-directory,local-app-data}.ts`、`process/{environment,termination}.ts`へ移し、Root入口と直接Consumerを接続した。基準Commit本文との比較は、必要な相対import変更・改行正規化後に6／6一致。Root公開名・型・戻り値、配布Root導出の深さ、固定Native Path・Hash・Protocol・終了処理は不変。Symbol・Catalog・coverage・公開allowlistと直接Source試験を追従した。

| 確認 | 結果 |
|---|---|
| PA通常`npm test` | 静的14File成功、10／10成功 |
| Coordinator／DI利用側 | 型検査成功。DI静的72File成功（既存Info 1、Warningなし） |
| DI Package境界 | 3／3成功 |
| Coordinator Host記録 | 30／30成功 |
| Domain試験台帳 | 25／25成功、実在371件の台帳検査valid |
| Header・公開入口・QA接続 | 3／3成功 |
| 本文・参照・空白 | 本文6／6一致、現行対象の旧TS Path参照0、差分空白検査成功 |
| 限定独立レビュー | Source・Consumer・文書・QAの残指摘0 |

台帳検査で前単位のWorkbench Query試験1件の未登録を検出し、既存試験を最小登録して是正した。検査義務・期待条件は弱めていない。Checker全体checkは未変更の`domain-model/tests/integration/storage-consumer-closure.integration.test.ts`の既存整形1箇所で停止し、全体成功とは扱わない。今回のPath短縮に伴った整形2箇所は是正した。

次は§2のNative接続抽出を行い、技術搬送の型付きAPIと上位Capabilityを分離する。Rust配置・Host Record分割・実Native再Build・必要な実境界・全体QAは未完了。Docker・外部AI・保持物は操作していない。今回の自己生成試験物は各試験の終了処理で回収した。

## 6. Root／Provider Homeの本番接続

`observeWindowsRuntimeState`と`observeWindowsProviderHome`をPA Root APIへ接続し、固定要求・応答・Artifact前後確認・閉じた環境・固定Nativeの同期起動をPAへ移した。純粋Protocolは`filesystem/protection.ts`、技術実行は`filesystem/root.ts`が所有する。上位二Adapterからspawn、Artifact比較、begin／verifyとNative token管理を撤去した。上位のRoot／Provider選択・鮮度10秒・Capability発行／消費／失効は維持した。

開発観測は上位の既存borrowを同期Readerへ投影し、要求構築後とArtifact後確認後だけに呼ぶ。nonce失敗はReader前、初回nullは開発Context拒否、期待Artifact欠落はBootstrap取得不能、後Reader拒否は応答不正より先とする。Readerを保存せず、例外も新しいcatchで別理由へ変えない。

返却結果は平坦な型付き観測と失敗区分で、Process発行、Filesystem要求発行、Helper終了、Artifact前後確認を別fieldで保持する。初期化を要求したNative起動後の失敗ではFilesystem要求発行を残す。上位へtoken・raw frame・実行物Pathを返さず、上位自身が保持する用途別Capabilityとは区別する。

旧Coordinatorの通常Bootstrap省略検出は、新しいPA試験へ移管した。同じ本文に対するBootstrap・前後確認・shell・argvの変異検出を維持し、Root／Home二用途、nonce・Readerの競合、未知応答とEffect保持を追加した。元の本番Session結合は新PA実装と私有Artifact依存へ接続し直し、実行順・取消・失効・前後Source差の期待条件を維持した。

現時点の確認: PA静的17File・通常11件、上位Root／Protocol8件、Session結合120件、通常の開発観測回帰128件、Windows Host限定1件、利用側・coverage契約14件が成功した。Windows Host初回のHardlink EPERMは実行環境制限として保持し、必要権限で同じ限定1件を確認して成功した。外部AI・Docker操作は行っていない。最終通常回帰128件と限定独立レビューを確認した。ただし、後続の着手前照合で純粋Protocol試験のPackage私有参照を検出し、前レビューの指摘0をこの点について訂正した。§7の試験移管で是正し、PA全体完成とはしない。

検査で発見した先行の残りは、Workbench Query試験の不足boundary説明3箇所と不要な局所Lint抑止2行、Domain試験の改行1箇所だけを是正した。処理本文・検査規則・期待条件を変えず、全体静的検査は成功（既存Info62、Warning0）、Header／公開／QA接続3件も成功した。先行記録の全体整形停止はこの是正前の結果として区別する。

残る公開token利用はHost記録の読取り・保存、DI補助子、開発Session、出所診断等である。これらの移管前にroot公開begin／verifyを削除せず、全Consumerが移行した後に撤去する。内部WeakMapを別名の公開Handle／Registryで代替しない。合意した最終API一覧のHost記録・Docker部分、Rust OS別配置は未実装を維持する。

## 7. Host記録保存先の初期化と試験Owner

`host-execution/recovery-namespace-windows-adapter.ts`の技術処理をPAの`host-record/namespace.ts`へ移し、`initializeWindowsHostRecordNamespace`を公開した。上位の通常作成入口がこのAPIを呼び、初期化する時点・失敗分類・Root作成・清掃判断は従来どおり上位に残る。追加の中継、token、Registry、Lockは作っていない。

親観測→期待Identity・利用者Hash結合→初期化、二要求のArtifact前後照合、固定argv・5秒・有界出力・部分receipt・不明Effectと終了値相関は維持した。同じFolder深さのため配布Root導出は不変。独立した観測操作は利用側がないため公開しない。

純wireとNative搬送の反証をPAへ実移動し、Coordinatorには上位作成との結合だけを残した。Root／Homeの先行試験でも私有Protocol importをPA側へ移した。公開APIを試験のためだけに拡張せず、失敗反証も削除していない。直接子Process利用元一覧は実際のPA Root／Namespace Ownerへ追従した。

確認結果: PA静的20 Fileと通常17／17、Coordinator型検査と上位結合2／2、子Process利用元1／1、Header・公開・QA接続3／3、台帳374件valid、全体静的検査成功（既存Info62、Warning0）。試験台帳は実行結果ではなく登録整合の確認として扱う。後続の§8是正を含む独立再確認は残指摘0。実Nativeの再Build・Docker・外部AI・保持中の②試験物は操作していない。

## 8. Session結合試験の公開境界への是正

先行Session試験に残ったPA私有Moduleのmockと動的importを撤去した。上位は公開APIの固定結果と同期Readerの投影だけを代替し、Artifact照合・wire・spawnの検出手順を再実装しない。PA実本体の反証と上位処置の反証は別試験として成立させ、単一試験で実Sessionから実PA内部まで通したとは表示しない。

旧30条件×四対象の対応は次のとおり。PA側の確認先は`root-observation.contract.test.ts`の二用途と既存五変異、上位側は`development-native-observation.integration.test.ts`の同名Caseである。

| 旧条件 | PAの検出義務と確認先 | 上位Session／Adapterの処置義務 |
|---|---|---|
| normal、checkout-normal | normal／development | 正常結果からだけCapability発行。前後Readerと公開API一回配送 |
| pre-artifact、checkout-artifact-mismatch | artifact-before | 固定拒否結果でCapability非発行・Effectなし |
| post-artifact、checkout-post-artifact-mismatch | artifact-after | 拒否・終了確認・発行済みEffectを保持 |
| environment | environment | 起動前拒否結果を伝播 |
| checkout-bootstrap-missing | bootstrap | Bootstrap取得不能を伝播 |
| checkout-pre-token、checkout-post-token | verify-before／verify-after、前後確認省略変異 | 段階に応じて未発行と発行後拒否を区別 |
| post-source、post-native、post-repository | PAは技術正常結果だけ | 観測後に変更されたSource／Native／Repositoryを次のProvider境界で拒否 |
| native-null、native-throw | borrow-first | 実Sessionの観測取得不成立をReaderから拒否 |
| unknown-context | borrow-first | 偽ContextからCapabilityを発行しない |
| cancel、expiry | borrow-first | 実Sessionの取消・期限切れを拒否 |
| cleanup-cancel、cleanup-expiry | borrow-first／development | 読取り清掃Contextと初期化要求を区別 |
| admission-source-hash、source-hash-mismatch | PA検出の対象外 | 受付時／再観測時のSource期待差を実Sessionで拒否 |
| old-token-stale、old-token-throw、old-token-second | borrow-first | 元観測の前後失効・例外をfresh観測で上書きしない |
| new-token-final | borrow-first | fresh観測の最終確認不成立を拒否 |
| borrow-token-stale、borrow-token-throw | borrow-first | 借用中の元観測失効・例外を拒否 |
| post-borrow-token | borrow-after | 後Reader拒否で上位Capabilityを発行せず、発行済みEffectを保持 |
| cleanup-old-token-stale | borrow-first | 清掃Contextでも失効観測を再利用しない |

模擬`nativeEffectObservations`は公開結果のEffect通過数であり、実Process開始・不存在の観測ではない。別に公開API配送数とReaderの0／1／2回をassertする。checkoutのPA内部Bootstrap回数・Artifact回数は上位試験から外し、PA実本体の厳密イベント順と変異検出へ移した。上位Sessionの観測回数0と公開API配送一回は引き続き確認する。受付で拒否するCaseは公開API・Readerとも0である。

Host補助子環境の純値試験もPAの`tests/unit/process/environment.contract.test.ts`へ実移動し、上位からPA非公開Sourceを読む依存を撤去した。新しい公開API・Fixture Facade・例外規約は追加していない。

最終確認: PAの静的21 File・通常18／18、Coordinatorの型検査・Host記録と上位接続31／31・通常開発観測128／128（50.4902秒）、Header／公開／QA接続3／3、台帳375件valid、全体静的検査（既存Info62・Warning0）が成功した。独立再レビューは残指摘0。今回のSource試験用`development-source-*`領域は終了後に残存なしを確認した。実Native再Build・Rust配置・Docker補助子移管と必要な実境界は引き続き未完了であり、PA全体の完成とは扱わない。

## 9. Rust配置の変更

人間の配置判断に従い、Rust実装は`src/native/`、Rust試験は既存の`tests/`へ統合する。Cargoの`build.rs`は`src/native/build.rs`へ置き、別の`native/`親フォルダは保持しない。Cargo入口、Fixture相対参照、Symbol台帳、検査対象、ArchitectureとCoding Standardsを同じ配置へ追従させる。過去Evidenceは変更しない。

配置後の固定Toolchainによる`cargo check --frozen --all-features --target x86_64-pc-windows-msvc`と、Rust単体・CLI試験の`--no-run`ビルドは成功した。これは試験実行・配布更新・Docker実境界の成功を意味しない。HostのHardlink非対応によるビルドキャッシュのCopy fallback警告は残る。①〜⑤全体は引き続き作業中である。

## 10. 配置追従とHost記録の接続確認

`build.rs`を`src/native/build.rs`、Rust CLI試験を`tests/integration/native-cli.rs`へ移動した。CLI試験からWindows退避領域の診断を`tests/integration/windows-entry-diagnostic.rs`へ分離し、明示実行限定のignored条件を維持する。Cargo Target、Symbol、Test Catalog、検査対象とcoverage入力を追従し、coverageの期待Source 14件がすべて実在することを確認した。

Host記録の技術搬送はPAの`src/host-record/record.ts`へ移管し、上位は意味検査済み本文と同じencode結果から技術期待値を投影する。上位の実Session・caller保存・Recovery判断はCoordinatorに残す。技術単体17件とNative実本文反証1件はPAへ配置し、上位の意味検査12件と実Filesystem caller結合8件を維持する。試験側の実投影関数注入も新境界へ追従し、異なるRealmのobjectを本番入力の代わりに渡さない。

現時点の確認結果はPA通常86件成功、Docker Isolation通常293件成功・実Docker試験1件未実行、Host caller結合8件成功、上位開発Sessionの通常127件成功である。制限環境でHardlink作成が拒否されたHost専用1件は通常権限で個別確認し成功した。PAの型・lint・format、公開入口・Source Header・Quality接続を含む構造検査5件も成功した。退避領域の実診断、Docker操作、外部AI依頼、固定Native配布物の更新は行っていない。

この単位時点では、上位Artifact token公開の縮小、利用側・設計・検証対応の全体照合と全体独立レビューを未完了として保持した。以後の処置は次節を現在値とする。

## 11. ①〜⑤の最終照合

状態: 今回の①〜⑤のSource構造・公開API・利用側移管を完了。通常回帰と限定独立レビューは残指摘0。実Docker操作・配布更新・外部AI E2Eの完成を含めない。

| 項目 | 現在の所有者・処置 | 維持する境界 |
|---|---|---|
| ① Host記録の技術実行 | PA `host-record/record.ts`／`namespace.ts`。通常の六u32型もPAに統一 | intentの意味、producer、処置順、caller保存、Recovery判断はCoordinator |
| ② Docker Desktop補助子 | PA `docker-desktop/helper.ts`／`protocol.ts`。DIの本番Callerと試験をRoot APIへ接続 | Policy選択、承認、Checkpoint、Engine判断、再起動・回復の可否はDI |
| ③ Artifact公開tokenの縮小 | Rootからbegin／verifyを撤去。`observeNativeArtifact`の実体・内容Hashで前後比較 | 内部の同Handle照合を維持。元失敗を新baselineで上書きせず、Bootstrap要求用途を維持 |
| ④ Rust配置・試験分離 | `src/native/<責務>/windows/`とcfg選択。Host記録の試験本体は`tests/integration/host-record.rs` | 私有moduleへのcfg接続・試験項目・ignored条件を維持し、完全修飾名は新moduleへ追従。容量予約と保存の不可分な所有を切らない |
| ⑤ 設計・公開入口・利用側・試験 | Architecture、Coding Standards、Quality、Catalog、Symbol、coverage、Cargo・npm入口を追従 | 新Framework・State・Lock・Authorityは追加しない。過去Evidenceを改名しない |

`observeNativeArtifact`は一回の既存Snapshotから、Root実体、実行Path、File実体のbigint値、内容Hashとbyte長を固定順でHash化する。任意の元Hashは非Authorityの比較条件であり、観測不能・元Hash不一致はnull、固定Bootstrap不一致は正常観測のfalseとして区別する。Source／Gitの意味と上位Capability判断は移管しない。

同一bytesの別Fileへの置換、本文・期待値の不一致、対象実体alias、既知FileのDirectory／Reparse属性、元実体の前後失効、最後の再観測拒否を試験する。Native環境欠測の検出はPA、公開失敗を受けた上位のCapability非発行はCoordinatorで確認する。移動した試験を元Ownerのconsumer一覧に残さず、新Ownerの実在試験と本番利用側へ接続する。

最終確認（2026-10-20）: PA通常88件、Docker Isolation通常293件、上位Session127件、関連境界・台帳70件、Host実Filesystem9件が成功した。Docker Isolationの明示Docker試験1件は未実行。通常Rustは47単体＋8CLI成功、23件は明示ignoredを維持した。固定Toolchainの書式・Clippy、PA静的検査、全体の書式・型・warning禁止Lint、Header・公開API・QA接続3件、台帳378件valid、差分空白検査が成功した。Lintの既存Info62件は残る。RustのHostキャッシュHardlinkは環境制約によりCopy fallbackとなる。

Source・安全境界と設計・配置を分離して独立確認し、指摘を統合して改名記述2箇所・新Pathの追跡・不要な抑制コメントを是正した。処理・試験条件・過去Evidenceは変更せず、最終候補の再確認は残指摘0。完全出力は端末で確認し、既存の再実行可能な試験へ接続する。実行単位のEvidence書庫は増やさない。

これは固定配布Nativeの更新・実Docker修復・外部AI E2Eの成功ではない。全Repository文書Checkerは不合格（3,520件）であり、過去Evidenceの旧参照等と既存Quality整合の負債を含む。今回の構造整理からRepository全体の品質PassまたはRelease可能とは主張しない。保持中②の試験物、Docker再起動、外部AIの再試行は対象外を維持する。
