# Shared Gatewayの非開示境界と品質適用

成果物種別: 品質検証・適用記録
変更ID: `CHG-000082`
基準Commit: `441f145f41e7ed3fb21de3b84e15e3af2fc8b411`
基準Tree: `863164693cb790f901fc5eb110e097175e5b2b82`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

公開共有サーバー（Shared Gateway）の本番Compositionを実loopback HTTPで通し、`RFD-ST-004`の非開示拒否と対象Repository Effect 0を確認した。独立確認後、この一項目だけを観測済みへ接続する。移管母集団46件は13件観測済み・33件未観測となる。全体集計OPEN、Host回収未完成、新しい実Taskの停止は維持する。

入力Repositoryは非秘密のMemory Fixtureである。実Filesystem、OS Root、CLI、実Internet TLS、Credential Lifecycle全体、内部全handle不存在、Host Recovery、Provider、全CROSまたはRelease成立は証明していない。

## 変更経路と着手前確認

同じCHGの残る品質義務を検証する変更である。旧System試験は公開CLIの起動・Health・終了を確認していたが、対象Repositoryを指定する権限外要求の内容取得を検証していなかった。Coreの純粋判定だけで公開入口の成立と扱わず、実HTTPの新しい試験へ分離した。

親と読取り専用確認者は、QA-000007の定義、公開Shared Server、Credential・Session・Exposure判定、Topic Application解決、応答Adapter、Symbol、Catalogを照合した。計画上の不足を全て統合し、正常対照、四反例、同じServerでの再許可、終了後の新規接続を追加した。これは完成後レビューではない。既存のRoot外一時領域を作る試験は実行せず、今回の試験はMemoryとloopback資源に限定する。

品質適用前にも別の着手前照合を行った。発火例は独立確認済みの一項目根拠、非発火例は単なるRelation追加、境界例は隣接試験の成功、情報不足例は現在全体集計・採用Scopeの未照合である。新義務、分母縮小、上流Format変更、Source契約変更、署名変更または残存Root処置は行わない。

| 変更file | 処置 |
|---|---|
| `40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts` | 公開MCP／REST、対象指定の拒否、正常対照、非開示と終了後接続を実測する。 |
| `40_Develop/mcp/symbol.json` | 新試験をQA-000007／RFD-ST-004と実際の本番Compositionへ接続する。 |
| `07_Quality/Registry/test-catalog.json` | 新System試験と公開Adapter／Transport／Credential経路の対応を登録する。 |
| `07_Quality/05_Current_Implementation_Reality_Audit.md` | 一項目だけを現在根拠へ接続し、旧Shared Server観測を履歴として区別する。 |
| `07_Quality/01_Quality_Center.md` | 算定Ownerから13／46と33／46を投影する。 |
| `07_Quality/04_Quality_Integration.md` | 設計接続と実観測を分け、他CROS義務の未成立を保持する。 |
| `PROJECT_CONTEXT.md` | 同じ現在品質をRepository入口へ投影する。 |
| `99_Roadmap/Changes/CHG-000082/change.md` | 新試験と本結果を反映先・結果参照へ接続する。 |
| 本記録 | 実行Identity、判断範囲、是正と独立確認結果を保持する。 |

技術・安全、文書・追跡、品質・直接影響の三観点を固定差分で確認する。準拠基準、Production Source、処置Authorityと署名閉包を変更しないため、準拠監査、全回帰、再署名、Provider／Docker E2Eはこの限定確認へ含めない。残る本来の検証義務を免除する判断ではない。

## 試験した条件と実観測

本番の`startCrosSharedServer`からMCP／REST、現在Credential、Session、Exposure、Repository Projectionと実Topic Applicationを通す。固定した非秘密内容だけを入力し、実HTTP応答、Factory・読取り・変更Port到達を別々に計数する。

| 条件 | 公開応答と実到達 |
|---|---|
| 許可された正常対照 | Topic本文取得はHTTP 200、`completed`。実読取り2回、Factory2回、正常認可の作成要求は変更Portへ1回到達する。作成Fixture自身は変更を拒否する。 |
| Grant外Workspace | 対象・不存在の取得と対象変更は、同じHTTP 200／JSON-RPC `-32602`／`Invalid params`。対象Factory、読取り、変更Portの増分は全て0。 |
| Exposureのregistry改訂不一致 | 同じ非開示拒否。対象Factory、読取り、変更Portの増分は全て0。 |
| ExposureのRepository改訂不一致 | 同じ非開示拒否。対象Factory、読取り、変更Portの増分は全て0。 |
| 管理CapabilityだけのCredential | 管理権限を内容Accessへ変換せず、同じ非開示拒否と対象Port増分0。 |
| 各拒否条件の投影 | MCPは`unavailable / project_context_not_available`、RESTは`available`の空Project一覧。Repository名、Binding、本文・根拠canary、範囲外Workspaceを返さない。各条件でSnapshot再取得を5回観測する。 |
| 同じServer／Credentialの再許可 | 元の正常応答と一致し、実読取り増分2回。拒否時の古い状態を固定していない。 |
| 終了 | 実close結果は`completed / cleanupConfirmed=true`。新しいTCP Socketの実接続結果は`ECONNREFUSED`。Socket closeを待ち、確認用Timerを解除する。 |

期待要求数は`expectedRequestCount`として実観測と区別する。拒否の同値は実応答から計算した比較値をassertと診断で共有する。正常／再許可の応答と計数、各拒否の公開結果field、実close結果と接続拒否を完全記録へ保存する。存在を隠す公開応答と、許可された試験内部の観測を混同しない。内部Session IDや全Process資源0は推定しない。

既存fetch接続の`ECONNRESET`はListener不存在の根拠に採用しなかった。確認Helperは新しいSocketを使い、接続成立、観測期限超過、その他Errorを`ECONNREFUSED`へ畳まない。

## 固定した実行と再識別

初回の記録は保存し、現在Hashを旧実行へ遡及適用しない。以下の是正後再実行を正式な限定根拠とする。

| 項目 | 固定した値・保存先 |
|---|---|
| 実行区間 | UTC `2026-10-02 07:50:35`〜`07:50:52`。Windows x64、Node `v24.19.0`。 |
| 対象Source | 新試験SHA-256 `4a28d7c4b655f0faa1814e09c16cbb58c5f50ea27e93f981e0c3aa43863ce54d`。Symbol `b17122deaba5f799c83cc5bf6a686788b8ec2c5117dfdb61d2c33a93e966e5dd`、Catalog `22001b1dfc58118c5c6d9b04a5126610df9328117543f035e1959fba37be5399`。 |
| 入力 | 三SubsystemのSource、選択試験、定義、Manifest、構成を含む51fileをPath別SHA-256で前後照合。40_Develop全src・関連構成404fileの正規化Manifestも前後一致。詳細・選択規則は原記録に保持する。 |
| 検証器 | Node、TypeScript `7.0.2`、Biome `2.5.6`のwrapper、解決JS、package、選択Native binaryの十一fileを前後固定。型関連library113fileの正規化Manifestも一致。`NODE_OPTIONS`、`NODE_PATH`、`BIOME_BINARY`、npm user agentは未設定。npm経由ではなく固定JS wrapperを直接使用した。 |
| 初回記録 | Repository-local `.crdd/verification/chg-000082-shared-gateway-non-disclosure-261002/run.json`、SHA-256 `ee23c1d15d8644ad686ccbd914c455826ba2779ebb63a33a007cabc49c459b82`。是正後根拠で置換せず保持する。 |
| 正式な新記録 | 同じ保存先の`rerun.json`、SHA-256 `260a97de717ec6628d2fef0c234148d48ea8099dcb534b5817099463808f9e23`。全command、cwd、対象／検証器の前後snapshot、Exit、ToolのUnicode結合出力を保存する。生stdout／stderr bytesの分離保存とは主張しない。 |
| 保持・無効化 | Phase 5の結論固定と必要な非秘密根拠の正式保存まで原記録を保持する。未解決参照を確認せず削除しない。喪失または入力・検証器変更時は再実行まで再識別可能な根拠に用いない。 |

| 順 | cwd | command | 結果 |
|---|---|---|---|
| 1 | `40_Develop/mcp` | `node ./node_modules/@biomejs/biome/bin/biome format .` | Exit 0、26file、書換えなし。 |
| 2 | 同上 | `node ./node_modules/typescript/bin/tsc -p ./tsconfig.json` | Exit 0。 |
| 3 | 同上 | `node ./node_modules/@biomejs/biome/bin/biome lint . --error-on-warnings` | Exit 0、26file。 |
| 4 | Repository Root | `node --test --test-concurrency=1 ./40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts ./40_Develop/mcp/tests/integration/cros-shared-server.integration.test.ts ./40_Develop/cros/tests/system/session-access.contract.test.ts` | 6／6 Pass、0 Fail、0 Skip、1,585.3017ms。 |

Source・実入力・検証器は実行前後で一致した。この文書や品質投影の後続Hashを、試験実行時のHashへ読み替えない。

## 独立確認と是正

初回の三観点は全て完了し、Minor Finding三件を検出した。全結果を統合してから、指定箇所だけを是正した。

| Finding | 原因と是正 |
|---|---|
| `SG-D01` | 独立責務のあるFixture Port十propertyに固定Headerがなかった。各直前へ責務・Trace・入力・観測・Oracle・Memory限定cleanupを追加し、Port本体・返却・計数を維持した。 |
| `SG-Q01` | 成功literalと期待件数だけでは実結果field・終了状態を再構成できなかった。実応答、計数、比較値、再許可、closeと新規接続結果を診断へ結合した。拒否Oracleは弱めていない。 |
| `SG-Q02` | npm経由の実行物をHash固定していなかった。旧runを保持し、固定wrapperと検証器Hashを伴う新しい実行へ分離した。 |

是正後、作成担当と別の確認者が同じ三対象固定版と旧／新原記録を読取り専用で再確認した。技術・安全、文書・追跡、品質・直接影響は全て限定Pass、三FindingはResolved、新規Finding 0。開始・終了Hashは上記固定値から不変だった。確認者は再実行せず、原記録の6／6結果、前後一致、実観測の搬送を照合した。

このPassはコード・Trace・実行根拠の限定確認である。後続の品質投影文書差分は別の固定集合で確認し、ここから文書差分全体のPassへ流用しない。

### 品質投影の機械確認

九fileの独立確認で`SG-P01`（Minor）を検出した。現在の未観測数と観測済み数の旧表示がReality Audit内の二段落に残っていた。現在表示だけを13件観測済み・33件未観測へ是正し、旧投影の57件、旧版の署名根拠と履歴内訳は変更しない。修正後はConsumerと集合照合を新しい記録へ再実行し、同じ九fileを再確認する。

製品の`parseRepositoryQualityProjectionMarkdown`で七必須項目、13／46と33／46、全体未完成、方式の設計判断待ちと新実Task停止を確認した。定義の「検証項目」章だけから176件・重複0を抽出し、132 Relation、Relationなし44、移管46、未知移管ID 0、適用一覧13件を照合した。補足表を含む初期の診断抽出は集計に用いていない。これは集合・表示の整合であり、既観測十二項目の全Evidence再実行ではない。

実行区間はUTC `2026-10-02 07:57:43`〜`07:57:45`、Exit 0。文書、Consumer、定義、Symbol、試験、Node実行物の一意四十一入力Hashは前後一致した。実行コードと前後snapshotは同じRepository-local保存先の`projection.json`、SHA-256 `db2f94b1e278ac7aa6a024eb88c7bb76c39c50da8896ff3a50e0f967c199ba50`へ保持する。本節追記後のHashは実行時Hashと区別する。

Repository Checkerは別の診断としてExit 1、Error 1／Warning 0。既知の`stable-release-tag-identity-mismatch`だけであり、公開v0.21 tagを作業HEADへ変更せず全体Passとも表示しない。`git diff --check`はExit 0だった。

`SG-P01`是正後の再確認はUTC `2026-10-02 08:04:43`〜`08:04:45`、Exit 0。旧現在件数の二表現が残っていないこともassertへ追加し、同じConsumer、集合と四十一入力の前後一致を確認した。新記録は`projection-rerun.json`、SHA-256 `b88a7ca1da95fd47edade7413490e8ae41a594eeb650d314ac4912f0a42fda3c`。旧記録は変更せず保持する。本段落追記後の文書Hashは再確認時Hashへ遡及適用しない。

### 品質投影を含む九対象の限定再確認

作成担当と別の確認者が、上記九fileと四原記録の固定版を読取り専用で確認した。技術・安全、文書・追跡、品質・直接影響は全て限定Pass。`SG-P01`はResolved、新規Finding 0、対象と原記録の開始・終了Hashは一致した。今回の結果書戻し前の対象は次のとおり。

| 対象 | SHA-256 |
|---|---|
| `07_Quality/01_Quality_Center.md` | `8bea0ce78736ff97e14160c5837be0b992b513491ec68d131d8b5c38cfebe6c4` |
| `07_Quality/04_Quality_Integration.md` | `2faa6abfddbc1f360c9b3e02aa66c62ed7874ed0e742cbb0190723c20946c772` |
| `07_Quality/05_Current_Implementation_Reality_Audit.md` | `46a1cb2f5907dc2c8d44a0a90cda454d7dff5f161eb60d30198742a526e69479` |
| `07_Quality/Registry/test-catalog.json` | `22001b1dfc58118c5c6d9b04a5126610df9328117543f035e1959fba37be5399` |
| `40_Develop/mcp/symbol.json` | `b17122deaba5f799c83cc5bf6a686788b8ec2c5117dfdb61d2c33a93e966e5dd` |
| `40_Develop/mcp/tests/system/cros-projection-non-disclosure.contract.test.ts` | `4a28d7c4b655f0faa1814e09c16cbb58c5f50ea27e93f981e0c3aa43863ce54d` |
| `99_Roadmap/Changes/CHG-000082/change.md` | `79dc9c3a91d49f9f7c5d1f1d59c4fd795a327916e0e93b1f0f16e289bec2e24a` |
| `PROJECT_CONTEXT.md` | `b0588c5d002274309f101fc4bab50563accd76011ad02eea636cf7cc8a1c9541` |
| `99_Roadmap/Changes/CHG-000082/Evidence/261002_shared-gateway-non-disclosure.md` | `a4c521c592f457a1d5b495dcaf323cb63d827a8a9af9ab84f077158ed5e10cd9` |

一項目への観測適用は可と確認した。全CROS、Credential Lifecycle、実Filesystem／OS Root、CLI、Internet TLS、内部全handle、Host Recovery、Provider、全体Quality／Release成立は対象外である。旧限定Pass・初回Finding・四原記録・実行時Hashを保持し、現在Hashを遡及適用しない。

この節とChecklist一行だけを、全確認完了後の結果として書き戻した。結果だけの書戻しは確認者と整合済みで、件数、Authority、Scope、人間判断待ち、実再起動・実削除の別承認、新実Task停止および他のOPENは変更していない。

## 品質への適用と残る事項

`RFD-ST-004`の定義された三入力分類、対象解決・内容取得要求、非開示Oracle、対象Repository Effect 0にだけ適用する。既観測12件に一件を加え、46件中13件観測済み・33件未観測。設計176件、Relation一意132件・Relationなし44件、旧v0.21の108／130と22未観測は変更しない。108＋13＝121は算定候補であり、現在全体のEvidence適用を証明した集計ではない。

`RFD-ST-003`のCredential Lifecycle、`RFD-ST-016`のHost Access Recovery、その他CROS／Handoff義務、Hybrid受入、全体集計とTrust Scope対応は未解決のまま保持する。Windows再起動方式の設計判断待ち、実再起動と実在三件の削除の別承認も変更しない。新Provider依頼、Docker操作、残存Rootの削除、署名またはRelease操作は行っていない。

## Checklist

- [x] 個別義務から入力・公開入口・正常対照・反例・終了後条件を導出した。
- [x] Fixtureと実HTTP、本番Composition、内部観測と公開非開示を区別した。
- [x] Formatter・型・Lintの後に局所試験を実行した。
- [x] 入力・検証器・実結果field・終了後結果を同じ実行へ結合した。
- [x] 初回の指摘と是正後限定Passを別の固定版として保持した。
- [x] 義務・分母・旧Evidence・Authorityを変更せず一項目へ限定した。
- [x] 品質投影を含む九対象を同じ固定版で三観点から独立確認し、SG-P01解消と限定Passを記録した。全体成立へ拡張していない。
- [ ] OPEN: 全体集計、未観測の他義務、Host回収と実Provider検証は未完了である。
