import type { BoxInfo } from "./types";

export function BoxInfoDisplay({ boxInfo }: { boxInfo: BoxInfo | undefined }) {
	if (!boxInfo) return null;

	const version = boxInfo.about?.version;
	const timestamp = boxInfo.about?.timestamp
		? new Date(boxInfo.about.timestamp).toUTCString()
		: undefined;
	const licenseType = boxInfo.license?.type;
	const licenseExpiration = boxInfo.license?.expiration
		? new Date(boxInfo.license.expiration).toUTCString()
		: undefined;

	return (
		<div className="mb-4 space-y-1 rounded-md border border-border-primary bg-bg-secondary p-4 text-sm">
			{version && (
				<div className="flex gap-2">
					<span className="text-text-secondary">Version:</span>
					<span className="font-medium">{version}</span>
				</div>
			)}
			{timestamp && (
				<div className="flex gap-2">
					<span className="text-text-secondary">Timestamp:</span>
					<span>{timestamp}</span>
				</div>
			)}
			{licenseType && (
				<div className="flex gap-2">
					<span className="text-text-secondary">License:</span>
					<span>{licenseType}</span>
				</div>
			)}
			{licenseExpiration && (
				<div className="flex gap-2">
					<span className="text-text-secondary">License expiration:</span>
					<span>{licenseExpiration}</span>
				</div>
			)}
		</div>
	);
}
