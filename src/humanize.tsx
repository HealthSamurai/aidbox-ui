/**
 * AI-translated from CLJS
 */
import { Link, useNavigate } from "@tanstack/react-router";
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

interface Snapshot {
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

function humanizeAnnotation(value: any): string {
	const author = value.authorString;
	const time = value.time ? humanizeDatetime(value.time) : null;
	const text = value.text;

	return [text, author ? `— ${author}` : null, time ? `(${time})` : null]
		.filter(Boolean)
		.join(" ");
}

function humanizeAttachment(value: any): string {
	const title = value.title;
	const url = value.url;
	const displayText = title || url;

	return url ? displayText || url : displayText;
}

function humanizeContactDetail(value: any): string {
	const name = value.name;
	const telecoms = value.telecom;

	const parts: string[] = [];
	if (name) parts.push(name);
	if (telecoms) {
		parts.push(...telecoms.map((t: any) => `${t.system}: ${t.value}`));
	}

	return parts.filter(Boolean).join(", ");
}

function humanizeContributor(value: any): string {
	const type = value.type;
	const name = value.name;

	return [name, type].filter(Boolean).join(" ");
}

function humanizeDataRequirement(value: any): string {
	const type = value.type;
	const profile = value.profile;
	const mustSupport = value.mustSupport;

	return [type, profile?.[0], mustSupport ? mustSupport.join(", ") : null]
		.filter(Boolean)
		.join(" ");
}

function humanizeDosage(value: any): string | null {
	const text = value.text;
	const timing = value.timing;
	const route = value.route;
	const dose = value.doseAndRate;

	if (text) return text;

	const parts: (string | null)[] = [];
	if (timing) parts.push(humanizeValue_(null, timing, "Timing"));
	if (route) parts.push(humanizeValue_(null, route, "CodeableConcept"));
	if (dose) parts.push(humanizeValue_(null, dose[0]?.doseQuantity, "Quantity"));

	return parts.filter(Boolean).join(", ");
}

function humanizeExpression(value: any): string | null {
	return value.description || value.name || value.expression || null;
}

function humanizeMoney(value: any): string {
	const amount = value.value;
	const currency = value.currency;

	return [amount, currency].filter(Boolean).join(" ");
}

function humanizeParameterDefinition(value: any): string {
	const name = value.name;
	const use = value.use;
	const type = value.type;

	return [name, use ? `(${use})` : null, type].filter(Boolean).join(" ");
}

function humanizeRelatedArtifact(value: any): string | null {
	return value.display || value.citation || value.url || null;
}

function humanizeSampledData(value: any): string {
	const period = value.period;
	const dimensions = value.dimensions;

	return [dimensions ? `${dimensions}D` : null, period]
		.filter(Boolean)
		.join(" ");
}

function humanizeSignature(value: any): string {
	const when = value.when;
	const who = value.who;

	return [
		who ? humanizeValue_(null, who, "Reference") : null,
		when ? `(${humanizeDatetime(when)})` : null,
	]
		.filter(Boolean)
		.join(" ");
}

function humanizeTiming(value: any): string | null {
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

		const parts: (string | null)[] = [];

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

function humanizeUsageContext(value: any): string {
	const code = value.code;
	const valueCC = value.valueCodeableConcept;
	const valueQuantity = value.valueQuantity;
	const valueRange = value.valueRange;
	const valueRef = value.valueReference;

	const parts: (string | null)[] = [];

	if (code) parts.push(humanizeValue_(null, code, "Coding"));

	if (valueCC) parts.push(humanizeValue_(null, valueCC, "CodeableConcept"));
	else if (valueQuantity)
		parts.push(humanizeValue_(null, valueQuantity, "Quantity"));
	else if (valueRange) parts.push(humanizeValue_(null, valueRange, "Range"));
	else if (valueRef) parts.push(humanizeValue_(null, valueRef, "Reference"));

	return parts.filter(Boolean).join(": ");
}

function humanizeUnknown(value: any, depthSoFar = 1): string {
	if (depthSoFar > 4 || !value || typeof value !== "object") return "";

	if (value.coding) return humanizeValue_(null, value, "CodeableConcept") || "";

	if (value.display) return value.display;

	const values = Array.isArray(value) ? value : Object.values(value);

	return values
		.map((v) => humanizeUnknown(v, depthSoFar + 1))
		.filter((v) => v && v.trim())
		.join(", ");
}

// Component for rendering reference links
function ReferenceLink({
	href,
	onClick,
	children,
}: {
	href: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Link
			to={href}
			onClick={(e) => {
				stopPropagation(e);
				onClick();
			}}
		>
			{children}
		</Link>
	);
}

function humanizeValue_(
	key: string | null,
	value: any,
	datatype: string,
	element?: Element,
): string | React.ReactNode | null {
	try {
		if (value == null) return "-";

		if (key === "id") return value;

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
		)
			return humanizeDatetime(value);

		if (datatype === "url") return value;

		if (datatype === "Reference") {
			const ref = value.reference;
			const identifier = value.identifier?.value;
			const identifierSystem = value.identifier?.system;
			const refer = element?.refers?.[0];
			const maybeLink = referenceLink(ref);

			if (maybeLink) {
				const navigate = useNavigate();
				return (
					<HumanizedValue tooltip={JSON.stringify(ref, null, " ")}>
						<Link
							to={maybeLink}
							onClick={(e) => {
								stopPropagation(e);
								navigate({ to: maybeLink });
							}}
						>
							{value.display || ref}
						</Link>
					</HumanizedValue>
				);
			}

			if (identifier) {
				const rt =
					value.type ||
					refer ||
					(key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
				const humanizedValue =
					value.display || `${rt}?identifier=${identifier}`;
				const navigate = useNavigate();

				return (
					<HumanizedValue tooltip={JSON.stringify(humanizedValue, null, " ")}>
						<Link
							to={`#/resource-types/${rt}?identifier=${identifierSystem ? `${identifierSystem}|` : ""}${identifier}`}
							onClick={(e) => {
								stopPropagation(e);
								navigate({
									to: `#/resource-types/${rt}?identifier=${identifierSystem ? `${identifierSystem}|` : ""}${identifier}`,
								});
							}}
						>
							{humanizedValue}
						</Link>
					</HumanizedValue>
				);
			}

			return ref;
		}

		if (datatype === "BackboneElement" && value[key as any]?.reference) {
			const ref = value[key as any].reference;
			const maybeLink = referenceLink(ref);
			const valueRef = value[key as any];

			if (!maybeLink) return ref;

			return (
				<HumanizedValue
					tooltip={JSON.stringify(valueRef.display || ref, null, " ")}
				>
					<Link to={maybeLink}>{valueRef.display || ref}</Link>
				</HumanizedValue>
			);
		}

		if (datatype === "Ratio")
			return `${humanizeValue_(key, value.numerator, "Quantity")}/${humanizeValue_(key, value.denominator, "Quantity")}`;

		if (datatype === "Range")
			return `${humanizeValue_(key, value.low, "Quantity")}–${humanizeValue_(key, value.high, "Quantity")}`;

		if (datatype === "Period") {
			const value1 = humanizeValue_(key, value.start, "dateTime");
			const value2 = humanizeValue_(key, value.end, "dateTime");

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

		if (datatype === "ContactPoint") return value.value;

		if (datatype === "HumanName")
			return Array.isArray(value)
				? value.map(humanizeName).join(", ")
				: humanizeName(value);

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

			if (value.comparator) parts.push(value.comparator, " ");
			if (value.value) parts.push(String(value.value));
			if (value.unit) {
				if (value.value && value.unit === "%") parts.push(" ");
				parts.push(value.unit);
			}

			return parts.join("");
		}

		if (datatype === "Coding")
			return value.display || `${value.system}|${value.code}`;

		if (datatype === "Identifier") return `${value.system}|${value.value}`;

		if (datatype === "CodeableConcept") {
			if (!value) return null;

			if (value.text) return value.text;

			if (value.coding) {
				const displays = value.coding
					.map((c: any) => c.display || c.code)
					.filter(Boolean);
				return displays.length > 0 ? displays.join(", ") : null;
			}

			return null;
		}

		if (datatype === "Annotation") return humanizeAnnotation(value);

		if (datatype === "Attachment") return humanizeAttachment(value);

		if (datatype === "ContactDetail") return humanizeContactDetail(value);

		if (datatype === "Contributor") return humanizeContributor(value);

		if (datatype === "DataRequirement") return humanizeDataRequirement(value);

		if (datatype === "Dosage") return humanizeDosage(value);

		if (datatype === "Expression") return humanizeExpression(value);

		if (datatype === "Money") return humanizeMoney(value);

		if (datatype === "ParameterDefinition")
			return humanizeParameterDefinition(value);

		if (datatype === "RelatedArtifact") return humanizeRelatedArtifact(value);

		if (datatype === "SampledData") return humanizeSampledData(value);

		if (datatype === "Signature") return humanizeSignature(value);

		if (datatype === "Timing") return humanizeTiming(value);

		if (datatype === "UsageContext") return humanizeUsageContext(value);

		if (value.coding && value.coding.some((c: any) => c.display))
			return value.coding
				.map((c: any) => c.display)
				.filter(Boolean)
				.join(", ");

		if (typeof value === "string") return value;

		const unknownHumanized = humanizeUnknown(value);
		return unknownHumanized || null;
	} catch (_error) {
		return null;
	}
}

export function humanizeValue(
	key: string,
	value: any,
	snapshot: Snapshot,
): string | React.ReactNode | null {
	const element = snapshot[key];
	const datatype = element?.datatype || element?.type;

	if (Array.isArray(value)) {
		const humanized = value.map((v) =>
			humanizeValue_(key, v, datatype || "", element),
		);

		if (humanized.length === 1) return humanized[0];

		if (humanized.every((h) => typeof h === "string"))
			return humanized.filter((h) => h && h.trim()).join(", ");

		return humanized[0];
	}

	return humanizeValue_(key, value, datatype || "", element);
}
