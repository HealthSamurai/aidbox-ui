import { z } from "zod";
import type { Reference } from "../../../fhir-types/hl7-fhir-r5-core";
import type {
	SDCConfig,
	SDCConfigBuilderCustom_renderers,
	SDCConfigBuilderExternal_terminology_servers,
} from "../../../fhir-types/io-health-samurai-sdc-r4";
import {
	BUILDER_BOOLEAN_FIELDS,
	FORM_BOOLEAN_FIELDS,
} from "./field-definitions";

const NULLABLE_BOOLEAN_VALUES = ["", "true", "false"] as const;

const jsonObjectFieldSchema = z.string().superRefine((value, context) => {
	if (!value.trim()) {
		return;
	}

	try {
		const parsed = JSON.parse(value) as unknown;

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			context.addIssue({
				code: "custom",
				message: "Must be a JSON object",
			});
		}
	} catch {
		context.addIssue({
			code: "custom",
			message: "Must be valid JSON",
		});
	}
});

const headersFieldSchema = z
	.array(
		z.object({
			key: z.string(),
			value: z.string(),
		}),
	)
	.superRefine((headers, context) => {
		const seenHeaderNames = new Set<string>();

		headers.forEach((header, index) => {
			const headerName = header.key.trim();

			if (!headerName) {
				if (header.value.length > 0) {
					context.addIssue({
						code: "custom",
						message: "Header name is required",
						path: [index, "key"],
					});
				}
				return;
			}

			const normalizedHeaderName = headerName.toLowerCase();
			if (seenHeaderNames.has(normalizedHeaderName)) {
				context.addIssue({
					code: "custom",
					message: `Header "${headerName}" is duplicated`,
					path: [index, "key"],
				});
			}
			seenHeaderNames.add(normalizedHeaderName);
		});
	});

const builderFlagsSchema = z.object(
	Object.fromEntries(
		BUILDER_BOOLEAN_FIELDS.map((field) => [
			field.key,
			z.enum(NULLABLE_BOOLEAN_VALUES),
		]),
	),
);

const formFlagsSchema = z.object(
	Object.fromEntries(
		FORM_BOOLEAN_FIELDS.map((field) => [
			field.key,
			z.enum(NULLABLE_BOOLEAN_VALUES),
		]),
	),
);

const serviceAuthFieldSchema = z.object({
	clientId: z.string(),
	clientSecret: z.string(),
	scope: z.string(),
	tokenEndpoint: z.string(),
});

const serviceFieldSchema = z.object({
	auth: serviceAuthFieldSchema,
	endpoint: z.string(),
	headers: headersFieldSchema,
});

export const configurationFormSchema = z.object({
	general: z.object({
		default: z.boolean(),
		description: z.string(),
		language: z.string(),
		name: z.string().trim().min(1, "Name is required"),
		themeReference: z.string(),
		translationsJson: jsonObjectFieldSchema,
	}),
	storage: z.object({
		accountReference: z.string(),
		bucket: z.string(),
		container: z.string(),
		storageAccount: z.string(),
		storeAbsoluteUrl: z.enum(NULLABLE_BOOLEAN_VALUES),
	}),
	services: z.object({
		dataStore: serviceFieldSchema,
		dtrService: serviceFieldSchema,
		formStore: serviceFieldSchema,
		termServer: serviceFieldSchema,
	}),
	builder: z.object({
		customRenderers: z
			.array(
				z.object({
					default: z.boolean(),
					name: z.string(),
					url: z.string(),
				}),
			)
			.superRefine((renderers, context) => {
				if (renderers.filter((renderer) => renderer.default).length > 1) {
					context.addIssue({
						code: "custom",
						message: "Only one renderer can be default",
					});
				}
			}),
		externalTerminologyServers: z
			.array(
				z.object({
					default: z.boolean(),
					name: z.string(),
					url: z.string(),
				}),
			)
			.superRefine((servers, context) => {
				if (servers.filter((server) => server.default).length > 1) {
					context.addIssue({
						code: "custom",
						message: "Only one terminology server can be default",
					});
				}
			}),
		fhirpathProfile: z.string(),
		flags: builderFlagsSchema,
		formUrlPrefix: z.string(),
		layout: z.string(),
		translationLanguages: z.array(z.string()),
	}),
	form: z.object({
		appName: z.string(),
		autoSaveInterval: z.string(),
		defaultMaxWidth: z.string(),
		flags: formFlagsSchema,
		redirectOnSave: z.string(),
		redirectOnSubmit: z.string(),
	}),
});

export type ConfigurationFormValues = z.infer<typeof configurationFormSchema>;
export type NullableBooleanValue = (typeof NULLABLE_BOOLEAN_VALUES)[number];

type ConfigurationRecord = SDCConfig & Record<string, unknown>;
type ConfigurationSection = Record<string, unknown>;
type BuilderFlagKey = keyof ConfigurationFormValues["builder"]["flags"];
type FormFlagKey = keyof ConfigurationFormValues["form"]["flags"];
type ResourceReference = Reference & {
	id?: string;
	resourceType?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSection(
	resource: Record<string, unknown> | undefined,
	key: string,
): ConfigurationSection | undefined {
	const value = resource?.[key];
	return isObject(value) ? value : undefined;
}

function getStringValue(
	section: Record<string, unknown> | undefined,
	key: string,
) {
	const value = section?.[key];
	return typeof value === "string" ? value : "";
}

function getNullableBooleanValue(
	section: Record<string, unknown> | undefined,
	key: string,
): NullableBooleanValue {
	if (section?.[key] === true) {
		return "true";
	}

	if (section?.[key] === false) {
		return "false";
	}

	return "";
}

function getReferenceString(
	reference?: ResourceReference | Record<string, unknown>,
) {
	if (!reference || typeof reference !== "object") {
		return "";
	}

	if (typeof reference.reference === "string") {
		return reference.reference;
	}

	if (
		typeof reference.resourceType === "string" &&
		typeof reference.id === "string"
	) {
		return `${reference.resourceType}/${reference.id}`;
	}

	return "";
}

function normalizeReferenceToResourcePath(
	reference: string,
	resourceType: string,
) {
	const trimmedReference = reference.trim();

	if (!trimmedReference) {
		return "";
	}

	const canonicalPrefix = `${resourceType}/`;

	if (trimmedReference.startsWith(canonicalPrefix)) {
		return trimmedReference;
	}

	const matchedId = trimmedReference.match(
		new RegExp(`(?:^|/)${resourceType}/([^/?#]+)`),
	)?.[1];

	if (matchedId) {
		return `${resourceType}/${decodeURIComponent(matchedId)}`;
	}

	if (
		!trimmedReference.includes("/") &&
		!trimmedReference.includes("?") &&
		!trimmedReference.includes("#")
	) {
		return `${resourceType}/${trimmedReference}`;
	}

	return trimmedReference;
}

function getQuestionnaireThemeReference(
	reference?: ResourceReference | Record<string, unknown>,
) {
	return normalizeReferenceToResourcePath(
		getReferenceString(reference),
		"QuestionnaireTheme",
	);
}

function stringifyJson(value: unknown) {
	if (!isObject(value)) {
		return "";
	}

	return JSON.stringify(value, null, 2);
}

function parseJsonObject(value: string) {
	if (!value.trim()) {
		return undefined;
	}

	return JSON.parse(value) as Record<string, unknown>;
}

function toHeadersFormValues(value: unknown) {
	if (!isObject(value)) {
		return [];
	}

	return Object.entries(value).map(([key, entryValue]) => ({
		key,
		value: typeof entryValue === "string" ? entryValue : String(entryValue),
	}));
}

function headersToRecord(
	headers: ConfigurationFormValues["services"]["formStore"]["headers"],
) {
	const entries = headers.flatMap((header) => {
		const key = header.key.trim();
		return key ? ([[key, header.value]] as const) : [];
	});

	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function nullableBooleanToResourceValue(value?: NullableBooleanValue) {
	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return undefined;
}

function toCustomRendererFormValues(
	renderers?: SDCConfigBuilderCustom_renderers[],
) {
	return (
		renderers?.map((renderer) => ({
			default: renderer.default === true,
			name: renderer.name ?? "",
			url: renderer.url ?? "",
		})) ?? []
	);
}

function toExternalTerminologyServerFormValues(
	servers?: SDCConfigBuilderExternal_terminology_servers[],
) {
	return (
		servers?.map((server) => ({
			default: server.default === true,
			name: server.name ?? "",
			url: server.url ?? "",
		})) ?? []
	);
}

function toBuilderFlags(section: ConfigurationSection | undefined) {
	return Object.fromEntries(
		BUILDER_BOOLEAN_FIELDS.map((field) => [
			field.key,
			getNullableBooleanValue(section, field.resourceKey),
		]),
	) as ConfigurationFormValues["builder"]["flags"];
}

function toFormFlags(section: ConfigurationSection | undefined) {
	return Object.fromEntries(
		FORM_BOOLEAN_FIELDS.map((field) => [
			field.key,
			getNullableBooleanValue(section, field.resourceKey),
		]),
	) as ConfigurationFormValues["form"]["flags"];
}

function cleanArray<T extends Record<string, unknown>>(values: T[]) {
	return values.filter((value) =>
		Object.entries(value).some(([key, entryValue]) =>
			key === "default"
				? entryValue === true
				: typeof entryValue === "string"
					? entryValue.trim().length > 0
					: Boolean(entryValue),
		),
	);
}

function assignOptionalSectionValue(
	target: Record<string, unknown>,
	key: string,
	value: unknown,
) {
	if (value === undefined || value === "") {
		delete target[key];
		return;
	}

	target[key] = value;
}

function trimmedOrUndefined(value: string) {
	return value.trim() || undefined;
}

function buildReference(
	value: string,
	original: ResourceReference | Record<string, unknown> | undefined,
	resourceType?: string,
) {
	const trimmedValue = value.trim();

	if (!trimmedValue) {
		return undefined;
	}

	const originalValue = resourceType
		? normalizeReferenceToResourcePath(
				getReferenceString(original),
				resourceType,
			)
		: getReferenceString(original);

	if (original && trimmedValue === originalValue) {
		return structuredClone(original);
	}

	return {
		reference: trimmedValue as `${string}/${string}`,
	} satisfies Reference;
}

function cloneSection(section?: ConfigurationSection) {
	return structuredClone(section ?? {});
}

function buildGeneralSection(
	next: ConfigurationRecord,
	values: ConfigurationFormValues,
) {
	next.name = values.general.name.trim();
	assignOptionalSectionValue(
		next,
		"description",
		trimmedOrUndefined(values.general.description),
	);
	assignOptionalSectionValue(
		next,
		"language",
		trimmedOrUndefined(values.general.language),
	);

	if (values.general.default) {
		next.default = true;
	} else if (next.default !== false) {
		delete next.default;
	}

	assignOptionalSectionValue(
		next,
		"theme",
		buildReference(
			values.general.themeReference,
			next.theme as Reference | undefined,
			"QuestionnaireTheme",
		),
	);

	assignOptionalSectionValue(
		next,
		"translations",
		parseJsonObject(values.general.translationsJson),
	);
}

function buildStorageSection(
	values: ConfigurationFormValues,
	original?: ConfigurationSection,
) {
	const storage = cloneSection(original);

	assignOptionalSectionValue(
		storage,
		"account",
		buildReference(
			values.storage.accountReference,
			storage.account as Reference | undefined,
		),
	);

	assignOptionalSectionValue(
		storage,
		"bucket",
		trimmedOrUndefined(values.storage.bucket),
	);
	assignOptionalSectionValue(
		storage,
		"storageAccount",
		trimmedOrUndefined(values.storage.storageAccount),
	);
	assignOptionalSectionValue(
		storage,
		"container",
		trimmedOrUndefined(values.storage.container),
	);
	assignOptionalSectionValue(
		storage,
		"store-absolute-url",
		nullableBooleanToResourceValue(values.storage.storeAbsoluteUrl),
	);

	return Object.keys(storage).length > 0 ? storage : undefined;
}

function toServiceFormValues(
	section?: ConfigurationSection,
): ConfigurationFormValues["services"]["formStore"] {
	const auth = getSection(section, "auth");

	return {
		auth: {
			clientId: getStringValue(auth, "client-id"),
			clientSecret: getStringValue(auth, "client-secret"),
			scope: getStringValue(auth, "scope"),
			tokenEndpoint: getStringValue(auth, "token-endpoint"),
		},
		endpoint: getStringValue(section, "endpoint"),
		headers: toHeadersFormValues(section?.headers),
	};
}

function buildServiceAuth(
	auth: ConfigurationFormValues["services"]["formStore"]["auth"],
	original?: ConfigurationSection,
) {
	const section = cloneSection(original);
	assignOptionalSectionValue(
		section,
		"token-endpoint",
		trimmedOrUndefined(auth.tokenEndpoint),
	);
	assignOptionalSectionValue(
		section,
		"client-id",
		trimmedOrUndefined(auth.clientId),
	);
	// left empty on purpose when the secret lives in the vault: the
	// `_client-secret` reference of the original section stays untouched
	assignOptionalSectionValue(
		section,
		"client-secret",
		trimmedOrUndefined(auth.clientSecret),
	);
	assignOptionalSectionValue(section, "scope", trimmedOrUndefined(auth.scope));
	return Object.keys(section).length > 0 ? section : undefined;
}

function buildServiceSection(
	service: ConfigurationFormValues["services"]["formStore"],
	original?: ConfigurationSection,
) {
	const section = cloneSection(original);
	assignOptionalSectionValue(
		section,
		"endpoint",
		trimmedOrUndefined(service.endpoint),
	);
	assignOptionalSectionValue(
		section,
		"headers",
		headersToRecord(service.headers),
	);
	assignOptionalSectionValue(
		section,
		"auth",
		buildServiceAuth(service.auth, getSection(section, "auth")),
	);
	return Object.keys(section).length > 0 ? section : undefined;
}

function buildBuilderSection(
	values: ConfigurationFormValues,
	original?: ConfigurationSection,
) {
	const builder = cloneSection(original);
	const originalRenderers = builder["custom-renderers"] as
		| SDCConfigBuilderCustom_renderers[]
		| undefined;
	const originalExternalTerminologyServers = builder[
		"external-terminology-servers"
	] as SDCConfigBuilderExternal_terminology_servers[] | undefined;

	assignOptionalSectionValue(
		builder,
		"fhirpath-profile",
		trimmedOrUndefined(values.builder.fhirpathProfile),
	);
	assignOptionalSectionValue(
		builder,
		"form-url-prefix",
		trimmedOrUndefined(values.builder.formUrlPrefix),
	);
	assignOptionalSectionValue(
		builder,
		"layout",
		trimmedOrUndefined(values.builder.layout),
	);

	assignOptionalSectionValue(
		builder,
		"translation-languages",
		values.builder.translationLanguages.length > 0
			? values.builder.translationLanguages
			: undefined,
	);

	for (const field of BUILDER_BOOLEAN_FIELDS) {
		assignOptionalSectionValue(
			builder,
			field.resourceKey,
			nullableBooleanToResourceValue(
				values.builder.flags[field.key as BuilderFlagKey],
			),
		);
	}

	const customRenderers = cleanArray(values.builder.customRenderers).map(
		(renderer, index) => {
			const trimmedName = trimmedOrUndefined(renderer.name);
			const previousRenderer =
				originalRenderers?.find(
					(existingRenderer) =>
						trimmedName !== undefined && existingRenderer.name === trimmedName,
				) ?? originalRenderers?.[index];

			const nextRenderer = cloneSection(
				previousRenderer as ConfigurationSection | undefined,
			);

			if (renderer.default) {
				nextRenderer.default = true;
			} else if (previousRenderer?.default !== undefined) {
				nextRenderer.default = false;
			} else {
				delete nextRenderer.default;
			}

			delete nextRenderer.source;
			delete nextRenderer.title;

			assignOptionalSectionValue(nextRenderer, "name", trimmedName);
			assignOptionalSectionValue(
				nextRenderer,
				"url",
				trimmedOrUndefined(renderer.url),
			);

			return nextRenderer as SDCConfigBuilderCustom_renderers;
		},
	);
	assignOptionalSectionValue(
		builder,
		"custom-renderers",
		customRenderers.length > 0 ? customRenderers : undefined,
	);

	const externalTerminologyServers = cleanArray(
		values.builder.externalTerminologyServers,
	).map((server, index) => {
		const trimmedName = trimmedOrUndefined(server.name);
		const trimmedUrl = trimmedOrUndefined(server.url);
		const previousServer =
			originalExternalTerminologyServers?.find(
				(existingServer) =>
					(trimmedUrl !== undefined && existingServer.url === trimmedUrl) ||
					(trimmedName !== undefined && existingServer.name === trimmedName),
			) ?? originalExternalTerminologyServers?.[index];
		const nextServer = cloneSection(
			previousServer as ConfigurationSection | undefined,
		);

		if (server.default) {
			nextServer.default = true;
		} else if (previousServer?.default !== undefined) {
			nextServer.default = false;
		} else {
			delete nextServer.default;
		}

		assignOptionalSectionValue(nextServer, "name", trimmedName);
		assignOptionalSectionValue(nextServer, "url", trimmedUrl);

		return nextServer as SDCConfigBuilderExternal_terminology_servers;
	});
	assignOptionalSectionValue(
		builder,
		"external-terminology-servers",
		externalTerminologyServers.length > 0
			? externalTerminologyServers
			: undefined,
	);

	return Object.keys(builder).length > 0 ? builder : undefined;
}

function buildFormSection(
	values: ConfigurationFormValues,
	original?: ConfigurationSection,
) {
	const form = cloneSection(original);

	assignOptionalSectionValue(
		form,
		"redirect-on-submit",
		trimmedOrUndefined(values.form.redirectOnSubmit),
	);
	assignOptionalSectionValue(
		form,
		"redirect-on-save",
		trimmedOrUndefined(values.form.redirectOnSave),
	);
	assignOptionalSectionValue(
		form,
		"app-name",
		trimmedOrUndefined(values.form.appName),
	);
	assignOptionalSectionValue(
		form,
		"default-max-width",
		trimmedOrUndefined(values.form.defaultMaxWidth),
	);
	assignOptionalSectionValue(
		form,
		"auto-save-interval",
		values.form.autoSaveInterval.trim()
			? Number(values.form.autoSaveInterval)
			: undefined,
	);

	for (const field of FORM_BOOLEAN_FIELDS) {
		assignOptionalSectionValue(
			form,
			field.resourceKey,
			nullableBooleanToResourceValue(
				values.form.flags[field.key as FormFlagKey],
			),
		);
	}

	return Object.keys(form).length > 0 ? form : undefined;
}

// a fresh object per service: sharing one would make every service edit the
// same headers, and structuredClone keeps that sharing
function emptyServiceFormValues(): ConfigurationFormValues["services"]["formStore"] {
	return {
		auth: {
			clientId: "",
			clientSecret: "",
			scope: "",
			tokenEndpoint: "",
		},
		endpoint: "",
		headers: [],
	};
}

export const EMPTY_CONFIGURATION_FORM_VALUES: ConfigurationFormValues = {
	general: {
		default: false,
		description: "",
		language: "",
		name: "",
		themeReference: "",
		translationsJson: "",
	},
	storage: {
		accountReference: "",
		bucket: "",
		container: "",
		storageAccount: "",
		storeAbsoluteUrl: "",
	},
	services: {
		dataStore: emptyServiceFormValues(),
		dtrService: emptyServiceFormValues(),
		formStore: emptyServiceFormValues(),
		termServer: emptyServiceFormValues(),
	},
	builder: {
		customRenderers: [],
		externalTerminologyServers: [],
		fhirpathProfile: "",
		flags: Object.fromEntries(
			BUILDER_BOOLEAN_FIELDS.map((field) => [field.key, ""]),
		) as ConfigurationFormValues["builder"]["flags"],
		formUrlPrefix: "",
		layout: "",
		translationLanguages: [],
	},
	form: {
		appName: "",
		autoSaveInterval: "",
		defaultMaxWidth: "",
		flags: Object.fromEntries(
			FORM_BOOLEAN_FIELDS.map((field) => [field.key, ""]),
		) as ConfigurationFormValues["form"]["flags"],
		redirectOnSave: "",
		redirectOnSubmit: "",
	},
};

export function configurationToFormValues(
	resource?: SDCConfig,
): ConfigurationFormValues {
	if (!resource) {
		return EMPTY_CONFIGURATION_FORM_VALUES;
	}

	const config = resource as ConfigurationRecord;
	const builder = getSection(config, "builder");
	const form = getSection(config, "form");
	const storage = getSection(config, "storage");
	const formStore = getSection(config, "form-store");
	const termServer = getSection(config, "term-server");
	const dataStore = getSection(config, "data-store");
	const dtrService = getSection(config, "dtr-service");

	return {
		general: {
			default: resource.default === true,
			description: resource.description ?? "",
			language: resource.language ?? "",
			name: resource.name ?? "",
			themeReference: getQuestionnaireThemeReference(config.theme as Reference),
			translationsJson: stringifyJson(config.translations),
		},
		storage: {
			accountReference: getReferenceString(storage?.account as Reference),
			bucket: getStringValue(storage, "bucket"),
			container: getStringValue(storage, "container"),
			storageAccount: getStringValue(storage, "storageAccount"),
			storeAbsoluteUrl: getNullableBooleanValue(storage, "store-absolute-url"),
		},
		services: {
			dataStore: toServiceFormValues(dataStore),
			dtrService: toServiceFormValues(dtrService),
			formStore: toServiceFormValues(formStore),
			termServer: toServiceFormValues(termServer),
		},
		builder: {
			customRenderers: toCustomRendererFormValues(
				resource.builder?.["custom-renderers"],
			),
			externalTerminologyServers: toExternalTerminologyServerFormValues(
				resource.builder?.["external-terminology-servers"],
			),
			fhirpathProfile: getStringValue(builder, "fhirpath-profile"),
			flags: toBuilderFlags(builder),
			formUrlPrefix: resource.builder?.["form-url-prefix"] ?? "",
			layout: resource.builder?.layout ?? "",
			translationLanguages: resource.builder?.["translation-languages"] ?? [],
		},
		form: {
			appName: resource.form?.["app-name"] ?? "",
			autoSaveInterval:
				resource.form?.["auto-save-interval"] !== undefined
					? String(resource.form["auto-save-interval"])
					: "",
			defaultMaxWidth: resource.form?.["default-max-width"] ?? "",
			flags: toFormFlags(form),
			redirectOnSave: resource.form?.["redirect-on-save"] ?? "",
			redirectOnSubmit: resource.form?.["redirect-on-submit"] ?? "",
		},
	};
}

export function formValuesToConfiguration(
	values: ConfigurationFormValues,
	original?: SDCConfig,
): SDCConfig {
	const next = structuredClone(
		(original ?? { resourceType: "SDCConfig" }) as ConfigurationRecord,
	);

	next.resourceType = "SDCConfig";
	buildGeneralSection(next, values);
	assignOptionalSectionValue(
		next,
		"storage",
		buildStorageSection(values, getSection(next, "storage")),
	);
	assignOptionalSectionValue(
		next,
		"form-store",
		buildServiceSection(
			values.services.formStore,
			getSection(next, "form-store"),
		),
	);
	assignOptionalSectionValue(
		next,
		"term-server",
		buildServiceSection(
			values.services.termServer,
			getSection(next, "term-server"),
		),
	);
	assignOptionalSectionValue(
		next,
		"data-store",
		buildServiceSection(
			values.services.dataStore,
			getSection(next, "data-store"),
		),
	);
	assignOptionalSectionValue(
		next,
		"dtr-service",
		buildServiceSection(
			values.services.dtrService,
			getSection(next, "dtr-service"),
		),
	);
	assignOptionalSectionValue(
		next,
		"builder",
		buildBuilderSection(values, getSection(next, "builder")),
	);
	assignOptionalSectionValue(
		next,
		"form",
		buildFormSection(values, getSection(next, "form")),
	);

	return next as SDCConfig;
}
