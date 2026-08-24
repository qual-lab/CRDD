FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=65534:65534 --chmod=0555 claude /opt/crdd/providers/claude/2.1.220/claude
COPY --chown=0:0 --chmod=0444 claude-managed-settings.json /etc/claude-code/managed-settings.json
COPY --chown=0:0 --chmod=0444 claude-task-settings.json /etc/crdd/claude-task-settings.json
RUN chmod 0555 /etc/claude-code /etc/crdd

WORKDIR /work
USER 65534:65534
ENTRYPOINT ["/opt/crdd/providers/claude/2.1.220/claude"]
