# Workbench助言の通知契約照合

## 結論

新しい署名Runtimeの単独Codex助言は、具体的な理由`workbench_ai_codex_tool_event_forbidden`で拒否された。Providerは正常終了し、資源回収と終了後のexact回復在庫の正常を確認した。実通知種別は記録していないため、実測原因が思考通知だったとは断定しない。

一方、Sourceと公式通知形式を照合し、正常な思考通知をTool操作と同一視する契約不整合を確認した。これを局所是正した。実Providerでの解消確認とWorkbench全体のE2Eは未完了である。

## 単独実測の根拠

| 項目 | 記録 |
|---|---|
| 署名Runtime | Commit `ecb7fb1da150057d1909e08be7cb76441197242f`、Sequence `2026093003` |
| 実測期間 | 2026-09-30 16:42:18〜16:43:58 JST |
| Request | `ai-request.310615bf-4bb7-442f-838a-17888802dbf6` |
| Operation | `OP-50583583752148143243966095739297233948` |
| 結果 | `blocked / workbench_ai_codex_tool_event_forbidden`、`PROBE_EXIT=2` |
| Provider終了後 | Process正常終了、Tree終了、Container／Network不存在、cleanup確認済み |
| exact回復在庫 | `completed / docker_task_runtime_state_clean`、回復ID集合空、手動回復不要 |
| 正本確認範囲 | `PROJECT_CONTEXT.md`不変。全Repository不変の主張はしていない |
| 保存ログ | `.crdd/tmp/workbench-advice-diagnostic-ecb7fb1d.log.txt` |
| ログSHA-256 | `0ef3b93285b1e76a873e4f3f88e53b6331237abc729cef63d8ee4559044eb55e` |

既存の固定Task送信同意を使用し、API Key fallback、候補採用、Commit、Push、Docker再起動は発行していない。

## 修正方針と照合

[公式のJSONL通知形式](https://learn.chatgpt.com/docs/non-interactive-mode)では、思考とTool操作が別のItem種別である。現抽出器は正常な思考を拒否する一方、不正Itemや更新通知を検査対象から除いていた。

着手前の独立確認と親担当の正本照合を行い、次の有限な反例へ処置した。

| 通知・条件 | 処置 |
|---|---|
| 思考通知と唯一の正常最終回答 | 最終回答だけを返す。思考本文は非公開 |
| 思考通知だけ、複数最終回答、失敗Turn | 拒否 |
| Command、File変更、MCP、Web、Plan、未知Item | 開始・更新・完了すべてで拒否 |
| Item欠落、null、配列、未知`item.*` | 正常回答が別にあっても拒否 |
| 完了Agent本文の欠落・不正型 | 正常回答が別にあっても拒否 |

思考本文の段階別必須Fieldは公式ページだけでは確認できないため、推測で要求しない。抽出・公開へ使用する唯一の最終Agent本文だけを型検証する。

変更分類は、既存のTool禁止と助言専用契約を保つ実装是正である。変更箇所はCoordinator出力抽出器、契約試験、Architecture Detailおよび本Evidenceである。共通Result Schema、許可済み参照、六拒否理由、Authority、retry、取消、Recoveryおよびcleanupは変更しない。独立技術レビューと文書照合を実施し、準拠基準・安定ID・工程契約を変更しないため準拠監査を追加しない。

## 検証

Formatter、型、Lint、Capability Graph、Runtime Traceability、Project Runtime Traceabilityが順に合格した。関連三Fileの試験は257／257合格、失敗・取消・skipは0である。Host固有試験を対象としていないため、Hostまたは全回帰合格へ読み替えない。

固定差分の独立レビューはPassで、確認者自身のUTも8／8合格した。正常な思考通知の非公開、不正Item・各段階のTool拒否、唯一の最終回答、六拒否理由、後段Schemaおよび取消・回復・cleanupの不変を確認した。これは実Providerでの解消確認ではない。新署名候補での単独再実測は未完了であり、署名済み旧stagingは変更していない。

## Checklist

- [x] 実測した拒否理由と推定原因を分けた。
- [x] 正常通知の契約不整合を公式資料とSourceで照合した。
- [x] 思考本文を公開せずTool拒否を維持した。
- [x] 不正・未知通知と各段階のTool通知を反証した。
- [x] 静的確認を試験より先に行った。
- [x] 単独診断とWorkbench全体の合格を区別した。
- [x] 固定差分の独立レビューを完了した。
- [ ] OPEN: 新署名候補の単独実測を完了する。拒否が続けば実通知分類を安全な固定診断で確認し、原因を再照合する。
