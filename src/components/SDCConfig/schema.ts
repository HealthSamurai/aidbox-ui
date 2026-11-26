import { jsonLanguage } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import {
	handleRefresh,
	jsonCompletion,
	jsonSchemaLinter,
	stateExtensions,
} from "codemirror-json-schema";
import type { LucideIcon } from "lucide-react";
import { Blocks, Database, FileText, Globe, Settings } from "lucide-react";
/**
 * Every SDC message an SDCConfig can translate, with its English default.
 * A copy of `box/resources/sdc/customizable-messages-schema.json` from
 * sansara, which `make gettext` generates there; copy it again when the box
 * adds or renames customizable messages.
 */
import customizableMessagesSchema from "./customizable-messages-schema.json";
import {
	BUILDER_BOOLEAN_FIELDS,
	BUILDER_LAYOUT_OPTIONS,
	FHIRPATH_PROFILE_OPTIONS,
	FORM_BOOLEAN_FIELDS,
	TRANSLATION_LANGUAGE_OPTIONS,
} from "./field-definitions";

export type ConfigurationWidget =
	| "text"
	| "textarea"
	| "jsonEditor"
	| "keyValueTable"
	| "checkbox"
	| "triStateBoolean"
	| "select"
	| "booleanSelect"
	| "storageAccountSelect"
	| "multiSelect"
	| "themeSelect";

export type ConfigurationSelectOption = {
	label: string;
	value: string;
};

export type ConfigurationFieldNode = {
	addLabel?: string;
	defaultLabel?: string;
	description?: string;
	editorExtensions?: Extension[];
	emptyText?: string;
	falseLabel?: string;
	id: string;
	inputMode?: "numeric";
	keyPlaceholder?: string;
	kind: "field";
	label: string;
	options?: ConfigurationSelectOption[];
	path: string;
	placeholder?: string;
	rows?: number;
	search?: string[];
	span?: 1 | 2 | 3;
	trueLabel?: string;
	valuePlaceholder?: string;
	widget: ConfigurationWidget;
};

export type ConfigurationGroupNode = {
	children: ConfigurationNode[];
	cols?: 1 | 2 | 3;
	compositeSearch?: true;
	kind: "group";
};

export type ConfigurationArrayNode = {
	addLabel: string;
	emptyText: string;
	exclusiveTrueFieldIds?: string[];
	item: ConfigurationGroupNode;
	path: string;
	kind: "array";
};

export type ConfigurationNode =
	| ConfigurationGroupNode
	| ConfigurationArrayNode
	| ConfigurationFieldNode;

export type ConfigurationSubsection = {
	category: string[];
	description: string;
	nodes: ConfigurationNode[];
};

export type ConfigurationSection = {
	category: string[];
	icon: LucideIcon;
	subcategories: ConfigurationSubsection[];
};

export type FilteredConfigurationSubsection = ConfigurationSubsection & {
	nodes: ConfigurationNode[];
};

export type FilteredConfigurationSection = Omit<
	ConfigurationSection,
	"subcategories"
> & {
	subcategories: FilteredConfigurationSubsection[];
};

type SearchEntry = {
	id: string;
	search: string[];
};

function buildJsonSchemaEditorExtensions(schema: object): Extension[] {
	return [
		linter(jsonSchemaLinter(), {
			needsRefresh: handleRefresh,
		}),
		jsonLanguage.data.of({
			autocomplete: jsonCompletion(),
		}),
		stateExtensions(schema),
	];
}

const translationsJsonEditorExtensions = buildJsonSchemaEditorExtensions(
	customizableMessagesSchema,
);

export const CONFIGURATION_SCHEMA: ConfigurationSection[] = [
	{
		category: ["General"],
		icon: Settings,
		subcategories: [
			{
				category: ["General", "Basics"],
				description: "Identity and description fields",
				nodes: [
					{
						description: "Machine-readable configuration name.",
						id: "name",
						kind: "field",
						label: "Name",
						path: "general.name",
						placeholder: "default-config",
						widget: "text",
					},
					{
						id: "description",
						kind: "field",
						label: "Description",
						path: "general.description",
						placeholder: "Describe when this configuration should be used.",
						rows: 4,
						widget: "textarea",
					},
					{
						description: "Mark this resource as the system or tenant default.",
						id: "default",
						kind: "field",
						label: "Default configuration",
						path: "general.default",
						widget: "checkbox",
					},
				],
			},
			{
				category: ["General", "Presentation"],
				description: "Language, theme, and default behavior",
				nodes: [
					{
						children: [
							{
								description: "Default UI language code.",
								id: "language",
								kind: "field",
								label: "Language",
								options: [...TRANSLATION_LANGUAGE_OPTIONS],
								path: "general.language",
								placeholder: "Select language",
								widget: "select",
							},
							{
								description: "Select a default renderer theme by reference.",
								id: "theme",
								kind: "field",
								label: "Theme",
								path: "general.themeReference",
								widget: "themeSelect",
								span: 2,
							},
						],
						cols: 3,
						kind: "group",
					},
				],
			},
			{
				category: ["General", "Translations"],
				description: "Custom UI translation overrides",
				nodes: [
					{
						description: "JSON object of custom UI translation overrides.",
						editorExtensions: translationsJsonEditorExtensions,
						id: "translations",
						kind: "field",
						label: "Custom translations",
						path: "general.translationsJson",
						rows: 8,
						widget: "jsonEditor",
					},
				],
			},
		],
	},
	{
		category: ["Storage"],
		icon: Database,
		subcategories: [
			{
				category: ["Storage", "Account"],
				description: "Storage account and credential references",
				nodes: [
					{
						description:
							"Reference to AwsAccount, GcpServiceAccount, or AzureContainer.",
						id: "accountReference",
						kind: "field",
						label: "Account reference",
						options: [{ label: "No account", value: "" }],
						path: "storage.accountReference",
						placeholder: "Select account",
						search: ["AwsAccount", "GcpServiceAccount", "AzureContainer"],
						widget: "storageAccountSelect",
					},
				],
			},
			{
				category: ["Storage", "Container"],
				description: "Bucket and container configuration",
				nodes: [
					{
						children: [
							{
								id: "bucket",
								kind: "field",
								label: "Bucket",
								path: "storage.bucket",
								placeholder: "attachments-bucket",
								widget: "text",
							},
							{
								id: "storageAccount",
								kind: "field",
								label: "Azure storage account",
								path: "storage.storageAccount",
								placeholder: "storage-account",
								widget: "text",
							},
							{
								id: "container",
								kind: "field",
								label: "Azure container",
								path: "storage.container",
								placeholder: "attachments",
								widget: "text",
							},
						],
						kind: "group",
					},
				],
			},
			{
				category: ["Storage", "Attachment URLs"],
				description: "Attachment URL storage behavior",
				nodes: [
					{
						description:
							"Choose whether attachment URLs are stored as relative or absolute URLs in QuestionnaireResponse resources.",
						id: "storeAbsoluteUrl",
						kind: "field",
						label: "Attachment URLs",
						falseLabel: "Relative",
						path: "storage.storeAbsoluteUrl",
						search: ["attachments"],
						trueLabel: "Absolute",
						widget: "triStateBoolean",
					},
				],
			},
		],
	},
	{
		category: ["External services"],
		icon: Globe,
		subcategories: [
			{
				category: ["External services", "Form store"],
				description:
					"FHIR server used for loading and saving Questionnaire resources.",
				nodes: [
					{
						id: "endpoint",
						kind: "field",
						label: "Endpoint",
						path: "services.formStore.endpoint",
						placeholder: "https://example.com/fhir",
						search: [
							"Form store",
							"FHIR server used for loading and saving Questionnaire resources.",
						],
						widget: "text",
					},
					{
						addLabel: "Add header",
						description: "HTTP headers sent with requests to the form store.",
						emptyText: "No request headers configured.",
						id: "headers",
						keyPlaceholder: "Authorization",
						kind: "field",
						label: "Headers",
						path: "services.formStore.headers",
						search: ["Form store"],
						valuePlaceholder: "Bearer ...",
						widget: "keyValueTable",
					},
					{
						description:
							"OAuth2 token endpoint of the form store. Leave empty when the service takes a static header instead.",
						id: "authTokenEndpoint",
						kind: "field",
						label: "Token endpoint",
						path: "services.formStore.auth.tokenEndpoint",
						placeholder: "https://example.com/oauth2/token",
						search: ["OAuth2", "client credentials", "Token endpoint"],
						widget: "text",
					},
					{
						id: "authClientId",
						kind: "field",
						label: "Client id",
						path: "services.formStore.auth.clientId",
						placeholder: "formbox",
						search: ["OAuth2", "client credentials", "Client id"],
						widget: "text",
					},
					{
						description:
							"Stored encrypted. Leave empty to keep a secret that lives in the vault or in the box settings.",
						id: "authClientSecret",
						kind: "field",
						label: "Client secret",
						path: "services.formStore.auth.clientSecret",
						placeholder: "Client secret",
						search: ["OAuth2", "client credentials", "Client secret"],
						widget: "text",
					},
					{
						id: "authScope",
						kind: "field",
						label: "Scope",
						path: "services.formStore.auth.scope",
						placeholder: "system/*.read",
						search: ["OAuth2", "client credentials", "Scope"],
						widget: "text",
					},
				],
			},
			{
				category: ["External services", "Terminology store"],
				description:
					"FHIR server that stores terminology resources and expands ValueSets. Uses Aidbox when unset.",
				nodes: [
					{
						id: "endpoint",
						kind: "field",
						label: "Endpoint",
						path: "services.termServer.endpoint",
						placeholder: "https://tx.example.com/fhir",
						search: [
							"Terminology server",
							"FHIR terminology server used for ValueSet expansion and lookup.",
						],
						widget: "text",
					},
					{
						addLabel: "Add header",
						description:
							"HTTP headers sent with requests to the terminology server.",
						emptyText: "No request headers configured.",
						id: "headers",
						keyPlaceholder: "Authorization",
						kind: "field",
						label: "Headers",
						path: "services.termServer.headers",
						search: ["Terminology server"],
						valuePlaceholder: "Bearer ...",
						widget: "keyValueTable",
					},
					{
						description:
							"OAuth2 token endpoint of the terminology server. Leave empty when the service takes a static header instead.",
						id: "authTokenEndpoint",
						kind: "field",
						label: "Token endpoint",
						path: "services.termServer.auth.tokenEndpoint",
						placeholder: "https://example.com/oauth2/token",
						search: ["OAuth2", "client credentials", "Token endpoint"],
						widget: "text",
					},
					{
						id: "authClientId",
						kind: "field",
						label: "Client id",
						path: "services.termServer.auth.clientId",
						placeholder: "formbox",
						search: ["OAuth2", "client credentials", "Client id"],
						widget: "text",
					},
					{
						description:
							"Stored encrypted. Leave empty to keep a secret that lives in the vault or in the box settings.",
						id: "authClientSecret",
						kind: "field",
						label: "Client secret",
						path: "services.termServer.auth.clientSecret",
						placeholder: "Client secret",
						search: ["OAuth2", "client credentials", "Client secret"],
						widget: "text",
					},
					{
						id: "authScope",
						kind: "field",
						label: "Scope",
						path: "services.termServer.auth.scope",
						placeholder: "system/*.read",
						search: ["OAuth2", "client credentials", "Scope"],
						widget: "text",
					},
				],
			},
			{
				category: ["External services", "Data store"],
				description:
					"FHIR server used for QuestionnaireResponse and data operations.",
				nodes: [
					{
						id: "endpoint",
						kind: "field",
						label: "Endpoint",
						path: "services.dataStore.endpoint",
						placeholder: "https://example.com/fhir",
						search: [
							"Data store",
							"FHIR server used for QuestionnaireResponse and data operations.",
						],
						widget: "text",
					},
					{
						addLabel: "Add header",
						description: "HTTP headers sent with requests to the data store.",
						emptyText: "No request headers configured.",
						id: "headers",
						keyPlaceholder: "Authorization",
						kind: "field",
						label: "Headers",
						path: "services.dataStore.headers",
						search: ["Data store"],
						valuePlaceholder: "Bearer ...",
						widget: "keyValueTable",
					},
					{
						description:
							"OAuth2 token endpoint of the data store. Leave empty when the service takes a static header instead.",
						id: "authTokenEndpoint",
						kind: "field",
						label: "Token endpoint",
						path: "services.dataStore.auth.tokenEndpoint",
						placeholder: "https://example.com/oauth2/token",
						search: ["OAuth2", "client credentials", "Token endpoint"],
						widget: "text",
					},
					{
						id: "authClientId",
						kind: "field",
						label: "Client id",
						path: "services.dataStore.auth.clientId",
						placeholder: "formbox",
						search: ["OAuth2", "client credentials", "Client id"],
						widget: "text",
					},
					{
						description:
							"Stored encrypted. Leave empty to keep a secret that lives in the vault or in the box settings.",
						id: "authClientSecret",
						kind: "field",
						label: "Client secret",
						path: "services.dataStore.auth.clientSecret",
						placeholder: "Client secret",
						search: ["OAuth2", "client credentials", "Client secret"],
						widget: "text",
					},
					{
						id: "authScope",
						kind: "field",
						label: "Scope",
						path: "services.dataStore.auth.scope",
						placeholder: "system/*.read",
						search: ["OAuth2", "client credentials", "Scope"],
						widget: "text",
					},
				],
			},
			{
				category: ["External services", "DTR service"],
				description:
					"External Da Vinci DTR service answering $questionnaire-package and $next-question. Uses the built-in implementation when unset.",
				nodes: [
					{
						id: "endpoint",
						kind: "field",
						label: "Endpoint",
						path: "services.dtrService.endpoint",
						placeholder: "https://dtr.payer.example",
						search: [
							"DTR service",
							"Da Vinci",
							"questionnaire-package",
							"next-question",
							"MCG",
							"InterQual",
						],
						widget: "text",
					},
					{
						addLabel: "Add header",
						description: "HTTP headers sent with requests to the DTR service.",
						emptyText: "No request headers configured.",
						id: "headers",
						keyPlaceholder: "x-api-key",
						kind: "field",
						label: "Headers",
						path: "services.dtrService.headers",
						search: ["DTR service"],
						valuePlaceholder: "...",
						widget: "keyValueTable",
					},
					{
						description:
							"OAuth2 token endpoint of the DTR service. Leave empty when the service takes a static header instead.",
						id: "authTokenEndpoint",
						kind: "field",
						label: "Token endpoint",
						path: "services.dtrService.auth.tokenEndpoint",
						placeholder: "https://example.com/oauth2/token",
						search: ["OAuth2", "client credentials", "Token endpoint"],
						widget: "text",
					},
					{
						id: "authClientId",
						kind: "field",
						label: "Client id",
						path: "services.dtrService.auth.clientId",
						placeholder: "formbox",
						search: ["OAuth2", "client credentials", "Client id"],
						widget: "text",
					},
					{
						description:
							"Stored encrypted. Leave empty to keep a secret that lives in the vault or in the box settings.",
						id: "authClientSecret",
						kind: "field",
						label: "Client secret",
						path: "services.dtrService.auth.clientSecret",
						placeholder: "Client secret",
						search: ["OAuth2", "client credentials", "Client secret"],
						widget: "text",
					},
					{
						id: "authScope",
						kind: "field",
						label: "Scope",
						path: "services.dtrService.auth.scope",
						placeholder: "system/*.read",
						search: ["OAuth2", "client credentials", "Scope"],
						widget: "text",
					},
				],
			},
		],
	},
	{
		category: ["Builder"],
		icon: Blocks,
		subcategories: [
			{
				category: ["Builder", "Shell"],
				description: "Builder shell and translation settings",
				nodes: [
					{
						children: [
							{
								description:
									"Prefix used by the builder when generating new form URLs.",
								id: "formUrlPrefix",
								kind: "field",
								label: "Form URL prefix",
								path: "builder.formUrlPrefix",
								placeholder: "https://example.com/forms/",
								span: 2,
								widget: "text",
							},
							{
								description:
									"Changes the overall builder interface and settings layout.",
								id: "layout",
								kind: "field",
								label: "Layout",
								options: BUILDER_LAYOUT_OPTIONS.map((option) => ({
									label: option.label,
									value: option.value,
								})),
								path: "builder.layout",
								widget: "select",
							},
							{
								description:
									"Profile every FHIRPath expression in a form must fit. Pick one when forms built here run in another SDC runtime; otherwise each expression is checked against the engine that evaluates it.",
								id: "fhirpathProfile",
								kind: "field",
								label: "FHIRPath compatibility profile",
								options: FHIRPATH_PROFILE_OPTIONS.map((option) => ({
									label: option.label,
									value: option.value,
								})),
								path: "builder.fhirpathProfile",
								search: ["FHIRPath", "profile", "compatibility"],
								widget: "select",
							},
						],
						cols: 3,
						kind: "group",
					},
					{
						description:
							"Restrict the builder translation picker to these languages. Leave empty to allow all supported languages.",
						id: "translationLanguages",
						kind: "field",
						label: "Translation languages",
						options: [...TRANSLATION_LANGUAGE_OPTIONS],
						path: "builder.translationLanguages",
						widget: "multiSelect",
					},
				],
			},
			{
				category: ["Builder", "Flags"],
				description: "Builder feature flags",
				nodes: [
					{
						children: BUILDER_BOOLEAN_FIELDS.map((config) => ({
							falseLabel: config.falseLabel,
							description: config.description,
							id: config.key,
							kind: "field" as const,
							label: config.label,
							path: `builder.flags.${config.key}`,
							search: [config.resourceKey],
							trueLabel: config.trueLabel,
							widget: "triStateBoolean" as const,
						})),
						kind: "group",
					},
				],
			},
			{
				category: ["Builder", "Terminology server choices"],
				description:
					"Additional terminology servers available to questionnaire authors; one can be the default.",
				nodes: [
					{
						addLabel: "Add terminology server",
						emptyText: "No additional terminology servers configured.",
						exclusiveTrueFieldIds: ["default"],
						item: {
							children: [
								{
									description:
										"Display name shown in the builder's terminology server list.",
									id: "name",
									kind: "field",
									label: "Name",
									path: "name",
									widget: "text",
								},
								{
									description:
										"Prefill this server when an author enables external terminology for an item.",
									id: "default",
									kind: "field",
									label: "Default server",
									options: [
										{ label: "No", value: "false" },
										{ label: "Yes", value: "true" },
									],
									path: "default",
									widget: "booleanSelect",
								},
								{
									description: "FHIR terminology server base URL.",
									id: "url",
									kind: "field",
									label: "URL",
									path: "url",
									placeholder: "https://tx.example.com/fhir",
									span: 2,
									widget: "text",
								},
							],
							cols: 2,
							compositeSearch: true,
							kind: "group",
						},
						kind: "array",
						path: "builder.externalTerminologyServers",
					},
				],
			},
			{
				category: ["Builder", "Custom renderers"],
				description: "Renderer integrations exposed in the builder",
				nodes: [
					{
						addLabel: "Add renderer",
						emptyText: "No custom renderers configured.",
						exclusiveTrueFieldIds: ["default"],
						item: {
							children: [
								{
									description: "Renderer name.",
									id: "name",
									kind: "field",
									label: "Name",
									path: "name",
									widget: "text",
								},
								{
									description: "Use this renderer by default.",
									id: "default",
									kind: "field",
									label: "Default renderer",
									options: [
										{ label: "No", value: "false" },
										{ label: "Yes", value: "true" },
									],
									path: "default",
									widget: "booleanSelect",
								},
								{
									description: "Renderer page URL.",
									id: "url",
									kind: "field",
									label: "URL",
									path: "url",
									placeholder: "https://renderer.example.com",
									span: 2,
									widget: "text",
								},
							],
							cols: 2,
							compositeSearch: true,
							kind: "group",
						},
						kind: "array",
						path: "builder.customRenderers",
					},
				],
			},
		],
	},
	{
		category: ["Renderer"],
		icon: FileText,
		subcategories: [
			{
				category: ["Renderer", "Redirects"],
				description: "Post-save and post-submit redirects",
				nodes: [
					{
						children: [
							{
								id: "redirectOnSubmit",
								kind: "field",
								label: "Redirect on submit",
								path: "form.redirectOnSubmit",
								placeholder: "https://example.com/submit",
								widget: "text",
							},
							{
								id: "redirectOnSave",
								kind: "field",
								label: "Redirect on save",
								path: "form.redirectOnSave",
								placeholder: "https://example.com/save",
								widget: "text",
							},
						],
						cols: 2,
						kind: "group",
					},
				],
			},
			{
				category: ["Renderer", "Display"],
				description: "Renderer shell display options",
				nodes: [
					{
						children: [
							{
								description: "Recorded in AuditEvent logs.",
								id: "appName",
								kind: "field",
								label: "App name",
								path: "form.appName",
								placeholder: "patient-portal",
								widget: "text",
							},
							{
								description: "Accepts any CSS width unit.",
								id: "defaultMaxWidth",
								kind: "field",
								label: "Default max width",
								path: "form.defaultMaxWidth",
								placeholder: "960px",
								widget: "text",
							},
							{
								description: "Milliseconds between automatic saves.",
								id: "autoSaveInterval",
								inputMode: "numeric",
								kind: "field",
								label: "Auto-save interval",
								path: "form.autoSaveInterval",
								placeholder: "5000",
								widget: "text",
							},
						],
						cols: 3,
						kind: "group",
					},
				],
			},
			{
				category: ["Renderer", "Flags"],
				description: "Renderer feature flags",
				nodes: [
					{
						children: FORM_BOOLEAN_FIELDS.map((config) => ({
							falseLabel: config.falseLabel,
							description: config.description,
							id: config.key,
							kind: "field" as const,
							label: config.label,
							path: `form.flags.${config.key}`,
							search: [config.resourceKey],
							trueLabel: config.trueLabel,
							widget: "triStateBoolean" as const,
						})),
						kind: "group",
					},
				],
			},
		],
	},
];

type SearchIndexContext = {
	section: ConfigurationSection;
	subsection: ConfigurationSubsection;
};

function buildFieldIdPrefix(fieldId: string, path: string) {
	return `field:${fieldId}:${path}`;
}

function nodeSearchText(
	label: string | undefined,
	description: string | undefined,
	search: string[] | undefined,
	context: SearchIndexContext,
) {
	return [
		label,
		description,
		...context.section.category,
		...context.subsection.category,
		...(search ?? []),
	].filter((value): value is string => Boolean(value));
}

function collectNodeEntries(
	node: ConfigurationNode,
	context: SearchIndexContext,
): SearchEntry[] {
	if (node.kind === "field") {
		return [
			{
				id: buildFieldIdPrefix(node.id, node.path),
				search: nodeSearchText(
					node.label,
					node.description,
					node.search,
					context,
				),
			},
		];
	}

	if (node.kind === "array") {
		return collectNodeEntries(node.item, context);
	}

	return node.children.flatMap((childNode) =>
		collectNodeEntries(childNode, context),
	);
}

function createSchemaSearchIndex(sections: ConfigurationSection[]) {
	const entries = sections.flatMap((sectionDef) =>
		sectionDef.subcategories.flatMap((subcategoryDef) =>
			subcategoryDef.nodes.flatMap((node) =>
				collectNodeEntries(node, {
					section: sectionDef,
					subsection: subcategoryDef,
				}),
			),
		),
	);

	return (query: string) => {
		const normalizedQuery = query.trim().toLowerCase();

		if (!normalizedQuery) {
			return new Set(entries.map((entry) => entry.id));
		}

		return new Set(
			entries
				.filter((entry) =>
					entry.search.some((token) =>
						token.toLowerCase().includes(normalizedQuery),
					),
				)
				.map((entry) => entry.id),
		);
	};
}

const schemaSearch = createSchemaSearchIndex(CONFIGURATION_SCHEMA);

function groupHasMatchedDescendant(
	groupNode: ConfigurationGroupNode,
	matchedIds: Set<string>,
) {
	return groupNode.children.some((childNode) => {
		if (childNode.kind === "field") {
			return matchedIds.has(buildFieldIdPrefix(childNode.id, childNode.path));
		}

		const visibleChild = includeNode(childNode, matchedIds);
		return visibleChild !== null;
	});
}

function includeNode(
	node: ConfigurationNode,
	matchedIds: Set<string>,
): ConfigurationNode | null {
	if (node.kind === "field") {
		return matchedIds.has(buildFieldIdPrefix(node.id, node.path)) ? node : null;
	}

	if (node.kind === "array") {
		const visibleItem = includeNode(node.item, matchedIds);

		if (!visibleItem || visibleItem.kind !== "group") {
			return null;
		}

		return { ...node, item: visibleItem };
	}

	if (node.compositeSearch) {
		return groupHasMatchedDescendant(node, matchedIds) ? node : null;
	}

	const children = node.children.flatMap((childNode) => {
		const visibleChild = includeNode(childNode, matchedIds);
		return visibleChild ? [visibleChild] : [];
	});

	if (children.length === 0) {
		return null;
	}

	return { ...node, children };
}

export function buildSectionId(category: string[]) {
	return `${category
		.map((part) => part.toLowerCase())
		.join("-")
		.replace(/ /g, "-")}-settings`;
}

export function categoryKey(category: string[]) {
	return category.join(" ");
}

export function filterConfigurationSchema(
	search: string,
): FilteredConfigurationSection[] {
	const matchedIds = schemaSearch(search);

	return CONFIGURATION_SCHEMA.flatMap((sectionDef) => {
		const subcategories = sectionDef.subcategories.flatMap((subcategoryDef) => {
			const nodes = subcategoryDef.nodes.flatMap((node) => {
				const visibleNode = includeNode(node, matchedIds);
				return visibleNode ? [visibleNode] : [];
			});

			if (nodes.length === 0) {
				return [];
			}

			return [{ ...subcategoryDef, nodes }];
		});

		if (subcategories.length === 0) {
			return [];
		}

		return [{ ...sectionDef, subcategories }];
	});
}

export function getVisibleConfigurationCategoryKeys(
	sections: FilteredConfigurationSection[],
) {
	const visibleCategories = new Set<string>();

	for (const sectionDef of sections) {
		visibleCategories.add(categoryKey(sectionDef.category));

		for (const subsectionDef of sectionDef.subcategories) {
			visibleCategories.add(categoryKey(subsectionDef.category));
		}
	}

	return visibleCategories;
}
