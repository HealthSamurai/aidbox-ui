import { DropdownMenuItem, toast } from "@health-samurai/react-components";
import { Globe } from "lucide-react";
import type { Form } from "../api/forms";
import { getFormLabel } from "../api/forms-list";
import { useShareForm } from "./api";
import {
	getResourceOrganizationId,
	getResourceShareMode,
	type ShareMode,
	useOrgbacEnabled,
} from "./sharing";

export function FormShareMenuItems({ form }: { form: Form }) {
	const orgbacEnabled = useOrgbacEnabled();
	const shareForm = useShareForm();
	const organizationId = getResourceOrganizationId(form);
	const shareMode = getResourceShareMode(form);

	// Same rule as the classic forms grid at the root level
	// (`src-ui/sdc/forms/core.cljc`): a global share only applies to forms that
	// belong to no organization.
	const canShareGlobally = orgbacEnabled.data === true && !organizationId;

	const share = (mode: ShareMode | null, message: string) => {
		shareForm.mutate(
			{ mode, form },
			{
				onError: (error) => {
					toast.error(error.message);
				},
				onSuccess: () => {
					toast.success(message);
				},
			},
		);
	};

	const label = getFormLabel(form);

	return (
		<>
			{canShareGlobally ? (
				<DropdownMenuItem
					className="justify-start"
					data-test-id="forms-table__row-menu-share-globally-button"
					onClick={() =>
						shareMode === "system-shared"
							? share(null, `Unshared ${label} globally`)
							: share("system-shared", `Shared ${label} globally`)
					}
				>
					<Globe className="size-4" />
					{shareMode === "system-shared"
						? "Unshare globally"
						: "Share globally"}
				</DropdownMenuItem>
			) : null}
		</>
	);
}
