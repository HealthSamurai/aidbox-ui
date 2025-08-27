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
	header,
	onHeaderChange,
	index,
}: {
	header: Header;
	onHeaderChange: (headerIndex: number, header: Header) => void;
	index: number;
}) {
	return (
		<TableRow>
			<TableCell className="px-4">
				<Input
					defaultValue={header.name}
					onChange={(e) =>
						onHeaderChange(index, { ...header, name: e.target.value })
					}
				/>
			</TableCell>
			<TableCell className="px-4">
				<Input
					defaultValue={header.value}
					onChange={(e) =>
						onHeaderChange(index, { ...header, value: e.target.value })
					}
				/>
			</TableCell>
		</TableRow>
	);
}

export default function HeadersEditor({
	headers,
	onHeaderChange,
}: {
	headers: Header[];
	onHeaderChange: (headerIndex: number, header: Header) => void;
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
				{Array.isArray(headers) &&
					headers.map((header, index) => (
						<EditableTableRow
							key={`header-table-row-${header.id}`}
							index={index}
							header={header}
							onHeaderChange={onHeaderChange}
						/>
					))}
			</TableBody>
		</Table>
	);
}
