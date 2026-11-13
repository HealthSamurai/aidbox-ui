import { SegmentControl } from "@health-samurai/react-components";
import type { ResourceFormat } from "./resource-format";

/** The same shared format control used by Aidbox's resource editor toolbar. */
export function ResourceFormatSelect({
	value,
	onChange,
	disabled,
}: {
	value: ResourceFormat;
	onChange: (format: ResourceFormat) => void;
	disabled?: boolean;
}) {
	return (
		<fieldset
			aria-label="Code format"
			disabled={disabled}
			className="flex shrink-0 disabled:opacity-50"
		>
			<SegmentControl
				value={value}
				onValueChange={onChange}
				items={[
					{ value: "json", label: "JSON" },
					{ value: "yaml", label: "YAML" },
				]}
			/>
		</fieldset>
	);
}
