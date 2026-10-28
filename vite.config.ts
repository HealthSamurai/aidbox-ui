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
					if (ctx.server) {
						return html.replace("<head>", `<head>\n\t<base href="/">`);
					}
					// The backend rewrites this exact <base> tag with the BOX_WEB_BASE_URL path.
					// The script then derives the prefix from the browser URL instead, since a
					// gateway may add one Aidbox doesn't know about. Keep in sync with getPathPrefix.
					return html.replace(
						"<head>",
						`<head>
	<base href="/static/aidbox-ui/">
	<script>(function(){var p=location.pathname+"/",i=p.indexOf("/u/");if(i!==-1)document.querySelector("base").href=p.slice(0,i)+"/static/aidbox-ui/"})()</script>`,
					);
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
