# MCP実クライアントの接続確認

変更: [CHG-000082](../change.md)

観測日: 2026-11-27

対象: CRDDの公開単体stdio入口と、検証環境にあるCodex CLI `0.171.0-alpha.13.2`。

合成リポジトリと専用ホームを作成し、既存の設定・認証を使わず、CodexのMCP状態照会からCRDDを開始した。モデル実行やツール実行は行っていない。

- Codexが最初に送信したのは `2025-06-18` の `initialize` で、要求単位のメタデータはなかった。
- CRDDは `-32601` を返した。CodexのMCPサーバー登録は見えたが、ツール一覧は0件で接続は成立しなかった。
- 現行契約は明示したmodern版 `2026-07-28` だけを扱い、旧Initializeの互換入口を持たない。[SDK移管記録](../mcp-server-sdk-structure.md)の固定版を使う公式SDK Clientの成功と、今回の実クライアント結果は別である。

## 未確認と判定

Claude Codeは検証環境のPATHと通常の実行ファイル配置から確認できず未実施。共有OAuthの実クライアント接続も今回の試験範囲外。旧規格の受入れは対応範囲の変更となるため、互換処理は追加していない。現行方針を維持する場合は、modern版を送る実クライアントで再確認する。

## Codexの機能フラグを有効にした再確認

同版で `mcp_2026_07_28` の既定値は `false`、起動時に `--enable mcp_2026_07_28` を指定すると `true` と表示された。合成リポジトリと専用ホームで、stdioに対する二条件を分けて観測した。

- 機能フラグだけを有効にした場合、最初の要求は `initialize`（`2025-06-18`）だった。
- MCPサーバー個別の `[mcp_servers.<名前>.env]` に `CODEX_MCP_PROTOCOL_VERSION = "2026-07-28"` も指定した場合、最初の要求は `server/discover`（`2026-07-28`）になった。この二条件は[Codexの実装変更](https://github.com/openai/codex/pull/35724)とも一致する。
- この再確認では、Codexが起動したCRDD CLIが `crdd_server_startup_unavailable` で終了し、応答とツール一覧は取得できなかった。規格の選択を確認した結果であり、modern版の接続成功ではない。既存の利用者設定の変更、モデル呼出し、ツール実行は行っていない。

合成リポジトリに必須の `PROJECT_CONTEXT.md` とマニフェストを用意し直したところ、CRDDは `server/discover` に成功したが、続く `tools/list` を `-32602` で拒否した。要求の項目名と型だけを観測し、Codexが標準の `_meta.progressToken`（数値）を送る一方、CRDDの許可集合にその項目がないことを確認した。[公式SDKの入力契約](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/server/mcp.html)に合わせ、CRDDは文字列・有限数値を受け取るだけとし、進捗通知を発行しない。

是正後は同じ実Codexから `server/discover` と `tools/list` が成功し、`crdd.start_objective` を含む46件を取得した。クライアントが追加で照会した未提供の `resources/list` と `resources/templates/list` には `-32601` を返し、ツール一覧の取得には影響しなかった。合成リポジトリの単体stdioのみを確認し、実際のツール呼出し、モデル呼出し、共有OAuth、Claude Codeは未確認。
