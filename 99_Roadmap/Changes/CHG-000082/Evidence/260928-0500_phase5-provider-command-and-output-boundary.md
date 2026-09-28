# Phase 5 Provider Command／Output境界

## 1. 結論

Workbench読取り助言について、Catalogで確定したCodex／ClaudeのProfile Identityを、Repository非共有のProvider固有コマンド計画へ変換し、Provider出力から助言JSONだけを抽出する純粋な実行境界を追加した。

実Provider Effectはまだ発行していない。署名CoordinatorのDocker lifecycleは現在、Boolean ProbeとWorkspace付き一般Taskだけを所有している。Workbench助言をこの一般Taskへ流用せず、第三の`workbench_advice`実行Modeとして接続する必要がある。

## 2. 成立した境界

```text
AI Profile Catalog
        ↓ exact Profile / Model / Effort
Workbench Advice Execution Plan
        ↓
Provider Command Plan
├ Codex: stdin + JSONL
└ Claude: stdin + JSON envelope / inline Schema
        ↓
Provider Executor Core
        ↓
Provider Output Extractor
        ↓
Advice Result Normalizer
```

- PromptはCLI引数へ埋め込まず、標準入力だけで搬送する。
- Repository／Workspace mount、Tool、Session保持、API Key fallback、有料fallbackを許可しない。
- CodexはCommand／File Change等のTool Eventが一件でもあれば拒否する。
- Claudeは一Turnの成功Envelopeと`structured_output`だけを受理する。
- Session ID、Cost、Usage、生Eventおよび生Provider出力を公開しない。
- 事前取消はProvider Effect 0、Runtime例外はEffect発行可能性あり・cleanup不明として保持する。

## 3. 検証結果

| 確認 | 結果 |
|---|---|
| Provider Command／Execution Plan／Adapter／Executor／Output局所試験 | 22件すべてPass |
| Coordinator TypeScript型検査 | Pass |
| 対象Source／TestのBiome Check | Pass |
| 外部Provider送信 | 未実施 |
| 再署名 | 未実施 |

## 4. 残るGap

署名Coordinator内で、既存のProvider Home、Subscription認証、限定Egress、取消、Process tree回収、Docker資源cleanupを再利用しながら、Workspaceを一切mountしない`workbench_advice` lifecycleを追加する必要がある。

このGapを閉じる前に、Workbench Production Compositionを「実Provider接続済み」と表示しない。一般Taskを流用してRepositoryを読める状態にすることも認めない。
