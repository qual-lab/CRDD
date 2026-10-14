# Access Management再編の検証・後続確認

成果物種別: 検証結果
状態: Verified（人間承認した今回の限定区切り。実Host ST／人間UATは後続E2E）
対象変更: [CHG-000082](../change.md)
維持責任者: Qual-Lab
確認日: 2026-10-14

## 1. 結論と利用者への影響

Access Management、Domain、Workbench、MCPの専門Owner接続と旧CROS Package撤去を確認した。検証義務照合で見つけた試験不足、Portfolio表示契約、現在Architecture記述を是正し、Source／契約の独立再確認は残指摘0。最終候補の対象回帰は480件成功・失敗0、人間UAT1件Skipで終了した。結果・現在表示を含む固定Tree`8e8bb0c5c8ce281cefaa6f14d8e8ffda303f16ca`の最終限定独立確認もPass・全重大度残指摘0で、今回の区切りが成立した。確認後の同期は結果状態だけであり、意味・件数・未完了Gate・Source／Testは変更しない。

初回実Host・鍵実入口と利用者の理解確認は、人間の2026-10-14判断により後続E2Eへ回す。未検証をPass・免除へ変更しない。今回の区切りが成立したらコミット・プッシュし、計画済みのDocker周りの責務分離・大改修へ進む。Access Management全検証完了、v0.22完成またはリリース承認とは区別する。

## 2. 固定対象と再現条件

| 項目 | 対象・実観測 |
|---|---|
| Repository | Qual-Lab / CRDD、作業ブランチ`codex/feature/v0.22` |
| Git Object Format | `sha1` |
| 基準・Observed HEAD | `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` |
| 先行候補Tree | `878cf73c93a12344020bf7897f8002a4e1d759a3` |
| 先行是正候補Tree | `ae2259184f68ec579a65ce9a58553411f81625ca`。承認後のPortfolio切替前であり、現在方式の全体成功へ流用しない |
| 最終検証候補Tree | `635ce3f9e080768572116b0b4923e828b61ca291`。Workbenchの旧missing試験入力2か所をnullへ是正し固定。直前候補は`3e88db83eac460397dea0a2fb38d0eae867bffc5` |
| 対象集合 | Tree内の`40_Develop/`、`template/`、現行Architecture・Quality・変更計画。各Pathのmode・Blob OIDは`git ls-tree -r <Tree>`で再導出可能 |
| 実行中の変更 | 最終検証候補固定後、CHGの現在／履歴表示だけを同期。Source・試験・fixtureは不変更。以下の結果同期も文書だけであり、検証候補のPackage Treeを変更しない |
| 実行入力の同一性 | 直前・最終検証Tree間でAM `e34f28b4920bdb807497b21adb4d0857c27f9343`、Domain `47797f89beb53317ed18bb03791660d4de291cb5`、MCP `6409b35baa2adaeb55751f35118bc0797e2d4b70`、Runner `e4f6fba559d73fbc8384091369c33bdb213bf7b3`が完全一致。最終Workbench Package Treeは`2cd04c4e1fee67e0d565199d960d286f47a60097` |
| Runtime | Windows、Node v24.19.0、TypeScript7.0.2、Biome2.5.6。Workbenchの実依存はReact19.3.0、Vite8.3.1、Plugin6.1.1で`npm ls --depth=0`正常 |
| 実行入力 | Repository-local自己生成Root、loopback、公開試験TLS fixture、非秘密の固定資格・本文。実Host資格、Docker、外部AI依頼・署名を使用しない |
| 出力保持 | 完全出力は端末で確認し、以下のコマンドと固定Sourceから再生成する。実行別ログ・Source複製・生成物書庫は追加しない。未取得範囲を成功へ補完しない |

Treeは通常Git Objectの形式であり、独自Hash集約・Manifest Schemaを作らない。最終Commitとの対象Pathの同一性を区切り前に照合する。

## 3. 実行結果

| 対象・コマンド | 結果 | 限界 |
|---|---|---|
| Access Management `npm run check`後`npm run test:run` | 152成功、失敗・取消・Skip0、Exit0、216524.1766ms | Package Tree一致の範囲に適用。実Host TTY・人間理解は証明しない |
| MCP `npm run check`後`npm run test:run` | 86成功、失敗・取消・Skip0、Exit0、107182.8058ms | 初回入力は自己生成状態。実Host初回設定の縦断ではない |
| Domain `npm run check`後`npm run test:run` | 120成功、失敗・取消・Skip0、Exit0、38558.6969ms | 状態値や件数から未観測資源の不存在を推定しない |
| Workbench静的3軸後、全Integration・Credential Browser・公開CLIをNode testで直列実行 | 78成功、失敗・取消・Skip0、Exit0、369515.3755ms | 実Browser11場面を含む。人間の理解・達成UATを代替しない |
| Verification Runner `npm test` | 44成功、Fail0、人間UAT1 Skip、Exit0、13265.5236ms | Package Tree一致の範囲に適用。SkipをPassへ加算しない |

Workbench実行コマンドは`node --test --test-concurrency=1 ./tests/integration/*.test.ts ./tests/system/credential-administration-browser.contract.test.ts ./tests/system/workbench-server-entry.integration.test.ts`。各コマンドの作業Directoryは該当Package Rootである。先行Domain118/120・Workbench76/78の失敗は、品質投影固定キー欠落と設定Readerのraw Root再構築に対応し、先行候補のPassとして保存しない。

## 4. Access Managementの検証義務対応

本表は[QA-000007](../../../../07_Quality/Definitions/QA-000007/quality_definition.md)の17項目を母集合とする。「確認済み」は当該義務全体の固定入力・Oracleを確認した範囲、「部分確認」は記載Oracleの成立だけを確認した状態である。未観測をPassへ補完しない。承認済みPortfolio契約のSource／Consumer切替・局所反証・全回帰・独立照合後の評価は確認済み13、部分確認2、未実施人間UAT2であり、回帰Case数とは別の集計である。部分確認2件と人間UAT2件は後続E2Eへ保持する。

根拠の実在試験は次の通り。各Package全回帰と個別Caseのassertionを組み合わせ、HeaderのTraceだけを成立根拠にしない。

- [AM保存IT](../../../../40_Develop/access-management/tests/integration/state/file-store.contract.test.ts)
- [AM初回接続IT](../../../../40_Develop/access-management/tests/integration/credential/initial-connection.contract.test.ts)
- [MCP能力IT](../../../../40_Develop/mcp-server/tests/integration/access-capabilities.integration.test.ts)
- [Workbench管理IT](../../../../40_Develop/workbench-server/tests/integration/management.integration.test.ts)
- [Workbench Browser ST](../../../../40_Develop/workbench-server/tests/system/credential-administration-browser.contract.test.ts)
- [MCP公開CLI ST](../../../../40_Develop/mcp-server/tests/system/streamable-http-transport.integration.test.ts)

| Local Item | 評価 | exact試験・Case | 成立を確認したOracle | 未観測・残る照合 |
|---|---|---|---|---|
| RFD-ST-003 | 確認済み | MCP公開CLI STの初回限定接続・本人・失効、Workbench Browser STの鍵交換とcontent-operations | 現在本人・Role・失効拒否・非開示。同Browser・同鍵・同内容要求で時刻のみ1年後の結果とReader数一致、AM全byte不変 | なし（自動資格操作0はSource到達経路・byte不変・新資格／Secretなしの組合せで評価。動的呼出しcounterの直接採取とは区別） |
| RFD-ST-004 | 確認済み | Workbench Browser ST content-operationsの失効・旧Role・Exposure外・管理のみ・Root不明の五反例、既存内容操作の正常対照 | 固定403本文、未許可内容Reader0、AM byte・対象本文不変、観測器の実open正対照、Browser／Listener／Root清掃 | なし（Root不明ではmanifest観測を許す。全target I/O 0とは主張しない。旧Gateway根拠は非適用） |
| RFD-UAT-007 | 未実施人間UAT | QA-000007の人間Scenario。自動試験を代替根拠にしない | 未確認 | Role・UUID・表示名・鍵の区別と利用者理解。後続E2E |
| RFD-IT-013 | 確認済み | AM保存ITの拒否・実体不成立・解放不明、MCP能力ITの実HTTP内容要求と時刻反例 | 同鍵・同要求・時刻のみ1年後の同結果・二Reader exact・AM全byte不変。資格照合と内容拒否を分離し、未許可Reader0・能力不明非返却 | なし（資格mutationへのSource到達経路なしとbyte不変等から自動資格操作0を評価。直接mutation counterの採取ではない） |
| RFD-ST-016 | 部分確認 | Workbench Browser STのissue／self／all、AM保存ITのHost交換composition | Browser一度提示・次操作消去、模擬TTYの提示・保存分離 | 実Hostを含む四入口組合せと実TTY。後続E2E |
| RFD-IT-017 | 確認済み | AM保存IT「提示の先行記録と確認は別改訂・exact Bindingで一回だけ保存する」「通常鍵発行の保存・読戻し・清掃故障はSecretを返さない」、Workbench鍵POST | exact相関、提示三状態の別改訂、保存不明からSecret返却0、非認可Effect0、一度提示と終了資源 | なし（通常発行ITの範囲）。本人受領・実Hostは別の義務 |
| RFD-IT-018 | 確認済み | AM保存IT「通常鍵失効は最後の管理資格も失効し遅延提示で復活しない」「遅延提示確認は各Binding不一致と失効を拒否する」、Workbench鍵POST | 独立失効、次要求の旧鍵拒否、他資格保持、遅延提示による復活0、追加発行・交換0、終了条件 | なし（失効ITの範囲）。既に開始した処理の取消保証へ拡張しない |
| RFD-IT-019 | 確認済み | AM許可集合・比較IT、Domain本文／集約IT、MCP実HTTPとWorkbench管理IT・Browser／Inspector | 認可・Root不明は全体停止、文書未確認・競合はnull本文／版で部分表示。三Identity競合の外国値非開示、公開直前集合差拒否、取消とdescriptor回収、completeだけリンク、状態相関の矛盾拒否 | なし（同Pathの物理実体不変や複数Repository原子的Snapshotを保証しない） |
| RFD-UT-020 | 確認済み | [固定管理判定UT](../../../../40_Develop/access-management/tests/unit/access/management-permission.contract.test.ts)の全4 Case | 三Role×11要求、Role変更前後全組合せ、未知・禁止field・Accessor／Proxy拒否、入力不変 | なし（純粋判定の宣言範囲）。実保存・実入口の保証へ拡張しない |
| RFD-IT-021 | 確認済み | AM保存ITの七保存・故障反証、Workbench管理ITの登録解除中の既開始読取り保留 | 登録と公開の分離、解除で登録・Exposure両除去と本文保持。解除完了時の旧read未終了、解放後403・非公開・joinを別観測 | なし（解除成功を既開始処理の取消完了へ拡張しない） |
| RFD-ST-022 | 確認済み | Workbench Browser STのmanagement／cros-management、MCP能力ITの十操作、Workbench管理ITの旧read分離 | administrator不在managerの七保存、自己内容変更後fresh GET403と管理継続、登録直後の未公開、公開・解除・本文保持。登録Identity読取りexact1・拒否内容追加0 | なし（登録の正当なIdentity読取りと内容認可を区別。解除と旧処理終了はITの別観測へ接続） |
| RFD-UT-023 | 確認済み | [初回純粋判定UT](../../../../40_Develop/access-management/tests/unit/initialization/state-evaluation.contract.test.ts)の全3 Case | 初回24組合せ、欠測・未知の拒否、暗黙変換0、返却非共有 | なし（純粋判定の宣言範囲）。Host初期化完成とは別 |
| RFD-IT-024 | 確認済み | AM保存ITの初回相関・User・資格Case、AM初回接続IT、Host模擬TTY・MCP初回接続IT・Workbench connect POST | 相関と各出版順序、UUID・鍵追加0、限定要求のみ確認出版、読戻し・競合・取消・清掃・次要求認証 | なし（結合範囲）。実Host縦断はRFD-ST-026へ保持 |
| RFD-IT-025 | 確認済み | AM初回接続IT「初回確認の実Process喪失はbase保持とnext再観測を分ける」、AM保存ITのProcess喪失・交換引継ぎ、MCP取消・応答喪失 | 新Process再観測、各故障段階の既知出版保持、提示取消・遅延・重複通知終了、別交換と旧鍵拒否、禁止Effect0 | なし（結合範囲）。実Hostは後続RFD-ST-026で確認 |
| RFD-ST-026 | 部分確認 | MCP公開CLI ST、Workbench公開CLIの接続Case | 自己生成初回状態からの限定discoverと次要求、WB connect POST | 実Host→一度提示→実Surfaceの縦断は後続E2E |
| RFD-UAT-027 | 未実施人間UAT | QA-000007の初回達成・理解Scenario | 未確認 | 人間の達成・次操作選択と理解。後続E2E |
| RFD-UT-028 | 確認済み | [状態Parser UT](../../../../40_Develop/access-management/tests/unit/state/parse.contract.test.ts)の全7 Case | v2閉Schema、四初回変種、資格相関・歴史参照・交換状態、UTF-8容量境界 | なし（Parserの宣言範囲）。実保存と実入口は別 |

利用側のRCM-IT-010、EST-IT-002／010／014、EST-ST-013／015、EST-UAT-007／009は別の義務集合であり、AM17項目の分母へ混入しない。実Provider・Task全体・Docker持越し義務もこの試験成功から閉じない。

## 5. 残件と無効化条件

### 承認後のPortfolio是正・局所観測（最終Gate未完了）

2026-10-14の方針承認後、Sourceは五項目の中立Sourceと、Root不成立／文書未確認／Identity競合の分離へ切替済み。独立確認の三指摘に対し、公開API一覧、集合比較の正負例、Reader後のRoot不成立、実HTTPの公開前管理改訂差、実Browserの部分表示を既存試験へ追加した。新たな管理状態・Lock・Registry・Recoveryは追加していない。

| 局所確認 | 実測結果 | 意味上の範囲 |
|---|---|---|
| Domain本文Reader | 3/3、合計482.6022ms | 読取り中Root不成立でblocked、本文・版非返却、全descriptor回収 |
| AM集合比較IT | Case1660.7923ms | 順序差は一致、改訂・集合・範囲・Binding・manifest差とunavailableは不一致 |
| AM公開集合UT | 4/4、合計221.7679ms | 新共有比較APIを含むRuntime公開集合とRole判定 |
| MCP実HTTP | 1/1、Case4580.7924ms／合計5065.3483ms | 部分・競合表示、Root全体停止、読取り中改訂変化による結果非公開 |
| Workbench Build・実Browser local-connection | Build成功、対象Case21318.4295ms／合計21803.4769ms | 完全Sourceだけリンク、文書未確認・競合は日本語表示、foreign Identity非表示、修復後通常接続 |

これらの局所結果に加え、節3の最終回帰とSource／契約の独立再確認でRFD-IT-019の対象断面を照合した。旧方式の先行回帰を新契約Passへ流用していない。直前Workbench全回帰は77成功・1失敗（393662.8212ms）であり、missing Sourceに架空のrevisionを持つ旧fixtureが原因だった。2入力のみnullへ修正し、局所1/1（Case1492.03ms／全実行1986.7007ms）成功後、最終Workbench全78件を再実行して成功した。製品Sourceの追加変更や失敗の抹消はしていない。

全体Checkerは2026-10-14再確認で2941 errors・0 warnings、未合格である。Coordinator旧Native試験Symbol欠落、持越しDocker試験18型不一致、正式191項目の全体評価、実Host・鍵実入口・UAT・実Provider／署名E2Eを保持する。今回の区切りをこれらの全体Passとして扱わない。

Source、試験、QA義務、Package依存、実行入口、公開構成または結果意味を変更した場合は、影響した意味から回帰と独立確認を再導出する。過去Evidenceは改名・改変せず、この結果と混合しない。現在状態の投影は本結果と各Ownerを参照し、実行履歴を複製しない。

## 6. 義務照合後の局所補強（固定候補全回帰とは別）

本節はPortfolio方針の承認前に実施した局所補強の履歴であり、以下の未完了表示はその時点を表す。現在の結果は節1〜4を優先する。

2026-10-14、製品Sourceは変更せず、既存試験の不足反例を追加した。以下は節2の固定候補の実行後の差分であり、全回帰成功へ混入しない。

| 対象 | 局所観測 | 現在の扱い |
|---|---|---|
| RFD-IT-013の時間経過 | 本人readの同鍵・1年後反例1/1成功（対象Case 3894.9655ms、全実行4408.7549ms）。内容取得にも同じ入力・同じ二Reader対象・応答一致・管理File byte不変を追加し1/1成功（対象Case 2363.1651ms、全実行2910.4864ms） | 本人readだけでは成立とせず、内容取得の同要求試験・Source到達経路・資格操作非公開を合わせて上表評価。最終固定候補全体回帰／レビューは未完了 |
| RFD-IT-021の解除と旧処理 | 認可済み読取りを開始後に保留し、解除完了時に旧読取り未終了を確認。保留解放後403・非公開・joinを確認し1/1成功（対象Case 70281.5538ms、全実行70839.1663ms） | 先行失敗は試験側が内容範囲・Exposureを有効化しておらず、読取り未開始だった。実管理操作で前提を整えた成功と区別する。製品の時間設定・回復処理は不変更 |
| RFD-ST-022の管理三操作 | administrator不在managerで自己内容変更・内容拒否・管理継続・登録時非公開・公開・解除を確認。共有局所Case成功（対象Case 23939.0057ms、全実行24448.334ms）、単体局所Case成功（対象Case 12442.9083ms、全実行12973.3258ms） | 先行失敗は再取得中のForm欠測を試験predicateが例外化したもの。待機条件だけ是正。登録照合の正当な1openと、未許可内容の追加open0を分ける。製品Sourceの修正なし |
| RFD-ST-003／004の内容認可 | 静的3軸成功後、content-operations Case成功（対象Case 41256.4907ms、全実行41781.3285ms）。同Browserで時間だけ1年後の同結果・Reader数・AM bytes、五拒否反例の固定403・未許可Reader0・本文保持と既存CRUDを確認 | 最終実行中のSource／試験／fixture変更なし。先行診断はExposure外の別許可Root読取りを誤って未許可Readerへ加算していた。最終Oracleは選択した未許可Rootへ限定 |

MCP／Workbenchの書式・型・Lintは各Exit0。五項目の独立再照合は追加契約欠落・残指摘0で、実行待ちだったcontent-operationsも終端成功を確認した。この実行時点で製品Sourceの修正・新Framework・Portfolio表示意味の変更は行っていない。その後、2026-10-14に人間が「認可・Repository実体不明は全体停止、認可済み文書欠落・競合は不完全性を明示して部分表示」を承認した。RFD-IT-019は承認済み契約のSource／Consumer切替・検証待ちとして部分確認を維持し、この既存実行から新方式の成功を推定しない。
