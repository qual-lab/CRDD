# Phase 5 — Runtime Activity実構成

検証日時: 2026-09-27 23:24 JST
対象変更: `CHG-000082`

## 1. 結論

Repository単体のProduction Workbenchを、既存のProject Runtime State Queryへ接続した。Workbench起動者がApplicationを注入しなくても、現在のProject IDとRepository Revisionを使って`observed`、`absent`または`unknown`を再観測する。

画面候補10は、Adapter未接続という欠落を解消した。一方、Event履歴、Remote CROS上のRuntime統合表示および実Browserでの継続利用は未成立なので、論理画面全体の判定は`Partial`を維持する。

## 2. 接続した境界

```text
PROJECT_CONTEXT.md
       │ Project ID
       ├──────────────────────┐
       │                      │
Repository Revision           │
       │                      │
       └─ Project Runtime State Query
                         │
                         v
             observed / absent / unknown
                         │
                         v
             Workbench Runtime Activity
```

- Repository Revisionを観測できない場合は`unknown`とする。
- Query結果が公開契約を満たさない場合は`unknown`とする。
- Revision不一致を直前のRuntime状態で補完しない。
- Queryは未初期化のDecision Storeを作成しない。
- WorkbenchはRuntime状態、判断またはRecovery Authorityを書き込まない。

## 3. 検証結果

| 対象 | 結果 |
|---|---|
| Workbench Format／Type／Lint | Pass |
| Workbench Integration | 15 / 15 Pass |
| Coordinator Type Check | Pass |
| Coordinator対象Lint | Pass |
| Project Runtime Acceptance／State Query System Contract | 2 / 2 Pass |
| CRDD Checker | 既知の`stable-release-tag-identity-mismatch`だけ。Feature HEADとv0.21.0 Tagの差である |

Production Shell試験は、Runtime Activityが`Not connected`にならず、実Queryから現在状態を分類することを確認した。注入済みProjection試験は、Milestone、Objective／Task件数、人間判断、Recoveryおよび次処置の表示を引き続き確認した。

## 4. 残る範囲

- Runtime Eventの一覧・絞込み・詳細表示
- Remote CROSを介した複数Repository Runtime Activityの統合
- Production Browserでの再読込、長期SessionおよびRuntime更新時の確認
- `ERB-ST-022`を含む全画面Production E2E

## Checklist

- [x] 既存のProject Runtime公開Queryを再利用した。
- [x] Workbench専用Runtime正本を追加していない。
- [x] 現在RevisionとRuntime Revisionの不一致を成功へ畳んでいない。
- [x] 読取りQueryが未初期化Storeを作らないようにした。
- [x] Repository単体起動で実Compositionを使用する。
- [x] 局所試験とCheckerを再実行した。
- [x] Event／Remote／Production E2Eの未成立を残した。
