import { ScrollArea } from "@health-samurai/react-components";
import { CATEGORIES, CATEGORY_ICONS } from "./constants";
import type { CategoryDef } from "./types";
import { buildSectionId, categoryKey } from "./utils";

interface SettingsSidebarProps {
	visibleCategories: Set<string>;
}

function scrollToSection(id: string) {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function SidebarItem({
	def,
	visibleCategories,
	depth,
}: {
	def: CategoryDef;
	visibleCategories: Set<string>;
	depth: number;
}) {
	const key = categoryKey(def.category);
	const hasVisibleChildren = def.subcategories?.some((sub) =>
		visibleCategories.has(categoryKey(sub.category)),
	);
	const isVisible = visibleCategories.has(key) || hasVisibleChildren;

	if (!isVisible) return null;

	const Icon = CATEGORY_ICONS[def.category[0]];
	const sectionId = buildSectionId(def.category);
	const label =
		def.category.length > 1
			? def.category[def.category.length - 1]
			: def.category[0];

	return (
		<li>
			<button
				type="button"
				onClick={() => scrollToSection(sectionId)}
				className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-secondary ${
					depth > 0
						? "pl-8 text-text-secondary"
						: "font-medium text-text-primary"
				}`}
			>
				{depth === 0 && Icon && <Icon size={16} className="shrink-0" />}
				<span className="truncate">{label}</span>
			</button>
			{def.subcategories && def.subcategories.length > 0 && (
				<ul className="mt-0.5">
					{def.subcategories.map((sub) => (
						<SidebarItem
							key={categoryKey(sub.category)}
							def={sub}
							visibleCategories={visibleCategories}
							depth={depth + 1}
						/>
					))}
				</ul>
			)}
		</li>
	);
}

export function SettingsSidebar({ visibleCategories }: SettingsSidebarProps) {
	return (
		<nav className="w-60 shrink-0 border-r border-border-primary">
			<ScrollArea className="h-full">
				<div className="p-3">
					<ul className="space-y-0.5">
						{CATEGORIES.map((def) => (
							<SidebarItem
								key={categoryKey(def.category)}
								def={def}
								visibleCategories={visibleCategories}
								depth={0}
							/>
						))}
					</ul>
				</div>
			</ScrollArea>
		</nav>
	);
}
