export type ImportMethod = "registry" | "url" | "file";

export interface ImportPackageActions {
	getImportMethod: () => ImportMethod;
	setImportMethod: (method: ImportMethod) => void;
	searchRegistryPackage: (query: string) => { name: string; version: string }[];
	selectRegistryPackage: (id: string) => void;
	getPackagesToInstall: () => { method: string; packages: unknown[] };
	addUrl: (url: string) => void;
	importPackages: () => Promise<string>;
	getImportStatus: () => { status: "none" | "loading" | "error" };
	getImportLogs: () => string[];
}
