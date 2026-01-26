import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ReactCompilerConfig = {};

export default defineConfig({
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
	},
	server: {
		fs: {
			// TODO: Remove.
			// Allow serving files from linked packages in aidbox-ts-sdk
			allow: [".", "../aidbox-ts-sdk"],
		},
	},
});
