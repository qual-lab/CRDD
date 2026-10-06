# Workbench助言向けに未改造の公式Codexと公式Hostを配置する。
# @responsibility Codex本体をコンパイルせず既存Docker隔離へ公式配布物を接続する。
# @trace ARCH-000010
# Runtimeへの接続・署名・E2E成立は、このBuild定義だけでは主張しない。
FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=0:0 --chmod=0555 codex /opt/crdd/providers/codex/0.159.2/codex
COPY --chown=0:0 --chmod=0555 codex-code-mode-host /opt/crdd/providers/codex/0.159.2/codex-code-mode-host
COPY --from=crdd-codex@sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c --chown=0:0 --chmod=0555 /opt/crdd/providers/codex/0.149.1/codex-resources/bwrap /opt/crdd/providers/codex/0.159.2/codex-resources/bwrap

WORKDIR /work
USER 65534:65534
ENTRYPOINT ["/opt/crdd/providers/codex/0.159.2/codex"]
CMD []
