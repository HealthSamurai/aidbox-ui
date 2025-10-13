.PHONY: all format typecheck lint-fix

all: format typecheck lint-fix

format:
	pnpm run format

lint-fix:
	pnpm exec biome check --write --unsafe

typecheck:
	pnpm run typecheck
