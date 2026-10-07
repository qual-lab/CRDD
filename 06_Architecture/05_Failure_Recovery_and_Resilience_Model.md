# 故障／回復／耐障害モデル

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-07

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
| 受入判断 | Acceptance Decision Port | Objective／Milestone IdentityとHuman Authority | 推定書込みをEffect 0で拒否 | 同じ対象への明示判断または判断待ち維持 |
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
- Project状態の観測、Task完了またはObjective受入から次段階の受入Authorityを生成しない。推定入力は記録を変更せず、判断待ちと根拠を保持する。

## 5. 段階的な故障確認

### 故障・終了処置のOwner

| Owner | 保持する事実・処置 | 代替してはならないこと |
|---|---|---|
| Orchestrator | Task／Attemptの停止、判断待ち、候補採否、上位再入場 | 下位の成功・取消受付だけをTask完了や資源回収成立へ変換しない。 |
| Coordinator | 最初の失敗境界、実行・資源の現在観測、取消・回収、限定した終了処置 | cleanupの結果で最初の失敗理由を上書きしない。上位の判断を生成しない。 |
| AI Adapter | Provider別の入力・起動・出力・認証の結果分類 | Provider終了をDocker資源不存在と同一視しない。回復Authorityを発行しない。 |
| Platform Access | OS固有のProcess／handle／Filesystemの実観測と限定処置 | 観測不能を不存在へ変換しない。業務状態・再実行を所有しない。 |

最初の失敗（Primary Failure）、cleanup／回復の結果、最終公開状態は別々に保持する。要求未発行、作成拒否、応答未観測、結果確定失敗を区別し、後続の清掃失敗で原因境界を失わない。診断にProvider本文・秘密値・未許可Pathを複製しない。

### 使い捨てDocker Runtimeと限定unknown終了

Docker Runtimeは使い捨てを基本とし、旧Containerの復元や過去のunknownを成功へ書き換えることを目指さない。回復は現在の実資源を安全に終了・確認し、旧Owner・旧作業領域の再利用を防いだ後、上位が必要条件を再評価して新しいAttemptを開始できる状態へ戻す。回復処置自体は新しいProvider依頼を発行しない。

作成結果unknownの終了は、今回採用した限定Classに限る。Provider本体の開始前、外部送信なし、共有書込みEffectなし、旧OwnerのEffect不能、遅延Createの無害化、現在の対象実資源不存在を確認できる条件を詳細設計で結合する。一つでも不明なら終了済みへ畳まず停止する。他の失敗Classや任意の残骸へ一般化しない。終了後も過去の作成結果unknownは履歴の事実として保持するが、現在状態へ永久蓄積しない。

通常の自動終了処置は利用者へRecovery内部情報の判断を求めない。自動処置不能の場合だけ、再認証や必要性を確認したDocker再起動など具体的な操作を提示する。Windows再起動を通常の終了証明にせず、追加の回復Frameworkも作らない。現在の状態、通常履歴、正式Evidenceと候補本体は保存Owner・保持条件を分ける。

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
- ProjectionからAcceptance Decision Portへ到達できないこと、SPEC-000002の明示判断だけが限定記録されること、および判断記録からTask作成・Provider Effectが発生しないことを確認する。
- 実Docker、外部CLI、Filesystem等の実境界では、起動だけでなく停止、故障、回復、再開、清掃までLifecycle全体を確認する。
- 長時間・高費用の負荷試験は人間の明示指示なしに実行せず、未実施を通常のArchitecture Ready阻害にしない。

## Checklist

- [x] 最初の失敗、cleanup結果、最終状態を別の事実として扱った。
- [x] 上位Task状態と下位実行・資源のOwnerを分離した。
- [x] 限定unknown終了を汎用Recoveryへ一般化していない。
- [x] 回復からのProvider再依頼と過去unknownの成功化を禁止した。
- [ ] OPEN: 限定終了の全条件・本番観測・反例の詳細対応は段階3、設計の独立確認は段階4、実装・実境界は段階5〜7で確認する。
