# Phase 5 — Owner Artifact Surface

検証日時: 2026-09-27 23:09 JST
対象変更: `CHG-000082`

## 1. 結論

Project Plan、Quality and EvidenceおよびDocumentation and RelationsのProduction入口を追加した。Workbenchへ計画・品質・文書の第二正本は作らず、固定のRoadmap／Quality正本と、`PROJECT_CONTEXT.md`が現在明示するMarkdown Owner Relationだけを読取りCatalogへする。

```text
PROJECT_CONTEXT.md Owner Relation ─┐
99_Roadmap/01_Roadmap.md ──────────┼─ verify ─→ Owner Artifact Catalog
07_Quality/01_Quality_Center.md ────┘                 │
                                                       ├ Project Plan
                                                       ├ Quality and Evidence
                                                       └ Documentation and Relations
```

## 2. 読取り境界

| 観点 | 処置 |
|---|---|
| 対象 | 固定2正本とProject Contextに明示された相対Markdownだけ |
| 任意Path | 拒否 |
| 外部URL／絶対Path／親参照 | 拒否 |
| Symlink／Junction越境 | `lstat`と`realpath`で拒否 |
| Catalog外Document | `404`、Filesystem探索なし |
| File上限 | 512 KiB。超過はCatalog全体を`unknown`へする |
| 部分成功 | 公開しない。欠落を空一覧へ畳まない |
| 表示 | 原文を`text/markdown`で返し、Workbench独自の解釈を正本化しない |

## 3. 検証結果

`40_Develop/workbench`でFormat、Type Check、LintおよびIntegration Testを実行し、15 / 15 Passした。

直接境界では次を確認した。

- ShellにProject Plan、Quality and Evidence、Documentation and Relationsが表示される。
- Roadmap正本をCatalog内Routeから`text/markdown`で取得できる。
- Catalog外の`package.json`は取得できない。
- `../outside.md`形式の親参照は取得できない。
- Project Surfaceが固定RoadmapとQuality CenterをCatalogとして観測する。
- 外部Provider EffectおよびRepository外Effectは0である。

## 4. 15画面判定への反映

画面候補03 Project PlanをMissingからPartialへ変更する。これにより現在の15画面はCovered 3件、Partial 12件、Missing 0件となる。

QualityとDocumentationも原文へ到達できるようになったが、次は未成立であるためPartialを維持する。

- Project PlanのVersion／Milestone／Scope／期限／依存の構造化投影。
- Quality Local Item、Evidence、Gap、未観測および次GateのGroup表示。
- Documentation検索、Relation段階展開、循環・欠落および部分観測表示。

## Checklist

- [x] Owner ArtifactをWorkbenchの正本へ複製していない。
- [x] 固定正本と明示Relation以外を探索していない。
- [x] Catalog外、親参照およびRepository越境を拒否した。
- [x] 未観測を0件または不存在へ畳んでいない。
- [x] 原文へ到達できる直接境界を試験した。
- [x] Structured Projectionの残件をCoveredへ読み替えていない。
