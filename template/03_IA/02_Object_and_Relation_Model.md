# 情報オブジェクトと関係

状態: [分析中／レビュー中／引き渡し可能]
担当責任者: [owner]
最終更新日: YYYY-MM-DD

## 1. この投影で分かること

[個別IA定義から、利用者が見分ける情報Object、Identity、Relationを横断表示する。]

## 2. 中心となる関係

```text
[O: 情報Object] --relation--> [O: 情報Object]
```

## 3. IA定義への適用

| IA定義 | Object／Relation上の処置 | 適用先／非該当理由 |
|---|---|---|
| [IA-XXXXXX](Definitions/IA-XXXXXX/ia_definition.md) | [適用／非該当] | [section/reason] |

### 関係の確認結果

| 確認観点 | 結果 |
|---|---|
| 未処置のIA定義 | [なし／対象ID] |
| 孤立Object | [なし／対象Objectと処置] |
| 循環 | [なし／意味上必要な循環と処理順序を誤認しない説明] |
| 関係の欠落 | [なし／不足する関係と戻り先] |

## 4. 補足分析

[なし／必要な補足]

## Checklist

ひな型では`[ ]`を未評価として残す。完成時は、処置済みを`[x]`、未完了を`OPEN: 理由 — 項目`、不適合を`FAIL: 理由 — 項目`、非該当を`N/A: 理由 — 項目`として評価する。

- [ ] 全IA Definitionを一件ずつ処置した
- [ ] Object、Identity、Relationを混同していない
- [ ] DB、API、Classを情報Objectとして逆輸入していない
- [ ] 個別IA Definitionの意味を再定義していない
- [ ] 孤立Object、循環、関係の欠落を確認した
- [ ] 非該当には理由を記録した
- [ ] 補足分析へ必須情報を退避していない
