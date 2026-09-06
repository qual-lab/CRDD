# v0.20公開Runtimeと限定分散の固定候補検証結果

状態: 構造是正と全回帰を完了。独立再レビュー待ち
担当責任者: Qual-Lab
最終更新日: 2026-09-06

## 対象

- 対象変更: [CHG-000062](../../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[CHG-000063](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[CHG-000064](../../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)
- 固定改訂版: `0e233e1664eba85393b35b5970e3c9d065b4d698`
- 固定Tree: `57669a93c17740dc1ad7bb07a921bf733a407e60`
- 対象範囲: Runtime責務分離、Project Stateの読み取り専用投影、MCP stdio／localhost HTTP、実行知の組込みAPI、限定分散の統合結果評価

## 結論

公開Runtimeが生成したProject Stateを、同じPersistence Port、Project Runtimeの状態参照Application、MCP Adapterおよび閉じたMCP結果へ縦断できた。MCPのstdio／localhost HTTP公開Processも、同じ公開契約、認証、拒否、切断取消および終了joinを保持した。

競合しない2 Taskは上限2で同時実行され、Project Runtimeから2件のAttempt Eventとして不変Storeへ保存された。予定Task、再読取りした実Attemptおよび統合後の受入結果は同じ評価Identityへ接続され、個別Task成功とは別に統合受入が成立した。

本結果は、ローカルの決定論的な技術縦断が成立したことを示す。実Provider間の速度、Token、費用、人間の実作業時間、後工程品質、PT／LT、正式署名またはRemote Runtimeは未評価であり、改善済みまたはRelease可能とは表示しない。

初期固定候補への独立レビューで、外部入力のplain data境界、集約の安全な整数演算、実行知の物理清掃Authority、HTTP終了時の資源回収、MCP ProtocolとAdapterの物理境界、およびRuntime Execution Identityの依存閉包に未成立が見つかった。これらを個別の例外処理ではなく、入力・永続化・利用側閉包の三責務へまとめて是正した。実行知から物理削除APIを除去し、MCP ProtocolをAdapter／Transportから分離し、HTTP終了を受信途中のRequest、実行中HandlerおよびSocketのjoinへ接続した。外部入力はAccessor、Proxy、Symbol、非列挙field、疎配列および余分fieldを実行せず拒否し、集約は安全な整数範囲を越える値を結果へ補正しない。

## 検証結果

| 確認 | 結果 | 確認できた範囲 |
|---|---|---|
| Project Runtime単体試験 | 60件中60件成功 | 状態、公開契約、Port、正常・準正常・異常 |
| MCP単体・総合試験 | 26件中26件成功 | stdio／HTTP公開Launcher、状態参照、認証、拒否、Protocol分離、取消、受信途中Requestを含む終了join |
| 実行知単体・結合試験 | 37件中37件成功 | 組込みRecorder、plain data境界、部分観測、Store、安全な整数集約、統合評価、物理削除APIの不存在 |
| 公開Runtimeと限定分散のFocused試験 | 12件中12件成功 | 実状態からMCP結果、2 Task同時実行、Attempt保存、統合受入 |
| 試験台帳契約 | 16件中16件成功 | 実在試験、利用側閉包、PT／LT非発火、実行Profile |
| 実行知変更の変更影響型回帰 | 選択4ファイル、84件中84件成功 | 実行知UT／IT、CoordinatorのTask実行と限定分散全体試験、両package静的検査 |
| Source所有と命名の回帰 | 9件中9件成功 | TypeScript全実体と型検査Projectの完全一致、Rust許可Root、命名、廃止Path |
| Repository全体の変更影響型回帰 | 選択155項目、全5段階成功 | 全所有componentの静的検査、UT、IT、Windows実Process Gate、ST |
| Windows実Process Gate | 7件中7件成功 | 取消、Process tree終了、stdout／stderr上限、子Process close |
| Coordinator静的検査 | 成功 | Runtime／Project設計対応、型、Lint、Format |

Source所有の回帰は固定件数をIdentityとして使わず、`40_Develop/**`と`template/tools/**`のTypeScript実体を、各型検査Projectが所有する実Path集合と完全一致させた。この確認により、未所属だったCoordinator公開sourceと`template/tools`のLauncherを型検査へ接続し、Launcherの同期結果とMCP非同期契約の差も修正した。

Windows実Process Gateは専用のProcess制御が成立する実行環境で7件を完走した。同じ試験をその能力がない制限環境から実行した結果は全7件が終了観測不能となったため、製品回帰の根拠には採用していない。実行許可の宣言だけを、実行環境の能力成立と同一視しない。

全回帰は`node 40_Develop/checker/regression-runner.ts --base main --windows-process-control-authorized`で実行した。通常の静的確認、UTおよびITを制限Processで実行した後、Windows実Process Gateだけを専用実行Profileで実行し、最後にSTへ進んだ。PT／LT、実Providerおよび署名は選択・実行していない。

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

- 現在の固定改訂版に対する、初期指摘事項と利用側閉包を対象にした独立再レビューおよび最終一括監査。
- 正式候補固定後の署名および対象E2E。

実Provider、PT／LTまたは長時間試験は、人間が対象、上限および目的を明示しない限り自動実行しない。未観測値を0へ補正せず、現在のRelease判断へ使用しない。
