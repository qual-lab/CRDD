import { createHash } from "node:crypto";
import net from "node:net";

import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { validateProviderIsolationProfile } from "./provider-isolation-profile.ts";

export const EGRESS_PROXY_CONTRACT = "crdd-coordinator/provider-egress-proxy";
export const EGRESS_PROXY_CONTRACT_REVISION = 1;

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
type SpecialPurposeEntry = readonly [
  family: 4 | 6,
  cidr: string,
  globallyReachable: boolean | null,
  source: string,
];

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

function blocked(reason: string) {
  return Object.freeze({ status: "blocked", reason, policy: null });
}

/** @param {unknown} address */
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

/** @param {unknown} address */
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
  const compressed = source.includes("::");
  const [leftSource = "", rightSource = ""] = source.split("::");
  const left = leftSource ? leftSource.split(":") : [];
  const right = rightSource ? rightSource.split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/u.test(part)))
    return null;
  const missing = 8 - left.length - right.length;
  if ((compressed && missing < 1) || (!compressed && missing !== 0))
    return null;
  const words = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (words.length !== 8) return null;
  return words.reduce(
    (value, word) => (value << 16n) | BigInt(`0x${word}`),
    0n,
  );
}

/**
 * @param {number} family
 * @param {string} cidr
 * @param {boolean | null} globallyReachableValue
 * @param {string} source
 * @returns {Readonly<CidrRule>}
 */
function parseCidr(
  family: number,
  cidr: string,
  globallyReachableValue: boolean | null,
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
    globallyReachable: globallyReachableValue,
    source,
  });
}

const CIDR_RULES = Object.freeze(
  SPECIAL_PURPOSE_ENTRIES.map((entry) => parseCidr(...entry)).sort(
    (a, b) => b.prefixLength - a.prefixLength,
  ),
);

const IPV6_ALLOCATED_RULES = Object.freeze(
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

/** @param {bigint} value @param {number} bits @param {CidrRule} rule */
function cidrMatch(value: bigint, bits: number, rule: CidrRule) {
  const shift = BigInt(bits - rule.prefixLength);
  return (shift === 0n ? value : (value >> shift) << shift) === rule.prefix;
}

/** @param {number} family @param {bigint} value @param {readonly CidrRule[]} rules */
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

/** @param {bigint} value */
function globallyReachableIpv4(value: bigint) {
  const match = longestMatch(4, value, CIDR_RULES);
  return match ? match.globallyReachable === true : true;
}

/** @param {bigint} value */
function globallyReachableIpv6(value: bigint) {
  const special = longestMatch(6, value, CIDR_RULES);
  if (special) return special.globallyReachable === true;
  return longestMatch(6, value, IPV6_ALLOCATED_RULES) != null;
}

/** @param {unknown} address */
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

/** @param {unknown} rawProfile */
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

/** @param {unknown} authority */
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
    !policyValue ||
    policyValue.status !== "candidate" ||
    policyValue.authorization !== "authority_verification_required"
  ) {
    return Object.freeze({
      decision: "deny",
      reason: "policy_candidate_required",
    });
  }
  if (!requestValue || requestValue.method !== "CONNECT") {
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

/** @param {unknown} addresses */
export function evaluateResolvedAddressesForFixture(addresses: unknown) {
  const snapshot = snapshotPlainArray<unknown>(
    addresses,
    Number.MAX_SAFE_INTEGER,
  );
  if (snapshot.status !== "ok" || snapshot.value.length === 0) {
    return Object.freeze({ decision: "deny", reason: "dns_result_required" });
  }
  for (const address of snapshot.value) {
    const classification = classifyAddress(address);
    if (classification == null)
      return Object.freeze({ decision: "deny", reason: "dns_address_invalid" });
    if (!classification)
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

export function describeEgressProxyTopology() {
  return Object.freeze({
    providerNetwork: "operation_internal",
    providerNetworkInternal: true,
    providerDirectExternalNetwork: false,
    proxyNetworks: Object.freeze(["operation_internal", "proxy_egress"]),
    dockerSocketMounted: false,
    hostNetworkModeAllowed: false,
    localFallbackAllowed: false,
    enforcement: "not_implemented",
  });
}
