import { Button } from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	ArrowUpRight,
	Check,
	Database,
	Github,
	SquareTerminal,
	TableProperties,
} from "lucide-react";
import { restConsoleImage } from "./rest-image";
import { sqlConsoleImage } from "./sql-image";
import { vdBuilderImage } from "./vd-image";

const cardShadow =
	"shadow-[0px_56px_34px_0px_rgba(0,0,0,0.03),0px_25px_25px_0px_rgba(0,0,0,0.04),0px_6px_14px_0px_rgba(0,0,0,0.05)]";

function RestIllustration() {
	return (
		<div
			className={`h-[417px] w-[476px] overflow-hidden rounded-xl border border-border-primary ${cardShadow}`}
		>
			<img src={restConsoleImage} alt="REST Console" className="size-full object-cover" />
		</div>
	);
}

function SqlIllustration() {
	return (
		<div
			className={`h-[357px] w-[476px] overflow-hidden rounded-xl border border-border-primary ${cardShadow}`}
		>
			<img src={sqlConsoleImage} alt="SQL Console" className="size-full object-cover" />
		</div>
	);
}

function VdIllustration() {
	return (
		<div
			className={`h-[361px] w-[476px] overflow-hidden rounded-xl border border-border-primary ${cardShadow}`}
		>
			<img
				src={vdBuilderImage}
				alt="ViewDefinition Builder"
				className="size-full object-cover"
			/>
		</div>
	);
}

const storybookUrl =
	"https://healthsamurai.github.io/aidbox-ts-sdk/react-components/?path=/docs/component-button--docs";

function OpenSourceIllustration() {
	return (
		<div
			className={`overflow-hidden rounded-xl border border-border-primary bg-bg-primary ${cardShadow}`}
		>
			<div className="flex items-center gap-2 border-b border-border-primary bg-bg-secondary px-4 py-2.5">
				<div className="size-3 rounded-full bg-red-400" />
				<div className="size-3 rounded-full bg-yellow-400" />
				<div className="size-3 rounded-full bg-green-400" />
				<span className="ml-2 font-mono text-[11px] text-text-tertiary">
					App.tsx
				</span>
			</div>
			<pre className="px-4 py-3 font-mono text-[11px] leading-[1.7]">
				<span className="text-purple-600">import</span>
				{" { "}
				<span className="text-blue-600">Button</span>
				{", "}
				<span className="text-blue-600">Input</span>
				{" } "}
				<span className="text-purple-600">from</span>{" "}
				<span className="text-green-600">
					{"'@health-samurai/react-components'"}
				</span>
				{";\n\n"}
				<span className="text-purple-600">function</span>{" "}
				<span className="text-blue-600">App</span>
				{"() {\n  "}
				<span className="text-purple-600">return</span>
				{" (\n    <"}
				<span className="text-blue-600">div</span>
				{">\n      <"}
				<span className="text-blue-600">Input</span>{" "}
				<span className="text-text-tertiary">placeholder</span>
				{"="}
				<span className="text-green-600">"Search..."</span>
				{" />\n      <"}
				<span className="text-blue-600">Button</span>{" "}
				<span className="text-text-tertiary">onClick</span>
				{"={() => console."}
				<span className="text-blue-600">log</span>
				{"("}
				<span className="text-green-600">{"'clicked'"}</span>
				{")}>\n        Submit\n      </"}
				<span className="text-blue-600">Button</span>
				{">\n    </"}
				<span className="text-blue-600">div</span>
				{">\n  );\n}"}
			</pre>
		</div>
	);
}

function FeatureSection({
	icon,
	title,
	description,
	features,
	to,
	external,
	cta,
	secondaryTo,
	secondaryCta,
	illustration,
	reverse,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	features: string[];
	to: string;
	external?: boolean;
	cta: string;
	secondaryTo?: string;
	secondaryCta?: string;
	illustration?: React.ReactNode;
	reverse?: boolean;
}) {
	const textBlock = (
		<div className="flex flex-col justify-start">
			<div className="flex items-center gap-3 p-2">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-brand-secondary text-text-brand-primary">
					{icon}
				</div>
				<h2 className="text-2xl font-semibold leading-8 text-text-primary">{title}</h2>
			</div>
			<div className="pl-2 pt-3">
				<p className="text-base leading-[26px] text-text-secondary">{description}</p>
				<ul className="mt-7 space-y-2.5 text-sm leading-5 text-text-secondary">
					{features.map((feature) => (
						<li key={feature} className="flex items-start gap-2.5">
							<Check className="mt-0.5 size-4 shrink-0 text-text-brand-primary" />
							<span>{feature}</span>
						</li>
					))}
				</ul>
				<div className="mt-8 flex gap-3">
					{external ? (
						<a href={to} target="_blank" rel="noopener noreferrer">
							<Button variant="secondary">
								{cta}
								<ArrowUpRight className="size-4" />
							</Button>
						</a>
					) : (
						<Link to={to}>
							<Button variant="secondary">
								{cta}
								<ArrowRight className="size-4" />
							</Button>
						</Link>
					)}
					{secondaryTo && secondaryCta && (
						<a href={secondaryTo} target="_blank" rel="noopener noreferrer">
							<Button variant="secondary">
								{secondaryCta}
								<ArrowUpRight className="size-4" />
							</Button>
						</a>
					)}
				</div>
			</div>
		</div>
	);

	const illustrationBlock = <div className="shrink-0 py-[31px]">{illustration}</div>;

	const gridCols = reverse
		? "md:grid-cols-[476px_1fr]"
		: "md:grid-cols-[1fr_476px]";

	return (
		<section
			className={`grid grid-cols-1 items-center gap-12 ${gridCols} md:gap-16`}
		>
			{reverse ? (
				<>
					{illustrationBlock}
					{textBlock}
				</>
			) : (
				<>
					{textBlock}
					{illustrationBlock}
				</>
			)}
		</section>
	);
}

export function HomePage() {
	return (
		<div className="h-full overflow-auto px-8">
			<div className="mx-auto max-w-[1016px] py-20">
				{/* Hero */}
				<div className="mb-[116px] text-center">
					<h1 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
						The new Aidbox UI
					</h1>
					<p className="mx-auto mt-6 text-lg leading-relaxed text-text-secondary">
						A modern, open-source developer console for Aidbox.
						<br />
						Explore FHIR resources, run queries, and build views — all from your
						browser.
					</p>
				</div>

				{/* Feature sections */}
				<div className="flex flex-col gap-[121px]">
					<FeatureSection
						icon={<Github className="size-5" />}
						title="Open Source"
						description="Aidbox UI is fully open source. Fork it, extend it, contribute back. Built with React, TypeScript, and a shared component library."
						features={[
							"Full source code on GitHub",
							"Reusable React component library",
							"Storybook with live examples",
						]}
						to="https://github.com/HealthSamurai/aidbox-ui"
						external
						cta="View on GitHub"
						secondaryTo="https://github.com/HealthSamurai/aidbox-ts-sdk/tree/master/packages/react-components"
						secondaryCta="React Components"
						illustration={<OpenSourceIllustration />}
					/>

					<FeatureSection
						icon={<SquareTerminal className="size-5" />}
						title="REST Console"
						description="New REST client with deep FHIR integration. Test APIs, explore endpoints, and debug requests without leaving Aidbox."
						features={[
							"Multiple tabs for parallel requests",
							"Autocomplete for URLs, parameters, and headers",
							"Saved collections and request history",
						]}
						to="/rest"
						cta="Try REST console"
						illustration={<RestIllustration />}
						reverse
					/>

					<FeatureSection
						icon={<Database className="size-5" />}
						title="SQL Console"
						description="Powerful SQL editor for direct database access. Query your data, explore schema, and monitor performance."
						features={[
							"Multiple tabs for parallel queries",
							"Autocomplete for tables, columns, and functions",
							"Built-in database structure explorer",
							"Running queries monitor",
							"Table and index information",
						]}
						to="/db-console"
						cta="Try SQL console"
						illustration={<SqlIllustration />}
					/>

					<FeatureSection
						icon={<TableProperties className="size-5" />}
						title="ViewDefinition builder"
						description="Visual builder for FHIR ViewDefinitions. Create flat, queryable views over FHIR resources for analytics and reporting."
						features={[
							"Visual column editor with live preview",
							"FHIRPath expression support",
							"JSON and table output modes",
						]}
						to="/resource/ViewDefinition"
						cta="Try ViewDefinition builder"
						illustration={<VdIllustration />}
						reverse
					/>
				</div>
			</div>
		</div>
	);
}
