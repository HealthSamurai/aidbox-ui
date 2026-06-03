import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type * as HSComp from "@health-samurai/react-components";
import * as React from "react";
import { ValueSetContext } from "./context";
import type { ValueSet, ValueSetExpansion } from "./types";

export function ValueSetProvider({
	initialResource,
	children,
}: {
	initialResource: Resource;
	children: React.ReactNode;
}) {
	const [valueSet, setValueSet] = React.useState<ValueSet>(
		initialResource as ValueSet,
	);

	const updateValueSet = React.useCallback(
		(updater: (vs: ValueSet) => ValueSet) => {
			setValueSet((prev) => updater(prev));
		},
		[],
	);

	const [expansion, setExpansion] = React.useState<ValueSetExpansion | null>(
		null,
	);
	const [expandError, setExpandError] =
		React.useState<HSComp.OperationOutcome | null>(null);
	const [isExpanding, setIsExpanding] = React.useState(false);
	const [expandDurationMs, setExpandDurationMs] = React.useState<number | null>(
		null,
	);

	return (
		<ValueSetContext.Provider
			value={{
				valueSet,
				updateValueSet,
				expansion,
				setExpansion,
				expandError,
				setExpandError,
				isExpanding,
				setIsExpanding,
				expandDurationMs,
				setExpandDurationMs,
			}}
		>
			{children}
		</ValueSetContext.Provider>
	);
}
