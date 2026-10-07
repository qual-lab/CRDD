# 境界／Interfaceモデル

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-07

## 1. この成果物が所有すること

Component間、外部System、Platform、Repository、Trust境界と、境界を越えるIdentity、State、Authority、Dataの意味を統合する。物理API名やfieldは実装・Schemaが所有し、本書は交換契約と越えてはならない意味境界を所有する。

## 2. 境界表

| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |
|---|---|---|---|---|---|
| Public Transport | Human／Agent／Client | Public Application Contract | 検証済み入力、相関Identity、構造化結果 | Transport固有のAuthority、内部Path | Effect前に拒否 |
| Workspace Exposure | 接続Session | Federation Resolver | Session Grant、Workspace、許可Source | 未許可Repositoryの存在・内容 | unavailable／restrictedを区別 |
| Project Execution | Application Contract | Project Runtime | Objective、Task操作、Human Input、取消 | Provider選択、OS操作 | 同じTaskを保持して停止 |
| Project Projection | 許可されたProject Source | Project Management Projection Port | Source、Currentness、Coverage、状態 | 正本変更Authority、受入判断Authority | unknown／partialのまま返す |
| Acceptance Decision | Project運営者の明示判断 | Objective／Milestone Acceptance Decision Port | 対象Identity、受入／差戻し／判断待ち | Task作成、Provider Effect、下位完了からの上位受入推定 | Effect 0で判断待ちを保持 |
| Execution Port | Project Runtime | 実行編成Adapter | exact Task、Capability、取消要求、結果 | Project状態の所有権 | Effect不明ならRecovery |
| Repository Binding | Runtime／Tool | Version Control Port | 開始Path、検証済みRoot、Repository Identity | commit必須性、別Root Authority | Effect 0 |
| Runtime Data | 各Runtime Component | Runtime Data Contract | Owner、用途、耐久性、Retention、Cleanup条件 | 任意Path、由来不明削除 | 保持して人間判断 |
| External Information | 内部候補 | 外部Provider／外部結果 | 許可済み最小情報、Request Identity、未信頼結果 | Secret、採用Authority | 送信0／候補隔離 |
| Platform | Port | OS／Process／Container／Filesystem | 必要Capability、要求、観測、終了結果 | handle取得だけの成功主張 | unknownで停止 |
| Trust／Rights | Artifact／素材候補 | Evaluator／決定権限者 | 出所、Hash、Publisher、用途、確認 | 利用者判断の自動代替 | 未承認 |

## 3. 型とPortの関係

```text
┌─ Transport Input ──────────────────────┐
│ encoded request / connection context   │
└──────────────────┬─────────────────────┘
                   │ decode・検証
                   ▼
┌─ Public Application Contract ──────────┐
│ Objective / Command / Query             │
│ Result / Stop Reason / Recovery Ref     │
└──────────────────┬─────────────────────┘
                   │ 意味を保持
                   ▼
┌─ Orchestrator ───────────────────────────────────────────────┐
│ Project／Task状態・判断待ち・上位再入場・限定受入判断記録     │
└───────┬─────────────────────────────┬────────────────────────┘
        │ 公開API直接呼出し          │ 上位状態の保存／照会
        ▼                            ▼
  Coordinator                     Domain API／Store
  実行・Review・取消・資源終了      各Ownerの意味を維持
        │                            ▲
        │ Provider固有契約           │ 明示判断だけを記録
        ▼                            │
  AI Adapter                      Project運営者

Coordinatorの通知関数をOrchestratorが登録する。
下位の通知から上位判断・状態確定・cleanup成立を推定しない。
```

`implements`は交換契約の実装候補を示すが、Adapter名や既存FolderをCanonical Componentの根拠にしない。図のProject Runtimeの実装OwnerはOrchestrator、Execution Portの実装OwnerはCoordinatorである。実装ではOrchestratorがCoordinator公開APIを直接呼び出し、Coordinatorが定義する通知関数を登録する。CoordinatorからOrchestratorへのimportや、上位が所有するPort型を下位へ注入するFrameworkは追加しない。

### 公開SurfaceとCROS境界

| 経路 | 境界を受け持つOwner | 維持する条件 |
|---|---|---|
| Browser → Workbench Server | Workbench表示API | Browser向けREST、認証・入力検証、Process限定操作確認を維持する。 |
| Workbench Server → 同一ProcessのCROS | CROSの共通認可能力 | Transportを省略してもCredential／Role／Exposureと操作ごとの再観測を省略しない。 |
| Workbench Server → 別ProcessのCROS | MCP Server | 同一Hostでも別ProcessならMCP経路とする。独立CROS REST／Gatewayは撤去する。 |
| AI／Machine → MCP Server | MCP搬送とCROSの共通認可能力 | MCPはAI専用ではない。Repository単体stdio／localhost HTTPの契約と共有CROS認可契約を区別する。 |
| Repository単体利用 | 検証済みRepository Rootと各能力 | CROS設定・Credentialを機械的に要求しない。Rootが不明ならEffect前に停止する。 |

共有配置はWorkbench／MCPと内部Capabilityの配置形態であり、新しい公開Serverや自動Repository Deployを追加しない。Remote境界で認可・現在状態が不明な場合は操作を停止し、未許可Sourceの存在・Identityを開示しない。撤去対象が現在提供する操作・認可・終了保証を新経路へ対応付けるまで、置換済みと表示しない。

## 4. 主要なブロック間シーケンス

### Task受付から完了または回復まで

```text
利用者        Transport       Project Runtime      Execution Port      Runtime Data
  │               │                 │                    │                  │
  │ Objective     │                 │                    │                  │
  ├──────────────>│ decode/validate │                    │                  │
  │               ├────────────────>│ Taskを受付         │                  │
  │               │                 ├── intent保存 ────────────────────────>│
  │               │                 ├─ exact Task ──────>│                  │
  │               │                 │                    ├─ 実行Effect       │
  │               │                 │                    ├─ 結果/unknown ───>│
  │               │                 │<──── 結果／停止理由／Recovery ────────┤
  │               │<────────────────┤ 状態を確定         │                  │
  │<──────────────┤ 構造化結果      │                    │                  │
```

### 外部送信と候補採用

```text
内部候補  →  同意範囲確認  →  最小化送信  →  外部結果
   │              │                              │
   │              └ invalid / unknown → Effect 0 │
   │                                             ▼
   └──────── 元Request Identity照合 ← 未信頼候補として帰還
                                  │
                     exact ───────┴────── missing / ambiguous
                       │                          │
                  人間の採否                   隔離
```

## 5. Schema責務

| 情報 | Canonical Owner | Writer | Reader | 所有禁止 |
|---|---|---|---|---|
| Project／Task状態 | Project Runtime | Project Runtime | Projection、Transport | Adapterによる状態生成 |
| Objective／Milestone受入判断 | Objective／Milestone Acceptance Decision Record | Acceptance Decision Port | Project Runtime、Projection | Projectionからの書込み、Task作成、Provider Effect、下位完了からの推定 |
| Public Result | Public Application Contract | Project Runtimeの結果変換 | Transport、Client | Transport固有意味の追加 |
| Session Grant／Exposure | Workspace Resolver | 認証・管理境界 | Federation、Projection | Repository Relationからの権限生成 |
| Repository Binding | Binding Resolver | 検証済みVersion Control Port | Runtime、Tool | Path文字列からの再構成 |
| Runtime Data Metadata | Runtime Data Contract | 各Ownerの限定Writer | Recovery、Cleanup | Tool固有Top-levelの無秩序追加 |
| 実行事実読取りProjection | 既存の実行事実Source | 現在責務の外側 | 実行記録読取りProjection | Projectionによる事実生成・保存、既存事実の再解釈 |
| External Candidate | External Information Boundary | Result Receiver | Human Decision、所有正本Adapter | 送信同意からの自動採用 |
| Trust Evaluation | Runtime Trust Evaluator | Evaluator | Runtime Gate、Human | Qual-Lab署名だけの一括信頼 |
| Quality State | Quality Center | 各検証結果の統合 | Release判断、Human | 単一試験からの全体Pass |

## 6. Qualityへの引渡し

- 各境界で発行、受理、Effect、完了、観測、耐久確定を別々に反証する。
- CanonicalなPath、Identity、StateをConsumerが再解釈しないことを確認する。
- 外部境界は最小Probeだけでなく、入力から終了後状態までのLifecycleを段階的に結合確認する。
- Transport parityは同じApplication Contractへ同じ意味が届くことを確認し、同じ文字列だけを比較しない。
- restricted、unknown、not_observed、blockedを成功や不存在へ畳まない。
- Project Management Projectionから受入判断の書込みAuthorityが生じず、SPEC-000006／SPEC-000007がAcceptance Decision Portへ到達できないことを確認する。
- Acceptance Decision PortはSPEC-000002の明示判断だけを記録し、Task作成・Provider Effect・下位完了からの上位受入推定を行わないことを確認する。

## Checklist

- [x] 交換値、Authority、状態Ownerと実装の直接依存を区別した。
- [x] 同一Processの内部呼出しと別ProcessのMCP境界でも認可を維持した。
- [x] SPEC-000011のstdio／localhost HTTPを共有Remote契約へ読み替えていない。
- [x] Browser向けRESTと廃止するCROS REST／Gatewayを区別した。
- [ ] OPEN: 各公開操作・Callback・取消・終了後条件の詳細対応は段階3、固定設計の独立レビューは段階4で確認する。
