# Phase 5 — Project Portfolio遷移

## 結論

CROSの許可済みPortfolioからProjectを検索・状態絞込みし、最大20件ずつ継続読込して、選択ProjectをRepository Sourceごとの五場面へ遷移できるようにした。WorkbenchはPortfolioに含まれないProjectを404で拒否し、missing Sourceを完全なProject状態へ統合しない。

## 処理境界

```text
CROS Portfolio Projection
  │ 許可済みProjectだけ
  ▼
Workbench Project Portfolio
  ├ Project ID検索
  ├ complete／partial／conflicting絞込み
  ├ 最大20件
  └ Query拘束Cursor
        │ Project選択
        ▼
Federated Project Detail
  ├ Repository Source A ─ 五場面
  ├ Repository Source B ─ 五場面
  └ missing Source ─ 利用不可を明示
```

- Cursorは正規化済み検索語、状態Filterおよび最後のProject IDを結合する。
- 別の検索条件へ流用されたCursorは一覧を再開せず拒否表示する。
- Source間の値を単一の完全状態、Scoreまたは推測値へ統合しない。
- Portfolio外Project、非開示Repositoryおよび期待Sourceを補完しない。

## 検証

| 対象 | 結果 |
|---|---|
| Workbench format | Pass |
| Workbench typecheck | Pass |
| Workbench lint | Pass |
| Workbench integration | 16 / 16 Pass |
| 20件単位継続読込 | Pass |
| 別Query Cursor拒否 | Pass |
| Portfolio外Project拒否 | Pass |
| Source別五場面とmissing保持 | Pass |

## 画面判定

Project Portfolioは検索、状態絞込み、継続読込、Current Project選択およびSource別Project Context表示が成立したためCoveredへ更新する。現在の15画面Reality AuditはCovered 13、Partial 2、Missing 0である。
