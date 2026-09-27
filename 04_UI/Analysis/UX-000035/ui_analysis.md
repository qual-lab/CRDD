# UX-000035のUI分析

成果物種別: UI分析（UX観点）
分析単位: `UX-000035`
状態: 分析済み

## 1. 正式入力

- UX定義: [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md)

IAやREQを直接読んで不足を補完しない。UX定義が不足する場合はUXを再開する。

## 2. UIへ引き継ぐ利用者成果

| 観点 | UX定義から受け取る内容 |
|---|---|
| 利用者／利用状況 | CROS管理者とServer Host運用者がRemote利用範囲を維持する |
| 利用のきっかけ | 初期発行、追加発行、失効、ローテーション、全喪失、認可破損 |
| 目的 | User AccountなしでRole別Credentialを維持し通常管理へ戻る |
| 得たい結果 | Credentialを発行・失効・回復し、必要な再設定を案内できる |
| 重要な場面 | 全Administrator Credentialを失った時 |
| 避ける失敗 | Secret保存、内容Accessの自動付与、Product Data削除、Recovery重複 |
| 守る品質 | Host Authorityと明示確認でAccessだけを同じRecoveryとして再構成する |

## 3. 必要な認識・操作・Feedback

```text
Credential状態または管理不能を認識
        ↓
Role・処置対象・保持対象・Recovery現在地を確認
        ↓
発行／失効／ローテーション／回復 ──→ 一度表示Secretまたは終了後状態
        ↓
通常管理へ再入場
```

## 4. 状況による体験差

| 状況 | この利用者成果で必要な体験 |
|---|---|
| 利用開始 | Role、Credential状態、管理能力と内容Accessを見分けられる |
| 成果成立 | Secretを一度だけ受け取り、またはRecovery後の再入場方法を確認できる |
| 成果不成立 | 失効範囲、保持対象、同じRecovery ID、次の安全な行動を確認できる |
| 判断不能 | 対象やHost Authorityを確認できなければAccess変更を開始しない |

## 5. UI処置

| UI候補 | 処置 | 保持する利用者成果 | 判断理由 |
|---|---|---|---|
| [UI-000008](../../Definitions/UI-000008/ui_definition.md) | Same | Role別接続資格を維持しAccessだけを回復する | 接続資格と利用可能範囲を扱う既存責務を、Credential lifecycleとHost Recoveryまで拡張する |

## 6. IA観点との統合時に確認すること

Role、Credential Metadata、Secret表示境界、Credential状態、管理能力、Recovery Identity、対象、保持対象、結果および再入場を、秘密値を残さず判断できるか確認する。

## 未確認事項・人間判断・戻り条件

### 正式入力から継承する確認事項

| Source ID | 確認事項 | 判断者 | 現在の判断 | 未確認時の影響 | 再評価契機 |
|---|---|---|---|---|---|
| `UX-000035` | 共有Credential配布負担、管理画面とCLIの分担、有効期限の既定値 | CROS管理者、Server Host運用者、Qual-Lab | OPEN: Pilotで確認する | 定量期限、画面配置、配布手順を確定しない | CROS PilotとRecovery実測 |

### UI固有の追加判断

追加判断はない。秘密値を残さず一度表示と回復状態を伝えられない場合はUIを、Credential lifecycleとRecoveryが別成果になる場合はUXを再開する。

## 検証意図

分析で保持した成立・境界・失敗・判断不能を、Definition側で観測可能な契約へ変換できることを確認する。

## 補足分析

なし。

## Checklist

- [x] 正式入力となるUX Definitionを一件だけ特定した
- [x] UXの利用者、状況、目的、成果、重要場面および失敗を保持した
- [x] 必要な認識・操作・Feedbackを評価した
- [x] 状況による体験差を評価した
- [x] UI候補への処置と理由を明示した
- [x] IA観点と統合するときの確認事項を明示した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとUIまたはUXへ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] IA、REQ、ArchitectureまたはSourceから意味を補完していない
- [x] Behavior Ruleを先取りしていない
- [x] 補足分析へ必須情報を退避していない
