.DEFAULT_GOAL := help
.PHONY: help dev test build preview lint

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: ## Start the Vite dev server
	npm run dev

test: ## Run unit tests
	npm test

build: ## Build for production
	npm run build

preview: ## Serve the production build locally
	npm run preview

lint: ## Run ESLint
	npm run lint
