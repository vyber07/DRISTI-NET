# Machine-local environment for DRISHTI-NET.
# Usage:  source scripts/env.sh
# 2026-09-12: this host has real root + Docker + a system ClamAV (apt), so most of the user-space
# workarounds below are no longer needed here -- kept for hosts that still have no root, where
# ~/.cache/drishti/{clamav,redis} user-space builds are the fallback (see TASK_BOARD.md).
export PATH="$HOME/.nvm/versions/node/v24.17.0/bin:$HOME/.cache/drishti/clamav/root/usr/local/bin:$HOME/.cache/drishti/redis/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.cache/drishti/clamav/root/usr/local/lib:$HOME/.cache/drishti/chromelibs/lib:${LD_LIBRARY_PATH:-}"
export NO_PROXY="localhost,127.0.0.1,${NO_PROXY:-}" no_proxy="localhost,127.0.0.1,${no_proxy:-}"           # corporate proxy must not intercept localhost
