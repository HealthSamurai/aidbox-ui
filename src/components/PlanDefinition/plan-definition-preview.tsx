import type { PlanDefinition } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { generateId, getAidboxBaseURL } from "@aidbox-ui/utils";
import {
	Button,
	cn,
	IconButton,
	Input,
} from "@health-samurai/react-components";
import {
	Laptop,
	LoaderCircle,
	MoveHorizontal,
	RefreshCw,
	Smartphone,
	Tablet,
} from "lucide-react";
import {
	type ReactNode,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

const PREVIEW_WIDTHS = [
	{ id: "auto", label: "Auto width", width: "100%", icon: MoveHorizontal },
	{ id: "mobile", label: "Mobile", width: "425px", icon: Smartphone },
	{ id: "tablet", label: "Tablet", width: "768px", icon: Tablet },
	{ id: "desktop", label: "Desktop", width: "1024px", icon: Laptop },
];

/**
 * The bar above a form preview: reset on the left, device widths and a custom
 * width in the middle. Shared by the package and the Questionnaire previews.
 */
export function PreviewToolbar({
	onReset,
	width,
	onWidthChange,
	actions,
	className,
}: {
	onReset?: () => void;
	width: string;
	onWidthChange: (width: string) => void;
	/** Controls on the right, such as the renderer switch. */
	actions?: ReactNode;
	className?: string;
}) {
	const [editingWidth, setEditingWidth] = useState(false);
	const applyWidth = (value: string) => {
		const next = value.trim();
		if (/^\d+(px|%)?$/.test(next) && Number.parseInt(next, 10) > 0)
			onWidthChange(/^\d+$/.test(next) ? `${next}px` : next);
		setEditingWidth(false);
	};

	return (
		<div
			className={cn(
				"@container/preview-toolbar grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b bg-bg-secondary px-4",
				className,
			)}
		>
			{onReset && (
				<IconButton
					type="button"
					variant="ghost"
					className="justify-self-start"
					aria-label="Reset form state"
					title="Reset form state"
					data-test-id="plan-definition-preview__reset-button"
					onClick={onReset}
					icon={<RefreshCw className="size-4" />}
				/>
			)}
			<fieldset
				className="col-start-2 flex min-w-0 items-center gap-1"
				aria-label="Preview width"
			>
				{PREVIEW_WIDTHS.map(({ id, label, width: presetWidth, icon: Icon }) => (
					<IconButton
						key={id}
						type="button"
						variant="ghost"
						className={cn(
							"aria-pressed:bg-bg-tertiary aria-pressed:text-text-primary",
							id !== "auto" && "hidden @lg/preview-toolbar:flex",
						)}
						aria-label={label}
						aria-pressed={width === presetWidth}
						title={`${label} (${presetWidth})`}
						data-test-id={`plan-definition-preview__${id}-width-button`}
						onClick={() => onWidthChange(presetWidth)}
						icon={<Icon className="size-4" />}
					/>
				))}
				{editingWidth ? (
					<Input
						autoFocus
						onFocus={(event) => event.currentTarget.select()}
						aria-label="Custom preview width"
						title="Width in pixels or percent"
						data-test-id="plan-definition-preview__width-input"
						className="h-7 w-20 px-2 text-xs!"
						defaultValue={width}
						onBlur={(event) => applyWidth(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") applyWidth(event.currentTarget.value);
							if (event.key === "Escape") setEditingWidth(false);
						}}
					/>
				) : (
					<Button
						type="button"
						variant="ghost"
						size="small"
						className="h-7 rounded-md px-2 text-xs!"
						aria-label="Custom preview width"
						title="Set width in pixels or percent"
						data-test-id="plan-definition-preview__custom-width-button"
						onClick={() => setEditingWidth(true)}
					>
						{width}
					</Button>
				)}
			</fieldset>
			{actions && (
				<div className="col-start-3 flex min-w-0 items-center justify-self-end">
					{actions}
				</div>
			)}
		</div>
	);
}

/** Run the real RequestGroup renderer against an unsaved, isolated preview session. */
export function PlanDefinitionPreview({
	planDefinition,
	renderHeader,
}: {
	planDefinition: PlanDefinition;
	renderHeader?: (onRefresh: () => void) => ReactNode;
}) {
	const [handle, setHandle] = useState(() => generateId());
	// Tab changes retain the iframe. Explicit refresh replaces the entire renderer session.
	const refresh = () => setHandle(generateId());
	const [previewWidth, setPreviewWidth] = useState("100%");

	return (
		<section
			className="flex h-full min-h-0 min-w-0 flex-col bg-bg-primary"
			aria-label="Package preview"
		>
			{renderHeader?.(refresh)}
			<PreviewToolbar
				onReset={renderHeader ? undefined : refresh}
				width={previewWidth}
				onWidthChange={setPreviewWidth}
			/>
			<PlanDefinitionPreviewFrame
				key={handle}
				planDefinition={planDefinition}
				handle={handle}
				width={previewWidth}
			/>
		</section>
	);
}

/** Use the renderer's existing handshake protocol, restricted to this iframe and origin. */
export function PlanDefinitionPreviewFrame({
	planDefinition,
	handle,
	width = "100%",
}: {
	planDefinition: PlanDefinition;
	handle: string;
	width?: string;
}) {
	const iframe = useRef<HTMLIFrameElement>(null);
	const [loading, setLoading] = useState(true);
	const connected = useRef(false);
	const lastMessage = useRef<string | undefined>(undefined);
	const base = getAidboxBaseURL();
	const origin = new URL(base).origin;
	const parameters = new URLSearchParams({
		// Existing renderer flags: anonymous, post messaging, controlled mode, automatic worker updates.
		f: String(1 + 131072 + 2097152 + 134217728),
		messaging_handle: handle,
		messaging_origin: window.location.origin,
	});
	const source = `${base}/ui/sdc/renderer#/request-group/preview?${parameters}`;

	const display = useEffectEvent((nextPlanDefinition = planDefinition) => {
		const messageId = generateId();
		lastMessage.current = messageId;
		iframe.current?.contentWindow?.postMessage(
			{
				messagingHandle: handle,
				messageType: "sdc.displayPlanDefinition",
				messageId,
				payload: { planDefinition: nextPlanDefinition },
			},
			origin,
		);
	});

	useEffect(() => {
		const postHandshake = (responseToMessageId?: string) => {
			iframe.current?.contentWindow?.postMessage(
				{
					messagingHandle: handle,
					messageType: "status.handshake",
					messageId: generateId(),
					responseToMessageId,
					payload: { protocolVersion: "1.0", fhirVersion: "R4" },
				},
				origin,
			);
		};
		const receive = (event: MessageEvent) => {
			if (
				event.source !== iframe.current?.contentWindow ||
				event.origin !== origin ||
				event.data?.messagingHandle !== handle
			)
				return;
			const message = event.data;
			if (message.messageType === "status.handshake") {
				if (!message.responseToMessageId) postHandshake(message.messageId);
				if (!connected.current) {
					connected.current = true;
					clearInterval(handshake);
					display();
				}
			}
			if (
				message.messageType === "sdc.displayPlanDefinition" &&
				message.responseToMessageId === lastMessage.current
			) {
				clearTimeout(timeout);
				setLoading(false);
			}
		};
		window.addEventListener("message", receive);
		const handshake = setInterval(() => postHandshake(), 500);
		const timeout = setTimeout(() => {
			clearInterval(handshake);
			setLoading(false);
		}, 20000);
		return () => {
			connected.current = false;
			clearInterval(handshake);
			clearTimeout(timeout);
			window.removeEventListener("message", receive);
		};
	}, [handle, origin]);

	useEffect(() => {
		if (!connected.current) return;
		const timer = setTimeout(() => display(planDefinition), 250);
		return () => clearTimeout(timer);
	}, [planDefinition]);

	return (
		<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto bg-bg-tertiary">
			{(loading || !planDefinition.action?.length) && (
				<div
					className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-bg-primary text-sm text-text-secondary"
					role={planDefinition.action?.length ? "status" : undefined}
				>
					{Boolean(planDefinition.action?.length) && (
						<>
							<LoaderCircle className="size-4 animate-spin" />
							Loading preview…
						</>
					)}
				</div>
			)}
			<iframe
				ref={iframe}
				src={source}
				title="Package preview"
				data-test-id="plan-definition-preview__iframe"
				className="mx-auto block min-h-0 max-w-none flex-1 border-0 bg-bg-primary"
				style={{ width }}
				sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
			/>
		</div>
	);
}
