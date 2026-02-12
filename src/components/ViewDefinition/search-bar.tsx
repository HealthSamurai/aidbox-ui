import { Button, Input } from "@health-samurai/react-components";
import { useContext, useState } from "react";
import { ViewDefinitionResourceTypeContext } from "./page";

const handleKeyPress = (
	e: React.KeyboardEvent<HTMLInputElement>,
	handleSearch: (query?: string) => void,
	searchQuery?: string,
) => {
	if (e.key === "Enter") {
		handleSearch(searchQuery);
	}
};

export function SearchBar({
	handleSearch,
	isLoadingExample,
}: {
	handleSearch: (query?: string) => void;
	isLoadingExample: boolean;
}) {
	const viewDefinitionTypeContext = useContext(
		ViewDefinitionResourceTypeContext,
	);

	const [searchQuery, setSearchQuery] = useState("");

	return (
		<div className="px-4 py-3 border-b bg-bg-tertiary">
			<div className="flex gap-2">
				<Input
					type="text"
					className="flex-1 bg-bg-primary"
					prefixValue={
						<span className="flex gap-1 text-nowrap text-elements-assistive">
							<span className="font-bold">GET</span>
							<span>{`/fhir/${viewDefinitionTypeContext.viewDefinitionResourceType}?`}</span>
						</span>
					}
					placeholder={`e.g., _id=123, name=John, _count=10`}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyPress={(e) => {
						handleKeyPress(e, handleSearch, searchQuery);
					}}
				/>
				<Button
					variant="secondary"
					onClick={() => {
						handleSearch(searchQuery);
					}}
					disabled={isLoadingExample}
				>
					Search
				</Button>
			</div>
		</div>
	);
}
