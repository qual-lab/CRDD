# 変更トレース: Codex Subscription Runtime Adapter

- 変更ID: `CHG-000053`
- 状態: `Implementation in Progress`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25
- 対象: 公式Codex配布物、専用Subscription OAuth Home、Provider別Egress、固定Docker EffectおよびCoordinator逆方向経路
- 対象version: v0.18.0 Candidate
- 変更分類: `additive`（Codex Provider追加、Coordinator Runtime revision 2、Docker Effect Runtime revision 2、Docker Process Controller revision 6）
- 移行要否: `migration_required: false`（発行済みproduction Operationは0。永続Schemaを変更しない）
- 関連正本: [`CHG-000042`](CHG-000042_Provider_Neutral_Delegation_Selection_Grant.md)、[`CHG-000043`](CHG-000043_Docker_Process_Controller.md)、[`CHG-000049`](CHG-000049_Runtime_Docker_Effect_Executor.md)、[`CHG-000052`](CHG-000052_Coordinator_Claude_Probe_Runtime_Facade.md)

## 結論

公式Codex `0.149.1`のLinux x64 musl archive、展開binary、GitHub Actions Sigstore bundle、certificate identity、Rekor body Hashおよび固定Docker imageを同じ配布Identityへ結合した。既存ChatGPT Subscription OAuthだけを使う専用Provider Homeを作成し、API key、従量API、追加credit購入、自動plan切替および有料fallbackを許可しない。

CodexとClaudeはProvider別hostname集合を持つ同じ限定Proxyを使用する。Docker Engine 28では`--network=none`で作成したcontainerを別Networkへ接続できないことを実測したため、Providerは作成時からOperation internal Networkだけ、Proxyは作成時にinternal Networkへ接続した後にEgress Networkへ接続する固定7 commandへ変更した。Providerの直接外部Network、Docker socket、Host NetworkまたはHost fallbackは許可しない。

Coordinator Runtime revision 2は、Front Claude CodeからCodex Executorを選ぶ経路を、Front CodexからClaude Executorを選ぶ経路と同じSelection Grant、Mount Grant、Provider Authority、Repository／Revision binding、Process ControllerおよびRecoveryへ接続する。Provider同士の直接spawnや循環委譲は導入しない。

## 代表例と境界

- 発火例: Front Claude Codeの具体化済み低リスク作業を、credit分散の理由付きでCodex `gpt-5.6-sol`・低推論・通常速度へ委譲する。
- 非発火例: API key、従量API、有料fallback、高速モード、未知Provider、未検証Profile、署名Release不成立またはProvider Home保護差ではEffect前に停止する。
- 境界例: 同一Providerが説明可能な特性または反対Providerの実測不適格性を持つ場合だけ、既定のcross-provider経路を変更できる。
- 判定情報不足例: Subscription認証／quotaを別requestなしに事前観測できない場合、公式配布物、必要CapabilityおよびPolicyが成立した同じ上限付きrequest内だけで確認し、未知をfallback根拠にしない。

## 実測結果

2026-08-25に次を同じ固定候補へ確認した。

- Codex archive SHA-256: `e24fb784c7d71140d67afb620f56e9137496cf7f6c9e19217fa3666dcf306278`
- Codex binary SHA-256: `73dc5888888f411c1f0fa7b81d866e721dcc86b527ce8e3b2cf4708661e823ba`
- Sigstore bundle SHA-256: `1976d459060cac4638f481b72142271d8bbd821abebd72555145b83b2bf3e85e`
- Sigstore identity: `https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1`
- 固定Provider image: `sha256:8362d00d6831fb1a5302490f0053198911988a21fb70733d07ab1dcf0f3d7bae`
- 実Request: `gpt-5.6-sol`、低推論、通常速度、read-only sandbox、exit 0、exact `{"status":true}`
- Egress: 許可tunnel 11件、拒否5件、拒否通信は外部へ接続しない
- 後処理: Provider／Proxy Container 0、internal／egress Network 0、一時Evidence 0
- Provider Home: non-reparse、protected DACL、selected user＋SYSTEMの明示ACE exact 2、Credential内容非読取り
- 決定論的試験: 579件合格、型検査合格、Lint合格、差分空白検査合格

最初の実RequestはSchema親directoryの探索権限不足で通信前に停止した。2回目はOpenAI側が`const`だけのpropertyを拒否し400で停止した。`/etc/crdd`を非root読取専用`0555`へ固定し、Schemaへ`type: boolean`を追加した後、同じ安全境界で成功した。失敗runもContainer／Network／一時Evidenceを残していない。

## Security invariant

- Provider HomeからCredential内容を読取り、copy、Hash化、logまたはEvidence化しない。
- Provider image、Proxy image、model、effort、speed、argv、環境、Network、mountおよび所有labelをRuntime固定値へ再照合する。
- Providerはinternal Networkだけへ接続し、Provider別Proxy Profileが許可するhostname以外へ接続しない。
- Resultはexact Schema、exit、Repository Revisionおよび全cleanup成立後だけ正規化して公開する。
- cleanup不明時は成功出力を破棄し、manual Recoveryへfail closedにする。

## 残件

現在の縦断対象は固定boolean probeである。Coordinator Runtime 1.0全体の残件は、一般タスクPacket、隔離workspace内の限定ローカル差分、両Providerの一般Structured Result、署名配布物上のFacade実行、上流工程強化、完成固定版の独立レビュー／監査、ロードマップ整理、Issue #30判定および最終統合判断である。

現在、人間による追加判断は必要ない。保護対象の採用、統合、Releaseまたはリスク受容は行わない。
