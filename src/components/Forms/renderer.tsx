import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { Alert, AlertDescription } from "@health-samurai/react-components";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getRendererWebComponentUrl } from "./utils";

const RENDERER_TAG_NAME = "aidbox-form-renderer";
const RENDERER_SCRIPT_SELECTOR = "script[data-formbox-renderer-webcomponent]";

let rendererScriptPromise: Promise<void> | null = null;

function ensureRendererWebComponentLoaded() {
	if (customElements.get(RENDERER_TAG_NAME)) {
		return Promise.resolve();
	}

	if (rendererScriptPromise) {
		return rendererScriptPromise;
	}

	rendererScriptPromise = new Promise((resolve, reject) => {
		const onReady = () => {
			customElements
				.whenDefined(RENDERER_TAG_NAME)
				.then(() => resolve(), reject);
		};

		const onError = () => {
			rendererScriptPromise = null;
			reject(new Error("Failed to load renderer webcomponent"));
		};

		const existingScript = document.querySelector<HTMLScriptElement>(
			RENDERER_SCRIPT_SELECTOR,
		);

		if (existingScript) {
			onReady();
			existingScript.addEventListener("error", onError, { once: true });
			return;
		}

		const script = document.createElement("script");
		script.src = getRendererWebComponentUrl();
		script.async = true;
		script.dataset.formboxRendererWebcomponent = "true";
		script.addEventListener("load", onReady, { once: true });
		script.addEventListener("error", onError, { once: true });
		document.head.appendChild(script);
	});

	return rendererScriptPromise;
}

export function Renderer({ questionnaire }: { questionnaire: Questionnaire }) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		let cancelled = false;

		setError(null);
		setIsReady(false);

		ensureRendererWebComponentLoaded()
			.then(() => {
				if (cancelled || !hostRef.current) {
					return;
				}

				const rendererElement = document.createElement(RENDERER_TAG_NAME);
				rendererElement.setAttribute(
					"questionnaire",
					JSON.stringify(questionnaire),
				);
				rendererElement.setAttribute("hide-footer", "true");
				rendererElement.setAttribute(
					"style",
					"display:block;width:100%;height:100%;border:0;",
				);

				const handleReady = () => {
					if (!cancelled) {
						setIsReady(true);
					}
				};

				rendererElement.addEventListener("ready", handleReady, { once: true });
				hostRef.current.replaceChildren(rendererElement);
			})
			.catch((caughtError: unknown) => {
				if (!cancelled) {
					setError(
						caughtError instanceof Error
							? caughtError.message
							: "Failed to initialize preview",
					);
				}
			});

		return () => {
			cancelled = true;
			if (hostRef.current) {
				hostRef.current.replaceChildren();
			}
		};
	}, [questionnaire]);

	return (
		<div
			className="relative h-full min-h-0 flex-1 bg-bg-primary"
			data-test-id="form-renderer"
		>
			{error ? (
				<div className="p-4" data-test-id="form-renderer__error">
					<Alert variant="warning">
						<AlertCircle className="size-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</div>
			) : null}
			{!isReady && !error ? (
				<output
					className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-bg-primary text-sm text-text-secondary"
					data-test-id="form-renderer__loading"
				>
					<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
					Loading preview…
				</output>
			) : null}
			<div
				ref={hostRef}
				className="h-full w-full"
				data-test-id="form-renderer__host"
			/>
		</div>
	);
}
