import { ChevronRight } from "lucide-react";
import { useState } from "react";
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
}: {
	def: CategoryDef;
	visibleCategories: Set<string>;
}) {
	const key = categoryKey(def.category);
	const storageKey = `settings-sidebar-expanded:${key}`;
	const [expanded, setExpanded] = useState(
		() => localStorage.getItem(storageKey) === "true",
	);
	const hasSubcategories = def.subcategories && def.subcategories.length > 0;
	const hasVisibleChildren = def.subcategories?.some((sub) =>
		visibleCategories.has(categoryKey(sub.category)),
	);
	const isVisible = visibleCategories.has(key) || hasVisibleChildren;

	if (!isVisible) return null;

	const Icon = CATEGORY_ICONS[def.category[0]];
	const sectionId = buildSectionId(def.category);
	const label = def.category[0];

	return (
		<li>
			<button
				type="button"
				onClick={() => {
					if (hasSubcategories) {
						const next = !expanded;
						setExpanded(next);
						localStorage.setItem(storageKey, String(next));
					}
					scrollToSection(sectionId);
				}}
				className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-text-secondary hover:bg-bg-secondary"
			>
				{Icon && <Icon size={16} className="shrink-0" />}
				<span className="flex-1 truncate">{label}</span>
				{hasSubcategories && (
					<ChevronRight
						size={16}
						className={`shrink-0 text-text-secondary transition-transform ${
							expanded ? "rotate-90" : ""
						}`}
					/>
				)}
			</button>
			{hasSubcategories && expanded && (
				<ul className="mt-0.5">
					{def.subcategories?.map((sub) => {
						const subKey = categoryKey(sub.category);
						if (!visibleCategories.has(subKey)) return null;
						const subSectionId = buildSectionId(sub.category);
						const subLabel = sub.category[sub.category.length - 1];
						return (
							<li key={subKey}>
								<button
									type="button"
									onClick={() => scrollToSection(subSectionId)}
									className="flex w-full items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-left text-sm text-text-secondary hover:bg-bg-secondary"
								>
									<span className="truncate">{subLabel}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</li>
	);
}

export function SettingsSidebar({ visibleCategories }: SettingsSidebarProps) {
	return (
		<nav className="h-full overflow-hidden">
			<div className="h-full overflow-y-auto p-3">
				<ul className="space-y-0.5">
					{CATEGORIES.map((def) => (
						<SidebarItem
							key={categoryKey(def.category)}
							def={def}
							visibleCategories={visibleCategories}
						/>
					))}
				</ul>
			</div>
		</nav>
	);
}
