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

	const versionLine = [version, timestamp ? `(${timestamp})` : null]
		.filter(Boolean)
		.join(" ");

	const licenseLine = [
		licenseType
			? `${licenseType[0]!.toUpperCase()}${licenseType.slice(1)}`
			: null,
		licenseExpiration ? `valid until ${licenseExpiration}` : null,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<div className="px-8 py-3 text-sm text-text-primary @[900px]:px-0">
			{versionLine && (
				<div>
					<span className="font-medium">Version:</span> {versionLine}
				</div>
			)}
			{licenseLine && (
				<div>
					<span className="font-medium">License:</span> {licenseLine}
				</div>
			)}
		</div>
	);
}
