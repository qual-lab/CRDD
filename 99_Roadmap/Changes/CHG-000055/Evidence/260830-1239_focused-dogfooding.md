# 小さい実務単位での自己適用と文書是正

対象: [CHG-000055](../CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)、[CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)
実測日: 2026-08-30
状態: 4件のRuntime内独立レビュー完了。親による追加是正あり。実務全件・最終独立監査・Releaseは未完了。

## 結論

前回の[広い3件](CHG-000055_Dogfooding_8d3d62c.md)はすべて停止したため、確認対象を一つの判断と必要な2文書へ絞った。判断支援、設計と実測の照合、旧CHGの読者経路の3件は、同じ固定Runtime・同じモデル・同じ推論・同じ上限で独立レビューまで完了した。さらに、台帳冒頭の説明を実際に直す1件も完了した。

ただし、親の確認で設計評価の断定過剰を1件検出した。Runtime内の指摘0件を内容の完全性とみなさず、評価文と参照元の設計文書を訂正した。この親による是正は最終独立監査前である。

## 固定条件と結果

- Repository: `588f04f39a1c100d657370f55be366a0679a6b79`、Tree `4f0725c8a22922ea675091a73b4136aa1d35696c`。各Task開始前にHEAD一致とworktree cleanを確認した。
- Runtime: [署名済みa619545](CHG-000015_Signed_E2E_a619545.md)、Sequence `2026083005`。配布物を変更・再署名していない。
- Node 24.19.0の検証済み絶対Path、公開`task --request-stdin --json`、`shell:false`、UTF-8 byte搬送。ローカル実行記録はRepository rootのignored `.crdd/dogfooding`へ限定した。
- 送信は承認済みOpenAI／Anthropic、既存専用HomeのSubscription、既存17文書内の必要範囲と候補だけ。新しい送信先、API key、従量API fallback、購入、公開投稿はない。
- 4件とも`reused_initial_consent`。今回の会話上の追加承認要求、Runtime対話入力、Release鍵入力は各0回。過去の再承認負荷を消去する数値ではない。
- [全要求・公開結果・選定記録・計時・export／discardのHash・元候補](CHG-000055_Focused_Dogfooding_588f04f.json)を保持する。台帳候補だけは反映済み本文と完全一致するため、全文をJSONへ重複保存せずPath・byte長・Hashを保持した。

| 実務単位 | 作成／独立レビュー | 呼出し時間 | Runtime結果 | 親の確認・処置 |
|---|---|---:|---|---|
| [判断支援の3ケース](CHG-000055_Decision_Application_588f04f.md) | Codex／Claude | 148.190秒 | 承認、指摘0、是正0 | 元候補と同一byteで保存 |
| [正常・準正常・異常の限定照合](CHG-000055_Engineering_Application_588f04f.md) | Codex／Claude | 153.634秒 | 承認、指摘0、是正0 | 親が断定過剰1件を検出し訂正。追加確認を追記 |
| [旧CHGの読者経路](CHG-000055_Readability_Application_588f04f.md) | Codex／Claude | 167.772秒 | 承認、指摘0、是正0 | 元候補と同一byteで保存 |
| [台帳](../README.md)の導入段落編集 | Claude／Codex | 99.583秒 | 承認、指摘0、是正0 | 3行目だけの差分、4行目以降の完全一致、候補とのbyte一致を確認して反映 |

Codexは固定Linux Runtimeの互換性選択による`gpt-5.5` medium normal、Claude ReviewerはOpus medium normal、台帳編集のClaude ExecutorはOpus low normal。自動選定入力を使用し、高推論へ変更していない。選定ログに残る「人間によるProvider指定」の由来表示の不整合は既存の改善候補のままである。

全件でcleanup確認済み、手動回復不要、Process再起動不要、RuntimeによるCanonical Repository変更なしだった。各候補は正規export後に内容のPath・byte長・SHA-256を検証し、正規discardの`discarded`を確認した。永続候補の破棄と、取得済み根拠をRepositoryへ保存することを区別する。シークレット検査はheuristicであり、秘密不存在の完全証明ではない。

## 親が検出した指摘と原因

設計評価の元候補は、固定Workerによる復旧試験を「契約投影であり実Filesystem／Process観測へ昇格しない」と断定していた。しかし読取り範囲は設計の一節と短い実測要約だけであり、その断定を支える実装確認はしていなかった。

親は固定版の`verifyParentLossThenRecover`と[実測結果](CHG-000015_Signed_Recovery_Matrix_a619545.json)へ戻り、実子Processの終了観測とfresh recoveryを確認した。参照元Architectureにも「Recovery Matrix」の範囲を特定せず契約投影だけと読める一文があったため、説明契約・引数拒否の試験と署名済み実行入口を区別した。実Providerの障害系まで保証しない境界は維持する。

一般化できる学びは、試験名・固定Worker・状態名から観測の有無を推定せず、改訂版・入口・観測対象・結果を結び付けること、そして「今回の読取りでは分からない」を「存在しない」へ変換しないことである。既存の検証・根拠区別規則で扱えるため、新しい制度やCHGは追加しない。今回の局所是正は[Runtime Architecture](../../../tools/coordinator/architecture/README.md#9-正常準正常異常)に置いた。

## 有用性と未確認範囲

4呼出しの合計は569.179秒。実務範囲を縮小しており、前回の広い3件との同一条件比較ではない。成功率・速度・品質の改善率を算出しない。人間の実作業秒数、段階別AI処理時間、turn内訳、token／quota、直接実行との比較は未取得である。

文書数や行数だけでは量を表せない。今回の基準版ではRuntime READMEは404行・166,319 bytes、最大1行5,260 bytesだった。判断支援の読取り指定79行だけでも8,169 bytesある。これらはファイル測定であり、Providerが実際に読んだ量や使用token数ではない。次のTaskでも独立して判定できる成果、必要範囲、確認操作を組み立てる。40行や2文書という今回の値を一般上限にしない。

| 残る対象 | 今回だけでは閉じない理由 | 次の処置／担当 |
|---|---|---|
| 課題探索・UX・IA・UI／Graphicの実務適用 | 判断支援の限定例だけであり、専門工程全体や実画面を評価していない | CHG-000055の親が既存事例ごとに必要な専門判断を分離して継続 |
| 設計・実装・試験の全体対応 | 今回は要約との照合。全source／試験を横断していない | CHG-000015の親が既存Traceを用いて未接続の実装・観測を確認 |
| 文書入口・現行正本・過去CHGの水平確認 | 台帳の導入と旧ID一つだけ | CHG-000055で残る読者経路を確認。固定履歴を一括改稿しない |
| Runtimeの失敗分類・選定理由・作業量見積り | 狭いケースの成功は広いTaskの失敗原因を確定しない | CHG-000015で安全な観測と由来表示の改善要否を継続評価 |
| 最終固定と一括監査 | 親による追加是正と前回のRuntime source修正が残る | 変更収束後に機械確認、必要な正式署名E2Eと最終独立監査へ接続 |

## 機械確認と判断境界

候補反映とArchitectureの説明是正後、Repository全体CheckerはError 0／Warning 0、Runtime Traceは9資源・20状態・21遷移・10不変条件・10検証bindingで受理された。既存の実行計画・結果受理の契約試験18件もPassした。これらは文書構造と既存の決定論的契約の確認であり、親が訂正した意味の最終独立監査を代替しない。

今回の実務入力は固定配布物を再利用したため、新しい規範採用・main統合・Release判断は必要になっていない。後続の判断が不要になったという意味ではない。
