import {
	Input,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@health-samurai/react-components";
import type { Header } from "./active-tabs";

function EditableTableRow({
	param,
	onParamChange,
	index,
}: {
	param: Header;
	onParamChange: (paramIndex: number, param: Header) => void;
	index: number;
}) {
	return (
		<TableRow>
			<TableCell className="px-4">
				<Input
					defaultValue={param.name}
					onChange={(e) =>
						onParamChange(index, { ...param, name: e.target.value })
					}
				/>
			</TableCell>
			<TableCell className="px-4">
				<Input
					defaultValue={param.value}
					onChange={(e) =>
						onParamChange(index, { ...param, value: e.target.value })
					}
				/>
			</TableCell>
		</TableRow>
	);
}

export default function ParamsEditor({
	params,
	onParamChange,
}: {
	params: Header[];
	onParamChange: (paramIndex: number, param: Header) => void;
}) {
	return (
		<Table className="w-full">
			<TableHeader>
				<TableRow>
					<TableHead className="px-4 w-80">Key</TableHead>
					<TableHead className="px-4">Value</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{Array.isArray(params) &&
					params.map((param, index) => (
						<EditableTableRow
							key={`param-table-row-${param.id}`}
							index={index}
							param={param}
							onParamChange={onParamChange}
						/>
					))}
			</TableBody>
		</Table>
	);
}
