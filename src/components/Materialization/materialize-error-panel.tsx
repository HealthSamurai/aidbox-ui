import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import { useAidboxClient } from "../../AidboxClient";

// Plan errors name the resources that broke the plan: local references
// ("AidboxMaterialization/m-vd") and dependency canonicals. Each becomes a link.
const REFERENCE_PATTERN =
	/(AidboxMaterialization\/[A-Za-z0-9\-.]+|https?:\/\/[^\s"'`,]+)/g;

/** Trailing sentence punctuation is not part of a reference. */
const trimReference = (text: string) => text.replace(/[.:;)\]]+$/, "");

const editorSearch = {
	tab: "builder",
	mode: "json",
	builderTab: "form",
} as const;

/**
 * A canonical from an error message, resolved to the resource that carries it.
 * ViewDefinition and Library are the only types a materialization plan walks.
 */
function CanonicalLink({ url }: { url: string }) {
	const client = useAidboxClient();
	const { data: owner } = useQuery({
		queryKey: ["materialization-error-canonical", url],
		staleTime: 30_000,
		queryFn: async () => {
			const plain = url.split("|")[0] ?? url;
			for (const resourceType of ["ViewDefinition", "Library"] as const) {
				const result = await client.request<Bundle>({
					method: "GET",
					url: `/fhir/${resourceType}`,
					params: [
						["url", plain],
						["_count", "1"],
					],
				});
				if (!result.isOk()) continue;
				const id = result.value.resource.entry?.[0]?.resource?.id;
				if (id) return { resourceType, id };
			}
			return null;
		},
	});

	if (!owner) return <span className="font-mono">{url}</span>;
	return (
		<Link
			to="/resource/$resourceType/edit/$id"
			params={{ resourceType: owner.resourceType, id: owner.id }}
			search={editorSearch}
			className="font-mono text-text-link hover:underline"
			title={`${owner.resourceType}/${owner.id}`}
		>
			{url}
		</Link>
	);
}

function ReferenceLink({ reference }: { reference: string }) {
	if (reference.startsWith("AidboxMaterialization/")) {
		const id = reference.slice("AidboxMaterialization/".length);
		return (
			<Link
				to="/resource/$resourceType/edit/$id"
				params={{ resourceType: "AidboxMaterialization", id }}
				search={editorSearch}
				className="font-mono text-text-link hover:underline"
			>
				{reference}
			</Link>
		);
	}
	return <CanonicalLink url={reference} />;
}

/** The message text with every recognised resource reference turned into a link. */
function LinkifiedMessage({ text }: { text: string }) {
	// A capture group makes split() keep the matches at the odd indexes.
	const parts = text.split(REFERENCE_PATTERN);
	return (
		<div className="whitespace-pre-wrap break-words text-sm">
			{parts.map((part, index) => {
				if (index % 2 === 0) return part;
				const reference = trimReference(part);
				const trailer = part.slice(reference.length);
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: segments of a static string
					<span key={index}>
						<ReferenceLink reference={reference} />
						{trailer}
					</span>
				);
			})}
		</div>
	);
}

/**
 * What `$materialize` refused and why, with the resources it names as links.
 * The refusal happens while planning, so nothing was dropped or built.
 */
export function MaterializeErrorPanel({
	error,
	onDismiss,
}: {
	error: Error;
	onDismiss: () => void;
}) {
	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b px-4">
				<span className="typo-label text-text-error-primary">
					Materialize error
				</span>
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					onClick={onDismiss}
				>
					<Lucide.XIcon className="w-4 h-4" />
				</HSComp.Button>
			</div>
			<div className="flex-1 min-h-0 overflow-auto px-4 py-3">
				<div className="text-sm text-text-secondary mb-2">
					The materialization was refused because of an error:
				</div>
				<LinkifiedMessage text={error.message} />
			</div>
		</div>
	);
}
