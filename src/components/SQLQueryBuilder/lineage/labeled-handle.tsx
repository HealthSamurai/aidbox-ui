import { Handle, type HandleProps, Position } from "@xyflow/react";

type Props = HandleProps & {
	title: string;
	labelClassName?: string;
};

export function LabeledHandle({
	title,
	labelClassName,
	position,
	className,
	...rest
}: Props) {
	const isLeft = position === Position.Left;
	return (
		<div
			className={`relative flex items-center ${isLeft ? "justify-start" : "justify-end"}`}
		>
			<Handle
				position={position}
				className={`${isLeft ? "left-0!" : "right-0!"} w-2 h-2 ${className ?? ""}`}
				{...rest}
			/>
			<span className={`font-mono text-xs ${labelClassName ?? ""}`}>
				{title}
			</span>
		</div>
	);
}
