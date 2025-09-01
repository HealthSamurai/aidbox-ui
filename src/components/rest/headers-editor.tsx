import { Button, Input } from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import type { Header } from "./active-tabs";

export default function HeadersEditor({
	headers,
	onHeaderChange,
	onHeaderRemove,
}: {
	headers: Header[];
	onHeaderChange: (headerIndex: number, header: Header) => void;
	onHeaderRemove: (headerIndex: number) => void;
}) {
	return (
		<div className="flex flex-col gap-3 p-4">
			{headers.map((header, index) => {
				return (
					<div key={header.id} className="flex gap-2 items-center">
						<div className="max-w-90 w-90">
							<Input
								placeholder="Key"
								defaultValue={header.name}
								onChange={(e) =>
									onHeaderChange(index, { ...header, name: e.target.value })
								}
							/>
						</div>
						<Input
							placeholder="Value"
							defaultValue={header.value}
							onChange={(e) =>
								onHeaderChange(index, { ...header, value: e.target.value })
							}
						/>
						<Button
							variant="link"
							size="small"
							onClick={() => onHeaderRemove(index)}
							disabled={header.name === undefined || header.name === ""}
							style={{
								opacity:
									header.name === undefined || header.name === "" ? 0 : 1,
								pointerEvents:
									header.name === undefined || header.name === ""
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
