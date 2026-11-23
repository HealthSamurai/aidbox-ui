import { Button, cn, IconButton } from "@health-samurai/react-components";
import type { NodeProps } from "@xyflow/react";
import {
	CircleAlert,
	Eye,
	Package as PlanDefinitionIcon,
	Plus,
} from "lucide-react";
import { useId } from "react";
import { GraphFormNode } from "./plan-definition-graph-form";
import { GRAPH_CARD_WIDTH } from "./plan-definition-graph-layout";
import type { AddFormsNode, PackageNode } from "./plan-definition-graph-types";

/** Height of the package node; forms start below it. */
export const GRAPH_PACKAGE_HEIGHT = 64;

function GraphPackageNode({ data }: NodeProps<PackageNode>) {
	const { title, selected, error, disabled, onSelect, onQuickLook } = data;
	return (
		<div className="relative" style={{ width: GRAPH_CARD_WIDTH }}>
			<Button
				variant="ghost"
				className={cn(
					"flex w-full items-center justify-start gap-3 rounded-xl border border-border-primary bg-bg-primary bg-clip-padding py-0 pr-14 pl-4 text-left shadow-sm hover:bg-bg-primary active:bg-bg-primary",
					!selected &&
						!error &&
						!disabled &&
						"hover:border-border-primary_hover",
					selected &&
						"border-border-brand outline-2 -outline-offset-1 outline-border-brand",
					error && "border-border-error",
				)}
				style={{ height: GRAPH_PACKAGE_HEIGHT }}
				aria-label="Package settings"
				aria-description={title || "Untitled package"}
				aria-current={selected ? "true" : undefined}
				aria-invalid={Boolean(error)}
				title={error ?? "Package settings"}
				disabled={disabled}
				onClick={onSelect}
				data-test-id="plan-definition-graph__plan-definition-node-button"
			>
				<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-secondary text-text-secondary">
					<PlanDefinitionIcon className="size-5" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-xs font-normal text-text-secondary">
						Package
					</span>
					<span className="block truncate text-sm font-semibold text-text-primary">
						{title || "Untitled package"}
					</span>
				</span>
				{error && (
					<CircleAlert
						className="size-4 shrink-0 text-text-error-primary"
						role="img"
						aria-label="Package has errors"
					/>
				)}
			</Button>
			<IconButton
				variant="ghost"
				className="absolute top-1/2 right-4 -translate-y-1/2"
				aria-label="Quick look at package"
				title="Quick look at package"
				data-test-id="plan-definition-graph__plan-definition-quick-look-button"
				disabled={disabled}
				onClick={onQuickLook}
				icon={<Eye className="size-4" />}
			/>
		</div>
	);
}

function GraphAddFormsNode({ data }: NodeProps<AddFormsNode>) {
	const { empty, error, disabled, onAdd } = data;
	const errorId = useId();
	return (
		<div
			className="flex flex-col gap-2 pb-6"
			style={{ width: GRAPH_CARD_WIDTH }}
		>
			{empty && (
				<p className="py-6 text-center text-sm text-text-secondary">
					Add forms to build your package
				</p>
			)}
			<IconButton
				variant="ghost"
				className="size-10 self-center rounded-full border border-border-primary bg-bg-primary shadow-sm"
				aria-label="Add Forms"
				title="Add Forms"
				icon={<Plus className="size-4" />}
				data-test-id="plan-definition-editor__add-form-button"
				disabled={disabled}
				onClick={onAdd}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? errorId : undefined}
			/>
			{error && (
				<p
					id={errorId}
					role="alert"
					className="text-xs text-text-error-primary"
				>
					{error}
				</p>
			)}
		</div>
	);
}

/** Module-level so React Flow does not remount nodes on every render. */
export const graphNodeTypes = {
	package: GraphPackageNode,
	form: GraphFormNode,
	addForms: GraphAddFormsNode,
};
