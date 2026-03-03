import {
	BarChart3,
	Blocks,
	Database,
	Flame,
	Globe,
	type LucideIcon,
	Settings,
	ShieldCheck,
} from "lucide-react";
import type { CategoryDef } from "./types";

export const SENSITIVE_PLACEHOLDER = "****************";

export const SOURCE_TITLES = {
	database: "Database",
	env: "Environment variables",
	default: "Default",
	maintenanceDb: "Maintance DB source",
	devPreset: "Dev. preset",
	legacy: "Legacy configuration",
	license: "License source",
	multiboxManager: "Multibox manager",
} as const;

export const USER_SOURCES = new Set([
	SOURCE_TITLES.database,
	SOURCE_TITLES.maintenanceDb,
	SOURCE_TITLES.devPreset,
	SOURCE_TITLES.env,
]);

export const CATEGORIES: CategoryDef[] = [
	{ category: ["General"], desc: "General settings" },
	{
		category: ["FHIR"],
		desc: "FHIR settings",
		subcategories: [
			{ category: ["FHIR", "General"], desc: "General FHIR settings" },
			{
				category: ["FHIR", "Validation"],
				desc: "Validation settings",
			},
			{ category: ["FHIR", "Search"], desc: "Search settings" },
			{
				category: ["FHIR", "Terminology"],
				desc: "Terminology settings",
			},
			{
				category: ["FHIR", "Bulk Data Export"],
				desc: "Bulk Data Export settings",
			},
		],
	},
	{
		category: ["Security and Access Control"],
		desc: "Security & Access Control settings",
	},
	{
		category: ["Modules"],
		desc: "Modules settings",
		subcategories: [
			{
				category: ["Modules", "Subscriptions"],
				desc: "Google Cloud Pub/Sub subscriptions settings",
			},
			{
				category: ["Modules", "Notebooks"],
				desc: "Aidbox notebooks settings",
			},
			{
				category: ["Modules", "Mail Provider"],
				desc: "Mail Provider settings",
			},
			{
				category: ["Modules", "SMARTbox"],
				desc: "SMARTbox settings",
			},
			{ category: ["Modules", "MDM"], desc: "MDM settings" },
			{ category: ["Modules", "MCP"], desc: "MCP settings" },
			{ category: ["Modules", "Forms"], desc: "Forms settings" },
			{ category: ["Modules", "GraphQL"], desc: "GraphQL settings" },
			{ category: ["Modules", "Webpush"], desc: "Webpush settings" },
			{
				category: ["Modules", "Usage Statistics"],
				desc: "Usage Statistics",
			},
		],
	},
	{
		category: ["Database"],
		desc: "Database settings",
		subcategories: [
			{
				category: ["Database", "Primary"],
				desc: "Primary database settings",
			},
			{
				category: ["Database", "Maintenance"],
				desc: "Maintenance database settings",
			},
			{
				category: ["Database", "Read-only replica"],
				desc: "Read-only database replica settings",
			},
		],
	},
	{ category: ["Web Server"], desc: "Web Server settings" },
	{
		category: ["Observability"],
		desc: "Observability settings",
		subcategories: [
			{ category: ["Observability", "Logs"], desc: "Logs settings" },
			{
				category: ["Observability", "Metrics"],
				desc: "Metrics settings",
			},
			{
				category: ["Observability", "Stdout"],
				desc: "Stdout settings",
			},
			{
				category: ["Observability", "Loki"],
				desc: "Grafana Loki settings",
			},
			{
				category: ["Observability", "Datadog"],
				desc: "Datadog settings",
			},
			{
				category: ["Observability", "Elasticsearch"],
				desc: "Elasticsearch settings",
			},
			{
				category: ["Observability", "OTEL"],
				desc: "OpenTelemetry settings",
			},
		],
	},
];

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
	General: Settings,
	FHIR: Flame,
	"Security and Access Control": ShieldCheck,
	Modules: Blocks,
	"Web Server": Globe,
	Database: Database,
	Observability: BarChart3,
};

export const DEPRECATED_CAPABILITY_LABELS: Record<string, string> = {
	"custom-entities": "custom Entities",
	"custom-attributes": "custom Attributes",
	"custom-search-param-resource": "custom SearchParameter resources",
	"custom-zen-search-params": "custom search parameters on Zen",
	"zen-fhir-search-params": "zen/fhir search parameters",
	"custom-zen-resources": "custom resources on Zen",
	"zen-profilies": "profiles on Zen",
};
