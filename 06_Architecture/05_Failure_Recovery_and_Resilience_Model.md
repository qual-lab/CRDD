# 故障／回復／耐障害モデル

Status: Candidate (v0.21.0)
Owner: Qual-Lab
Last Updated: 2026-09-15

## 1. この成果物が所有すること

故障を一つの`failed`へ畳まず、故障領域、影響、Authority、残存Resource、回復入口および終了後条件を横断して示す。各理由値と実装方式は個別ARCH定義と後段実装が所有する。

## 2. 故障と回復の全体図

```text
要求
 │
 ├─ 入力／Binding不正 ───────────────> Effect 0で拒否
 │
 ├─ 判断不足 ───────────────────────> 同じTaskで判断待ち
 │                                      │
 │                                      └─ 入力返却／取消
 │
 ├─ 外部境界の開始前失敗 ───────────> Authority非発行・Effect 0
 │
 ├─ Effect発行後の結果不明 ─────────> exact Recovery義務を保存
 │                                      │
 │                                      └─ 再観測 → 再入場 → settlement
 │
 ├─ 部分結果／欠測 ─────────────────> partial／unknownのまま投影
 │
 ├─ 外部結果の相関不能 ─────────────> 候補隔離・採用不可
 │
 └─ cleanup未確認 ──────────────────> 完了表示せず回復待ち
```

## 3. Failure Matrix

| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |
|---|---|---|---|---|
| 入力・構成 | Transport、Capability Resolver | 意味契約、選択理由 | Provider Effect前に拒否 | 修正済み入力で新規受付 |
| Repository境界 | Binding Resolver | exact Root、Identity、書込み範囲 | Effect 0 | Root再検証 |
| 判断不足 | Project Runtime | 同じTaskとHuman Authority | 判断待ち | exact Taskへの入力または取消 |
| 実行開始前 | Execution Port／Platform Port | Capability非発行 | 失敗理由を返す | 条件変更後に再評価 |
| 実行Effect後 | Execution Port | 重複Effect防止 | Recovery義務を耐久化 | 同じIdentityで観測・settlement |
| 取消 | Project Runtime／Execution Port | 終了とResource回収 | 要求受付と完了を分離 | Process終了、handle／Resource 0 |
| Data永続化 | Runtime Data Contract | intent、receipt、evidence | 上書きせず残存を分類 | immutable publishまたはexact cleanup |
| 投影・観測 | Projection／Diagnosis | 欠測、時点、根拠 | unknownを保持 | Source再取得または不足表示 |
| 外部送信 | External Information Boundary | Consent Scope、Secret | Effect 0 | 新しい有効同意 |
| 結果帰還 | Result Receiver | Request相関、未信頼性 | 隔離 | exact相関後も人間採否 |
| Trust／権利 | Trust Evaluator／収載判断 | Publisher、用途、決定権限 | 未承認 | 必要な根拠と人間判断 |
| 契約移行 | Consumer Closure | 全Consumer、派生物、Release経路 | 旧処理を削除しない | 集合一致と全Consumer反証 |
| 検査・品質 | Checker／Quality Center | 同じ改訂版、未確認範囲 | 全体Passを表示しない | 必須確認の完了または明示保留 |

## 4. 回復の不変条件

- Recovery Identityは、残存可能性が最初に生じた結果から耐久記録、再入場、終了まで変えない。
- Retryは新しい仕事を暗黙生成せず、同じEffectの重複発行を防ぐ。
- `unknown`は`false`、不存在またはcleanup済みへ変換しない。
- 保存済みintent、receiptまたはpointerだけから現在Authorityを再生成しない。
- 取消要求、Process終了、Resource回収、公開結果の確定を別の観測として扱う。
- 部分故障で無関係なComponentを全停止にせず、利用可能範囲と未確認範囲を返す。

## 5. 段階的な故障確認

```text
Component内部の異常
        ↓
隣接境界での拒否・搬送・終了
        ↓
一つ先の状態Owner／Resource Ownerまで
        ↓
公開入口からの部分故障表示
        ↓
必要な場合だけSystem全体のST／E2E
```

同じResource、Identity、Authorityまたはtransactionが開始からsettlementまで続く場合は同じ結合単位にする。別Owner、別Failure Isolation、別Retryまたは別永続化境界を持つ場合は分け、隣接境界で結合する。

## 6. Qualityへの引渡し

- 正常系だけでなく、開始前、Effect後、取消中、回復中、cleanup不明の各状態を試験する。
- rejectされた事実だけでなく、期待したphase／reason、Capability非発行、Effect 0、残存Resourceを確認する。
- 実Docker、外部CLI、Filesystem等の実境界では、起動だけでなく停止、故障、回復、再開、清掃までLifecycle全体を確認する。
- 長時間・高費用の負荷試験は人間の明示指示なしに実行せず、未実施を通常のArchitecture Ready阻害にしない。
