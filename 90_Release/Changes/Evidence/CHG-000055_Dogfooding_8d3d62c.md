# 実務自己適用3件の結果と承認運用の是正

対象: [CHG-000055](../CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)、[CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)
実測日: 2026-08-30
状態: 3件実行済み、採用可能候補0件。実務自己適用の完了ではない。

## 結論

課題探索・人間判断、設計と検証の接続、文書可読性の3件を、署名済み固定Runtimeで各1回実行した。すべてCodex ExecutorからClaude独立Reviewerまで到達したが、2件はturn上限、1件は結果Envelope不一致で停止した。候補は未発行、cleanup確認済み、手動回復不要、Canonical Repository変更なしである。

実行中の追加承認・手動入力は0回で、3件とも`reused_initial_consent`を返した。実行前に外側の実行環境が承認範囲を確認できず拒否し、人間の追加承認を1回求めた事実は別に残す。Runtime側の対話0回を、人間負荷全体0へ読み替えない。

## 固定条件と根拠

- Repository Commit: `8d3d62cae091bec394fda3ebc46e940053539c07`。各Task開始時に同一HEADとworktree cleanを確認した。
- Runtime Commit: `a619545ff7f30f3ec65efa134994abc0f825421a`、Sequence `2026083005`。[固定署名E2E](CHG-000015_Signed_E2E_a619545.md)と同じ配布物を使用し、再署名・改変していない。
- Windows Node 24.19.0、公開`task --request-stdin --json`、UTF-8 byte入力、`shell:false`。Repository rootのignored `.crdd/dogfooding`へ実行記録を保存した。
- [要求・公開結果・選定記録・計時・個別Hash](CHG-000055_Dogfooding_8d3d62c.json)のSHA-256: `0482d570f2d95aa2aa6a7eb6271264e207f938a2deed27d27995f63fa89fc07c`。生Provider出力ではなくRuntime公開結果を保存した。
- 送信範囲は上記JSONの各`readPaths`と検証指示・評価候補。人間が17文書・3件を承認した。OpenAI／Anthropic、既存専用HomeのSubscriptionのみ。API key、従量API fallback、購入、公開投稿は含めない。
- Executorは3件ともCodex `gpt-5.5` medium normal。固定Linux Runtimeの互換性選択を使用した。ReviewerはClaude Opus medium normal。高推論への変更なし。

| 実務ケース | 呼出し時間 | 結果 | 候補 | 後片付け／手動回復 |
|---|---:|---|---|---|
| 課題探索・人間判断 | 243.328秒 | `provider_turn_limit_exceeded` | 未発行 | 確認済み／不要 |
| 設計・検証接続 | 241.093秒 | `provider_task_result_envelope_invalid` | 未発行 | 確認済み／不要 |
| 文書・過去CHG可読性 | 188.489秒 | `provider_turn_limit_exceeded` | 未発行 | 確認済み／不要 |

呼出し合計は672.910秒。これは人間の実作業時間、AI総処理量、Task開始から採用可能結果までの時間ではない。実際のturn内訳、token／quota、失敗したEnvelopeのfield、人間の初見理解時間は未取得。候補未発行なので内容品質の改善率は測定できず、単一Agent直接実行との比較も未実施である。

## 承認運用の是正

人間は、既にCodexが文書を読む運用と両Provider併用を承認しているのに、Taskごとに外部送信を理由として再確認する負荷を指摘した。[外部情報境界](../../../01_Principles.md#external-information-boundary)と[判断支援契約](../../../11_Skill.md#53-decision-support-contract)は、許可した処理境界の再利用と同じ判断の再要求禁止を既に定めている。

今回は規範を重複追加せず、親Coordinatorが承認済み作業集合、送信先・Account、情報分類、目的、対象文書範囲、課金制限、保持・失効条件を実行要求へ引き継ぐ運用へ是正する。Task名、同じ分類の文書、既存Provider内の役割変更だけで許可を失効扱いにしない。ロードマップへの掲載だけをAuthorityとせず、採用済み範囲への人間の実行承認と合わせて照合する。

新しい送信先、許可外情報、追加課金、公開・破壊的Effectなどの実質的な境界変更・判定不能時には停止する。外側の実行環境とRuntimeの許可は別であり、拒否を別コマンドで迂回しない。今回の承認で将来の拒否が絶対になくなるとは保証しない。

## 検出した不整合と処置

| 対象 | 根拠と処置 | 未確認・保持条件 |
|---|---|---|
| 承認範囲の引継ぎ | 実行前の拒否と実行時の同意再利用を分離して記録。親が既存承認根拠を要求へ添付して再開 | 安全検査を省略せず、外側の承認機構そのものは変更しない |
| 複数文書を扱うReviewer | 3件ともReviewer選定まで到達。現行Reviewer medium上限6、読取り6文書。2件で上限停止 | 必要操作量との不釣合いは仮説。操作内訳未観測のため上限引上げ・高価なモデルへ自動変更しない |
| Claude実行計画と結果検証 | ローカルでExecutor medium計画12／high16に対し、受取り側が9以上を拒否することを再現。既存計画の役割・推論別上限を共通定義とし、argv・説明・結果受理を接続 | 今回のReviewer失敗の原因とは断定しない。既存上限自体は変更しない。結果契約をrevision 11へ更新。修正後の実Provider実測は未実施 |
| 選定理由の由来 | 要求は`auto`だが実行前表示は`same_provider_user_constraint`。Task Runtimeが事前選定結果を段階実行の固定Providerとして渡し、再選定時に人間指定と同じ説明になるコード経路を確認 | 経路自体の不正は未確認。事前選定理由と再検証制約の由来を区別する改善候補。今回は未修正 |
| Discoveryの古い開始条件 | 先行自己適用済みの記述と、Runtime完成前の実装中禁止が混在。同じCHGの既存開始判断へ同期し、CHG新規発行を一律要求する記述も訂正 | 完成・採用・最終監査・Releaseは未完了のまま。新しい規範を採用しない |

## 検証と残件

変更前の全体Checkerは358 Markdown、2,183 links、675 anchors、Error 0、Warning 0。Runtime Trace整合と契約試験9/9もPassだった。それでも実務3件は未完了であり、静的検査・試験件数を有用性の代替にしない。

上限是正後は実行計画と結果正規化の18試験、開発E2E 218試験、production／test型検査、Lint、FormatがPass。新しい境界試験は2役割×3推論について、起動argvと正常・境界・超過・不正turn数を同じ試験で照合する。偽入力の試験であり、実Providerで新しい候補が成立した根拠ではない。

担当はCHG-000015／CHG-000055の親Coordinator。次はReviewerの読取り・結果搬送の不足を安全な観測と小さい実務ケースで切り分け、評価内容を取得して必要是正を行う。人間の新しいDiscovery回答、実画面の視覚品質、初見理解時間、Provider使用量、3条件比較、全件の採用可能結果および最終独立監査は未確認として保持する。Runtime sourceを変更したため、旧署名版の成功を修正版へ流用しない。開発確認と実務自己適用を収束させた最終候補だけを、正式署名E2E・一括監査へ渡す。
