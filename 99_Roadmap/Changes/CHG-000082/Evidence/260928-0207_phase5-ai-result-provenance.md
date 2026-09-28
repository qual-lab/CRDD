# Phase 5 AI結果Provenance

記録種別: Verification Evidence
対象変更: `CHG-000082`
観測日: 2026-09-28

## 結論

Workbench AI結果の四区分を、単なる文字列から「本文と一件以上の正本参照」の組へ変更した。Coordinator Mode RouterはExecutor結果を実行時に検証し、根拠参照のない項目を事実等として部分公開しない。さらに読取り助言専用Task Packetを追加し、利用者依頼、選択Profileおよび内容Hash付き許可済み投影を外部Effect前に固定した。

## 成立した範囲

- 確認済み事実、共有済み分析、追加推論および次の選択肢が、同じ項目内に本文と根拠参照を持つ。
- Workbenchは本文と根拠参照をescapeして表示する。
- Coordinatorは閉じた結果Key、状態、理由、区分ごとの件数、本文、参照件数、参照値および重複を実行時検証する。
- 専用Advice Result Parserは単一JSONとContract Identityを確認し、各参照をProviderへ渡した許可済み読取り投影のexact集合へ拘束する。
- 専用Advice Task Packetは投影ごとの参照名、本文およびSHA-256を検証し、投影全体とTaskのIdentityを決定論的に生成する。
- 投影改変、秘密Prompt、秘密情報を含む投影、越境参照および重複参照は外部Effect 0で拒否する。
- Provider Promptは投影を非信頼情報として扱い、Tool、Network、追加File読取り、書込みおよびPatch提案を禁止する。
- Repository単体WorkbenchのProduction CLIは検証済みRootの`PROJECT_CONTEXT.md`だけを専用Task Packetへ変換するCoordinator Mode Routerへ接続した。送信Authorityと変更候補Executorは未接続理由を明示してEffect 0で止まる。
- Repository Ownerの採用済みCatalog Snapshotを依頼ごとに一回観測し、選択Profile IDを同じ改訂のAdapter、Model、Reasoningへ解決してCatalog RevisionとともにDispatch Inputへ渡す。未登録または非Coordinator Profileは送信境界前に拒否する。
- 投影外参照、重複Keyおよび複数JSONを拒否し、生Provider出力を公開結果へ含めない。
- 不正結果は`coordinator_ai_request_result_invalid`でblockedとなり、正常部分も公開しない。
- 参照はProvenanceであり、任意Path読取りAuthorityではない。
- 固定Fake Executorだけを使用し、外部Provider Effectは発行していない。

## 検証結果

| 検証 | 結果 |
|---|---|
| Coordinator format／typecheck／lint／設計Traceability | Pass |
| AI Runtime契約・統合試験 | 10件Pass。選択済みProfile IDのexact設定解決を含む |
| `workbench-ai-request-application.contract.test.ts` | 13件Pass。実`PROJECT_CONTEXT.md`の末尾改行を保持したTask Packet生成と、未登録／非Coordinator ProfileのEffect 0拒否を含む |
| Workbench format／typecheck／lint | Pass |
| Workbench Production Shell統合試験 | 14件Pass。AI結果本文のescapeと根拠参照表示を含む |
| Production CLI局所Smoke | localhost GET 200、読取り助言POST 200、採用済み`PROFILE-100001`解決後に未接続送信Authorityを`workbench_ai_advice_send_authority_unavailable`として表示。外部Provider Effect 0、終了後Listener 0 |
| Verification Runner試験台帳契約 | 19件Pass |
| CRDD Full Checker | 既知の`stable-release-tag-identity-mismatch` 1件だけ。作業ブランチHEADが公開済み`v0.21.0`タグと異なるため |

## 未成立

- 採用済みProfileと読取り助言Task Packetを一回限り外部送信Authorityへ結ぶ実Executor、および変更候補の実Executor
- 実Providerを起動し、専用Parserへ生結果と許可済み参照集合を渡すAdapter
- 外部送信Authority、実Provider E2EおよびProduction全Profile ST

## Checklist

- [x] 根拠参照なしを非該当ではなく契約違反として処置した
- [x] 事実と推論の区分を維持した
- [x] 型宣言だけでなく実行時境界で検証した
- [x] 不正結果を部分成功へ畳まなかった
- [x] 読取り投影の内容Hashと秘密情報非包含をEffect前に確認した
- [x] 読取り助言をExecutor／Reviewer Taskへ偽装しなかった
- [x] 外部Provider Effect 0を確認した
