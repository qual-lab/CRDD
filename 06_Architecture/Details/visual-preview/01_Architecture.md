# Visual Preview Architecture

成果物種別: Architecture詳細設計
詳細設計領域: visual-preview
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000003](../../Definitions/ARCH-000003/architecture_definition.md) | UIのVisual成果物を実Browserで確認できるよう、Repository内の許可Rootをlocalhostへ読取り専用で配信し、専用Browser Profileで実Zoomを決定論的に観測する。 | Covered |

本領域はPreview用HTTP境界と、固定されたVisual品質条件を実Browserで機械観測する境界を所有する。Visual Directionの採否、人間による審美判断、Evidenceの正本保存、一般用途のWeb HostingおよびRemote共有は所有しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 公開入口、Root検証、HTTP配信およびListener Ownerを分ける。 | [§2](#2-component) |
| Interface Model | Required | CLI入力、HTTP Request、Healthおよび終了操作を固定する。 | [§3](#3-interface) |
| Data Flow | Required | Repository FileからBrowser Responseまでを一方向に限定する。 | [§4](#4-flow) |
| State Model | Required | stopped、ready、closing、closedを区別する。 | [§5](#5-lifecycle) |
| Sequence | Required | Root検証後にだけBindし、closeで全Connectionを終了する。 | [§5](#5-lifecycle) |
| Failure／Recovery | Required | 入力不正、Path拒否、Bind失敗および読取り失敗を安全に閉じる。 | [§7](#7-失敗と終了後条件) |
| Deployment | Required | 独立Packageと薄い配布CLIとして配置する。 | [§2](#2-component) |
| Observability | Required | ready／closed／blockedとlocalhost URLだけを構造化表示する。 | [§3](#3-interface) |
| Security Boundary | Required | loopback、許可Root、通常File、GET／HEADだけに限定する。 | [§6](#6-security-boundary) |
| Implementation Structure | Required | Root検証、Request処理およびListener Lifecycleを局所責務へ分ける。 | [§8](#8-implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Request間で可変業務状態を共有せず、Connection集合だけをclose時の資源回収に用いる。 | [§5](#5-lifecycle) |
| Timing | PASS | 長時間処理やRetryを所有せず、Browser確認中は明示終了までListenerを維持する。 | [§5](#5-lifecycle) |
| Resource Lifecycle | PASS | Listenerと受理済みConnectionを開始Handleが所有し、closeで終了する。 | [§5](#5-lifecycle) |
| External Boundary | PASS | Repository Filesystemとlocalhost HTTPを直接境界として分離する。 | [§4](#4-flow) |
| Failure／Recovery | PASS | Root不正はNetwork Effect 0、Request不正は情報非開示の404／405へ閉じる。 | [§7](#7-失敗と終了後条件) |
| State／Consistency | PASS | Bind完了前にreadyを返さず、close完了後にclosedを返す。 | [§5](#5-lifecycle) |
| Observability | PASS | 絶対Pathを出さず、公開契約、状態、URL、read-onlyだけを返す。 | [§3](#3-interface) |
| Security／Trust | PASS | 127.0.0.1固定で、Symbolic Link、Path越境、Directory一覧、書込み、CORSを拒否する。 | [§6](#6-security-boundary) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

`PASS`は設計上の処置が揃ったことを意味し、実装・試験の成立はQualityとReality Auditで別に確認する。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `visual-preview.local-read-only-preview` | Boundary／Resource Lifecycle | Repository内Visual Root→localhost Listener→Browser相当Consumer | Linkでない許可Rootの通常FileだけをGET／HEADで返す | 外部Bind、Path越境、Link追跡、Directory一覧、書込みMethod受理、close後Listener残存 | IT | Direct Boundary | Status、Header、本文、拒否理由、Health、close後Connection | Listener 0、Connection 0、Repository書込み0 | 実BrowserのZoom／Breakpoint評価はUI Visual Gateで確認 |
| `visual-preview.browser-lifecycle-observation` | Boundary／Resource Lifecycle | localhost Listener／所有Browser Process→終了後観測 | Listenerの存在・不存在・観測不能と、Browserの正常終了・SIGTERM・SIGKILL・観測不能を分離する | 応答停止やtimeoutを不存在へ畳む、正常終了待機前のSignal、強制終了を正常終了と表示する | IT | Direct Boundary | TCP接続結果、Process終了Event、送信Signal、終了経路 | 接続拒否だけを不存在とし、実際の終了経路を一意に返す。観測不能をPassにしない | 実Browser全体の表示品質と資源0はSystem/E2Eで確認 |
| `visual-preview.actual-browser-zoom` | Boundary／Visual Verification／Resource Lifecycle | localhost Preview→専用Chrome Profile→Rendered DOM観測 | 指定した全画面・全倍率で実Zoomと画像読込を観測し、横Overflow、文字下限、操作対象およびFocus順を評価する | CSS狭幅の代替利用、倍率未反映、画像404、部分画面だけの確認、通常Profile利用、一時Profile・Process Tree・DevTools・Listener残存、timeoutを不存在へ畳む誤判定 | ST | System/E2E | DPR、実効Viewport、Scroll幅、Computed Font Size、操作対象寸法、`tabindex`、画像数・読込成功・失敗、正常終了受理、実終了経路、強制終了Fallback、Process Tree、DevTools、Profile、Preview Listener | Browser Process Tree 0、DevTools Listener 0、専用Profile 0、Preview Listener 0、Repository書込み0。Listenerは接続拒否だけを不存在とし、timeoutまたは分類不能は観測不能としてPassにしない | N/A: 固定Visual Gateを機械観測できる。審美判断はHuman Authorityが所有する |

## 現行実装との照合

Canonical詳細設計を固定した後、`40_Develop/visual-preview`、薄い配布入口、局所ITおよび実Browser利用をReality Auditで照合する。実装と試験の存在を、本書の設計処置やVisual品質の成立へ読み替えない。

## 1. 目的

Visual Previewは、`file://`を利用できない検証環境でも、Repository内にあるHTML、CSS、画像およびFontを実Browserで確認できるlocalhost入口を提供する。

```text
Repository内Visual成果物
          │ read only
          ▼
   Visual Preview
          │ 127.0.0.1
          ▼
 BrowserによるVisual確認
```

## 2. Component

```text
visual-preview/
├ src/index.ts           公開API
├ src/preview-server.ts  Root検証・HTTP配信・Listener Owner
├ src/browser-zoom-verifier.ts 専用Profile・Chrome・DevTools・測定・清掃
├ bin/visual-preview.ts  Preview／Zoom検証のCLI入口
└ tests/                 localhost直接境界の契約試験

template/tools/
└ crdd-visual-preview.ts 薄い配布入口
```

## 3. Interface

| Interface | Input | Output | 所有しないもの |
|---|---|---|---|
| Library | 作業Directory、Repository相対Root、任意Port | localhost URL、Health URL、close | Visual評価、Evidence、外部公開 |
| CLI | `--root`、`--port` | ready／closed／blockedのJSON | Absolute Path表示、Browser起動 |
| HTTP | GET／HEADとRoot内File Path | Fileまたは固定拒否結果 | POST、一覧、CORS、Credential |
| Health | 固定Path | Contract、ready、host、read-only | Root Path、Repository Identity |
| Zoom検証 | Root、HTML一覧、倍率一覧、Window寸法、任意Chrome Path | 実倍率、実効Viewport、画像、文字・操作対象・Overflow・Focusおよび資源別cleanupの構造化結果 | Human Direction、通常Browser Profile、Browser拡張、外部Network |
| 起動済みlocalhost Application検証 | loopback HTTPのBase URL、画面Target、表示Profile、倍率、任意Chrome Path | Target別の実倍率、実効Viewport、画像、文字・操作対象・Overflow・FocusおよびBrowser資源cleanupの構造化結果 | Application Serverの起動・停止、外部URL、通常Browser Profile、外部Network |

### 公開Export Allowlist

`src/index.ts`は利用側の唯一の公開入口とし、次のModuleだけを明示的に公開する。Browser Zoom検証はVisual Previewの設計済みCapabilityであり、利用側に内部Pathの直接参照を求めない。

| 公開Module | 公開する責務 |
|---|---|
| `./preview-server.ts` | Repository内の許可Rootをlocalhostへ読取り専用で配信する。 |
| `./browser-zoom-verifier.ts` | 専用Chrome Profileで実ZoomとVisual品質条件を観測し、所有資源を清掃する。 |

## 4. Flow

```text
[Repository Rootを検証]
          │
          ├ 失敗 ─────────────→ [Effect 0／blocked]
          ▼
[相対Preview Rootを検証]
          │
          ├ 越境・Link・非Directory ─→ [Effect 0／blocked]
          ▼
[127.0.0.1へBind]
          │
          ▼
[GET／HEAD]
          │
          ├ Method不許可 ──────→ [405]
          ├ Path／Link／Directory不許可 → [404]
          ▼
[通常Fileをread onlyで搬送]
          │
          ▼
[条件ごとの専用Chrome Profile]
          │ 実Browser Zoom
          ▼
[Rendered DOMをDevToolsで観測]
          │
          ├ 閾値未達 ─────────→ [failed]
          ▼
[正常終了を要求し、Process Tree・DevTools・Profile・Preview Listenerを個別観測]
```

起動済みApplicationを検証する場合は、Application側がServer lifecycleを所有し、Visual Previewは検証済みのloopback Base URLだけを受け取る。画面Target、表示Profile、倍率の有限集合を全数処置し、条件ごとのBrowser ProcessはPIDと生成時刻を組み合わせたexact Identityで終了後に再観測する。Application Listenerの不存在確認は呼出側が行い、Visual Previewが他SubsystemのServerを暗黙停止しない。

## 5. Lifecycle

| 状態 | 条件 | 許可する操作 | 終了条件 |
|---|---|---|---|
| stopped | Root未検証または開始前 | Root検証 | Network Effect 0 |
| ready | Bind完了後 | GET／HEAD、Health、close | Listenerが所有されている |
| closing | close開始後 | 新しい業務操作なし | 所有Connectionを終了する |
| closed | Server close完了後 | 冪等なclose | Listener 0、Connection 0 |
| measuring | 専用Profile作成後 | 対象URLの表示と読取り観測 | 同じ条件のProcessとProfileを所有する |
| measured | 一条件の観測と終了後確認完了後 | 結果集約、次条件開始 | 前条件のProcess Tree 0、DevTools Listener 0、Profile 0 |

CLIはSIGINT／SIGTERMの競合を一回のcloseへ畳む。Library Handleのcloseも冪等とする。

## 6. Security Boundary

- Hostは`127.0.0.1`固定とし、設定で外部Addressへ変更できない。
- Preview Rootは検証済みRepository Root内の相対Directoryに限定する。
- Rootおよび要求Path内のSymbolic Link／Junctionを追跡しない。
- 通常Fileだけを返し、Directory一覧や暗黙のIndex解決を行わない。
- GET／HEAD以外を拒否し、Filesystemへ書き込まない。
- CORS許可を付けず、Cache、MIME推測、Referrer、Frame埋込みを制限する。
- 公開結果、HealthおよびErrorへAbsolute Pathを含めない。
- Zoom検証は通常Browser Profile、Browser拡張、外部Networkおよび`file://`を使用しない。
- DevTools Portは専用Browserが一時発行したlocalhost Endpointだけを使用し、結果へ公開しない。

## 7. 失敗と終了後条件

| 失敗 | 処置 | 終了後条件 |
|---|---|---|
| Repository／Root不正 | Listener開始前にblocked | Network Effect 0 |
| Bind失敗 | Errorを返す | 未所有Listener 0 |
| Path越境／Link／Directory | 固定404 | Root外読取り0、内部Path非開示 |
| 不許可Method | 固定405とAllow Header | Filesystem Effect 0 |
| File読取り失敗 | 固定失敗または接続終了 | 別FileへのFallback 0 |
| close | Listenerと所有Connectionを終了 | Listener 0、Connection 0 |
| Browser起動・Navigation失敗 | 同じ条件を成功へ畳まずblocked | 所有Browser Process Tree 0、DevTools Listener 0、専用Profile 0 |
| 画像読込失敗 | `complete`と自然幅・高さを観測しfailed | alt文字や壊れた画像表示を成功へ畳まない |
| Navigation中のContext破棄 | 同じURL・期限内だけ再観測 | 別URLへのFallback 0、重複Profile残存0 |
| Zoom未反映・Visual閾値未達 | 測定値と理由をfailedで返す | 他条件のPassによる上書き0 |
| cleanup不能 | 全体をPASSにしない | 対象Identityを不明なまま不存在へ畳まない |

## 8. Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | N/A | 配信方式、Host、Root Authorityに複数具象を持たせない。 | 単一のlocalhost HTTP実装 | 別方式を暗黙追加しない | 必要になった時点で別Capabilityとして再評価 | `visual-preview.local-read-only-preview` |
| Common Contract | Required | Library、CLI、HTTPが同じRootとread-only条件を共有し、Zoom検証も同じPreview契約を使用する。 | 公開API、Server Contract、Zoom Verification Contract | CLIでRoot検証や測定を再実装しない | 新入口は同じContractへ接続する | `visual-preview.local-read-only-preview`、`visual-preview.actual-browser-zoom` |
| Creation／Selection | Required | Root検証後だけListenerを作り、条件ごとの専用ProfileだけでBrowserを起動する。 | Root Resolver→Server Bind→専用Profile→Chrome | 不明時Effect 0、通常Profile非利用 | Root／Browser選択変更はSecurityへ波及 | `visual-preview.local-read-only-preview`、`visual-preview.actual-browser-zoom` |
| State-dependent Behavior | Required | ready前、ready、measuring、measured、closing、closedで操作可能性が異なる。 | Handle／Measurement Lifecycle | ready前にURLを返さず、観測前に条件をPassへしない | 状態追加はclose／cleanup試験へ波及 | `visual-preview.local-read-only-preview`、`visual-preview.actual-browser-zoom` |
| Composition／Recursion | N/A | 再帰的なSubsystem合成を行わない。 | 単一Listener | 上位完成を所有しない | N/A | `visual-preview.local-read-only-preview` |
| Lifecycle Ownership | Required | Listener、Connection、Browser Process Tree、DevToolsおよび専用Profileを確実に回収する必要がある。 | Preview Handleと条件別Measurementが各資源Owner | close後Listener／Connection 0、条件後Process Tree／DevTools／Profile 0 | 取消経路変更はIT／STへ波及 | `visual-preview.local-read-only-preview`、`visual-preview.actual-browser-zoom` |
| External Boundary | Required | Filesystem、HTTP、Chromium Profile、Browser ProcessおよびDevToolsを扱う。 | Root検証、HTTP Method、Response Header、専用Profile→Headless Chrome→DevTools測定 | 要求とFile Effectを分け、通常Profile非利用、実DPR一致、全条件処置を維持する | 境界変更はSecurity、IT、ST、Visual Gateへ波及 | `visual-preview.local-read-only-preview`、`visual-preview.actual-browser-zoom` |

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
