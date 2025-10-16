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
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import type { FileRoutesByPath } from "@tanstack/react-router";
import * as RR from "@tanstack/react-router";
import { Link, useMatches } from "@tanstack/react-router";
import {
	BookOpenText,
	LogOut,
	MessageCircleQuestionMark,
	UserRound,
} from "lucide-react";
import React from "react";
import { useLogout, useUserInfo } from "../api/auth";
import AidboxLogo from "../assets/aidbox-logo.svg";

type PathItem = {
	title: string;
	path: string;
};

type MyRoutingMatch = {
	params: any;
	staticData: { title?: string };
	pathname: string;
};

const omitGeneration = (_rm: MyRoutingMatch) => [];
const staticTitleGen = (rm: MyRoutingMatch) => {
	if (!rm.staticData.title) return [];
	return [
		{
			title: rm.staticData.title,
			path: rm.pathname,
		},
	];
};

type FileRoutesIds = keyof FileRoutesByPath;

const breadcrumbGenerators: Record<
	FileRoutesIds | "__root__",
	(rm: MyRoutingMatch) => PathItem[]
> = {
	__root__: omitGeneration,
	"/": omitGeneration,
	"/rest": staticTitleGen,
	"/resource": staticTitleGen,
	"/resource/": staticTitleGen,
	"/resource/create/$resourceType": staticTitleGen,
	"/resource/list/$resourceType/": (rm: MyRoutingMatch) => [
		{ title: rm.params.resourceType, path: rm.pathname },
	],
	"/resource/edit/$resourceType/$id": staticTitleGen,
};

function Breadcrumbs() {
	const matches = useMatches();
	if (matches.length === 0) return <div>No router matches</div>;

	const breadcrumbs = matches.flatMap((match) => {
		console.log("generate breadcrumb for", match.routeId);
		return breadcrumbGenerators[match.routeId](match);
	});

	if (breadcrumbs.length === 0) {
		console.warn("Breadcrumb ommited!");
		return null;
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbs.map((crumb, index) => (
					<React.Fragment key={`${crumb.path}-${index}`}>
						{index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
						<BreadcrumbItem>
							{index === breadcrumbs.length - 1 ? (
								<BreadcrumbPage>{crumb.title}</BreadcrumbPage>
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

	return (
		<div className="flex items-center gap-2">
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
		</div>
	);
}

export function Navbar() {
	return (
		<div className="flex-none h-15 flex items-center border-b">
			<div className="h-full shrink-0 border-r flex items-center justify-center w-[3.125rem] box-content">
				<img
					src={AidboxLogo}
					alt="Aidbox"
					className="h-6"
					height="24"
					width="24"
				/>
			</div>
			<div className="pl-4 pr-4 w-full flex items-center justify-between">
				<Breadcrumbs />
				<NavbarButtons />
			</div>
		</div>
	);
}
