import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@health-samurai/react-components";
import { Columns2, Rows2 } from "lucide-react";

type SplitDirection = "horizontal" | "vertical";

type SplitButtonProps = {
	direction: SplitDirection;
	onChange: (direction: SplitDirection) => void;
};

function HorizontalSplitButton({ onChange }: { onChange: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="link" onClick={onChange} size="small">
					<Rows2 />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Switch to vertical split</TooltipContent>
		</Tooltip>
	);
}

function VerticalSplitButton({ onChange }: { onChange: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="link" onClick={onChange} size="small">
					<Columns2 />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Switch to horizontal split</TooltipContent>
		</Tooltip>
	);
}

function SplitButton({ direction, onChange }: SplitButtonProps) {
	if (direction === "horizontal") {
		return <HorizontalSplitButton onChange={() => onChange("vertical")} />;
	} else if (direction === "vertical") {
		return <VerticalSplitButton onChange={() => onChange("horizontal")} />;
	}
}

export { HorizontalSplitButton, VerticalSplitButton, SplitButton, type SplitDirection, type SplitButtonProps };
