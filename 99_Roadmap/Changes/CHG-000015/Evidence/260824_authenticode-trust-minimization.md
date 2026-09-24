# CHG-000036 Authenticode Trust Store最小化実測

- 対象変更: [`CHG-000036`](../CHG-000036_AppContainer_Provision_Worker_Candidate.md)
- 実行日: 2026-08-24（Asia/Tokyo）
- 対象: Current User限定の一時self-signed end-entity Code Signing証明書
- 結論: 対象Windows環境のWin32 Authenticode経路では`CurrentUser\TrustedPeople + CurrentUser\TrustedPublisher`は`CurrentUser\Root + CurrentUser\TrustedPublisher`を代替しなかった。Rootを一般規則へ昇格せず、証明書chain形態ごとにchain Trustとpublisher Trustを分離する。

## 公式入力と適用境界

Microsoftの[`Trusted Publishers Certificate Store`](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/trusted-publishers-certificate-store)は、Trusted PublishersをAuthenticode end-entity署名者のTrust Storeとして説明し、Trusted Root Certification Authoritiesとは役割が異なるとする。[`Authenticode digital signatures`](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode)は署名者certificateからtrusted rootまでのchainを検証するとする。[`MSIX troubleshooting guide`](https://learn.microsoft.com/en-us/windows/msix/msix-troubleshooting-guide)等はself-signed開発certificateをTrusted Peopleへ置く経路を示すが、MSIX／App Installer固有の検証条件である。これをCRDD Supervisorの`WINTRUST_ACTION_GENERIC_VERIFY_V2`へ流用せず、同じPE署名形式で実測した。

## 実測条件

- RSA 3072-bit、SHA-256、Digital Signature、Code Signing EKU、CA=falseのself-signed end-entity certificateをprocess memory内で生成した。
- public certificate DERのSHA-256を`CRDD_AUTHENTICODE_SIGNER_SHA256`として現在のnative Supervisor buildへ結合し、同じmemory内private keyで一時copyへSHA-256 Authenticode署名した。
- certificate登録前にbuildと署名を完了した。
- public certificateだけを`CurrentUser\TrustedPeople`と`CurrentUser\TrustedPublisher`へ登録した。`CurrentUser\Root`、`CurrentUser\My`および全Local Machine Storeは変更しなかった。
- 登録後に同じsigned Supervisorを`Get-AuthenticodeSignature`でexact 1回検証した。

## 結果

| 観測 | 結果 |
| --- | --- |
| certificate shape | self-signed end-entity Code Signing、CA=false |
| Trusted People | CurrentUserへ一時登録 |
| Trusted Publisher | CurrentUserへ一時登録 |
| Root | 変更0 |
| Authenticode status | `UnknownError` |
| Root代替 | 不成立 |
| Provider／Network request | 0 |
| machine-wide Effect | 0 |

したがって、対象環境のgeneric Authenticode検証ではTrusted PeopleのMSIX向け例をRoot chain Trustの代替にできない。過去の同一対象実測で`CurrentUser\Root + CurrentUser\TrustedPublisher`が`Valid`となり、正式Ed25519 manifestと同じrunのAppContainer Worker往復まで成立した結果を維持する。

## 回復と停止

検証harnessの旧Windows PowerShell／.NET互換不足により、最初の2試行はStore Effect前に停止した。別試行ではcleanupのDER比較APIが存在せずfinallyが停止したため、両Storeのsubject、thumbprintおよびDER完全一致を別processで確認し、対象certificateだけを直ちに削除した。`Root`、`TrustedPeople`、`TrustedPublisher`および`My`の同一thumbprint残存0を確認してから再開した。

Root経路の再確認は、WindowsのSecurity Warning UI待ちとなった。別processから4 Store残存0を確認し、Root Effect前に中止した。終了時は次を確認した。

- `CurrentUser\Root`: 対象certificate 0
- `CurrentUser\TrustedPeople`: 対象certificate 0
- `CurrentUser\TrustedPublisher`: 対象certificate 0
- `CurrentUser\My`: 対象certificate 0
- `crdd-authenticode-*`一時directory: 残存0
- private key永続化、Local Machine Store、Provider、Credential、Network request、API key、Release: Effect 0

UI待ちを成功扱いせず、無人RuntimeがSecurity Warningを迂回または自動承認する経路を追加しない。

## 採用する境界

- self-signed一時Code Signing certificateでは、certificate自身がchain rootとなる対象限定のため、明示的人間確認下の`CurrentUser\Root`とsignerとしての`CurrentUser\TrustedPublisher`を分けて扱う。
- private／public CA-issued certificateでは、Root StoreへRoot CA certificateだけを置き、end-entity signerはTrusted Publisherへ置く。同じsigner certificateを機械的に両Storeへ入れない。
- public CA chainが既にOSでtrustedならRoot追加を行わない。
- Trust Windowはbuild／署名後からexact 1回のSupervisor実行直前まで開始せず、実行後にexact removal、read-backおよびpre-state一致を必須にする。
- Root追加のSecurity Warningまたは別UIが必要な場合は、pre-activeの明示的人間操作として扱い、通常Operationや無人fallbackへ持ち込まない。
