import { Button, Checkbox, Input } from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import type { Header } from "./active-tabs";

export function ParamRow({
	name,
	onNameChange,
	value,
	onValueChange,
	active,
	onActiveChange,
	onRemove,
}: {
	name: string;
	onNameChange: (name: string) => void;
	value: string;
	onValueChange: (value: string) => void;
	active: boolean;
	onActiveChange: (active: boolean) => void;
	onRemove: () => void;
}) {
	return (
		<div className="flex gap-2 items-center">
			<Checkbox className="mr-2" checked={active} onCheckedChange={(checked) => onActiveChange(checked !== false)} />
			<div className="max-w-90 w-90">
				<Input placeholder="Key" value={name} onChange={(ev) => onNameChange(ev.target.value)} disabled={!active} />
			</div>
			<Input placeholder="Value" value={value} onChange={(ev) => onValueChange(ev.target.value)} disabled={!active} />
			<Button
				variant="link"
				size="small"
				onClick={() => onRemove()}
				disabled={name === ""}
				style={{
					opacity: name === "" ? 0 : 1,
					pointerEvents: name === "" ? "none" : "auto",
				}}
			>
				<Trash2 />
			</Button>
		</div>
	);
}

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
		<div className="flex flex-col gap-3 p-4 bg-bg-primary">
			{params.map((param, index) => (
				<ParamRow
					key={param.id}
					name={param.name}
					onNameChange={(name) => onParamChange(index, { ...param, name })}
					value={param.value}
					onValueChange={(value) => onParamChange(index, { ...param, value })}
					active={param.enabled ?? true}
					onActiveChange={(active) => onParamChange(index, { ...param, enabled: active })}
					onRemove={() => onParamRemove(index)}
				/>
			))}
		</div>
	);
}
