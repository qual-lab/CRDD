# MCP Serverの公式SDK移行・Source再編

成果物種別: 変更計画の移管分析
対象: [第二段階](second-stage-plan.md)／`40_Develop/mcp-server`
基準Commit: `1b4d4c4f7`
状態: 対象1〜4の実装・最終固定回帰・独立再レビュー完了。正式QA・実Provider・Release成立は別途
維持責任者・判断権限: Qual-Lab
確認日: 2026-10-20

## 1. 結論と変更境界

利用者の添付方針に従い、公式SDKへProtocol・Transportを委譲し、本Packageを認証接続・Tool定義・入力と結果の変換へ限定する。Access ManagementのSource・保存形式・認証方式・Role・ACLは変更しない。業務状態は専門Ownerに残し、新しい認証基盤・Registry・Plugin・Recovery・永続状態を作らない。

これは配置だけでなく通信基盤の置換であり、非自明な実装変更として扱う。Architecture、Quality、配布Launcher、公開API、利用側と試験・台帳を伝播対象とする。技術・Security／取消終了・文書直接影響の独立レビューと、変更範囲の文書／不足影響監査を行う。CRDD準拠基準・採用権限・正式リリースを変えないため、準拠表明監査やリリース監査は今回実施しない。着手前の読取り専用確認は計画修正条件付きで完了し、以下へ統合した。

外部調査には公開Package名・版・公式規格だけを送り、Repository本文・秘密・利用者データを送らない。試験はRepository内の合成入力・localhost・子Processまでとする。外部AI、Docker、②の保持物の操作は含めない。実Client確認の送信・操作範囲は別途確定する。

## 2. 固定候補と添付案の補正

| 項目 | 確認結果・方針 |
|---|---|
| Server SDK | `@modelcontextprotocol/server` `2.3.1`を固定候補。Node要件`>=20`、既存の`>=24.12.0`を維持 |
| Node HTTP接続 | `@modelcontextprotocol/node` `2.1.1`を固定候補。peerはServer `^2.3.0`。同じ版番号と仮定しない |
| Protocol | 現行とSDKの`2026-07-28`を基準にする。添付のInitialize表現は`server/discover`と要求単位のmetadataへ補正し、旧Initialize互換受付を追加しない |
| 依存固定 | 実装採用前に公開型・挙動を照合し、製品packageとlockfileへexact版を接続。SDK依存追加を認証更新へ拡張しない |
| 初回接続 | SDKの自動discover応答だけではAM確認保存を代替できない。既存Ownerの保存・cleanup・取消再確認を必ず経由 |
| JSON解析 | 重複キー拒否は単なる重複ではない。SDKの同等保証を確認できなければ既存の最小検査を残す |
| 取消と終了 | Signal発火、Transport close、Owner処理のjoinを別々に観測。SDKへの委譲だけで終了完了を推定しない |

一次情報: [公式Serverリリース](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.3.1)、[SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)、[低水準Server](https://ts.sdk.modelcontextprotocol.io/v2/advanced/low-level-server.html)。公開npmメタデータでServerとNode版・依存条件・公開入口を確認した。Node `2.3.1`は存在せず、Serverの版番号の横展開を採用しなかった。

## 3. 23 Sourceの対応と目標配置

| 現行Source（srcからの相対Path） | 移管先候補・処置 |
|---|---|
| `access-management/adapter.ts`、`access-management/protocol.ts` | `tools/access-management.ts`へ操作・Schemaを同居 |
| `ai-profile/adapter.ts` | `tools/ai-profile.ts`へ移管 |
| `orchestrator/adapter.ts` | `tools/orchestrator.ts`へ移管、実Owner呼出し・結果検査を保持 |
| `orchestrator/protocol.ts` | Tool固有の型・Schemaをtoolsへ。共通ProtocolはSDKへ。単純移動ではない |
| `project-context/adapter.ts`、`project-context/protocol.ts` | `tools/project-context.ts`へ同居 |
| `runtime-activity/adapter.ts` | `tools/execution-status.ts`へ移管 |
| `topic-meeting/adapter.ts`、`topic-meeting/protocol.ts` | `tools/topic-meeting.ts`へ同居。保存・関係解決はDomainに残す |
| `workspace/adapter.ts` | `tools/workspace.ts`へ移管。Workspace状態は持たない |
| `request/access-resolver.ts` | `request/authentication.ts`へ現在認証・ACL接続を整理 |
| `request/initial-connection.ts` | 初回限定の既存保存接続を保持 |
| `request/discover.ts` | 標準discoverはSDKへ。初回確認用の安全検査を無条件削除しない |
| `request/parse-json.ts` | SDKのbyte解析と照合。必要な重複キー等の拒否だけ`request/validation.ts`へ集約候補 |
| `request/route.ts` | SDK Tool登録・Dispatchへ置換。旧Routerを転送wrapperとして残さない |
| `request/snapshot.ts` | 安全な構造検査を`request/validation.ts`へ集約候補。Proxy／getterを通常データと誤認しない |
| `transport/configuration.ts` | 非秘密配置設定の独立した保存・検査責務を持つため当面保持候補 |
| `transport/process-signal-shutdown.ts` | `transport/shutdown.ts`候補。SDK closeで代替できないOwner join・Signal受付を保持 |
| `transport/stdio.ts` | SDK標準stdio接続、EOF／出力失敗時の取消とjoin |
| `transport/streamable-http.ts` | `transport/http.ts`へ改名。SDK標準HTTP接続、入口認証・配置検査と終了保証 |
| `transport/types.ts` | SDKで置換できる型は撤去。CRDD要求認証等の共有型が実在する場合だけ責務Fileか型専用Fileに残す |
| `index.ts` | 実Ownerから明示export。SDK代替のProtocol補助公開はConsumer照合後に退役 |

```text
mcp-server/
├ src/
│ ├ index.ts
│ ├ transport/
│ │ ├ stdio.ts
│ │ ├ http.ts
│ │ ├ configuration.ts       非秘密配置設定（保持候補）
│ │ └ shutdown.ts            SDKだけで代替できない終了編成（保持候補）
│ ├ request/
│ │ ├ authentication.ts
│ │ ├ initial-connection.ts
│ │ ├ server.ts              同じTool定義を要求別SDKへ登録
│ │ ├ parse-json.ts          raw JSONの重複キー拒否
│ │ ├ snapshot.ts            getterを呼ばない所有入力
│ │ └ validation.ts          実測で必要と確認したCRDD入力検査だけ
│ └ tools/
│   ├ orchestrator.ts
│   ├ workspace.ts
│   ├ project-context.ts
│   ├ topic-meeting.ts
│   ├ access-management.ts
│   ├ ai-profile.ts
│   └ execution-status.ts
└ tests/                     既存責務の試験を新入口へ追従
```

添付のAfterは論理構造であり、File数を完成条件としない。configurationの16KiB／UTF-8／exact Root／File Identity検査と、shutdownのSignal／joinは独立した保証を持つため、Transportへ機械的に埋め込んで巨大化させない。validationは解析名だけで分割せず、必要な既存検査の実共有を確認する。新しい共通Server／Tool Registryを作らない。

命名の確定判断: 利用者が`transport/http.ts`と`tools/execution-status.ts`を採用した。後者は実行中Task・進捗投影とページ単位の実行履歴を取得する読取りToolであり、OS／Dockerの環境診断ではない。実File・import・公開入口・台帳・現行文書を追従し、Sourceの公開SymbolもExecutionStatusへ統一する。追加指示により通信上のTool名も`crdd.get_execution_status`へ変更する。旧名`crdd.get_runtime_activity`の互換受付は残さず、Clientの呼出し名を新名へ移行する。引数・結果、Orchestratorが所有する観測型・構成入力は変更しない。過去Evidenceと本計画内の過去経過は当時の記録を維持し、現行契約として参照しない。

## 4. 能力・利用側・基準根拠

| 能力 | 新Ownerと維持条件 | 利用側・検証 |
|---|---|---|
| discover／Tool一覧・実行 | SDK Protocolとtools。引数・Tool結果維持、実行状況Toolだけ採用済み新名へ変更。他の名前は維持、標準Protocol errorは別照合 | 本Package全試験、通常Launcher、SDK Clientの合成接続 |
| 単体／CROS選択 | Launcher構成とAM要求認証。設定の存在で自動共有化しない | `template/tools/crdd-mcp-server.ts`、設定例、起動案内 |
| 初回資格の接続確認 | `initial-connection.ts`→既存AM。通常Tool依存なし、完全要求だけ保存、秘密応答なし | `initial-connection.integration`、QA-000007、QA-000009のEST-ST-015 |
| Role／Repository／Content／管理操作 | AM現在判定を要求ごとに取得。tools/listだけで認可完了としない | access-capabilities／access-management-results／Profile／Topic Meetingの実保存・実HTTP |
| Objective／Workspace／Candidate | Orchestrator公開API。実行対象・固定・採否・Mergeの管理をMCPへ移さない | Orchestrator workspace-lifecycle、Coordinator compositionと検証Toolの結果Inspector利用 |
| Project Context／活動 | DomainとOrchestratorの意味・投影を維持、AMは許可集合を解決 | Project Context／runtime-activity既存試験 |
| stdio／HTTP取消・終了 | SDK接続と最小shutdown。要求・Stream・Socketの所有とjoin結果を区別 | EST-ST-012／013、transport-lifecycle、実localhost／子Process反証 |
| 設定／Source利用側閉包 | 現行公開境界へ追従、内部補助を一括公開しない | VC consumer-closureのPath検査、Checker公開集合／Header／台帳、Launcher型Project |

現行根拠は[MCP詳細設計](../../../06_Architecture/Details/mcp-server/01_Architecture.md)、[Quality対応表](../../../07_Quality/04_Quality_Integration.md)、[Transport検証設計](../../../07_Quality/Definitions/QA-000009/quality_definition.md)から確認する。`0e26cf797`のAM再編、`d4edcd1e6`の旧Store撤去後接続をGit履歴で確認した。過去の局所成功と新SDKの成立は分け、過去Evidenceは改名・書換えしない。WorkbenchはMCPのConsumerではなく、独立した専門Packageの利用側のままとする。

RootにはProtocol補助・key集合・直接Handler等も公開されている。SDKの代替APIと、本番・試験・配布・診断Consumerの全数対応が必要で、公開集合の削除はFile移動に混ぜない。現行Launcherは341行の構成と受付を持つ。Packageの`bin`追加・`cli/command.ts`への集約要否は通常入口の責務を照合して決定し、薄い転送Fileを増やすこと自体を目的にしない。

## 5. 反証と検証順序

1. 基準版の型・静的検査、全MCP試験結果を確定。新SDKへの成功転用はしない。
2. Repository-localの短命SDK検証領域で、固定依存の公開型、discover、metadata、初回限定hook、エラー、重複キー、未知field、最大byte数を確認。調査物は終了時回収する。
3. 正規認証／無資格／失効／初回だけの四分割、Header不一致・重複・取得不能を、認証・Effect前／実行中／結果公開前の各段階へ接続する。情報不足は通常資格や許可集合なしへ丸めず拒否する。
4. 認証接続・Tool・Transportを順に実装。ACLの変更を共有Tool登録の書換えで表さず、要求ごとの現在判定を維持する。
5. 実Stream／localhost／子ProcessでEOF、切断、出力失敗、取消後遅延完了、二重close、Signal、body待機・slow入力の終了を反証する。close完了だけからOwner終了を推測しない。
6. 旧Protocol／Routerの除去、全Consumer、公開API、Architecture・Quality・Symbol・Catalogを照合し、回帰と固定候補の独立レビュー／影響確認へ渡す。

SDK高水準Tool登録を第一候補とするが、動的ACL・既存の閉じたSchema／結果を損なう場合は公式低水準Serverも比較する。自前Routerを残すためだけに低水準を採らず、保証を満たす最小APIを選ぶ。SDK採用だけで入力保証を失う場合は既存検査の局所維持が代替であり、保証弱体化や新Frameworkの追加を自己決定しない。

## 6. 初回棚卸し時点の結果・未確認（過去経過）

着手前の独立確認で、初回discover保存の迂回、重複キー拒否の喪失、取消通知とjoinの混同、Protocol補助公開の移行漏れを反証軸へ追加した。人間の追加判断が必要な差はまだ確定していない。基準版の整形・型・Lintは成功。既存全MCP試験は終了1で、`access-management-results`のnormal fixtureに旧Producer形状の追従漏れを検出した。現`updateUserName`はAM内部結果ではなく`ManagementOperationOutcome`を返すが、fixtureは内部理由・secondaryFailure・Path付きの旧値を差し込んでいた。管理read／本人readも旧snapshot形のため、一つのProducer契約追従として扱う。これはSDK変更起因ではない。

初回棚卸し時点ではSDKの製品依存は未採用だった。Repository-localの専用調査領域に固定版を取得し、合成入力だけで次を実測した。

| 確認 | 結果・設計への反映 |
|---|---|
| SDK ReadBufferの重複JSONキー | `id:1,id:2`を最後の2として受理。既存の重複キー拒否を入口で保持する |
| `serveStdio`のdiscover登録 | Factoryで上書きしたHandlerは0回、自動discover成功はprivate／TTL 0。AM確認保存を通常の登録Handlerだけに接続できない |
| 公式Transportへの単純connect | 同じmodern要求でMethod not found。接続だけで公式entryの規格選択を代替したと扱わない |
| 終了 | 今回の両構成はclose後の入力data監視0。Owner Effectや全取消条件を観測した試験ではない |

最小の接続案は、公式entryの前に既存の完全要求・Header・認証・初回確認を置く局所Gateである。初回用には通常Toolを構成せず、不正／認証失敗／保存失敗／開始前取消ではSDKを呼ばない。既存AM確認保存の前後に同じ取消を確認する。Gateで読んだ本文をSDKへ渡す場合は、同じ検査済み本文・byte上限を使い、再読取りや上限外再蓄積を行わない。保存後のSDK拒否・応答不能を保存未成立へ変えず、自動再確認しない。通常要求は毎回のAM認証・Tool実行時ACLを維持する。便利な起動関数の不足を補うためにSDK内部/private APIへ依存せず、自前Protocolも再構築しない。この案は独立した読取り専用確認で妥当と確認し、実装前の反証条件へ追加した。

既存fixtureは公開Outcomeを型付きで注入する形へ追従する。MCPは無変更搬送・非開示・サイズ・取消を検査し、旧内部理由の変換はAM Owner自身の検証へ接続する。初回棚卸し時点ではfixtureも未編集だったが、以下の実装段階で是正した。非公開関数のPackage間deep importや検証義務の無言削除で埋めない。

目標配置・新Protocol全体の互換・Client互換・移行完了は未成立。HTTPの局所接続から残るstdio、Tool別登録・公開API、旧Router撤去、配置へ順に進む。

初回棚卸し2文書の独立技術・文書／影響確認は修正必須指摘0件。外部の低水準Server解説リンクは確認者側で取得不能であり、リンク切れと断定しない。今回取得した調査用SDK・合成Probe・npmメタデータcacheは、用途限定Rootとlink不存在を確認して回収した。過去の試験物や②の保持物は変更していない。

## 7. 1〜4の最終接続候補 — 2026-10-20

利用者が一括実施を採用した四項目は、stdio SDK接続、Orchestrator Tool移管、旧Router／Protocol重複公開の撤去、Client接続と最終回帰・独立レビューである。新しい認証・Registry・永続状態・Lock・Recoveryは追加しない。

- `tools/orchestrator.ts`へ固有Schemaと処理を同居し、旧二Fileを撤去した。共通の閉入力・結果包絡だけを内部`request/validation.ts`へ残した。
- `request/server.ts`が同じTool定義とOwnerを公式低水準Serverへ登録する。旧`routeMcpRequest`と型・Fileは撤去し、本番Launcher・現在認証・限定Orchestrator入口は要求別Factoryへ接続した。
- stdioは外部の有界Queueと逐次性を維持し、一要求だけを内部の公式Transport／`serveStdio`へ搬送する。Owner join→内部SDK回収→外部出力callback完了まで次要求へ進まない。現在IDの取消通知だけを待機列から分離し、未知ID・古いIDを流用しない。外部Streamを要求単位で破棄しない。
- HTTPも同じFactoryと元入力を使い、要求ごとの現在認証・初回保存・Header／Origin／JSON検査、取消後の出力抑止とOwner joinを維持する。
- Rootの汎用Protocol補助を公開しない。直接試験は試験用の合成包絡を公式SDKへ送り、同じFactoryが保持した元入力で検査する。getterをJSON変換で実行せず、別dispatchも作らない。
- 公式Client `2.3.1`をexact開発依存へ追加した。modern規格固定で公開stdio Process・実HTTPのdiscover／一覧／実行が成功し、HTTP旧名拒否も確認した。既定legacy規格や購読の対応を主張しない。

局所4試験は同一IDの逐次性・出力callback待機、取消通知とOwner join・意味cleanup不明、待機小frameの総128KiB、外部出力故障からの取消・joinを確認した。探索全回帰は92中91成功・fixture 1失敗で、Mock設定より先に試験補助がAMを読み込んだ原因を特定し、補助の読込みをMock後へ移した。fixtureの3経路は是正後成功。公式Clientを含む最初の固定全98試験は成功したが、独立レビューが追加反例を検出したため、この結果を最終是正後へ流用しない。外部AI・Docker・②保持物の操作はない。

独立レビューの4指摘を統合した。stdioのFactory拒否が文字列のバックスラッシュnで終わる不具合は実改行へ、Factory生成中の取消が要求前に配送される不具合は元要求→保留取消の順へ限定修正した。既存lifecycleへ拒否／初回保存失敗と次frame、生成中取消・joinと次IDへの非伝播の2反例を追加し、stdioの6試験が成功した。Orchestratorの現行Traceabilityの2Pathだけを新Tool配置へ追従し、partial・段階・歴史Evidenceは不変。writeと内部stdio編成のHeaderを実署名とI/O Effectへ訂正した。

是正後の固定候補で`npm test`の整形・型・Lintと全100試験が成功した。独立再レビューは4件解消・追加指摘0件、独立lifecycle 10試験と公式Clientのstdio／HTTP 2試験も成功した。Checkerの公開／Header／QA接続3試験、Version Controlの静的検査・Consumer 12試験、Coordinator／Orchestratorの型検査も成功。Sourceの旧Router・旧Path・旧Root補助の利用側残存はない。これで今回の1〜4を完了とするが、Repository全体の既知QA不合格・実Provider・実データ移行・UAT・統合・Releaseは完了扱いにしない。

## 8. HTTP先行接続・配置移管の過去経過

構造移管の追加候補では、Access Management／Project Context／Topic・MeetingのSchemaと既存処理を各`tools/*.ts`へ同居させた。AI Profile・Workspaceもtoolsへ、要求認証接続は`request/authentication.ts`、Signal終了編成は`transport/shutdown.ts`へ移した。Root公開Symbol・機械値・専門Ownerは不変。統合したSourceの台帳は一File一分類へまとめ、旧protocolへの試験参照を同じToolの実装項目へ追従した。Checkerの明示公開Module集合とVersion ControlのConsumer確認も移管先へ更新した。OrchestratorのTool／共通Protocol分離、stdioのSDK接続と旧Router撤去は残るため、この配置候補だけで全体完成とはしない。

この配置候補はMCP全92試験、Version ControlのConsumer確認12試験、両Packageの整形・型・Lint、Checkerの公開／Header／QA接続3試験が成功した。限定独立レビューは指摘0件、importと説明を除く本文一致・初期化順・参照追従を確認し、独立10試験も成功した。独立確認の初回sandbox実行7成功／3失敗は環境制限として別記し、成功へ換算していない。stdioの着手前確認では、SDKへの単純置換で逐次性・待機総byte・出力callback待機・EOF後の応答が変わることを確認した。次の接続は既存Queueと終了編成を局所Adapterとして維持する案であり、まだ実装済みではない。

追加の名称確定後、`http.ts`と`tools/execution-status.ts`への移動、公開Symbolと通信名の追従を実施した。新名の固定・公開定義、旧名拒否とReader零回、新名のReader一回を既存EST-IT-014で確認した。整形・型・Lint、Checkerの公開／Header／QA接続3試験、最終MCP全92試験は成功。独立した名称・直接影響再レビューは指摘0件、名称と取消joinの独立2試験も成功した。試験補助関数のHeader不足を検出し、補記後に再検査した。通常sandboxのHTTP接続制限による停止は、対象Processの同一性を確認して終了し、許可されたlocalhost試験として再実行した。外部AI・Docker・②の保持物の操作は行っていない。以下の91件は改名前の限定結果である。

公式依存2Packageをexact版とlockfileへ採用し、HTTP要求ごとに`createMcpHandler`とNode公式接続を構成した。既存の入力・認証Gate、完全discoverに限る初回確認保存、現在認可、Ownerの取消・joinを維持する。SDKには検査済みの同じbodyを渡し、Tool callbackは既存結果のbodyだけを返す。Protocol errorはSDK型へ変換し、EnvelopeをTool結果へ二重格納しない。現在は旧Handlerとの接続段階であり、Tool登録と旧Routerの全面置換を完了したとは扱わない。

SDKのHTTP error配送と既存公開契約の差は、非公開Toolの`-32601`→404、全応答no-store、取消済み要求の書込み0へ局所的に適応する。標準の未公開ping・旧Initialize・通知の追加有効化はしない。stdioの通知・逐次実行・待機byte総量は別途接続する。

AMの本体・公開API・保存は不変。MCP fixtureの注入を公開Outcome型へ更新した。旧内部理由14入力と管理読取り・本人の内部field除去の反証は、既存AMの`public-api.contract` Unit（RFD-UT-020）へ移し、公開搬送試験から内部処理へdeep importしない。AMの3 Unit、MCP fixtureの3試験、初回接続と既存lifecycleの9試験、追加SDK搬送・同期例外非開示を含むlifecycleの4試験が成功した。両Packageの整形・型・Lint、Checkerの公開／Header／QA接続3試験も成功した。

探索回帰は91中90成功・1失敗。SDKがServer終了後の取消errorを応答する差を検出し、従来の切断契約を維持するため、Node応答AdapterのwriteHead／write／endで同じSignalを再確認する最小修正を行った。Owner join、SDK close、既存試験の期待値は不変。当該Signal・切断3試験は是正後成功。探索90/91を固定候補の成功として流用せず、新候補の全回帰で確認する。

独立レビューは上記取消配送と、計画の現在地が初回棚卸しのまま残る2指摘を返し、両方を是正した。レビュー依頼直後に限定Formatterを実行した手順逸脱があったため、表現だけの変更でも候補を再固定し、旧候補の確認を完成根拠に流用しない。是正後の固定MCP全91試験は成功、独立再レビューの追加指摘0件、独立Signal／切断・lifecycle計7試験も成功した。これはHTTP接続の限定結果であり、Package再編全体の完成ではない。

通常sandboxでのlocalhost EACCESと、そこから待機した自己生成試験Processを実装故障と分けた。exact PID・親子関係・試験コマンドラインを確認して当該Processだけを終了し、残った専用Rootは単一の模擬管理者・登録／公開対象0・自己生成File一つだけであることを確認して回収した。②の保持物と実資格には触れていない。
