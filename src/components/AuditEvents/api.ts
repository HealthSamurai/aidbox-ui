import { useQuery } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";

interface AuditLogSetting {
	name: string;
	value: boolean;
	title: string;
	"restart-required": boolean;
	"pending-value": boolean | null;
}

export function useAuditLogEnabled() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["audit-log-enabled"],
		queryFn: async () => {
			const result = await client.request<AuditLogSetting>({
				method: "GET",
				url: "/api/v1/settings/introspect/security.audit-log.enabled",
			});
			if (result.isOk()) {
				return result.value.resource.value === true;
			}
			return false;
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}
