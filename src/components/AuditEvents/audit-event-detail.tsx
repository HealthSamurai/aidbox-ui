import {
	CodeEditor,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import { CheckCircle, XCircle } from "lucide-react";
import { useMemo } from "react";
import {
	type AuditEventResource,
	extractEntity,
	extractIpAddress,
	extractRequestId,
	extractUser,
	formatDateTime,
} from "./utils";

function DetailField({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<>
			<dt className="text-text-secondary typo-label-xs whitespace-nowrap pt-0.5">
				{label}
			</dt>
			<dd className="text-text-primary text-sm break-all">{children}</dd>
		</>
	);
}

function DefaultTab({ resource }: { resource: AuditEventResource }) {
	const { date, time } = formatDateTime(resource.recorded);
	const entity = extractEntity(resource);
	const user = extractUser(resource);
	const ip = extractIpAddress(resource);
	const requestId = extractRequestId(resource);
	const isSuccess = resource.outcome === "0";

	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-4 pl-[48px] min-h-80">
			<DetailField label="Event id">
				<Link
					to="/resource/$resourceType/edit/$id"
					params={{ resourceType: "AuditEvent", id: resource.id }}
					search={{ tab: "edit", mode: "json", builderTab: "code" }}
					className="text-text-link hover:underline"
				>
					AuditEvent/{resource.id}
				</Link>
			</DetailField>

			<DetailField label="Event type">
				{resource.type?.display ?? resource.type?.code ?? "—"}
			</DetailField>

			<DetailField label="Occured datetime">
				{date} {time}
			</DetailField>

			<DetailField label="Outcome">
				<span className="inline-flex items-center gap-1">
					{isSuccess ? (
						<CheckCircle className="size-4 text-utility-green" />
					) : (
						<XCircle className="size-4 text-utility-red" />
					)}
					{resource.outcome}
				</span>
			</DetailField>

			{entity && (
				<DetailField label="Entity">
					<div>
						{entity.url ? (
							<span className="text-text-link break-all">{entity.text}</span>
						) : (
							<span>{entity.text}</span>
						)}
						{requestId && (
							<div className="text-text-secondary text-xs mt-0.5">
								Unknown type with identifier: |{requestId}
							</div>
						)}
					</div>
				</DetailField>
			)}

			<DetailField label="User">{user.display || "—"}</DetailField>

			{ip && (
				<DetailField label="Request from IP address">
					<code className="font-mono">{ip}</code>
				</DetailField>
			)}
		</dl>
	);
}

function RawTab({ resource }: { resource: AuditEventResource }) {
	const yamlContent = useMemo(() => {
		try {
			const { resourceType: _rt, ...rest } = resource;
			return yaml.dump(
				{ ...rest, resourceType: resource.resourceType },
				{
					indent: 2,
					lineWidth: -1,
				},
			);
		} catch {
			return JSON.stringify(resource, null, 2);
		}
	}, [resource]);

	return (
		<div className="h-80 overflow-hidden max-w-full pl-[30px]">
			<CodeEditor readOnly currentValue={yamlContent} mode="yaml" />
		</div>
	);
}

export function AuditEventDetail({
	resource,
}: {
	resource: AuditEventResource;
}) {
	return (
		<Tabs variant="tertiary" defaultValue="default" className="w-full">
			<TabsList className="w-full! flex-none! pl-[34px]!">
				<TabsTrigger value="default" className="flex-none!">
					Default
				</TabsTrigger>
				<TabsTrigger value="raw" className="flex-none!">
					Raw
				</TabsTrigger>
			</TabsList>
			<TabsContent value="default" className="bg-bg-primary">
				<DefaultTab resource={resource} />
			</TabsContent>
			<TabsContent value="raw" className="bg-bg-primary">
				<RawTab resource={resource} />
			</TabsContent>
		</Tabs>
	);
}
