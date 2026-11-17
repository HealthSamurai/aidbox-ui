import { Select } from "@health-samurai/react-components";
import type { ComponentProps } from "react";

/** Preserve controlled values when the native form bridge initializes. */
export function ConfigurationSelect({
	onValueChange,
	...props
}: ComponentProps<typeof Select>) {
	return (
		<Select
			{...props}
			onValueChange={(value) => {
				// Every configuration option, including Default/None, has a nonempty
				// value. The select's synthetic empty event is not a user selection.
				if (value) onValueChange?.(value);
			}}
		/>
	);
}
