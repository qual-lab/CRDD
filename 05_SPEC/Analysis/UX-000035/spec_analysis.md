# UX-000035のSPEC分析

成果物種別: SPEC分析（UX観点）
分析単位: `UX-000035`
状態: 分析済み

## 1. 正式入力

- UX定義: [UX-000035 User管理なしでRemote Accessを維持・回復する](../../../02_UX/Definitions/UX-000035/ux_definition.md)

IA、UIまたはREQを直接読んで不足を補完しない。

## 2. 振る舞いへ引き継ぐ利用者成果

Role別Credentialを通常管理し、全喪失または認可破損時はProduct Dataを保ってHostから再入場できる。

| 観点 | UX定義から受け取る内容 |
|---|---|
| 利用者／状況 | CROS管理者、Server Host運用者がRemote Accessを維持・回復する |
| 利用のきっかけ | 発行、失効、ローテーション、全喪失、認可破損 |
| 目的 | User Accountなしで接続資格を維持し通常管理へ戻る |
| 利用者成果 | Role別Credentialを発行・失効・回復できる |
| 必要な情報 | Role、Credential、状態、Secret境界、Recovery ID、対象、保持対象、結果 |
| 重要場面 | 全Administrator Credentialを失った時 |
| 避ける失敗 | Secret保存、内容Access自動付与、Product Data削除、Recovery重複 |
| 守る品質 | Host Authority、明示確認、同一Recovery、Accessだけの再構成 |
| 検証意図 | 通常lifecycleと全喪失・破損Recovery、Secret非保存を観測する |

## 3. 観測可能にする契機・結果・失敗

```text
Credential管理または回復を開始
        ├─ 成立   → 状態確定／一度表示／Bootstrap再入場
        ├─ 不成立 → 同じRecovery ID、保持対象、次の行動
        └─ 不明   → Authority再確認、Access Effect 0
```

## 4. 受入条件と適用範囲

- 正常: 三RoleのCredentialを発行・失効・ローテーションし、Secretは一度だけ返す。
- 境界: 管理能力と内容Access、要求と確定、Access DataとProduct Dataを分ける。
- 失敗: Secretを保存せず、Product Dataを変更せず、別Recoveryを重ねない。
- 判断不能: Host Authorityまたは対象範囲を確認できなければ変更しない。
- 下流へ失わず渡す意味: Digest保存、状態遷移、Recovery Identity、再入場、終了後確認。

## 5. SPEC処置

| SPEC候補 | 処置 | 判断理由 |
|---|---|---|
| [SPEC-000012](../../Definitions/SPEC-000012/spec_definition.md) | Same | 接続資格から利用範囲を確定する既存契約を、Credential lifecycleとHost Recoveryまで拡張する |

## 6. IA観点との統合時に確認すること

Role、Credential Metadata、状態、Secret表示境界、管理能力、Recovery対象、保持対象および結果を区別し、生Secretを永続情報へ含めない。

## 未確認事項・人間判断・戻り条件

### 正式入力から継承する確認事項

| Source ID | 確認事項 | 判断者 | 現在の判断 | 未確認時の影響 | 再評価契機 |
|---|---|---|---|---|---|
| `UX-000035` | 共有Credential配布負担、管理画面とCLIの分担、有効期限既定値 | CROS管理者、Server Host運用者、Qual-Lab | OPEN: Pilotで確認 | 定量期限、Protocol、配置を確定しない | CROS PilotとRecovery実測 |

### SPEC固有の追加判断

追加判断はない。個人別失効・監査が必要になればDiscoveryへ、必要情報が不足すればIAへ戻す。

## 検証意図

分析で保持した成立・境界・失敗・判断不能を、Definition側で観測可能な契約へ変換できることを確認する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるUX Definitionを一件だけ特定した
- [x] UXの利用者、状況、成果、重要場面、失敗および品質を保持した
- [x] 契機、結果、失敗および判断不能を観測可能な意味で評価した
- [x] 受入条件と適用範囲を評価した
- [x] SPEC候補への処置と理由を明示した
- [x] IA観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとSPECまたはUXへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] IA、UI、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] UI Presentationを先取りしていない
- [x] 補足分析へ必須情報を退避していない
