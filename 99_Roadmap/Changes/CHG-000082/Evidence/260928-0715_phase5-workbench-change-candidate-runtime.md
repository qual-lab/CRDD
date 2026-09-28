# Workbench変更候補Production Runtime検証

- 変更候補時だけRepository相対の許可Pathを一件以上必須とした。
- 読取り助言では許可Pathを受け付けず、変更候補のPath Authorityへ流用しない。
- 選択したExecutor Profile IDとProviderをProject Runtime Taskへ固定した。
- 候補生成結果はCandidate IDと`untrusted_not_adopted`だけを公開し、採用・Commit・Publishを行わない。
- 許可Pathなしの局所試験でTask Effect 0を確認した。
- Coordinatorの型・Formatter・Lint・Runtime Traceability確認、およびWorkbench AI依頼の局所統合試験を通過した。

未実施:

- 実Providerを用いた署名付き変更候補E2E。外部送信と署名の人間承認が必要なため、Production Closure Gateで別途実行する。
