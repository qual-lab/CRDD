import net from "node:net";

export const EGRESS_PROXY_CONTRACT = "crdd-coordinator/provider-egress-proxy";
export const EGRESS_PROXY_CONTRACT_REVISION = 1;

function blocked(reason) {
  return Object.freeze({ status: "blocked", reason, policy: null });
}

function hostnameFromOrigin(origin) {
  const parsed = new URL(origin);
  return parsed.hostname.toLowerCase();
}

export function compileEgressProxyPolicyCandidate(profileValidation) {
  if (
    profileValidation?.status !== "candidate" ||
    profileValidation?.reason !== "authority_verification_required" ||
    !profileValidation.profile ||
    !/^[a-f0-9]{64}$/u.test(profileValidation.profileHash ?? "")
  ) return blocked("profile_candidate_required");

  const hostnames = profileValidation.profile.egress?.origins?.map(hostnameFromOrigin);
  if (!Array.isArray(hostnames) || hostnames.length === 0 || new Set(hostnames).size !== hostnames.length) {
    return blocked("profile_origins_invalid");
  }
  const policy = Object.freeze({
    contract: EGRESS_PROXY_CONTRACT,
    contractRevision: EGRESS_PROXY_CONTRACT_REVISION,
    status: "candidate",
    authorization: "authority_verification_required",
    profileHash: profileValidation.profileHash,
    provider: profileValidation.profile.provider,
    allowedHostnames: Object.freeze([...hostnames].sort()),
    allowedPort: 443,
    allowedMethod: "CONNECT",
    directProviderEgress: false,
    ipLiteralAllowed: false,
    privateAddressAllowed: false
  });
  return Object.freeze({ status: "candidate", reason: "authority_verification_required", policy });
}

function parseConnectAuthority(authority) {
  if (typeof authority !== "string" || authority.length > 255 || authority.includes("@")) return null;
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?):([0-9]{1,5})$/u.exec(authority);
  if (!match) return null;
  const hostname = match[1].toLowerCase();
  const port = Number.parseInt(match[2], 10);
  if (hostname.endsWith(".") || hostname.includes("..") || net.isIP(hostname) !== 0) return null;
  return { hostname, port };
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

function publicIpv4(address) {
  const octets = address.split(".").map(Number);
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && [0, 2].includes(octets[2])) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && octets[2] === 100) return false;
  if (a === 203 && b === 0 && octets[2] === 113) return false;
  return true;
}

function publicIpv6(address) {
  const normalized = address.toLowerCase();
  return !(
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("::ffff:")
  );
}

export function evaluateResolvedAddressesForFixture(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return Object.freeze({ decision: "deny", reason: "dns_result_required" });
  }
  for (const address of addresses) {
    const family = net.isIP(address);
    if (family === 0) return Object.freeze({ decision: "deny", reason: "dns_address_invalid" });
    if ((family === 4 && !publicIpv4(address)) || (family === 6 && !publicIpv6(address))) {
      return Object.freeze({ decision: "deny", reason: "dns_address_not_public" });
    }
  }
  return Object.freeze({ decision: "candidate", reason: "runtime_proxy_enforcement_required" });
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
