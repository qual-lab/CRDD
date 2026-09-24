# Project Runtime Source A署名前監査

## 1. 対象と目的

- 初回固定改訂版: `342e829b8c1e66eb2fb719b4bf982c833c9e06eb`
- 是正後固定改訂版: `1f3f49b08d47b843edbf6d45debe4e7c5c100a48`
- 対象: v0.19 Project Runtimeの技術候補、実行環境の意味と是正影響の一般化、ブランドアイコンの収載根拠、古い候補Manifestの除去、およびSource AからRelease tagまでの閉じたRelease契約
- 目的: Runtime実行Identityを署名する前に、論理・技術・文書・Release closureの不確実性を可能な範囲で収束させる

本記録は、過去の[最終署名前監査](2026-09-03_Project_Runtime_Final_Pre_Sign_Audit.md)を上書きしない。過去監査後に変更されたE2E検証器と規範・Release契約を含む新しい固定候補を対象とする。

## 2. 初回確認と是正

初回固定改訂版の確認では、Critical 0件、Major 2件、Minor 0件だった。

| 指摘 | 原因 | 是正 | 再確認 |
|---|---|---|---|
| 保守正本がSource A／Manifest-only Bまでを記述する一方、Workflowは文書だけを更新するFinal Candidate Cとtag Cを要求し、Release経路が一致していなかった | Release closureの正本間で、統合対象Commitとtag対象Commitの意味が分離していた | 同じfeature branchでSource A、Manifest-only B、許可済み文書だけのFinal Candidate Cを作り、Cだけを一度のPRで統合して同一Commitへtagを付ける単一契約へ統一した。A→BはManifest 1ファイル、B→Cは事前宣言したexact Pathだけを許可する | 解消。正本間の契約、禁止経路およびexact allowlistが一致した |
| 実行環境の成立段階と、変更した意味から導く是正影響の一般化がCHANGELOG英日・Roadmapへ伝播していなかった | 規範本文の成立を公開時の変更説明と現在計画へ結合する確認が不足した | 要求発行、handle取得、受理、Effect、完了、観測、耐久的確定の区別と、変更した意味から利用側・回帰面を導出する規則を英日CHANGELOGとRoadmapへ同期した | 解消。公開主張の強度と正本の意味が一致した |

是正後固定改訂版に対する限定再確認は、Critical 0件、Major 0件、Minor 0件でPassした。実装、Provider選定、外部送信Authority、Recovery、署名IdentityおよびPlatform境界に意図しない変更はない。

## 3. 共通の機械確認

| 確認 | 結果 |
|---|---|
| Coordinator全確認 | Pass |
| 制限Process試験 | 1,579 / 1,579 Pass |
| Windows実資源Gate | 7 / 7 Pass |
| 実子Process fixtureの対象試験 | 8 / 8 Pass |
| CRDD全体Checker | Markdown 407件、local link 2,881件、Error 0、Warning 0 |

古い`coordinator-package-manifest.json`は、現在の技術候補と異なるRuntime実行Identityを署名した候補だったため除去した。新しい署名が成立するまでSource AはManifestを持たない開発候補としてFail Closedを維持する。

## 4. 確認済み範囲

- OSのProcess起動成功、有効なPID／標準入出力、通知書込み完了および失敗時停止
- Provider選定とProcess開始の単一順序、および実行横断のOperation ID一意性
- 発行、受理、Effect、完了、観測および耐久的確定を区別する実行環境規範
- 根本原因、事前予測可能性、検出工程および是正増幅を別軸で扱う収束規範
- ブランド素材の生成経緯、決定権限者による収載・公開・再配布の許可、および権利保証を過大表示しない境界
- Source A→Manifest-only B→Final Candidate C→PR→main→tagの単一Release経路
- B→Cで変更できる文書の閉じたexact allowlistと、Runtime実行Identity不変の確認条件

## 5. 未確認範囲と判定

次はこの監査では未確認であり、署名後の固定候補で確認する。

- 認証済み公開MCP Clientからの実Provider経路
- 実Provider実行中の取消と終了後資源
- 利用可能な実Docker資源によるRecovery settlement
- Manifest-only BとFinal Candidate Cの実際の構築、およびB→C差分のexact allowlist一致

Linux／macOSでの実動作、第三者権利の不存在、商標としての独占性および法的登録可能性も未評価である。

是正後固定改訂版は、Runtime実行Identityを署名するSource A候補として適格である。この判定は、署名、実Provider／実Docker E2E、v0.19収載、統合またはReleaseの完了を意味しない。
