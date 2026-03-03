import { Alert, AlertDescription } from "@health-samurai/react-components";
import { DEPRECATED_CAPABILITY_LABELS } from "./constants";
import type { DeprecatedCapabilities, Setting } from "./types";
import { isPendingRestart } from "./utils";

export function RestartRequiredAlert({ settings }: { settings: Setting[] }) {
	const hasRestart = settings.some(isPendingRestart);
	if (!hasRestart) return null;

	return (
		<Alert variant="warning" className="mb-4">
			<AlertDescription>
				Some settings will take effect after Aidbox restart.
			</AlertDescription>
		</Alert>
	);
}

export function DeprecatedCapabilitiesAlert({
	capabilities,
}: {
	capabilities: DeprecatedCapabilities | undefined;
}) {
	if (!capabilities) return null;

	const deprecatedItems = Object.entries(DEPRECATED_CAPABILITY_LABELS).flatMap(
		([key, label]) => {
			const cap = capabilities[key as keyof DeprecatedCapabilities];
			if (!cap || cap.total <= 0) return [];
			return [{ label, total: cap.total }];
		},
	);

	if (deprecatedItems.length === 0) return null;

	return (
		<Alert variant="critical" className="mb-4">
			<AlertDescription>
				<div>
					<p className="font-medium">
						This Aidbox instance uses deprecated capabilities:
					</p>
					<ul className="mt-1 list-disc pl-4 text-sm">
						{deprecatedItems.map((item) => (
							<li key={item.label}>
								{item.label}: {item.total}
							</li>
						))}
					</ul>
					<p className="mt-2 text-sm">
						Please migrate to FHIR Schema compatible capabilities.{" "}
						<a
							href="https://docs.aidbox.app/storage-1/aidbox-and-fhir-formats/fhir-schema"
							target="_blank"
							rel="noopener noreferrer"
							className="underline"
						>
							How to migrate
						</a>
					</p>
				</div>
			</AlertDescription>
		</Alert>
	);
}
