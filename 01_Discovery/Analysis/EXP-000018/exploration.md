# 作業の現在地と証拠を、置き場所から迷わない

成果物種別: Discovery Analysis
探索ID: `EXP-000018`
状態: 要求採用
主な情報源: CHG-000069、CHG-000070
判断する人: Qual-Lab
記録の性質: v0.20公開状態の伝播漏れとRoadmap／Change／Evidence再編から再構成
時系列根拠: CHG-000069とCHG-000070を起点とする。
下流の主要CHG: CHG-000069、CHG-000070

## きっかけ

v0.20.0ではRelease自体が成立しても、Overview、CHANGELOG、Quality、Roadmap等にCandidate表示が残った。またEvidenceがQuality配下とCHG配下へ分散し、何を直接証明する記録かより、ファイル種別で置き場所が決まっていた。

## 問題を分けた

| 問題 | 必要だったこと |
|---|---|
| Release状態の取り残し | 状態変更の全Consumerを閉じる |
| RoadmapとChangeの混在 | 未完了作業と変更履歴を別入口にする |
| Evidenceの分散 | 直接証明する対象がOwnerになる |
| Quality Centerの巨大化 | Evidence倉庫でなく現在品質の投影にする |

```text
Roadmap = 未完了作業の現在入口
Change  = 何を変えたか
Release = 何を公開したか
Evidence = 直接証明するChangeまたはReleaseが所有
Quality = 根拠を読んだ現在評価
```

## 採用した要求

`REQ-000033`: Roadmap、Change、Release、EvidenceおよびQualityは、未完了状態、変更差分、公開判断、直接証明対象および現在品質の責務を分け、状態遷移時は全利用側へ伝播しなければならない。

## 反証条件

同じEvidenceを複数箇所へ複製する、公開済みと候補が同じ表示になる、またはPath名だけで現在性・Ownerを判定する場合は、この責務分離が機能していない。
