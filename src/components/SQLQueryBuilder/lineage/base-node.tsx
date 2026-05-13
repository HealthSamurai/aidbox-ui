import type * as React from "react";

export function BaseNode({
	children,
	className,
	selected,
}: {
	children: React.ReactNode;
	className?: string;
	selected?: boolean;
}) {
	return (
		<div
			className={`rounded-md bg-bg-primary border ${
				selected ? "border-border-link" : "border-border-primary"
			} shadow-sm overflow-hidden min-w-[240px] w-[440px] ${className ?? ""}`}
		>
			{children}
		</div>
	);
}

export function BaseNodeHeader({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`flex flex-col gap-2 px-3 py-2 border-b border-border-primary bg-bg-secondary ${className ?? ""}`}
		>
			{children}
		</div>
	);
}

export function BaseNodeBody({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={`flex flex-col ${className ?? ""}`}>{children}</div>;
}

export function BaseNodeRow({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`grid grid-cols-2 items-center px-3 py-1 border-b border-border-primary last:border-b-0 ${className ?? ""}`}
		>
			{children}
		</div>
	);
}
