# Workbench E2E再開と通信失敗の再現

成果物種別: 検証結果
対象変更: [CHG-000082](../change.md)
確認日: 2026-10-04
担当責任者: Qual-Lab

## 結論

現在注記: この記録は全体収集前の二回の通信失敗を保持する。人間はその後、是正前に全E2Eの失敗・未実行を収集する方針を指定した。最新の両助言は未修正で成功しており、現在の結果と次の操作は[是正前のE2E全体確認](261004_all-e2e-collection.md)を参照する。

Workbenchの実Provider E2Eを再開したが、最初のCodex助言の表示取得で通信が切断され、全体合格には至らなかった。続く限定診断も同じGETの`ECONNRESET`で停止した。復旧基盤の追加ではなく、この再現したHTTP通信失敗を次の調査対象とする。

人間は、復旧設計の追加拡張を止め、まずE2Eを実行し、再現性のある問題だけ対応を検討する方針を確認した。共有管理フォルダのACL移行案は取り下げ、現在の判断待ちにしない。通常の回復で利用者に内部ファイルの安全性を判断させず、追加判断は他の作業の中断や成果物の喪失など実際の利用者影響がある場合に限る。承認を、所有関係や非使用の不明点の証明へ代用しない。

これは旧残存三件の清掃成立、限定Recovery機能の完成、残る品質義務の免除またはRelease承認ではない。旧三件は処置せず保持し、新しいTaskが旧Rootを選択しない通常のUUID生成経路を確認したうえで、保存済み署名Runtimeの固定E2Eへ戻った。

## 対象と実行条件

| 項目 | 内容 |
|---|---|
| 署名Runtime | Commit `d36a9dec73250705019ab97e7a3c1cfd85b09292`。保存済み配布候補を使用し、今回再署名していない。 |
| 署名の期待値 | Manifest Hash `1087e142ccd5731a7cbb1772335135fd7be9ef63ca66156a0d918988b50984d1`、Sequence `2026100201`。 |
| 検証側 | HEAD `a9ad3fbbb642e1f3ae23cb97aecaf83fa69adad2`と未Commit状態を固定。Git statusのSHA-256は`68b8eac92a334699f2ae290427f7786960a2a688037c04d6c13909a63c3a9ce0`。既存の追跡ファイル内容の実行前後照合を維持した。 |
| Workbench等の実装 | Workbench、AI Runtime、Version Control、Repository設定の追跡内容は署名基準Commitとの差分なし。今回、Production Sourceを編集していない。 |
| 入力 | 既承認の固定Task、`PROJECT_CONTEXT.md`、既承認の候補対象一ファイルだけ。Project Contextの実行時Hashは`76d0c63be0cefe60b8a3e198b61e92928858f2befe5b1cfd41824746ea4b94ef`。 |
| 実行環境 | Node.js v24.19.0、Docker Engine 29.8.1。通常の外部対話Windowで実行。 |
| 事前確認 | 署名検証、Repository、三Profile、Production構成が成立。Docker回復一覧clean、同じ検証Toolの実行中Process該当0を確認した。 |
| 操作の範囲 | Codex／Claudeの助言と固定変更候補を予定。候補は破棄のみ。採用、Commit、Push、Docker再起動、旧残存削除、API Keyへのfallbackは行わない。 |

開始条件だけを現在のHEADとstatus Hashへ合わせ、Provider入力、四Scenario、成功assert、取消および同Executorの終端待ちは変更しなかった。変更した非追跡Toolは独立した読み取り確認を受け、記録保存失敗でも元の終了結果を表示する是正後に限定確認で問題なしとなった。これは製品全体またはRecovery全体の独立レビューではない。

## 実行結果

| 実行 | 結果 | 確認できた意味 |
|---|---|---|
| 通常Workbench E2E | 終了コード1、成功Scenario 0／4。最初のCodex助言で`workbench_verification_transport_failed`、`headers_unobserved`、`timedOut: false`。 | 全E2E未成立。Claude助言・両候補には未到達。Executor終端は確認したが、終了観測の60秒期限を超過した事実も残した。 |
| 同じ助言経路の限定通信診断 | 終了コード1。Main表示GETが9712msで`ECONNRESET`。検証側の15秒Abortは未発火。 | 通信失敗の再発とエラー番号を確認。本文、Token、Prompt、Provider出力は記録していない。根本原因は未確定。 |
| 両実行の終了時 | 同Executorの終端待ち、Listener終了、Docker回復一覧clean、追跡ファイル内容不変を観測。 | 以前の「公開取消後、Executorの終端を待たず検証Processを終了し得る」Tool不足とは分ける。Promise終端だけをHost全資源回収の証明へ昇格しない。 |
| 旧三Rootの再観測 | 三件とも実行前後で同じ実体Identityを保持。 | 旧残存は解決していない。今回のE2Eから旧三件の清掃を発行していない。 |
| AI／Dockerなしの接続試験 | 接続待ち後と要求中に6500ms停止する二モデル、それぞれ通常接続／都度切断、各二回の計8観測は成功。 | 単純な待ち時間や同Process停止だけでは再現しない。タイムアウト延長、接続方式変更または自動再送を採用する根拠にしない。 |

検証Toolの終了待ち9試験、HTTP観測の透過性・秘密非開示17試験は成功した。これらは局所試験であり、失敗したE2Eを合格に変えない。Qualityの観測済み件数を増やしていない。

## 根拠と限界

原結果はGit非追跡のRepository-local `.crdd/tmp`へ非上書き保存した。以前の結果を書き換えていない。

| 原記録 | SHA-256 |
|---|---|
| `workbench-e2e-resume-261004.settlement.json` | `60a2789fe8bc795e779884708fb45e008447f597f100ea005ab5c4136db729df` |
| `workbench-e2e-resume-261004.mjs` | `709bc7afe46a39feaea237d0a1145ad89d94b234feeb48c23fc4cb64878b2f5e` |
| `workbench-http-repro-261004.settlement.json` | `03824c0317ab602e27e1d6fb2815a30dd23c6ccd750ca87c24559dfe09f0fcd0` |
| `workbench-http-repro-261004.mjs` | `61f5c804981d9523d0541759230513c0965e284b4b2d09920e9708cba4386f21` |

通常E2Eは2026-10-04T11:33:36Z、限定診断は11:38:55Zに起動した。起動wrapperの結果は各`*.exit.txt`へ保存した。Taskの生出力や秘密値のログは作っていない。終了後の分類済み記録は、Phase 5の結果確認まで保持し、2026-10-11に保持要否を再評価する。参照中の記録や物理残存を名前・経過時間だけで削除しない。

## 次の対応

人間の最新指定に従い、[E2E全体確認](261004_all-e2e-collection.md)を先に完了する。通信断の履歴は保持するが、その是正やRecovery基盤の追加を全体収集より先行しない。

## Checklist

- [x] 実行した署名Runtime、検証Tool、入力と操作範囲を区別した。
- [x] 終了コード1、未到達Scenario、限定診断と局所試験を分けた。
- [x] 秘密値やProvider生出力を保存せず、分類済み原結果を非上書き保持した。
- [x] 終端待ち、Listener終了、Docker一覧とHostの全資源回収を同一視しなかった。
- [x] 旧残存の処置、権限変更、候補採用やReleaseを今回の操作へ含めなかった。
- [ ] OPEN: Workbench E2Eは未合格。GETの`ECONNRESET`の原因を特定し、是正後に同じE2Eを再実行する。
