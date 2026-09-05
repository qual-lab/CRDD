# CRDD内部ツールの情報構造

状態: Stable（v0.19.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-05
工程規則: [情報アーキテクチャ](../23_IA.md)

## 1. 対象と結論

[利用体験](../02_UX/01_User_Experience.md)の導入、設定、依頼、待機、結果、復旧を、利用者が扱う対象と導線へ変換する。Runtime内部のクラスやファイル配置を利用者の情報分類にしない。§2～§5は既存ツール、§6はv0.19.0で公開したProject Runtimeの情報構造を扱う。

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

本節はv0.19.0で公開したProject Runtimeの情報構造を定義する。任意Projectの一覧・検索や複数Repositoryの横断管理は含まない。

v0.19のProject Runtimeは、`Project → Milestone／Version → Objective → Task`を基本階層とする。ProjectとRepositoryを同一語にせず、v0.19では一つのProjectが一つの明示Binding済みRepositoryを使用する。MCP要求、実行Operation、Provider SessionおよびCandidateはこの階層の正本ではなく、対象を参照する実行・搬送情報である。

[Milestoneを委ねる利用体験](../02_UX/01_User_Experience.md#6-milestoneを委ねる利用体験)の認知意図を成立させるため、最初にMilestoneの成立状況、人間判断の有無、重大なBlocker／Risk、Quality／Integration StateおよびNext Actionを同じ判断文脈で取得可能にする。ObjectiveとTaskの詳細、Dependency、Provider、Operation、CandidateおよびRecoveryは、主表示の根拠へ追跡できる段階的な情報とする。ただし、重大な停止、回収不明、Risk受容または現在必要な人間判断を詳細へ隠さない。

進捗、品質および判断待ちは別の意味である。`Objective 4 / 10`、`Integration Pending`、`Human Decision 1`を同時に表現できる構造とし、一つの割合や色へ畳み込まない。これにより、利用者が「作業量は進んでいるが、Milestoneはまだ受入可能でない」と比較・判断できる根拠を保持する。

| 対象 | 主な意味 | 主な関係 |
|---|---|---|
| Project | 継続して達成する活動と正本Contextの境界 | 一つのRepository Bindingを持ち、複数Milestoneを順に扱う |
| Milestone／Version | 人間が委ね、受入を判断する到達点 | 複数ObjectiveとMilestone Acceptanceを持つ |
| Objective | Milestoneを成立させる目的単位 | Task GraphとObjective Acceptanceを持つ |
| Task | Single Task Runtimeへ渡せる実行単位 | Dependency、状態、入出力、対象範囲、結果を持つ |
| Project State | 現在の進行・品質・判断を説明する投影 | Milestone、Objective、Task、Blocker、Risk、Decision、Critical Pathを集約する |

Task状態は少なくともReady、Running、Waiting Dependency、Blocked、Completed、Failedを区別する。Taskの完了、Objectiveの受入、Milestoneの受入を同じ状態へ畳み込まない。進捗投影は現在状態から再構成でき、履歴、変更トレース、EvidenceまたはRoadmapを第二の実行状態Storeにしない。

同じRepositoryへ複数の起動要求が到着する場合は、実行要求の耐久キュー、実行所有権、隔離Workspace、正本採用権を別の情報として保持する。人間可読なMDを排他の正本にせず、Repository-local `.crdd`の機械可読状態をRuntime所有の実行情報とし、必要な要約だけを人間表示へ投影する。対話起点とスケジュール起点を区別しつつ、優先度だけで既に発行済みのEffectやRecovery義務を奪わない。

MCPとCLIは同じObjective IntakeとProject State投影へ接続する。入口から渡されたPath、Project名またはTask状態をAuthorityとして採用せず、Repository Binding、Project Identity、現在Revisionおよび許可境界をRuntimeが再確認する。

人間判断は、判断理由、影響、選択肢、推奨、保留時の扱いに加え、decision ID、対象Project／Milestone、発行世代・改訂版、現在性を一つの情報単位として持つ。利用者向け表示は機械IDや継続Capabilityを主役にしないが、`crdd.submit_decision`が古い判断、期限切れ、消費済み、別主体または別対象への誤適用を拒否できるよう、表示した判断単位、Client内部のCapability dispositionおよび送信値を追跡可能にする。判断適用は同じdecision application IDとProject State snapshotで関連付け、DecisionとMilestoneを同じProject世代へ一括適用する。Queueは両保存先の照合完了後に別途Leaseするため、Project State適用済み・Queue未Leaseの正当な中間状態を「判断受理済み・安全に再開待ち」として表現できるようにする。Queue未Leaseを実行中として表示せず、内部の部分Recordを相互に矛盾する現在値として並べない。

v0.19の状態再取得は、同じ`crdd.run_objective` request identityに結合したProject Operation内だけで行う。初回開始、冪等再送、切断後再接続を同じ情報単位として扱い、再送時は最新Project State、pending decisionまたは終端結果へ解決する。任意Projectを一覧・検索する`crdd.get_project_state`とは分け、後者はv0.20以降の保留候補とする。
