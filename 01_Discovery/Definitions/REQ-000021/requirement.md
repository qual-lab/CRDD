# REQ-000021 Remote要求結果の同一Identity再取得

成果物種別: Discovery Definition
要求ID: `REQ-000021`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Remote要求の応答を失った場合、Timeoutを取消完了または未実行と推定せず、同じRequest Identityで状態と完了結果を安全に再取得できなければならない。

## 対象と利用状況

Remote ClientがRequest送信後にTimeoutや切断を経験し、処理状態と結果を確認し直す場面。

## 解く問題と望ましい変化

```text
現在: 応答喪失を未実行、取消完了または失敗と推定して再実行すると、共有Effectを重複させる。
    ↓
望ましい変化: 同じRequest Identityで未実行、実行中、完了、失敗、回復要求と完了結果を安全に再取得できる。
```

## 採用理由と比較

Timeout時の自動再実行を避け、Server側の耐久状態を同じIdentityで照会する方式を採る。

## 成立条件

- Request受理時に再取得可能な安定Identityを返す
- 応答喪失後も同じIdentityから現在状態と確定結果を取得する
- 再照会が元Effectを再発行せず、権限と情報開示を再検証する

## 制約

- Timeoutを取消完了、Effect 0または未実行の証拠にしない
- Recovery Authorityを未認可Clientへ開示しない

## 検証意図

要求前切断、受理後切断、Effect後応答喪失、再照会、別Credential照会を行い、重複Effectと情報開示を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Remote利用者、応答を失う状況、やり直さず同じ仕事の現在地へ戻る変化と状態表示をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000022](../../Analysis/EXP-000022/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
