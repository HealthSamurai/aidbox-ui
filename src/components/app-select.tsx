import {
	cn,
	SelectContent,
	SelectItem,
} from "@health-samurai/react-components";
import type { ComponentProps } from "react";

/**
 * The kit builds `SelectContent` the way Radix ships it: the viewport does not
 * scroll on its own and two chevron buttons at the ends nudge it while the
 * pointer rests on them, so a long menu has no scrollbar and is a chore to get
 * through. `use-form-select-content` (see `src/index.css`) hides those buttons
 * and turns the viewport into an ordinary scroll area with a thin scrollbar.
 *
 * Popper menus size to their content, with a trigger/menu minimum and an
 * available-space maximum. Callers can set width through className or style.
 * Keep these compatibility rules here until the kit provides them;
 * page layouts should not depend on the kit's internal viewport markup.
 * Upstream fix: https://github.com/HealthSamurai/aidbox-ts-sdk/pull/169
 */
export function AppSelectContent({
	className,
	position = "popper",
	...props
}: ComponentProps<typeof SelectContent>) {
	return (
		<SelectContent
			position={position}
			className={cn(
				"use-form-select-content",
				position === "popper" &&
					"max-w-[var(--radix-select-content-available-width)] [&>[data-radix-select-viewport]]:min-w-0",
				position === "popper" &&
					"min-w-[min(max(8rem,var(--radix-select-trigger-width)),var(--radix-select-content-available-width))]",
				className,
			)}
			{...props}
		/>
	);
}

/** Keep option labels and selected values on one line. */
export function AppSelectItem({
	className,
	children,
	...props
}: ComponentProps<typeof SelectItem>) {
	const label =
		typeof children === "string" || typeof children === "number"
			? String(children)
			: undefined;
	return (
		<SelectItem
			className={cn(
				"[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1",
				className,
			)}
			{...props}
		>
			{label === undefined ? (
				children
			) : (
				<span className="min-w-0 truncate" title={props.title ?? label}>
					{children}
				</span>
			)}
		</SelectItem>
	);
}
