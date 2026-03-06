#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="$ROOT/aidbox-ts-sdk/packages/react-components"

write_workspace_override() {
  cat > "$ROOT/pnpm-workspace.yaml" <<EOF
overrides:
  '@health-samurai/react-components': link:./aidbox-ts-sdk/packages/react-components
EOF
}

case "$1" in
  init)
    git -C "$ROOT" submodule update --init
    git -C "$ROOT/aidbox-ts-sdk" fetch --depth 1 origin development:development
    git -C "$ROOT/aidbox-ts-sdk" checkout development
    pnpm --dir "$SDK" install
    pnpm --dir "$SDK" build
    write_workspace_override
    pnpm --dir "$ROOT" install
    ;;
  update)
    git -C "$ROOT/aidbox-ts-sdk" pull origin development
    pnpm --dir "$SDK" install
    pnpm --dir "$SDK" build
    pnpm --dir "$ROOT" install
    ;;
  *)
    echo "Usage: $0 {init|update}" >&2
    exit 1
    ;;
esac
