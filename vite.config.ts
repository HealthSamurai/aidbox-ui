import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import claudeChat from "./vite-plugin-claude-chat.ts";

const ReactCompilerConfig = {};

export default defineConfig({
	base: "./",
	optimizeDeps: {
		exclude: ["@health-samurai/aidbox-fhirpath-lsp"],
	},
	// server: {
	// 	fs: {
	// 		allow: [".."],
	// 	},
	// },
	plugins: [
		{
			name: "inject-base-href",
			transformIndexHtml: {
				order: "pre",
				handler(html, ctx) {
					const href = ctx.server ? "/" : "/static/aidbox-ui/";
					return html.replace("<head>", `<head>\n\t<base href="${href}">`);
				},
			},
		},
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
	},
});
