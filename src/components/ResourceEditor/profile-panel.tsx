import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { fetchSchemas } from "../../api/schemas";
import { transformSnapshotToTree } from "../../utils";
import { pageId } from "./types";

interface ProfilePanelProps {
	resourceType: string;
	onClose: () => void;
}

export function ProfilePanel({ resourceType, onClose }: ProfilePanelProps) {
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
				defaultEntry ? defaultEntry[0] : profileEntries[0][0],
			);
		}
	}, [profileEntries, selectedProfileKey]);

	const selectedProfile = selectedProfileKey ? data?.[selectedProfileKey] : undefined;

	const dropdownOptions = React.useMemo(
		() =>
			profileEntries.map(([key, schema]) => ({
				value: key,
				label: schema.entity?.name || key,
			})),
		[profileEntries],
	);

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
				{isLoading && (
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
				{selectedProfile && (
					<HSComp.FhirStructureView
						tree={transformSnapshotToTree(selectedProfile.snapshot)}
					/>
				)}
			</div>
		</div>
	);
}
