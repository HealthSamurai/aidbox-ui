import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	Switch,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Link, useMatches } from "@tanstack/react-router";
import {
	BookOpenText,
	ImagePlus,
	LogOut,
	MessageCircleQuestionMark,
	Moon,
	Terminal,
	UserRound,
} from "lucide-react";
import React, { lazy, Suspense, useEffect } from "react";
import { useInstanceName, useLogout, useUserInfo } from "../api/auth";
import AidboxLogo from "../assets/aidbox-logo.svg";
import { useLocalStorage } from "../hooks/useLocalStorage";

const ClaudeChatToggle = import.meta.env.DEV
	? lazy(() => import("../components/claude-chat/claude-chat-toggle"))
	: () => null;

import { PREFERRED_UI_KEY, THEME_KEY, VIM_MODE_KEY } from "../shared/const";
import { getAidboxBaseURL } from "../utils";

function Breadcrumbs() {
	const matches = useMatches();
	const { data: instanceName } = useInstanceName();
	if (matches.length === 0) return <div>No router matches</div>;

	const breadcrumbs = [
		...(instanceName ? [{ title: instanceName, path: "/" }] : []),
		...matches.flatMap((match) => {
			const breadCrumb = match.loaderData?.breadCrumb;
			return breadCrumb ? [{ title: breadCrumb, path: match.pathname }] : [];
		}),
	];

	if (breadcrumbs.length === 0) {
		console.warn("Breadcrumb ommited!");
		return null;
	}

	return (
		<Breadcrumb className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				{breadcrumbs.map((crumb, index) => (
					<React.Fragment key={`${crumb.path}-${index}`}>
						{index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
						<BreadcrumbItem
							className={
								index === breadcrumbs.length - 1 ? "min-w-0" : "shrink-0"
							}
						>
							{index === breadcrumbs.length - 1 ? (
								<BreadcrumbPage className="truncate">
									{crumb.title}
								</BreadcrumbPage>
							) : (
								<BreadcrumbLink className="px-3" asChild>
									<Link to={crumb.path}>{crumb.title}</Link>
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
					</React.Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

function NavbarButtons() {
	const userInfo = useUserInfo();
	const logout = useLogout();
	const [theme, setTheme] = useLocalStorage<"light" | "dark">({
		key: THEME_KEY,
		defaultValue: "light",
	});
	const [vimMode, setVimMode] = useLocalStorage<boolean>({
		key: VIM_MODE_KEY,
		defaultValue: false,
	});

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	return (
		<div className="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						className="rounded-full p-2"
						onClick={() => {
							localStorage.setItem(PREFERRED_UI_KEY, "old");
							window.location.href = getAidboxBaseURL();
						}}
					>
						<ImagePlus />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">Switch to old UI</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" className="rounded-full p-2" asChild>
						<a
							href="https://health-samurai.io/docs/aidbox"
							target="_blank"
							rel="noopener"
						>
							<BookOpenText />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom"> Documentation </TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" className="rounded-full p-2" asChild>
						<a
							href="https://connect.health-samurai.io"
							target="_blank"
							rel="noopener"
						>
							<MessageCircleQuestionMark />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="t-40">
					{" "}
					Community{" "}
				</TooltipContent>
			</Tooltip>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="rounded-full h-7 w-7 bg-(--color-elements-assistive) flex items-center justify-center text-white hover:opacity-50 cursor-pointer"
					>
						<UserRound size={16} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="p-2 mr-6">
					<div className="border-b text-center pb-4 mb-1">
						<span className="text-xs text-(--color-elements-assistive)">
							{userInfo.data?.email || userInfo.data?.id}
						</span>
						<div className="my-3 bg-(--color-elements-assistive) text-white w-fit rounded-full p-2 mx-auto">
							<UserRound size={48} />
						</div>
						<Button variant="ghost" className="mx-6" asChild>
							<a href="https://aidbox.app" target="_blank" rel="noopener">
								Manage your account
							</a>
						</Button>
					</div>
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b mb-1">
						<div className="flex items-center gap-2">
							<Moon size={16} />
							<label
								htmlFor="dark-mode-toggle"
								className="text-sm cursor-pointer"
							>
								Dark mode
							</label>
						</div>
						<Switch
							id="dark-mode-toggle"
							size="small"
							checked={theme === "dark"}
							onCheckedChange={(checked) =>
								setTheme(checked ? "dark" : "light")
							}
						/>
					</div>
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b mb-1">
						<div className="flex items-center gap-2">
							<Terminal size={16} />
							<label
								htmlFor="vim-mode-toggle"
								className="text-sm cursor-pointer"
							>
								Vim mode
							</label>
						</div>
						<Switch
							id="vim-mode-toggle"
							size="small"
							checked={vimMode === true}
							onCheckedChange={(checked) => setVimMode(checked)}
						/>
					</div>
					<Button
						variant="ghost"
						className="w-full justify-start"
						onClick={() => logout.mutate()}
					>
						<LogOut />
						Sign out
					</Button>
				</DropdownMenuContent>
			</DropdownMenu>
			{import.meta.env.DEV && (
				<Suspense>
					<ClaudeChatToggle />
				</Suspense>
			)}
		</div>
	);
}

export function Navbar() {
	return (
		<div className="flex-none h-15 flex items-center border-b bg-bg-primary">
			<Link
				to="/"
				className="h-full shrink-0 border-r flex items-center justify-center w-[3.125rem] box-content hover:bg-bg-secondary transition-colors"
			>
				<img
					src={AidboxLogo}
					alt="Aidbox"
					className="h-6"
					height="24"
					width="24"
				/>
			</Link>
			<div className="pl-4 pr-4 w-full flex items-center">
				<Breadcrumbs />
				<div
					id="navbar-page-slot"
					className="flex-1 flex items-center justify-center"
				/>
				<div id="navbar-page-slot-right" className="flex items-center" />
				<NavbarButtons />
			</div>
		</div>
	);
}
