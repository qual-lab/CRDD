import { createHash } from "node:crypto";
import net from "node:net";

import { validateProviderIsolationProfile } from "./provider-isolation-profile.mjs";

export const EGRESS_PROXY_CONTRACT = "crdd-coordinator/provider-egress-proxy";
export const EGRESS_PROXY_CONTRACT_REVISION = 1;

const REGISTRY_METADATA = Object.freeze({
  registryLastUpdated: "2025-10-09",
  reviewedAt: "2026-08-11",
  ipv4Registry: "https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml",
  ipv6Registry: "https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml",
  decisionField: "Globally Reachable",
  unknownDecision: "deny"
});

// More-specific entries override their parents. `null` is an IANA N/A/blank
// value and is denied. Protocol-level non-unicast/legacy ranges are included
// as conservative supplements and are identified separately.
const SPECIAL_PURPOSE_ENTRIES = Object.freeze([
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
  [6, "ff00::/8", false, "protocol-non-unicast"]
]);

function blocked(reason) {
  return Object.freeze({ status: "blocked", reason, policy: null });
}

function parseIpv4(address) {
  if (typeof address !== "string" || !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(address)) return null;
  const octets = address.split(".").map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

function parseIpv6(address) {
  if (typeof address !== "string" || address.includes("%") || address.length === 0) return null;
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
  const [leftSource, rightSource = ""] = source.split("::");
  const left = leftSource ? leftSource.split(":") : [];
  const right = rightSource ? rightSource.split(":") : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/u.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((compressed && missing < 1) || (!compressed && missing !== 0)) return null;
  const words = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (words.length !== 8) return null;
  return words.reduce((value, word) => (value << 16n) | BigInt(`0x${word}`), 0n);
}

function parseCidr(family, cidr, globallyReachableValue, source) {
  const [address, prefixText] = cidr.split("/");
  const bits = family === 4 ? 32 : 128;
  const prefixLength = Number(prefixText);
  const value = family === 4 ? parseIpv4(address) : parseIpv6(address);
  if (value == null || !Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > bits) {
    throw new Error("invalid_special_purpose_registry_snapshot");
  }
  const shift = BigInt(bits - prefixLength);
  return Object.freeze({
    family,
    prefixLength,
    prefix: shift === 0n ? value : (value >> shift) << shift,
    globallyReachable: globallyReachableValue,
    source
  });
}

const CIDR_RULES = Object.freeze(SPECIAL_PURPOSE_ENTRIES
  .map((entry) => parseCidr(...entry))
  .sort((a, b) => b.prefixLength - a.prefixLength));

const SPECIAL_PURPOSE_REGISTRY_SNAPSHOT_SHA256 = createHash("sha256")
  .update(JSON.stringify({ metadata: REGISTRY_METADATA, entries: SPECIAL_PURPOSE_ENTRIES }))
  .digest("hex");

function cidrMatch(value, bits, rule) {
  const shift = BigInt(bits - rule.prefixLength);
  return (shift === 0n ? value : (value >> shift) << shift) === rule.prefix;
}

function globallyReachable(family, value) {
  const bits = family === 4 ? 32 : 128;
  const match = CIDR_RULES.find((rule) => rule.family === family && cidrMatch(value, bits, rule));
  return match ? match.globallyReachable === true : true;
}

function classifyAddress(address) {
  if (typeof address !== "string" || address.includes("%")) return null;
  if (net.isIP(address) === 4) {
    const value = parseIpv4(address);
    return value == null ? null : globallyReachable(4, value);
  }
  if (net.isIP(address) !== 6) return null;
  const value = parseIpv6(address);
  if (value == null) return null;
  const high96 = value >> 32n;
  if (high96 === 0xffffn) return globallyReachable(4, value & 0xffffffffn);
  if (high96 === 0n) return false;
  return globallyReachable(6, value);
}

export function compileEgressProxyPolicyCandidate(rawProfile) {
  let validation;
  try {
    validation = validateProviderIsolationProfile(rawProfile);
  } catch {
    return blocked("profile_candidate_invalid");
  }
  if (validation.status !== "candidate" || validation.reason !== "authority_verification_required") {
    return blocked("profile_candidate_required");
  }
  try {
    const hostnames = validation.profile.egress.origins.map((origin) => new URL(origin).hostname.toLowerCase());
    if (hostnames.length === 0 || new Set(hostnames).size !== hostnames.length) {
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
      privateAddressAllowed: false
    });
    return Object.freeze({ status: "candidate", reason: "authority_verification_required", policy });
  } catch {
    return blocked("profile_origins_invalid");
  }
}

function parseConnectAuthority(authority) {
  if (typeof authority !== "string" || authority.length > 255 || /[\u0000-\u0020\u007f]/u.test(authority)) return null;
  const match = /^([A-Za-z0-9.-]+):443$/u.exec(authority);
  if (!match) return null;
  const hostname = match[1].toLowerCase();
  const labels = hostname.split(".");
  if (
    net.isIP(hostname) !== 0 ||
    labels.some((label) => label.length === 0 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label))
  ) return null;
  return { hostname, port: 443 };
}

export function evaluateProxyConnectForFixture(policy, request) {
  if (policy?.status !== "candidate" || policy?.authorization !== "authority_verification_required") {
    return Object.freeze({ decision: "deny", reason: "policy_candidate_required" });
  }
  if (request?.method !== "CONNECT") return Object.freeze({ decision: "deny", reason: "connect_method_required" });
  const target = parseConnectAuthority(request.authority);
  if (!target) return Object.freeze({ decision: "deny", reason: "connect_authority_invalid" });
  if (target.port !== policy.allowedPort) return Object.freeze({ decision: "deny", reason: "connect_port_not_allowed" });
  if (!policy.allowedHostnames.includes(target.hostname)) {
    return Object.freeze({ decision: "deny", reason: "connect_hostname_not_allowed" });
  }
  return Object.freeze({ decision: "candidate", reason: "authority_and_dns_verification_required", hostname: target.hostname, port: target.port });
}

export function evaluateResolvedAddressesForFixture(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return Object.freeze({ decision: "deny", reason: "dns_result_required" });
  }
  for (const address of addresses) {
    const classification = classifyAddress(address);
    if (classification == null) return Object.freeze({ decision: "deny", reason: "dns_address_invalid" });
    if (!classification) return Object.freeze({ decision: "deny", reason: "dns_address_not_public" });
  }
  return Object.freeze({ decision: "candidate", reason: "runtime_proxy_enforcement_required" });
}

export function describeSpecialPurposeRegistrySnapshot() {
  return Object.freeze({
    ...REGISTRY_METADATA,
    snapshotSha256: SPECIAL_PURPOSE_REGISTRY_SNAPSHOT_SHA256,
    matching: "longest_prefix",
    mappedIpv6: "evaluate_as_ipv4",
    compatibleIpv6: "deny"
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
    enforcement: "not_implemented"
  });
}
