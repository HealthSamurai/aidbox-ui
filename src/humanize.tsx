/**
 * AI-translated from CLJS
 */
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

	return <span title={tooltip}>{children}</span>;
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
	const date = new Date(datetime);
	let pretty = date.toLocaleDateString(undefined, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

	if (
		!(
			date.getSeconds() === 0 &&
			date.getMinutes() === 0 &&
			date.getHours() === 0
		)
	) {
		const timeOptions: Intl.DateTimeFormatOptions = {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		};

		if (date.getMilliseconds() !== 0) {
			// @ts-ignore - fractionalSecondDigits is valid but not in all TS versions
			timeOptions.fractionalSecondDigits = 3;
		}

		pretty += `, ${date.toLocaleTimeString(undefined, timeOptions)}`;
	}

	return <HumanizedValue tooltip={pretty}>{pretty}</HumanizedValue>;
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

export function referenceLink(ref: string | null | undefined): string | null {
	if (!ref || typeof ref !== "string") return null;

	if (ref.startsWith("http")) return ref;

	if (/^[a-zA-Z]*\/.*/.test(ref)) {
		const [resource, id] = ref.split("/");
		return `#/resource-types/${resource}/${id}`;
	}

	if (/^[a-zA-Z]*\?.*/.test(ref)) return `#/resource-types/${ref}`;

	return null;
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

function humanizeValue_(
	key: string | null,
	value: unknown,
	datatype: string,
	element?: Element,
): string | React.ReactNode | null {
	try {
		if (value == null) return "-";

		if (key === "id" && typeof value === "string") return value;

		if (
			[
				"decimal",
				"integer",
				"integer64",
				"positiveInt",
				"unsignedInt",
				"time",
				"boolean",
			].includes(datatype)
		)
			return String(value);

		if (
			key === "lastUpdated" ||
			datatype === "instant" ||
			datatype === "dateTime"
		) {
			if (typeof value === "string") {
				return humanizeDatetime(value);
			} else {
				return "-";
			}
		}

		if (datatype === "url") {
			return typeof value === "string" ? value : "-";
		}

		if (datatype === "Reference") {
			const ref = (value as FhirReference).reference;
			const identifier = (value as FhirReference).identifier?.value;
			const identifierSystem = (value as FhirReference).identifier?.system;
			const refer = element?.refers?.[0];
			const maybeLink = referenceLink(ref);

			if (maybeLink) {
				return (
					<HumanizedValue tooltip={JSON.stringify(ref, null, " ")}>
						<Link
							to={maybeLink}
							onClick={(e) => {
								stopPropagation(e);
							}}
						>
							{(value as FhirReference).display || ref}
						</Link>
					</HumanizedValue>
				);
			}

			if (identifier) {
				const rt: string =
					(value as FhirReference).type ||
					refer ||
					(key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
				const humanizedValue =
					(value as FhirReference).display || `${rt}?identifier=${identifier}`;
				const identifierParam = identifierSystem
					? `${identifierSystem}|${identifier}`
					: identifier;

				return (
					<HumanizedValue tooltip={JSON.stringify(humanizedValue, null, " ")}>
						<Link
							to={`/resource/$resourceType`}
							params={{ resourceType: rt }}
							search={{ identifier: identifierParam }}
							onClick={(e) => {
								stopPropagation(e);
							}}
						>
							{humanizedValue}
						</Link>
					</HumanizedValue>
				);
			}

			return ref;
		}

		if (
			datatype === "BackboneElement" &&
			typeof value === "object" &&
			key &&
			hasProperty(value, key) &&
			typeof value[key] === "object" &&
			value[key] !== null &&
			hasProperty(value[key], "reference") &&
			typeof value[key].reference === "string"
		) {
			const ref = value[key].reference;
			const maybeLink = referenceLink(ref);

			const displayString: null | string =
				hasProperty(value[key], "display") &&
				typeof value[key].display === "string"
					? value[key].display
					: null;

			if (!maybeLink) return ref;

			return (
				<HumanizedValue
					tooltip={JSON.stringify(displayString || ref, null, " ")}
				>
					<Link to={maybeLink}>{displayString ?? ref}</Link>
				</HumanizedValue>
			);
		}

		if (datatype === "Ratio") {
			const numerator = humanizeValue_(
				key,
				hasProperty(value, "numerator") ? value.numerator : undefined,
				"Quantity",
			);
			const denominator = humanizeValue_(
				key,
				hasProperty(value, "denominator") ? value.denominator : undefined,
				"Quantity",
			);

			return `${numerator}/${denominator}`;
		}

		if (datatype === "Range") {
			const low = humanizeValue_(
				key,
				hasProperty(value, "low") ? value.low : undefined,
				"Quantity",
			);
			const high = humanizeValue_(
				key,
				hasProperty(value, "high") ? value.high : undefined,
				"Quantity",
			);
			return `${low}–${high}`;
		}

		if (datatype === "Period") {
			const value1 = humanizeValue_(
				key,
				hasProperty(value, "start") ? value.start : undefined,
				"dateTime",
			);
			const value2 = humanizeValue_(
				key,
				hasProperty(value, "end") ? value.end : undefined,
				"dateTime",
			);

			return (
				<>
					{value1}–{value2}
				</>
			);
		}

		if (datatype === "Address") {
			const humanized = Array.isArray(value)
				? value.map(humanizeAddress).join(", ")
				: humanizeAddress(value);

			return <HumanizedValue tooltip={humanized}>{humanized}</HumanizedValue>;
		}

		if (datatype === "ContactPoint") {
			return hasProperty(value, "value") && typeof value.value === "string"
				? value.value
				: undefined;
		}

		if (datatype === "HumanName") {
			return Array.isArray(value)
				? value.map(humanizeName).join(", ")
				: humanizeName(value);
		}

		if (
			[
				"Quantity",
				"Age",
				"Distance",
				"Duration",
				"Count",
				"MoneyQuantity",
				"SimpleQuantity",
			].includes(datatype)
		) {
			const parts: string[] = [];

			if (
				hasProperty(value, "comparator") &&
				typeof value.comparator === "string"
			) {
				parts.push(value.comparator, " ");
			}
			if (hasProperty(value, "value") && typeof value.value === "number") {
				parts.push(String(value.value));
			}
			if (hasProperty(value, "unit") && typeof value.unit === "string") {
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

		if (datatype === "Coding") {
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

		if (datatype === "Identifier") {
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

		if (datatype === "CodeableConcept") {
			if (!value) return null;

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

		if (datatype === "Annotation")
			return humanizeAnnotation(value as FhirAnnotation);

		if (datatype === "Attachment") return humanizeAttachment(value);

		if (datatype === "ContactDetail") return humanizeContactDetail(value);

		if (datatype === "Contributor") return humanizeContributor(value);

		if (datatype === "DataRequirement")
			return humanizeDataRequirement(value as FhirDataRequirement);

		if (datatype === "Dosage") return humanizeDosage(value);

		if (datatype === "Expression") return humanizeExpression(value);

		if (datatype === "Money") return humanizeMoney(value);

		if (datatype === "ParameterDefinition")
			return humanizeParameterDefinition(value as FhirParameterDefinition);

		if (datatype === "RelatedArtifact") return humanizeRelatedArtifact(value);

		if (datatype === "SampledData")
			return humanizeSampledData(value as FhirSampledData);

		if (datatype === "Signature")
			return humanizeSignature(value as FhirSignature);

		if (datatype === "Timing") return humanizeTiming(value);

		if (datatype === "UsageContext")
			return humanizeUsageContext(value as FhirUsageContext);

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
		)
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

		if (typeof value === "string") return value;

		const unknownHumanized = humanizeUnknown(value);
		return unknownHumanized === ""
			? HumanizedValue({
					children: "[...]",
					tooltip: JSON.stringify(value, null, " "),
				})
			: unknownHumanized;
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

		if (humanized.every((h) => typeof h === "string"))
			return humanized.filter((h) => h.trim()).join(", ");

		return humanized[0];
	}

	return humanizeValue_(key, value, datatype || "", element);
}
