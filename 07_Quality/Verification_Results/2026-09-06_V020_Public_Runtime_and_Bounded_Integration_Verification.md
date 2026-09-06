# v0.20公開Runtimeと限定分散の固定候補検証結果

状態: 署名前の利用側閉包を構造是正済み。独立再レビュー待ち
担当責任者: Qual-Lab
最終更新日: 2026-09-07

## 対象

- 対象変更: [CHG-000062](../../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[CHG-000063](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[CHG-000064](../../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)
- 固定改訂版: `5ae51ff8f4acdb56c73f00cc09abdcf8c3c7892b`
- 固定Tree: `1f17d6cb100dc92e6b63ed9134dd8251b088217f`
- 対象範囲: Runtime責務分離、Project Stateの読み取り専用投影、MCP stdio／localhost HTTP、実行知の組込みAPI、限定分散の統合結果評価

## 結論

公開Runtimeが生成したProject Stateを、同じPersistence Port、Project Runtimeの状態参照Application、MCP Adapterおよび閉じたMCP結果へ縦断できた。MCPのstdio／localhost HTTP公開Processでは、同じ公開契約、認証、拒否、切断取消、HTTP到達およびidle終了を確認した。実行中Applicationと重複Signal eventの終了joinは、本番Serverと公開Launcherが使う同じSignal所有境界へ注入可能なsourceを接続して確認した。OS／Consoleから実行中の公開ProcessへのSignal配送は未評価である。

競合しない2 Taskは上限2で同時実行され、Project Runtimeから2件のAttempt Eventとして不変Storeへ保存された。予定Task、再読取りした実Attemptおよび統合後の受入結果は同じ評価Identityへ接続され、個別Task成功とは別に統合受入が成立した。

本結果は、ローカルの決定論的な技術縦断が成立したことを示す。実Provider間の速度、Token、費用、人間の実作業時間、後工程品質、PT／LT、正式署名またはRemote Runtimeは未評価であり、改善済みまたはRelease可能とは表示しない。

初期固定候補への独立レビューで、外部入力のplain data境界、集約の安全な整数演算、実行知の物理清掃Authority、HTTP終了時の資源回収、MCP ProtocolとAdapterの物理境界、およびRuntime Execution Identityの依存閉包に未成立が見つかった。これらを個別の例外処理ではなく、入力・永続化・利用側閉包の三責務へまとめて是正した。実行知から物理削除APIを除去し、MCP ProtocolをAdapter／Transportから分離し、HTTP終了を受信途中のRequest、実行中HandlerおよびSocketのjoinへ接続した。外部入力はAccessor、Proxy、Symbol、非列挙field、疎配列および余分fieldを実行せず拒否し、集約は安全な整数範囲を越える値を結果へ補正しない。

その固定候補の最終再レビューでは、実行知Event IDと入力Identityの単一Snapshot、利用する兄弟Componentのpackage metadataを含むRuntime Execution Identity、Signal受付からHTTP終了確定までのlistener lifecycle、およびJSON-RPC error envelopeの単一所有に未完が見つかった。Event IDを同じCanonical Identityから決定論的に再構成して検査し、到達した兄弟Componentの`package.json`を依存閉包へ含め、Signal listenerを`close()`の確定まで保持し、error envelopeの生成をProtocolだけへ集約した。その再監査では、Recorderが入力生成失敗とStore公開中の契約外例外を同じEffect 0へ畳む未完も検出した。Canonical Event生成とStore公開を分離し、前者だけを入力不正へ分類して、後者の結果または例外を偽装しない境界へ是正した。各是正は対象Componentの利用側試験へ接続し、Repository全体の変更影響型回帰を再実行した。

## 検証結果

| 確認 | 結果 | 確認できた範囲 |
|---|---|---|
| Project Runtime単体試験 | 60件中60件成功 | 状態、公開契約、Port、正常・準正常・異常 |
| MCP単体・総合試験 | 29件中29件成功 | stdio／HTTP公開Launcher、状態参照、認証、拒否、Protocol分離、error envelopeの単一所有、取消、Node.js Signal event受領後のlistener保持および受信途中Requestを含む終了join |
| 実行知単体・結合試験 | 40件中40件成功 | 組込みRecorderの生成／Store境界、plain data境界、単一Snapshotからの決定論的Event ID、部分観測、Store、安全な整数集約、統合評価、物理削除APIの不存在 |
| 公開Runtimeと限定分散のFocused試験 | 12件中12件成功 | 実状態からMCP結果、2 Task同時実行、Attempt保存、統合受入 |
| 試験台帳契約 | 16件中16件成功 | 実在試験、利用側閉包、PT／LT非発火、実行Profile |
| 実行知変更の変更影響型回帰 | 選択4ファイル、84件中84件成功 | 実行知UT／IT、CoordinatorのTask実行と限定分散全体試験、両package静的検査 |
| Source所有と命名の回帰 | 9件中9件成功 | TypeScript全実体と型検査Projectの完全一致、Rust許可Root、命名、廃止Path |
| Repository全体の変更影響型回帰 | 選択155項目、全5段階成功 | 全所有componentの静的検査、UT、IT、Windows実Process Gate、ST |
| Windows実Process Gate | 7件中7件成功 | 取消、Process tree終了、stdout／stderr上限、子Process close |
| Coordinator静的検査 | 成功 | Runtime／Project設計対応、兄弟Component package metadataを含むRuntime Execution Identity、型、Lint、Format |
| 正式署名の利用側閉包 | 136件中136件成功 | 配布全体の正規観測と、必須成果物・実行入口・Recovery Matrix入口の欠落を秘密鍵読取りおよび入力Promptより前に拒否すること。実行能力を持つimport、source別primitive、直接呼出しおよび実行targetを実ソースから導出し、宣言集合との完全一致を要求すること。別名・namespace・dynamic・require・再export、関数値化、`.call`／`.apply`／`.bind`／`Reflect.apply`、直接Worker／`fork`／Node自身からのlocal TypeScript起動、query／fragment／percent encoding／encoded separatorおよびRecovery経路の迂回を拒否し、type-only importは実行能力として数えないこと |
| 追加是正後のCoordinator制限Process回帰 | 1,714件中1,714件成功 | Windows実Process Gateを除く単体・結合・総合・契約回帰 |
| 追加是正後のWindows実Process Gate | 7件中7件成功 | 取消、Process tree終了、stdout／stderr上限、子Process close |
| 追加是正後のRepository全体Checker | Error 0、Warning 0 | Markdown 425件、Local link 3,011件、履歴参照24件、Anchor 1,005件 |

Source所有の回帰は固定件数をIdentityとして使わず、`40_Develop/**`と`template/tools/**`のTypeScript実体を、各型検査Projectが所有する実Path集合と完全一致させた。この確認により、未所属だったCoordinator公開sourceと`template/tools`のLauncherを型検査へ接続し、Launcherの同期結果とMCP非同期契約の差も修正した。

Windows実Process Gateは専用のProcess制御が成立する実行環境で7件を完走した。同じ試験をその能力がない制限環境から実行した結果は全7件が終了観測不能となったため、製品回帰の根拠には採用していない。実行許可の宣言だけを、実行環境の能力成立と同一視しない。

全回帰は`node 40_Develop/checker/regression-runner.ts --base main --windows-process-control-authorized`で実行した。通常の静的確認、UTおよびITを制限Processで実行した後、Windows実Process Gateだけを専用実行Profileで実行し、最後にSTへ進んだ。PT／LT、実Providerおよび署名は選択・実行していない。

正式署名の最初の秘密入力前検査は`release_manifest_package_observation_failed`で停止した。原因は、Runtime依存閉包のProducerと通常の検証・起動利用側は責務分離後の配布全体へ移行していた一方、正式署名のConsumerだけが分離前のCoordinator単体観測を呼んでいたことだった。この試行では秘密鍵またはpassphraseを読み取らず、署名、Manifest生成および外部Effectは発生していない。固定改訂版`e8012024`で署名Consumerを正規の配布全体観測へ接続した。

続く署名前監査では、配布物観測が配布Root相対Pathを返すのに、固定Manifest利用側だけが旧package相対Pathを検索していたため、正しい配布でも`platform_provisioner_interactive_console_reader_missing`へ停止することを検出した。固定改訂版`2bcc1dad8ae953f477db5ee3948d9188f1b295f0`で、必須成果物のPath解決を配布物観測へ集約し、利用側によるPathの再解釈を除去した。

同固定版の独立再レビューでは、4つの必須実行入口を開発利用側だけがnullableな一覧として所有し、配布物観測と固定Manifest利用側が欠落を必須成果物の不成立として一括拒否していない伝播未完を検出した。固定改訂版`971370b13a83c81c557722079eee7ca0f8e34650`で、配布Root相対Pathを持つ単一Registry、同一Snapshotからの非nullableな解決、および解決済み成果物だけを受け取る利用側へ統一した。

その再レビューでは、子Process入口の自動導出が特定の`new URL()`表記だけを対象とし、宣言と実利用の全数対応を証明できないことを検出した。固定改訂版`df1c576c0f0f5636bc0ee72ed77e22340a28cc70`では、local TypeScript子Process入口を専用descriptorへ集約したが、descriptor自身が可変な`URL`を公開し、利用集合もresolver名の出現から求めていたため、正規wrapperの実呼出しと実行時targetの同一性を証明できなかった。

固定改訂版`da3c6eb69f8f2a7172ff8ebc5b8ebe2de77880e7`では、Registryを専用module内部の不変なprimitive値へ閉じ、利用側には役割と引数だけを受け取るWorker／spawn wrapperを公開した。一段具体化した独立再レビューでは、`child_process`の再export・関数値化や呼出し方の再構成、Node自身から起動するtargetの判定不能形、および本番関数へ残ったProcess／Worker生成factoryによって、この境界を迂回できることを検出した。

現在の固定改訂版`5ae51ff8f4acdb56c73f00cc09abdcf8c3c7892b`では、実行能力を持つ`node:child_process`の値importを正規名・非aliasのnamed importへ限定し、sourceとprimitiveの許可関係、およびimport bindingの全利用を字句解析する。正規の直接呼出し以外と判定不能なNode-self targetは拒否し、type-only importは実行能力として数えない。query、fragment、percent encodingまたはencoded separatorを取り除いて正規Pathへ補正せず、不正・不明として停止する。本番のProcess／Worker生成factoryは除去し、検証済みの本番leafが起動を所有した後、既に生成済みのhandleと最小状態だけをlifecycle helperへ渡す。factoryを用いる異常注入は試験専用harnessへ隔離した。上表の136件、1,714件、Windows実Process 7件、静的検査およびRepository全体Checkerは成功した。独立再レビュー、実署名および正式E2Eは後続Gateであり、本結果から成功を推定しない。

## 限定分散の観測

| 項目 | 観測結果 |
|---|---|
| 予定Task | 2件 |
| 観測Attempt | 2件 |
| 最大同時実行 | 2 |
| Retry | 0件 |
| 統合Conflict | 0件 |
| 統合結果 | 受入 |
| Task成功と統合受入の同一視 | なし |
| 完成時間 | 未観測。決定論的契約試験を性能比較へ使用しない |
| Human Active Time | 未観測 |
| Provider利用量・費用 | 未観測 |
| 後工程Finding | 未観測。独立レビューは後続Gate |

## 未評価範囲と次のGate

- 旧固定改訂版`11b7e99c7448aed7067c61a2d50282ad944db349`と検証記録Commit`f2a1ce691620e19781e921ee98581b6419310330`への二つの独立再レビューは、当時の対象にCritical 0、Major 0、Moderate 0、Minor 0を返した。その後の署名前検査と監査で上記の利用側未完を検出したため、この結果を現在の固定改訂版へ流用しない。現在の固定改訂版と本記録を対象とする独立再レビューが必要である。
- OS／Consoleから実行中Applicationを持つ公開MCP ProcessへのSignal配送と、その配送後の取消・join。Node.js Signal event受領後の構成試験を、この実行環境境界の成立へ読み替えない。
- local TypeScript子Processの利用集合は、本番実行集合に存在する正規wrapper直接呼出しを静的に導出した集合であり、一般的な到達可能性解析ではない。動的コード、任意のproperty名再構成、`execArgv`／`NODE_OPTIONS`によるpreload、TypeScript実行集合外または外部Processからの起動を完全に検出する主張はしない。
- 正式候補固定後の署名および対象E2E。成功するまでRelease完了と表示しない。

実Provider、PT／LTまたは長時間試験は、人間が対象、上限および目的を明示しない限り自動実行しない。未観測値を0へ補正せず、現在のRelease判断へ使用しない。
