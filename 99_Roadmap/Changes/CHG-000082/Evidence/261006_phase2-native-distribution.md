# 保存方式刷新②のNative配布追従確認

成果物種別: 検証記録
変更ID: `CHG-000082`
記録日: 2026-10-06
維持責任者: Qual-Lab

## 結論

署名候補の実初期化2件は、配布されたWindows補助実行ファイルが現在のRust Sourceに追従していないため停止した。Source、回復機能、Timeout、Docker設定は変更せず、既存buildの成果物を配布へ反映する。新候補の署名と実初期化・全回帰は未完了で、②全体Passではない。

## 固定候補と結果

| 対象 | 結果 |
|---|---|
| 旧Source A | c7c5a250fcad8ce072b08c42543d90598b0c14d6、Tree b5a4f47fdfa46a5b06a003504488c56b6d4aad40。 |
| manifest carrier B | f59dc05a。Aとの差分はmanifest一件だけ。 |
| 署名・配置 | 正式preflight、外部端末SIGN_EXIT=0、署名済staging自身の配置に成功。manifest SHA-256: 247dbcd12268558f628aac5f07708db1a5f85ab363abadf200d418149d08a573。 |
| 署名関連再試験 | 32件中30成功、2失敗、skip 0。108.328秒。秘密鍵不一致拒否の元Oracleは成功。production Operation／doctorはterminal_namespace_response_invalidで停止。 |
| 旧配布exe | 229888 bytes、SHA-256: 9A1DC6C886A8FF4834972ABB342F33FC2C018D31871EF6EB3152317EB83FCEE0。最終変更bf25805d。 |
| 旧exeの読取り観測 | namespace observeはexit 2、stdout 86 bytes、stderr 0。専用CRDDNR01 frameとnonce相関が成立せず、初期化結果として受理しない。 |

署名は内容の真正性を確認するもので、Sourceと生成binaryの追従を自動保証しない。旧候補の成功を新実行ファイルへ転用しない。診断時に誤ったSource側artifact Pathで実行した2回のENOENTは診断入力の誤りであり、正式Adapterの失敗原因とは別である。

## 最小是正と反証

Architecture／Qualityの読取り確認者は、固定Rust・Cargo.lock・toolchainによる既存worker-build、新成果物の読取り専用応答、既存Native回帰、配布byte照合、再署名、元2件、全回帰の順を妥当とした。

| 確認 | 結果と限界 |
|---|---|
| build | 固定1.94.1-x86_64-pc-windows-msvc、frozen、releaseで成功。Sourceと依存版は変更なし。 |
| 新exe | 376320 bytes、SHA-256: DCEBC4EE0EC8FA358DAE0306D8E8A3CC1050C79A7E886573B388B5EE2FAFCBF0。配布先とbuild出力のbyte Hash一致。 |
| 同じ読取り要求 | exit 0、stdout 157 bytes、stderr 0。CRDDNR01・nonce一致、decoderはobserved／terminal_namespace_parent_observed、Token close 2件true、Directory close 6件を返した。初期化や処置の成立へ拡張しない。 |
| Rust既存回帰 | 単体44成功・25ignored、CLI6成功、失敗0。ignoredは明示実環境観測または子Process専用fixtureであり、成功へ加算しない。 |
| Native Lint | 既存worker-lint成功。 |
| namespace Adapter契約 | 3／3成功。実署名付き初期化の代替ではない。 |

旧manifestは新binaryに適用できないため現行候補から除去し、旧署名済stagingとGit履歴は根拠として保持する。新しいSource Aからexact archive、preflight、外部署名、署名済staging自身による配置をやり直す。新Provider依頼、Docker再起動、OS再起動、永続Dockerデータ変更は行っていない。

既存のproduction初期化試験が未追従を検出できたため、拒否を弱めたり新しい回復Frameworkを追加したりしない。今後の候補固定では、Native Source差分がある場合にbuild成果物と配布byteの照合を行い、読取り専用のProtocol確認を秘密入力前に済ませる。

## 追加確認: bootstrap固定値と既存管理Directory

更新exeを含むSource A 04750a307451c2d7e88ef7dca7782fd2077cb3bfの署名と配置は成功した。carrier Bはe799f874、manifest SHA-256はaedbbc4e1ffcd77d04f8dcef3bfd2ce24e8c2f4431ff6923d04c1b5dbce8d8f6。元production2件はNative呼出し前のterminal_namespace_parent_mismatchで停止した。全件検索でwindows-directory-bootstrap.tsの固定Hashだけが旧exeを要求していた。配布exeとbootstrap固定Hashの同時更新漏れであり、実装担当・確認者の確認不足として保持する。

Architecture／Qualityの着手前確認後、固定Hashを新exeのHashへ更新した。任意Hash受入れ、旧新両許可、検証省略は行わない。旧manifestは新Sourceへ流用せず除去した。bootstrapのOS読取り、Native／Host環境生成は全て成立し、応答異常拒否1件と静的Gateが成功した。

再署名前のNative専用局所診断ではobserveが成立した。独立親Identityと利用者Hashを保持したinitialize要求はterminal_descriptor_mismatchで停止した。最初の既存childはcreateIssued false／created false／handle取得true／close true、Token close 2件true、Directory close 6件true。Task、Provider、Docker要求を発行せず、Directory作成・権限修復を行っていない。この局所診断を署名付き本番能力の成功へ読み替えない。

読取り棚卸しでは、OS一時親の固定crdd-coordinator-recovery-v1は通常Directory、file 0、child Directory 0だった。所有者は実行環境のSandbox主体で、権限継承は有効、Access Ruleは5件。現在Nativeが要求する利用者所有・保護された専用descriptorと一致しない。Repository外の空Directory削除・再初期化はexact Rootを人間へ示して確認するまで実行しない。ACLを自動修復したり、拒否を弱めたり、新たな回復Frameworkを追加したりしない。

人間は提示したexact空Directoryの削除・再初期化を承認した。処置直前に同じRoot、通常Directory、非reparse、直下0件を再確認し、非recursive削除後の不存在を確認した。Nativeが同じ独立親・利用者観測から再初期化し、exit 0／initialized／terminal_namespace_initializedとなった。三境界を観測し、二childは作成発行・作成・handle取得・closeが全てtrue、Token close 2件true、Directory close 8件true。Task作成、Provider送信、Docker操作は0。この実環境初期化診断は②全体、署名付きproduction2件または全回帰のPassではない。

再発防止は配布binary、bootstrap固定Hash、manifestを一つの更新集合として確認する。既存のbootstrap異常応答拒否試験は正常frame受理を含み、Hashが不一致ならその正常例も失敗するため、このGateを秘密入力前へ置く。新しい汎用回復機能や許可条件緩和を追加しない。

## Checklist

- [x] 署名成功と実初期化の成立を区別した。
- [x] 最初の失敗を元Oracleで確認し、回復や設定を増築しなかった。
- [x] 旧／新binary、固定Source、build条件と診断結果を分離した。
- [x] 既存Native試験と非実行項目を区別した。
- [ ] OPEN: 新固定候補の署名、元2件、Coordinator全Portableと②最終独立確認を完了する。
