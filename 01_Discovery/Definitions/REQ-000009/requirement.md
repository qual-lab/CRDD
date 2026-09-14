# REQ-000009 Project・Repository・Root Identity分離

成果物種別: Discovery Definition
要求ID: `REQ-000009`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

論理Project、各Repositoryおよび検証済み実行Rootは、相互に代用しない独立したIdentityとして結び付けられなければならない。

## 目的と判断理由

この要求は、[EXP-000020の探索](../../Analysis/EXP-000020/exploration.md)で確認した問題と解決仮説を、後工程が直接利用できるCanonical Requirementとして固定する。詳しい観察、代替案、反証および判断の経緯は探索記録を参照する。

## 成立条件

- 要求本文が示す肯定条件を、関係する利用者・運用・System境界で確認できる。
- 要求本文が禁じる推定、混同、無断変更または不完全な成立表示を、代表的な反証例で拒否できる。
- 後工程が探索記録を再解釈せず、本文、制約および検証意図から分析を開始できる。

## 制約

- この要求を特定の画面、ファイル、実装方式または現在のComponent配置へ固定しない。
- 実装、検証およびReleaseの状態をDiscovery判断へ混ぜない。
- 新しい必要性や意味変更は、Discoveryへ戻して採用判断を行う。

## 検証意図

正常例だけでなく、要求本文が避ける誤認、権限逸脱、不完全な接続または利用側漏れを反証する。具体的なTest Level、Scenarioおよび期待結果はQualityで設計する。

## 関係

- Source Analysis: [EXP-000020](../../Analysis/EXP-000020/exploration.md)
- Downstream: UXは本Definitionを分析単位として受け取り、利用者成果へのNew／Same／Not Applicableを判断する。

