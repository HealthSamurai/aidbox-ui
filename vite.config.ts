import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import claudeChat from "./vite-plugin-claude-chat.ts";

const ReactCompilerConfig = {};

export default defineConfig({
	optimizeDeps: {
		exclude: ["@health-samurai/aidbox-fhirpath-lsp"],
	},
	// server: {
	// 	fs: {
	// 		allow: [".."],
	// 	},
	// },
	plugins: [
		claudeChat(),
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

		// dedupe: [
		// 	"@codemirror/autocomplete",
		// 	"@codemirror/state",
		// 	"@codemirror/view",
		// ],
	},
});
