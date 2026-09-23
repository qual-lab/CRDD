# CRDD Releases

状態: Current Release Projection
Owner: Qual-Lab
Last Updated: 2026-09-12
Related:
- [現在のCRDD](../00_Overview.md)
- [CHANGELOG](../CHANGELOG.md)
- [未完了作業](./01_Roadmap.md)
- [リリース規則](../13_Release.md)

> 本書は、現在の公開状態と次の公開対象へ入る案内を示すProjectionである。Version、Tag、公開済み内容またはEvidenceの第二正本ではない。

## 1. 現在状態

| 項目 | 現在値 | 正本 |
|---|---|---|
| 公開済みBaseline | `v0.20.1` | [現在のCRDD](../00_Overview.md)、[CHANGELOG](../CHANGELOG.md) |
| 次の対象 | `v0.21.0` | [Roadmap](./01_Roadmap.md) |
| 現在の作業状態 | Featureで設計・実装・検証中 | [Roadmap](./01_Roadmap.md) |
| リリース判断 | 未実施 | [リリース規則](../13_Release.md) |

## 2. Evidence Navigation

| 証明対象 | 配置 |
|---|---|
| 一つのChange | `Changes/<CHG-ID>/Evidence/` |
| 一つのRelease全体 | `Releases/<version>/Evidence/` |
| Repository全体の現在品質 | [Quality Center](../07_Quality/01_Quality_Center.md)が元Evidenceを参照して投影 |

### 公開済みReleaseのEvidence

| Release | Evidence |
|---|---|
| `v0.18.0` | [署名済みE2E](./Releases/v0.18.0/Evidence/260901_coordinator-signed-e2e.md) |
| `v0.18.1` | [Runtime Identity](./Releases/v0.18.1/Evidence/260901_coordinator-v0181-runtime-identity.md) |
| `v0.19.0` | [最終署名済みE2E](./Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.md)、[機械結果](./Releases/v0.19.0/Evidence/260903_project-runtime-final-signed-e2e.json) |
| `v0.20.0` | [公開Runtime・限定統合検証](./Releases/v0.20.0/Evidence/260906_v020-public-runtime-and-bounded-integration-verification.md) |

## 3. 更新規則

- Change固有EvidenceをRelease配下へ複製しない。
- Release固有Evidenceを単一CHGへ帰属させない。
- Tagまたは公開完了前に`Released`を表示しない。
- 公開状態が変わったときは、正本を更新してから本Projectionを再計算する。
