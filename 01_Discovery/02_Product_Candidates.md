# Product候補登録

状態: 候補登録
維持責任者: Qual-Lab
対象改訂版: 2026-09-13
関連:
- [統合された課題探索・要求形成](01_Product_Discovery.md)
- [Roadmap](../99_Roadmap/01_Roadmap.md)

---

> 本書は、まだ活動中の個別探索または採用済み要求へ昇格していない候補を保持する。探索本文、設計、実装順序、版または進捗の正本ではない。

## 1. 読み方

```text
生の候補
  ↓
本書で情報源・保持理由・再評価契機を保持
  ↓ 必要性が具体化
個別の探索記録
  ↓ 人間が採用
要求／次工程／Roadmap
```

活動中の探索は[現在の探索地図](01_Product_Discovery.md#current-discovery-map)、版と次のGateは[Roadmap](../99_Roadmap/01_Roadmap.md)を参照する。採用済み内容を本書へ戻して候補扱いしない。

## 2. 保持中の候補

| 候補 | 情報源・保持理由 | 現在分かっていないこと | 再評価契機 |
|---|---|---|---|
| Self-hosted／API Provider | AI Runtime Registryが既存CLI Adapter以外へ広がる可能性を保持する | Trust、費用、認証、取消、結果契約および運用責任 | v0.21のRegistry／Adapter実績後 |
| 動的Plugin探索・Remote Plugin配布 | Repository Capabilityを将来拡張できる可能性を保持する | Publisher Trust、配布、更新、任意Code実行境界 | 固定Registryで拡張不足が実測された時 |
| Hosted Multi-tenant Workbench | 複数組織が同じServiceを利用する将来形を保持する | Tenant分離、法務、運用主体、課金および事故対応 | Shared CROSの実運用後 |
| 複数Project間の自動調整・最適化 | Portfolio観測からProject間の支援へ発展する可能性を保持する | Effect Authority、優先順位の決定権限、Capacity、投資判断 | 読取り専用Portfolioと実行評価のEvidence取得後 |
| 汎用Project管理Database | 外部PM Toolなしで不足する情報が将来判明する可能性を保持する | 既存正本から投影できない情報と、独立Ownerが本当に必要か | Project Operation自己適用で不足が反復した時 |
| 高度なWBS／Risk／Forecast投影 | 最小Project／Portfolio Viewを超える運営情報の可能性を保持する | 必要なProperty、正本Owner、推定の許容範囲 | PM／Management利用の観測後 |

## 3. 登録しないもの

- 既に[個別探索分析](Analysis/)へ入った課題。
- 人間が採用し、Roadmap、要求または変更トレースへ進んだ内容。
- 明確な不具合、現在の完成条件または必須是正。
- 実装方式だけの思いつきで、解く課題や保持理由がないもの。

候補を活動中の探索へ移す時は、当時の結論へ合わせて情報源を編集せず、何が本質的な課題か、どの解決仮説を置くか、何が判断を変えたかを個別探索へ残す。
