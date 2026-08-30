# 変更トレース: v0.18内部ツール近代化と命名Baseline

変更ID: `CHG-000017`
- 状態: `Reopened`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-16
- 最終更新日: 2026-08-30
- 対象: CRDD公式Repositoryの`tools/**`と配布用`template/tools/**`
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`
- 関連正本: [`19_Maintenance.md#33-internal-typescript-runtime`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`19_Maintenance.md#34-essential-correction-and-compatibility-boundary`](../../19_Maintenance.md#34-essential-correction-and-compatibility-boundary)、[`tools/coding-standards.md`](../../tools/coding-standards.md)
- 統合台帳: [未リリース変更トレース統合台帳](README.md)

## 1. 結論と変更意図

v0.18では、CRDD内部ツールをNode.js 24.12以上で直接実行できるTypeScriptへ統一し、TypeScript型検査、Biome、命名、試験発見および配布Checker Pathを一つの保守Baselineへ収束させる。

旧`CHG-000016`のTypeScript完全移行と旧`CHG-000018`のBiome診断是正は、本変更の途中Stepと完了条件であり、独立した利用者価値またはRelease処置を持たないため本CHGへ統合した。旧`CHG-000016`の「配布Pathは変更しない」という当時判断は、後続の人間判断によってsupersededされ、現在判定へ使用しない。

現在、内部ScriptのTypeScript移行、Node.js 24系でのnative実行、Biome Warning 0 Gate、nested testを含む決定論的列挙および旧Checker Pathを残さない移行候補は成立している。一方、2026-08-30の所有集合再固定で、件数assertionに遮られていた現行source／testの命名違反が全数表示された。命名Baselineは未収束であり、本CHGを`Reopened`のまま維持して過去固定版のPassを現在判定へ流用しない。

## 2. 採用したBaseline

| 項目 | 契約 |
|---|---|
| 実装言語 | 内部実行Scriptは`.ts`を標準とする |
| Runtime | Node.js 24.12 LTS以上のnative TypeScript型除去を使用する |
| 追加変換層 | `tsx`、`ts-node`、Babel、Bundlerまたは専用compiler出力をRuntime必須にしない |
| 型検査 | Checker、Coordinator production、Coordinator testを所有projectへ全数接続する |
| Lint／Format | Biome 2.5.6とRepository rootの`biome.json`を単一正本とする |
| Warning | `--error-on-warnings`を両private packageへ適用し、Warning 1件以上で失敗する |
| Info | Info 0は固定版実績であり、将来のInfo発生を自動拒否する恒久契約にしない |
| 命名 | file、folder、TypeScript identifier、Boolean、array、constant、test kind、machine identifierを`tools/coding-standards.md`へ固定する |
| 試験発見 | package所有の`.test.ts`を再帰列挙し、型検査の所有試験集合とexact一致させ、0件を失敗する |
| 互換 | 旧名shim、alias、重複入口を残さず、明示移行または以前の固定Releaseへ戻す |
| Release署名 | 開発反復を公式鍵・passphrase・実署名Effectから分離し、全非秘密条件を入力前に検査した固定Release Candidateだけを一度署名する |
| Repository-local状態 | Repository rootの`.crdd`はignore-by-defaultとし、Runtime状態、Candidate、log、一時成果物および生成物を追跡しない。内容自体が検証入力になる非秘密のCommit固定Repository設定だけを明示allowlistする |

公開CheckerのCLI、JSON、Schema、reason、status、暗号domainおよび既存machine contractは、命名規則だけを理由に変更しない。単一配布正本へ委譲するpackage entry adapterは責務分離であり、旧入口互換wrapperではない。

## 3. 外部Path移行

| 旧名 | 新名 | 処置 |
|---|---|---|
| `tools/checker/crdd_check.ts` | `tools/checker/crdd-check.ts` | 公式Repository private入口を置換 |
| `tools/checker/crdd_check.test.ts` | `tools/checker/crdd-check.contract.test.ts` | Checker契約試験を置換 |
| `template/tools/crdd_check.ts` | `template/tools/crdd-check.ts` | 配布正本を置換 |
| 採用側`tools/crdd_check.ts` | 採用側`tools/crdd-check.ts` | 採用側配置契約を置換 |
| `tools/coordinator/THREAT_MODEL.md` | `tools/coordinator/threat-model.md` | 現行脅威モデルPathを置換 |
| `tools/coordinator/tests/<subject>.test.ts` | `tools/coordinator/tests/<subject>.contract.test.ts` | Coordinator試験を現行kindへ置換 |
| Checker package script `run` | `verify:repository` | 曖昧なbare名を責務名へ置換 |

採用Repositoryはv0.18を採用するとき、次を同じ移行で行う。

1. コピー済み`tools/crdd_check.ts`を`tools/crdd-check.ts`へrenameする。
2. `AGENTS.md`、CI、script、文書および自動化の実行Pathを更新する。
3. CRDDを`00_CRDD/`へ置き、Checkerをコピーしていない場合は`node 00_CRDD/template/tools/crdd-check.ts --root . --json --summary`へ更新する。
4. 現在Treeに旧Checker Pathが残らないことを確認する。
5. 固定採用候補へ新PathのCheckerまたは同等確認と必要な独立確認を実行してから基準版を有効化する。

移行を延期する採用Repositoryはv0.17.xの固定Releaseを維持する。移行失敗時は部分的shimを追加せず、変更前Releaseと採用側差分へ戻す。

## 4. TypeScript／Biome移行の保持条件

- Node.js組込み、ESMおよび`import type`を使用し、Runtime変換を必要とする`enum`、Runtime namespace、parameter property、decoratorまたはpath aliasを導入しない。
- 外部入力は`unknown`から型Predicateで絞り、`@ts-nocheck`、広域抑制または`noImplicitAny`無効化で移行を成立させない。
- Biome診断の是正は等価な表現、未使用private処置および明示消費で行い、広域除外や抑制commentを追加しない。
- `lint` package scriptのWarning GateをChecker契約試験で固定する。
- 現行のTypeScript sourceとtestを所有集合へexact oneで含め、未所属、余剰、case collision、junction、root外解決、未知entryおよび試験0件をfail closedにする。
- source identifierのrename時もSchema key、CLI flag、reason、status、protocol、暗号domain、Docker外部fieldおよびmachine contractを保持する。
- Release署名を持つToolは、productionの意味契約を公式鍵・passphrase・正式manifestなしで反復検証できる開発入口を所有する。正式署名は内容修正中のデバッグ手段にせず、固定候補の非秘密条件を入力前に全数検査し、失敗時にmanifestまたはAuthorityを残さない。一般利用者は署名検証だけを行い、公式鍵またはpassphraseを保有しない。

## 5. 実装発展と統合した旧CHG

| 旧CHG | 位置付け | 保持する判断／根拠 |
|---|---|---|
| `CHG-000016` | TypeScript完全移行Step | Node.js 24.12以上、変換packageなし、移行順序、strict型検査、当時の段階実装と監査 |
| `CHG-000018` | Biome収束Step | Warning 44件／Info 3件の固定版解消、Warningだけの継続Gate、Infoの非一般化、最終監査 |

旧ID、旧filename、統合前状態、固定Commit／Tree／原文SHA-256、統合理由およびEvidenceは[統合台帳](README.md)を正本とする。旧全文は固定Git改訂版から取得できる。

本CHG自身では、初回の型付き命名分類器が既存識別子と宣言形を漏らしたFinding、安全read／利用文脈／最外利用先の反復是正、将来のnested testが`npm test`から漏れるFinding、Boolean集合とtest discoveryの閉包不足を履歴として保持する。個別Findingの詳細と当時の合否は[`Evidence/CHG-000017_Current_Review_Record_5185946.md`](Evidence/CHG-000017_Current_Review_Record_5185946.md)および関連監査Evidence、旧`CHG-000016`／`000018`の台帳entryから取得する。

## 6. 現在の検証義務

1. Node.js 24.12以上でChecker／Coordinatorのnative TypeScript実行を確認する。
2. Checker／Coordinatorの型検査、Biome Lint、Formatterおよび全試験を実行する。
3. test discovery集合とTypeScript projectの所有試験集合がexact一致し、0件、nested、欠落、余剰、case collision、junctionおよび未知entryを反証する。
4. TypeScript所有sourceの未所属／余剰0、命名違反0、廃止Pathの現行利用0を確認する。
5. Repository全体Checkerと`git diff --check`を実行する。
6. Release署名を持つToolについて、開発入口の公式鍵・passphrase・実署名Effect 0、正式署名入口の対話前非秘密検査、失敗時Effect 0および一般利用者の検証専用経路を契約試験で確認する。
7. Repository-local `.crdd`の通常生成物がGitに追跡されず、明示allowlistした非秘密のCommit固定Repository設定だけが追跡可能であることを確認する。
8. 最新固定改訂版へArchitecture／Security、Document、Gap／ImpactおよびConformanceを再実行する。

過去の固定版`5185946ae8193d7bc305be3152558abd45fde020`および`1ce8cedde4865aeb389047c2d2471b922928092e`に対するPassは当時版の履歴であり、本統合改訂版の現在判定へ流用しない。

2026-08-30の再確認では、Repository-local `.crdd`を廃止Path走査から除外し、版固定`.policy`とPlain text成果物の命名規則を正本化した。また、実行時にspawnされる`host-operation-lock-supervisor.ts`をproduction TypeScript projectの所有集合へ追加し、現行所有件数をproduction 142、test 145、TypeScript unique 299、Rust 9へ再固定した。この結果、Checker契約試験は古い件数assertionの先まで進み、現行source／testの命名違反243件を検出した。

広域抑制、allowlistまたは件数だけの調整は行わず、43ファイルのCRDD所有local symbolを型付き宣言単位で是正した。公開Schema／Result keyは変更せず、shorthand propertyは`effectStateUnknown: isEffectStateUnknown`等の明示形へ分離した。命名契約試験7 / 7、Checker全契約試験173 / 173、Coordinator Trace／型／Lint／Format、Coordinator全試験1,211 / 1,211、Repository全体Checker（356 Markdown、2,169 links、674 anchors、Error 0、Warning 0）を確認した。これは実装と機械確認の完了であり、最新固定改訂版の独立レビューおよび§6.8の監査集合が完了するまで本CHGを最終Passへ昇格しない。

## 7. 影響と対象外

実際の影響:

- 内部Scriptのnative TypeScript実行とstrict型検査
- Warningを再発させないBiome Gate
- CRDD所有の命名正本と型付き全数分類
- nested testを漏らさず0件成功を拒否する試験入口
- 開発E2Eと正式署名の分離、秘密入力前の完全な非秘密検査、および一般利用者へRelease秘密を要求しない発行／検証境界
- Repository-local `.crdd`のignore-by-defaultと、非秘密のCommit固定Repository設定だけを許す明示例外
- 採用RepositoryのChecker Path移行とno-shim境界

対象外:

- 公開CheckerのSchema／意味変更
- Coordinator RuntimeのAuthority、Capability、EffectまたはProvider実行契約
- 過去CHG／Evidence／CHANGELOG内の当時Pathの改稿
- v0.17.0 Released Baselineの変更
- Candidateの実装だけによる採用、準拠、Stable化またはRelease

## 8. Release処置

2026-08-30、[実務自己適用で検出した4件の試験前提不一致](CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#21-表示案から実装検証への接続)を同じ未リリース変更で是正した。`TEMP`／`TMP`をRepository-localへ置くと、試験用Pathが実RepositoryのGit境界と秘密鍵保存禁止範囲を継承していた。製品の境界判定を弱めず、鍵生成の実装と依存をbyte一致で確認した隔離配布環境へ配置し、その配布Rootの外側・実Repositoryの`.crdd`内へ試験専用鍵を出力する。配布Root内への出力拒否、暗号化・公開鍵対応、既存出力拒否、短いpassphrase拒否と出力不存在を確認する。

署名の不一致鍵試験は独立した試験鍵を作り、変更していない署名実装を隔離配布環境で実行する。署名側の外部鍵Path制限と固定公開鍵照合を両方維持し、`release_manifest_private_key_not_pinned`とmanifest未生成を確認する。Root解決の境界不存在試験は一時Directoryを作らず、実Repositoryが載るvolume rootを読み取りだけで検査する。同rootに`.git`がないという試験前提は明示検査し、成立しない環境をskipや成功へ変換しない。隔離環境と試験鍵は各試験の終了処理で回収し、対象不存在を確認する。公式鍵・実Provider・署名済み配布物は使用・変更しない。

関連3試験ファイル19件、試験型検査、変更3ファイルのLint／formatを確認した。既存の全試験をRepository-localな一時保存条件で再実行し、結果をCHG-000055へ接続する。今回の対象は4件の前提是正であり、全packageの通常試験入口が保存場所を自動強制することまでは保証しない。最終の独立監査・Release判断は未完了のまま維持する。

2026-08-31、実務残件の全機械確認で、同じ一時保存方針に対する二つの伝播漏れを追加是正した。新しいChange Intentではなく、本CHGの検査入口と試験前提の是正として扱う。

- Biomeの生成物除外が三つのE2E Directoryだけに限定され、`.crdd/release-staging`等に残る配布物の入れ子設定を読み込んで停止した。Repository-local `.crdd`全体とTool配下の旧生成領域を探索対象外にし、`tools`／`template/tools`の所有Sourceは検査対象に維持した。実際のBiomeを起動する回帰試験で、入れ子設定・不正な生成Sourceを無視しつつ、両所有Sourceの`debugger`をそれぞれ拒否することを確認する。除外前の失敗と除外後の成功を確認済みである。
- Checker試験の一時DirectoryからGitが親のCRDDを発見し、「非Git対象」の41件が期待と異なった。製品の探索や判定は変更せず、試験Processだけで`GIT_CEILING_DIRECTORIES`を一時Rootへ固定し、終了時に元の環境値を復元する。fixture自身に作るGit Repositoryは引き続き検査できる。代表3件と上記回帰試験は合格した。

通常利用者の設定、公開Checkerの結果契約、Provider Authority、署名境界は変更しない。全Checker試験、所有Sourceの型・Lint・Format、全体Checkerを再確認し、結果を[実務残件の記録](CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#22-実務残件の横断確認と最終試験への接続)へ接続する。機械確認を最終独立監査の代用にはしない。

本変更は未リリースである。最新固定改訂版の全確認がPassした後、v0.18.0のRelease統合へ引き渡す。統合前に旧`CHG-000016`／`000018`のEvidence導線、採用側Path移行、no-shim、Node minimumおよびRollbackを再確認する。

現在、この統合方針について追加の人間判断は必要ない。
