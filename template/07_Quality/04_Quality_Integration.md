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

## 3. Architecture横断モデルの処置

| QA-ID | Component／責務 | 境界／Interface | Runtime／Data Flow | 故障／回復 | 配置／実行 |
|---|---|---|---|---|---|
| `<QA-IDへのLink>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` | `<Required／理由付きN/A>` |

## 4. Architecture詳細設計領域の処置

| 詳細設計領域 | 接続するQA-ID | Qualityで受け取る成立条件 |
|---|---|---|
| `<Architecture DetailへのLink>` | `<QA-IDへのLink>` | `<境界、状態、故障、観測、終了後条件>` |

## 5. 検証項目の閉包

| QA-ID | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| `<QA-IDへのLink>` | `<Local ID集合>` | `<工程別Analysisの対象>` | `<横断モデルと詳細設計領域>` |
