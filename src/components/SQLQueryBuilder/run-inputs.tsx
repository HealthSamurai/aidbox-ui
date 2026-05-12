import * as HSComp from "@health-samurai/react-components";
import { useSQLQueryContext } from "./context";

function placeholderFor(fhirType: string | undefined): string {
	switch (fhirType) {
		case "integer":
			return "e.g. 42";
		case "decimal":
			return "e.g. 3.14";
		case "date":
			return "YYYY-MM-DD";
		case "dateTime":
			return "YYYY-MM-DDThh:mm:ssZ";
		case "time":
			return "hh:mm:ss";
		default:
			return "value";
	}
}

export function RunInputs() {
	const { library, paramValues, setParamValue } = useSQLQueryContext();
	const params = library.parameter ?? [];

	if (params.length === 0) return null;

	return (
		<div className="flex flex-col border-b">
			<div className="flex items-center bg-bg-secondary px-4 h-10 border-b shrink-0">
				<span className="typo-label text-text-secondary">Parameter values</span>
			</div>
			<div className="flex flex-col gap-3 px-4 py-3 bg-bg-primary">
				{params.map((p, i) => {
					const name = p.name ?? "";
					const type = p.type ?? "string";
					if (!name) return null;
					const value = paramValues[name] ?? "";
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: order matters
						<div key={`${name}-${i}`} className="flex flex-col gap-1">
							<label
								htmlFor={`run-input-${name}`}
								className="text-text-tertiary text-xs font-mono"
							>
								{name}
							</label>
							{type === "boolean" ? (
								<HSComp.Select
									value={value || "_unset"}
									onValueChange={(v) =>
										setParamValue(name, v === "_unset" ? "" : v)
									}
								>
									<HSComp.SelectTrigger className="w-full h-7">
										<HSComp.SelectValue placeholder="(unset)" />
									</HSComp.SelectTrigger>
									<HSComp.SelectContent>
										<HSComp.SelectItem value="_unset">
											(unset)
										</HSComp.SelectItem>
										<HSComp.SelectItem value="true">true</HSComp.SelectItem>
										<HSComp.SelectItem value="false">false</HSComp.SelectItem>
									</HSComp.SelectContent>
								</HSComp.Select>
							) : (
								<HSComp.Input
									id={`run-input-${name}`}
									type="text"
									placeholder={placeholderFor(type)}
									suffix={type}
									className="font-mono text-xs"
									value={value}
									onChange={(e) => setParamValue(name, e.target.value)}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
