import { Badge, Button } from "@health-samurai/react-components";
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

function GifPlaceholder({ label }: { label: string }) {
	return (
		<div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border-primary bg-bg-secondary text-sm text-text-tertiary">
			{label} — gif placeholder
		</div>
	);
}

function FeatureSection({
	icon,
	title,
	badge,
	description,
	features,
	to,
	external,
	cta,
	gifLabel,
	reverse,
}: {
	icon: React.ReactNode;
	title: string;
	badge?: string;
	description: string;
	features: string[];
	to: string;
	external?: boolean;
	cta: string;
	gifLabel: string;
	reverse?: boolean;
}) {
	const textBlock = (
		<div className="flex flex-col justify-center">
			<div className="mb-4 flex items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bg-brand-secondary text-text-brand-primary">
					{icon}
				</div>
				{badge && (
					<Badge variant="secondary" className="text-xs">
						{badge}
					</Badge>
				)}
			</div>
			<h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
			<p className="mt-3 leading-relaxed text-text-secondary">{description}</p>
			<ul className="mt-6 space-y-2.5 text-sm text-text-secondary">
				{features.map((feature) => (
					<li key={feature} className="flex items-start gap-2.5">
						<Check className="mt-0.5 size-4 shrink-0 text-text-brand-primary" />
						<span>{feature}</span>
					</li>
				))}
			</ul>
			<div className="mt-8">
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
			</div>
		</div>
	);

	const gifBlock = <GifPlaceholder label={gifLabel} />;

	return (
		<section className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
			{reverse ? (
				<>
					{gifBlock}
					{textBlock}
				</>
			) : (
				<>
					{textBlock}
					{gifBlock}
				</>
			)}
		</section>
	);
}

export function HomePage() {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto max-w-[1080px] px-8 py-20">
				{/* Hero */}
				<div className="mb-24 text-center">
					<h1 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
						The new Aidbox UI
					</h1>
					<p className="mx-auto mt-5 max-w-[640px] text-lg leading-relaxed text-text-secondary">
						A modern, open-source developer console for Aidbox. Explore FHIR
						resources, run queries, and build views — all from your browser.
					</p>
				</div>

				{/* Feature sections */}
				<div className="space-y-32">
					<FeatureSection
						icon={<Github className="size-5" />}
						title="Open Source"
						description="Aidbox UI is fully open source. Fork it, extend it, contribute back. Built with React, TypeScript, and a shared component library."
						features={[
							"Full source code on GitHub",
							"Reusable FHIR component library",
							"Community contributions welcome",
						]}
						to="https://github.com/HealthSamurai/aidbox-ui"
						external
						cta="View on GitHub"
						gifLabel="GitHub repository"
					/>

					<FeatureSection
						icon={<SquareTerminal className="size-5" />}
						title="REST console"
						badge="New"
						description="Postman-style REST client with deep FHIR integration. Test APIs, explore endpoints, and debug requests without leaving Aidbox."
						features={[
							"Multiple tabs for parallel requests",
							"Autocomplete for URLs, parameters, and headers",
							"Saved collections and request history",
						]}
						to="/rest"
						cta="Try REST console"
						gifLabel="REST console"
						reverse
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
						gifLabel="ViewDefinition builder"
					/>

					<FeatureSection
						icon={<Database className="size-5" />}
						title="SQL console"
						badge="New"
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
						gifLabel="SQL console"
						reverse
					/>
				</div>
			</div>
		</div>
	);
}
