# CRDD／CROSの体験品質期待

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

本書は、利用者や運用者へ現れる品質をProduct横断で統合する。数値閾値、状態Schema、Protocolおよび実現方式は下流工程が具体化する。

## 1. 品質期待の全体像

```text
理解できる ─────────┐
根拠へ戻れる ───────┤
不足を誤認しない ───┼→ 安心して次の判断と仕事へ進める
止まった理由が分かる ┤
同じ仕事へ戻れる ───┤
不要に待たされない ─┘
```

速く応答するだけでは成立しない。利用者が、現在状態、根拠、不完全性、必要な判断および次の安全な行動を理解できることを優先する。

## 2. 品質期待台帳

| 品質期待 | 利用者に現れる状態 | 重要場面 | 避ける失敗 | 下流で具体化すること |
|---|---|---|---|---|
| Understandability | 状態、結果、失敗理由、次の行動を専門的な内部logなしで理解できる | 初回結果、判断待ち、停止 | 一律`failed`、専門語だけ、根拠のない完了 | 表示状態、説明、エラー契約 |
| Traceability | 結論からSource、Revision、観測時点、判断へ戻れる | Project／Portfolio表示、外部Context結果 | 出典のない要約、別Taskの結果混入 | Identity、Relation、Navigation |
| Incompleteness Awareness | 欠測、制限、古さ、競合、未観測を正常・0・完全と区別できる | Federation、Projection、実行知 | partialをcompleteへ畳む | Coverage、Freshness、Conflict状態 |
| Controllability | 何を誰へどこまで任せ、どこで人間が判断するか分かる | 委任前、外部送信、候補採用 | 接続済みから包括許可を推定する | Authority、Consent、Decision契約 |
| Recoverability | 再試行、再取得、Recovery、Cleanupを取り違えず同じ仕事へ戻れる | 応答喪失、取消、残存検出 | 二重Effect、回復先不明、要求発行だけの完了 | Lifecycle、Recovery Identity、終了条件 |
| Responsiveness | 状態不明のまま長く待たされず、待機中も現在地と次の選択を理解できる | 外部実行、横断取得、長時間処理 | 無反応、偽の進捗、不要な反復承認 | 観測頻度、Timeout、Progress契約 |
| Consistency | Workbench、MCP、CLI、Chat Agentで同じ入力・Authorityから同じ意味の結果へ届く | Surface切替、再接続 | Surface固有の第二正本や状態 | Public Contract、Projection同値性 |
| Accessibility | 能力、端末、知識差が不必要な成果格差にならない | 初回利用、エラー、複雑な比較 | 色や専門語だけの状態表現 | Keyboard、読み上げ、Locale、代替表現 |
| Trust | 事実、仮説、評価、候補、公式表示、Publisher Trustを取り違えない | AI結果、Runtime導入、公開判断 | 推測を事実化、一つのTrust表示へ集約 | Provenance、表示分類、Trust Policy |

## 3. Flow上の重要場面

```text
結果を受け取る
      │
      ├─ ★ 状態とCoverageを最初に理解できる
      ├─ ⚠ Missing／Stale／Restrictedを隠さない
      └─ ✓ Sourceと次の行動へ進める
      ↓
判断する
      │
      ├─ ★ 人間へ残る判断が分かる
      ├─ ⚠ Authorityを暗黙に拡張しない
      └─ ✓ 保留・拒否・訂正・再開を選べる
      ↓
継続または回復
      │
      ├─ ★ 同じIdentityへ戻る
      ├─ ⚠ 不明Effectを再実行しない
      └─ ✓ 終了後状態を確認できる
```

## 4. Trade-offと優先順位

| Trade-off | 現在の優先判断 |
|---|---|
| 簡潔な要約 vs 不完全性の表示 | 要約を短くしてもCoverage、制限および根拠導線を失わない |
| 自動継続 vs 人間の制御 | 既に許可した範囲は反復確認しないが、新しいAuthorityやRiskは人間へ戻す |
| 速さ vs 確実な終了観測 | 要求発行やProcess handleだけで完了とせず、必要なGuaranteeを観測する |
| 柔軟な環境 vs 安全な停止 | Version文字列を過剰固定せず、意味や危険な変化を検出した時に止まる |
| 一つのProject View vs Repository境界 | 日常表示はProject中心にするが、Source、欠測、開示境界を隠さない |

## 5. 妥当性確認と下流への引き渡し

- IAはSource、Coverage、Freshness、Conflict、DecisionおよびRecoveryの関係を定義する。
- UIは状態、不完全性、判断待ちおよび根拠を誤認させない表示と操作を設計する。
- SPECはFailure、Timeout、再取得、取消、回復および完了条件を観測可能なContractにする。
- Architectureは外部境界、Authority、Effect、診断および資源Lifecycleを閉じる。
- Verificationは成功例だけでなく、品質期待を破る反例を試す。
- Prototypeと代表利用者確認では、到達時間だけでなく、誤認、再探索、迷い、判断Confidenceおよび回復可否を観測する。
