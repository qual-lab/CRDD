# README是正による実務自己適用の初回結果

対象変更: [CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)
実測日: 2026-08-30（Asia/Tokyo）
状態: 候補の独立レビュー・反映・破棄まで完了。Runtime全体の最終監査・Release判断は未完了。

## 結論

Runtime READMEに残る古い現在状態を同期する実務Taskを、署名済み固定Runtimeから公開`task --request-stdin --json`入口で実行した。初回はClaudeの作業回数上限で停止した。対象位置と確認手順を具体化した2回目は、同じモデル・推論・上限でClaude ExecutorからCodex Reviewerまで完了し、指摘・是正0件で候補が承認された。

親は既知の3か所だけが変わったこと、保持すべき制限、根拠との整合および内容Hashを確認し、候補を追加編集せずREADMEへ反映した。`candidate discard`はexit 0、`discarded`を返した。これは限定した文書是正1件の成立であり、Runtime全体の有用性、任意Taskや上流工程全体の完成を意味しない。

## 対象・実行条件・完全結果

- 対象Repository: qual-lab/CRDD、Object Format: SHA-1。
- 対象Commit: `00db0fce1d58f83e407c27f70e2ae4aa2a15ca67`、Tree: `93c333e5d2597eb19dfd77a7fa390430aab13717`。両Taskの開始前と候補反映前にworktree cleanを確認した。
- Runtime: [署名済みa619545](CHG-000015_Signed_E2E_a619545.md)、Release Sequence `2026083005`。対象RepositoryとRuntimeのCommitを区別し、Runtimeを再署名・改変していない。
- 実行: 検証済み`C:\Program Files\nodejs\node.exe`（24.19.0）から固定配布物の`tools/coordinator/bin/coordinator.ts task --request-stdin --json`を`cwd=C:\project\CRDD`、`shell:false`で起動し、固定request JSONのUTF-8 byteをstdinへ渡した。PowerShellのtext pipelineや秘密値は使用しない。
- 読取り投影: `tools/coordinator/README.md`と[4経路・復旧実測文書](CHG-000015_Signed_E2E_a619545.md)の2文書。変更候補はREADMEだけ。Task指示、候補差分の送信を含めてユーザー承認済み。既存Subscription、API key／従量課金fallbackなし。
- Git外の結果影響入力: 上記署名配布物、同manifestに固定されたNative成果物・Docker image、既存専用Provider Homeと同意状態。Credentialを記録・送信投影へ含めない。
- [全request・公開結果・選定ログ・計時・破棄結果](CHG-000015_Readme_Dogfooding_00db0fc.json)のSHA-256: `4b837f1bb16adb3823b0a418109b5d56396331f1b2949946be0eab33e28044ec`。個別原出力のHashも同JSONへ保持した。生Provider出力ではなくRuntimeの公開結果である。
- 反映した候補: 166,319 bytes、SHA-256 `b37c7b9573d6ea47b38531f2ea939c800014ea7511058bed7476c1d8d3033cd1`。export時のHash、byte長と反映後byte列の完全一致を確認。元READMEの77、79、359行だけが変わり、行数は404のまま。
- 元のrequest、stdout／stderr、計時、exportはRepository rootのignored `.crdd/dogfooding`に保存した。候補本文は現在READMEと同一のため、全文をEvidenceへ重複追加しない。実行用ローカル補助Scriptは配布Runtimeや検証対象ではない。

## 観測値と限界

| 項目 | 初回 | 2回目 |
|---|---|---|
| 開始・終了（UTC） | 01:48:43.372～01:49:54.799 | 02:16:08.617～02:18:06.558 |
| Runtime呼出し経過時間 | 71.428秒 | 117.944秒 |
| 結果 | `provider_turn_limit_exceeded`、exit 2 | `coordinator_task_candidate_approved`、exit 0 |
| 選定イベント | Claude Executor 1件 | Claude Executor 1件、Codex Reviewer 1件 |
| 推論・速度 | Opus low、normal | Opus low／Codex medium、normal |
| 候補／指摘／是正 | 未発行、Reviewer未到達 | 候補発行、指摘0、是正なし |
| 同意・追加対話入力 | 既存同意再利用、0回 | 既存同意再利用、0回 |
| cleanup・手動復旧 | 確認済み・不要 | 確認済み・不要 |
| Runtimeによる正本変更 | なし | なし（後に親が検証して反映） |

Codexの実効モデルは固定Linux Runtimeでの既定モデル互換性制約により`gpt-5.5`。Claude Executorは両回とも上限8ターンである。ただし公開結果は実際のTurn数やTool順序を返しておらず、8回の操作内容を確認したとは主張しない。

二つの呼出し時間の合計は189.372秒。これはAI総処理時間でも、Task開始から採用可能な結果までの全時間でもない。初回停止後の会話・再開待ち、親の指示具体化、候補export、差分確認、反映、検証の時間は別に存在する。初回からの通算を2回目の約118秒で代表させない。人間の実作業秒数、Provider token／quota、段階別の実行時間は取得不能として扱い、0や推定課金額へ変換しない。選定ログの比率は利用量分散の証明ではない。

親が初回の実務Taskへの追加承認を1回求め、利用者から負荷が高いとの指摘を受けた。2回目は同じ承認境界で再承認を要求しなかった。Runtimeの確認入力0回と、親による会話上の確認・再開負荷を分離する。

比較は同一Taskの指示変更前後であり、実行順序、モデルの確率的変動、キャッシュおよび内部操作は統制していない。単一Agent直接実行／CRDDのみ／Runtime追加の3条件比較や一般的な処理量・品質改善率は未測定である。

## 改善候補と次の処置

| 観測・候補 | 今回の判断 | 次の確認／担当 |
|---|---|---|
| `planState: complete`でも編集箇所や調査量は十分具体的とは限らない | 編集位置・読取り範囲・確認手順の具体化後は同じ上限で完了。因果の確定ではないが、まずTask組立てを改善する根拠になる | 親Coordinatorが次の代表Taskで既知の位置・未解決判断・操作量を照合する。既存着手前整合規則を使用し、新Schemaを先行追加しない |
| 推論レベルと操作回数上限が連動する | 単純でも多操作のTaskで不適合となる可能性。今回は上限増加なしで完了したため改修不要 | 具体化済みTaskで反復失敗したとき、Runtime保守が推論難易度と実行作業量の分離を再評価する |
| 安全な実行統計が不足する | 停止理由は分かるがTurn・段階時間・操作種別の切分けはできない | Runtime保守が別Taskでも評価不能が続くか確認し、必要なら秘密・自由文を含まない観測項目を検討する。今回は未実装 |
| 親の承認範囲の過剰細分化 | Runtimeは同意再利用済み。既存承認の照合を先に行う運用へ是正 | 親Coordinatorが同じ目的・分類・送信先・権限内で不要な再確認をしない。境界拡大は引き続き確認する |
| 現在状態の表示がREADME内で重複する | 冒頭更新だけでは後段が古くなる。今回3か所を根拠への参照へ是正 | 文書入口の最終水平確認で重複する現在状態を点検する。過去EvidenceやComponent固有制限は一括改稿しない |

これらは[有用性評価](../../../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-evaluation)とCHG-000015で追跡する。今回の指示具体化を一般規範の追加、承認境界の拡大、上限緩和または高価なモデルへの昇格理由にしない。Runtime内の独立レビューは今回の局所差分を対象とし、Repository全体の最終Document／Gap／Architecture／Security監査を代替しない。
