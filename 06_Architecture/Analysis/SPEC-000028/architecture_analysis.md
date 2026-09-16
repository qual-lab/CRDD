# SPEC-000028のArchitecture分析

成果物種別: Architecture分析（SPEC観点）
分析単位: `SPEC-000028`
状態: Canonical

## 1. 正式入力

- SPEC定義: [SPEC-000028 Taskの取消と終了確認](../../../05_SPEC/Definitions/SPEC-000028/spec_definition.md)

このSPEC定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐSPEC契約

### 振る舞いの目的

実行中または待機中の同じTaskへ取消を要求し、外部作用と資源の終了状態を確認する。

### 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 実行中または判断待ちのTaskについて、利用者が取消を選ぶ時 |
| 事前条件 | Request、Task、Attempt、現在世代、状態および作用状態を確認できる |
| Authority | exactなTaskとAttemptへ限定した取消権限。実行、回復、清掃または別Taskの権限を含まない |
| 判定不能 | 取消を重複発行せず、新しいProvider作用を発行せず、既知状態と回復義務を保持する |

### 振る舞い・状態・結果

```text
[実行中／判断待ち] -> [取消要求済み] -> [終了観測]
        ├─ 正常完了と競合 -> [完了結果]
        ├─ 終了確認済み   -> [取消完了]
        └─ 観測不能       -> [取消結果不明／回復必要]
```

- 振る舞い: 検証済みの対象へ取消を一度だけ要求し、Process終了と終了後資源を別々に観測する。
- 成功条件: 取消完了または先に確定した完了結果を、同じIdentityと観測時点付きで返す。
- 要求発行、受理、終了、資源回収および終了観測を同一視しない。

### 失敗・回復・副作用

- 失敗: Identity、世代または権限の不一致、確定済み結果、作用状態不明では新規取消を発行しない。
- 副作用: exactなTaskとAttemptへ取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。
- 終了観測不能時は同じRecovery Identityへ義務を結び、取消を再発行しない。

### 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | exact対象への取消要求、Process終了、終了後資源の順を観測する |
| 競合 | 先に確定した完了結果を取消完了で上書きしない |
| 境界 | Task／Attempt／世代／取消権限の一致と不一致を分ける |
| 失敗 | 要求受理だけを終了とみなさず、観測不能を回復義務付きで返す |
| 対応UI | [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md)の取消操作と状態Feedbackが一致する |

### 制約

API、Process、保存方式、画面、部品または実装技術を本分析で確定しない。取消を再試行、回復または清掃へ読み替えない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project実行](../../Definitions/ARCH-000004/architecture_definition.md) | 取消Controllerと終了観測 | exactなTaskとAttemptへ限定した取消権限 | 取消要求を一度だけ発行する。新規Provider実行と別TaskへのEffectは0 | 古い世代、別Identity、競合完了、終了観測不能、資源残存 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project実行](../../Definitions/ARCH-000004/architecture_definition.md) | Same | Request／Task／Attempt Identityを共有するが、取消は受付、照会、Recoveryおよび清掃と異なるAuthority、Effect、状態機械を持つSibling blockとして保持する |

## 5. UI観点との統合時に確認すること

- 対応候補: UI-000002
- 取消操作、取消要求済み、完了との競合、終了観測および回復必要を利用者が区別できることを照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のSPEC定義だけを正式入力として処置した
- [x] 契機、事前条件、Authority、状態、結果およびEffectを保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] External Boundaryと終了後観測を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] UI観点との統合時に確認する事項を明示した
