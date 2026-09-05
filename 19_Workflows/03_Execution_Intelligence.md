# 実行知の利用・開発確認手順

状態: 現行の操作手順
担当責任者: Qual-Lab
最終更新日: 2026-09-05

## 目的と対象

この手順は、CRDD公式Repositoryまたは採用RepositoryのRuntime Adapterから実行知（Execution Intelligence）を利用し、決定論的な開発確認を行う担当者向けである。Event、保存、欠測、保持および完成条件は[実行知のアーキテクチャ](../06_Architecture/execution-intelligence/01_Architecture.md)、検証項目は[検証設計](../07_Quality/03_Verification_Design.md#execution-intelligence-verification)を正本とする。この手順の実行だけで品質受入、正本更新、外部送信またはReleaseを成立させない。

## Runtime Adapterからの利用

1. 対象Projectと、Version Controlが返すexact Repository Rootを確定する。
2. 公開入口の`verifyExecutionIntelligenceRepositoryRoot`へRootを渡す。拒否された場合は別Pathを推測せず、Effect 0で停止する。
3. 利用側Adapterで、仕事Identityと実際に観測した値だけから閉Eventを構成する。取得していない値は理由付き`not_observed`とし、要求値、推定値または既定値で補わない。
4. Root確認で返された同じ実行時能力とEventを`writeExecutionIntelligenceEvent`へ渡す。
5. 発行結果の`effectState`、`cleanupConfirmed`、`retryAllowed`、`manualRecoveryRequired`および`residualArtifactIds`を確認する。`blocked`または観測不能を記録成功へ読み替えない。
6. 集約または物理清掃では、同じRoot能力を使用する。清掃はexact Event Hash、未解決参照0および耐久Evidence IDが揃う場合だけ要求する。

外部AI APIを利用する採用Repositoryでは、API呼出しそのものを実行知へ委譲しない。利用側が既存の認証、送信許可および実行契約に従ってAPIを実行し、結果から確認できたProvider、Model、利用量、所要時間および結果だけをAdapterで変換する。Prompt、Response、秘密値、外部送信Authorityまたは内部推論をEventへ渡さない。

## CRDD公式Repositoryでの開発確認

対象packageの固定開発依存を使用する。

```powershell
Set-Location "<absolute-crdd-root>\40_Develop\execution-intelligence"
npm ci --ignore-scripts
npm run check
npm test
```

`npm ci`が外部package取得を必要とする場合は、Repositoryの外部情報境界と実行環境の許可に従う。既にexactな`package-lock.json`どおりの依存が存在する場合、確認のたびに再取得しない。Coordinator配下の`node_modules`やPATH上の別toolchainへfallbackしない。

通常確認は単体試験・結合試験、静的検査および登録済み利用側回帰を対象とする。性能試験・長時間試験、実Provider、Docker、秘密入力または外部送信は含めず、人間が対象と上限を明示しない限り実行しない。

## 結果と停止条件

| 結果 | 次の処置 |
|---|---|
| 静的検査・単体試験・結合試験が成功 | 対象変更から選択された利用側回帰を確認し、変更トレースまたは品質記録へ結果を返す |
| Root確認が拒否 | Pathを広げず、対象ProjectとRepository境界を確認する |
| Event発行が`blocked` | Effectと残存Artifactを確認し、無条件に再試行しない |
| cleanup不明または残存Lockあり | exact残存Identityを保持し、通常発行を成功扱いしない |
| Store読取り不能 | Event 0件と推定せず、観測不能として扱う |
| 利用側回帰が失敗 | 共通packageだけを合格にせず、公開入口とConsumerの契約差を是正する |

一時試験物はRepository Root直下のGit管理外`.crdd/test-tmp`等、確認済みの用途限定領域へ置き、package Directory直下へ作らない。終了後は試験が所有するexactな対象だけを回収し、回収不明を成功へ丸めない。
