# 実Providerによる指摘・是正・再確認の限定実測

状態: 限定実測完了、Runtime全体の完成判定とは分離
担当責任者: Qual-Lab
実測日: 2026-08-31
関連変更: [CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md)

## 結論

Claude Codeの初回候補をCodexが指摘し、同じClaude Codeが是正、同じCodexが再確認して承認する1往復が成立した。最終候補は期待する6 bytesと完全一致し、公開入口で取り出して検証した後に破棄した。正本Repositoryは変更していない。

これは過去に実失敗した是正経路の残余不確実性を減らす限定確認である。「実測がない能力はすべて新しい必須条件にする」という規則ではない。初回欠陥を意図的に作る検証依頼であり、通常実務での是正成功率やProvider間比較を示さない。

## 対象と実行条件

| 項目 | 対象 |
|---|---|
| 署名済み実装 | Commit `45ea2acd5cac21ce0b5cb3256f2cb0656ec8b37a`、Tree `082d8b2499477cc5f711b2a8508f48ab31d0fe0e` |
| 操作対象 | Commit `3495bcd1b0455ab8eccaf55dcb7436d65d620e46`、Tree `a6a0d364e82f2fb0030ccbd6b4de6695742f4988`、Git object format SHA-1 |
| 同一性確認 | 実行直前にHEAD／Treeとdirtyなしを確認。候補結果のbaseCommit／baseTreeが一致し、終了後も同じHEADとdirtyなしを確認 |
| 公開入口 | 同じ署名配布物の`40_Develop/coordinator/bin/launch.ts automation task --request-stdin --json`。UTF-8 JSONをstdinへ渡し、対話承認を模擬しない |
| 環境 | Windows、Node.js 24.19.0、既存の固定Docker／Provider配布と専用OAuth Home |
| 送信範囲 | 公開の検証指示と`40_Develop/coordinator/runtime/remediation-verification.txt`だけ。人間がこの限定実測を承認し、Runtimeは初期同意を再利用 |
| 費用・上限 | 既存Subscriptionのみ。最大1回の是正、4回のProvider呼出し。API key、有料API fallback、追加購入なし |
| 署名 | 既存の署名配布を検証。秘密鍵・passphrase入力・再署名なし |

初回実行だけ`INITIAL`＋LFを作る欠陥注入用の依頼を渡し、最終受入条件は両方のレビューで一貫して`FINAL`＋LFとした。Reviewerへ架空の指摘や不正な承認を要求していない。Runtimeの是正指摘がある場合だけExecutorが基準と照合して修正する。依頼全文と入力hash、公開結果、終了後確認は[限定記録](CHG-000015_Remediation_45ea2ac.json)に保持する。

## 観測結果

| 確認項目 | 結果 |
|---|---|
| 開始・終了 | 13:42:10.930Z～13:45:30.749Z、約200秒、終了コード0 |
| 実行担当 | Claude Code、opus、low、通常速度 |
| 独立確認担当 | Codex、gpt-5.5、medium、通常速度。固定Linux環境のSol互換性制限に基づく選定 |
| 是正 | `remediationPerformed: true`。選定通知はExecutor→Reviewer→Executor→Reviewerの4回 |
| 最終判定 | `coordinator_task_candidate_approved`、Reviewer `approved`、最終finding 0 |
| 候補 | 変更先1件、内容hex `46 49 4e 41 4c 0a`、SHA-256 `612a6a1e05c9c0e04ddf584447a8cd7a22b206195b8cf82fbe23f339e23ef024` |
| 候補の終了処置 | 公開`candidate export`でhash・byteを確認し、同じIDを`candidate discard`。13:45:52.715Zに破棄・正本dirtyなしを確認 |
| 資源・回復 | `cleanupConfirmed: true`、`manualRecoveryRequired: false`、`processRestartRequired: false`、回復IDなし |

原文のProvider出力を追加保存せず、公開Task結果と必要最小限の実行記録だけを残した。`credentialAbsenceVerified: false`はそのまま保持し、秘密が一切存在しなかった証明へ変換しない。実行中の選定通知は上記4段階を観測したが、Provider内部Turn数・token量・利用枠消費量は測定していない。

## 限界と再確認

- Claude実行／Codex確認の1件だけであり、逆方向の実是正、全種類の指摘、成功率、長い作業への一般化はしない。
- 実OSの取消配送と実Docker回収の接続はこの確認に含まない。
- 実務成果物や人間の受入ではなく、欠陥を仕込んだ確認用候補である。有用性評価へ通常実務1件として加算しない。
- 署名版の後にProcess所有処理を変更した場合、本結果は変更前実装の実測として保持する。変更後の開発試験・独立再確認・配布判定と区別する。
- 是正指摘の搬送、Task Packet、Provider Adapter、再捕捉または再レビュー条件を変更したときは、Qual-Labが影響範囲を再評価する。本結果だけで全体監査、統合、Releaseを完了にしない。
