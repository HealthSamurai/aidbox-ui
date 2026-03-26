/**
 * AI-translated from CLJS
 */
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import type React from "react";

// Helper function to stop event propagation
const stopPropagation = (e: React.MouseEvent) => {
	e.stopPropagation();
};

// Type definitions
interface HumanizedValueProps {
	children: React.ReactNode;
	tooltip?: string;
}

function HumanizedValue({
	children,
	tooltip,
}: HumanizedValueProps): React.ReactNode {
	if (!tooltip) return children;

	return (
		<Tooltip delayDuration={500}>
			<TooltipTrigger asChild>
				<span>{children}</span>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="typo-code">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

interface Name {
	prefix?: string[];
	given?: string[];
	family?: string;
	suffix?: string[];
	use?: string;
}

interface Address {
	line?: string[];
	city?: string;
	state?: string;
	postalCode?: string;
	use?: string;
}

interface Telecom {
	system?: string;
	value?: string;
	use?: string;
}

interface Language {
	language?: {
		coding?: Array<{ display?: string }>;
	};
	preferred?: boolean;
}

interface Contact {
	relationship?: Array<{
		coding?: Array<{ display?: string }>;
	}>;
	name?: Name;
	telecom?: Telecom[];
}

interface Element {
	datatype?: string;
	type?: string;
	refers?: string[];
}

export interface Snapshot {
	[key: string]: Element;
}

export function humanizeDatetime(datetime: string): React.ReactNode {
	return datetime;
}

export function humanizeName(value: Name): string {
	const parts: string[] = [];

	if (value.prefix) parts.push(...value.prefix);
	if (value.given) parts.push(...value.given);
	if (value.family) parts.push(value.family);
	if (value.suffix) parts.push(...value.suffix);
	if (value.use) parts.push(`[${value.use}]`);

	return parts.join(" ").trim();
}

export function humanizeAddress(value: Address): string {
	const parts: string[] = [];

	if (value.line) parts.push(...value.line);

	const { city, state, postalCode } = value;
	if (city || state || postalCode) {
		const cityStateParts = [city, state, postalCode].filter(Boolean);
		parts.push(cityStateParts.join(", "));
	}

	if (value.use) parts.push(`[${value.use}]`);

	return parts.join(", ");
}

export function humanizeTelecom(
	value: Telecom | null | undefined,
): string | null {
	if (!value) return null;

	const { system, use, value: val } = value;
	let result = val || "";

	if (system) result += ` (${system})`;
	if (use) result += ` [${use}]`;

	return result;
}

export function humanizeLanguage(
	value: Language | null | undefined,
): string | null {
	if (!value) return null;

	const language = value.language?.coding?.[0]?.display;
	const preferred = value.preferred;

	return language ? `${language}${preferred ? " (preferred)" : ""}` : null;
}

export function humanizeContact(
	value: Contact | null | undefined,
): string | null {
	if (!value) return null;

	const relationship = value.relationship?.[0]?.coding?.[0]?.display;
	const name = value.name ? humanizeName(value.name) : null;
	const telecom = value.telecom?.[0] ? humanizeTelecom(value.telecom[0]) : null;

	return [name, relationship, telecom].filter(Boolean).join(", ");
}

type FhirAnnotation = {
	authorString?: string;
	time?: string;
	text: string;
};

function humanizeAnnotation(value: FhirAnnotation): string {
	const author = value.authorString;
	const time = value.time ? humanizeDatetime(value.time) : null;
	const text = value.text;

	return [text, author ? `— ${author}` : null, time ? `(${time})` : null]
		.filter(Boolean)
		.join(" ");
}

type FhirAttachment = {
	title?: string;
	url?: string;
};

function humanizeAttachment(value: FhirAttachment): string | null {
	const title = value.title;
	const url = value.url;
	return title ?? url ?? null;
}

type FhirContactPoint = {
	system?: string;
	value?: string;
};

type FhirContactDetail = {
	name?: string;
	telecom?: FhirContactPoint[];
};

function humanizeContactDetail(value: FhirContactDetail): string {
	const name = value.name;
	const telecoms = value.telecom;

	const humanizedTelecoms =
		telecoms?.map((telecom) => `${telecom.system}: ${telecom.value}`) ?? [];

	const humanizedName = name ? [name] : [];

	return humanizedName.concat(humanizedTelecoms).join(", ");
}

type FhirContributor = {
	type?: string;
	name?: string;
};

function humanizeContributor(value: FhirContributor): string {
	const type = value.type;
	const name = value.name;

	return [...(name ? [name] : []), ...(type ? [type] : [])].join(" ");
}

type FhirDataRequirement = {
	type: string;
	profile?: string[];
	mustSupport?: string[];
};

function humanizeDataRequirement(value: FhirDataRequirement): string {
	const type = value.type;
	const profile = value.profile;
	const mustSupport = value.mustSupport;

	return [type, profile?.[0], mustSupport ? mustSupport.join(", ") : null]
		.filter(Boolean)
		.join(" ");
}

type FhirQuantity = {
	comparator?: string;
	value?: number;
	unit?: string;
};

type FhirSimpleQuantity = {
	comparator?: string;
	value?: number;
	unit?: string;
};

type FhirDuration = FhirQuantity;
type FhirRange = FhirQuantity;
type FhirPeriod = FhirQuantity;

type FhirTiming = {
	code?: FhirCodeableConcept;
	repeat?: {
		frequency?: number;
		period?: number;
		periodUnit?: string;
		boundsDuration?: FhirDuration;
		boundsRange?: FhirRange;
		boundsPeriod?: FhirPeriod;
		count?: number;
		duration?: number;
		durationUnit?: string;
	};
};

type FhirCoding = {
	display?: string;
	code?: string;
};

type FhirCodeableConcept = {
	text?: string;
	coding?: FhirCoding[];
};

type FhirDosageDoseAndRate = {
	doseQuantity: FhirSimpleQuantity;
};

type FhirDosage = {
	text?: string;
	timing?: FhirTiming;
	route?: FhirCodeableConcept;
	doseAndRate?: FhirDosageDoseAndRate[];
};

function humanizeDosage(value: FhirDosage): string | null {
	const text = value.text;
	const timing = value.timing;
	const route = value.route;
	const dose = value.doseAndRate;

	if (text) return text;

	const parts: (React.ReactNode | null)[] = [];
	if (timing) parts.push(humanizeValue_(null, timing, "Timing"));
	if (route) parts.push(humanizeValue_(null, route, "CodeableConcept"));
	if (dose) parts.push(humanizeValue_(null, dose[0]?.doseQuantity, "Quantity"));

	return parts.filter(Boolean).join(", ");
}

type FhirExpression = {
	description?: string;
	name?: string;
	expression?: string;
};

function humanizeExpression(value: FhirExpression): string | null {
	return value.description || value.name || value.expression || null;
}

type FhirMoney = {
	value?: number;
	currency?: string;
};

function humanizeMoney(value: FhirMoney): string {
	const amount = value.value;
	const currency = value.currency;

	return [amount, currency].filter(Boolean).join(" ");
}

type FhirParameterDefinition = {
	name?: string;
	use: string;
	type: string;
};

function humanizeParameterDefinition(value: FhirParameterDefinition): string {
	const name = value.name;
	const use = value.use;
	const type = value.type;

	return [name, use ? `(${use})` : null, type].filter(Boolean).join(" ");
}

type FhirRelatedArtifact = {
	display?: string;
	citation?: string;
	url?: string;
};

function humanizeRelatedArtifact(value: FhirRelatedArtifact): string | null {
	return value.display || value.citation || value.url || null;
}

type FhirSampledData = {
	period: number;
	dimensions: number;
};

function humanizeSampledData(value: FhirSampledData): string {
	const period = value.period;
	const dimensions = value.dimensions;

	return [dimensions ? `${dimensions}D` : null, period]
		.filter(Boolean)
		.join(" ");
}

type FhirIdentifier = {
	value?: string;
	system?: string;
};

type FhirReference = {
	reference?: string;
	identifier?: FhirIdentifier;
	display?: string;
	type?: string;
};

type FhirSignature = {
	when: string;
	who: FhirReference;
};

function humanizeSignature(value: FhirSignature): string {
	const when = value.when;
	const who = value.who;

	return [
		who ? humanizeValue_(null, who, "Reference") : null,
		when ? `(${humanizeDatetime(when)})` : null,
	]
		.filter(Boolean)
		.join(" ");
}

function humanizeTiming(value: FhirTiming): React.ReactNode | string | null {
	const repeat = value.repeat;
	const code = value.code;

	if (code) {
		return humanizeValue_(null, code, "CodeableConcept");
	}

	if (repeat) {
		const {
			frequency,
			period,
			periodUnit,
			boundsDuration,
			boundsRange,
			boundsPeriod,
			count,
			duration,
			durationUnit,
		} = repeat;

		const parts: (React.ReactNode | string | null)[] = [];

		if (frequency && period && periodUnit) {
			parts.push(`${frequency}/${period}${periodUnit}`);
		}
		if (count) parts.push(String(count));
		if (duration && durationUnit) parts.push(`${duration}${durationUnit}`);
		if (boundsDuration)
			parts.push(humanizeValue_(null, boundsDuration, "Duration"));
		if (boundsRange) parts.push(humanizeValue_(null, boundsRange, "Range"));
		if (boundsPeriod) parts.push(humanizeValue_(null, boundsPeriod, "Period"));

		return parts.filter(Boolean).join(", ");
	}

	return null;
}

type FhirUsageContext = {
	code: FhirCoding;
	valueCodeableConcept?: FhirCodeableConcept;
	valueQuantity?: FhirQuantity;
	valueRange?: FhirRange;
	valueReference?: FhirReference;
};

function humanizeUsageContext(value: FhirUsageContext): string {
	const code = value.code;
	const valueCC = value.valueCodeableConcept;
	const valueQuantity = value.valueQuantity;
	const valueRange = value.valueRange;
	const valueRef = value.valueReference;

	const parts: (string | React.ReactNode | null)[] = [];

	if (code) parts.push(humanizeValue_(null, code, "Coding"));

	if (valueCC) parts.push(humanizeValue_(null, valueCC, "CodeableConcept"));
	else if (valueQuantity)
		parts.push(humanizeValue_(null, valueQuantity, "Quantity"));
	else if (valueRange) parts.push(humanizeValue_(null, valueRange, "Range"));
	else if (valueRef) parts.push(humanizeValue_(null, valueRef, "Reference"));

	return parts.filter(Boolean).join(": ");
}

function humanizeUnknown(
	value: unknown,
	depthSoFar = 1,
): React.ReactNode | string {
	if (depthSoFar > 4 || !value || typeof value !== "object") return "";

	if (Object.hasOwn(value, "coding")) {
		return humanizeValue_(null, value, "CodeableConcept") || "";
	}

	if ("display" in value && typeof value.display === "string") {
		return value.display;
	}

	const values = Array.isArray(value) ? value : Object.values(value);

	return values
		.map((v) => humanizeUnknown(v, depthSoFar + 1))
		.filter((v) => (typeof v === "string" ? v?.trim() : v))
		.join(", ");
}

function hasProperty<K extends string>(
	value: object,
	property: K,
): value is { [P in K]: unknown } {
	return Object.hasOwn(value, property);
}

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

// --- Extracted helpers to reduce cognitive complexity of humanizeValue_ ---

function humanizeReference(
	key: string | null,
	value: unknown,
	element?: Element,
): string | React.ReactNode | null {
	const ref = (value as FhirReference).reference;
	const display = (value as FhirReference).display;
	const identifier = (value as FhirReference).identifier?.value;
	const identifierSystem = (value as FhirReference).identifier?.system;
	const refer = element?.refers?.[0];

	if (ref && typeof ref === "string" && /^[a-zA-Z]+\/[^/]+$/.test(ref)) {
		const [resourceType, id] = ref.split("/");
		return (
			<Link
				to="/resource/$resourceType/edit/$id"
				params={{
					resourceType: resourceType as string,
					id: id as string,
				}}
				search={{ tab: "edit", mode: "json", builderTab: "form" }}
				onClick={stopPropagation}
				className="text-text-link hover:underline"
			>
				{display || ref}
			</Link>
		);
	}

	if (identifier) {
		const rt: string =
			(value as FhirReference).type ||
			refer ||
			(key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
		const humanizedValue = display || `${rt}?identifier=${identifier}`;
		const identifierParam = identifierSystem
			? `${identifierSystem}|${identifier}`
			: identifier;

		return (
			<Link
				to="/resource/$resourceType"
				params={{ resourceType: rt }}
				search={{ identifier: identifierParam }}
				onClick={stopPropagation}
				className="text-text-link hover:underline"
			>
				{humanizedValue}
			</Link>
		);
	}

	return display || ref || "-";
}

function humanizeBackboneElementRef(
	key: string,
	value: object,
): string | React.ReactNode | null {
	if (
		!hasProperty(value, key) ||
		typeof value[key] !== "object" ||
		value[key] === null ||
		!hasProperty(value[key], "reference") ||
		typeof value[key].reference !== "string"
	) {
		return null;
	}

	const ref = value[key].reference as string;

	const displayString: null | string =
		hasProperty(value[key], "display") && typeof value[key].display === "string"
			? value[key].display
			: null;

	if (/^[a-zA-Z]+\/[^/]+$/.test(ref)) {
		const [resourceType, id] = ref.split("/");
		return (
			<Link
				to="/resource/$resourceType/edit/$id"
				params={{
					resourceType: resourceType as string,
					id: id as string,
				}}
				search={{ tab: "edit", mode: "json", builderTab: "form" }}
				onClick={stopPropagation}
				className="text-text-link hover:underline"
			>
				{displayString ?? ref}
			</Link>
		);
	}

	return displayString ?? ref;
}

function humanizeQuantityLike(value: unknown): string | null {
	const parts: string[] = [];

	if (
		typeof value === "object" &&
		value !== null &&
		hasProperty(value, "comparator") &&
		typeof value.comparator === "string"
	) {
		parts.push(value.comparator, " ");
	}
	if (
		typeof value === "object" &&
		value !== null &&
		hasProperty(value, "value") &&
		typeof value.value === "number"
	) {
		parts.push(String(value.value));
	}
	if (
		typeof value === "object" &&
		value !== null &&
		hasProperty(value, "unit") &&
		typeof value.unit === "string"
	) {
		if (
			hasProperty(value, "value") &&
			typeof value.value === "number" &&
			value.unit === "%"
		) {
			parts.push(" ");
		}
		parts.push(value.unit);
	}

	return parts.join("");
}

function humanizeCodeableConceptValue(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;

	if (hasProperty(value, "text") && typeof value.text === "string") {
		return value.text;
	}

	if (
		hasProperty(value, "coding") &&
		typeof value.coding === "object" &&
		isArray(value.coding)
	) {
		const displays = value.coding
			.map((c) => {
				if (typeof c !== "object" || c === null) {
					return null;
				}
				if (hasProperty(c, "display") && typeof c.display === "string") {
					return c.display;
				}
				if (hasProperty(c, "code") && typeof c.code === "string") {
					return c.code;
				}
				return null;
			})
			.filter((x) => x !== null);
		return displays.length > 0 ? displays.join(", ") : null;
	}

	return null;
}

function humanizeCodingValue(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;

	const display: string | undefined =
		hasProperty(value, "display") && typeof value.display === "string"
			? value.display
			: undefined;

	const system: string | undefined =
		hasProperty(value, "system") && typeof value.system === "string"
			? value.system
			: "";

	const code: string | undefined =
		hasProperty(value, "code") && typeof value.code === "string"
			? value.code
			: "";

	return display ?? `${system}|${code}`;
}

function humanizeIdentifierValue(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;

	const system: string | undefined =
		hasProperty(value, "system") && typeof value.system === "string"
			? value.system
			: "";

	const identifierValue: string | undefined =
		hasProperty(value, "value") && typeof value.value === "string"
			? value.value
			: "";
	return `${system}|${identifierValue}`;
}

function humanizeFallbackCoding(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;

	if (
		hasProperty(value, "coding") &&
		isArray(value.coding) &&
		value.coding.some(
			(c) =>
				typeof c === "object" &&
				c !== null &&
				hasProperty(c, "display") &&
				typeof c.display === "string",
		)
	) {
		return value.coding
			.map((c) =>
				typeof c === "object" &&
				c !== null &&
				hasProperty(c, "display") &&
				typeof c.display === "string"
					? c.display
					: null,
			)
			.filter((x) => x !== null)
			.join(", ");
	}

	return null;
}

const quantityLikeDatatypes = new Set([
	"Quantity",
	"Age",
	"Distance",
	"Duration",
	"Count",
	"MoneyQuantity",
	"SimpleQuantity",
]);

const primitiveDatatypes = new Set([
	"decimal",
	"integer",
	"integer64",
	"positiveInt",
	"unsignedInt",
	"time",
	"boolean",
]);

function humanizeRatio(
	key: string | null,
	value: unknown,
): string | React.ReactNode | null {
	const obj = value as object;
	const numerator = humanizeValue_(
		key,
		hasProperty(obj, "numerator") ? obj.numerator : undefined,
		"Quantity",
	);
	const denominator = humanizeValue_(
		key,
		hasProperty(obj, "denominator") ? obj.denominator : undefined,
		"Quantity",
	);
	return `${numerator}/${denominator}`;
}

function humanizeRange(
	key: string | null,
	value: unknown,
): string | React.ReactNode | null {
	const obj = value as object;
	const low = humanizeValue_(
		key,
		hasProperty(obj, "low") ? obj.low : undefined,
		"Quantity",
	);
	const high = humanizeValue_(
		key,
		hasProperty(obj, "high") ? obj.high : undefined,
		"Quantity",
	);
	return `${low}–${high}`;
}

function humanizePeriod(key: string | null, value: unknown): React.ReactNode {
	const obj = value as object;
	const value1 = humanizeValue_(
		key,
		hasProperty(obj, "start") ? obj.start : undefined,
		"dateTime",
	);
	const value2 = humanizeValue_(
		key,
		hasProperty(obj, "end") ? obj.end : undefined,
		"dateTime",
	);
	return (
		<>
			{value1}–{value2}
		</>
	);
}

function humanizeAddressDatatype(value: unknown): React.ReactNode {
	const humanized = Array.isArray(value)
		? value.map(humanizeAddress).join(", ")
		: humanizeAddress(value as Address);
	return <HumanizedValue tooltip={humanized}>{humanized}</HumanizedValue>;
}

function humanizeContactPoint(value: unknown): string | undefined {
	if (
		typeof value === "object" &&
		value !== null &&
		hasProperty(value, "value") &&
		typeof value.value === "string"
	) {
		return value.value;
	}
	return undefined;
}

function humanizeHumanName(value: unknown): string {
	return Array.isArray(value)
		? value.map(humanizeName).join(", ")
		: humanizeName(value as Name);
}

const datatypeHandlers: Record<
	string,
	(v: unknown) => string | React.ReactNode | null
> = {
	Annotation: (v) => humanizeAnnotation(v as FhirAnnotation),
	Attachment: (v) => humanizeAttachment(v as FhirAttachment),
	ContactDetail: (v) => humanizeContactDetail(v as FhirContactDetail),
	Contributor: (v) => humanizeContributor(v as FhirContributor),
	DataRequirement: (v) => humanizeDataRequirement(v as FhirDataRequirement),
	Dosage: (v) => humanizeDosage(v as FhirDosage),
	Expression: (v) => humanizeExpression(v as FhirExpression),
	Money: (v) => humanizeMoney(v as FhirMoney),
	ParameterDefinition: (v) =>
		humanizeParameterDefinition(v as FhirParameterDefinition),
	RelatedArtifact: (v) => humanizeRelatedArtifact(v as FhirRelatedArtifact),
	SampledData: (v) => humanizeSampledData(v as FhirSampledData),
	Signature: (v) => humanizeSignature(v as FhirSignature),
	Timing: (v) => humanizeTiming(v as FhirTiming),
	UsageContext: (v) => humanizeUsageContext(v as FhirUsageContext),
	Address: (v) => humanizeAddressDatatype(v),
	ContactPoint: (v) => humanizeContactPoint(v) ?? null,
	HumanName: (v) => humanizeHumanName(v),
	Coding: (v) => humanizeCodingValue(v),
	Identifier: (v) => humanizeIdentifierValue(v),
	CodeableConcept: (v) => humanizeCodeableConceptValue(v),
};

function humanizeValueByDatatype(
	key: string | null,
	value: unknown,
	datatype: string,
	element?: Element,
): string | React.ReactNode | null | undefined {
	if (primitiveDatatypes.has(datatype)) return String(value);

	if (datatype === "instant" || datatype === "dateTime") {
		return typeof value === "string" ? humanizeDatetime(value) : "-";
	}

	if (datatype === "url") {
		return typeof value === "string" ? value : "-";
	}

	if (datatype === "Reference") return humanizeReference(key, value, element);
	if (datatype === "Ratio") return humanizeRatio(key, value);
	if (datatype === "Range") return humanizeRange(key, value);
	if (datatype === "Period") return humanizePeriod(key, value);
	if (quantityLikeDatatypes.has(datatype)) return humanizeQuantityLike(value);

	if (datatype === "BackboneElement" && typeof value === "object" && key) {
		const result = humanizeBackboneElementRef(key, value as object);
		if (result !== null) return result;
	}

	const handler = datatypeHandlers[datatype];
	if (handler) return handler(value);

	return undefined;
}

function humanizeValueFallback(
	value: unknown,
): string | React.ReactNode | null {
	const fallbackCoding = humanizeFallbackCoding(value);
	if (fallbackCoding !== null) return fallbackCoding;

	if (typeof value === "string") return value;

	const unknownHumanized = humanizeUnknown(value);
	return unknownHumanized === "" ? "[...]" : unknownHumanized;
}

function humanizeValue_(
	key: string | null,
	value: unknown,
	datatype: string,
	element?: Element,
): string | React.ReactNode | null {
	try {
		if (value == null) return "-";
		if (key === "id" && typeof value === "string") return value;
		if (key === "lastUpdated") {
			return typeof value === "string" ? humanizeDatetime(value) : "-";
		}

		const result = humanizeValueByDatatype(key, value, datatype, element);
		if (result !== undefined) return result;

		return humanizeValueFallback(value);
	} catch (_error) {
		return null;
	}
}

export function humanizeValue(
	key: string,
	value: unknown,
	snapshot: Snapshot,
): string | React.ReactNode | null {
	const element = snapshot[key];
	const datatype = element?.datatype || element?.type;

	if (isArray(value)) {
		const humanized = value.map((v) =>
			humanizeValue_(key, v, datatype || "", element),
		);

		if (humanized.length === 1) return humanized[0];

		if (humanized.every((h) => typeof h === "string")) {
			const filtered = humanized.filter((h) => h.trim());
			if (filtered.every((h) => h === "[...]")) return "[...]";
			return filtered.join(", ");
		}

		return humanized[0];
	}

	return humanizeValue_(key, value, datatype || "", element);
}
