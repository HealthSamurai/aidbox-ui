import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ReactCompilerConfig = {};

export default defineConfig({
	optimizeDeps: {
		exclude: ["@health-samurai/aidbox-fhirpath-lsp"],
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
			},
		}),
	],
	resolve: {
		alias: {
			"@aidbox-ui": "/src",
		},
		dedupe: ["@codemirror/state", "@codemirror/view"],
	},
});
