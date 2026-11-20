import { type PropsWithChildren, useEffect, useState } from "react";
import { createPortal } from "react-dom";

function NavbarSlot({
	children,
	targetId,
}: PropsWithChildren<{ targetId: string }>) {
	const [target, setTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setTarget(document.getElementById(targetId));

		return () => {
			setTarget(null);
		};
	}, [targetId]);

	return target ? createPortal(children, target) : null;
}

export function NavbarRightSlot({ children }: PropsWithChildren) {
	return <NavbarSlot targetId="navbar-page-slot-right">{children}</NavbarSlot>;
}

/** Let the current page supply a live label for its last breadcrumb. */
export function NavbarBreadcrumbSlot({ children }: PropsWithChildren) {
	return (
		<NavbarSlot targetId="navbar-page-slot-breadcrumb">{children}</NavbarSlot>
	);
}
