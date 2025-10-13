.PHONY: all format typecheck lint-fix

all: format typecheck lint-fix

format:
	pnpm run format

lint-fix:
	pnpm exec biome check --write --diagnostic-level=error

typecheck:
	pnpm run typecheck
