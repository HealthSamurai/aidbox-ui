import { Button, Input } from "@health-samurai/react-components";
import { useContext } from "react";
import { ViewDefinitionResourceTypeContext } from "./page";

export function SearchBar({
	value,
	onChange,
	handleSearch,
	isLoadingExample,
}: {
	value: string;
	onChange: (value: string) => void;
	handleSearch: () => void;
	isLoadingExample: boolean;
}) {
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);

	return (
		<div className="px-4 py-3 border-b bg-bg-tertiary">
			<div className="flex gap-2">
				<Input
					type="text"
					className="flex-1 bg-bg-primary"
					prefixValue={
						<span className="flex gap-1 text-nowrap text-elements-assistive">
							<span className="font-medium">GET</span>
							<span>{`/fhir/${viewDefinitionTypeContext.viewDefinitionResourceType}?`}</span>
						</span>
					}
					placeholder={`e.g., _id=123, name=John, _count=10`}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyPress={(e) => {
						if (e.key === "Enter") handleSearch();
					}}
				/>
				<Button
					variant="secondary"
					onClick={handleSearch}
					disabled={isLoadingExample}
				>
					Search
				</Button>
			</div>
		</div>
	);
}
