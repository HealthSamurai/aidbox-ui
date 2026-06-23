import { useEffect, useRef } from "react";
import { useVegaEmbed } from "react-vega";
import type { EmbedOptions, VisualizationSpec } from "vega-embed";

const CHART_OPTIONS: EmbedOptions = {
	mode: "vega-lite",
	actions: false,
	renderer: "canvas",
};

export default function VegaLiteChart({
	spec,
	onError,
}: {
	spec: VisualizationSpec;
	onError?: (error: unknown) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const result = useVegaEmbed({ ref, spec, options: CHART_OPTIONS, onError });

	useEffect(() => {
		const el = ref.current;
		if (!el || !result) return;
		const observer = new ResizeObserver(() => {
			void result.view.resize().runAsync();
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [result]);

	return <div ref={ref} style={{ width: "100%" }} />;
}
