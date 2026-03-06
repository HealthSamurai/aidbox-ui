import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileArchive, Globe, Search, Terminal, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { getAidboxBaseURL } from "../../utils";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import { useWebMCPImportPackage } from "../../webmcp/import-package";
import type { ImportPackageActions } from "../../webmcp/import-package-context";

type ImportMethod = "registry" | "url" | "file";
type ProgressEntry = { msg: string };

function useImportProgress() {
	const [entries, setEntries] = useState<ProgressEntry[]>([]);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const base = getAidboxBaseURL();
		const wsUrl = base.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
		const ws = new WebSocket(`${wsUrl}/__fhir-npm-package-upload-logs-ws`);
		wsRef.current = ws;
		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				setEntries((prev) => [...prev, { msg: data?.msg ?? event.data }]);
			} catch {
				setEntries((prev) => [...prev, { msg: event.data }]);
			}
		};
		return () => ws.close();
	}, []);

	const clear = useCallback(() => setEntries([]), []);
	return { entries, clear };
}

function ProgressInline({ entries }: { entries: ProgressEntry[] }) {
	const [open, setOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const entryCount = entries.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new entries
	useEffect(() => {
		if (open && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [open, entryCount]);

	if (entries.length === 0) return null;

	const lastMsg = entries[entries.length - 1].msg;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
			>
				<Terminal className="size-3.5 shrink-0 text-text-secondary" />
				<span className="truncate text-xs text-text-secondary">{lastMsg}</span>
			</button>

			<HSComp.Dialog open={open} onOpenChange={setOpen}>
				<HSComp.DialogContent className="max-w-2xl">
					<HSComp.DialogHeader>
						<HSComp.DialogTitle>Import logs</HSComp.DialogTitle>
					</HSComp.DialogHeader>
					<div
						ref={scrollRef}
						className="h-80 overflow-y-auto rounded border border-border-secondary bg-bg-secondary p-3"
					>
						{entries.map((entry, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: log entries
								key={i}
								className="block whitespace-nowrap text-xs text-text-secondary"
							>
								{entry.msg}
							</span>
						))}
					</div>
				</HSComp.DialogContent>
			</HSComp.Dialog>
		</>
	);
}

async function toastResponseError(res: Response) {
	const body = await res.text();
	try {
		const parsed = JSON.parse(body);
		if (isOperationOutcome(parsed)) {
			Utils.toastOperationOutcome(parsed);
			return;
		}
		if (parsed.message) {
			Utils.toastError("Import failed", parsed.message);
			return;
		}
	} catch {}
	Utils.toastError("Import failed", body || `HTTP ${res.status}`);
}

const METHOD_CARDS: {
	id: ImportMethod;
	title: string;
	description: string;
	icon: React.ReactNode;
}[] = [
	{
		id: "registry",
		title: "From Registry",
		description: "Search and import packages from the FHIR package registry",
		icon: <Search className="size-4" />,
	},
	{
		id: "file",
		title: "From File",
		description: "Upload .tar.gz package files from your computer",
		icon: <FileArchive className="size-4" />,
	},
	{
		id: "url",
		title: "From URL",
		description: "Provide direct URLs to .tar.gz package files",
		icon: <Globe className="size-4" />,
	},
];

function MethodPicker({
	selected,
	onSelect,
}: {
	selected: ImportMethod;
	onSelect: (m: ImportMethod) => void;
}) {
	return (
		<div className="grid grid-cols-3 gap-3">
			{METHOD_CARDS.map((card) => (
				<button
					key={card.id}
					type="button"
					onClick={() => onSelect(card.id)}
					className={HSComp.cn(
						"flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
						selected === card.id
							? "border-border-primary bg-bg-secondary"
							: "border-border-secondary hover:border-border-primary hover:bg-bg-hover",
					)}
				>
					<span className="mt-0.5 text-text-secondary">{card.icon}</span>
					<div>
						<span className="block text-sm font-medium text-text-primary">
							{card.title}
						</span>
						<span className="mt-0.5 block text-xs text-text-secondary">
							{card.description}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}

const registrySkeletonRows = Array.from({ length: 15 }, (_, i) => (
	// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
	<HSComp.TableRow key={`skeleton-${i}`} zebra index={i}>
		<HSComp.TableCell className="w-10">
			<HSComp.Skeleton className="size-4 rounded" />
		</HSComp.TableCell>
		<HSComp.TableCell>
			<div className="flex items-center gap-2">
				<HSComp.Skeleton
					className="h-5"
					style={{ width: `${120 + ((i * 53) % 180)}px` }}
				/>
				<HSComp.Skeleton
					className="h-5"
					style={{ width: `${50 + ((i * 29) % 40)}px` }}
				/>
			</div>
		</HSComp.TableCell>
	</HSComp.TableRow>
));

function RegistryForm({
	onImportStart,
	onImportEnd,
	loading,
	entries,
	actionsRef,
}: {
	onImportStart: () => void;
	onImportEnd: (error?: boolean) => void;
	loading: boolean;
	entries: ProgressEntry[];
	actionsRef: React.RefObject<ImportPackageActions>;
}) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const [searchQuery, setSearchQuery] = useState("");
	const [packages, setPackages] = useState<
		{ id: string; name: string; version: string }[]
	>([]);
	const [indexLoaded, setIndexLoaded] = useState(false);
	const indexRef = useRef<{ id: string; name: string; version: string }[]>([]);
	const [visibleCount, setVisibleCount] = useState(50);
	const tbodyRef = useRef<HTMLTableSectionElement>(null);

	useEffect(() => {
		client
			.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.profiles/get-fuzz-search-index",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.profiles/get-fuzz-search-index",
					params: {},
				}),
			})
			.then(async (res) => {
				const json = await res.response.json();
				const raw = json.data ?? json.result ?? {};
				const entries: Record<string, unknown>[] = Array.isArray(raw)
					? raw
					: Object.values(raw);
				const items = entries
					.map((entry) => {
						const name = ((entry.name as string) ?? "").toString();
						const version = ((entry.version as string) ?? "").toString();
						return {
							id: (entry.id as string) ?? `${name}#${version}`,
							name,
							version,
						};
					})
					.filter((item) => item.name && item.version);
				items.sort(
					(a, b) =>
						a.name.localeCompare(b.name) || b.version.localeCompare(a.version),
				);
				indexRef.current = items;
				setIndexLoaded(true);
			});
	}, [client]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: indexLoaded triggers rebuild when ref data is ready
	const fuzzySearch = useMemo(
		() =>
			createFuzzySearch(indexRef.current, {
				keys: [{ name: "id", weight: 1 }],
				minMatchCharLength: 1,
			}),
		[indexLoaded],
	);

	const filteredResults = useMemo(
		() => (indexLoaded ? fuzzySearch(searchQuery) : []),
		[searchQuery, indexLoaded, fuzzySearch],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset visible count on filter change
	useEffect(() => {
		setVisibleCount(50);
		if (tbodyRef.current) tbodyRef.current.scrollTop = 0;
	}, [searchQuery]);

	const visibleResults = useMemo(
		() => filteredResults.slice(0, visibleCount),
		[filteredResults, visibleCount],
	);

	const handleTbodyScroll = useCallback(
		(e: React.UIEvent<HTMLTableSectionElement>) => {
			const el = e.currentTarget;
			if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
				setVisibleCount((prev) => Math.min(prev + 50, filteredResults.length));
			}
		},
		[filteredResults.length],
	);

	const isSelected = (id: string) => packages.some((p) => p.id === id);

	const togglePackage = (pkg: {
		id: string;
		name: string;
		version: string;
	}) => {
		setPackages((prev) =>
			prev.some((p) => p.id === pkg.id)
				? prev.filter((p) => p.id !== pkg.id)
				: [...prev, pkg],
		);
	};

	const handleImport = async () => {
		if (packages.length === 0) return;
		onImportStart();
		let hadError = false;
		try {
			for (const pkg of packages) {
				const res = await client.rawRequest({
					method: "POST",
					url: "/rpc?_m=aidbox.profiles/import-package-by-coordinate",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						method: "aidbox.profiles/import-package-by-coordinate",
						params: { "package-coordinate": pkg.id },
					}),
				});
				if (!res.response.ok) {
					await toastResponseError(res.response);
					hadError = true;
					return;
				}
			}
			await queryClient.invalidateQueries({
				queryKey: ["ig-browser-packages"],
			});
			navigate({ to: "/ig" });
		} catch (error) {
			hadError = true;
			await Utils.onError(error);
		} finally {
			onImportEnd(hadError);
		}
	};

	actionsRef.current.searchRegistryPackage = (query: string) => {
		setSearchQuery(query);
		const results = indexLoaded ? fuzzySearch(query) : [];
		return results.map((p) => ({ name: p.name, version: p.version }));
	};
	actionsRef.current.selectRegistryPackage = (id: string) => {
		const pkg = indexRef.current.find((p) => p.id === id);
		if (pkg) togglePackage(pkg);
	};
	actionsRef.current.getPackagesToInstall = () => ({
		method: "registry",
		packages: packages.map((p) => ({
			id: p.id,
			name: p.name,
			version: p.version,
		})),
	});
	actionsRef.current.importPackages = async () => {
		await handleImport();
		return packages.length > 0
			? `Import triggered for ${packages.length} package(s)`
			: "No packages selected";
	};

	return (
		<div className="space-y-4">
			<HSComp.Input
				autoFocus
				type="text"
				placeholder="Search packages, e.g. hl7.fhir.r4.core"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				className="bg-bg-primary"
				leftSlot={<Search />}
				rightSlot={
					searchQuery && (
						<HSComp.IconButton
							icon={<X />}
							aria-label="Clear"
							variant="link"
							onClick={() => setSearchQuery("")}
						/>
					)
				}
			/>

			<div className="rounded border border-border-secondary overflow-clip [&_[data-slot=table-container]]:overflow-visible">
				<HSComp.Table zebra className="typo-code">
					<HSComp.TableHeader className="block overflow-y-scroll scrollbar-none [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full">
						<HSComp.TableRow>
							<HSComp.TableHead className="w-10" />
							<HSComp.TableHead>Package</HSComp.TableHead>
						</HSComp.TableRow>
					</HSComp.TableHeader>
					<HSComp.TableBody
						ref={tbodyRef}
						onScroll={handleTbodyScroll}
						className="block h-80 overflow-y-auto [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full"
					>
						{!indexLoaded
							? registrySkeletonRows
							: visibleResults.map((pkg, index) => (
									<HSComp.TableRow
										key={pkg.id}
										zebra
										index={index}
										className="cursor-pointer"
										onClick={() => togglePackage(pkg)}
									>
										<HSComp.TableCell className="w-10">
											<HSComp.Checkbox
												checked={isSelected(pkg.id)}
												size="small"
											/>
										</HSComp.TableCell>
										<HSComp.TableCell>
											{pkg.name}{" "}
											<span className="text-text-secondary">{pkg.version}</span>
										</HSComp.TableCell>
									</HSComp.TableRow>
								))}
					</HSComp.TableBody>
				</HSComp.Table>
			</div>

			<div className="flex min-h-5.5 max-h-20 flex-wrap content-start items-center gap-1.5 overflow-y-auto">
				{packages.length === 0 && (
					<span className="text-xs text-text-secondary">
						No packages selected
					</span>
				)}
				{packages.map((pkg) => (
					<HSComp.Badge key={pkg.id} variant="outline" asChild>
						<button
							type="button"
							onClick={() => togglePackage(pkg)}
							className="cursor-pointer gap-1 text-xs hover:bg-bg-hover"
						>
							{pkg.name}
							<span className="text-text-secondary">{pkg.version}</span>
							<X className="size-3 text-text-secondary" />
						</button>
					</HSComp.Badge>
				))}
			</div>

			<div className="flex items-center gap-3">
				<HSComp.Button
					variant="primary"
					disabled={packages.length === 0 || loading}
					onClick={handleImport}
				>
					<Upload className="size-4" />
					Import
				</HSComp.Button>
				<ProgressInline entries={entries} />
			</div>
		</div>
	);
}

function UrlForm({
	onImportStart,
	onImportEnd,
	loading,
	entries,
	actionsRef,
}: {
	onImportStart: () => void;
	onImportEnd: (error?: boolean) => void;
	loading: boolean;
	entries: ProgressEntry[];
	actionsRef: React.RefObject<ImportPackageActions>;
}) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [urls, setUrls] = useState([""]);

	const setUrl = (index: number, value: string) => {
		setUrls((prev) => {
			const next = [...prev];
			next[index] = value;
			if (index === next.length - 1 && value) next.push("");
			return next;
		});
	};

	const removeUrl = (index: number) => {
		setUrls((prev) => {
			if (prev.length === 1) return [""];
			return prev.filter((_, i) => i !== index);
		});
	};

	const filledUrls = urls.filter(Boolean);

	const handleImport = async () => {
		if (filledUrls.length === 0) return;
		onImportStart();
		let hadError = false;
		try {
			const formData = new FormData();
			for (const [i, url] of filledUrls.entries()) {
				formData.append(`url-${i}`, url);
			}
			const res = await fetch(
				`${client.getBaseUrl()}/$upload-fhir-npm-packages`,
				{ method: "POST", body: formData, credentials: "include" },
			);
			if (!res.ok) {
				await toastResponseError(res);
				hadError = true;
				return;
			}
			await queryClient.invalidateQueries({
				queryKey: ["ig-browser-packages"],
			});
			navigate({ to: "/ig" });
		} catch (error) {
			hadError = true;
			await Utils.onError(error);
		} finally {
			onImportEnd(hadError);
		}
	};

	actionsRef.current.addUrl = (url: string) => {
		setUrls((prev) => {
			const last = prev[prev.length - 1];
			if (last === "") {
				const next = [...prev];
				next[prev.length - 1] = url;
				next.push("");
				return next;
			}
			return [...prev, url, ""];
		});
	};
	actionsRef.current.getPackagesToInstall = () => ({
		method: "url",
		packages: filledUrls.map((u) => ({ url: u })),
	});
	actionsRef.current.importPackages = async () => {
		await handleImport();
		return filledUrls.length > 0
			? `Import triggered for ${filledUrls.length} URL(s)`
			: "No URLs provided";
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				{urls.map((url, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: dynamic url list
						key={index}
						className="flex items-center gap-2"
					>
						<HSComp.Input
							autoFocus={index === 0}
							type="text"
							className="flex-1 bg-bg-primary"
							placeholder="https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1"
							value={url}
							onChange={(e) => setUrl(index, e.target.value)}
						/>
						{url && (
							<button
								type="button"
								onClick={() => removeUrl(index)}
								className="text-text-secondary hover:text-text-error-primary"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				))}
			</div>

			<div className="flex items-center gap-3">
				<HSComp.Button
					variant="primary"
					disabled={filledUrls.length === 0 || loading}
					onClick={handleImport}
				>
					<Upload className="size-4" />
					Import
				</HSComp.Button>
				<ProgressInline entries={entries} />
			</div>
		</div>
	);
}

function FileForm({
	onImportStart,
	onImportEnd,
	loading,
	entries,
	actionsRef,
}: {
	onImportStart: () => void;
	onImportEnd: (error?: boolean) => void;
	loading: boolean;
	entries: ProgressEntry[];
	actionsRef: React.RefObject<ImportPackageActions>;
}) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [files, setFiles] = useState<File[]>([]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files;
		if (selected) {
			setFiles((prev) => [...prev, ...Array.from(selected)]);
		}
		if (inputRef.current) inputRef.current.value = "";
	};

	const removeFile = (name: string) => {
		setFiles((prev) => prev.filter((f) => f.name !== name));
	};

	const handleImport = async () => {
		if (files.length === 0) return;
		onImportStart();
		let hadError = false;
		try {
			const formData = new FormData();
			for (const file of files) {
				formData.append(file.name, file);
			}
			const res = await fetch(
				`${client.getBaseUrl()}/$upload-fhir-npm-packages`,
				{ method: "POST", body: formData, credentials: "include" },
			);
			if (!res.ok) {
				await toastResponseError(res);
				hadError = true;
				return;
			}
			await queryClient.invalidateQueries({
				queryKey: ["ig-browser-packages"],
			});
			navigate({ to: "/ig" });
		} catch (error) {
			hadError = true;
			await Utils.onError(error);
		} finally {
			onImportEnd(hadError);
		}
	};

	const [isDragging, setIsDragging] = useState(false);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const dropped = Array.from(e.dataTransfer.files).filter(
			(f) => f.name.endsWith(".tar.gz") || f.name.endsWith(".tgz"),
		);
		if (dropped.length > 0) {
			setFiles((prev) => [...prev, ...dropped]);
		}
	};

	actionsRef.current.getPackagesToInstall = () => ({
		method: "file",
		packages: files.map((f) => ({ name: f.name, size: f.size })),
	});
	actionsRef.current.importPackages = async () => {
		await handleImport();
		return files.length > 0
			? `Import triggered for ${files.length} file(s)`
			: "No files selected";
	};

	return (
		<div className="space-y-4">
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={HSComp.cn(
					"flex h-[406px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors",
					isDragging
						? "border-border-primary bg-bg-secondary"
						: "border-border-secondary hover:border-border-primary hover:bg-bg-hover",
				)}
			>
				<Upload className="size-8 text-text-secondary" />
				<div className="text-center">
					<span className="block text-sm font-medium text-text-primary">
						Drop .tar.gz files here or click to browse
					</span>
					{files.length > 0 && (
						<span className="mt-1 block text-xs text-text-secondary">
							{files.length} file{files.length > 1 ? "s" : ""} selected
						</span>
					)}
				</div>
			</button>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept=".tar.gz,.tgz"
				className="hidden"
				onChange={handleFileChange}
			/>

			<div className="flex min-h-5.5 max-h-20 flex-wrap content-start items-center gap-1.5 overflow-y-auto">
				{files.length === 0 && (
					<span className="text-xs text-text-secondary">No files selected</span>
				)}
				{files.map((file) => (
					<HSComp.Badge key={file.name} variant="outline" asChild>
						<button
							type="button"
							onClick={() => removeFile(file.name)}
							className="cursor-pointer gap-1 text-xs hover:bg-bg-hover"
						>
							{file.name}
							<X className="size-3 text-text-secondary" />
						</button>
					</HSComp.Badge>
				))}
			</div>

			<div className="flex items-center gap-3">
				<HSComp.Button
					variant="primary"
					disabled={files.length === 0 || loading}
					onClick={handleImport}
				>
					<Upload className="size-4" />
					Import
				</HSComp.Button>
				<ProgressInline entries={entries} />
			</div>
		</div>
	);
}

export function ImportPackage() {
	const [method, setMethod] = useState<ImportMethod>("registry");
	const [status, setStatus] = useState<"none" | "loading" | "error">("none");
	const { entries } = useImportProgress();

	const loading = status === "loading";
	const onImportStart = useCallback(() => setStatus("loading"), []);
	const onImportEnd = useCallback(
		(error?: boolean) => setStatus(error ? "error" : "none"),
		[],
	);

	const actionsRef = useRef<ImportPackageActions>({} as ImportPackageActions);
	actionsRef.current.getImportMethod = () => method;
	actionsRef.current.setImportMethod = (m) => setMethod(m);
	actionsRef.current.getImportStatus = () => ({ status });
	actionsRef.current.getImportLogs = () => entries.map((e) => e.msg);
	useWebMCPImportPackage(actionsRef);

	return (
		<div className="w-full max-w-4xl px-4 py-4">
			<MethodPicker selected={method} onSelect={setMethod} />

			<div className="mt-6">
				{method === "registry" && (
					<RegistryForm
						onImportStart={onImportStart}
						onImportEnd={onImportEnd}
						loading={loading}
						entries={entries}
						actionsRef={actionsRef}
					/>
				)}
				{method === "url" && (
					<UrlForm
						onImportStart={onImportStart}
						onImportEnd={onImportEnd}
						loading={loading}
						entries={entries}
						actionsRef={actionsRef}
					/>
				)}
				{method === "file" && (
					<FileForm
						onImportStart={onImportStart}
						onImportEnd={onImportEnd}
						loading={loading}
						entries={entries}
						actionsRef={actionsRef}
					/>
				)}
			</div>
		</div>
	);
}
