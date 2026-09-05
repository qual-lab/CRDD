# 実行知のアーキテクチャ

状態: v0.20実装候補
担当責任者: Qual-Lab
最終更新日: 2026-09-05

## 1. 目的と責務

実行知（Execution Intelligence）は、CRDDへ明示的に結合した仕事について、実行時に観測できた事実をProject、Milestone、Objective、TaskおよびAttemptへ接続し、改善判断に使える形で保持する。LLM監視製品、会話履歴、推論全文、Project Stateの第二正本または自動最適化機構は作らない。

[進捗管理](../../15_Progress.md#execution-intelligence-observation)がCRDD共通の意味と評価境界を所有する。本書は実行知そのもののEvent、保存、集約、保持、利用側Adapterおよび完成境界を所有する。実装は独立した[公開入口](../../40_Develop/execution-intelligence/src/index.ts)、[共通Eventと集約](../../40_Develop/execution-intelligence/src/core/execution-intelligence.ts)、[Repository-local Store](../../40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts)へ分離する。Coordinatorは[専用Adapter](../../40_Develop/coordinator/src/security/execution-intelligence-adapter.ts)から接続し、共通SchemaへSingle Task Runtime固有の意味を持ち込まない。

```text
Coordinator / MCP / HTTP / 外部AI APIを使う採用Repository
  ↓ 利用側Adapter
Execution Intelligenceの共通Event契約
  ├ 集約
  ├ 非Authority改善候補
  └ Repository-local Store
```

最初のProducerがCoordinatorであることを、実行知の所有権とは扱わない。別Runtimeまたは採用Repositoryは、明示的な仕事Identityと実際に観測したmetadataを同じ公開入口へ渡せる。共通コンポーネントはProvider SDK、Coordinator状態、MCP Protocol、HTTP session、認証方式または外部送信Authorityを所有しない。

## 2. 最小Event

v0.20の最小Eventは、一つのTask Attemptが終了した観測である。

| 区分 | 必須内容 | 境界 |
|---|---|---|
| 仕事Identity | Project、Milestone、Objective、Task、Attempt、Operation | LLM requestを主Identityにしない |
| 発生 | Event ID、種別、観測時刻 | 同じAttempt／OperationのEvent IDは決定論的である |
| 実行 | Role、Provider、Model、入力戦略参照、所要時間、利用量、人間の実作業時間 | 取得不能値を0へ補正しない |
| 結果 | status、reason、Effect、cleanup、手動回復、Process再起動 | Task結果を再解釈しない |
| 品質 | 受入または拒否とEvidence参照 | Task終了時点では非該当とし、実行成功を受入へ昇格しない |

観測値は`observed`、`not_observed`、`not_applicable`のいずれかで表す。`observed`は値とSource、その他は理由を必須とする。未知field、Raw Provider出力、Prompt、Response、Credential、Capabilityおよび内部推論はEvent Schemaへ入れない。

RoleとProviderは特定のCoordinatorまたはProvider名へ固定せず、安定した識別子として検証する。各Adapterは実効値を観測できた場合だけ`observed`を構成する。現行Coordinator Adapterは、Single Task結果から検証済みの実効Executor Providerを取得できる場合だけ記録する。Model、Token、費用および人間時間はまだ返さないため未観測とする。要求されたProviderを実効Providerとして代用しない。入力戦略はProject Runtimeが実際に構成したSingle Task Request契約への参照、時間はAttempt委譲の前後で観測した値だけを記録する。

## 3. 発行と失敗境界

```text
Project RuntimeがTask Attemptを予約
  ↓
Single Task Runtimeへ委譲
  ↓
結果をexact Identityで検証
  ↓
Task Attempt終了Eventを構成
  ↓
Repository-local Storeへ記録
  ↓
Project Stateのsettlementを継続
```

Event発行は非Authorityの観測であり、Task Authority、採用、回復、Project Stateまたは正本変更を生成しない。Event Storeの失敗をTask成功へ見せかけず、同時に測定不能だけを理由に本来のTask結果を失敗へ変更しない。分析側はEvent不存在を実行0件と推定せず、観測対象とStoreの利用可能性を別に確認する。

CRDD採用Repositoryや別Runtimeは公開入口`@qual-lab/crdd-execution-intelligence`へ薄いAdapterを接続できる。AdapterはProvider SDKまたはRuntimeの結果から実際に観測したmetadataだけをEventへ写し、Work Identity、情報分類、同意および外部EffectのAuthorityを自身の境界で確認する。公開入口はProvider SDKを透過監視せず、通常会話やPrompt／Responseを自動収集しない。

## 4. 保存と改変検知

保存先は検証済みRepository Root直下のGit管理外`.crdd/execution/events/`である。Tool配下、親Directory、兄弟Repositoryまたは任意の一時Directoryへ同名Rootを作らない。

Eventは一つずつ不変JSONへ保存する。同じEvent IDと同じbyteの再送は冪等、同じEvent IDと異なる内容はIdentity衝突として拒否する。一時fileを新規作成してrenameし、保存後にexact byteを再読取りする。読み取りはEvent件数10,000件、合計32 MiBを上限とし、未知file、Schema不正、filenameとEvent IDの不一致または破損を黙って除外せず、Store全体を観測不能として停止する。

Event内容の署名、共有Database、複数Process writerの順序保証およびRaw情報保持は現行範囲外である。現在の不変file方式は、同じEvent IDの競合を安全に拒否するが、全Eventのグローバル順序を保証しない。

## 5. 集約、改善候補、正本昇格

集約は実行結果、観測できた所要時間および各指標の観測件数を別々に返す。未観測値を分母へ混ぜず、観測件数0の合計は`null`とする。実行効率、成果物品質、人間受入、運用成果および事業成果を一つのScoreへ畳まない。

改善候補は`proposal`、`authorityConferred: false`、`automaticChangeAllowed: false`を必須とする。現在は非完了Attemptの調査とProvider Identity観測の改善だけを候補化する。Provider順位、Runtime Rule変更、Prompt変更、正本更新または外部Effectは自動発行しない。

Git管理外のEventをCRDD正本へ昇格する場合は、元Eventの集約、判断、比較条件および限界を確認し、通常の変更契約を用いる。Event fileをそのままGitへ移さない。

## 6. 保持と清掃

物理清掃は時刻、Directory名または件数超過だけで自動実行しない。次をすべて満たす要求だけを受け付ける。

- 清掃対象Event IDと保存byteのSHA-256がexactに一致する。
- 対象に未解決参照がない。
- 集約または昇格先を示す耐久Evidence IDがある。
- 削除後に同じexact Pathの不存在を確認する。

一部でも不明なら削除せず停止する。由来不明の既存退避物やExecution Store外の資源を、この清掃契約へ混ぜない。保持期間・件数上限を超えた場合は清掃候補を作れるが、上記条件なしに物理削除しない。

## 7. 検証と完成境界

共通コンポーネントの単体試験は閉Schema、Provider非依存性、欠測、集約および非Authority候補を確認する。同コンポーネントの結合試験はRepository-local保存、再送、Identity衝突、破損およびexact清掃を確認する。Coordinator側の結合試験はProject Runtime結果からAdapterを経た実Event発行を確認する。実Provider、Token／費用取得、人間時間、品質受入、共有Store、Viewer UI、運用成果および事業成果は未接続であり、本変更の完成から推定しない。

v0.20の本変更が成立するのは、共通Event、Git管理外Store、欠測を保持する集約、非Authority改善候補、Project Runtime発行および安全な物理清掃が、決定論的な試験と独立レビューを通過した場合である。
