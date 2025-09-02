import {
	Tabs,
	TabsAddButton,
	TabsList,
	TabsTrigger,
	Button,
	Popover,
	PopoverTrigger,
	PopoverContent,
	Command,
	CommandInput,
	CommandList,
	CommandItem,
	CommandEmpty,
} from "@health-samurai/react-components";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";



export type TabId = string;

export type Header = {
	id: string;
	name: string;
	value: string;
	enabled?: boolean;
};

export interface Tab {
	id: TabId;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path?: string;
	body?: string;
	selected?: boolean;
	headers?: Header[];
	params?: Header[];
	name?: string;
	activeSubTab?: "params" | "headers" | "body" | "raw";
}

export const DEFAULT_TAB_ID: TabId = "active-tab-example";

export const DEFAULT_TAB: Tab = {
	id: DEFAULT_TAB_ID,
	method: "GET",
	name: "New request",
	selected: true,
	activeSubTab: "body",
	headers: [
		{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
		{ id: "2", name: "Accept", value: "application/json", enabled: true },
		{ id: "3", name: "", value: "", enabled: true },
	],
	params: [{ id: "1", name: "", value: "", enabled: true }],
};

function addTab(tabs: Tab[], setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	const newTab: Tab = {
		...DEFAULT_TAB,
		id: crypto.randomUUID(),
	};
	setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
}

function removeTab(tabs: Tab[], tabId: TabId, setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	const newTabs = tabs.filter((tab) => tab.id !== tabId);
	if (newTabs.length === 0) {
		setTabs([DEFAULT_TAB]);
	} else {
		const hasSelected = newTabs.some((tab) => tab.selected);
		let updatedTabs = newTabs;
		if (!hasSelected && newTabs.length > 0) {
			// Find the index of the removed tab in the original array
			const removedTabIndex = tabs.findIndex((tab) => tab.id === tabId);
			// Select the previous tab, or the first tab if removing the first one
			const targetIndex = removedTabIndex > 0 ? removedTabIndex - 1 : 0;
			// Make sure we don't go out of bounds in the new array
			const safeIndex = Math.min(targetIndex, newTabs.length - 1);
			
			updatedTabs = newTabs.map((tab, idx) =>
				idx === safeIndex ? { ...tab, selected: true } : { ...tab, selected: false },
			);
		}
		setTabs(updatedTabs);
	}
}

function onTabSelect(tabId: TabId, tabs: Tab[], setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void) {
	setTabs(tabs.map((t) => ({ ...t, selected: t.id === tabId })));
}



// Стили
const scrollButtonStyles = "h-10 px-2 border-b border-border-primary bg-bg-secondary flex items-center justify-center";
const tabsMenuButtonStyles = "h-10 px-2 border-b border-l border-border-primary bg-bg-secondary flex items-center justify-center";

const methodColors = {
	GET: "text-utility-green",
	POST: "text-utility-yellow",
	PUT: "text-utility-blue",
	PATCH: "text-utility-violet",
	DELETE: "text-utility-red",
};

export function ActiveTabs({
	tabs,
	setTabs,
}: {
	tabs: Tab[];
	setTabs: (val: Tab[] | ((prev: Tab[]) => Tab[])) => void;
}) {
	const selectedTab = tabs.find((tab) => tab.selected)?.id || DEFAULT_TAB_ID;
	const tabsListRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const handleCloseTab = (tabId: TabId) => {
		removeTab(tabs, tabId, setTabs);
	};
	
	const handleTabSelect = (tabId: TabId) => {
		onTabSelect(tabId, tabs, setTabs);
	};

	// Проверяем возможность скролла используя существующую логику overflow-x-auto
	const checkScrollButtons = () => {
		if (!tabsListRef.current) return;
		
		const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current;
		setCanScrollLeft(scrollLeft > 0);
		setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
	};

	const scrollTabs = (direction: 'left' | 'right') => {
		if (!tabsListRef.current) return;
		
		const scrollAmount = 200;
		const newScrollLeft = direction === 'left' 
			? tabsListRef.current.scrollLeft - scrollAmount
			: tabsListRef.current.scrollLeft + scrollAmount;
			
		tabsListRef.current.scrollTo({
			left: newScrollLeft,
			behavior: 'smooth'
		});
	};

	useEffect(() => {
		checkScrollButtons();
		const handleResize = () => checkScrollButtons();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [tabs]);

	useEffect(() => {
		if (!tabsListRef.current) return;
		
		const handleScroll = () => checkScrollButtons();
		tabsListRef.current.addEventListener('scroll', handleScroll);
		return () => tabsListRef.current?.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<div className="flex items-center w-full">
			{/* Левая стрелка скролла */}
			{canScrollLeft && (
				<Button
					variant="ghost"
					size="small"
					className={scrollButtonStyles}
					onClick={() => scrollTabs('left')}
				>
					<ChevronLeftIcon className="size-4" />
				</Button>
			)}
			
			{/* Основной компонент Tabs с существующей логикой скролла */}
			<div className="flex-1 min-w-0">
				<Tabs variant="browser" value={selectedTab}>
					<TabsList 
						ref={tabsListRef}
						onScroll={checkScrollButtons}
						className="scrollbar-hide"
					>
						{tabs.map((tab) => (
							<TabsTrigger
								key={tab.id}
								value={tab.id}
								{...(tabs.length > 1 && { onClose: () => handleCloseTab(tab.id) })}
								onClick={() => handleTabSelect(tab.id)}
							>
								<span className="flex items-center gap-1 truncate">
									<span className={methodColors[tab.method]}>{tab.method}</span>
									<span>{tab.path || tab.name}</span>
								</span>
							</TabsTrigger>
						))}
					</TabsList>
					{/* Кнопка + липнет к табам, но отступает от кнопки меню при максимальном размере */}
					<TabsAddButton onClick={() => addTab(tabs, setTabs)} />
				</Tabs>
			</div>
			
			{/* Правая стрелка скролла */}
			{canScrollRight && (
				<Button
					variant="ghost"
					size="small"
					className={scrollButtonStyles}
					onClick={() => scrollTabs('right')}
				>
					<ChevronRightIcon className="size-4" />
				</Button>
			)}
			
			{/* Кнопка меню табов - всегда прикреплена к правому краю */}
			<Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="small"
						className={tabsMenuButtonStyles}
					>
						<ChevronDownIcon className="size-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-80 p-0" align="end">
					<Command>
						<CommandInput placeholder="Поиск табов..." />
						<CommandList>
							<CommandEmpty>Табы не найдены.</CommandEmpty>
							{tabs.map((tab) => (
								<CommandItem
									key={tab.id}
									value={`${tab.method} ${tab.path || tab.name}`}
									onSelect={() => {
										handleTabSelect(tab.id);
										setIsMenuOpen(false);
									}}
									className="group flex items-center justify-between"
								>
									<div className="flex items-center gap-2 flex-1 truncate">
										<span className={methodColors[tab.method]}>{tab.method}</span>
										<span className="truncate">{tab.path || tab.name}</span>
									</div>
									{tabs.length > 1 && (
										<Button
											variant="ghost"
											size="small"
											className="opacity-0 group-hover:opacity-100 transition-opacity p-1 ml-2"
											onClick={(e) => {
												e.stopPropagation();
												handleCloseTab(tab.id);
											}}
										>
											<X className="size-3" />
										</Button>
									)}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
