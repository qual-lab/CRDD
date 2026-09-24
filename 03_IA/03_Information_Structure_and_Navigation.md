# CRDD／CROSの情報のまとまりと導線

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

## 1. 導線の原則

- 最初に現在状態、不足、判断要否、次の行動を示す。
- 重大な停止、回収不明、権限不足を詳細へ隠さない。
- 要約から情報源、改訂版、観測時点へ戻れるようにする。
- 利用不能・非開示の対象を推測表示しない。
- 入口が変わっても、対象、状態、判断、結果の意味を変えない。

## 2. 情報のまとまり

```text
Project
├ Primary
│  ├ 現在状態
│  ├ 判断待ち
│  ├ 重大な不足・競合
│  └ 次の行動
├ Secondary
│  ├ Milestone／Objective／Task
│  ├ Topic／Meeting／Change
│  └ 品質・実行・回復
└ Reference
   ├ Repository／Binding
   ├ Source／Revision／Observed At
   └ Contract／Evidence／履歴
```

Primary、Secondary、Referenceは情報上の優先度であり、画面の位置や大きさを確定しない。

## 3. 入口から根拠、次の行動まで

```text
[N: Repository／MCP／Workbench]
          │
          ▼
[N: 対象を選ぶ]
          │  Project／Repository／Taskを区別
          ▼
[N: 現在状態を理解する]
          │  complete／partial／blocked／unknown等
          ├─ 根拠が必要 ──→ [N: Source／Revision／Evidence]
          ├─ 判断が必要 ──→ [N: Decision／選択肢／影響]
          ├─ 回復が必要 ──→ [N: Effect／残存／Recovery]
          └─ 継続可能 ────→ [N: 次の仕事]
```

具体的なRoute、Sidebar、Tab、ButtonはUIが定める。IAが固定するのは、失ってはならない対象選択と到達関係である。

## 4. 利用場面による入口

| 利用場面 | 既定の入口 | 必要時に進む先 |
|---|---|---|
| Repositoryの日常作業 | Repository内の正本・Tool | 横断情報が必要な場合だけCROS |
| Project全体の判断 | MCP／Workbench | Source、個別Repository、判断対象 |
| 複数Project比較 | Portfolio投影 | 個別Projectの差と根拠 |
| 実行・回復 | Task／Operation結果 | Attempt、Effect、残存、Recovery |
| 実行環境の故障 | 故障した境界 | 影響する能力、継続可能範囲、回復経路 |
| 過去判断の再利用 | 現在有効な意図 | 当時の背景、過去値、置換先、選択理由 |
| 標準保守 | Change／Quality | 対象ファイル、Finding、Evidence、Release |

## 5. IA定義への適用

| IA定義 | 処置 | 固有の優先度・まとまり・見つけ方 |
|---|---|---|
| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 検査対象と適用条件を先に示し、指摘から該当箇所・修正責任・再確認結果へ辿る |
| [IA-000002](Definitions/IA-000002/ia_definition.md) | 適用 | 目的から節目・作業・受入条件へ進み、判断待ちでは決定権限者と選択肢へ辿る |
| [IA-000003](Definitions/IA-000003/ia_definition.md) | 適用 | 依頼から試行・外部作用・結果を追跡し、失敗時は同じ回復義務から処置・終了確認へ進む |
| [IA-000004](Definitions/IA-000004/ia_definition.md) | 適用 | 実行から観測・情報源へ戻り、評価と改善候補を事実から分離して辿る |
| [IA-000005](Definitions/IA-000005/ia_definition.md) | 適用 | 成立済み能力から正式契約・全利用側・置換先・維持根拠へ辿る |
| [IA-000006](Definitions/IA-000006/ia_definition.md) | 適用 | ProjectからBindingでRepositoryへ進み、投影からSource・Revision・Observed At・Coverageへ戻る |
| [IA-000007](Definitions/IA-000007/ia_definition.md) | 適用 | まず手元の情報と作業へ進み、不足時だけ横断情報源へ移り、履歴の詳細はAdapter経由で辿る |
| [IA-000008](Definitions/IA-000008/ia_definition.md) | 適用 | 公開依頼から契約・作用状態・公開結果へ進み、通信手段が変わっても同じ結果根拠へ辿る |
| [IA-000009](Definitions/IA-000009/ia_definition.md) | 適用 | CredentialからSession・Workspace Grantへ進み、WorkspaceとExposureを介して利用可能Repositoryだけへ辿る |
| [IA-000010](Definitions/IA-000010/ia_definition.md) | 適用 | MeetingからMeeting Item・Candidateへ進み、関係するTopicと採否判断へ辿る |
| [IA-000011](Definitions/IA-000011/ia_definition.md) | 適用 | やりたい仕事からCapability・Availabilityへ進み、必要時にDistribution・Manifest・Runtime Bindingへ辿る |
| [IA-000012](Definitions/IA-000012/ia_definition.md) | 適用 | Runtime RootからData Item・Durability・Retentionへ進み、残存時はRecovery Obligation・Cleanup Evidenceへ辿る |
| [IA-000013](Definitions/IA-000013/ia_definition.md) | 適用 | Task RoleからConfiguration・Availabilityを確認し、SelectionとFallback Conditionへ辿る |
| [IA-000014](Definitions/IA-000014/ia_definition.md) | 適用 | TaskからContext Package・Source Reference・Selection Reason・Handoff・Result・Decisionへ往復できるようにする |
| [IA-000015](Definitions/IA-000015/ia_definition.md) | 適用 | DistributionからConformance・Integrity・Publisher・Quality Claimを確認し、Trust Policyによる判断へ進む |
| [IA-000016](Definitions/IA-000016/ia_definition.md) | 適用 | Roadmap ItemからChange・Changed File・Revisionへ進み、Finding・Remediation・Test Layer・Evidence・Quality Stateを同じRevisionで辿る |
| [IA-000017](Definitions/IA-000017/ia_definition.md) | 適用 | Destination・Purpose・ClassificationからConsentとOutbound Packageへ進み、結果はReturned Candidateとして採否へ戻す |
| [IA-000018](Definitions/IA-000018/ia_definition.md) | 適用 | 物語で全体を理解し、構造化詳細と図へ進み、判断と引継ぎ義務へ辿る |
| [IA-000019](Definitions/IA-000019/ia_definition.md) | 適用 | AssetからProvenance・Rights Statement・Allowed Useへ進み、Derivativeから元素材へ戻る |
| [IA-000020](Definitions/IA-000020/ia_definition.md) | 適用 | Runtimeから故障Boundaryへ絞り込み、利用可能CapabilityとRecovery Pathへ進む |
| [IA-000021](Definitions/IA-000021/ia_definition.md) | 適用 | Current IntentからSelection Reasonへ進み、必要時にReasoning Context・Historical Value・置換先へ戻る |
| [IA-000022](Definitions/IA-000022/ia_definition.md) | 適用 | ExecutionからSource・Observation・Record Attempt・Publication Resultへ進み、衝突時はRecovery先へ辿る |

## 補足分析

なし。個別定義の文章を複製せず、関係と横断パターンだけを投影する。

## Checklist

- [x] 全IA Definitionを一件ずつ処置した
- [x] Priority、Grouping、Findabilityを区別した
- [x] 単一の画面やTreeを情報構造として先取りしていない
- [x] 根拠、判断、失敗時の戻り先へ到達できる
- [x] 個別IA Definitionの意味を再定義していない
- [x] 非該当には理由を記録した
- [x] 補足分析へ必須情報を退避していない
