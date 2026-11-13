import { toast } from "@health-samurai/react-components";

export function notifyResponseActionUnavailable(label: string) {
	toast(`${label} is not available yet.`);
}
