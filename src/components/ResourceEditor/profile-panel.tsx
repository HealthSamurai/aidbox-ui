import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScrollText, Search, XIcon } from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	type ExampleEntry,
	fetchExample,
	fetchExamples,
} from "../../api/examples";
import { fetchProfileElements, fetchSchemas } from "../../api/schemas";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { transformSnapshotToTree } from "../../utils";
import type { ResourceEditorActions } from "../../webmcp/resource-editor-context";
import { pageId } from "./types";

interface ProfilePanelProps {
	resourceType: string;
	onClose: () => void;
	actionsRef?: React.RefObject<ResourceEditorActions | null>;
	onOpenPanel?: () => void;
	resource?: Resource;
	onApplyProfile?: (profileUrl: string) => void;
	onExampleSelect?: (resource: Record<string, unknown>) => void;
}

function ProfilesTab({
	resourceType,
	actionsRef,
	onOpenPanel,
	resource,
	onApplyProfile,
}: {
	resourceType: string;
	actionsRef?: React.RefObject<ResourceEditorActions | null>;
	onOpenPanel?: () => void;
	resource?: Resource;
	onApplyProfile?: (profileUrl: string) => void;
}) {
	const client = useAidboxClient();
	const [selectedProfileKey, setSelectedProfileKey] = React.useState<
		string | undefined
	>(undefined);

	const { data, isLoading, error } = useQuery({
		queryKey: [pageId, "schemas", resourceType],
		queryFn: () => fetchSchemas(client, resourceType),
		retry: false,
		refetchOnWindowFocus: false,
	});

	const profileEntries = React.useMemo(
		() => (data ? Object.entries(data) : []),
		[data],
	);

	React.useEffect(() => {
		if (profileEntries.length > 0 && selectedProfileKey === undefined) {
			const defaultEntry = profileEntries.find(
				([, schema]) => schema["default?"] === true,
			);
			setSelectedProfileKey(
				defaultEntry ? defaultEntry[0] : profileEntries[0]?.[0],
			);
		}
	}, [profileEntries, selectedProfileKey]);

	const selectedProfile = selectedProfileKey
		? data?.[selectedProfileKey]
		: undefined;

	const { data: snapshotElements, isLoading: snapshotLoading } = useQuery({
		queryKey: [
			pageId,
			"profile-snapshot",
			selectedProfile?.["package-coordinate"],
			selectedProfile?.entity?.url,
		],
		queryFn: () => {
			const coord = selectedProfile?.["package-coordinate"];
			const url = selectedProfile?.entity?.url;
			if (!coord || !url) return Promise.resolve(undefined);
			return fetchProfileElements(
				client,
				"aidbox.introspector/get-profile-snapshot",
				coord,
				url,
			);
		},
		enabled:
			!!selectedProfile?.["package-coordinate"] &&
			!!selectedProfile?.entity?.url,
		retry: false,
		refetchOnWindowFocus: false,
	});

	const resourceProfiles: string[] =
		((resource?.meta as Record<string, unknown>)?.profile as string[]) ?? [];

	const dropdownOptions = React.useMemo(
		() =>
			profileEntries.map(([key, schema]) => {
				const name = schema.entity?.name || key;
				const url = schema.entity?.url;
				const isApplied = url ? resourceProfiles.includes(url) : false;
				return {
					value: key,
					label: isApplied ? `${name} \u25CF` : name,
				};
			}),
		[profileEntries, resourceProfiles],
	);

	if (actionsRef?.current) {
		const profile = selectedProfileKey ? data?.[selectedProfileKey] : undefined;
		actionsRef.current.editorGetProfile = () => ({
			open: true,
			profileKey: selectedProfileKey,
			profileName: profile?.entity?.name,
			profileUrl: profile?.entity?.url,
			isDefault: profile?.["default?"] === true,
		});
		actionsRef.current.editorChooseProfile = (key: string) => {
			onOpenPanel?.();
			setSelectedProfileKey(key);
		};
	}

	const selectedProfileUrl = selectedProfile?.entity?.url;
	const isDefault = selectedProfile?.["default?"] === true;
	const isProfileApplied =
		isDefault ||
		(!!selectedProfileUrl && resourceProfiles.includes(selectedProfileUrl));

	return (
		<>
			<div className="flex items-center gap-2 bg-bg-secondary pl-[34px] pr-4 border-b h-10! min-h-10 shrink-0">
				<span className="typo-label text-text-secondary">Profile:</span>
				{!isLoading && profileEntries.length > 0 && (
					<HSComp.ButtonDropdown
						options={dropdownOptions}
						selectedValue={selectedProfileKey}
						onSelectItem={setSelectedProfileKey}
					/>
				)}
				{!isProfileApplied && selectedProfileUrl && onApplyProfile && (
					<HSComp.Button
						size="small"
						variant="secondary"
						onClick={() => onApplyProfile(selectedProfileUrl)}
					>
						Apply
					</HSComp.Button>
				)}
			</div>
			<div className="flex-1 overflow-auto px-2">
				{(isLoading || snapshotLoading) && (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-lg">Loading profiles...</div>
					</div>
				)}
				{error && (
					<div className="flex items-center justify-center h-full text-text-error-primary">
						<div className="text-lg">{error.message}</div>
					</div>
				)}
				{!isLoading && !error && !selectedProfile && (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-lg">No profiles found</div>
					</div>
				)}
				{snapshotElements &&
					(() => {
						try {
							const tree = transformSnapshotToTree(snapshotElements);
							return <HSComp.FhirStructureView tree={tree} />;
						} catch {
							return (
								<div className="flex items-center justify-center h-full text-text-secondary">
									<div className="text-sm">
										Unable to render profile structure
									</div>
								</div>
							);
						}
					})()}
			</div>
		</>
	);
}

function ExamplesTab({
	resourceType,
	onSelect,
}: {
	resourceType: string;
	onSelect?: (resource: Record<string, unknown>) => void;
}) {
	const client = useAidboxClient();
	const [search, setSearch] = React.useState("");
	const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

	const { data: examples, isLoading } = useQuery({
		queryKey: ["examples", resourceType],
		queryFn: () => fetchExamples(client, resourceType),
		retry: false,
		refetchOnWindowFocus: false,
	});

	const filtered = React.useMemo(() => {
		if (!examples) return [];
		if (!search) return examples;
		const q = search.toLowerCase();
		return examples.filter((e) => {
			const hay = [e["resource-id"], e.name, e.package, ...(e.profiles ?? [])]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return hay.includes(q);
		});
	}, [examples, search]);

	const grouped = React.useMemo(() => {
		const groups: { key: string; entries: ExampleEntry[] }[] = [];
		const map = new Map<string, ExampleEntry[]>();
		for (const entry of filtered) {
			const key = entry.package
				? `${entry.package}${entry["package-version"] ? `#${entry["package-version"]}` : ""}`
				: "";
			let list = map.get(key);
			if (!list) {
				list = [];
				map.set(key, list);
				groups.push({ key, entries: list });
			}
			list.push(entry);
		}
		return groups;
	}, [filtered]);

	const handleSelect = async (entry: ExampleEntry) => {
		if (!onSelect) return;
		const resource = await fetchExample(client, resourceType, entry.id);
		if (resource) {
			const {
				id: _,
				package: _pkg,
				packageVersion: _pkgVer,
				...clean
			} = resource;
			onSelect(clean);
		}
	};

	return (
		<>
			<div className="flex items-center gap-2 border-b px-3 h-10! min-h-10 shrink-0 bg-bg-secondary">
				<Search size={14} className="text-text-tertiary shrink-0" />
				<input
					className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
					placeholder="Search examples..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>
			<div className="flex-1 overflow-auto pt-1">
				{isLoading && (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-sm">Loading...</div>
					</div>
				)}
				{!isLoading && filtered.length === 0 && (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-sm">No examples found</div>
					</div>
				)}
				{grouped.map((group) => (
					<div key={group.key} className="px-3 pr-3">
						{group.key && (
							<button
								type="button"
								className="flex w-full items-center gap-2.5 pl-px pt-3 pb-2 typo-label-xs text-text-tertiary uppercase cursor-pointer hover:text-text-secondary"
								onClick={() =>
									setCollapsed((prev) => ({
										...prev,
										[group.key]: !prev[group.key],
									}))
								}
							>
								<ChevronRight
									className={`size-3 transition-transform duration-150 ${!collapsed[group.key] || search ? "rotate-90" : ""}`}
								/>
								{group.key}
							</button>
						)}
						{(search || !group.key || !collapsed[group.key]) &&
							group.entries.map((entry) => (
								<button
									type="button"
									key={entry.id}
									className="flex w-full items-center gap-2 text-left py-1.5 px-2 ml-4 rounded cursor-pointer hover:bg-bg-secondary"
									onClick={() => handleSelect(entry)}
								>
									<ScrollText className="size-3.5 shrink-0 text-text-tertiary" />
									<span className="truncate">
										<span className="typo-code text-text-body">
											{entry["resource-id"] || entry.name || entry.id}
										</span>
										{entry.profiles && entry.profiles.length > 0 && (
											<span className="typo-body-xs text-text-tertiary ml-2">
												{entry.profiles.join(", ")}
											</span>
										)}
									</span>
								</button>
							))}
					</div>
				))}
			</div>
		</>
	);
}

export function ProfilePanel({
	resourceType,
	onClose,
	actionsRef,
	onOpenPanel,
	resource,
	onApplyProfile,
	onExampleSelect,
}: ProfilePanelProps) {
	const [activeTab, setActiveTab] = useLocalStorage<string>({
		key: "resourceEditor-profilePanelTab",
		defaultValue: "profiles",
		getInitialValueInEffect: false,
	});

	return (
		<HSComp.Tabs
			value={activeTab}
			onValueChange={setActiveTab}
			className="flex flex-col h-full"
		>
			<div className="flex items-center justify-between bg-bg-secondary border-b shrink-0 h-10 min-h-10">
				<HSComp.TabsList className="pl-[22px]">
					<HSComp.TabsTrigger value="profiles">Profiles</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="examples">Examples</HSComp.TabsTrigger>
				</HSComp.TabsList>
				<HSComp.IconButton
					variant="ghost"
					aria-label="Close panel"
					icon={<XIcon className="w-4 h-4" />}
					onClick={onClose}
					className="mr-4"
				/>
			</div>
			<HSComp.TabsContent
				value="profiles"
				className="flex-1 min-h-0 flex flex-col"
			>
				<ProfilesTab
					resourceType={resourceType}
					actionsRef={actionsRef}
					onOpenPanel={onOpenPanel}
					resource={resource}
					onApplyProfile={onApplyProfile}
				/>
			</HSComp.TabsContent>
			<HSComp.TabsContent
				value="examples"
				className="flex-1 min-h-0 flex flex-col"
			>
				<ExamplesTab resourceType={resourceType} onSelect={onExampleSelect} />
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
}
