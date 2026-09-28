# CRDD Releases

状態: Current Release Projection
Owner: {Decision Authority}
Last Updated: YYYY-MM-DD
Related:
- [現在のProject](../00_CRDD/00_Overview.md)
- `CHANGELOG.md`
- [未完了作業](./01_Roadmap.md)
- [リリース規則](../00_CRDD/13_Release.md)

> 本書は、現在の公開状態と次の公開対象へ入る案内を示すProjectionである。Version、Tag、公開済み内容またはEvidenceの第二正本ではない。

## 1. 現在状態

| 項目 | 現在値 | 正本 |
|---|---|---|
| 公開済みBaseline | {Version or None} | {Reference} |
| 次の対象 | {Version or None} | [Roadmap](./01_Roadmap.md) |
| 目標リリース日 | {YYYY-MM-DD or 未設定} | {Reference} |
| 現在の作業状態 | {State} | {Reference} |
| リリース判断 | {State} | [リリース規則](../00_CRDD/13_Release.md) |
| 日程リスク | {State or 未評価} | {Reference} |

## 2. 現在Scope

| 段階 | 範囲 | 現在状態 | 正本 |
|---|---|---|---|
| {Milestone／Group} | {Scope} | {State} | {Reference} |

## 3. 依存と判断

| 項目 | 現在状態 | 次の処置／判断 |
|---|---|---|
| 工程依存 | {Dependency or N/A: 理由} | {Next action} |
| 現在人間判断 | {Decision or なし} | {Action} |
| 後続判断 | {Decision or N/A: 理由} | {Re-evaluation trigger} |

## 4. Evidence Navigation

| 証明対象 | 配置 |
|---|---|
| 一つのChange | `Changes/<CHG-ID>/Evidence/` |
| 一つのRelease | `Releases/<version>/Evidence/` |
| Repository全体の現在品質 | `07_Quality/01_Quality_Center.md` |

## 5. 更新規則

- Change固有EvidenceをRelease配下へ複製しない。
- Release固有Evidenceを単一CHGへ帰属させない。
- Tagまたは公開完了前に`Released`を表示しない。
- 公開状態が変わったときは、正本を更新してから本Projectionを再計算する。

## Checklist

- [ ] 公開済みBaselineと次の対象を現在の正本から再投影した。
- [ ] 目標日、日程リスク、Scope、依存および判断を明示的に評価した。
- [ ] 完了していないRelease Evidenceを作成済みと表示していない。
- [ ] 各項目を責務を持つ正本へ接続した。
- [ ] 本ProjectionをVersion、Scope、判断またはEvidenceの第二の正本にしていない。
