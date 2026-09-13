# Version Control PortとGit Adapter

変更ID: `CHG-000071`
状態: `Ready for Verification`
決定権限: Qual-Lab
対象版: `v0.21.0`
変更分類: `architecture_refactor`

## 1. 変更の目的

起点Discovery: [EXP-000014](../../../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)／`REQ-000036`

Gitを利用する各Toolから、Git CLI、`.git`内部構造およびCommit前提を分離する。通常作業は未Commitでも成立させ、固定Snapshotが必要な署名、Release、候補生成および履歴参照だけを明示的なRevision契約へ結合する。

## 2. 現在状態と構造変更

| 項目 | 現在 | 変更後 |
|---|---|---|
| Repository Root | Runtime Data、Coordinator、Checkerが別々に観測 | Repository Location PortとGit Adapterへ集約 |
| 変更集合 | CheckerがGitコマンドを直接構成 | Local Change Set Observation Portを利用 |
| 固定Snapshot | Coordinator内のGit Object処理へ直接依存 | Fixed Snapshot／Candidate Portを利用 |
| 署名・Release | ScriptがRepository観測を直接所有 | Fixed Revision Identityを受け取り、Release／SigningがRelease Identityを合成する |
| 通常Operation | Git状態やCommitが成立条件になり得る | dirty／未Commitでも成立し、必要時だけ出所を付加 |
| 物理配置 | Git責務が各Componentへ分散 | `40_Develop/version-control/`をRoot Componentとする |

目標設計とConsumer棚卸しは[Version Control境界](../../../06_Architecture/version-control/01_Architecture.md)を正本とする。

## 3. 変更禁止範囲

- Runtime DataのPath／Lifecycle責務をVersion Controlへ移さない。
- 通常の文書編集、Communication、Topic、Meeting、ProjectionまたはWorkbenchへClean TreeやCommitを要求しない。
- 署名、Release、候補生成および固定履歴が必要とするSnapshot保証を弱めない。
- Git以外の実装を先回りして作らず、Gitへしか適用できない語彙をPortへ漏らさない。
- 試験FixtureのRepository作成まで本番Adapter経由へ強制しない。

## 4. 実装と検証の順序

| 段階 | 完了条件 |
|---|---|
| Architecture | 目的別Port、責務、Consumer集合、移行順、反証を固定する |
| Repository Location | 完了。Runtime DataとCoordinatorのRoot／Layout観測を一本化する |
| Local Change Set | 完了。Checkerと回帰選択を移行し、採用先Checkerは生成済み自己完結Artifactを同梱利用する |
| Snapshot／Candidate | 完了。Object読取りをVersion Controlへ移し、生Pathを廃止したopaque出力Capability、部分生成cleanupおよび候補生成・統合・Policy利用側を新Portへ接続した |
| Fixed Revision／Signing | 完了。固定Snapshotの唯一経路へ移行し、Release Identityの所有をRelease／Signingに保った |
| Consumer Closure | 完了。本番Sourceの旧API、低水準Git内部実装、保護対象Runtimeのbarrel依存、全公開Portの未登録ConsumerおよびOwner試験のTest Catalog未登録を機械的に拒否する |
| Verification | 独立再レビューはCritical／Major／Moderate 0でPass。Owner package試験、利用側回帰、実Git結合を再確認し、固定Commit上の署名契約・正式E2E待ち |

Checker配布では、`40_Develop/version-control/`をCanonical sourceとし、`template/tools/internal/version-control-runtime.ts`へ追加install不要の自己完結Artifactを決定論的に生成する。Source／Artifactのbyte一致、生成漏れおよび`template/tools`単独実行をOwner packageとTemplateの契約試験で確認する。

基準版は`v0.20.1`へ固定する。Root、Layout／Local Ignore、Fixed Object／Object Format、CandidateおよびSigning／Releaseの各Capabilityを過去Evidence、新Port、focused確認、実境界確認および旧実装削除Gateへ対応付ける。全対応は[Version Control境界](../../../06_Architecture/version-control/01_Architecture.md#9-基準版capabilityの移行)を正本とし、成立前に旧実装を削除しない。

## 5. 現在の判断と残るGate

Qual-Labは、`version-control`を`runtime-data`内ではなくRoot Componentとして設計する方針を承認した。Architectureは実装前独立レビューのMajor 3件とModerate 1件を是正し、Git非依存Port、Checker配布、基準Capability移行および用途限定ignore登録まで固定した。

Repository Location段階では、厳密なRepository Layout観測とopaque Root Capabilityを`40_Develop/version-control/`へ移し、Runtime Data、Execution IntelligenceおよびCoordinatorのRoot Consumerを同じ能力発行元へ接続した。旧Root／Layout実装はConsumer移行とfocused回帰の成立後に削除した。

| Repository Locationの確認点 | 結果 |
|---|---|
| Owner package | `40_Develop/version-control/` |
| 受理形態 | 通常Repository、linked worktree、submodule worktree |
| 拒否境界 | 任意Directory、偽装`.git`、不正な内側境界、link経由、失効したCapability |
| 並行性 | Repository-local Runtime Dataの作成でRepository Identityを失効させない |
| Runtime Data | 34件Pass |
| Execution Intelligence | 41件Pass。並行Processと3つのRepository形態を含む |
| Coordinator focused回帰 | 36件Pass |
| Coordinator静的確認 | Capability Graph、Traceability、型、Lint、Format Pass |

Repository Locationは独立レビューでCritical／Major／Moderate 0の`Pass`となった。Local Change SetはOwner PortとGit Adapterを実装し、回帰選択を新Portへ移した。実RepositoryでRevision差、準備済み差分、作業中差分、未登録Pathを分離し、一部観測失敗を部分成功として公開しない反証が成立している。

Checker本体のRepository観測と自己完結した配布Artifact、Fixed Snapshot／Candidate、Fixed Revision／Signing、Repository-local Ignore、Doctor公開投影および最終Consumer Closureまで実装した。初回独立レビューでは、回帰登録漏れ、生Pathの候補出力、Ignore更新後の観測不能、Doctor report版、Location／Ignore Consumer閉包を一つの契約伝播不足として検出した。

| 初回レビュー指摘 | 構造是正 | 確認 |
|---|---|---|
| Version Controlの2試験が回帰から脱落 | Test Catalogへ全5 Owner試験を登録し、runnerのOwner集合と`--all`へVersion Controlを追加 | Test Catalog／runner 35件Pass |
| Candidate出力が生Path | 空で安定したDirectoryにだけ発行するopaque Capabilityへ変更し、部分生成を不存在までcleanup | Owner結合とCoordinator候補・Workspace回帰Pass |
| Ignoreの結果がEffect状態を失う | 成功／blockedの判別可能結果、前後内容Identity、Effect確認、cleanup、再試行可否を公開 | 7失敗段階、競合Writer、通常／linked worktreeを含む試験Pass |
| Doctor shapeだけ変更 | `reportVersion: 12`へ更新し、新field存在・旧field不存在を固定 | Doctor focused回帰Pass |
| Consumer閉包が一部Portだけ | Repository LocationとRepository-local Ignoreの実Source由来Consumer集合を追加 | Owner consumer closure Pass |

初回是正後の独立再レビューは、Catalog／runner、Doctor、Location／Ignore Consumer集合を解消済みと判定した。一方、CandidateとIgnoreがPortで保持した失敗意味を利用側が単純な失敗へ畳む問題と、静的lock配置だけで実Process競合を証明していない問題を検出した。

| 再レビュー指摘 | 構造是正 | 確認 |
|---|---|---|
| Candidateの所有境界と失敗意味が利用側で失われる | 出力Capabilityを呼出元の所有Capability・所有Directoryへ結合し、Owner不一致と境界外を拒否。Workspace／Release利用側でreason、Effect、cleanup、Recovery参照を保持 | Version Control 38件Pass。Coordinator型確認Pass |
| IgnoreのEffect不明がRuntime Dataで`null`になる | Runtime Data入口を`ready`／`blocked`へ分け、Effect、cleanup、再試行可否、exact Recovery参照を伝播 | Runtime Data 35件Pass |
| 並行Writerが静的lock試験だけ | 同じ旧内容を観測した二つの実Processを同時発火し、一方の拒否、再入場、最終内容、lock不存在を確認 | 実Process競合試験Pass |

第二次是正後はVersion Control Owner試験38件、Runtime Data試験35件、CoordinatorとExecution Intelligenceの型確認がPassした。Test Catalog／runner試験と全体Checkerは、文書更新後の固定候補入力として再実行する。

第二次是正後の再レビューでは、Port直下の処置は解消した一方、Runtime Data AreaとCandidate Integrationの上位Consumerが構造化停止結果を汎用Errorまたは`null`へ畳む問題を検出した。これに対し、Runtime Data共通の構造化Errorと`ready`要求helperを導入し、Release準備とCandidate Integrationを含む既知Consumerを同じ変換規則へ統一した。

その後の最終再レビューでは、helper後のcatchで意味を再び失う経路と、実体へ解決できないCandidate用Recovery参照を検出した。これは同じ「最終利用境界までの契約伝播」不足として一括是正した。

| 最終再レビュー指摘 | 構造是正 | 確認 |
|---|---|---|
| Runtime Dataのblocked意味が最終catchで失われる | Development Measurement、Verification Result、Execution IntelligenceおよびProject Runtime公開入口で`reason`、Effect、cleanup、再試行可否、Recovery参照を最終結果まで写像 | Execution Intelligence 42件Pass。公開Project Runtime投影の値一致試験Pass |
| CandidateのRecovery参照が実体へ解決できない | 耐久Recordを持たない擬似IDを廃止し、cleanup不明は`manualRecoveryRequired=true`かつRecovery IDなしで表現。生成・観測・採用後のcleanupを判別可能なblocked結果へ統一 | Candidate結合試験Pass。cleanup失敗時のID非生成を確認 |

最終縦断確認では、Effectとcleanupを分離した後も旧相関式を残す利用側を検出した。新しい保証を追加せず、同じ境界結果をRead／Write、直接MCPおよび判断付きMCPへ全数伝播した。

| 最終縦断の残件 | 構造是正 | 確認 |
|---|---|---|
| 実行知がcleanup済みのEffect不明を手動回復不要へ変換 | Effect不明、cleanup未確認またはRecovery参照ありを同じ手動回復条件とし、Read／Write双方でRuntime Data Errorを写像 | 実行知43件Pass。cleanup true／falseの故障注入でfield一致と保存先未作成を確認 |
| Project Runtime InspectorがEffect不明・cleanup済みの拡張結果を拒否 | 基本形と境界拡張形のDecision Tableを分離し、Effect不明時の手動回復・再試行禁止・Recovery参照条件を固定 | Project Runtime 60件、MCP 32件Pass。直接／判断付きの同一結果を確認 |
| Candidate採用済み後のcleanup失敗をEffect不明と表示 | Repository採用の成立と一時Workspace cleanupを別fieldで表現し、観測時と採用後のcleanup失敗を分離 | Candidate結合試験で`effectIssued=true`、`effectStateUnknown=false`、cleanup未確認を確認 |
| Candidate適用途中のrollback成功／不明を同じ`false`へ縮退 | Candidate適用を構造化結果へ変更し、先行Effect、rollback、Transaction cleanupを別々に保持 | 2 Path目失敗後のrollback成功は`null`、rollback失敗はEffect不明・cleanup未確認として固定 |

Consumer Closure試験は、利用箇所の全数一致に加えて、各ConsumerがEffect・cleanup・Recoveryを保持する明示変換か、構造化ErrorをProject Runtime公開境界まで伝播する接続を検査する。単なるhelper名の存在を意味保持の根拠にしない。

署名契約試験のうち、固定公開鍵不一致の最終1件は`git archive HEAD`から作る固定候補が未Commitの新Componentを含まないため、現在の作業Treeでは意図どおり固定Snapshot観測前に停止する。試験期待値は変更せず、独立レビュー後に変更をCommitして同じ試験を再実行する。最終署名と正式E2Eは、その固定Commitで一度だけ実施する。

最終独立再レビューは、Candidate rollbackの構造化是正を含む固定候補についてCritical／Major／Moderate 0の`Pass`と判定した。残る作業は、CommitでSnapshotを固定し、署名契約と正式E2Eにより公開経路の同一性を確認することだけである。

固定Commit `5d56eced`の署名候補作成は成功したが、一時PowerShellへ秘密鍵Pathと署名引数を都度埋める手順では、launcher配置ミスによって署名前に端末が終了した。署名契約の不成立ではなく再現可能な操作入口の不足として扱い、Git管理外`.env-crdd`から`CRDD_RELEASE_PRIVATE_KEY_PATH`だけを解決できるようにした。鍵参照、秘密入力および暗号署名はCHG-000072で共通の成果物署名Componentへ分離し、CoordinatorはRuntime Manifestの構築とRelease固有の配置だけを所有する。`.env-crdd`へ秘密鍵内容またはpassphraseを保存せず、明示`--private-key`入口も維持する。Pathの欠落、重複、相対指定、非通常fileまたはsymbolic linkはpassphrase入力前に拒否する。
