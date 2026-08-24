FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=65534:65534 --chmod=0444 claude-egress-proxy.py /opt/crdd/claude-egress-proxy.py

USER 65534:65534
ENTRYPOINT ["/usr/local/bin/python", "/opt/crdd/claude-egress-proxy.py"]
