# v0.20公開Runtimeと限定分散の固定候補検証結果

状態: 決定論的な縦断確認を完了。独立レビュー待ち
担当責任者: Qual-Lab
最終更新日: 2026-09-06

## 対象

- 対象変更: [CHG-000062](../../90_Release/Changes/CHG-000062_Execution_Intelligence.md)、[CHG-000063](../../90_Release/Changes/CHG-000063_Runtime_Responsibility_Separation.md)、[CHG-000064](../../90_Release/Changes/CHG-000064_Project_State_and_Local_MCP_HTTP.md)
- 固定改訂版: `ce7c4d3073099926b3302eb9aa8e2c03d18aa699`
- 固定Tree: `967de7edaa52784e3d8aa868048bb169772239bf`
- 対象範囲: Runtime責務分離、Project Stateの読み取り専用投影、MCP stdio／localhost HTTP、実行知の組込みAPI、限定分散の統合結果評価

## 結論

公開Runtimeが生成したProject Stateを、同じPersistence Port、Project Runtimeの状態参照Application、MCP Adapterおよび閉じたMCP結果へ縦断できた。MCPのstdio／localhost HTTP公開Processも、同じ公開契約、認証、拒否、切断取消および終了joinを保持した。

競合しない2 Taskは上限2で同時実行され、Project Runtimeから2件のAttempt Eventとして不変Storeへ保存された。予定Task、再読取りした実Attemptおよび統合後の受入結果は同じ評価Identityへ接続され、個別Task成功とは別に統合受入が成立した。

本結果は、ローカルの決定論的な技術縦断が成立したことを示す。実Provider間の速度、Token、費用、人間の実作業時間、後工程品質、PT／LT、正式署名またはRemote Runtimeは未評価であり、改善済みまたはRelease可能とは表示しない。

## 検証結果

| 確認 | 結果 | 確認できた範囲 |
|---|---|---|
| Project Runtime単体試験 | 60件中60件成功 | 状態、公開契約、Port、正常・準正常・異常 |
| MCP単体・総合試験 | 24件中24件成功 | stdio／HTTP公開Launcher、状態参照、認証、拒否、取消、終了join |
| 実行知単体・結合試験 | 33件中33件成功 | 組込みRecorder、部分観測、Store、集約、統合評価 |
| 公開Runtimeと限定分散のFocused試験 | 12件中12件成功 | 実状態からMCP結果、2 Task同時実行、Attempt保存、統合受入 |
| 試験台帳契約 | 16件中16件成功 | 実在試験、利用側閉包、PT／LT非発火、実行Profile |
| 実行知変更の変更影響型回帰 | 選択4ファイル、84件中84件成功 | 実行知UT／IT、CoordinatorのTask実行と限定分散全体試験、両package静的検査 |
| Coordinator静的検査 | 成功 | Runtime／Project設計対応、型、Lint、Format |

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

- 現在の固定改訂版に対する独立レビューと最終一括監査。
- Repository全体の変更影響型回帰とWindows実Process Gate。
- 正式候補固定後の署名および対象E2E。

実Provider、PT／LTまたは長時間試験は、人間が対象、上限および目的を明示しない限り自動実行しない。未観測値を0へ補正せず、現在のRelease判断へ使用しない。
