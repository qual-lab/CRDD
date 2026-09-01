# CRDD内部ツールの情報構造

状態: 既存実装から再構成した設計候補・工程移行未承認
担当責任者: Qual-Lab
最終更新日: 2026-08-31
工程規則: [情報アーキテクチャ](../23_IA.md)

## 1. 対象と結論

[利用体験](../02_UX/01_User_Experience.md)の導入、設定、依頼、待機、結果、復旧を、利用者が扱う対象と導線へ変換する。Runtime内部のクラスやファイル配置を利用者の情報分類にしない。UXは再構成候補であり、承認済みの上流成果物とは扱わない。

## 2. 扱う対象・関係・責任

| 対象 | 利用者にとっての意味・識別 | 関係と所有責任 |
|---|---|---|
| Repositoryと改訂版 | どのProjectの、どの時点を扱うか | 人間が対象を許可しRuntimeが検証。単なる現在Directory名で代用しない |
| 配布物・開発候補 | 何を実行しているか | Source Commit、配布Identity、署名を区別。公式署名は配布担当者のみ |
| 利用境界・認証状態 | 誰のSessionで、どこへ何を送れるか | 人間の同意とProviderの公式認証は別。認証済みでも操作許可とは限らない |
| 依頼と実行 | 何を達成したいか／今回何を実行したか | 呼出し元が目的・範囲を構成、RuntimeがOperationを所有。再試行を同じ結果へ上書きしない |
| 実行者・確認者 | 誰が作業し、誰が独立確認するか | 選定理由と役割を表示。Provider名だけを独立性の証明にしない |
| 候補成果物 | まだ正本へ採用していない結果 | Candidate ID、対象Revision、期限、検証を結合。exportと採用は別 |
| 回復対象 | どの未回収資源を処置するか | Runtimeが発行したexact IDだけを使用。IDなしの不明状態も保持 |
| 検査結果 | どの範囲を何で確認したか | Checkerの指摘・未確認と専門レビューを分離。0件≠全品質合格 |

一つの実行に複数の回復対象があり得る。候補なし、回復IDなし、記録読取り不能を、成功・不存在と同義にしない。機械キーは仕様の表記を維持し、人間向け説明では「候補」「回復」「再起動」を別の意味として扱う。

## 3. 情報の順序と導線

通常利用者の起動案内は[共通起動入口](../19_Workflows/01_Coordinator_Runtime.md#common-launch-entry)の`interactive`へ統一し、自動化担当だけが`automation`を使用する。署名と正式検証は開発・配布担当の導線へ分け、起動用途の選択を追加の実行権限や上位モードと扱わない。

| 場面 | 最初に必要な情報 | 詳細・根拠へ進む先 |
|---|---|---|
| 導入判断 | できること、準備、制限、現在の品質 | [README](../README.md)→[仕様](../05_SPEC/01_Behavior_Specification.md)・[品質状態](../07_Quality/01_Quality_Center.md) |
| 依頼・待機 | 対象、現在の段階、人間入力の要否 | [操作・表示](../04_UI/01_User_Interface.md)→[作業手順](../19_Workflows/01_Coordinator_Runtime.md) |
| 結果 | 完了／停止、候補の有無、次に必要な行動 | 候補ID・期限・検証、回復・再起動の各条件 |
| 復旧 | 通常実行を止める理由、回復対象、操作可能者 | exact ID→対応手順。内部Pathの推測や任意清掃へ誘導しない |
| 保守・配布 | 開発候補か正式配布か、検証範囲と未完了 | [設計](../06_Architecture/01_Architecture.md)、[検証設計](../07_Quality/03_Verification_Design.md)、変更トレース |
| Checker | 対象範囲、エラー・警告・未確認 | [Checker手順](../19_Workflows/02_Checker.md)→指摘位置→所有文書→再検査。全体と限定検査を識別 |
| Windows内部部品の停止 | 利用者への影響、回収・再起動の要否 | Coordinatorの診断／結果／復旧→[内部部品の設計](../06_Architecture/platform-access/01_Architecture.md)。内部protocolを通常操作の入口にしない |

現在結果を主情報、理由・次操作を補助情報、識別子・契約改訂版・履歴を追跡情報として扱う。ただし重大リスクや回復不明を詳細へ隠さない。この優先度は設計意図であり、現行CLIがすべて実現したとは主張しない。

## 4. 共有文脈・時間・設定

依頼から結果・回復まで、Repository、開始Revision、実行対象、選択ユーザー、許可境界を維持する。同じ対象の人間表示とJSONは投影の違いであり、別の成功判定を持たない。

| 意味の範囲 | 含めるもの | 混同しないもの |
|---|---|---|
| 永続する利用境界 | Repository Policy、選択ユーザーに結合した有効な同意 | 個々のTaskを無条件に許可するものではない |
| 一回の実行 | 目的、読取り／変更範囲、改訂版、選定、取消 | 次回実行の許可・進捗へ流用しない |
| 期限付き候補 | Candidate ID、利用期限、処置状態 | 通常の正本ファイルや永続採用済み成果物ではない |
| 履歴 | 固定版の検証結果、過去の判断 | 最新版の利用可否ではない |

通常利用、開発検証、公式署名、復旧は作業モードとして区別する。上位モードほど権限が自動的に強くなる設計ではない。モデル選択や速度・費用方針は既存Policyと仕様が所有し、新しい個人設定や組織継承を本書で追加しない。現在値・実効値・情報源を表示する責務はUI、適用条件・失効・取消はSPECへ渡す。

## 5. 検証義務と未解決事項

- 初見の利用者が導入、通常Task、開発署名、復旧を取り違えずに辿れること。
- 同じ依頼の結果・候補・回復対象を結び付け、別Repositoryや過去Revisionへ操作しないこと。
- 「認証済み／許可済み」「生成済み／確認済み／採用済み」「失敗／回収不明／再起動必要」を区別できること。
- Checkerの限定結果や過去Evidenceを全体・現版の合格へ読み替えないこと。

確認方法は[検証設計](../07_Quality/03_Verification_Design.md#tool-user-experience-verification)へ接続する。対象全体を覆う設計候補を整理し、未取得値・意味説明・候補操作の限定再確認と、今回のPowerShellでの入力・表示確認を終えた。初見利用者の導線理解、別環境、支援技術などの[UI未評価範囲](../04_UI/01_User_Interface.md#open-issues)と専門確認が残るため、工程網羅状態は`Blocked`を維持する。この候補をUI・SPECの照合に使うことを、通常工程移行の承認としない。内容と工程移行の決定権限者はQual-Lab。新しい安定ID、権限、設定継承または業務オブジェクトは採用していない。
## 6. Project Runtimeの情報階層

v0.19のProject Runtimeは、`Project → Milestone／Version → Objective → Task`を基本階層とする。ProjectとRepositoryを同一語にせず、v0.19では一つのProjectが一つの明示Binding済みRepositoryを使用する。MCP要求、実行Operation、Provider SessionおよびCandidateはこの階層の正本ではなく、対象を参照する実行・搬送情報である。

| 対象 | 主な意味 | 主な関係 |
|---|---|---|
| Project | 継続して達成する活動と正本Contextの境界 | 一つのRepository Bindingを持ち、複数Milestoneを順に扱う |
| Milestone／Version | 人間が委ね、受入を判断する到達点 | 複数ObjectiveとMilestone Acceptanceを持つ |
| Objective | Milestoneを成立させる目的単位 | Task GraphとObjective Acceptanceを持つ |
| Task | Single Task Runtimeへ渡せる実行単位 | Dependency、状態、入出力、対象範囲、結果を持つ |
| Project State | 現在の進行・品質・判断を説明する投影 | Milestone、Objective、Task、Blocker、Risk、Decision、Critical Pathを集約する |

Task状態は少なくともReady、Running、Waiting Dependency、Blocked、Completed、Failedを区別する。Taskの完了、Objectiveの受入、Milestoneの受入を同じ状態へ畳み込まない。進捗投影は現在状態から再構成でき、履歴、変更トレース、EvidenceまたはRoadmapを第二の実行状態Storeにしない。

MCPとCLIは同じObjective IntakeとProject State投影へ接続する。入口から渡されたPath、Project名またはTask状態をAuthorityとして採用せず、Repository Binding、Project Identity、現在Revisionおよび許可境界をRuntimeが再確認する。
