# UI／SPEC Detail Architecture Traceability

成果物種別: Architecture入力・配置の統合投影
状態: Candidate（ARCH-000013断面とDocker Isolation配置を限定更新。全体再評価は未完了）
維持責任者: Qual-Lab

## 1. 目的

発行済みのLogical Screen、Screen Part、InteractionおよびDetailed Behaviorを、意味を所有するArchitecture定義と配置を所有する詳細設計領域へ接続する。Definitionを要求源として維持し、Detailを新しい要求や実装配置の根拠へ読み替えない。

旧固定版の履歴: 固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。対象はSCR-000008／PRT-000008、BHV-000012、PRT-000008.spec-000012の3行のみでPartialを維持。残り19 UI・29 BHV・31 Relationは未変更・未再評価。

現在の鍵提示方式はSCR-000008／PRT-000008、BHV-000012と既存Interactionの3行だけへ対応する候補。通常提示≠本人受領、初回の限定接続・確認保存・読戻し・清掃／Lock終了をAMへ引き渡す。3行はPartial、今回対応差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。他行・Source Coverageは未再評価。

```text
UI／SPEC Definition
        ↓
UI／SPEC Detail
        ↓ 配置制約
ARCH Definition
        ↓
Architecture Detail Area
```

## 2. UI DetailからArchitectureへの全数対応

| UI Detail | Source UI | Architecture定義 | 詳細設計領域 | Coverage |
|---|---|---|---|---|
| [SCR-000001／PRT-000001](../04_UI/Details/Areas/operation/SCR-000001/screen.md) | UI-000001 | ARCH-000001 | checker、domain-model | Covered |
| [SCR-000002／PRT-000002](../04_UI/Details/Areas/operation/SCR-000002/screen.md) | UI-000002 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [SCR-000003／PRT-000003](../04_UI/Details/Areas/operation/SCR-000003/screen.md) | UI-000003 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [SCR-000004／PRT-000004](../04_UI/Details/Areas/project-context/SCR-000004/screen.md) | UI-000004 | ARCH-000005 | orchestrator、cros、mcp-server | Covered |
| [SCR-000005／PRT-000005](../04_UI/Details/Areas/operation/SCR-000005/screen.md) | UI-000005 | ARCH-000007、ARCH-000008 | execution-intelligence、orchestrator、coordinator、docker-isolation、platform-access、domain-model、semantic-coverage | Covered |
| [SCR-000006／PRT-000006](../04_UI/Details/Areas/project-context/SCR-000006/screen.md) | UI-000006 | ARCH-000009 | version-control、cros、domain-model | Covered |
| [SCR-000007／PRT-000007](../04_UI/Details/Areas/operation/SCR-000007/screen.md) | UI-000007 | ARCH-000012 | mcp-server、orchestrator | Covered |
| [SCR-000008／PRT-000008](../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | UI-000008 | ARCH-000013 | access-management、domain-model、mcp-server、workbench-server | Partial |
| [SCR-000009／PRT-000009](../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | UI-000009 | ARCH-000006 | cros | Covered |
| [SCR-000010／PRT-000010](../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | UI-000010 | ARCH-000010 | coordinator、cros | Covered |
| [SCR-000011／PRT-000011](../04_UI/Details/Areas/configuration-trust/SCR-000011/screen.md) | UI-000011 | ARCH-000011 | platform-access | Covered |
| [SCR-000012／PRT-000012](../04_UI/Details/Areas/operation/SCR-000012/screen.md) | UI-000012 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [SCR-000013／PRT-000013](../04_UI/Details/Areas/configuration-trust/SCR-000013/screen.md) | UI-000013 | ARCH-000014 | runtime-trust、artifact-signing、coordinator、version-control | Covered |
| [SCR-000014／PRT-000014](../04_UI/Details/Areas/governance/SCR-000014/screen.md) | UI-000014 | ARCH-000002 | contract-migration、checker、version-control、domain-model | Covered |
| [SCR-000015／PRT-000015](../04_UI/Details/Areas/governance/SCR-000015/screen.md) | UI-000015 | ARCH-000003 | quality-change-control、verification-runner | Covered |
| [SCR-000016／PRT-000016](../04_UI/Details/Areas/operation/SCR-000016/screen.md) | UI-000016 | ARCH-000015 | coordinator、cros、mcp-server | Covered |
| [SCR-000017／PRT-000017](../04_UI/Details/Areas/project-context/SCR-000017/screen.md) | UI-000017 | ARCH-000016 | execution-intelligence、cros、version-control | Covered |
| [SCR-000018／PRT-000018](../04_UI/Details/Areas/project-context/SCR-000018/screen.md) | UI-000018 | ARCH-000001 | checker、domain-model | Covered |
| [SCR-000019／PRT-000019](../04_UI/Details/Areas/project-context/SCR-000019/screen.md) | UI-000019 | ARCH-000017 | official-asset-governance | Covered |
| [SCR-000020／PRT-000020](../04_UI/Details/Areas/operation/SCR-000020/screen.md) | UI-000020 | ARCH-000018 | execution-intelligence | Covered |

## 3. SPEC DetailからArchitectureへの全数対応

| SPEC Detail | Source SPEC | Architecture定義 | 詳細設計領域 | Coverage |
|---|---|---|---|---|
| [BHV-000001](../05_SPEC/Details/BHV-000001/behavior.md) | SPEC-000001 | ARCH-000001 | checker、domain-model | Covered |
| [BHV-000002](../05_SPEC/Details/BHV-000002/behavior.md) | SPEC-000002 | ARCH-000004、ARCH-000005 | orchestrator、coordinator、docker-isolation、platform-access、cros、mcp-server | Covered |
| [BHV-000003](../05_SPEC/Details/BHV-000003/behavior.md) | SPEC-000003 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [BHV-000004](../05_SPEC/Details/BHV-000004/behavior.md) | SPEC-000004 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [BHV-000005](../05_SPEC/Details/BHV-000005/behavior.md) | SPEC-000005 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [BHV-000006](../05_SPEC/Details/BHV-000006/behavior.md) | SPEC-000006 | ARCH-000005 | orchestrator、cros、mcp-server | Covered |
| [BHV-000007](../05_SPEC/Details/BHV-000007/behavior.md) | SPEC-000007 | ARCH-000005 | orchestrator、cros、mcp-server | Covered |
| [BHV-000008](../05_SPEC/Details/BHV-000008/behavior.md) | SPEC-000008 | ARCH-000007 | execution-intelligence、orchestrator | Covered |
| [BHV-000009](../05_SPEC/Details/BHV-000009/behavior.md) | SPEC-000009 | ARCH-000008 | coordinator、docker-isolation、platform-access、domain-model、semantic-coverage | Covered |
| [BHV-000010](../05_SPEC/Details/BHV-000010/behavior.md) | SPEC-000010 | ARCH-000009 | version-control、cros、domain-model | Covered |
| [BHV-000031](../05_SPEC/Details/BHV-000031/behavior.md) | SPEC-000031 | ARCH-000009 | version-control、orchestrator | Covered |
| [BHV-000011](../05_SPEC/Details/BHV-000011/behavior.md) | SPEC-000011 | ARCH-000012 | mcp-server、orchestrator | Covered |
| [BHV-000012](../05_SPEC/Details/BHV-000012/behavior.md) | SPEC-000012 | ARCH-000013 | access-management、domain-model、mcp-server、workbench-server | Partial |
| [BHV-000013](../05_SPEC/Details/BHV-000013/behavior.md) | SPEC-000013 | ARCH-000006 | cros | Covered |
| [BHV-000014](../05_SPEC/Details/BHV-000014/behavior.md) | SPEC-000014 | ARCH-000010 | coordinator、cros | Covered |
| [BHV-000015](../05_SPEC/Details/BHV-000015/behavior.md) | SPEC-000015 | ARCH-000010 | coordinator、cros | Covered |
| [BHV-000016](../05_SPEC/Details/BHV-000016/behavior.md) | SPEC-000016 | ARCH-000011 | platform-access | Covered |
| [BHV-000017](../05_SPEC/Details/BHV-000017/behavior.md) | SPEC-000017 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [BHV-000018](../05_SPEC/Details/BHV-000018/behavior.md) | SPEC-000018 | ARCH-000014 | runtime-trust、artifact-signing、coordinator、version-control | Covered |
| [BHV-000019](../05_SPEC/Details/BHV-000019/behavior.md) | SPEC-000019 | ARCH-000002 | contract-migration、checker、version-control、domain-model | Covered |
| [BHV-000020](../05_SPEC/Details/BHV-000020/behavior.md) | SPEC-000020 | ARCH-000003 | quality-change-control、verification-runner | Covered |
| [BHV-000021](../05_SPEC/Details/BHV-000021/behavior.md) | SPEC-000021 | ARCH-000015 | coordinator、cros、mcp-server | Covered |
| [BHV-000022](../05_SPEC/Details/BHV-000022/behavior.md) | SPEC-000022 | ARCH-000016 | execution-intelligence、cros、version-control | Covered |
| [BHV-000023](../05_SPEC/Details/BHV-000023/behavior.md) | SPEC-000023 | ARCH-000001 | checker、domain-model | Covered |
| [BHV-000024](../05_SPEC/Details/BHV-000024/behavior.md) | SPEC-000024 | ARCH-000017 | official-asset-governance | Covered |
| [BHV-000026](../05_SPEC/Details/BHV-000026/behavior.md) | SPEC-000026 | ARCH-000015 | coordinator、cros、mcp-server | Covered |
| [BHV-000027](../05_SPEC/Details/BHV-000027/behavior.md) | SPEC-000027 | ARCH-000015 | coordinator、cros、mcp-server | Covered |
| [BHV-000028](../05_SPEC/Details/BHV-000028/behavior.md) | SPEC-000028 | ARCH-000004 | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| [BHV-000029](../05_SPEC/Details/BHV-000029/behavior.md) | SPEC-000029 | ARCH-000004 | orchestrator、coordinator、platform-access | Covered |
| [BHV-000030](../05_SPEC/Details/BHV-000030/behavior.md) | SPEC-000030 | ARCH-000018 | execution-intelligence | Covered |

## 4. Interaction Relationの全数対応

この表は、UI操作とBHVの関係ごとにArchitecture上の統合責務を示す中央投影である。各ARCH定義と詳細設計領域は、自身が所有するRelationだけを局所投影として保持する。UI側とBHV側の共通ARCHが1件なら`Single`、複数なら`Shared`、共通ARCHがなく両側のARCHを共同Ownerとして保持する場合は`Joint`とする。

| Interaction Relation | BHV | Architecture Relation Owner | Owner Mode | 詳細設計領域 | Coverage |
|---|---|---|---|---|---|
| `PRT-000001.spec-000001` | BHV-000001 | ARCH-000001 | Single | checker、domain-model | Covered |
| `PRT-000002.spec-000002` | BHV-000002 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000002.spec-000003` | BHV-000003 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000002.spec-000028` | BHV-000028 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000002.spec-000029` | BHV-000029 | ARCH-000004 | Single | orchestrator、coordinator、platform-access | Covered |
| `PRT-000003.spec-000004` | BHV-000004 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000003.spec-000005` | BHV-000005 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000004.spec-000002` | BHV-000002 | ARCH-000005 | Single | orchestrator、cros、mcp-server | Covered |
| `PRT-000004.spec-000006` | BHV-000006 | ARCH-000005 | Single | orchestrator、cros、mcp-server | Covered |
| `PRT-000004.spec-000007` | BHV-000007 | ARCH-000005 | Single | orchestrator、cros、mcp-server | Covered |
| `PRT-000005.spec-000008` | BHV-000008 | ARCH-000007 | Single | execution-intelligence、orchestrator | Covered |
| `PRT-000005.spec-000009` | BHV-000009 | ARCH-000008 | Single | coordinator、docker-isolation、platform-access、domain-model、semantic-coverage | Covered |
| `PRT-000006.spec-000010` | BHV-000010 | ARCH-000009 | Single | version-control、cros、domain-model | Covered |
| `PRT-000006.spec-000031` | BHV-000031 | ARCH-000009 | Single | version-control、cros、domain-model | Covered |
| `PRT-000007.spec-000011` | BHV-000011 | ARCH-000012 | Single | mcp-server、orchestrator | Covered |
| `PRT-000008.spec-000012` | BHV-000012 | ARCH-000013 | Single | access-management、domain-model、mcp-server、workbench-server | Partial |
| `PRT-000009.spec-000013` | BHV-000013 | ARCH-000006 | Single | cros | Covered |
| `PRT-000010.spec-000014` | BHV-000014 | ARCH-000010 | Single | coordinator、cros | Covered |
| `PRT-000010.spec-000015` | BHV-000015 | ARCH-000010 | Single | coordinator、cros | Covered |
| `PRT-000011.spec-000005` | BHV-000005 | ARCH-000004、ARCH-000011 | Joint | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000011.spec-000016` | BHV-000016 | ARCH-000011 | Single | platform-access | Covered |
| `PRT-000012.spec-000017` | BHV-000017 | ARCH-000004 | Single | orchestrator、coordinator、docker-isolation、platform-access | Covered |
| `PRT-000013.spec-000018` | BHV-000018 | ARCH-000014 | Single | runtime-trust、artifact-signing、coordinator、version-control | Covered |
| `PRT-000014.spec-000019` | BHV-000019 | ARCH-000002 | Single | contract-migration、checker、version-control、domain-model | Covered |
| `PRT-000015.spec-000020` | BHV-000020 | ARCH-000003 | Single | quality-change-control、verification-runner | Covered |
| `PRT-000016.spec-000021` | BHV-000021 | ARCH-000015 | Single | coordinator、cros、mcp-server | Covered |
| `PRT-000016.spec-000026` | BHV-000026 | ARCH-000015 | Single | coordinator、cros、mcp-server | Covered |
| `PRT-000016.spec-000027` | BHV-000027 | ARCH-000015 | Single | coordinator、cros、mcp-server | Covered |
| `PRT-000017.spec-000022` | BHV-000022 | ARCH-000016 | Single | execution-intelligence、cros、version-control | Covered |
| `PRT-000018.spec-000023` | BHV-000023 | ARCH-000001 | Single | checker、domain-model | Covered |
| `PRT-000019.spec-000024` | BHV-000024 | ARCH-000017 | Single | official-asset-governance | Covered |
| `PRT-000020.spec-000030` | BHV-000030 | ARCH-000018 | Single | execution-intelligence | Covered |

`PRT-000011.spec-000005`は、実行時データの保持・清掃を所有するARCH-000011と、Effect不明・回復を所有するARCH-000004をまたぐ。片方へ意味を移さず、両責務が同じInteractionを共同で閉じる。

## 5. 配置判断

Docker Isolationへの今回の伝播は上記8 Relationの技術担当だけである。受理はTask作成まで、状態照会は読取り、次行動は分類までに留め、照会・分類から新しいProbe／回収を発行しない。清掃の対象・許可・保持・保存と、引継ぎ・現在Grant・結果再取得・再発行判断は上位が所有する。診断の許可を修復／再起動の許可へ拡張しない。`PRT-000002.spec-000028`では検証済み対象の技術取消、Process／Container終端、所有資源の回収・不存在／不明の観測だけをDocker Isolationが担当し、Task Authority、取消編成、状態・Recovery保存および利用者結果は上位に残す。`PRT-000002.spec-000029`は判断記録と同じTaskへの再開可能通知まででProvider作用を開始しないため、Docker Isolationの担当へ追加しない。詳細は[DIの局所分担](Details/docker-isolation/01_Architecture.md#ui-spec-detail-placement)と[Coordinatorの局所分担](Details/coordinator/01_Architecture.md#ui-spec-detail-placement)を参照する。Coveredは配置対応の記述であり、実装・実境界・Package完成のPassではない。他行の旧配置名・全体再評価は今回変更していない。

最新ARCH-000013断面の意味OwnerはAccess Managementであり、通常鍵3操作は同一Process Workbenchの固定administrator、通常Host回復は信頼したログイン済み操作者の対話CLI交換2操作だけに接続する。初回Host設定は同じARCH-000013の別開始契約としてAccess Managementへ接続し、WorkbenchはHost案内、MCPは初期化・状態照会非公開を担う。MCPを鍵操作の利用側にせず、一覧・Schema・登録・dispatch非公開を負の境界として扱う。Domain Modelは認可済み集合のContext集約と中立な共通Root／保存部品だけを担い、資格やGrantを解釈して権限を決めない。9 Role分担行・操作別対象・変更前認可→明示更新→次要求再評価は最新SCR／BHVの配置制約としてARCH-000013へ対応する。同じ3行へ初回開始・4状態・元試行相関・個別事実・既存交換との分離を候補対応し、登録解除の同一操作・改訂と両除去読戻し、対象外・本体保持、開始済み取消非証明、鍵3分岐と元発行Identity／別交換の分離を追加対応する。MCPは鍵処置の負境界だけで、遅延旧応答の失効鍵利用表示を許可しない。3行のPartialは対応候補とArchitecture詳細・具体API／物理保存・本番接続の未完了を示し、Source Coverageや最新DetailsのPassではない。

- 20件のSCRと20件のPRTは、Source UI Definitionを所有するARCH-IDへ接続した。
- 30件のBHVは、Source SPEC Definitionを所有するARCH-IDへ接続した。
- InteractionとBHVの32件の対応は[UI／SPEC Detail対応](../05_SPEC/Details/02_UI_SPEC_Detail_Correspondence.md)を正本とし、本書はその全RelationのArchitecture責務を統合投影する。
- 一つのDefinitionが複数ARCH-IDへ接続される場合、そのDetailも同じ複数責務へ接続する。どの詳細設計領域へ物理配置するかは各ARCH-IDの詳細設計対応表に従う。
- CMPは反復する実画面を未観測のため未発行であり、Architectureへ架空のComponentを作らない。

## Checklist

以下の全数接続は前固定版のIdentity対応を保持するもので、最新Owner配置の全体完成判定ではない。

- [x] 全20 UI Definition由来のSCR／PRTを処置した
- [x] 全30 SPEC Definition由来のBHVを処置した
- [x] 32 Interaction Relationを個別にArchitecture Relation Ownerへ接続した
- [x] 各Detailを一件以上のARCH-IDへ接続した
- [x] 各ARCH-IDを一件以上の詳細設計領域へ接続した
- [x] CMP未発行をArchitecture Component不存在の証明へ読み替えていない
- [x] Detailから新しい要求、Authority、Effectまたは実装方式を逆輸入していない
- OPEN: 登録解除・通常鍵3分岐・旧初回設定の限定Passは履歴。今回の最小提示方式を同じ3行へ候補対応し、限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。具体初回接続・保存・Host交換後Binding、Quality・Source・本番接続は未完了。他行は未再評価。
