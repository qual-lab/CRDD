# AI実行記録の利用・開発確認手順

状態: 現行の操作手順
担当責任者: Qual-Lab
最終更新日: 2026-11-11

## 目的と対象

実行記録（Execution Intelligence、EI）の現行9操作を利用する担当者向けの手順である。契約は[EI詳細設計](../06_Architecture/Details/execution-intelligence/01_Architecture.md)、検証義務は[QA-000012](../07_Quality/Definitions/QA-000012/quality_definition.md)と[QA-000004](../07_Quality/Definitions/QA-000004/quality_definition.md)が所有する。実行記録の保存をAI実行、品質受入、Recovery許可、外部送信又はRelease成立へ読み替えない。

## Runtime Adapterからの利用

1. 呼出し側が保存先を確定・準備し、StoreOptionsのdirectoryとretentionDaysを渡す。EIは親Directoryの作成・Repository探索・設定読取りを行わない。
2. 一回の論理AI実行にexecutionIdを確定する。必要な場合だけcreateGroupで先にGroupを作り、groupIdを渡す。
3. AI要求直前にcreateExecutionを呼ぶ。Task受付やPlan準備の時刻をAI開始時刻へ混ぜない。
4. AIを既存Ownerから実行し、終了観測を捕捉する。EIはAIやDockerの実行・取消をしない。
5. 必要な上位判定後に、同じIDへcompleteExecutionを一度適用する。終了日時・経過時間は下位終了時点の値を保ち、後段待機を加算しない。Group自身の終端はcompleteGroupで別に記録する。
6. getExecution／getGroup、listExecutions／listGroups、summarizeExecutionsで記録を読む。観測不能と正常な不存在を区別する。

CRDDではCoordinatorの既存Provider要求通知・Completion・Host清掃後の最終判定へ接続する。必須Recovery Intent保存と任意EI保存は別の失敗境界である。EI失敗を新しいAI停止条件にせず、記録ID・元境界の回復参照を診断へ保持する。

### 記録例

次の値は呼出し側が確定した前提値であり、EIが取得・推定するものではない。

~~~ts
import {
  createExecution,
  completeExecution,
  type StoreOptions,
  type ExecutionCompleteInput,
} from "@qual-lab/crdd-execution-intelligence";

declare const store: StoreOptions; // 準備済みDirectoryと保持設定
declare const executionId: string;

// 既存OwnerからAIへ要求する直前に実行する。
const created = createExecution(store, {
  executionId,
  application: "example-application",
  startedAt: new Date().toISOString(),
});

// AI終了時の観測を固定し、必要な上位判定後に渡す。
// Prompt、応答本文、Credentialを含めない。
declare const capturedCompletion: ExecutionCompleteInput;
if (created.status === "completed") {
  const saved = completeExecution(store, executionId, capturedCompletion);
  // saved.statusだけでなくEffect、cleanup、元IDと残存参照を確認する。
}
~~~

この例は記録接続だけを示し、AI要求の発行や認可を実装しない。createの成功は実際のAI開始の証明ではない。元Completionを観測できない場合は終了を創作せずopenを残す。使用量・実効Model・Provider実時間が未取得なら、要求設定から推測せず欠測を保持する。

公開型のObservationはobservedとsource、又はnot_observed／not_applicableとreasonで直接表現する。観測値HelperやRecorderを別途取得する必要はない。Task／Attempt等は任意metadataとして渡し、Taskを持たない利用側に架空のTaskを要求しない。任意metadataの情報分類は利用側が所有する。

## 検索・集計

| 操作 | 注意点 |
|---|---|
| getExecution／getGroup | 正常な不存在はcompletedのnull。blockedを不存在へ畳まない |
| listExecutions／listGroups | 条件は完全一致、期間は開始日時の半開区間。指定ページと全該当件数を返す |
| summarizeExecutions | ページ分割前の母集合を集計。open／unknownを成功率の分母に入れない |
| 費用・時間 | 金額／Credit、単位、reported／estimated、経過時間／Provider実時間を混ぜない |

Group終了は子の完了・成功を保証しない。未完了・unknown・未解決の子と、それが参照するGroupは保持される。

## 履歴保持期間の設定

EIライブラリはStoreOptions.retentionDaysを必須とする。CRDDではCoordinatorがDMの既存設定Readerから、Repository-localの.crdd/config/execution-intelligence.jsonを取得し、準備済み保存先とともに渡す。設定不存在の場合だけDMの既定30日を使い、不正・観測不能を既定値へ補完しない。Coordinator自身の履歴は別のcoordinator.jsonで管理し、旧orchestrator.jsonを探索しない。

保持設定を変えても削除済み記録は復元されない。正式Evidence、Queue、候補、認証情報、未解決回復を通常履歴の期限で整理しない。EIの出版時整理は未完了・unknown・unresolved・参照Groupを保護する。

## 一般Operationと新形式への移行

保存形式はexecution-intelligence/history/v3である。旧形式・混在を自動読取り・変換しない。移行はフロントAIの別途許可された作業とする。

1. 旧Producerを停止し、参照・未解決義務と必要なEvidenceを確認する。
2. 新しいExecution／Groupへ対応付け、取得不能な値を創作しない。
3. 新9操作でID、内容、件数、欠測、Group参照、保持を照合する。
4. 移行・参照終了・明示許可が確認できた対象だけを別作業で清掃する。

この手順の更新や開発試験は、既存履歴・旧保持物の移行・削除を許可しない。

## CRDD公式Repositoryでの開発確認

対象packageに固定済みの依存を使用する。依存が既にある場合は確認のたびに再取得しない。

~~~powershell
Set-Location "<absolute-crdd-root>\40_Develop\execution-intelligence"
npm run check
npm test
~~~

個別試験は静的検査成功後に対象を限定する。全体回帰、実AI・Docker、外部送信、秘密入力、性能・長時間試験は別の許可と実行条件に従う。今回の責務分離では実施しない。

## 結果と停止条件

| 結果 | 処置 |
|---|---|
| 保存成功 | Effect・cleanup・同じ記録IDも確認する |
| 出版前拒否 | 不正入力や競合を是正。no_effectを全Filesystem操作0と拡大解釈しない |
| 出版又は解放不明 | 同じIDと元回復参照を保持し、自動再送・別ID作成をしない |
| Lock／pending／未知残存 | 時刻や名前だけで削除・奪取しない |
| 読取りblocked | 正常空履歴や実行なしと推定しない |
| 利用側回帰失敗 | EI単独だけを合格とせず、接続差を確認する |

試験物はRepository内の.crdd/tests配下に自己生成し、各fixtureが終了hookで親境界を確認して今回のRootだけを削除する。削除失敗は試験へ伝播するが、削除後の明示的な不存在観測までは行わない。package直下や任意のOS一時領域へ書込み範囲を拡張しない。
