import base64
import hmac
import hashlib
import ipaddress
import json
import os
import re
import selectors
import socket
import socketserver
import sys
import time


PROFILE_ALLOWED_HOSTNAMES = {
    "claude": frozenset(
        {"api.anthropic.com", "claude.ai", "platform.claude.com"}
    ),
    "codex": frozenset({"auth.openai.com", "chatgpt.com"}),
}
PROXY_PROFILE = os.environ.get("CRDD_PROXY_PROFILE", "")
ALLOWED_HOSTNAMES = PROFILE_ALLOWED_HOSTNAMES.get(PROXY_PROFILE, frozenset())
NETWORK_POLICY_HASH = None


def read_network_policy(raw, profile):
    """固定Hostと閉じた実行用設定を照合する。認可やRepository読取りは行わない。"""
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate_key")
            result[key] = value
        return result

    if len(raw.encode("utf-8")) > 16384:
        raise ValueError("policy_size")
    policy = json.loads(raw, object_pairs_hook=unique_object)
    if not isinstance(policy, dict) or set(policy) != {
        "contractRevision", "purpose", "provider", "allowedHosts",
        "allowedPort", "allowedMethod", "policyHash",
    }:
        raise ValueError("policy_shape")
    hosts = policy["allowedHosts"]
    if (type(policy["contractRevision"]) is not int or policy["contractRevision"] != 1
            or policy["purpose"] != "repository_ai_execution"
            or policy["provider"] != profile
            or type(policy["allowedPort"]) is not int or policy["allowedPort"] != 443
            or policy["allowedMethod"] != "CONNECT"
            or not isinstance(hosts, list) or not 1 <= len(hosts) <= 35):
        raise ValueError("policy_value")
    for host in hosts:
        if (not isinstance(host, str) or not host.isascii() or len(host) > 253
                or host != host.lower()
                or any(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) is None
                       for label in host.split("."))):
            raise ValueError("hostname")
        # WHATWGのIPv4数値表記（短縮・整数・16進・8進を含む）を拒否する。
        last = host.rsplit(".", 1)[-1]
        if re.fullmatch(r"[0-9]+|0x[0-9a-f]*", last):
            raise ValueError("numeric_address")
    fixed = PROFILE_ALLOWED_HOSTNAMES.get(profile)
    if fixed is None or hosts != sorted(set(hosts)) or not fixed.issubset(hosts) or len(set(hosts) - fixed) > 32:
        raise ValueError("policy_hosts")
    payload = json.dumps([1, "repository_ai_execution", profile, hosts, 443, "CONNECT"], separators=(",", ":"))
    expected = hashlib.sha256(b"crdd-docker-network-policy-v1\0" + payload.encode("ascii")).hexdigest()
    if not isinstance(policy["policyHash"], str) or not hmac.compare_digest(policy["policyHash"], expected):
        raise ValueError("policy_hash")
    return frozenset(hosts), expected


NETWORK_POLICY_VALID = True
if "CRDD_PROXY_NETWORK_POLICY" in os.environ:
    try:
        ALLOWED_HOSTNAMES, NETWORK_POLICY_HASH = read_network_policy(
            os.environ["CRDD_PROXY_NETWORK_POLICY"], PROXY_PROFILE
        )
    except (ValueError, TypeError, UnicodeError):
        NETWORK_POLICY_VALID = False
        ALLOWED_HOSTNAMES = frozenset()
AUTH_TOKEN_PATTERN = re.compile(r"[0-9a-f]{64}")
AUTHORITY_PATTERN = re.compile(
    r"(?P<hostname>[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?):443"
)
MAXIMUM_HEADER_BYTES = 8192
MAXIMUM_TUNNEL_BYTES_PER_DIRECTION = 16 * 1024 * 1024
MAXIMUM_DNS_ADDRESSES = 32
CONNECT_TIMEOUT_SECONDS = 15
IDLE_TIMEOUT_SECONDS = 120


def emit(outcome, hostname=None, reason=None):
    record = {"event": "crdd_provider_proxy", "outcome": outcome}
    if NETWORK_POLICY_HASH is not None:
        record["networkPolicyHash"] = NETWORK_POLICY_HASH
    if hostname in ALLOWED_HOSTNAMES:
        record["hostname"] = hostname
    if reason in {"dns_answer_count_invalid", "dns_address_not_public", "dns_resolution_failed", "request_or_connection_failed"}:
        record["reason"] = reason
    print(json.dumps(record, separators=(",", ":"), sort_keys=True), flush=True)


def send_response(connection, status, reason, headers=()):
    lines = [f"HTTP/1.1 {status} {reason}", "Connection: close"]
    lines.extend(headers)
    connection.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("ascii"))


def read_request(connection):
    received = bytearray()
    while b"\r\n\r\n" not in received:
        chunk = connection.recv(2048)
        if not chunk:
            raise ValueError("request_incomplete")
        received.extend(chunk)
        if len(received) > MAXIMUM_HEADER_BYTES:
            raise ValueError("request_too_large")
    header, remainder = bytes(received).split(b"\r\n\r\n", 1)
    try:
        lines = header.decode("ascii").split("\r\n")
    except UnicodeDecodeError as error:
        raise ValueError("request_non_ascii") from error
    if not lines or len(lines) > 64:
        raise ValueError("request_invalid")
    request_parts = lines[0].split(" ")
    if len(request_parts) != 3 or request_parts[0] != "CONNECT":
        raise PermissionError("connect_required")
    if request_parts[2] not in {"HTTP/1.0", "HTTP/1.1"}:
        raise ValueError("http_version_invalid")
    authority_match = AUTHORITY_PATTERN.fullmatch(request_parts[1])
    if authority_match is None:
        raise PermissionError("authority_invalid")
    headers = {}
    for line in lines[1:]:
        if ":" not in line:
            raise ValueError("header_invalid")
        name, value = line.split(":", 1)
        normalized_name = name.strip().lower()
        normalized_value = value.strip()
        if not normalized_name or normalized_name in headers:
            raise ValueError("header_invalid")
        headers[normalized_name] = normalized_value
    return authority_match.group("hostname"), headers, remainder


def authorized(headers, token):
    encoded = base64.b64encode(f"crdd:{token}".encode("ascii")).decode("ascii")
    return hmac.compare_digest(
        headers.get("proxy-authorization", ""), f"Basic {encoded}"
    )


def resolve_public_addresses(hostname):
    answers = socket.getaddrinfo(
        hostname,
        443,
        family=socket.AF_UNSPEC,
        type=socket.SOCK_STREAM,
        proto=socket.IPPROTO_TCP,
    )
    addresses = sorted({answer[4][0] for answer in answers})
    if not addresses or len(addresses) > MAXIMUM_DNS_ADDRESSES:
        raise ValueError("dns_answer_count_invalid")
    for address in addresses:
        parsed = ipaddress.ip_address(address)
        if (
            not parsed.is_global
            or parsed.is_private
            or parsed.is_loopback
            or parsed.is_link_local
            or parsed.is_multicast
            or parsed.is_reserved
            or parsed.is_unspecified
        ):
            raise ValueError("dns_address_not_public")
    return addresses


def connect_exact_address(addresses):
    last_error = None
    deadline = time.monotonic() + CONNECT_TIMEOUT_SECONDS
    for address in addresses:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        family = socket.AF_INET6 if ":" in address else socket.AF_INET
        remote = socket.socket(family, socket.SOCK_STREAM)
        remote.settimeout(remaining)
        try:
            remote.connect((address, 443))
            remote.settimeout(None)
            return remote
        except OSError as error:
            last_error = error
            remote.close()
    raise OSError("all_exact_addresses_failed") from last_error


def relay(client, remote, initial):
    if initial:
        remote.sendall(initial)
    selector = selectors.DefaultSelector()
    selector.register(client, selectors.EVENT_READ, (client, remote, "client"))
    selector.register(remote, selectors.EVENT_READ, (remote, client, "remote"))
    transferred = {"client": len(initial), "remote": 0}
    deadline = time.monotonic() + IDLE_TIMEOUT_SECONDS
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("tunnel_idle_timeout")
            events = selector.select(remaining)
            if not events:
                raise TimeoutError("tunnel_idle_timeout")
            deadline = time.monotonic() + IDLE_TIMEOUT_SECONDS
            for key, _mask in events:
                source, destination, direction = key.data
                data = source.recv(65536)
                if not data:
                    return
                transferred[direction] += len(data)
                if transferred[direction] > MAXIMUM_TUNNEL_BYTES_PER_DIRECTION:
                    raise ValueError("tunnel_byte_limit_exceeded")
                destination.sendall(data)
    finally:
        selector.close()


class ProxyHandler(socketserver.BaseRequestHandler):
    def handle(self):
        hostname = None
        remote = None
        self.request.settimeout(CONNECT_TIMEOUT_SECONDS)
        try:
            hostname, headers, remainder = read_request(self.request)
            if not authorized(headers, self.server.auth_token):
                send_response(
                    self.request,
                    407,
                    "Proxy Authentication Required",
                    ("Proxy-Authenticate: Basic realm=crdd",),
                )
                emit("authentication_denied")
                return
            if hostname not in ALLOWED_HOSTNAMES:
                send_response(self.request, 403, "Forbidden")
                emit("hostname_denied")
                return
            addresses = resolve_public_addresses(hostname)
            remote = connect_exact_address(addresses)
            send_response(self.request, 200, "Connection Established")
            emit("tunnel_established", hostname)
            relay(self.request, remote, remainder)
            emit("tunnel_closed", hostname)
        except PermissionError:
            send_response(self.request, 405, "Method Not Allowed")
            emit("request_denied")
        except (OSError, TimeoutError, ValueError) as error:
            try:
                send_response(self.request, 502, "Bad Gateway")
            except OSError:
                pass
            reason = (
                str(error) if isinstance(error, ValueError) and str(error) in {"dns_answer_count_invalid", "dns_address_not_public"}
                else "dns_resolution_failed" if isinstance(error, socket.gaierror)
                else "request_or_connection_failed"
            )
            emit("tunnel_failed", hostname, reason)
        finally:
            if remote is not None:
                remote.close()


class BoundedThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = False
    daemon_threads = True
    request_queue_size = 16


def main():
    if not NETWORK_POLICY_VALID:
        emit("startup_network_policy_invalid")
        return 2
    if PROXY_PROFILE not in PROFILE_ALLOWED_HOSTNAMES:
        emit("startup_profile_invalid")
        return 2
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        print(
            json.dumps(
                {
                    "allowedHostnames": sorted(ALLOWED_HOSTNAMES),
                    "maximumHeaderBytes": MAXIMUM_HEADER_BYTES,
                    "maximumTunnelBytesPerDirection": MAXIMUM_TUNNEL_BYTES_PER_DIRECTION,
                    "status": "accepted",
                },
                separators=(",", ":"),
                sort_keys=True,
            )
        )
        return 0
    token = os.environ.get("CRDD_PROXY_AUTH", "")
    if AUTH_TOKEN_PATTERN.fullmatch(token) is None:
        emit("startup_auth_invalid")
        return 2
    with BoundedThreadingServer(("0.0.0.0", 8080), ProxyHandler) as server:
        server.auth_token = token
        emit("ready")
        server.serve_forever(poll_interval=0.25)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

