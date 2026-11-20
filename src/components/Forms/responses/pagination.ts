/**
 * The page to be on once `deletedCount` rows are gone.
 *
 * Deleting rows does not shift the ones behind them onto another page: those
 * slide forward into the gap, so the page the user is on keeps its content and
 * they stay where they asked to be. Only when whole pages stop existing is there
 * anywhere to move to — and then it is to the last page that is left, which for a
 * selection inside one page is the page before it.
 */
export function pageAfterDeleting({
	currentPage,
	deletedCount,
	pageSize,
	total,
}: {
	currentPage: number;
	deletedCount: number;
	pageSize: number;
	total: number;
}) {
	const remaining = Math.max(0, total - deletedCount);
	const lastPage = Math.max(1, Math.ceil(remaining / pageSize));

	return Math.min(currentPage, lastPage);
}
