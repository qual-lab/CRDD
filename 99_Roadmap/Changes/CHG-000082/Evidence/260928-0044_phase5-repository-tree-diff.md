# Phase 5 — Repository Tree／Diff閉包

検証日時: 2026-09-28 00:44 JST
対象変更: `CHG-000082`
対象実装: `40_Develop/version-control`、`40_Develop/workbench`

## 結論

WorkbenchがGit CLI出力を独自解釈せず、Version Control公開PortからRepository Treeと選択File差分を取得できるようにした。TreeはDirectory単位で遅延展開し、Entry上限とDirectory拘束Cursorを持つ。DiffはPreparedとWorkingを分離し、表示上限超過を明示する。

```text
Verified Repository Root
          ↓
Version Control Worktree View Port
  ├─ Directory Page
  ├─ Change Classification
  └─ Selected File Patch
          ↓
Workbench Repository Worktree
```

## 成立した境界

| 対象 | 成立内容 |
|---|---|
| Tree | 追跡済み・未追跡PathをDirectory直下Entryへ変換し、全再帰展開しない |
| Continuation | Directoryと最後のEntryへ拘束した不透明Cursorで100件以下を返す |
| 変更状態 | Directoryを含め、Prepared／Working／Unregisteredの子孫有無を分ける |
| Diff | 選択FileのPrepared／Working Unified Patchを分け、各256KiBで切詰めを明示する |
| 未追跡File | 内容を暗黙に読まず、Stage後にPrepared差分として確認する |
| Security | 絶対Path、親参照、別Directory Cursor、不存在FileをEffect 0で拒否する |

## 検証結果

| 対象 | 結果 |
|---|---|
| Version Control Format／Type／Lint | PASS |
| Version Control Integration／System | PASS（45件） |
| Workbench Format／Type／Lint | PASS |
| Workbench Integration／System | PASS（16件） |
| Directory遅延展開／Cursor | PASS |
| Prepared／Working分離 | PASS |
| Path越境・別Directory Cursor拒否 | PASS |
| Workbench Tree／Diff表示 | PASS |

## 15画面への反映

Repository Worktreeを`Partial`から`Covered`へ更新する。現在の全体は次のとおりである。

```text
15 Logical Screens
├─ Covered 10
├─ Partial  5
└─ Missing  0
```

## Checklist

- [x] WorkbenchがGit CLI出力を直接解析していない。
- [x] Treeを起動時に全再帰展開していない。
- [x] PreparedとWorkingの差分を混同していない。
- [x] 未追跡File本文を暗黙読取りしていない。
- [x] 表示上限超過を完全な差分として扱っていない。
- [x] Repository Root外Pathを読取りAuthorityへ昇格していない。
