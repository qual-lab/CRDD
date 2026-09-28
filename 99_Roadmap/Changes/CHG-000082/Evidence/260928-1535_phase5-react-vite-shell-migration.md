# Phase 5 React＋Vite Shell移行検証

検証日時: 2026-09-28 15:35 JST
対象変更: `CHG-000082`
対象範囲: Workbench Application Shell、Browser Build、固定Asset配信、既存15画面の互換境界

## 結論

WorkbenchのApplication ShellをReactへ移し、Viteで生成したBrowser Bundleを既存Node Workbench Serverが同一Originの固定Pathから配信する構成が成立した。既存のHTTP操作、Server側Authority、15画面DOMおよびDirection AのVisualは維持された。

これはReact移行の最初の固定単位である。既存15画面の内容RendererはServer生成・escape済みFragmentとしてReact Shellへ内包しており、全画面のReact Component化完了を意味しない。

## 構造

```text
React／TypeScript Source
        ↓ Vite Build
workbench-client.js
        ↓ exact allowlist
Node Workbench Server
        ├ React Server Rendering
        ├ localhost HTTP／操作Authority
        └ Browser Hydration
                ↓
        Direction A Workbench
```

## 確認結果

| 確認対象 | 結果 | 観測 |
|---|---|---|
| Vite Build | PASS | 11 Moduleを変換し、`dist/client/assets/workbench-client.js`を生成 |
| 型検査 | PASS | `tsc -p ./tsconfig.json` |
| Formatter | PASS | Biome 18 files、修正なし |
| Lint | PASS | Biome 18 files、警告・Error 0 |
| Workbench統合試験 | PASS | 18件中18件成功 |
| 固定Asset配信 | PASS | `/assets/workbench-client.js`を200で配信し、allowlist外Assetは404 |
| Browser Security | PASS | `script-src 'self'`を維持し、外部Scriptとinline Scriptを許可しない |
| 実Browser Visual／Hydration | PASS | React Effect後にだけ現れる`workbench-client-ready`を含め、15 Logical Screen、Desktop／Tablet／Mobile、100%／200%／400%を再観測 |
| Scoped CRDD Checker | PASS | 0 errors、0 warnings |

## 保持した境界

- Project Context、Topic、Meeting、Git、CredentialおよびAIの正本とAuthorityはClientへ移していない。
- Node Serverの既存POST Route、Action Tokenおよび同一Origin境界を維持した。
- Vite生成物は派生物としてGit管理せず、起動・試験前に生成する。
- Next.js、Server Action、ElectronおよびDesktop包装は追加していない。
- Client Bundleが存在しない場合は`workbench_client_asset_unavailable`で起動を拒否する。

## 残る処置

- 画面本体を意味単位でReact Componentへ段階移行する。
- React移行後の独立レビューと不足／影響監査を実施する。
- 実Provider E2EとAI関連2画面のProduction Closureは、既存のPhase 5残件として維持する。

## Checklist

- [x] ReactとViteの責務をNode ServerのAuthorityから分離した。
- [x] 既存15画面と操作契約を回帰確認した。
- [x] Client Assetを固定Path以外から配信していない。
- [x] Secret、CredentialおよびRepository PathをBundleへ注入していない。
- [x] 未移行画面をReact Component化済みと表示していない。
- [x] 実Browserで表示ProfileとZoomを再評価した。
