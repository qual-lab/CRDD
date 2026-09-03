# v0.19 Project Runtime署名前検証

状態: 技術候補の決定論的検証を完了。署名後の公開Process実測と独立確認は未完了
担当責任者: Qual-Lab
最終更新日: 2026-09-03

## 対象

- 固定Commit: `fbd07dea70f9eaaa432a1adb75cc0118cb03f6be`
- 固定Tree: `f51c14ba703ef72157e0d663381ce752ea9cc521`
- 対象変更: [CHG-000057](../../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)
- 対象範囲: Project Runtimeの状態、Queue、Task開始、取消、親Process喪失、型付きRecovery、公開結果、MCP境界およびDocker Recovery settlement

## 結論

固定Commitは、Task Effect前後の状態、Runtime Process再利用禁止、複数種別Recoveryの逐次settlement、Project StateによるDocker Recovery完了Receiptの消費権限、公開結果の再帰的に閉じた操作別投影と意味相関、およびQueue遷移を、設計・実装・試験で一致させた。Coordinatorは実Windows Process Gate 7件と、それ以外の制限Process試験1,552件を分離してすべて成功し、型・Lint・Format・設計追跡およびCRDD全体Checkerも成功した。

これは未署名の技術候補に対する結果である。認証済みの公開MCP Clientから実Providerへ到達する経路、実Provider実行中の取消、および実Docker資源を用いたRecovery settlementは、Runtime実行Identityを固定して署名した後の最終E2Eまで未完了とする。未署名候補から公開Runtimeの認証・Authority成立を推定しない。

## 主な是正と反証

| 対象 | 是正後の不変条件 | 主な反証 |
|---|---|---|
| Task開始 | `reserved`、`handoff_prepared`、開始観測後の`running`を分離 | Effect前結果を`running`へ補正しない。開始観測を省いた統合fixtureも拒否 |
| Runtime Process回復 | Parent RuntimeだけがProcess Instance、attempt、Operationへ結合したexact IDを発行し、一般の再起動要求も型付き義務へ正規化する | 下位Adapterの自己申告、別attempt／Operation、改変ID、同じProcessからのsettlementを拒否 |
| Effect開始境界 | Effect開始前の不正結果はEffect 0の再計画へ閉じ、開始後のthrow・不正結果・binding差はProcess再利用禁止と型付き義務へ閉じる | 開始前失敗でRecoveryを捏造せず、開始後失敗を通常再入場へ戻さない |
| 複数Recovery | Docker等のRuntime所有回復を先にsettleし、残る外部義務を型付きで投影 | 一つの未対応義務で他の自動回復まで失わない。平坦なIDへ戻さない |
| Docker完了再入場 | exact Recovery IDとRuntime State bindingを耐久Receiptへ保存し、同じRepository Binding・Project・Milestone・世代・Task・attempt・OperationのProject settlementをfreshにreadbackした後だけ確認済みとして除去 | IDだけの確認入口をproduction facadeへ公開せず、別世代・別binding・Receipt改変を成功へ流用しない |
| 公開結果 | CLI／MCPを操作別のexact contractと再帰的に閉じたDTOから構成し、外側のProject／Milestone、内側のProjection、cleanup、手動Recovery、Effect、Process再起動義務を相関検証 | 内部field、入れ子の未知field、別操作field、別ProjectのProjection、矛盾したRecovery、accessorまたはProxyを公開しない |
| Queue | 設計上の遷移と実装可能遷移を54件の一対一対応へ固定 | 判断待ちから直接Leaseせず再計画を経由し、`waiting_foreground`からも`queued`を経ずLeaseしない |

## 機械確認

| 確認 | 結果 |
|---|---|
| Coordinator制限Process試験 | Windows実資源Gateを除く1,552 / 1,552成功、失敗0、終了Code 0 |
| Windows実資源Gate | 子Process・子孫Processの取消、出力上限、closeおよびcleanupを7 / 7成功、失敗0、終了Code 0 |
| Coordinator `npm run check` | TypeScript、Lint、Format、Runtime追跡、Project Runtime設計追跡が成功 |
| Project Runtime設計追跡 | 9 Interface、9永続Record、13資源、4 Lock、7 Authority、9 Effect、7状態機械、54遷移／対応、32不変条件、16失敗注入点、23検証接続 |
| CRDD全体Checker | 402文書、2,862リンク、970アンカー、Error 0、Warning 0、終了Code 0 |
| `git diff --check` | 終了Code 0 |

## Process境界で確認した範囲

- MCP stdioの実子Process起動、JSON Lines搬送、親EOFによる進行中要求の取消とjoinを確認した。
- Repository Binding単位のProject Operation Leaseは、別Processの同時取得で所有者がexactに一つとなり、owner終了後の回復を確認した。
- 対話要求とスケジュール要求の優先、選択後のfresh再確認、実行中Ownerがいる場合のEffect 0を確認した。
- Docker Recoveryはproductionと同じ耐久状態・実行Engineを用い、固定Docker command runnerによってexact資源削除、Host回復、完了Receipt、Project settlement後のReceipt消費、消費の冪等性、再入場時のEffect 0および改変拒否を確認した。実Docker Desktop資源を用いた再実測ではない。
- 実Windows Process Gateを長大な制限Process試験の末尾へ混在させると、OS Process終了観測が既定猶予を超える一方、同じ7件を隔離Processで実行すると成立した。既存の検証設計どおり、既定`npm test`は実資源Gateを先に実行し、その後に残る母集団を実行する。全母集団は維持し、猶予延長や失敗の除外には置き換えていない。

## 署名前監査後に残す最終E2E

署名前の固定候補監査で実装・設計・文書を収束させた後、Runtime実行Identityを固定して次を一括実測する。

1. 認証済み公開MCP ClientからProject Objectiveを受け、実Provider、独立Review、統合結果まで到達する。
2. 実Provider実行中の取消を公開入口から発行し、Task、Process、候補、QueueおよびRecoveryの終了状態を照合する。
3. 利用可能な実Docker環境ではexact Recovery IDによる資源回復と冪等再入場を確認する。Docker Desktop自体の外部障害で実行不能な場合は、決定論的production Engine試験で代替した範囲と残存不確実性をRelease判断へ明示し、成功として捏造しない。

この最終E2Eが未完了の間、Project Runtime全体、公開MCPまたはv0.19 Releaseを`Pass`と表示しない。
