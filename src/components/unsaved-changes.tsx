import { useUnsavedChangesBlocker } from "@aidbox-ui/hooks/useUnsavedChangesBlocker";
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
import { useEffect } from "react";

/**
 * Aidbox's editor blocker driven by a dirty flag the editor derives from its
 * draft. After a successful save or delete call `allowNavigation` and navigate
 * with `ignoreBlocker: true`: the blocker reads the dirty flag only after the
 * next render, so a navigation in the same tick would still be blocked.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
	const blocker = useUnsavedChangesBlocker();
	const { setIsDirty } = blocker;
	useEffect(() => {
		setIsDirty(isDirty);
	}, [isDirty, setIsDirty]);

	return {
		...blocker,
		allowNavigation: () => setIsDirty(false),
	};
}

/** The same dialog the Aidbox editors show. */
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
					You have unsaved changes. Are you sure you want to leave this page?
					Your changes will be lost.
				</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={() => guard.reset?.()}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant="primary"
						danger
						onClick={() => {
							guard.setIsDirty(false);
							guard.proceed?.();
						}}
					>
						Leave
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
