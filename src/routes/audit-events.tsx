import { createFileRoute } from "@tanstack/react-router";
import { AuditEventsPage } from "../components/AuditEvents/page";

export const Route = createFileRoute("/audit-events")({
	staticData: { title: "Audit events" },
	loader: () => ({ breadCrumb: "Audit events" }),
	component: AuditEventsPage,
});
