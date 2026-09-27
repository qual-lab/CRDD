# Phase 3 Change Publication IT

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-014`
観測日時: 2026-09-27 18:36 JST
基点Commit: `8ffe6d1f66118c9b45f176ed7f745b520216d016`
対象状態: 上記Commitからの未Commit変更候補。固定改訂版はPhase 3 Gate時に再記録する。

## 結論

`RFD-IT-014`の直接境界はPassした。WorkbenchのToken付きFormからVersion Control Portを経て実Git Adapterへ接続し、Repository-local一時Repositoryと一時bare Remoteで、選択PathのStage、Unstage、Commit、確認済み通常Pushおよび終了後再観測を確認した。

`RFD-ST-015`はPassしていない。拒否・通信断・結果不明と人間判断を含む実Browser System／E2EはPhase 3の残作業である。

## 観測した経路

```text
Browser相当HTTP Form
        ↓ 起動ごとの操作Token
Workbench Application
        ↓ Canonical Change Publication Request
Version Control Port
        ↓
Git Adapter
        ↓
Local Repository / bare Remote
        ↓
終了後Tree / Remote Revision再観測
```

## 結果

| 確認 | 結果 | 根拠 |
|---|---|---|
| Tree／Diff読取り | Pass | WorkbenchがStaged、Working、Untrackedを既存Local Change Set契約から表示した |
| Tokenなし／不一致操作 | Pass | HTTP 400、Repository Effect 0 |
| 選択Stage／Unstage | Pass | 選択Pathだけを準備し、解除したPathは作業領域へ残した |
| Commit | Pass | 準備済み変更だけからRevision Identityを取得した |
| Push前競合 | Pass | 確認Revisionと現在HEADが違う場合はEffect 0で拒否した |
| 通常Push | Pass | Force optionなしで確認済みRemote／Branch／Revisionを送信した |
| Remote反映 | Pass | bare Remoteの参照を再観測し、送信Revisionと一致した |
| 自動再送 | Pass | `automaticRetryIssued: false` |
| Force Push | Pass | `forcePublicationIssued: false` |
| Process／一時Fixture | Pass | Process完了後に一時Local／Remoteを削除した |

## 実行結果

```text
version-control
tests 43 / pass 43 / fail 0

workbench
tests 6 / pass 6 / fail 0
```

## 残る範囲

- `RFD-ST-015`: 実Browserでの利用者確認、拒否、通信断、結果不明、同じ対象の再観測および人間判断。
- Commit／Pushの入力補助: 現在のBranch、Remoteおよび送信Revisionを再入力ではなく確認対象として提示する改善。
- Phase 3固定候補の独立レビューと全回帰。
