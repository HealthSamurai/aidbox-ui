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
		// NOTE: uncomment for local development of fhirpath-lsp
		// dedupe: [
		// 	"@codemirror/autocomplete",
		// 	"@codemirror/state",
		// 	"@codemirror/view",
		// ],
	},
});
