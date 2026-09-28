# Phase 5 — Runtime Activity閉包

## 結論

Runtime Activityは、Repository単体とRemote CROSの両経路で、現在のProject Runtime状態とExecution Intelligence Eventを表示できる状態になった。WorkbenchはRuntime状態やEventの新しい正本を持たず、既存Ownerから得た一回の観測だけを表示する。

15画面Reality Auditの現在投影では、Runtime Activityを`Partial`から`Covered`へ更新する。全体は`Covered 7 / Partial 8 / Missing 0`である。

## 成立した経路

```text
Repository mode
  Project Runtime State Query ─┐
                               ├─→ Runtime Activity Panel
  Execution Intelligence Store ┘       ├ Current state
                                      └ Event history

CROS mode
  Bearer Credential
       ↓ requestごとに再検証
  Workspace Exposure
       ↓ 許可済みRepositoryだけ
  Runtime Activity Reader
       ↓
  Remote Transport
       ↓
  Workbench Runtime Activity Panel
```

## Event投影

| 観点 | 処置 |
|---|---|
| Owner | 既存Execution Intelligence Event Store |
| Project境界 | `projectId`が一致するEventだけを投影 |
| 並び順 | `occurredAt`、`eventId`の新しい順 |
| 取得上限 | 既定20件、最大50件 |
| 継続読込 | 最終Eventの時刻とIdentityから作る不透明Cursor |
| 公開項目 | Event、Objective、Task、Attempt、時刻、結果、cleanup、手動回復要否 |
| 非公開 | Prompt、Response、Credential、Host Path、Recovery Authority |
| 観測不能 | 0件へ畳まず`unknown`と理由を表示 |

## Remote CROS境界

CROSはRuntime正本を所有しない。Remote RouteはBearer Credentialと現在Exposure Snapshotから利用可能Repositoryを解決し、対象Projectに属する許可済みRepositoryだけを注入済みReaderへ渡す。対象Projectへ到達できない場合は、Repositoryの存在・Identity・件数を含めず利用不能を返す。

WorkbenchはRemote接続中にRepository-local Runtime Readerを使用しない。Credential失効またはRemote失敗後は直前のRuntime投影とEventをCurrent表示せず、`unknown`へ置き換える。

## 検証結果

| 対象 | 結果 |
|---|---|
| CROS format／type／lint | PASS |
| CROS全試験 | PASS、31件 |
| Workbench format／type／lint | PASS |
| Workbench Remote CROS局所試験 | PASS |
| Workbench Repository Event継続読込局所試験 | PASS |
| Repository Eventの別Project非表示 | PASS |
| Remote ReaderへのGrant外Repository非搬送 | PASS |
| Credential失効後の直前Event非表示 | PASS |

## 残る範囲

- CROS Shared ServerのTLS配置と運用設定入口
- 残る8件のPartial Screen
- AI依頼の実Coordinator Adapterと実Provider E2E
- Production Closure全体の独立レビューと`ERB-ST-022`

これらをRuntime Activityの未成立へ混在させず、各Owner Capabilityで追跡する。
