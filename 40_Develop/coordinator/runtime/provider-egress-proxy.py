import base64
import hmac
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
AUTH_TOKEN_PATTERN = re.compile(r"[0-9a-f]{64}")
AUTHORITY_PATTERN = re.compile(
    r"(?P<hostname>[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?):443"
)
MAXIMUM_HEADER_BYTES = 8192
MAXIMUM_TUNNEL_BYTES_PER_DIRECTION = 16 * 1024 * 1024
MAXIMUM_DNS_ADDRESSES = 16
CONNECT_TIMEOUT_SECONDS = 15
IDLE_TIMEOUT_SECONDS = 120


def emit(outcome, hostname=None):
    record = {"event": "crdd_provider_proxy", "outcome": outcome}
    if hostname in ALLOWED_HOSTNAMES:
        record["hostname"] = hostname
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
    for address in addresses:
        family = socket.AF_INET6 if ":" in address else socket.AF_INET
        remote = socket.socket(family, socket.SOCK_STREAM)
        remote.settimeout(CONNECT_TIMEOUT_SECONDS)
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
        except (OSError, TimeoutError, ValueError):
            try:
                send_response(self.request, 502, "Bad Gateway")
            except OSError:
                pass
            emit("tunnel_failed", hostname)
        finally:
            if remote is not None:
                remote.close()


class BoundedThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = False
    daemon_threads = True
    request_queue_size = 16


def main():
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

