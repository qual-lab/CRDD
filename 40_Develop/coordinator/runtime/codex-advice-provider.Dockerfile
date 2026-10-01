# Workbench読取り助言専用CLIと公式Hostの固定配布候補。
# @responsibility 通常Executor／Reviewerから分離した実行物を配置する。
# @trace ARCH-000010
# Runtimeへの接続・署名・E2E成立は、このBuild定義だけでは主張しない。
FROM python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047

COPY --chown=0:0 --chmod=0555 codex-advice /opt/crdd/providers/codex-advice/0.159.2/codex-advice
COPY --chown=0:0 --chmod=0555 codex-code-mode-host /opt/crdd/providers/codex-advice/0.159.2/codex-code-mode-host
COPY --chown=0:0 --chmod=0555 bwrap /opt/crdd/providers/codex-advice/0.159.2/codex-resources/bwrap

WORKDIR /work
USER 65534:65534
ENTRYPOINT ["/opt/crdd/providers/codex-advice/0.159.2/codex-advice"]
CMD []
