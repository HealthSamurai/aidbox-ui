import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const MODULE_ID = "virtual:customizable-messages-schema";
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;

/**
 * Where the box keeps the JSON schema of SDC customizable messages, when
 * aidbox-ui is built inside the sansara checkout (`box/aidbox-ui`).
 */
const SANSARA_SCHEMA_PATH = "../resources/sdc/customizable-messages-schema.json";

/**
 * Serves `virtual:customizable-messages-schema`: the schema the SDCConfig
 * builder validates and completes `translations` against. The path comes from
 * `CUSTOMIZABLE_MESSAGES_SCHEMA_PATH`, else from the sansara checkout; with
 * neither the module exports `null` and the field is plain JSON.
 */
export default function customizableMessagesSchema(
	schemaPath = process.env.CUSTOMIZABLE_MESSAGES_SCHEMA_PATH,
): Plugin {
	const resolvePath = () => {
		if (schemaPath) return path.resolve(process.cwd(), schemaPath);
		const fallback = path.resolve(process.cwd(), SANSARA_SCHEMA_PATH);
		return fs.existsSync(fallback) ? fallback : undefined;
	};

	return {
		name: "customizable-messages-schema",
		resolveId(source) {
			return source === MODULE_ID ? RESOLVED_MODULE_ID : null;
		},
		load(id) {
			if (id !== RESOLVED_MODULE_ID) return null;
			const absolutePath = resolvePath();
			if (!absolutePath) return "export default null;";
			this.addWatchFile(absolutePath);
			let schema: unknown;
			try {
				schema = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`Failed to load customizable messages schema (${absolutePath}): ${message}`,
				);
			}
			return `export default ${JSON.stringify(schema)};`;
		},
	};
}
