FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=65534:65534 --chmod=0555 codex /opt/crdd/providers/codex/0.149.1/codex
COPY --chown=0:0 --chmod=0444 codex-result-schema.json /etc/crdd/codex-result-schema.json
RUN chmod 0555 /etc/crdd

WORKDIR /work
USER 65534:65534
ENTRYPOINT ["/opt/crdd/providers/codex/0.149.1/codex"]
