# 成果物署名責務の分離

変更ID: `CHG-000072`
状態: `Ready for Release Handoff`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `architecture_refactor`

## 1. 変更の目的

起点Discovery: [EXP-000014](../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)／`REQ-000036`

Coordinatorに残っていた鍵参照、秘密入力および暗号署名Primitiveを、成果物の意味に依存しないRoot Componentへ分離する。Runtime Manifest固有の観測、Policy、payload、順序および配置はCoordinatorに維持する。

## 2. 責務変更

| 対象 | 変更前 | 変更後 |
|---|---|---|
| 鍵参照 | Coordinator SignerがenvとCLIを別々に検査 | Artifact Signingの共通preflightへ統一 |
| 秘密入力 | Release鍵生成Script内の関数をSignerが借用 | Artifact Signingのdirect TTY Adapterを両入口が利用 |
| 暗号署名 | Coordinatorが鍵読取り、復号、公開鍵導出、署名を所有 | Artifact Signingが任意byte列への署名を所有 |
| Manifest | Coordinatorが構築・署名・配置を一体所有 | Coordinatorは意味固有のpayload、Policy、P／S順序、envelope、配置を所有 |
| 配布Identity | Coordinator Sourceだけを中心に閉包 | 到達したArtifact Signing Sourceとpackage metadataを含む |

## 3. 変更禁止範囲

- `.env-crdd`へ秘密鍵内容またはpassphraseを保存しない。
- passphraseをargv、環境変数、redirected stdin、一時fileまたはlogへ移さない。
- 汎用署名ComponentへRuntime Manifest Schema、固定Publisher Policy、Release状態またはstaging配置を移さない。
- Version Control、Runtime DataまたはCoordinatorの既存Authorityを署名成功から生成しない。
- 公式秘密鍵をComponent試験に使用しない。

## 4. 完了条件

| Gate | 完了条件 |
|---|---|
| Architecture | 責務、状態遷移、Input／Output、秘密・Effect境界を固定 |
| Component | 鍵参照、hidden input、Ed25519署名をRoot packageへ実装 |
| Consumer Closure | 鍵生成、CLI鍵指定、`.env-crdd`指定、Coordinator Signer、Runtime配布閉包を移行 |
| Verification | Component試験、Coordinator署名契約、静的確認、全体CheckerがPass |
| Independent Review | Critical／Major／Moderate 0 |
| Fixed Candidate | 新しい固定Commitから候補を作り、正式署名とE2Eを完了 |

詳細設計は[成果物署名のアーキテクチャ](../../../06_Architecture/artifact-signing/01_Architecture.md)を正本とする。旧固定Commit `5d56eced`の候補は未署名のまま再利用せず、新しい固定Commitから作り直す。

## 5. 独立レビューと是正

| 指摘クラスタ | 構造是正 | 反証 |
|---|---|---|
| 秘密鍵byteの所有権移転前failure | read、再観測、closeの失敗を一つの終了境界へ集約し、確保済みBufferを消去してから失敗を返す | 3 failure pointでzeroizationを直接観測 |
| direct TTYのLifecycle | setup、入力、改行出力、取消、EOF、teardownを単一状態機械へ統合し、各cleanupを独立に最後まで試行してPromiseを一度だけ終了 | 非TTY、setup 5点、改行出力、取消、EOF、cleanup 4点を反証 |
| Runtime依存宣言の重複 | Artifact Signingの重複登録を削除し、source、package path、package nameの一意性を契約化 | Coordinator依存宣言一意性試験Pass |

最終独立再レビューはCritical／Major／Moderate 0の`Pass`と判定した。Artifact Signingの型、lint、formatおよびOwner試験5件、Coordinatorの型、lint、format、Capability GraphとTraceability、Checkerの型、Catalog契約および全体文書確認はPassした。固定Commit後の再実行では、署名契約試験自身の基準配布fixtureが新Componentを含まない利用側取り残しを検出した。期待値を変更せず、Artifact Signingを同fixtureの配布集合へ追加し、鍵生成と署名契約19件の全Passを確認した。

## 6. 署名済み検証

[署名済みE2E Evidence](Evidence/260913-2335_signed-e2e.md)により、固定Commitの署名、4経路E2E 4／4、Recovery Matrix、cleanupおよび手動回復義務なしを確認した。これにより本変更の実装・検証は完了し、v0.21.0のRelease判断へ引き渡せる。v0.21.0全体の採用、統合またはRelease判断は本判定に含めない。
