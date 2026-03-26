import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { fetchProfileElements, fetchSchemas } from "../../api/schemas";
import { transformSnapshotToTree } from "../../utils";
import type { ResourceEditorActions } from "../../webmcp/resource-editor-context";
import { pageId } from "./types";

interface ProfilePanelProps {
	resourceType: string;
	onClose: () => void;
	actionsRef?: React.RefObject<ResourceEditorActions | null>;
	onOpenPanel?: () => void;
}

export function ProfilePanel({
	resourceType,
	onClose,
	actionsRef,
	onOpenPanel,
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

	const dropdownOptions = React.useMemo(
		() =>
			profileEntries.map(([key, schema]) => ({
				value: key,
				label: schema.entity?.name || key,
			})),
		[profileEntries],
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
