# Product Discovery

状態: Active
維持責任者: Qual-Lab
判断する人: Qual-Lab

本書は、CRDD標準自身の個別探索を一覧し、現在採用している判断をUXへ渡すための入口である。CRDDの方法論、実装史、版計画、設計詳細は説明しない。それぞれの所有文書を参照する。

```text
個別の課題と仮説
    ↓
Explorations
    ↓ 人間が採用
REQ-* と検証義務
    ↓
UXへ引き渡す
```

`EXP-*`は課題と仮説の来歴を識別する。`REQ-*`はDiscoveryで人間が採用した要求を識別する。過去のCapabilityに付けた本書の`EXP-*`と`REQ-*`は、2026-09-13のDiscovery再編で既存CHG、Evidence、公開記録および実装から再構成・採番したものであり、当時から同じIDが存在したとは扱わない。UXは要求を利用者成果と体験へ具体化するが、新しい`REQ-*`を独自に発行しない。UXで新しい必要性が見つかった場合はDiscoveryへ戻す。

<a id="current-discovery-map"></a>

## 探索台帳

| 探索 | 出発点となった問題 | Discovery判断 |
|---|---|---|
| [EXP-000001 機械で見つけられる不備を先に落とす](Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md) | 繰り返し可能な構造確認と、人にしかできない判断が分かれていなかった | 要求採用 |
| [EXP-000002 複数AIの実行責任を失わない](Explorations/EXP-000002_Coordinated_AI_Execution/exploration.md) | AIへの委譲で範囲、権限、結果、清掃、回復の所有者がいなかった | 要求採用 |
| [EXP-000003 Projectの仕事として進める](Explorations/EXP-000003_Project_Runtime/exploration.md) | Task成功とObjective／Milestone達成を結ぶLifecycleがなかった | 要求採用 |
| [EXP-000004 実行を次の改善へつなぐ](Explorations/EXP-000004_Execution_Intelligence/exploration.md) | 実行経路の時間、結果、利用量を共通に比較できなかった | 要求採用 |
| [EXP-000005 Coordinatorへ集まりすぎた責務を分ける](Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md) | Project、Transport、観測、OS境界の所有者が曖昧だった | 要求採用 |
| [EXP-000006 同じRuntimeを複数入口から使う](Explorations/EXP-000006_Local_MCP_HTTP_Access/exploration.md) | TransportごとにProjectの意味が分かれ得た | 要求採用 |
| [EXP-000015 `.crdd`に残ったものの意味を迷わない](Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md) | Owner、保持、清掃、回復がPathと結び付いていなかった | 要求採用 |
| [EXP-000019 判断と監査を収束させる](Explorations/EXP-000019_Audit_and_Decision_Convergence/exploration.md) | 監査、修正、再監査と人間判断が同じ問題を小刻みに往復した | 要求採用 |
| [EXP-000020 外部Contextを勝手に昇格させない](Explorations/EXP-000020_External_Context_Boundaries/exploration.md) | 外部送信、外部情報、公開反応、依存更新の権限と事実が混ざった | 要求採用 |
| [EXP-000021 AI入口を別々の標準にしない](Explorations/EXP-000021_Agent_Guidance_Ownership/exploration.md) | AI別指示の複製で正本と行動が分岐した | 要求採用 |
| [EXP-000022 判断理由を外在化する](Explorations/EXP-000022_Reasoning_Context/exploration.md) | 成果物だけでは捨てた案、制約、仮説の現行性を辿れなかった | 要求採用 |
| [EXP-000023 最終E2Eまで実境界不具合を残さない](Explorations/EXP-000023_Assurance_and_Regression/exploration.md) | 検証量は多いのに実境界の失敗発見と切り分けが遅かった | 要求採用 |
| [EXP-000024 人が理解できる文書へ戻す](Explorations/EXP-000024_Human_Readable_Documentation/exploration.md) | Checklist準拠が読者の理解順より前に出た | 要求採用 |
| [EXP-000025 図で意図を引き渡す](Explorations/EXP-000025_Diagram_Guided_Handoff/exploration.md) | 状態、境界、分岐、試験義務が後工程まで見えなかった | 要求採用 |
| [EXP-000026 WorkとEvidenceのOwnerを分ける](Explorations/EXP-000026_Work_and_Evidence_Ownership/exploration.md) | 公開状態の伝播漏れとEvidence配置の分散が起きた | 要求採用 |
| [EXP-000027 導入したCommitのToolをその場で使う](Explorations/EXP-000027_Repository_Distributed_Tooling/exploration.md) | submoduleと別配布Runtimeの版合わせが利用者責任になった | 要求採用 |
| [EXP-000028 公式Identityを視覚的に見分ける](Explorations/EXP-000028_Recognizable_Official_Identity/exploration.md) | 公式入口を識別する素材と権利・保証境界がなかった | 要求採用 |
| [EXP-000007 Projectの現在地を毎回組み立て直さない](Explorations/EXP-000007_Project_State_Understanding/exploration.md) | 状態、品質、判断、根拠を毎回探してまとめ直している | 要求採用 |
| [EXP-000008 単一Repositoryの作業を守る](Explorations/EXP-000008_Repository_Local_Work/exploration.md) | 横断機能が普段の開発まで複雑にし得る | 要求採用 |
| [EXP-000009 複数Repositoryを一つのProjectとして見る](Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md) | ProjectとRepositoryを同一視すると分離と欠測を扱えない | 要求採用 |
| [EXP-000010 人とAIの入口を同じ仕事へつなぐ](Explorations/EXP-000010_Human_and_AI_Entry_Points/exploration.md) | 入口ごとに意味と更新処理が分かれ得る | 要求採用 |
| [EXP-000011 別HostからProject Contextへ届く](Explorations/EXP-000011_Remote_Project_Context/exploration.md) | Remote接続だけでは利用範囲と再取得を守れない | 要求採用 |
| [EXP-000012 会議後も論点を置き去りにしない](Explorations/EXP-000012_Topic_and_Meeting_Continuity/exploration.md) | Meeting、継続Topic、正式判断が混ざる | 要求採用 |
| [EXP-000013 複数Projectを根拠付きで見比べる](Explorations/EXP-000013_Portfolio_Visibility/exploration.md) | 要約で欠測、制限、根拠を失い得る | 要求採用 |
| [EXP-000014 RepositoryのTool能力を推測させない](Explorations/EXP-000014_Repository_Capability_Discovery/exploration.md) | Toolの存在、公開、利用可能性、実行許可が混ざる | 要求採用 |
| [EXP-000016 AIモデル更新でCoreを書き換えない](Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md) | モデル情報とAdapter／CoreのLifecycleが結合している | 要求採用 |
| [EXP-000017 Projectを越えてContextを受け渡す](Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md) | 横断時に出所、許可、結果の帰り先を失い得る | 要求採用 |
| [EXP-000018 公式署名と利用者のTrust判断を分ける](Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md) | 公式配布の証明と、forkを信頼する判断が混ざる | 要求採用 |

本台帳は探索の版別Scopeや実装順を分類しない。まだ探索を始めない長期候補は[Product候補登録](02_Product_Candidates.md)、版と作業状態は[Roadmap](../99_Roadmap/01_Roadmap.md)が所有する。

<a id="requirement-register"></a>

## 要求台帳

要求本文は各探索記録が所有する。本表は、採用済み要求の状態と受信先を一箇所から確認するための台帳であり、要求を再定義しない。

| 要求 | 要約 | 探索元 | Discovery判断 | 主な受信先 |
|---|---|---|---|---|
| `REQ-000001` | 決定論的なRepository事前確認 | [EXP-000001](Explorations/EXP-000001_Deterministic_Repository_Checks/exploration.md) | 要求採用 | Quality、Maintenance |
| `REQ-000002` | 複数AI実行の範囲・権限・回復 | [EXP-000002](Explorations/EXP-000002_Coordinated_AI_Execution/exploration.md) | 要求採用 | Architecture、Development |
| `REQ-000003` | Objectiveから統合までのProject Lifecycle | [EXP-000003](Explorations/EXP-000003_Project_Runtime/exploration.md) | 要求採用 | UX、Architecture |
| `REQ-000004` | 実行事実の再利用可能な記録 | [EXP-000004](Explorations/EXP-000004_Execution_Intelligence/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000005` | Runtime責務と依存方向の分離 | [EXP-000005](Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md) | 要求採用 | Architecture、Development |
| `REQ-000006` | Local MCP Transport間の意味統一 | [EXP-000006](Explorations/EXP-000006_Local_MCP_HTTP_Access/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000007` | 出典と不完全性を保つProject View | [EXP-000007](Explorations/EXP-000007_Project_State_Understanding/exploration.md) | 要求採用 | UX、IA、Verification |
| `REQ-000008` | CROSなしで成立するRepository作業 | [EXP-000008](Explorations/EXP-000008_Repository_Local_Work/exploration.md) | 要求採用 | UX、Architecture、RT |
| `REQ-000009` | Project・Repository・Root Identity分離 | [EXP-000009](Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md) | 要求採用 | UX、IA、Architecture |
| `REQ-000010` | Workbench・MCP・CLIの公開契約共有 | [EXP-000010](Explorations/EXP-000010_Human_and_AI_Entry_Points/exploration.md) | 要求採用 | UX、UI／SPEC、Architecture |
| `REQ-000011` | Remote接続のWorkspace限定 | [EXP-000011](Explorations/EXP-000011_Remote_Project_Context/exploration.md) | 要求採用 | UX、Threat、SPEC、Architecture |
| `REQ-000012` | Meetingから候補を経た正本更新 | [EXP-000012](Explorations/EXP-000012_Topic_and_Meeting_Continuity/exploration.md) | 要求採用 | UX、IA、Communication |
| `REQ-000013` | 根拠と不完全性を保つPortfolio | [EXP-000013](Explorations/EXP-000013_Portfolio_Visibility/exploration.md) | 要求採用 | UX、IA、Verification |
| `REQ-000014` | Repository Tool能力の明示Registry | [EXP-000014](Explorations/EXP-000014_Repository_Capability_Discovery/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000015` | Runtime Data Rootの所有と用途 | [EXP-000015](Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md) | 要求採用 | Architecture、Maintenance |
| `REQ-000016` | AIモデルProfileの検証可能な外部構成 | [EXP-000016](Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000017` | 出所付きContext Packageの解決 | [EXP-000017](Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md) | 要求採用 | UX、IA、Architecture |
| `REQ-000018` | Runtime Trust要素の分離 | [EXP-000018](Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000019` | 契約移行時のConsumer閉包 | [EXP-000005](Explorations/EXP-000005_Runtime_Responsibility_Separation/exploration.md) | 要求採用 | Maintenance、Architecture、Verification |
| `REQ-000020` | 欠測・競合を保つRepository Federation | [EXP-000009](Explorations/EXP-000009_Cross_Repository_Project_Context/exploration.md) | 要求採用 | UX、IA、Architecture |
| `REQ-000021` | Remote要求結果の同一Identity再取得 | [EXP-000011](Explorations/EXP-000011_Remote_Project_Context/exploration.md) | 要求採用 | UX、SPEC、Architecture、Verification |
| `REQ-000022` | Runtime Dataの保持・清掃・回復 | [EXP-000015](Explorations/EXP-000015_Runtime_Data_Ownership/exploration.md) | 要求採用 | Architecture、Maintenance、Verification |
| `REQ-000023` | 異なるAI Runtime LifecycleのAdapter分離 | [EXP-000016](Explorations/EXP-000016_AI_Runtime_Changeability/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000024` | 境界を越えるTask結果の帰還 | [EXP-000017](Explorations/EXP-000017_Cross_Project_Context_Exchange/exploration.md) | 要求採用 | UX、SPEC、Architecture |
| `REQ-000025` | Deployment Ownerが所有するTrust Policy | [EXP-000018](Explorations/EXP-000018_User_Owned_Runtime_Trust/exploration.md) | 要求採用 | Architecture、Verification |
| `REQ-000026` | 判断・監査・是正の収束可能な閉包 | [EXP-000019](Explorations/EXP-000019_Audit_and_Decision_Convergence/exploration.md) | 要求採用 | Agent、Maintenance、Audit |
| `REQ-000027` | 外部Contextの送信・昇格境界 | [EXP-000020](Explorations/EXP-000020_External_Context_Boundaries/exploration.md) | 要求採用 | Principles、Communication、Dependency |
| `REQ-000028` | AI入口と共通正本の分離 | [EXP-000021](Explorations/EXP-000021_Agent_Guidance_Ownership/exploration.md) | 要求採用 | Agent、Documentation |
| `REQ-000029` | 推論Contextの履歴・現行性・選択 | [EXP-000022](Explorations/EXP-000022_Reasoning_Context/exploration.md) | 要求採用 | Discovery、全工程、AI Context |
| `REQ-000030` | 段階的実境界試験と回帰選択 | [EXP-000023](Explorations/EXP-000023_Assurance_and_Regression/exploration.md) | 要求採用 | Verification、Quality、Architecture |
| `REQ-000031` | 人の理解順と構造を両立する成果物 | [EXP-000024](Explorations/EXP-000024_Human_Readable_Documentation/exploration.md) | 要求採用 | Documentation、全工程 |
| `REQ-000032` | 工程固有の基本図と意図引き渡し | [EXP-000025](Explorations/EXP-000025_Diagram_Guided_Handoff/exploration.md) | 要求採用 | 全工程、Checker、Verification |
| `REQ-000033` | Work LifecycleとEvidence所有の分離 | [EXP-000026](Explorations/EXP-000026_Work_and_Evidence_Ownership/exploration.md) | 要求採用 | Roadmap、Change、Release、Quality |
| `REQ-000034` | Repository固定Commitから使える標準Tool | [EXP-000027](Explorations/EXP-000027_Repository_Distributed_Tooling/exploration.md) | 要求採用 | Tool、Template、Release |
| `REQ-000035` | 公式視覚素材の権利・用途・追跡 | [EXP-000028](Explorations/EXP-000028_Recognizable_Official_Identity/exploration.md) | 要求採用 | Communication、Release |

<a id="current-discovery-relations"></a>

## 探索同士の関係

個別探索を一つの完成SystemへまとめるのはUX以降の責務である。Discoveryでは、どの問題が同じ利用体験へ合流しそうかだけを示す。

```text
Projectの現在地 ───────────────┐
単一Repository作業 ────────────┤
複数RepositoryのProject ───────┤
Topic・Meetingの継続 ──────────┼→ Projectを理解して次の仕事へ進む体験
Portfolioでの比較 ─────────────┤
人とAIの共通入口 ──────────────┘

Remote Context ───────┐
Project間の受け渡し ─┼→ CROSを介して安全に届く体験
利用者所有Trust ─────┘

Tool能力の発見 ──────┐
AI Runtimeの変更 ────┼→ 変化しても入口と実行契約を保つ体験
Runtime Dataの所有 ──┘
```

この関係はUXへ渡す仮説であり、Component構成やService Blueprintの正本ではない。

<a id="current-discovery-decisions"></a>

## UXへ渡す現在の判断

| UXで扱うこと | Discoveryから渡す条件 | まだ証明できていないこと |
|---|---|---|
| Repository内の普段の作業 | CROSやWorkbenchを使わなくても成立する | 横断機能追加後も負担が増えないか |
| Projectの現在地確認 | 出典、観測時点、欠測、制限、競合を失わない | WorkbenchがAIや静的Reportより役立つか |
| 複数RepositoryのProject | Repository分割を普段は意識させず、不足は隠さない | 代表構成以外でも理解できるか |
| TopicとMeeting | Candidate、確認、採用、正本更新を区別する | 実Meetingで転記漏れと確認負担が減るか |
| Portfolio | 読取り専用とし、根拠Projectへ戻れる | PM／Managementに必要な情報が足りるか |
| 人とAIの入口 | Workbench、MCP、CLIは同じ公開契約を使う | 各入口で同じ意味と結果になるか |
| Remote利用 | 認証、Workspace範囲、部分取得、応答喪失後の再取得を扱う | 実Networkと長期Sessionで成立するか |

個別探索で採用した要求と検証義務は、UXで都合よく統合、弱化、追加しない。新しい課題や必要性が分かった場合は、該当する探索へ戻すか、新しい`EXP-*`を発行してDiscoveryで判断する。

<a id="ux-handoff"></a>

## UXへの入口と戻り方

### UXへ進める条件

- 対象の`EXP-*`で、本当の問題、置いた仮説、守る条件、未確認事項が読める。
- 人間が採用した内容だけが`REQ-*`または現在の判断として区別されている。
- 複数の探索を統合する場合、どの条件を引き継いだかを示せる。
- 成果を判断するための検証義務が残っている。

### Discoveryへ戻す条件

- UXで、前提にしていた利用者や問題が違うと分かった。
- 複数の探索を統合すると、守る条件が競合した。
- 新しい必要性を`REQ-*`として採用する必要がある。
- 解決仮説を縮小または棄却する根拠が得られた。

UXは、ここで渡した課題と仮説を利用者の仕事として深掘りし、最終的にService Blueprintで一つの体験へ接続する。Discoveryはその完成形を先回りして定義しない。
