# WorkbenchのFramework導入・Source再編

対象: CHG-000082／v0.22 Phase 02
成果物種別: 変更計画・移管対応
基準改訂版: `e9d047365`（2026-10-20）
状態: 対象1〜5完了。Server受付・Client画面分割・共有契約・Router／Query・全Client TSX検査を接続し、最終通常回帰78件・限定独立再レビュー指摘0
Owner: Qual-Lab

## 1. 採用範囲と変更経路

人間が提示したWorkbench Framework導入案と、その後に採用されたAfterを実装する。React＋ViteのCSRを維持し、HTTPはExpress 5、画面遷移はReact Router、Serverデータ取得はTanStack Queryへ委譲する。Frontend／Backendは同一Packageで、`client`／`server`／`shared`へ分離する。

変更分類は、既存CapabilityのFramework置換・責務再配置である。Workbench Architecture、Quality、公開API、CLI、Vite／型設定、利用側と試験・Symbol台帳を追従する。安全境界・非同期終了を含む技術独立レビューと、変更範囲の文書・不足影響確認を実施する。準拠基準、権限分担、正式採用・Releaseを変更しないため、準拠表明・Release監査は実施しない。

UX／IA・Visual再設計、機能の無断廃止、API全面刷新、SSR、MCP依存、新しいStore／Registry／Lock／Recovery Frameworkは対象外。外部AI・Docker操作・②保持物の削除は行わない。外部調査は公開Package名・版・公式仕様だけを送信する。

着手前の読取り専用確認は完了した。親が以下の補正を統合し、人間判断の追加はない。完成後の独立レビューはこの確認とは別に実施する。

## 2. 維持する契約と置換先

| 基準Capability | 新しいOwner・処置 | 維持・検証するもの |
|---|---|---|
| localhost Listener／共有TLS境界 | `server/http.ts`、`server/security.ts` | loopback、raw Header重複、Host／Origin、逆Proxy条件、拒否前Effect 0 |
| HTTP Method／Path分岐 | `server/app.ts`、`server/routes/`のExpress | 大小文字・末尾slash・HEAD・未知Method・URL／Query解釈・固定status／Header／本文 |
| Form搬送 | `server/security.ts`と操作別Route | 16KiB、形式・重複・未知field、未読／部分BodyでのEffect禁止。圧縮Bodyを暗黙に新受理しない |
| 認証・管理・初回接続 | Serverから既存Access Management | 要求ごとの認証・現在認可、資格の共有保存なし、鍵専用応答の境界 |
| Project／Portfolio／Record／原文 | `server/presentation/`と既存Domain Owner | Repository選択・現在認可・原文容量・非秘密DTO、未観測と正常空の区別 |
| Git操作・Workspace／Candidate | 操作別Routeから既存専門Package | 明示操作、期待改訂、固定と採用の分離、Merge／清掃の既存条件 |
| AI開始・観測・取消 | AI Routeから既存Orchestrator | 同じTask参照、再送なし、取消とrollbackの区別、Owner join |
| URLと画面遷移 | `client/router.tsx` | 現行URL・検索条件・戻る／進む・直接アクセス、外部リンク等の非横取り |
| データ取得・表示 | `client/api/queries.ts` | 安全なConnection API、要求世代・取消、失敗時の旧内容非表示 |
| 明示操作 | `client/api/mutations.ts`と既存Owner | retry無効、結果不明は再観測、旧主体のcallback／通知／invalidateを拒否 |
| CSS／Logo／固定JS配信 | Client styles／Server配信 | 現行Visualと配信allowlist、任意Filesystem／Directory listingなし |
| Server終了 | `server/http.ts`と既存実行Owner | Socket終了、保留要求join、AI Owner closeの確認。Listener closeだけで完成としない |

`POST /candidate/action`は旧機能の拒否入口であり、基準の`410 legacy_bundle_candidate_route_removed`を維持する。新Candidate機能として復活させない。現在のWorkspace操作は`/workspace/action`を利用する。

## 3. Source移管対応

| 現行（src相対） | Afterと方針 |
|---|---|
| `server.ts` | `server/app.ts`、`http.ts`、`security.ts`、`connection.ts`、`routes/`、`presentation/`へ実責務ごとに移管。旧巨大条件分岐へのcatch-all転送は中間状態だけ |
| `browser/entry-client.tsx` | `client/main.tsx`、`router.tsx`、API取得へ分離。独自Historyを恒久併存させない |
| `browser/app.tsx` | `client/app.tsx`と`pages/`、`components/`へ実画面・表示責務で分離 |
| `browser/connection.ts` | `client/api/connection.ts`。同Origin・redirect拒否・非永続資格・容量・接続世代・取消を維持 |
| `browser/client-model.ts` | 非秘密DTOは`shared/<責務>/types.ts`、純粋応答検査は`validation.ts`。URL生成はClientへ。丸ごと移さない |
| `browser/*panel*.tsx` | `client/components/`。既存の独立Panelを過剰統合せず、取得・操作はAPI責務へ接続 |
| `browser/shell.ts`、`components.ts`、`topic-meeting-presentation.ts` | 内容を検査しClient表示／Server表示変換／共有純粋検査へ振り分け。名前だけで移さない |
| `connection/configuration.ts` | Serverの起動構成。Browserの資格Ownerとは分離 |
| `credential/administration.ts` | Serverの接続・鍵操作受付。認証・鍵状態の実体はAMを維持 |
| `management/operations.ts` | 管理Routeが利用する既存AM接続。不要中継なら同じRouteへ統合 |
| `management/contract.ts` | 非秘密共有契約とServer受付を分け、広いcontract名を残さない |
| `project/*`、`owner-artifact/read.ts`、`activity/observe.ts` | Server表示投影・専門Owner接続。Domain解析や実行状態を新所有しない |
| `topic-meeting/*` | Record Routeの入力／Domain接続と共有応答へ分離 |
| `ai-profile/projection.ts` | AI表示投影と共有DTOへ分離 |
| `ai-request/types.ts`、`project-plan/types.ts`、`quality/types.ts` | Server専用注入契約か、実際に両側で使う共有DTOかを個別判定 |
| `index.ts`、`bin/workbench-server.ts` | 起動・有用なOwner接続だけを公開。Client内部・Express内部を機械的に全公開しない |

`shared/contract.ts`や`components/common.tsx`は新設しない。共通化の実利用がない分類・空Folder・再export専用Fileを作らない。

## 4. 状態・取消・秘密の維持条件

- Serverの`lastActionResult`、`topicMeetingResult`、`currentAiRequestId`、`aiRequestSnapshot`、`aiRequestNotice`等は、利用側と再入場の意味を確認してから変更する。Express移行だけで削除しない。
- `GET /api/workbench-view`は基準版で一部通知を消費する。最初のQuery移行ではretry／focus／reconnect等の自動実行を無条件に有効化しない。通知のOwner変更は別の実装単位で明記する。
- Bearer、鍵入力、一度だけ表示する発行・交換結果をQuery key／data、Mutation variables／data、エラー、Devtoolsへ渡さない。既存Componentの一時参照と専用通信境界を維持する。
- 資格変更・切断・対象変更・pagehideで旧要求を取消し、旧TreeとCacheを破棄する。待機後の世代照合を維持し、`clear()`だけを認証境界としない。
- 取得失敗・失効時に前のCacheを現在の許可済み表示として残さない。Router LoaderとQueryの二重取得・Cacheは作らない。
- Mutation取消・通信失敗から未処置やrollback完了を推定しない。既存Task／Operationの現在観測へ接続し、独自回復機構を追加しない。

## 5. 依存と実行順

公開npmメタデータでExpress `5.3.0`（Node >=18）、React Router `8.5.0`（Node >=22.22、React／React DOM >=19.2.7）、TanStack React Query `5.104.5`（React 18／19）、Express型 `5.0.6`を候補として確認した。既存Node >=24.12、React 19.3に対する版条件は満たす。公開型・実挙動を実装前に照合し、各導入段階でexact版とlockfileを接続する。未導入を導入済みと表示しない。

1. 基準Source・公開API・HTTP／Browser契約と試験集合を確認する。
2. HTTP入口検査・終了所有を抽出し、明示Route単位でExpressへ接続する。Domain・表示状態の意味は同時変更しない。
3. ServerのRouteと表示投影を責務ごとに分離し、旧条件分岐を撤去する。
4. React RouterへNavigationを移し、現行URLと資格lifecycleを検証する。
5. 既存APIからQueryへ接続し、次に独立したWorkspace／AI／活動等を必要な単位へ分離する。
6. Client／共有DTO・検査・命名・公開APIを整理し、旧実装と参照を撤去する。
7. 固定候補で全対象回帰・独立レビュー・是正を完了する。

一次情報: [Express 5移行](https://expressjs.com/en/guide/migrating-5/)、[React Routerのモード](https://reactrouter.com/start/modes)、[TanStack Query Client](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient)。Framework Mode／SSRを追加せず、Query以外のデータCacheを作らない。

## 6. 基準と検証集合

| 集合 | 入口・用途 | 判定上の限界 |
|---|---|---|
| Build・静的 | `npm run build`、`npm run check` | Browser動作・取消終了の証拠にはしない |
| 通常結合 | `npm test`（integration集合） | System／Browser全件を含まない |
| 公開CLI | `test:entry` | 合成Repository・起動終了。外部AIを使わない |
| Browser管理 | `test:credential-browser` | 合成資格だけ。別主体・鍵専用応答・旧表示の拒否 |
| Browser表示 | `test:visual` | 現行画面・Navigation・操作・終了。実Providerの代替ではない |
| 横断 | Consumer／命名／台帳・利用側型検査 | 旧Pathを除去し、検査を弱めない |

2026-10-20の変更前Build・整形・型・Lintは成功。通常結合の最初の制限環境実行では複数失敗とGit子ProcessのOS拒否を観測し、その実行は中断した。localhostと合成Git試験を実行できる環境では基準全72件が成功した。制限環境の中断を基準Passへ換算せず、Sourceを緩めて回避していない。外部AI試験Scriptを通常回帰へ追加しない。

過去の正式Evidenceは改変しない。現行試験・履歴は基準Capabilityの所在確認に使用し、新方式の未実施検証を成功へ流用しない。全体QA・②実AI編集E2E・Releaseの未完了は今回の局所結果と分ける。

## 7. HTTP受付の最初の移行単位 — 2026-10-20

Express `5.3.0`と型`5.0.6`をexact版で接続した。`server/http.ts`がExpress構成・要求専用取消・Socketと保留要求joinを所有し、`server/security.ts`が既存Security Headerと16KiB Form読取りを所有する。Root公開APIは増やさず、既存の`startWorkbench`とHandleを維持した。上位のAI Owner closeとその失敗観測は移動していない。

既に外側がawaitしている管理・鍵処理の内側Promiseを同じ集合へ二重登録する処理だけを除去した。内側のawait・監視解除は維持し、独立確認でも待機漏れは検出しなかった。新しいRegistry・Lock・状態保存・Recoveryは追加していない。

この段階のExpress受付は旧Route処理を同じHandlerへ接続している。旧巨大分岐を解消したとは扱わない。次は要求共通検査と操作別Route／表示投影を分離し、明示Express Routeへ接続する。React Router、TanStack Query、Client／共有契約の本分割、最終Browser回帰は未実施。

| 確認 | 結果・限界 |
|---|---|
| 基準・変更後の通常結合 | 基準72件、変更後73件すべて成功。変更後251,323.7726ms。外部AI・実Dockerを使わない |
| Build・整形・型・Lint | 成功。Browser Bundleは現行と同一で、Client移行の成功は主張しない |
| HTTP局所反証 | TLS拒否・Git試験Worker終了・Allowlist・Express Path／Method／HEADの4試験成功 |
| 公開CLI | 8件成功。合成Hostと子Process・localhostだけを使用 |
| Header・公開入口・QA接続 | 既存Checker 3試験成功。検査条件を緩めていない |
| 独立レビュー | 処理上の追加不具合0。失敗応答に関するHeader誤記1件を本文変更なしで訂正し、再レビュー追加0。独立の既存HTTP 3試験と、同期throw／取消後joinの反証も成功 |
| 清掃と残存 | 試験が所有する生成領域は既存finallyで回収。既存の旧試験領域・②保持物は未操作。今回の検証結果は計画内へ要約し、実行ごとの巨大Evidence書庫を作らない |

人間による追加判断は現在不要。今回の単位はWorkbench全体のFramework移行完了、正式QA Pass、UAT、実Provider、Releaseの成立ではない。

## 8. 管理・鍵・WorkspaceのRoute分割単位 — 2026-10-20

最初のHTTP受付単位を基準に、実処理を先に抽出して旧分岐で比較し、その後に移管済み分岐だけを明示Express Routeへ接続した。この単位は是正後の回帰・独立レビューを完了したが、全Route移管の完了ではない。

| 現行Owner | 処置・保持条件 |
|---|---|
| `server/app.ts` | Express構成・管理GET／POST・Workspace POST・鍵POST。公開Origin前段の後で解析済みURLを絶対URL形式で保持し、Pathの再解釈を防ぐ。管理HEADは先にfallbackへ登録。未知Path／Methodと未移管操作は既存fallbackを維持 |
| `server/security.ts` | 生Headerの公開Origin検査を追加抽出。Expressへ入る前に検査する。不正OriginはURL解析・AMより先に421、不正URLはappで固定500 |
| `server/http.ts` | Node Listener・要求別Handler接続・取消・Socket／保留要求join。Express構成をappへ移し、前段と個別処理の待機を一回だけ追跡 |
| `server/routes/management.ts` | 通常管理の入力・Owner呼出し・有界応答・取消join。権限判断と保存は既存AM接続が維持 |
| `server/routes/workspace.ts` | Workspaceの閉Form、対象manifest／Root・fresh認可、配送と公開前照合。未知結果を再送しない |
| `server/connection.ts` | 接続専用確認を通常認証前に維持し、鍵処理は専用応答へ接続。出版・提示・交換終了と失敗のOwnerは既存資格処理のまま |
| `server/presentation/portfolio.ts` | 既存検索・状態絞込み・20件上限と条件結合Cursor。不正Cursorを先頭成功へ補完しない |
| `server/presentation/record.ts` | 当該Pageの注入Readerによる本文／Relation取得と操作結果の非秘密縮小。読取りを純粋計算とは表示しない |
| `topic-meeting/action.ts` | 既に存在した操作結果の合成型を操作Ownerへ移管。新しい通信・保存契約やRoot公開APIは増やさない |

共通前段は従来順序を保持し、前段で応答した場合は明示的なundefinedで終了、個別処理へ継続する場合だけ要求内の値を渡す。この局所Contextを永続化・共有・cacheせず、各操作の実処理を待つ。Repository・Record・AI・表示の残存分岐、Client／共有契約、Router／Query、最終Browser回帰は未完了。

独立レビューで二回目のURL解析による二重slash Pathのauthority化を検出した。解析後の`href`を渡す最小修正と、前段待機後の取消・切断確認を一括是正した。是正前の全回帰74件成功、CLI8件成功、選択Browserケース4件成功は旧候補の結果として分離した。

着手前確認で、Express文字列照合と従来URL解釈の差を指摘した。新しいURL制限や互換経路を追加せず、既存の正規化結果で照合する方針へ統合した。抽出だけの候補では鍵失敗を含む11件、最初の明示接続では13件、URL前段をExpressより前へ確定した候補ではraw URL・HEAD・Origin組合せの3件が成功した。これらは段階比較の要約であり最終回帰の代替ではない。

修正版の最初の全回帰は73／74件成功で、応答成功件数を数える試験が相対URLの文字列形式へ依存していた。保存・HTTP200自体は成立していたが、観測0を成功へ補完せず、関連3箇所を解析後のpathname＋searchの完全一致へ追従した。対象Path・Method・status・本文条件・期待件数・故障注入・取消joinは維持した。

| 修正版の最終確認 | 結果・限界 |
|---|---|
| 通常結合・Build・整形・型・Lint | 74件すべて成功、234,267.8639ms。外部AI・実Dockerを使わない |
| 管理の局所再確認 | 2件成功。実保存、保存後失効／失敗、取消・終了の既存反証を維持 |
| 公開CLI | 8件成功。自己生成Repositoryとlocalhostの起動・終了 |
| Browser | `git-operations`選択ケースの4件成功。Workspace操作・Git・結果不明時の再送抑止。Browser集合全件の成立ではない |
| 公開Origin・URL反証 | Origin全3件、URL／HEAD等の局所3件成功。二重slashの正常入口化を拒否 |
| Header・公開入口・QA接続 | 既存Checker3件成功。公開APIや検査条件を拡張・緩和しない |
| 独立確認 | URL・取消の是正後追加0、試験観測追従も追加0。URL／Origin境界3件の独立実行も成功 |
| 清掃・残存 | 今回の試験領域は既存finallyで回収。以前からある旧試験領域と②保持物は未操作 |

次はRepository・Record・AI・表示の残存Routeを分割し、その後Client／共有契約・React Router／TanStack Queryへ進む。新しい保存状態・Registry・Lock・回復機構は追加していない。現在、人間による追加判断は不要。全移行完了・正式QA Pass・実Provider・Releaseは主張しない。

## 9. Repository・Record・AIの受付分離 — 2026-10-20

前単位の通常結合74件成功を基準とする。非自明な実装Refactorとして、Architecture・QA接続・Symbol・既知HTTP／Browser／CLI利用側を追従し、技術品質の独立確認と文書の直接伝播確認を行う。規範・準拠基準・Releaseは変更しないため、それらの監査は追加しない。外部AI・Docker・②保持物は対象外である。

親と読取り専用確認者の着手前照合では、既存表示変数の参照置換、Route本文抽出、明示登録、旧分岐撤去の順とした。表示用objectは起動Compositionが引き続き所有し、非永続の投影・直前結果だけを保持する。資格、認可結果、Task／Workspace正本、Owner、共有AI Sessionは混ぜず、Store・Reducer・汎用更新APIは新設しない。各Handlerには必要なfieldだけを型で渡し、同じ参照を維持する。入口でclone・値のdestructureをせず、await後の読取り時点、保存後の投影再取得、失敗時unknown化、GETの通知消費と更新順を変えない。

単体と共有のFormは受理集合が違うため、同居しても機械的に一本化しない。共有AIは通常認証後の同じ位置で一回だけ実行し、単体AIの表示状態と混ぜない。href搬送、待機後guard、配送前拒否／配送後不明、取消とOwner joinを維持する。正常・保存後故障・取消・再取得失敗・通知消費を既存結合試験で比較する。新しい人間判断は現時点で不要である。

### 移管結果と公開境界

```text
src/server/
├ app.ts                     明示Routeの登録と既存URL解釈
├ http.ts                    要求取消・Socket／保留要求の終了
├ connection.ts              初回接続・一度だけの鍵応答
├ security.ts                公開Origin・保護Header・有界Form
├ routes/
│  ├ repository.ts           単体／共有Git操作と表示更新
│  ├ record.ts               単体／共有Record保存・昇格・Outcome処置
│  ├ ai.ts                   Profile管理・AI開始／観測／取消のHTTP接続
│  ├ workspace.ts            Workspaceの明示操作
│  └ management.ts           通常管理の読取り・保存
└ presentation/
   ├ types.ts                起動中だけ共有する既存表示値の型
   ├ portfolio.ts            検索・20件ページ・条件結合Cursor
   └ record.ts               原文Reader接続・結果縮小
```

`POST /repository/action`、`/topic-meeting/action`、`/ai-profiles/action`、`/ai-request/action`を明示登録した。共有AI依頼と共有Profile読取りは既存前段位置から専用関数を呼ぶ。起動Compositionには同じ資格／RepositoryごとのSessionとOwner終了を残す。表示GETと静的配信の既存分岐はまだ`server.ts`にあり、全HTTP構造移行完了とはしない。

単体Repository Formの既存変換を`project/repository-action.ts`の`createStandaloneRepositoryActionRequest`へ移した。共有Formの閉検査へ置換していない。Profile Form変換はHTTPの実OwnerであるAI Routeへ移し、AI AdapterへForm依存を加えていない。`src/index.ts`のPackage公開API、`bin/workbench-server.ts`の起動引数、通信・永続Schemaは変更していない。新しい関数はServer内部の実接続だけに使う。

### 検証結果と限界

| 確認 | 結果・限界 |
|---|---|
| 表示参照だけの段階比較 | Git・Topic・AIの既存5件成功 |
| 本文抽出・明示登録後の局所確認 | 既存8件成功。URL・二重slash・末尾slash・配送前拒否の追加反証2件も成功 |
| 全通常結合 | 74件すべて成功、288,187.1722ms。外部AI・実Dockerを使わない |
| Browser既存全集合 | 14件成功、302,394.01ms。11操作modeと補助・親試験を含み、専用Chrome・合成資格／Repositoryだけを使用 |
| 公開CLI | 8件成功、21,253.0558ms。正常起動・拒否・終了を確認 |
| Build・整形・型・Lint | 成功。既存Client Bundleは同一で、Client移行を実施済みとはしない |
| Header・Package公開・QA接続 | 既存Checker3件成功。新4FileのSymbolと既存Consumerの検証接続を追従 |
| 独立確認 | 処理上の不具合なし。fallback責務と接続形態別の前提を説明するHeader2種類を訂正し、限定再レビュー追加0。独立の既存3結合試験も成功 |
| 清掃・保持 | 今回の自己生成領域は既存finallyで回収。過去の旧領域・②保持物は未操作 |

Header訂正は4Fileの説明だけに限定し、訂正前後でJSDoc以外の内容が完全一致することを確認した。処理・入力条件・期待値・終了保証を変えていないため、同一実装の回帰結果を適用し、Header・静的確認と再レビューで訂正を確認する。正式QA評価・実Provider・Releaseは今回の結果へ含めない。次は表示GET・静的配信・起動構成の残存分岐を整理し、その後Client／共有契約・Router／Queryへ進む。

## 10. 表示投影・固定配信・起動Ownerの配置 — 2026-10-20

前単位の74結合・14Browser・8CLI成功を基準に、表示helper、固定Document／CSS／Asset Path、起動Ownerを実責務へ移す。非自明な実装Refactorとして技術品質の独立確認・文書の直接伝播確認を維持し、準拠基準・Releaseは変更しない。新しい人間判断は不要。外部AI・Docker・②保持物は対象外である。

着手前照合では、Record検索を既存presentation/recordへ、本文選択Queryと主画面Modelをpresentation/projectへ、固定配信を一つのFileへ置く。主画面ModelはRecord Readerと資格管理Readerを順番に呼ぶため純粋変換と扱わず、事前取得・認可Cacheへ変更しない。固定配信に任意Path受付・module初期化のI/O・汎用Routerを追加せず、共有と単体のhealth形状差はそのまま残す。

起動本体・起動型はserver/startへ移し、Root indexから直接公開する。旧server.tsへの互換転送は残さない。import相対Pathと配布JSのimport.meta.dirname基準を補正するが、RepositoryロゴのRoot・読取り順を変えない。VCの本番Consumer閉包試験、Symbol・型・Headerを追従する。GET本文編成そのものとClient／Router／Queryは別の残存単位であり、この物理整理だけで完了とはしない。

### 現在の配置と比較結果

| 現行Owner | 実責務と保持条件 |
|---|---|
| `server/start.ts` | 起動構成・既存OwnerとRouteの接続、残存GET編成、終了。Root公開Symbol・CLI引数は不変 |
| `server/presentation/project.ts` | 本文選択Query、資格管理投影、主画面Model。Record→資格Readerの観測順を維持 |
| `server/presentation/record.ts` | 従来の本文／Relation・結果投影に、既存のRecord検索条件変換を同居 |
| `server/presentation/types.ts` | 既存の表示状態に加え、主画面と起動が使う接続表示型を共有。認可Authorityではない |
| `server/assets.ts` | 固定HTML・CSS・公開Pathと三Pathだけのメモリ内選択。health・任意静的Rootは扱わない |

親の機械比較で表示4関数の引数・返却型と本文、CSS全文が移管前と一致した。独立確認でもHEAD旧実装に対する4関数とCSS7宣言の計11宣言が完全一致した。Readerの先行実行や呼出し順変更はない。

局所5件、VC利用側閉包12件、公開CLI8件、Browserの`artifact-navigation`選択ケース4件、Header／公開／QA接続3件は成功した。VC期待集合では前単位のWorkspace・Repository受付への追従漏れも実importと照合して修正し、探索母集団を減らしていない。独立レビュー指摘0、固定配信・Listener終了・raw URLの独立3件も成功した。

最初の全結合は73／74件成功で、Node依存閉包試験の到達必須Pathが旧server.tsを指していた。期待をserver/start.tsへ追従し、Graph探索・React／MCP拒否・Bundle比較を変えず、該当Suite3件が成功した。整形時のWindows mapped-section拒否は書込み方法の制約として分離し、Formatterの期待差分だけを適用して通常の整形・型・Lint検査を通した。

| 最終確認 | 結果・限界 |
|---|---|
| 全通常結合 | 74件すべて成功、218,928.6873ms。実AI・Dockerは使用しない |
| 公開CLI | 8件成功、18,120.8393ms。移動後のdist読取りと起動・終了を確認 |
| Browser | 原文表示・遷移の選択ケース4件成功、26,770.5889ms。前単位の全14件を今回の新しい結果へ流用しない |
| 利用側閉包 | VC12件、Node依存閉包3件、Header／公開入口／QA接続3件成功。探索と拒否条件は維持 |
| Build・整形・型・Lint | 成功。Client Bundleは不変でありClient移行の成立ではない |
| 独立確認 | 指摘0。4関数とCSS7宣言の独立比較、固定配信・終了・raw URLの独立3件成功。最後の期待Path追従も限定確認0件 |
| 清掃・保持 | 今回の自己生成領域は既存finallyで回収。過去の旧領域と②保持物は未操作 |

この配置単位は完了した。GET読取り・認可・通知消費の本編成はstartに残っており、次はその受付を分割する。Client／共有契約・React Router／TanStack Query、正式QA・実Provider・Releaseは未完了。現在、人間による追加判断は不要である。

## 11. 単体・共有GET受付の本分割

前単位の通常結合74件成功を基準に、非自明な実装Refactorとして既存GET本文を単体表示と共有表示へ移す。技術品質の独立確認・文書の直接伝播確認を行い、準拠基準・Releaseは変更しない。外部AI・Docker・②保持物は対象外である。

親と読取り専用確認者の照合により、共有表示は応答済み／取消・切断終了だけtrue、未知Pathで未処理の場合だけfalseとし、元の共有Action Allowlist→403へ戻す。単体未知GETは404、非GETは405、旧Candidate POSTは410を維持する。Artifact Query・通常認証・Catalog GETは同じ前段位置に残す。管理HEADの先行fallbackを維持する。

共有のPortfolio→資格表示→選択Repository→活動・Profile観測→公開前再認可、単体の既存Owner観測とGET通知消費を移動で変えない。設定は同じ参照を渡し、await前に分解・複製しない。runtimeActivityObservationだけを既存表示objectへ同じ寿命で移し、資格・認可状態・Ownerを表示objectへ混ぜない。新しいStore・Registry・Lock・回復機構は追加しない。起動・Session・closeはstartに維持し、Routeから起動実装へ逆依存しない。現在、人間による追加判断は不要である。

### 実装と照合

`server/routes/repository-view.ts`と`shared-view.ts`へ元の本文を移し、`server/app.ts`に既知の表示GET／HEADを明示登録した。起動側は同じOwner・設定・表示参照の接続と固定拒否を持ち、表示本文を重複実装しない。内部受付だけの変更で、Root公開API・CLI・通信／保存Schemaは変更しない。

抽出前後の両本文は、承認済みの状態参照・設定名・共有の処理済みreturn変換と整形差だけを正規化して一致を確認した。独立レビューは処理上の指摘0で、設計書に残った旧GET未移管表示1件を訂正した。過去の§10結果と正式Evidenceは変更しない。

### 確認結果（2026-10-20）

| 確認範囲 | 今回の結果 |
|---|---|
| 通常結合 | 74／74成功、249,120.7492ms |
| 全Browser | 11操作ケースを含む14／14成功、253,133.0595ms |
| 公開CLI | 8／8成功、22,441.6269ms |
| 利用側 | Version Control閉包12／12、Node依存閉包3／3成功 |
| 静的・直接QA | Build・整形・型・Lint成功。Header／公開入口／試験QA接続3／3成功 |
| 独立確認 | 処理上の指摘0。raw URL・未知Route／終了・活動表示の独立3結合も成功。設計書の残件表示1件を訂正 |

実AI・Dockerは使用せず、②保持物・過去の自己生成領域は操作しない。今回の試験物は既存finallyで清掃する。巨大な実行別Evidence書庫は追加せず、既存試験コマンドで再生成できる結果要約を保持する。このGET受付単位は確認済みであり、Client／共有契約・React Router／TanStack Query、正式QA・実Provider・Releaseは未完了である。現在、人間による追加判断は不要である。

## 12. Client配置と共有表示契約の分離

既存の配置移管として、Browser入口をclient/main.tsx、接続をclient/api/connection.ts、表示部品をclient/components、表示本体をclient/app.tsxへ移す。client-modelの表示DTOはshared/view/types.ts、純粋検査はvalidation.ts、選択URL生成はclient/api/view.tsへ分離する。純粋Portfolio検査とprivate helperは共有検査へ同居させ、旧project/portfolio-result.tsと旧Browser転送を残さない。小さな表示要素3つはcomponents/elements.tsとし、一律細分化しない。

親と読取り専用確認者の着手前照合は完了し、追加人間判断は不要。各宣言本文・受理条件・同Origin通信・接続世代・取消・React Root・pagehide／pageshowの意味を維持する。既知正常、不正応答、選択違い、取消後の旧応答を元契約へ照合し、条件追加・緩和は行わない。今回はRouter／Queryや新依存を導入しない。型は既存Domain正本を参照し、複製しない。

Vite・相対import・Symbol・試験とNode依存探索を追従する。探索・React／MCP拒否・Bundle検査は維持する。配置がclient/server/sharedのさらに下へ分かれる理由は、同じPackageのBrowser Build・Node Runtime・純粋共有契約を分離し、それぞれAPI・表示・HTTP受付の実利用と試験境界を識別するためである。空Folder・再export集約・新状態管理は追加しない。Architecture・Quality直接伝播、静的確認・全結合・全Browser・CLI・利用側回帰と独立レビューを行う。規範・準拠・Releaseは変えず、外部AI・Docker・②保持物は対象外。

### 確認結果（2026-10-20）

13移動Fileのimport・JSDoc・整形差を除いた本文と、旧Model／Portfolioの宣言全数の計41項目を比較し、差分0だった。Node依存検査はclient全体・TSX・React・MCPの実行時混入拒否を維持する。初回の機械的import編集で3試験の後続本文を巻き込んだため、元本文を復元してimportだけ追従し、試験削減がないことを独立に確認した。生成Bundleは宣言順変化を伴うため既存追跡物を正式Buildへ同期し、Git Index一致検査を維持した。

| 確認範囲 | 今回の結果 |
|---|---|
| 通常結合 | 74／74成功、248,764.581ms |
| 全Browser | 11操作ケースを含む14／14成功、263,335.5294ms |
| 公開CLI | 8／8成功、21,205.7727ms |
| 利用側・静的 | VC閉包12／12、Header／公開／QA接続3／3、Build・整形・型・Lint成功。Node閉包3件は全結合内でも成功 |
| 独立確認 | 処理指摘0。独立11試験成功。台帳重複と旧Path表記の2指摘を是正し、再確認残指摘0 |

旧browserのFileと空Directory、旧Portfolio検査Fileは撤去した。今回の自己生成試験物は既存finallyで回収し、以前の旧領域・②保持物は操作しない。実AI・Dockerは使用しない。Root公開API・CLI・通信／保存Schemaは不変。Client配置・共有表示契約の分離だけを確認済みとし、appの画面分割・残る共有契約の評価・React Router／TanStack Query・正式QA・実Provider・Releaseは未完了である。現在、人間による追加判断は不要である。

## 13. React Router置換

公開版React Router 8.5.0をexact固定し、Node >=22.22.0と現在Node 24.19.0の互換条件を確認した。依存取得時Scriptは実行しない。公式Routing資料と採用版のcreateMemoryRouterを用いた合成一回の失敗確認では、loaderは一回呼ばれ、エラーを持つ状態でもlocationは遷移先/targetとなった。Repository情報・資格・外部AIは使用せず、試験物Fileも作らない。

着手前のmainはリンク／GET検索の取得・検査成功後だけ履歴を追加し、失敗時は旧URLのまま固定blocked表示だった。POPはBrowserが先にURLを変える。読み取り専用確認者と親は、この差を配置変更の一部として無断採用しないことで一致し、当初は人間の判断待ちとした。後述の人間判断後に本番接続を実装した。旧URLを復元する独自History制御は追加しない。

採用後の候補は既知7PathのcreateBrowserRouter／RouterProvider、既存通信へRouter Signalを渡す一回の読取り、pending時の旧Tree非表示、固定error表示とする。DOM adapterは既存リンク／GET検索の対象判定とRepository選択補正だけを行い、独自pushState／popstate／Navigation世代を撤去する。pagehideはRouter破棄に加えてRoot・監視・資格を解放し、persisted復帰は新Routerでfresh取得する。同一URL・POP・hash移動の呼出し回数と失敗・取消・終了を実Browserで確認する。Query導入時の二重取得・独自Cacheは作らず、既存取得をQueryの単一呼出しへ置換する。

### 人間判断と実装境界

人間は後者、すなわち「リンク／GET検索の取得失敗時も遷移先URLで固定エラーを表示し、旧Treeは表示しない」を承認した。旧URLへ戻す独自History制御は追加しない。直前の着手前確認に挙げた同一URL・POP・hash・取消・終了の条件を維持して実装へ進む。現在、人間による追加判断は不要である。

### 本番接続と独立確認後の是正

client/router.tsxの既知7PathとRouterProviderへ接続し、mainの独自pushState・popstate監視・Navigation世代／Controllerを撤去した。リンク／GET Formの判定と選択補正は薄い配送だけを維持する。表示取得はapi/viewへ同じ宣言本文を移し、Router Signalで一回呼ぶ。共通親はpending時にOutletを外し、useTransitions=false、通常navigateはflushSyncを指定する。pagehideはdispose・Root破棄・資格解放・所有監視解除、persisted復帰は新Router／Rootとする。通信の接続世代は維持する。

独立確認の3指摘は、hash-onlyと画面寿命の結合、TSXの継続検査接続、旧現在投影の訂正へ整理した。未送信入力保持の追加反証は是正前にも成功し、入力消失の実測不具合とは扱わない。履歴Entry keyへの依存を避ける最小是正として、画面keyをpathname＋searchへ限定した。通常／同一URL取得はpendingで再生成し、hash-onlyは入力と取得0を維持する。

Root Biomeの既存設定がTSXを対象外としていたため、今回変更したmain／routerの2Fileをfiles.includesとformatter.includesへ明示接続した。既存ルールを維持し、通常checkの65Fileで整形・型・Lint成功。接続によって見つかったnon-null assertion 5箇所と不要なHook依存1件は、検証済みRootの別名と不要依存の除去で是正した。一時確認設定は回収済みで、それを継続検査の代替にしない。他の既存TSXの通常check接続は残件であり、全TSX確認済みとは表示しない。

是正前候補の全通常結合74／74（264,918.2481ms）、全Browser14／14（274,853.0627ms）、CLI8／8（21,827.3594ms）、VC12／12、Header／公開／QA接続3／3は成功。最終是正はClientと検査接続に限定し、Node閉包・Bundle3／3と通常checkを再実行して成功した。最終全Browserは12成功／2失敗（親Suiteとlocal-connectionの実1ケース、Node全実行259,306.7373ms、親Suite258,617.8916ms）だった。local-connectionは7,237.4393msで固定のBrowser評価失敗になったが、当時の診断では地点・原因を確定できなかった。失敗をPassへ置換しない。独立確認の別プローブは終了確認例外で一次結果が未確定となったため根拠に採用せず、追加再試行なしに自己生成Process・Rootの不存在まで確認した。②保持物・旧領域は不変更である。

### 残るBrowser評価失敗の扱い

製品コードを追加変更せず、既存試験の初回準備・Local再読込に固定地点名を付け、TypeError／ReferenceError／SyntaxErrorだけを固定suffixへ分類した。未知classNameや自由なdescription、資格を出力せず、context置換の既存分類を優先する。同じ合成WebSocketのUnitへ既知3分類・未知秘密風className・context置換優先の反証を追加し、1／1成功（1,149.1519ms）。通常check65Fileも成功。成功条件、submit・reload回数、書込み、自動再試行は変更しない。

診断付きlocal-connectionの局所確認は4／4成功（26,790.2843ms）したが、先の失敗は再現せず原因未確定である。最終全Browserの失敗をこの局所成功で上書きせず、全Framework完了・最終Browser Gateは未完了とする。次の同範囲確認で再発した場合は追加した地点と固定分類から切り分ける。総当たりのBrowser／E2E反復やRuntime回復の増築は行わない。実装・検査接続・Headerの独立是正は確認済みで、診断Unit追従も限定独立再確認を完了し、残指摘0である。今回の自己生成領域は既存終了処理で回収し、旧5領域・②保持物は不変更。

### 診断付き全Browser回帰の追加確認

製品Sourceと試験操作を変えず、診断付き全Browser集合を一度実行した。14／14成功（Node全実行266,580.6784ms、親Suite265,937.7608ms）で、local-connectionは24,710.2788msだった。通常check65Fileと差分検査も成功した。各Caseの終了処理は所有Browser Process・両Listener・自己生成Directoryの不存在を確認した。今回の成功は現在候補の回帰結果であり、先行失敗の原因解消を意味しない。

独立した読取り確認では、試験のPage.reload完了が要求応答までで、新Documentの生成完了を直接観測していない点を確認した。次のDOM待機が旧Contextで始まる可能性はあるが、先行のgeneric評価失敗との因果は未証明である。submitを含む評価の再実行、固定待機の延長、製品の回復機構追加は行わない。原因未確定の事項を保持して次のQuery接続・画面分割へ進み、全Frameworkの最終回帰と完成判断は別途行う。外部AI・Docker・旧5領域・②保持物は操作していない。

## 14. Query・画面分割・共有配置と通常検査

利用者は残件1〜5の一括実施を承認した。着手前に、常時fresh、自動再送・offline保留なし、Router／Query両Signal、資格切替時の旧取得非共有、取得Owner一本化を読取り専用確認と照合した。接続・鍵POSTは専用直通を維持し、全Client TSXを既存Biomeへ接続する。表の位置keyは重複を許す状態なしtextだけの局所根拠とし、検査ルール全体を弱めない。

### 現在の配置と公開境界

```text
src/
├ index.ts                         既存の起動・Reader・注入型だけを公開
├ client/
│  ├ main.tsx                      Document／React Rootの寿命
│  ├ router.tsx                    標準RouterとLoader
│  ├ app.tsx                       検査済みviewの画面選択
│  ├ pages/
│  │  ├ overview.tsx               概要と操作Panelの編成
│  │  ├ access.tsx                 接続・管理
│  │  ├ project.tsx                Project Context詳細
│  │  ├ record.tsx                 Topic／MTG詳細
│  │  └ artifact.tsx               成果物原文
│  ├ api/
│  │  ├ connection.ts             資格memory・同Origin・世代・容量
│  │  ├ queries.ts                明示読取りのQuery接続
│  │  ├ mutations.ts              非鍵六POSTの一回実行
│  │  ├ view.ts                   選択URL・表示取得検査
│  │  └ record.ts                 Record Form／応答検査
│  └ components/                  実際の表示・操作Panel（barrelなし）
├ server/
│  ├ app.ts／http.ts／security.ts  HTTP受付・join・境界
│  ├ start.ts／assets.ts／connection.ts
│  ├ routes/／presentation/       操作配送／表示変換
│  └ 各責務Folder                 活動・Profile・注入契約・管理・内容読取り
└ shared/
   ├ view/types.ts                既存Canonical型を参照する表示DTO
   ├ view/validation.ts           非秘密JSONの純粋検査
   ├ management/validation.ts     非鍵管理の型・純粋応答検査
   └ repository/validation.ts     Git操作Form・結果の純粋検査
```

Package公開APIとbinのコマンド・引数は変更しない。Rootの接続先をserver配下へ追従し、内部Query・画面部品をRootへ追加公開しない。純粋共有型が参照する専門Ownerの型はtype importに限定し、Modelを別定義して第二正本にしない。旧server補助15Fileを新Ownerへ移し、利用側閉包・公開allowlist・Symbolを追従する。過去Evidenceを改名しない。

全TSX検査への接続で、型専用・未使用import、Buttonのnative submit／button種別、null絞込み、Hook再取得関数の安定した依存を是正する。Record／RepositoryのOwner再生成は既存Repository IDとAction Tokenを用いる。既存非秘密Modelが保証する非空Tokenの前提を読み取る。全Packageのルールを無効化せず、今回のClient全数を通常checkへ接続する。

依存監査では既存dev推移依存source-map-js 1.2.1の高重要度DoS指摘を検出した。基準Commitのlockにも同版があり、今回追加したQueryの直接依存ではない。同じ依存だけを1.2.2へ更新し、監査の指摘は0件となった。全依存の一括更新や実行可能なProvider・認証・Dockerへの拡張は行っていない。

全89Fileの整形・型・Lint、Query／Repository検査／Node・Browser依存閉包の局所9件、利用側閉包12件、Orchestrator公開Owner4件、CLI8件、Header／公開／QA接続3件が成功した。全Browser15件、Visual 1件（27条件・15画面対象）、最終配置後の対象Browser5件も成功した。最終通常回帰は78／78成功（229,074.3815ms、失敗・取消・skip・todo 0）。差分空白検査成功、今回のWorkbench自己生成試験Root残存0。限定独立再レビューは文書3箇所の是正後も残指摘0で、対象1〜5を完了とする。これは正式QA全体・実AI・実Hostの人間確認・Releaseの成立ではない。

独立レビューで、同用途Queryの取消共有とRecord削除後の手動History更新を是正した。要求ごとにQueryを分離し、削除後はRouterの一回取得へ通知を引き渡す。残った旧画面分岐も撤去した。新しい永続State・Registry・Lockは追加していない。

先行Browser失敗は再発時の診断でPage.reloadの応答境界まで特定した。試験は一回のreload後に新Documentと入力欄の準備を読取り確認し、末尾の重複reloadを除去した。Context交換時に再実行するのは読取りだけで、submitやreloadを再送しない。以後の全Browserと対象試験は成功したが、CDP内部の故障原因と重複reloadとの因果まで証明したとは扱わない。実AI・実Hostの人間操作確認、UX／IA再設計、Release判定は今回の完了範囲外とする。②保持物・旧5領域・Dockerは操作していない。
