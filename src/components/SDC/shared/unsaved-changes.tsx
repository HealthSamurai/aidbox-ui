import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@health-samurai/react-components";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

/** Local adaptation of Aidbox's editor guard; successful writes may navigate immediately. */
export function useUnsavedChangesGuard(isDirty: boolean) {
	const savedNavigation = useRef(false);
	useEffect(() => {
		if (!isDirty) savedNavigation.current = false;
	}, [isDirty]);
	const blocker = useBlocker({
		shouldBlockFn: ({ current, next }) =>
			isDirty && !savedNavigation.current && current.pathname !== next.pathname,
		enableBeforeUnload: () => isDirty && !savedNavigation.current,
		withResolver: true,
	});

	return {
		...blocker,
		allowNavigation: () => {
			savedNavigation.current = true;
		},
	};
}

export function UnsavedChangesDialog({
	guard,
}: {
	guard: ReturnType<typeof useUnsavedChangesGuard>;
}) {
	return (
		<AlertDialog
			open={guard.status === "blocked"}
			onOpenChange={(open) => {
				if (!open) guard.reset?.();
			}}
		>
			<AlertDialogContent data-test-id="unsaved-changes-dialog">
				<AlertDialogHeader>
					<AlertDialogTitle>Unsaved changes</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription>
					You have unsaved changes. Leave this page and discard them?
				</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={() => guard.reset?.()}>
						Keep editing
					</AlertDialogCancel>
					<AlertDialogAction danger onClick={() => guard.proceed?.()}>
						Discard changes
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
