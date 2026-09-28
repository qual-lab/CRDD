# Workbench Provider Adapter固定結果

## 結論

Workbench読取り助言の専用Dispatchから、解決済みProfileをCodexまたはClaudeの一方へだけ渡すProvider Adapterまで接続した。Provider、Model、推論強度およびOfferingはProfileからそのまま搬送し、自動Provider切替、Model fallbackおよびAPI Key fallbackを許可しない。

現時点では固定Provider Executorを接続していない。Production Workbenchは選択Providerごとの未接続理由を`blocked`として返し、Profile解決成功を実行可能とは表示しない。外部送信は実施していない。

## 成立した経路

```text
Workbench form
  ↓ one-request confirmation
Repository AI Application
  ↓ exact catalog revision / profile / task hash
Advice Dispatch
  ↓ single-use authority
Provider Adapter
  ├ codex → fixed Codex executor（未接続）
  └ claude → fixed Claude executor（未接続）
```

## 固定した条件

| 条件 | 結果 |
|---|---|
| 明示確認なし | HTTP境界とDispatch境界の両方でEffect 0 |
| Provider選択 | Profileの`provider`と完全一致する一方だけ |
| Model／推論強度 | exact Profile値を変更せず搬送 |
| Provider／Model fallback | 禁止 |
| API Key fallback | 禁止 |
| Profile契約不整合 | Executor呼出し前に`blocked` |
| 生Provider出力 | Dispatch外へ直接公開しない |

## 実Provider Executorの影響範囲

固定Executorは既存の一般Taskを`reviewer`へ読み替えて実装しない。追加時は少なくとも次を同じ変更で閉じる。

1. Codex／Claudeの読取り助言専用Execution Plan。
2. Repository mountなし、Toolなし、Provider request以外のNetworkなしのDocker構成。
3. Dynamic PromptをargvではなくProvider stdinへ渡す入力搬送。
4. 読取り助言専用結果SchemaとController側の正規化。
5. Effect、取消、timeout、cleanup、Recoveryの既存観測契約への接続。
6. 固定配布物、署名Manifestおよび実Provider E2Eの再検証。

## 確認結果

- Coordinator型検査: Pass。
- Provider Adapter／Dispatch局所試験: 9件Pass。
- Workbench型・Lint・統合試験: 18件Pass。
- HTTP境界で確認Checkboxを欠落させた反例: Application呼出し0、HTTP 400。
- CRDD Checker: 新規SymbolとTest Catalogの対応を含めてPass。作業Branch上で予期される`stable-release-tag-identity-mismatch`だけが残る。
- 実Provider Effect: 0。

## Checklist

- [x] 一般TaskのExecutor／Reviewerへ意味を読み替えていない。
- [x] exact ProfileのProvider、Model、推論強度を保持した。
- [x] 確認なし、Profile不整合、取消およびcleanup不明を成功へ畳まない。
- [x] 未接続Executorを実行可能と表示しない。
- [x] 実Provider Executor追加時の署名Runtime影響範囲を明示した。
- [ ] OPEN: 固定Codex／Claude Executor、署名候補および実Provider E2Eは未成立。Executor実装後に再評価する。
