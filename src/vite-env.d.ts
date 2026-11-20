/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_AIDBOX_BASE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "virtual:customizable-messages-schema" {
	const schema: object | null;
	export default schema;
}
