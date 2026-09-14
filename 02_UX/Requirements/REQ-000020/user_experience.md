# REQ-000020の利用者体験分析

状態: Candidate
要求: `REQ-000020` 欠測・競合を保つRepository Federation
探索元: [Repository横断Project Context](../../../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)

## 1. なぜこの要求を体験として扱うのか

複数Repositoryを束ねると、一部の取得失敗や値の競合を一つの正常値へ丸めたくなる。しかし利用者が必要なのは、見栄えのよい統合結果より、判断に使える正確な全体像である。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| Repositoryごとの状態を手で合成し、不足を見落とす | 一つのProject Viewで、取得済み・欠測・競合を同時に確認する |
| 最新値らしい一つを選んでしまう | Sourceごとの値と統合不能理由を理解する |

## 3. UXへの処置

`UX-000002@1`「根拠付きProject View」のFederation場面へ統合する。Repository数や接続成功数を完全性の代理にしない。

## 4. 重要場面、失敗、品質期待

- Sourceごとの取得状態と観測時点を保持する。
- `missing`と`restricted`と`unavailable`を混同しない。
- 競合値をAIが勝手に一つへ統合しない。
- Partialでも分かる範囲と判断できない範囲を示す。

## 5. 下流への引き渡し

IAはProperty単位のProvenanceとCoverageを持つ。SPECは統合決定表とFreshness条件を定め、ArchitectureはSource Adapterの失敗をProject全体成功へ隠さない。
