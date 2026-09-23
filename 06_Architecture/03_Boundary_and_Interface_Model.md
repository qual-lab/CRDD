# 境界／Interfaceモデル

Status: Stable (v0.21.0)
Owner: Qual-Lab
Last Updated: 2026-09-15

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
┌─ Project Runtime ──────────────────────────────────────────────┐
│ Project State / Task State / Decision Wait / Recovery          │
│ Objective／Milestone Acceptance Decision Record               │
└───────┬──────────────┬────────────────┬─────────────────────┬──┘
        │              │                │                     │
        ▼              ▼                ▼                     ▼
 Execution Port   State Source Port  Acceptance Decision Port  Runtime Data Port
        ▲              ▲                ▲                     ▲
        │ implements   │ implements     │ explicit decision   │ implements
 Coordinator等    Projection Source  Project運営者           Repository／OS Adapter
```

`implements`は物理実装候補を示すが、Adapter名や既存FolderをCanonical Componentの根拠にしない。

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
