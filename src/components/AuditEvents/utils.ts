export const PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

export const ALL_CATEGORIES = "all";

export const CATEGORY_OPTIONS = [
	{ value: ALL_CATEGORIES, label: "All categories" },
	{ value: "data-access", label: "data-access" },
	{ value: "data-modification", label: "data-modification" },
	{ value: "sql-interaction", label: "sql-interaction" },
	{ value: "configuration", label: "configuration" },
	{ value: "security", label: "security" },
] as const;

export interface AuditEventFilters {
	search: string;
	dateFrom: string;
	dateTo: string;
	userId: string;
	patientId: string;
	clientId: string;
	category: string;
}

export const emptyFilters: AuditEventFilters = {
	search: "",
	dateFrom: "",
	dateTo: "",
	userId: "",
	patientId: "",
	clientId: "",
	category: ALL_CATEGORIES,
};

interface Coding {
	code?: string;
	system?: string;
	display?: string;
}

interface Identifier {
	value?: string;
	system?: string;
	type?: { coding?: Coding[] };
}

interface AgentWho {
	type?: string;
	display?: string;
	identifier?: Identifier;
	reference?: string;
}

interface Agent {
	who?: AgentWho;
	type?: { coding?: Coding[] };
	network?: { type?: string; address?: string };
	requestor?: boolean;
	altId?: string;
}

interface EntityWhat {
	identifier?: { value?: string };
	reference?: string;
}

interface Entity {
	role?: Coding;
	type?: Coding;
	what?: EntityWhat;
	query?: string;
	description?: string;
}

interface AuditEventMeta {
	lastUpdated?: string;
	versionId?: string;
	profile?: string[];
	extension?: Array<{ url: string; valueInstant?: string }>;
}

export interface AuditEventResource {
	id: string;
	resourceType: "AuditEvent";
	meta?: AuditEventMeta;
	type?: Coding;
	subtype?: Coding[];
	action?: string;
	outcome?: string;
	recorded?: string;
	source?: {
		site?: string;
		type?: Coding[];
		observer?: AgentWho;
	};
	agent?: Agent[];
	entity?: Entity[];
}

export function getRequestorAgent(
	agents: Agent[] | undefined,
): Agent | undefined {
	return agents?.find((a) => a.requestor === true);
}

export function getSourceAgent(agents: Agent[] | undefined): Agent | undefined {
	return agents?.find((a) => a.type?.coding?.some((c) => c.code === "110153"));
}

export function extractUser(resource: AuditEventResource): {
	display: string;
	resourceType?: string;
	id?: string;
} {
	const agent = getRequestorAgent(resource.agent);
	if (!agent) return { display: "" };

	const identifier = agent.who?.identifier;
	const typeCode = identifier?.type?.coding?.[0]?.code;
	const value = agent.altId || identifier?.value || agent.who?.display || "";

	if (typeCode === "UID" && value) {
		return { display: `User/${value}`, resourceType: "User", id: value };
	}
	if (typeCode === "portal-user-username" && value) {
		return { display: value };
	}

	return { display: value };
}

export function extractClient(resource: AuditEventResource): string | null {
	const agent = getSourceAgent(resource.agent);
	if (!agent) return null;
	return agent.who?.identifier?.value || null;
}

export function extractCategory(resource: AuditEventResource): string {
	const typeCode = resource.type?.code;
	const subtypeCodes =
		resource.subtype?.map((s) => s.code).filter(Boolean) ?? [];

	if (typeCode === "rest") {
		if (subtypeCodes.some((c) => c === "search" || c === "read")) {
			return "data-access";
		}
		if (
			subtypeCodes.some(
				(c) => c === "create" || c === "update" || c === "delete",
			)
		) {
			return "data-modification";
		}
		return "data-access";
	}

	if (typeCode === "110112") {
		if (subtypeCodes.includes("sql")) {
			return "sql-interaction";
		}
	}

	return resource.type?.display?.toLowerCase() ?? "unknown";
}

export function extractDetails(resource: AuditEventResource): string {
	const outcome = resource.outcome === "0" ? "successful" : "failed";
	const subtypeDisplay = resource.subtype?.[0]?.display ?? "";

	const entity = resource.entity?.find((e) => e.type?.code !== "XrequestId");

	if (entity?.description) {
		const desc = entity.description;
		if (resource.type?.code === "rest") {
			const match = desc.match(/\/(?:fhir\/)?(\w+)/);
			const resourceType = match?.[1] ?? "";
			if (entity.what?.reference) {
				return `${outcome} ${subtypeDisplay} of ${entity.what.reference.split("/").pop()}`;
			}
			return `${outcome} ${subtypeDisplay} over ${resourceType}`;
		}
		if (resource.type?.code === "110112") {
			return `${outcome} execution of ${resource.subtype?.[0]?.display ?? "query"} operation`;
		}
	}

	if (entity?.what?.reference) {
		return `${outcome} ${subtypeDisplay} of ${entity.what.reference}`;
	}

	return `${outcome} ${subtypeDisplay}`;
}

export function extractEntity(
	resource: AuditEventResource,
): { text: string; url?: string } | null {
	const entity = resource.entity?.find((e) => e.type?.code !== "XrequestId");
	if (!entity) return null;

	if (entity.description) {
		return { text: entity.description, url: entity.description };
	}
	if (entity.what?.reference) {
		return { text: entity.what.reference, url: entity.what.reference };
	}
	return null;
}

export function extractRequestId(resource: AuditEventResource): string {
	const entity = resource.entity?.find((e) => e.type?.code === "XrequestId");
	return entity?.what?.identifier?.value ?? "";
}

export function extractPatient(
	resource: AuditEventResource,
): { display: string; id: string } | null {
	const entity = resource.entity?.find((e) =>
		e.what?.reference?.startsWith("Patient/"),
	);
	const ref = entity?.what?.reference;
	if (!ref) return null;
	const id = ref.split("/")[1] ?? ref;
	return { display: ref, id };
}

export function extractIpAddress(resource: AuditEventResource): string {
	const agent = getSourceAgent(resource.agent);
	return agent?.network?.address ?? "";
}

export function formatDateTime(iso: string | undefined): {
	date: string;
	time: string;
} {
	if (!iso) return { date: "", time: "" };
	const d = new Date(iso);
	return {
		date: d.toLocaleDateString(),
		time: d.toLocaleTimeString(),
	};
}

function toISODate(value: string): string | null {
	if (!value) return null;
	const parts = value.split(".");
	if (parts.length === 3) {
		const [d, m, y] = parts;
		const date = new Date(`${y}-${m}-${d}`);
		if (!Number.isNaN(date.getTime())) return `${y}-${m}-${d}`;
	}
	const date = new Date(value);
	if (!Number.isNaN(date.getTime())) {
		return date.toISOString().slice(0, 10);
	}
	return null;
}

export function buildQueryParams(
	filters: AuditEventFilters,
	page: number,
	pageSize: number = PAGE_SIZE,
): string {
	const parts: string[] = [
		`_sort=-createdAt`,
		`_count=${pageSize}`,
		`_page=${page}`,
	];

	if (filters.search) {
		parts.push(`_ilike=${encodeURIComponent(filters.search)}`);
	}
	if (filters.dateFrom) {
		const iso = toISODate(filters.dateFrom);
		if (iso) parts.push(`date=ge${iso}`);
	}
	if (filters.dateTo) {
		const iso = toISODate(filters.dateTo);
		if (iso) parts.push(`date=le${iso}`);
	}
	if (filters.userId) {
		parts.push(`altid=${encodeURIComponent(filters.userId)}`);
	}
	if (filters.patientId) {
		parts.push(`patient=${encodeURIComponent(filters.patientId)}`);
	}
	if (filters.clientId) {
		parts.push(`agent:identifier=${encodeURIComponent(filters.clientId)}`);
	}

	if (filters.category && filters.category !== ALL_CATEGORIES) {
		const categoryToSubtype: Record<string, string> = {
			"data-access": "search,read",
			"data-modification": "create,update,delete",
			"sql-interaction": "sql",
			configuration: "transaction",
			security: "110114",
		};
		const subtype = categoryToSubtype[filters.category];
		if (subtype) {
			parts.push(`subtype=${subtype}`);
		}
	}

	return parts.join("&");
}
