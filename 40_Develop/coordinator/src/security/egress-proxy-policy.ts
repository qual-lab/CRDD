/**
 * egress-proxy-policyに属する責務をまとめる。
 *
 * @responsibility SpecialPurposeEntryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";
import net from "node:net";

import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { validateProviderIsolationProfile } from "./provider-isolation-profile.ts";

export const EGRESS_PROXY_CONTRACT = "crdd-coordinator/provider-egress-proxy";
export const EGRESS_PROXY_CONTRACT_REVISION = 1;

const PROVIDER_VERIFICATION_ADAPTER = Object.freeze({
  sourcePath: "40_Develop/coordinator/runtime/provider-egress-proxy.py",
  sourceSha256:
    "c6d0b35550682c54c491096d4cfeb6e01c6cebc67900248bfa10a2c9ec375018",
  imageDigest:
    "sha256:8a44e363453c0d0bed66e337007070c072ad1dc75a23ec584c95d361c5a5dcfc",
  imageBuildDefinition:
    "40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile",
  verifiedAt: "2026-08-25",
  externalProbe: Object.freeze({
    providerImageDigest:
      "sha256:9815772cdc09551d2635f8cf15d90077b2da07ee87f4fe83c7c29dd59cb48ec7",
    providerNetworkInternal: true,
    providerDirectExternalNetwork: false,
    proxyDualNetwork: true,
    directExternalDenied: true,
    disallowedHostnameDenied: true,
    allowedHostnameTlsReached: true,
    allowedHostname: "claude.ai",
    containerResidue: 0,
    networkResidue: 0,
  }),
  codexExternalProbe: Object.freeze({
    providerImageDigest:
      "sha256:8362d00d6831fb1a5302490f0053198911988a21fb70733d07ab1dcf0f3d7bae",
    exactModel: "gpt-5.6-sol",
    effort: "low",
    speedMode: "normal",
    providerNetworkInternal: true,
    providerDirectExternalNetwork: false,
    proxyDualNetwork: true,
    allowedTunnelCount: 11,
    deniedTunnelCount: 5,
    exactResult: Object.freeze({ status: true }),
    exitCode: 0,
    containerResidue: 0,
    networkResidue: 0,
    verifiedAt: "2026-08-25",
  }),
  profileSelfTests: Object.freeze({
    claude: Object.freeze([
      "api.anthropic.com",
      "claude.ai",
      "platform.claude.com",
    ]),
    codex: Object.freeze(["auth.openai.com", "chatgpt.com"]),
  }),
  reproducibleImageBuildClaimed: false,
  releaseDistributionConnected: false,
});

const REGISTRY_METADATA = Object.freeze({
  specialPurposeRegistryLastUpdated: "2025-10-09",
  ipv6GlobalUnicastRegistryLastUpdated: "2025-10-10",
  ipv6AddressSpaceRegistryLastUpdated: "2025-10-23",
  reviewedAt: "2026-08-11",
  ipv4Registry:
    "https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml",
  ipv6Registry:
    "https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml",
  ipv6GlobalUnicastRegistry:
    "https://www.iana.org/assignments/ipv6-unicast-address-assignments/ipv6-unicast-address-assignments.xhtml",
  ipv6AddressSpaceRegistry:
    "https://www.iana.org/assignments/ipv6-address-space/ipv6-address-space.xhtml",
  specialPurposeDecisionField: "Globally Reachable",
  ipv6AllocationDecisionField: "Status=ALLOCATED",
  ipv4NoSpecialPurposeMatchDecision: "candidate",
  ipv6NoAllocatedGlobalUnicastMatchDecision: "deny",
  matchedUnknownValueDecision: "deny",
  snapshotHashScope: "normalized metadata and embedded prefix entries",
});

// More-specific entries override their parents. `null` is an IANA N/A/blank
// value and is denied. Protocol-level non-unicast/legacy ranges are included
// as conservative supplements and are identified separately.
/**
 * egress-proxy-policyで使用するSpecial Purpose Entryの値契約を定義する。
 *
 * @responsibility Special Purpose EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape SpecialPurposeEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SpecialPurposeEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: SpecialPurposeEntryの宣言は外部境界を開かない。
 * @security SpecialPurposeEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility SpecialPurposeEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SpecialPurposeEntry = readonly [
  family: 4 | 6,
  cidr: string,
  globallyReachable: boolean | null,
  source: string,
];

/**
 * egress-proxy-policyで使用するCidr Ruleの値契約を定義する。
 *
 * @responsibility Cidr RuleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape CidrRuleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CidrRuleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CidrRuleの宣言は外部境界を開かない。
 * @security CidrRuleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CidrRuleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CidrRule = Readonly<{
  family: number;
  prefixLength: number;
  prefix: bigint;
  globallyReachable: boolean | null;
  source: string;
}>;

const SPECIAL_PURPOSE_ENTRIES: readonly SpecialPurposeEntry[] = Object.freeze([
  [4, "0.0.0.0/8", false, "iana"],
  [4, "0.0.0.0/32", false, "iana"],
  [4, "10.0.0.0/8", false, "iana"],
  [4, "100.64.0.0/10", false, "iana"],
  [4, "127.0.0.0/8", false, "iana"],
  [4, "169.254.0.0/16", false, "iana"],
  [4, "172.16.0.0/12", false, "iana"],
  [4, "192.0.0.0/24", false, "iana"],
  [4, "192.0.0.0/29", false, "iana"],
  [4, "192.0.0.8/32", false, "iana"],
  [4, "192.0.0.9/32", true, "iana"],
  [4, "192.0.0.10/32", true, "iana"],
  [4, "192.0.0.170/32", false, "iana"],
  [4, "192.0.0.171/32", false, "iana"],
  [4, "192.0.2.0/24", false, "iana"],
  [4, "192.31.196.0/24", true, "iana"],
  [4, "192.52.193.0/24", true, "iana"],
  [4, "192.88.99.0/24", null, "iana"],
  [4, "192.88.99.2/32", false, "iana"],
  [4, "192.168.0.0/16", false, "iana"],
  [4, "192.175.48.0/24", true, "iana"],
  [4, "198.18.0.0/15", false, "iana"],
  [4, "198.51.100.0/24", false, "iana"],
  [4, "203.0.113.0/24", false, "iana"],
  [4, "224.0.0.0/4", false, "protocol-non-unicast"],
  [4, "240.0.0.0/4", false, "iana"],
  [4, "255.255.255.255/32", false, "iana"],
  [6, "::/96", false, "protocol-deprecated-compatible"],
  [6, "::/128", false, "iana"],
  [6, "::1/128", false, "iana"],
  [6, "::ffff:0:0/96", false, "iana-mapped-evaluated-as-ipv4"],
  [6, "64:ff9b::/96", true, "iana"],
  [6, "64:ff9b:1::/48", false, "iana"],
  [6, "100::/64", false, "iana"],
  [6, "100:0:0:1::/64", false, "iana"],
  [6, "2001::/23", false, "iana"],
  [6, "2001::/32", null, "iana"],
  [6, "2001:1::1/128", true, "iana"],
  [6, "2001:1::2/128", true, "iana"],
  [6, "2001:1::3/128", true, "iana"],
  [6, "2001:2::/48", false, "iana"],
  [6, "2001:3::/32", true, "iana"],
  [6, "2001:4:112::/48", true, "iana"],
  [6, "2001:10::/28", null, "iana"],
  [6, "2001:20::/28", true, "iana"],
  [6, "2001:30::/28", true, "iana"],
  [6, "2001:db8::/32", false, "iana"],
  [6, "2002::/16", null, "iana"],
  [6, "2620:4f:8000::/48", true, "iana"],
  [6, "3fff::/20", false, "iana"],
  [6, "5f00::/16", false, "iana"],
  [6, "fc00::/7", false, "iana"],
  [6, "fe80::/10", false, "iana"],
  [6, "fec0::/10", false, "protocol-deprecated-site-local"],
  [6, "ff00::/8", false, "protocol-non-unicast"],
]);

// IANA IPv6 Global Unicast Address Space entries whose Status is ALLOCATED.
// RESERVED rows and unlisted portions of 2000::/3 are intentionally absent.
const IPV6_ALLOCATED_ENTRIES: readonly string[] = Object.freeze([
  "2001::/23",
  "2001:200::/23",
  "2001:400::/23",
  "2001:600::/23",
  "2001:800::/22",
  "2001:c00::/23",
  "2001:e00::/23",
  "2001:1200::/23",
  "2001:1400::/22",
  "2001:1800::/23",
  "2001:1a00::/23",
  "2001:1c00::/22",
  "2001:2000::/19",
  "2001:4000::/23",
  "2001:4200::/23",
  "2001:4400::/23",
  "2001:4600::/23",
  "2001:4800::/23",
  "2001:4a00::/23",
  "2001:4c00::/23",
  "2001:5000::/20",
  "2001:8000::/19",
  "2001:a000::/20",
  "2001:b000::/20",
  "2002::/16",
  "2003::/18",
  "2400::/12",
  "2410::/12",
  "2600::/12",
  "2610::/23",
  "2620::/23",
  "2630::/12",
  "2800::/12",
  "2a00::/12",
  "2a10::/12",
  "2c00::/12",
]);

/**
 * egress-proxy-policyを停止結果として構築する。
 *
 * @responsibility egress-proxy-policyの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000015
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({ status: "blocked", reason, policy: null });
}

/**
 * Ipv4を構造化値へ解析する。
 *
 * @responsibility Ipv4の入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input address: unknown
 * @returns bigint | nullを返す。
 * @precondition 「address: unknown」がparseIpv4の入力契約を満たす。
 * @postcondition parseIpv4の責務を完了した結果だけを返す。
 * @effect N/A: parseIpv4は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseIpv4は独自の失敗分岐を所有しない。
 * @invariant parseIpv4は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseIpv4はProcess内の同一Subsystemで完結する。
 * @security parseIpv4はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseIpv4は共有非同期状態を持たない同期処理である。
 */
function parseIpv4(address: unknown): bigint | null {
  if (
    typeof address !== "string" ||
    !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(address)
  )
    return null;
  const octets = address.split(".").map(Number);
  if (
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return null;
  return octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

/**
 * Ipv6を構造化値へ解析する。
 *
 * @responsibility Ipv6の入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input address: unknown
 * @returns bigint | nullを返す。
 * @precondition 「address: unknown」がparseIpv6の入力契約を満たす。
 * @postcondition parseIpv6の責務を完了した結果だけを返す。
 * @effect N/A: parseIpv6は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseIpv6は独自の失敗分岐を所有しない。
 * @invariant parseIpv6は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseIpv6はProcess内の同一Subsystemで完結する。
 * @security parseIpv6はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseIpv6は共有非同期状態を持たない同期処理である。
 */
function parseIpv6(address: unknown): bigint | null {
  if (
    typeof address !== "string" ||
    address.includes("%") ||
    address.length === 0
  )
    return null;
  let source = address.toLowerCase();
  const dottedIndex = source.lastIndexOf(":");
  if (source.includes(".")) {
    if (dottedIndex < 0) return null;
    const ipv4 = parseIpv4(source.slice(dottedIndex + 1));
    if (ipv4 == null) return null;
    source = `${source.slice(0, dottedIndex)}:${(ipv4 >> 16n).toString(16)}:${(ipv4 & 0xffffn).toString(16)}`;
  }
  if ((source.match(/::/gu) ?? []).length > 1) return null;
  const isCompressed = source.includes("::");
  const [leftSource = "", rightSource = ""] = source.split("::");
  const leftWords = leftSource ? leftSource.split(":") : [];
  const rightWords = rightSource ? rightSource.split(":") : [];
  if (
    [...leftWords, ...rightWords].some((part) => !/^[0-9a-f]{1,4}$/u.test(part))
  )
    return null;
  const missing = 8 - leftWords.length - rightWords.length;
  if ((isCompressed && missing < 1) || (!isCompressed && missing !== 0))
    return null;
  const words = [
    ...leftWords,
    ...Array.from({ length: missing }, () => "0"),
    ...rightWords,
  ];
  if (words.length !== 8) return null;
  return words.reduce(
    (value, word) => (value << 16n) | BigInt(`0x${word}`),
    0n,
  );
}

/**
 * Cidrを構造化値へ解析する。
 *
 * @responsibility Cidrの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input family: number、cidr: string、isGloballyReachable: boolean | null、source: string
 * @returns {Readonly<CidrRule>}
 * @precondition 「family: number、cidr: string、isGloballyReachable: boolean | null、source: string」がparseCidrの入力契約を満たす。
 * @postcondition parseCidrの責務を完了した結果だけを返す。
 * @effect N/A: parseCidrは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseCidrは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseCidrは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseCidrはProcess内の同一Subsystemで完結する。
 * @security parseCidrはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseCidrは共有非同期状態を持たない同期処理である。
 */
function parseCidr(
  family: number,
  cidr: string,
  isGloballyReachable: boolean | null,
  source: string,
): CidrRule {
  const [address, prefixText] = cidr.split("/");
  if (address === undefined || prefixText === undefined) {
    throw new Error("invalid_special_purpose_registry_snapshot");
  }
  const bits = family === 4 ? 32 : 128;
  const prefixLength = Number(prefixText);
  const value = family === 4 ? parseIpv4(address) : parseIpv6(address);
  if (
    value == null ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > bits
  ) {
    throw new Error("invalid_special_purpose_registry_snapshot");
  }
  const shift = BigInt(bits - prefixLength);
  return Object.freeze({
    family,
    prefixLength,
    prefix: shift === 0n ? value : (value >> shift) << shift,
    globallyReachable: isGloballyReachable,
    source,
  });
}

const cidrRules = Object.freeze(
  SPECIAL_PURPOSE_ENTRIES.map((entry) => parseCidr(...entry)).sort(
    (a, b) => b.prefixLength - a.prefixLength,
  ),
);

const ipv6AllocatedRules = Object.freeze(
  IPV6_ALLOCATED_ENTRIES.map((cidr) =>
    parseCidr(6, cidr, true, "iana-ipv6-global-unicast-allocated"),
  ).sort((a, b) => b.prefixLength - a.prefixLength),
);

const SPECIAL_PURPOSE_REGISTRY_SNAPSHOT_SHA256 = createHash("sha256")
  .update(
    JSON.stringify({
      metadata: REGISTRY_METADATA,
      specialPurposeEntries: SPECIAL_PURPOSE_ENTRIES,
      ipv6AllocatedEntries: IPV6_ALLOCATED_ENTRIES,
    }),
  )
  .digest("hex");

/**
 * cidr Matchを決定する。
 *
 * @responsibility cidr Matchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: bigint、bits: number、rule: CidrRule
 * @returns cidrMatchの計算結果を返す。
 * @precondition 「value: bigint、bits: number、rule: CidrRule」がcidrMatchの入力契約を満たす。
 * @postcondition cidrMatchの責務を完了した結果だけを返す。
 * @effect N/A: cidrMatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cidrMatchは独自の失敗分岐を所有しない。
 * @invariant cidrMatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cidrMatchはProcess内の同一Subsystemで完結する。
 * @security cidrMatchはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cidrMatchは共有非同期状態を持たない同期処理である。
 */
function cidrMatch(value: bigint, bits: number, rule: CidrRule) {
  const shift = BigInt(bits - rule.prefixLength);
  return (shift === 0n ? value : (value >> shift) << shift) === rule.prefix;
}

/**
 * longest Matchを決定する。
 *
 * @responsibility longest Matchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input family: number、value: bigint、rules: readonly CidrRule[]
 * @returns longestMatchの計算結果を返す。
 * @precondition 「family: number、value: bigint、rules: readonly CidrRule[]」がlongestMatchの入力契約を満たす。
 * @postcondition longestMatchの責務を完了した結果だけを返す。
 * @effect N/A: longestMatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: longestMatchは独自の失敗分岐を所有しない。
 * @invariant longestMatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: longestMatchはProcess内の同一Subsystemで完結する。
 * @security longestMatchはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: longestMatchは共有非同期状態を持たない同期処理である。
 */
function longestMatch(
  family: number,
  value: bigint,
  rules: readonly CidrRule[],
) {
  const bits = family === 4 ? 32 : 128;
  return (
    rules.find(
      (rule) => rule.family === family && cidrMatch(value, bits, rule),
    ) ?? null
  );
}

/**
 * globally Reachable Ipv4を決定する。
 *
 * @responsibility globally Reachable Ipv4の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: bigint
 * @returns globallyReachableIpv4の計算結果を返す。
 * @precondition 「value: bigint」がgloballyReachableIpv4の入力契約を満たす。
 * @postcondition globallyReachableIpv4の責務を完了した結果だけを返す。
 * @effect N/A: globallyReachableIpv4は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: globallyReachableIpv4は独自の失敗分岐を所有しない。
 * @invariant globallyReachableIpv4は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: globallyReachableIpv4はProcess内の同一Subsystemで完結する。
 * @security globallyReachableIpv4はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: globallyReachableIpv4は共有非同期状態を持たない同期処理である。
 */
function globallyReachableIpv4(value: bigint) {
  const match = longestMatch(4, value, cidrRules);
  return match ? match.globallyReachable === true : true;
}

/**
 * globally Reachable Ipv6を決定する。
 *
 * @responsibility globally Reachable Ipv6の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input value: bigint
 * @returns globallyReachableIpv6の計算結果を返す。
 * @precondition 「value: bigint」がgloballyReachableIpv6の入力契約を満たす。
 * @postcondition globallyReachableIpv6の責務を完了した結果だけを返す。
 * @effect N/A: globallyReachableIpv6は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: globallyReachableIpv6は独自の失敗分岐を所有しない。
 * @invariant globallyReachableIpv6は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: globallyReachableIpv6はProcess内の同一Subsystemで完結する。
 * @security globallyReachableIpv6はAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: globallyReachableIpv6は共有非同期状態を持たない同期処理である。
 */
function globallyReachableIpv6(value: bigint) {
  const special = longestMatch(6, value, cidrRules);
  if (special) return special.globallyReachable === true;
  return longestMatch(6, value, ipv6AllocatedRules) != null;
}

/**
 * Addressを分類する。
 *
 * @responsibility Addressの分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000015
 * @input address: unknown
 * @returns classifyAddressの計算結果を返す。
 * @precondition 「address: unknown」がclassifyAddressの入力契約を満たす。
 * @postcondition classifyAddressの責務を完了した結果だけを返す。
 * @effect N/A: classifyAddressは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyAddressは独自の失敗分岐を所有しない。
 * @invariant classifyAddressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyAddressはProcess内の同一Subsystemで完結する。
 * @security classifyAddressはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyAddressは共有非同期状態を持たない同期処理である。
 */
function classifyAddress(address: unknown) {
  if (typeof address !== "string" || address.includes("%")) return null;
  if (net.isIP(address) === 4) {
    const value = parseIpv4(address);
    return value == null ? null : globallyReachableIpv4(value);
  }
  if (net.isIP(address) !== 6) return null;
  const value = parseIpv6(address);
  if (value == null) return null;
  const high96 = value >> 32n;
  if (high96 === 0xffffn) return globallyReachableIpv4(value & 0xffffffffn);
  if (high96 === 0n) return false;
  const nat64 = parseIpv6("64:ff9b::");
  if (nat64 === null) return null;
  const nat64Prefix = nat64 >> 32n;
  if (high96 === nat64Prefix) return globallyReachableIpv4(value & 0xffffffffn);
  return globallyReachableIpv6(value);
}

/**
 * Egress Proxy Policy 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility Egress Proxy Policy 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input rawProfile: unknown
 * @returns compileEgressProxyPolicyCandidateの計算結果を返す。
 * @precondition 「rawProfile: unknown」がcompileEgressProxyPolicyCandidateの入力契約を満たす。
 * @postcondition compileEgressProxyPolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileEgressProxyPolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure compileEgressProxyPolicyCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant compileEgressProxyPolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileEgressProxyPolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security compileEgressProxyPolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileEgressProxyPolicyCandidateは共有非同期状態を持たない同期処理である。
 */
export function compileEgressProxyPolicyCandidate(rawProfile: unknown) {
  let validation: ReturnType<typeof validateProviderIsolationProfile>;
  try {
    validation = validateProviderIsolationProfile(rawProfile);
  } catch {
    return blocked("profile_candidate_invalid");
  }
  if (
    validation.status !== "candidate" ||
    validation.reason !== "authority_verification_required"
  ) {
    return blocked("profile_candidate_required");
  }
  try {
    const hostnames = validation.profile.egress.origins.map((origin) =>
      new URL(origin).hostname.toLowerCase(),
    );
    if (
      hostnames.length === 0 ||
      new Set(hostnames).size !== hostnames.length
    ) {
      return blocked("profile_origins_invalid");
    }
    const policy = Object.freeze({
      contract: EGRESS_PROXY_CONTRACT,
      contractRevision: EGRESS_PROXY_CONTRACT_REVISION,
      status: "candidate",
      authorization: "authority_verification_required",
      profileHash: validation.profileHash,
      provider: validation.profile.provider,
      allowedHostnames: Object.freeze([...hostnames].sort()),
      allowedPort: 443,
      allowedMethod: "CONNECT",
      directProviderEgress: false,
      ipLiteralAllowed: false,
      privateAddressAllowed: false,
    });
    return Object.freeze({
      status: "candidate",
      reason: "authority_verification_required",
      policy,
    });
  } catch {
    return blocked("profile_origins_invalid");
  }
}

/**
 * Connect Authorityを構造化値へ解析する。
 *
 * @responsibility Connect Authorityの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000015
 * @input authority: unknown
 * @returns parseConnectAuthorityの計算結果を返す。
 * @precondition 「authority: unknown」がparseConnectAuthorityの入力契約を満たす。
 * @postcondition parseConnectAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: parseConnectAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseConnectAuthorityは独自の失敗分岐を所有しない。
 * @invariant parseConnectAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseConnectAuthorityはProcess内の同一Subsystemで完結する。
 * @security parseConnectAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseConnectAuthorityは共有非同期状態を持たない同期処理である。
 */
function parseConnectAuthority(authority: unknown) {
  if (
    typeof authority !== "string" ||
    authority.length > 255 ||
    /[\u0000-\u0020\u007f]/u.test(authority)
  )
    return null;
  const match = /^([A-Za-z0-9.-]+):443$/u.exec(authority);
  if (!match) return null;
  const hostnameCandidate = match[1];
  if (!hostnameCandidate) return null;
  const hostname = hostnameCandidate.toLowerCase();
  const labels = hostname.split(".");
  if (
    net.isIP(hostname) !== 0 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
    )
  )
    return null;
  return { hostname, port: 443 };
}

/**
 * Proxy Connect For Fixtureを評価する。
 *
 * @responsibility Proxy Connect For Fixtureの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input policy: unknown、request: unknown
 * @returns evaluateProxyConnectForFixtureの計算結果を返す。
 * @precondition 「policy: unknown、request: unknown」がevaluateProxyConnectForFixtureの入力契約を満たす。
 * @postcondition evaluateProxyConnectForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: evaluateProxyConnectForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateProxyConnectForFixtureは独自の失敗分岐を所有しない。
 * @invariant evaluateProxyConnectForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateProxyConnectForFixtureはProcess内の同一Subsystemで完結する。
 * @security evaluateProxyConnectForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateProxyConnectForFixtureは共有非同期状態を持たない同期処理である。
 */
export function evaluateProxyConnectForFixture(
  policy: unknown,
  request: unknown,
) {
  const policyValue = snapshotPlainRecord(
    policy,
    new Set([
      "contract",
      "contractRevision",
      "status",
      "authorization",
      "profileHash",
      "provider",
      "allowedHostnames",
      "allowedPort",
      "allowedMethod",
      "directProviderEgress",
      "ipLiteralAllowed",
      "privateAddressAllowed",
    ]),
  );
  const requestValue = snapshotPlainRecord(
    request,
    new Set(["method", "authority"]),
  );
  if (
    policyValue?.status !== "candidate" ||
    policyValue.authorization !== "authority_verification_required"
  ) {
    return Object.freeze({
      decision: "deny",
      reason: "policy_candidate_required",
    });
  }
  if (requestValue?.method !== "CONNECT") {
    return Object.freeze({
      decision: "deny",
      reason: "connect_method_required",
    });
  }
  const allowedHostnames = snapshotPlainArray<unknown>(
    policyValue.allowedHostnames,
    16,
  );
  if (
    allowedHostnames.status !== "ok" ||
    allowedHostnames.value.some((hostname) => typeof hostname !== "string") ||
    typeof policyValue.allowedPort !== "number"
  ) {
    return Object.freeze({
      decision: "deny",
      reason: "policy_candidate_required",
    });
  }
  const target = parseConnectAuthority(requestValue.authority);
  if (!target)
    return Object.freeze({
      decision: "deny",
      reason: "connect_authority_invalid",
    });
  if (target.port !== policyValue.allowedPort)
    return Object.freeze({
      decision: "deny",
      reason: "connect_port_not_allowed",
    });
  if (!allowedHostnames.value.includes(target.hostname)) {
    return Object.freeze({
      decision: "deny",
      reason: "connect_hostname_not_allowed",
    });
  }
  return Object.freeze({
    decision: "candidate",
    reason: "authority_and_dns_verification_required",
    hostname: target.hostname,
    port: target.port,
  });
}

/**
 * Resolved Addresses For Fixtureを評価する。
 *
 * @responsibility Resolved Addresses For Fixtureの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000015
 * @input addresses: unknown
 * @returns evaluateResolvedAddressesForFixtureの計算結果を返す。
 * @precondition 「addresses: unknown」がevaluateResolvedAddressesForFixtureの入力契約を満たす。
 * @postcondition evaluateResolvedAddressesForFixtureの責務を完了した結果だけを返す。
 * @effect N/A: evaluateResolvedAddressesForFixtureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateResolvedAddressesForFixtureは独自の失敗分岐を所有しない。
 * @invariant evaluateResolvedAddressesForFixtureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateResolvedAddressesForFixtureはProcess内の同一Subsystemで完結する。
 * @security evaluateResolvedAddressesForFixtureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateResolvedAddressesForFixtureは共有非同期状態を持たない同期処理である。
 */
export function evaluateResolvedAddressesForFixture(addresses: unknown) {
  const snapshot = snapshotPlainArray<unknown>(
    addresses,
    Number.MAX_SAFE_INTEGER,
  );
  if (snapshot.status !== "ok" || snapshot.value.length === 0) {
    return Object.freeze({ decision: "deny", reason: "dns_result_required" });
  }
  for (const address of snapshot.value) {
    const isPublicAddress = classifyAddress(address);
    if (isPublicAddress == null)
      return Object.freeze({ decision: "deny", reason: "dns_address_invalid" });
    if (!isPublicAddress)
      return Object.freeze({
        decision: "deny",
        reason: "dns_address_not_public",
      });
  }
  return Object.freeze({
    decision: "candidate",
    reason: "runtime_proxy_enforcement_required",
  });
}

/**
 * Special Purpose Registry Snapshotの公開契約を記述する。
 *
 * @responsibility Special Purpose Registry Snapshotの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSpecialPurposeRegistrySnapshotの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSpecialPurposeRegistrySnapshotの入力契約を満たす。
 * @postcondition describeSpecialPurposeRegistrySnapshotの責務を完了した結果だけを返す。
 * @effect N/A: describeSpecialPurposeRegistrySnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSpecialPurposeRegistrySnapshotは独自の失敗分岐を所有しない。
 * @invariant describeSpecialPurposeRegistrySnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSpecialPurposeRegistrySnapshotはProcess内の同一Subsystemで完結する。
 * @security describeSpecialPurposeRegistrySnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeSpecialPurposeRegistrySnapshotは共有非同期状態を持たない同期処理である。
 */
export function describeSpecialPurposeRegistrySnapshot() {
  return Object.freeze({
    ...REGISTRY_METADATA,
    snapshotSha256: SPECIAL_PURPOSE_REGISTRY_SNAPSHOT_SHA256,
    specialPurposeEntryCount: SPECIAL_PURPOSE_ENTRIES.length,
    ipv6AllocatedEntryCount: IPV6_ALLOCATED_ENTRIES.length,
    matching: "longest_prefix",
    mappedIpv6: "evaluate_as_ipv4",
    compatibleIpv6: "deny",
  });
}

/**
 * Egress Proxy Topologyの公開契約を記述する。
 *
 * @responsibility Egress Proxy Topologyの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input provider: "claude" | "codex"
 * @returns describeEgressProxyTopologyの計算結果を返す。
 * @precondition 「provider: "claude" | "codex"」がdescribeEgressProxyTopologyの入力契約を満たす。
 * @postcondition describeEgressProxyTopologyの責務を完了した結果だけを返す。
 * @effect N/A: describeEgressProxyTopologyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeEgressProxyTopologyは独自の失敗分岐を所有しない。
 * @invariant describeEgressProxyTopologyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeEgressProxyTopologyはProcess内の同一Subsystemで完結する。
 * @security describeEgressProxyTopologyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeEgressProxyTopologyは共有非同期状態を持たない同期処理である。
 */
export function describeEgressProxyTopology(
  provider: "claude" | "codex" = "claude",
) {
  const allowedHostnames =
    provider === "codex"
      ? PROVIDER_VERIFICATION_ADAPTER.profileSelfTests.codex
      : PROVIDER_VERIFICATION_ADAPTER.profileSelfTests.claude;
  return Object.freeze({
    provider,
    proxyProfile: provider,
    containerPort: 8080,
    allowedHostnames,
    providerNetwork: "operation_internal",
    providerNetworkInternal: true,
    providerDirectExternalNetwork: false,
    proxyNetworks: Object.freeze(["operation_internal", "proxy_egress"]),
    dockerSocketMounted: false,
    hostNetworkModeAllowed: false,
    localFallbackAllowed: false,
    verificationAdapter: PROVIDER_VERIFICATION_ADAPTER,
    enforcement: "fixed_runtime_adapter_connected_release_activation_pending",
  });
}
