import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { fetchProfileElements, fetchSchemas } from "../../api/schemas";
import { transformSnapshotToTree } from "../../utils";
import type { ResourceEditorActions } from "../../webmcp/resource-editor-context";
import { pageId } from "./types";

/** Strip version suffix (e.g. `|1.0.0`) from a FHIR profile URL for comparison */
function stripProfileVersion(url: string): string {
	const idx = url.indexOf("|");
	return idx === -1 ? url : url.slice(0, idx);
}

function profilesInclude(profiles: string[], url: string): boolean {
	const bare = stripProfileVersion(url);
	return profiles.some((p) => stripProfileVersion(p) === bare);
}

interface ProfilePanelProps {
	resourceType: string;
	onClose: () => void;
	actionsRef?: React.RefObject<ResourceEditorActions | null>;
	onOpenPanel?: () => void;
	resource?: Resource;
	onApplyProfile?: (profileUrl: string) => void;
}

export function ProfilePanel({
	resourceType,
	onClose,
	actionsRef,
	onOpenPanel,
	resource,
	onApplyProfile,
}: ProfilePanelProps) {
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
				const isApplied = url ? profilesInclude(resourceProfiles, url) : false;
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
		(!!selectedProfileUrl &&
			profilesInclude(resourceProfiles, selectedProfileUrl));

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10! min-h-10 shrink-0">
				<div className="flex items-center gap-2">
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
				<HSComp.IconButton
					variant="ghost"
					aria-label="Close profile panel"
					icon={<XIcon className="w-4 h-4" />}
					onClick={onClose}
				/>
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
				{snapshotElements && (
					<HSComp.FhirStructureView
						tree={transformSnapshotToTree(snapshotElements)}
					/>
				)}
			</div>
		</div>
	);
}
