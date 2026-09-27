# Phase 4 Credential管理Surface検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-013`
観測日時: 2026-09-27 19:21 JST
対象状態: v0.22 Feature Branchの未Commit変更候補。Phase 4全体の完了Evidenceではない。

## 結論

Phase 4のCredential管理Surface SliceはPassした。Repository単体利用はCredential不要のまま維持し、検証済みの管理Access ContextとCredential Registryを明示注入した場合だけ、Workbenchから固定三Profileの発行、明示Workspace Grant更新、失効およびローテーションを実行できる。

発行またはローテーションで得た生Tokenは、POST後の最初のGET Responseにだけ表示し、再読込、一覧、Registry Snapshot、Project Contextまたはlogへ残さない。Profileは発行時の初期値であり、保存後の実効権限は明示Workspace集合と`systemAdmin`だけから決まる。

## 成立した境界

```text
Repository mode
  └ Credential管理未構成
       └ Repository利用は継続

検証済み管理Access Context
  ↓ 明示注入
Workbench localhost Surface
  ↓ 起動ごとの操作Token
CROS Credential Application
  ↓ revision一致時だけpublish
Credential Registry
  └ 生Token 0
```

## 自動検証

| Scenario | 結果 | Oracle |
|---|---|---|
| Repository単体利用 | Pass | Credential不要。管理POSTはHTTP 400、Registry Effect 0 |
| 管理Surface表示 | Pass | `systemAdmin=true`の検証済みContext注入時だけMetadataを表示 |
| Profile別発行 | Pass | 固定Profileを推奨初期Grantへ変換し、保存値を実効権限とする |
| 生Token表示 | Pass | 発行直後の最初のGETだけに表示し、次のGETでは不存在 |
| Registry保存 | Pass | salt付きVerifierだけを保持し、生Token不存在 |
| 明示Grant更新 | Pass | Workspace集合と管理可否を次Requestから反映 |
| 失効 | Pass | 次Requestから拒否できる現在状態へ更新 |
| ローテーション | Pass | 旧失効と新発行を一つのRegistry publishへ閉じる |
| 競合 | Pass | revision競合をEffect 0で返し、自動再試行しない |
| Credential一覧 | Pass | Token、salt、Verifierを除いたMetadataだけを返す |

```text
cros
tests 23 / pass 23 / fail 0

workbench
tests 7 / pass 7 / fail 0

checker
files 1,880 / markdown 1,092 / links 17,839 / anchors 2,032
warnings 0
expected error 1: stable-release-tag-identity-mismatch
```

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/workbench/src/credential-administration.ts` | `b680151d8424d693ed009a37b80b5740214d82b8f63f1a1ea50ef275d8bcabc3` |
| `40_Develop/workbench/src/workbench-server.ts` | `fc3364bdf7e7f92fe77c55203ab26c991ea25011927d641d2650b1a9042ee99f` |
| `40_Develop/workbench/tests/integration/workbench-server.contract.test.ts` | `6d70e0641aa0c6bf9106829cdc09ade9d191d9c79051cdfd15f47c14dbbfd32b` |
| `40_Develop/cros/src/connection-credential.ts` | `2c8931bfa4f0d3a47644562859948af2e1a3156c81e6a4888be6c7c14e7a8720` |
| `40_Develop/cros/src/credential-registry-file-adapter.ts` | `36bd3fd1fd9d35f987616cfc6ac41fb7fdd39fd7ee5f8c4d1c903d680b88590d` |

## 限定

- 本結果はCredential Core、永続RegistryおよびWorkbench管理Surfaceを対象とする。Remote CROS Transport、Bearer Request認証、Host Recovery、AI依頼またはPhase 4全体の完了を証明しない。
- WorkbenchはUser Account、Human Identity、組織Role、Password ResetまたはTrust Policyを追加していない。
- localhost Workbenchへの管理Access Contextは起動側が事前に検証する。Remote CredentialをWorkbench自身が受け付けて認証する経路はまだ存在しない。
- 一度表示Tokenの安全な受渡しとClient側保存はCROS ServerまたはWorkbenchの正本責務ではない。

## Checklist

- [x] Repository単体利用へCredentialを要求していない。
- [x] Credential Profileを実効権限の階層として使用していない。
- [x] 管理CapabilityからContent Accessを生成していない。
- [x] 生TokenをRegistry、Project Context、Evidenceまたはlogへ保存していない。
- [x] 生Tokenの再読込と再表示を許可していない。
- [x] 不明操作、不正Tokenおよび未構成SurfaceをEffect 0で拒否した。
- [x] Remote Transport、Host RecoveryおよびAI依頼を成立済みと表示していない。
