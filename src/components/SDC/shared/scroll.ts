/**
 * The app's thin scrollbar, for a list that already scrolls by itself -- cmdk's
 * `CommandList` inside a combobox, for instance.
 *
 * Select menus do not need this. They go through `AppSelectContent`
 * (`src/shared/select.tsx`), which carries their scrolling with them.
 */
export const SCROLL_LIST_CLASS_NAME =
	"max-h-64 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]";
