# Quality Integration

成果物種別: Quality統合分析
状態: Draft
維持責任者: `<担当責任者>`

## 1. 統合の責務

REQ、UX、IA、UI、SPECおよびARCHのQuality分析を横断し、検証義務を`Same／New／Merge`で独立した`QA-*`へ統合する。工程別分析を置き換えず、Source固有条件を失わない。

## 2. 統合の手順

```text
工程別AnalysisのSource固有条件
              ↓
Quality Candidate
              ↓
Same／New／Mergeと判断理由
              ↓
QA Definition
              ↓
Source固有条件をLocal Itemへ接続
```

同じQuality Contractへ統合しても、Source IDごとの成功の意味、失敗、制約、必要な試験段階および対応Local Itemを消さない。

## 3. Definition／Detail入力の統合

| Source ID | Source Layer | 導出する意味 | Relation | 統合判断 | QA-ID／Local Item | Gap／戻し先 |
|---|---|---|---|---|---|---|
| `<Canonical IDまたはDetail IDへのLink>` | `Definition／Detail` | `<成立条件／具体的観測条件>` | `<DefinitionとDetailの対応>` | `Same／New／Merge` | | |

Definition由来の成立条件とDetail由来の具体的観測条件を同じものとして重複登録せず、Relationと統合理由を保持する。DetailがDefinitionにない意味を要求している場合は、Qualityで補完せずOwner工程へ戻す。

## 4. Architecture横断モデルの処置

| QA-ID | Component／責務 | 境界／Interface | Runtime／Data Flow | 故障／回復 | 配置／実行 |
|---|---|---|---|---|---|
| `<QA-IDへのLink>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` |

## 5. Architecture詳細設計領域の処置

| 詳細設計領域 | 接続するQA-ID | Qualityで受け取る成立条件 |
|---|---|---|
| `<Architecture DetailへのLink>` | `<QA-IDへのLink>` | `<境界、状態、故障、観測、終了後条件>` |

## 6. 検証項目の閉包

| QA-ID | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| `<QA-IDへのLink>` | `<Local ID集合>` | `<工程別Analysisの対象>` | `<横断モデルと詳細設計領域>` |

## Checklist

結果は`[x]`、未評価は`[ ]`、未完了は`OPEN: 理由`、不適合は`FAIL: 理由`、非該当は`N/A: 理由`で記録する。

- [ ] 全Canonical IDを一件以上のQuality Analysis行で処置した
- [ ] Source固有の成功、失敗、Riskおよび未確認事項を保持した
- [ ] UI／SPEC Definition由来とDetail由来の検証義務を区別して統合した
- [ ] Source ID、検証目標、試験段階およびLocal Itemを一意に接続した
- [ ] 5横断モデルと全Architecture詳細設計領域を処置した
- [ ] Quality Integrationだけで第三の要求・設計・検証契約を作っていない
- [ ] 上流の未確認事項をUAT、OPEN義務または上流再開のいずれかへ処置した
- [ ] 検証目標とLocal Itemの重複、孤立および未接続を残していない
- [ ] 現行Source、TestまたはEvidenceからCanonical検証義務を逆算していない
