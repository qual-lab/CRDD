FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=65534:65534 --chmod=0444 provider-egress-proxy.py /opt/crdd/provider-egress-proxy.py
RUN chmod 0555 /opt/crdd

USER 65534:65534
ENTRYPOINT ["/usr/local/bin/python", "/opt/crdd/provider-egress-proxy.py"]
