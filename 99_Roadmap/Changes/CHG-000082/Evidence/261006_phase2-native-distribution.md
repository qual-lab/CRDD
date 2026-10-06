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

## Checklist

- [x] 署名成功と実初期化の成立を区別した。
- [x] 最初の失敗を元Oracleで確認し、回復や設定を増築しなかった。
- [x] 旧／新binary、固定Source、build条件と診断結果を分離した。
- [x] 既存Native試験と非実行項目を区別した。
- [ ] OPEN: 新固定候補の署名、元2件、Coordinator全Portableと②最終独立確認を完了する。
