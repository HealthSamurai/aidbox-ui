import { Button, Input } from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import type { Header } from "./active-tabs";

export default function ParamsEditor({
	params,
	onParamChange,
	onParamRemove,
}: {
	params: Header[];
	onParamChange: (paramIndex: number, param: Header) => void;
	onParamRemove: (paramIndex: number) => void;
}) {
	return (
		<div className="flex flex-col gap-3 p-4">
			{params.map((param, index) => {
				return (
					<div key={param.id} className="flex gap-2 items-center">
						<div className="max-w-90 w-90">
							<Input
								placeholder="Key"
								defaultValue={param.name}
								onChange={(e) =>
									onParamChange(index, { ...param, name: e.target.value })
								}
							/>
						</div>
						<Input
							placeholder="Value"
							defaultValue={param.value}
							onChange={(e) =>
								onParamChange(index, { ...param, value: e.target.value })
							}
						/>
						<Button
							variant="link"
							size="small"
							onClick={() => onParamRemove(index)}
							disabled={param.name === undefined || param.name === ""}
							style={{
								opacity: param.name === undefined || param.name === "" ? 0 : 1,
								pointerEvents:
									param.name === undefined || param.name === ""
										? "none"
										: "auto",
							}}
						>
							<Trash2 />
						</Button>
					</div>
				);
			})}
		</div>
	);
}
