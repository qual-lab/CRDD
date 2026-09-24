# v0.20公開Runtimeと限定分散の固定候補検証結果

状態: 正式署名、4経路E2E、Recovery Matrixおよび最終独立監査完了。Release判断待ち
担当責任者: Qual-Lab
最終更新日: 2026-09-11

## 対象

- 対象変更: [CHG-000062](../../../Changes/CHG-000062/change.md)、[CHG-000063](../../../Changes/CHG-000063/change.md)、[CHG-000064](../../../Changes/CHG-000064/change.md)
- 固定改訂版: `f76b73af81c43e25f28037caa72d71a898a2f9fb`
- 固定Tree: `928a76442276f56023662954e98464b1f6fefa97`
- 対象範囲: Runtime責務分離、Project Stateの読み取り専用投影、MCP stdio／localhost HTTP、実行知の組込みAPI、限定分散の統合結果評価

## 結論

公開Runtimeが生成したProject Stateを、同じPersistence Port、Project Runtimeの状態参照Application、MCP Adapterおよび閉じたMCP結果へ縦断できた。MCPのstdio／localhost HTTP公開Processでは、同じ公開契約、認証、拒否、切断取消、HTTP到達およびidle終了を確認した。実行中Applicationと重複Signal eventの終了joinは、本番Serverと公開Launcherが使う同じSignal所有境界へ注入可能なsourceを接続して確認した。OS／Consoleから実行中の公開ProcessへのSignal配送は未評価である。

競合しない2 Taskは上限2で同時実行され、Project Runtimeから2件のAttempt Eventとして不変Storeへ保存された。予定Task、再読取りした実Attemptおよび統合後の受入結果は同じ評価Identityへ接続され、個別Task成功とは別に統合受入が成立した。

本結果は、v0.20.0の固定候補について、ローカルの決定論的な技術縦断、正式署名、Codex／Claudeを使う4経路E2Eおよび署名済みRecovery Matrixが成立したことを示す。前候補`f76b73af81c43e25f28037caa72d71a898a2f9fb`の結果と、文書全体の構造是正後に再固定した現在候補の結果を区別する。現在のGateは[Quality Center](../../../../07_Quality/01_Quality_Center.md)が所有する。

実Provider間の速度、Token、費用、人間の実作業時間、後工程品質、PT／LTおよびRemote Runtimeは未評価である。

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
| Source所有と命名の回帰 | 9件中9件成功 | TypeScript全実体と型検査Projectの完全一致、Rust許可Root、命名、廃止Path |
| Coordinator静的検査 | 成功 | Runtime／Project設計対応、兄弟Component package metadataを含むRuntime Execution Identity、型、Lint、Format |
| 最終制限Process回帰 | 1,985件中1,980件成功、5件明示skip、失敗0 | 単体・結合・総合・契約回帰。実環境専用試験は未実行を成功へ補完していない |
| 最終Windows実Process Gate | 8件中8件成功 | Docker隔離、取消、Process tree終了、stdout／stderr上限およびcleanup |
| 正式署名 | 成功 | Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067` |
| 正式4経路E2E | 4経路中4経路成功 | forward、reverse、same-codex、same-claude。cleanup成立、再試行0、回復義務0 |
| 署名済みRecovery Matrix | 7シナリオ完了 | timeout、出力上限、無効出力、非0終了、取消、cleanup観測不能後の回復、親Process消失後のfresh回復 |
| 最終独立監査 | Critical／Major／Moderate／Minor 0件 | 実行結果を含む固定改訂版を対象にPass |

Source所有の回帰は固定件数をIdentityとして使わず、`40_Develop/**`と`template/tools/**`のTypeScript実体を、各型検査Projectが所有する実Path集合と完全一致させた。この確認により、未所属だったCoordinator公開sourceと`template/tools`のLauncherを型検査へ接続し、Launcherの同期結果とMCP非同期契約の差も修正した。

Windows実Process Gateは専用のProcess制御が成立する実行環境で8件を完走した。制限環境の結果を実Process成立の根拠へ流用せず、実行許可の宣言と実行環境の能力成立を区別した。

### 構造是正の要約

| 観測した不成立 | 構造是正 | 最終確認 |
|---|---|---|
| 正式署名だけが旧Coordinator単体観測を利用 | 署名を配布全体の正規観測へ接続 | 秘密入力前の配布閉包検査と正式署名 |
| Canonical Pathを固定Manifest利用側が再解釈 | Path解決とHash取得を配布物観測へ集約 | 正しい配布物の署名と4経路E2E |
| 必須入口とProcess能力の宣言・利用・結果伝播が閉じていない | 実sourceから導出する限定グラフと独立Expected集合を完全一致 | Focused反証、制限Process、Windows実Process、正式E2E |
| 旧固定候補の中立化子ProcessでDocker署名検査環境が未伝播 | 検証済みUser Profileを持つ専用PowerShell環境を構成 | 多段Authenticode結合試験、再署名、Recovery Matrix |
| 実Process Gate追加後に期待件数が旧7件 | 実在試験、台帳、runnerおよび期待値を8件へ同期 | 件数契約2件、Windows実Process 8件 |

詳細な変更経緯と固定版ごとの指摘は[CHG-000063](../../../Changes/CHG-000063/change.md)が所有する。本検証結果では最終候補の条件、結果および未評価範囲を正本とする。

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

| 未評価または未完了 | 現在の扱い |
|---|---|
| OS／Consoleから実行中Applicationを持つ公開MCP ProcessへのSignal配送と、その後の取消・join | Node.js Signal event受領後の構成試験から成立を推定しない |
| 動的コード、任意のproperty名再構成、preload、TypeScript実行集合外または外部Processからの起動 | 限定グラフの保証外。一般的な到達可能性解析を主張しない |
| 実Provider間の速度、Token、費用、人間時間、後工程品質 | 未観測。決定論的・正式E2E結果から効用を推定しない |
| UAT、PT／LT、Remote Runtime、Linux／macOS | 未実施または対象外 |
| 現在候補への適用 | 下記「文書全体是正後の最終固定候補」で別のRuntime実行Identityを再署名し、正式4経路とRecovery Matrixを再実行した。前候補の結果は流用していない |
| 人間によるRelease判断 | 最終Evidence反映後のCheckerと一括独立監査が成立した後に行う。正式E2E成功だけからRelease済みと表示しない |

実Provider、PT／LTまたは長時間試験は、人間が対象、上限および目的を明示しない限り自動実行しない。未観測値を0へ補正せず、現在のRelease判断へ使用しない。

## 署名前の実境界確認と試験母集団同期

| 確認 | 結果 | 解釈 |
|---|---|---|
| 限定実Provider境界 | Codex実装／Claude確認、Claude実装／Codex確認の2経路が成功 | 正式4経路E2Eの代替ではない |
| 制限Process全回帰 | 1,983件中1,978件成功、4件明示skip、1件失敗 | 失敗はWindows実Process Gateの所有数だけを旧7件とした期待値同期漏れ |
| 件数契約の限定再確認 | 2件中2件成功 | Codex Executor Sandboxを含む8件の閉集合へ更新 |
| Windows実Process Gate | 8件中8件成功 | Docker隔離、取消、Process tree終了、stdout／stderr上限およびcleanupを通常ユーザーProcessで確認 |
| 静的検査 | 型、Lint、Format、Capability Graph、Runtime TraceおよびProject Runtime設計追跡が成功 | 固定候補の署名前確認 |
| Repository全体Checker | 426文書、Error 0、Warning 0 | 文書更新前の結果。更新後に再確認する |
| 旧署名候補の正式4経路E2E | 4経路中4経路成功 | 固定改訂版`392bd1ee`の結果。同候補のRecovery Matrixで後述の不具合を検出したため、新候補のRelease根拠へ流用しない |
| 旧署名候補のRecovery Matrix | 停止 | 中立化したRuntime子Process内だけDocker CLIのAuthenticode検査が`docker_cli_untrusted`となった。Provider Effect、Canonical Repository変更および未回収Docker資源は発生していない |
| 多段Authenticode結合試験 | 1件中1件成功 | 親環境を継承しない中立化Runtime子Processから、検証済みUser Profileを持つ専用PowerShell環境を構成し、実Docker CLIのDocker Inc署名まで確認 |
| 是正後の制限Process全回帰 | 1,985件中1,980件成功、5件明示skip、失敗0 | 単体・結合・総合・契約回帰。実環境専用試験は未実行を成功へ補完していない |
| 最終固定候補の正式署名 | 成功 | Release sequence `2026091102`、Runtime実行Identity `b0f81d356343e535254a12358624ca9f7f0df8f75e6f6e4dd513feafd01d6067`、配布内容Root `41a09d4463bfdf3e2111b40cad1914355861fd14e1522146310111a01134b6b9` |
| 最終固定候補の正式4経路E2E | 4経路中4経路成功 | forward、reverse、same-codex、same-claude。全経路で固定Commit／Tree／Runtime実行Identity一致、cleanup成立、再試行0、回復義務0。記録ID `5bc48169-5ad6-4b9a-9d8f-339db5aa4fcc` |
| 最終固定候補のRecovery Matrix | 7シナリオ完了 | timeout、出力上限、無効出力、非0終了、取消、cleanup観測不能後の回復、親Process消失後のfresh回復。top-level cleanup成立、手動回復不要。記録ID `f81b13ae-f650-44c9-9e32-539987da6615` |

この差分はRuntimeの失敗を隠す期待値緩和ではない。実ソースから導出されたWindows実Process Gateが7件から8件へ増えたのに、閉集合を検査する利用側だけが旧件数を保持した。実在する3ファイル、prefix出現数、展開case数、packageの実行入口および通常ユーザーProcessの実結果を同じ8件へ接続した。

固定改訂版`392bd1ee32a12ec3a46551c297bf2018bc3e80d1`は正式4経路E2Eを4/4で完走したが、続くRecovery Matrixが`docker_cli_untrusted`を子結果として返し、最外周では`cleanup_child_contract_invalid`として停止した。v0.19.0に存在した中立化子Processへ、v0.20.0で新設したDocker CLI Publisher TrustのPowerShell初期化条件を伝播できていなかったことが原因である。PowerShell専用環境はambientなUser Profileを継承せず、Native OS観測で検証した現在主体の`USERPROFILE`だけを追加する。中立化した親ProcessからAuthenticode cmdletを初期化する契約試験と、同じ境界から実Docker CLIのPublisher Trustを確認する結合試験を追加した。是正後の制限Process全回帰は1,985件中、明示skip 5件を除く1,980件が成功し、失敗は0件だった。

是正後の固定改訂版`f76b73af81c43e25f28037caa72d71a898a2f9fb`は新しいRuntime実行Identityとして再署名した。正式4経路E2Eは4/4で、cleanup成立、Process再起動不要、Canonical Repository変更なし、Recovery IDなしだった。同じ署名候補のRecovery Matrixは7シナリオを完走し、cleanup成立、手動回復不要だった。旧署名または旧4/4結果は流用していない。

## 文書全体是正後の最終固定候補

| 項目 | 固定値・結果 |
|---|---|
| Runtime Source | `2e4a467cc1364b88d6008604f649da8d840903e7`／Tree `dbb2e506719be4f82cf8539be6412f9f6062411b` |
| Manifest carrier | `523202123c1ffa33fd39d1ede93357028585c4af`／Tree `cfb45e82d78e50253208549a09d8546fa259dd76` |
| Release sequence | `2026091104` |
| Runtime実行Identity | `7e82dbaee1bb2dd30f8baa4ebb52ac7e5ce5edf794c6ea977de37bf38c0ed137` |
| 配布内容Root | `1481a92e49a4e199fddd2b8356a40cd5b55731873b74e50747994348ab3d6661` |
| 署名Manifestのfile hash | `2d3a4310b11e6239da8e0529330d11b463cc69769b20b6e69769726f49183e4b` |
| 正式4経路E2E | 4/4完了。forward、reverse、same-codex、same-claude。再試行0、全候補のexact content確認・破棄、cleanup成立、手動回復不要、Canonical Repository変更なし |
| 4経路記録 | `.crdd/verification-results/b549b78e-84f2-434b-b2f4-7adcce238bd7/` |
| Recovery Matrix | 7シナリオ完了。timeout、出力上限、無効出力、非0終了、取消、cleanup観測不能後のfresh回復、親Process消失後のfresh回復を確認。top-level cleanup成立、手動回復不要 |
| Recovery記録 | `.crdd/verification-results/4fad4a80-a254-40cd-bf74-f07c58d96da3/` |

最終一括監査: Critical 0、Major 0で成立

### 逆経路の署名前後診断

最初の現在候補ではreverse経路がProvider Effect前に`coordinator_task_provider_plan_invalid`で停止した。`codex-executor-seccomp.json`の実配布内容が16,703 bytes、SHA-256 `01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95`である一方、Codex Execution Planの宣言値だけが変更前の16,704 bytesと旧hashを保持していたため、実seccomp profileの取得がFail Closedになったことが原因である。

宣言値を実配布内容へ同期し、実ファイルを使って宣言Identityからseccomp profileを解決できることを結合契約試験へ追加した。対象試験24件とCoordinatorの静的検査を完走してから再署名し、同じreverse経路を含む正式4経路4/4とRecovery Matrix 7/7を確認した。期待値緩和、署名結果の流用またはProvider側の迂回は行っていない。
