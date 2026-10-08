# 実行知の利用・開発確認手順

状態: 現行の操作手順
担当責任者: Qual-Lab
最終更新日: 2026-10-06

## 目的と対象

この手順は、CRDD公式Repositoryまたは採用RepositoryのRuntime Adapterから実行知（Execution Intelligence）を利用し、決定論的な開発確認を行う担当者向けである。Event、保存、欠測、保持および完成条件は[実行知のアーキテクチャ](../06_Architecture/Details/execution-intelligence/01_Architecture.md)、検証項目は[実行記録の公開と再利用](../07_Quality/Definitions/QA-000012/quality_definition.md)と[投影と出所](../07_Quality/Definitions/QA-000004/quality_definition.md)を正本とする。この手順の実行だけで品質受入、正本更新、外部送信またはReleaseを成立させない。

## Runtime Adapterからの利用

1. 対象Projectと、Version Controlが返すexact Repository Rootを確定する。
2. 公開入口の`verifyExecutionIntelligenceRepositoryRoot`へRootを渡す。拒否された場合は別Pathを推測せず、Effect 0で停止する。
3. 利用側Adapterで、仕事Identityと実際に観測した値だけから閉Eventを構成する。取得していない値は理由付き`not_observed`とし、要求値、推定値または既定値で補わない。
4. Root確認で返された同じ実行時能力とEventを`writeExecutionIntelligenceEvent`へ渡す。
5. 公開Writerの成功は`status: "completed"`である。設計上の概念状態`recorded`をAPIのstatus値として判定しない。成功時も`effectState`、`cleanupConfirmed`、`retryAllowed`、`manualRecoveryRequired`および`residualArtifactIds`を確認する。`blocked`または観測不能を記録成功へ読み替えない。
6. 集約では同じRoot能力を使用する。通常履歴の期間整理は保存Ownerの契約に従い、未解決・回収未確認の記録や正式Evidenceを期限だけで消さない。

外部AI APIを利用する採用Repositoryでは、API呼出しそのものを実行知へ委譲しない。利用側が既存の認証、送信許可および実行契約に従ってAPIを実行し、結果から確認できたProvider、Model、利用量、所要時間および結果だけをAdapterで変換する。Prompt、Response、秘密値、外部送信Authorityまたは内部推論をEventへ渡さない。

TypeScriptアプリケーションでは、公開packageから`createExecutionIntelligenceRecorder`をimportし、起動時にexact Repository Rootへ一度結合する。成立後はRecorderへ仕事Identityと観測済みmetadataを渡す。Root検証を各呼出箇所で再実装せず、低水準Store APIを使う必要がある場合だけ同じ公開packageの検証済みRoot能力を直接扱う。

```ts
import {
  createExecutionIntelligenceRecorder,
  notApplicable,
  notObserved,
  observed,
} from "@qual-lab/crdd-execution-intelligence";

const created = createExecutionIntelligenceRecorder(repositoryRoot);
if (created.status !== "completed") throw new Error(created.reason);

created.recorder.recordTaskAttempt({
  occurredAt: new Date().toISOString(),
  identity: workIdentity,
  execution: {
    role: "executor",
    provider: observed("example-provider", "api_response"),
    model: observed("example-model", "api_response"),
    inputStrategyRef: observed("app/request-policy/v1", "application"),
    durationMs: observed(durationMs, "monotonic_clock"),
    usage: {
      inputTokens: observed(inputTokens, "provider_usage_receipt"),
      outputTokens: observed(outputTokens, "provider_usage_receipt"),
      cacheReadTokens: notObserved("provider_did_not_report_cache_read"),
      cacheWriteTokens: notApplicable("provider_has_no_cache_write_metric"),
      costOrCredits: notObserved("billing_receipt_not_available"),
    },
    humanActiveMs: notApplicable("unattended_api_execution"),
  },
  outcome,
  quality: notObserved("acceptance_not_evaluated"),
});
```

この例の`workIdentity`、`durationMs`、`inputTokens`、`outputTokens`および`outcome`は利用側が成立させる値であり、ライブラリが推定する値ではない。利用量の一部だけ取得できる場合は取得済みfieldだけを`observed`にし、費用が不明だからTokenも未観測にする、またはCache未報告を0にする処理を行わない。ApplicationがBundlerやWorkspace packageを使う場合も公開package入口だけへ依存し、`src/core`や`src/store`を直接importしない。npm等の独立配布形態は現行Release範囲に含めず、CRDD clone／submodule内の同じ改訂版を利用する。

## 一般Operationと新形式への移行

Taskを持たない記事・画像・評価等は、同じRecorderの`recordOperation`へProject／Operation／ExecutionのIdentityを渡す。Task専用Identityを創作しない。Profile名から実効Modelを推定せず、実際に取得できた割当・診断・使用量だけを観測として渡す。生のProvider応答、自由文error、Header全体は渡さない。

保存先は`<verified-repository-root>/.crdd/execution-intelligence/`である。旧`execution/`は自動読取り・変換・再生されない。フロントAIは次を実施する。

1. 旧Producerを停止し、使用中・未解決・参照中の記録を確認する。
2. 正式判断に必要な根拠を品質／CHGへ保全し、通常記録を新契約へ変換する。取得できない新fieldは理由付き未観測とする。
3. 新公開Recorder／ReaderでIdentity、件数、欠測、結果を照合する。期限対象外として保全した物を通常履歴へ混ぜない。
4. 移行結果と参照終了を確認した旧領域だけを清掃する。不明・使用中・未解決なら削除せず担当者へ戻す。

## 履歴保持期間の設定

設定は機能別でなくTool別に持つ。`template/.crdd/config/execution-intelligence.example.json`を参考に、次を`<verified-repository-root>/.crdd/config/execution-intelligence.json`へ置く。Orchestratorは別の`orchestrator.json`と対応する設定例を用いる。非秘密のRepository設定として両ファイルをGit管理できる。実行履歴、Lock、一時物、秘密およびCandidateは追跡しない。

```json
{
  "schemaRevision": 1,
  "historyRetentionDays": 30
}
```

各Toolは自分の設定だけを読み、もう一方の不正設定や不存在を処理条件にしない。設定ファイルが存在しない場合だけ各30日を使う。期間は正の整数日で指定し、不正設定を既定値へ黙って置換しない。設定は通常履歴だけに効き、キュー、未受理結果、未解決回復、候補Patch、認証、署名鍵、正式Evidenceには効かない。過去に削除済みの記録は期間を延ばしても復元されない。設定読取り不能・不正時は当該Toolの期間整理を停止し、無制限保持や短縮削除へFallbackしない。

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

一時試験物はRepository Root直下のGit管理外`.crdd/tests/execution-intelligence/<run-id>/`等、確認済みの実行単位へ置き、package Directory直下へ作らない。終了後は試験が所有するexactな対象だけを回収し、回収不明を成功へ丸めない。
