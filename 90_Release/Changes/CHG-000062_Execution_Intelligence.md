# 変更トレース: 実行知の最小基盤

変更ID: `CHG-000062`
状態: `Ready for Verification`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `feature`
最終更新日: 2026-09-05

## 1. 結論と現在状態

CRDDへ明示的に結合したAI実行を、Project／Milestone／Objective／Task／Attemptの仕事Identityで観測する、Coordinatorから独立した共通基盤を実装した。閉じたmetadata Event、Repository-localでGit管理外の不変Store、欠測を保持する集約、非Authorityの改善候補、Project Runtimeからの実Event発行、およびexact Identityに基づく物理清掃を一つの変更として扱う。

現在は決定論的な単体・結合試験を実装済みであり、Single Task Runtimeが返す検証済み実効Executor ProviderもEventへ接続した。独立レビューで露出した入口・観測、永続化、利用側伝播の暗黙依存は、exact Task Identity、検証済みRepository Root能力、Process間排他、不変公開、故障段階別結果、および利用側回帰の逆向き登録として一体で是正した。再レビューで残った実運用配線は、package-local toolchain、本番の非Authority発行診断、および試験levelから独立した利用側静的検査として閉じた。Model、実Providerの利用量、人間の実作業時間、品質受入、Viewer UI、共有Store、運用成果および事業成果は未接続であり、本変更の成立から完成を推定しない。

## 2. 人間が決定した範囲

- 実行知をv0.20の最初の実装項目とする。
- LLM requestではなく仕事Identityを主Identityにする。
- 取得不能値を0へ補正しない。
- 高頻度EventはGit管理外`.crdd/execution/`へ保存し、正本昇格と分ける。
- 改善候補は人間判断前の非Authorityな提案とし、自動自己変更を行わない。
- Raw Prompt／Response、内部推論全文、秘密情報および通常会話を既定収集しない。
- 物理清掃は時間や名前だけで行わず、exact Identity、Hash、未解決参照0および耐久Evidenceを要求する。

## 3. 目指さないこと

- 巨大Dashboard、全Provider監視または109項目の一括Schema。
- 実行成功から品質、人間受入、運用成果または事業成果を推定すること。
- Providerの単純順位づけ、Prompt自動変更またはRuntime Ruleの自己変更。
- 実Provider、署名、外部送信、性能試験または長時間試験の発火。
- Execution StoreをProject State、進捗または変更履歴の第二正本にすること。
- 最初のProducerであるCoordinatorへ共通Event、保存または分析の所有権を持たせること。

## 4. 実装と責務

- [進捗管理](../../15_Progress.md#execution-intelligence-observation): CRDD共通の観測、評価、昇格および清掃境界。
- [実行知のアーキテクチャ](../../06_Architecture/execution-intelligence/01_Architecture.md): 共通Event、Store、集約、利用側Adapter、改善候補、保持および完成境界。
- [共通Eventと集約](../../40_Develop/execution-intelligence/src/core/execution-intelligence.ts): Provider／Runtime非依存の閉Schema、欠測表現、集約、非Authority改善候補。
- [公開入口](../../40_Develop/execution-intelligence/src/index.ts): CRDD採用Repositoryや各Runtimeの薄いAdapterが利用するexport。
- [Execution Store](../../40_Develop/execution-intelligence/src/store/execution-intelligence-store.ts): Repository-local不変保存、改変検知、bounded読取り、exact清掃。
- [Repository Root検証](../../40_Develop/execution-intelligence/src/store/verified-repository-root.ts): exact worktree RootだけからStoreの実行時能力を発行し、任意Path、linkまたは構造的な偽造を拒否する。
- [Coordinator Adapter](../../40_Develop/coordinator/src/security/execution-intelligence-adapter.ts): Single Task Runtime固有結果を共通Eventへ変換する唯一の接続部。
- [Project実行](../../40_Develop/coordinator/src/security/project-runtime-execution.ts): Task Attempt終了Eventの発行。
- [公開Runtime構成](../../40_Develop/coordinator/src/security/project-runtime-public-runtime.ts): 検証済みRepository RootのStoreへの接続。

## 5. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | Project RuntimeでTaskが完了しEventを初回保存 | exact仕事Identityと観測値を保存し集約できる |
| 準正常 | Provider、利用量、人間時間または品質が未観測 | 理由付き未観測／非該当として保持し、0へ補正しない |
| 準正常 | 同じEventを同じbyteで再送 | 二重保存せず冪等に完了する |
| 異常 | 同じEvent IDで内容が異なる | Identity衝突として拒否する |
| 異常 | Event破損、未知field、件数・容量上限超過 | 一部だけを黙って採用せずStore観測を停止する |
| 異常 | 未解決参照またはHash不一致の清掃 | 対象を削除せず停止する |
| 異常 | Task結果のIdentity fieldが一つでも不一致 | 結果値を転記せず、観測不能として閉じる |
| 異常 | 並行Writerが同じIdentityへ異内容を発行 | 既存内容を置換せずIdentity衝突として拒否する |
| 異常 | 永続化または清掃の途中失敗 | Effect、cleanup、残存Artifact、削除済み／未削除／観測不能を分けて返す |

## 6. 検証と現在の根拠

[検証設計](../../07_Quality/03_Verification_Design.md#execution-intelligence-verification)の`EI-UT-*`、`EI-IT-*`、`EI-RT-*`を自動回帰へ登録した。共通コンポーネントの単体試験は閉Schema、Provider非依存性、欠測、集約、非Authority候補および不正memberを確認する。共通Storeの結合試験はexact Root、worktree／submodule、link拒否、不変保存、Process間並行、冪等再送、Identity衝突、故障注入、残存Lockおよび部分清掃を確認する。Coordinator結合試験はexact Task Identity、本番公開Runtimeの発行診断および診断失敗時のTask不変を含む専用AdapterからのProject Runtime発行を確認する。試験台帳は実行知の変更から登録済みCoordinator利用側契約と利用側静的検査を逆向きに選択し、level限定時も静的検査を維持する。実行知の静的検査は自身の固定package依存だけを使用する。

本変更はCoordinator Runtime Execution Identityを構成するSourceを変更するため、将来の正式Release Candidateでは再署名と影響するRuntime検証を要する。開発中の固定候補確認では、外部Provider、署名および人間入力を発火しない。

## 7. 残る未評価範囲

- Single Task RuntimeからModel、Token、費用を安全に取得する契約。実効Executor Providerは接続済みである。
- 人間の実作業時間を監視化せず観測する方法。
- 検証・受入Eventと成果物品質の接続。
- 最小Viewer、Project State投影、共有またはRemote Store。
- 運用成果・事業成果の適用先別接続。

これらは未観測を隠さず、独立した価値・情報境界・利用側が成立した変更で段階的に接続する。
