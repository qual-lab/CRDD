# CHG-000038 Claude Subscription OAuth Vertical Slice実行記録

- 対象変更: [`CHG-000038`](../CHG-000038_Claude_Subscription_OAuth_Vertical_Slice.md)
- 記録種別: `fixed_image_provider_home_egress_and_oauth_bootstrap_verification`
- 実行日: 2026-08-24（Asia/Tokyo）
- 状態: 固定image、最小環境、専用Provider Home bind mount、限定Egress、Claude Max Subscription OAuth loginおよびbounded boolean fixed promptを確認。production Runtime Gate、Authority、CapabilityまたはReleaseの成立記録ではない。

## 固定artifactとargv

| 観測 | 結果 |
| --- | --- |
| Claude version | `2.1.220` |
| binary SHA-256 | `674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863` |
| binary bytes | `275012592` |
| fixed Provider image ID | `sha256:9815772cdc09551d2635f8cf15d90077b2da07ee87f4fe83c7c29dd59cb48ec7` |
| base image digest | `sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047` |
| Managed Settings SHA-256 | `736c1447df695f074743f52564eefd4f9f8d8850737657d54a1f3d6052151ee8` |
| image user | `65534:65534` |
| exact argv compatibility | networkなし、Credential／Provider Homeなしでauthentication boundary到達 |
| Provider request／cost／token | `0`／`USD 0`／input 0・output 0 |

`--bare`はexact binary helpでOAuth／Keychainを使用しないことを確認したため除外した。`--safe-mode`、空settings sources、空MCP設定、tool無効、最大2 turns、API相当budget `$0.10`、session非永続およびplan permissionの組合せを固定した。image buildの再現可能性とRelease配布接続は主張しない。

## 専用Provider Home

| 条件／観測 | 結果 |
| --- | --- |
| root source | Windows Known Folder `LocalApplicationData` |
| scope | 現在の認証済みLocal User／Claude専用 |
| Host既定Claude home／Credential import | 0 |
| reparse point | false |
| protected DACL | 現在userとSYSTEMだけFullControl |
| ACL SHA-256 | `839b90f8bc295d36bd9dbd11985fbdfd3208a4ce8707877bcdcd5b2f1f87b7e6` |
| bind mount write probe | 一時sentinelのwrite／read／delete成功 |
| sentinel residue | 0 |
| Credential内容read／report | 0 |

これは明示bootstrapのtransient verificationであり、Runtime-owned selected-user binder、保護observer、Mount Grant issuer／store／consume／revokeまたはmount Authorityの成立記録ではない。実PathはEvidenceへ保持しない。

## Egress topology

| 条件／観測 | 結果 |
| --- | --- |
| Proxy image ID | `sha256:f8dad0fbda2d96669dff0a7a0d56864047640af0f4514cbd1383abada91d5d68` |
| Proxy source SHA-256 | `6c99298438c8f383f0b494dfb0a36ef8dd3c8b5813a48cb9e2f574ba2fbf6901` |
| Provider network | internal、外部network attachment 0 |
| Proxy network | internal + egressのdual-network |
| Provider direct `1.1.1.1:443` | denied |
| Proxy経由`example.com:443` | denied |
| Proxy経由`claude.ai:443` | CONNECT成立、TLS response観測 |
| Proxy structured outcomes | `ready`、`hostname_denied`、`tunnel_established`、`tunnel_closed` |
| trace loss | 非該当。process結果とProxy structured logを使用 |
| cleanup | container residue 0、network residue 0 |

ProxyはCONNECT／443／完全一致hostnameだけを許し、IP literal、非global DNS結果、重複header、認証不一致およびsize／time／byte上限超過を拒否する。現在のPython `ipaddress`判定は既存TypeScript IANA snapshotと統合されていないため、production authoritative Egress adapterとは扱わない。

## OAuth bootstrap

| 条件／観測 | 結果 |
| --- | --- |
| login command | exact binaryの`auth login --claudeai` |
| Console／API key login | 未許可 |
| Provider Home | 上記専用homeだけをread-write bind mount |
| Repository／workspace mount | 0 |
| root filesystem | read-only |
| Linux Capability | `ALL` dropped |
| privilege | `no-new-privileges`、user `65534:65534` |
| Egress | 上記internal Provider networkと限定Proxyだけ |
| browser state | アプリ内Google popup停止後、同じPKCE sessionを外部既定browserへhandoff |
| OAuth completion | `Login successful`、process exit 0 |
| token／auth file内容read | 0 |
| official auth status | exit 0、`loggedIn: true`、`authMethod: claude.ai` |
| observed offering | Claude Max |
| auth status environment | networkなし、Provider Home read-only mount |
| identity fields | CLIは返したが値を表示・記録せず破棄 |
| OAuth infrastructure cleanup | verified、container／network residue 0 |

OAuth URL、PKCE state、code、token、email、organization情報およびProvider Homeの実Pathは記録しない。Claude Max offeringは確認したが、quotaと自動化されたSubscription利用条件は未確認である。

## 固定prompt実Request

| 条件／観測 | 結果 |
| --- | --- |
| 人間の直前承認 | あり、exact 1 request |
| process | exit 0、Provider reported error false |
| turns | 1 |
| CLI reported `total_cost_usd` | `0.036975` |
| token | input 2、output 15、cache creation 3659、cache read 0 |
| Provider network | internal network 1件のみ |
| Proxy outcomes | `ready`、`tunnel_established`、`tunnel_closed` |
| Repository／workspace mount | 0／0 |
| tools requested | none |
| session persistence | requested false |
| API key environment | 0 |
| raw output | 値は記録せず、SHA-256 `b8ee44de22aea189061358353123b0e9eff10d62f2723cb05ddd2a8b0e6940be`だけ保持 |
| structured result | 単一キーJSONとして検証不能、runはblocked |
| automatic retry | 0 |
| cleanup | container residue 0、network residue 0 |

`total_cost_usd`はClaude CLIが返したAPI相当の計算指標であり、API keyまたは別の従量API請求を観測したものではない。認証方式はClaude Max Subscription OAuthで、API key環境を渡していない。今回の1 requestはSubscription利用枠を消費した可能性がある。

失敗原因へ推測で結果を補わず、exact binaryのhelpで`--json-schema`を確認した。固定Schema追加後の全argvはnetworkなし、Credential／Provider Homeなしでauthentication boundaryまで受理され、Provider request 0だった。Schema追加後の実Requestは別の人間承認まで発火しない。

### Schema追加後の再承認run

| 条件／観測 | 結果 |
| --- | --- |
| 人間の直前承認 | あり、exact 1 command |
| structured output schema | requested |
| process | exit 1 |
| raw output | 値は記録せず、SHA-256 `2e5ab9be33e00c0330eb30cf15791f1a15a87705b97f0ee20a58f46569178e70`だけ保持 |
| Provider request発火 | raw errorとProxy outcomesを保持しなかったためunknown |
| structured result | 未成立、runはblocked |
| automatic retry | 0 |
| cleanup | container residue 0、network residue 0 |
| 終了後OAuth | networkなし`auth status`でClaude Max／`loggedIn: true` |

公式Claude Code資料では`const`を含む標準JSON Schemaを対応対象としているため、Schema非対応とは判定しない。Structured OutputはSchema適合に失敗すると検証再試行を行い、retry limit到達時はerrorになる。今回の`--max-turns 1`との関係は未確認であり、原因を断定しない。次の候補は最大2 turnsとAPI相当budget上限を明示し、exit非0でも秘密を含まないerror subtypeとProxy outcomeだけを保持する。

### 最大2 turns／budget上限run

| 条件／観測 | 結果 |
| --- | --- |
| 人間の直前承認 | あり、exact 1 command、最大2 turns、API相当budget `$0.10` |
| process／Provider result | exit 0、subtype `success`、Provider error false |
| structured output | present、property 1件 |
| local string contract | `available`のcase-sensitive完全一致を確認できずblocked |
| turns | 2 |
| CLI reported `total_cost_usd` | `0.022397` |
| token | input 2、output 262、cache creation 1452、cache read 2634 |
| Provider network／Proxy | internal network 1件、`ready`／`tunnel_established`／`tunnel_closed` |
| Repository／workspace／tools | 0／0／none |
| raw output | 値は記録せず、SHA-256 `71fe73491564fe87b94f95b25905c23c5e2764aefcb00300c5dca14bd84235a0`だけ保持 |
| cleanup | container residue 0、network residue 0 |

公式資料はstring `enum`／`const`の大文字小文字差があり得るためcase-insensitive比較を案内する。CRDD側は未知の文字列値を事後的に許容せず、文字列Schemaをboolean `status: true`へ置換する。boolean Schema、最大2 turnsおよび`$0.10`上限を含むexact argvはnetworkなし、Credential／Provider Homeなしでauthentication boundaryまで受理され、Provider request 0だった。boolean Schemaによる実Requestは別の人間承認まで発火しない。

### boolean Schema最終run

| 条件／観測 | 結果 |
| --- | --- |
| 人間の直前承認 | あり、exact 1 command、最大2 turns、API相当budget `$0.10` |
| process／Provider result | exit 0、subtype `success`、Provider error false |
| normalized result | `{status: true}` |
| turns | 2 |
| CLI reported `total_cost_usd` | `0.04699` |
| token | input 2、output 244、cache creation 4088、cache read 0 |
| Provider network／Proxy | internal network 1件、`ready`／`tunnel_established`／`tunnel_closed` |
| Repository／workspace／tools | 0／0／none |
| API key／session persistence | 0／requested false |
| raw output | 値は記録せず、SHA-256 `65c2a2079a4de7b673bae1197b82025a5a251276e9781b8e68d42bb4d5169aeb`だけ保持 |
| cleanup | container residue 0、network residue 0 |

初回local判定の`resultPropertyNameExact: false`はProvider結果ではなく検証ハーネスの欠陥だった。PowerShellで`if`式が返す1要素arrayはscalar `System.String`へ展開され、`$properties[0]`が文字列全体ではなく先頭文字`s`を返す。同じ`{status: true}` fixtureで旧判定の`oldIndexZero: s`／falseと、明示`System.Object[]`化後の`fixedIndexZero: status`／trueを決定論的に再現した。実runはStructured Output 1 propertyかつcase-insensitive property accessでboolean `true`を観測しており、修正後のexact判定とProvider subtype `success`を合わせてPassとした。

## 検証と終了状態

- focused contract tests: 18／18 Pass
- Coordinator全contract tests: 444／444 Pass
- Coordinator strict TypeScript typecheck: Pass
- Coordinator Biome lint: Pass
- Coordinator Biome format check: Pass
- Repository全体checker: 591 files、371 Markdown、2,113 local links、583 anchors、Error 0／Warning 0
- Egress probe container／network: residue 0
- OAuth container／network: cleanup verified、residue 0
- API key、追加購入、Repository Effect、merge、Release: Effect 0
- Provider request: 承認したbounded runを実行済み。Claude Max Subscription利用枠を消費した可能性あり

通常Runtime Gate、Authority、Mount GrantおよびOperation Capabilityは発行していない。OAuth完了後も固定prompt request直前にSubscription枠消費の人間承認を別Gateとして要求する。
