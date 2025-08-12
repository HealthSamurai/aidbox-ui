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
} from "@panthevm_original/react-components";
import { Link, useMatches } from "@tanstack/react-router";
import {
	BookOpenText,
	LogOut,
	MessageCircleQuestionMark,
	UserRound,
} from "lucide-react";
import React from "react";
import { useUserInfo, useLogout } from "../api/auth";
import AidboxLogo from "../assets/aidbox-logo.svg";

function Breadcrumbs() {
	const matches = useMatches();
	const breadcrumbs = matches
		.filter((match) => match.staticData?.title)
		.map((match) => ({
			title: match.staticData.title as string,
			path: match.pathname,
		}));

	if (breadcrumbs.length === 0) {
		return null;
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbs.map((crumb, index) => (
					<React.Fragment key={crumb.path}>
						{index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
						<BreadcrumbItem>
							{index === breadcrumbs.length - 1 ? (
								<BreadcrumbPage>{crumb.title}</BreadcrumbPage>
							) : (
								<BreadcrumbLink asChild>
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
		<div className="flex items-center gap-4">
			<Button
				variant="tertiary"
				size="icon"
				className="size-7 rounded-full"
				asChild
			>
				<a href="https://docs.aidbox.app" target="_blank" rel="noopener">
					<BookOpenText />
				</a>
			</Button>
			<Button
				variant="tertiary"
				size="icon"
				className="size-7 rounded-full"
				asChild
			>
				<a href="https://docs.aidbox.app" target="_blank" rel="noopener">
					<MessageCircleQuestionMark />
				</a>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="size-8 rounded-full bg-(--color-elements-assistive) text-white cursor-pointer"
					>
						<UserRound />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="p-2 mr-6">
					<div className="border-b text-center pb-4 mb-1">
						<span className="text-xs text-(--color-elements-assistive)">
							{userInfo.data?.email || userInfo.data?.id}
						</span>
						<div className="my-3 bg-(--color-elements-assistive) text-white w-fit rounded-full p-2 mx-auto">
							<UserRound size={48} />
						</div>
						<Button variant="outline" className="mx-6" asChild>
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
			<div className="h-full shrink-0 border-r flex items-center justify-center w-12">
				<img
					src={AidboxLogo}
					alt="Aidbox"
					className="h-6"
					height="24"
					width="24"
				/>
			</div>
			<div className="px-4 w-full flex items-center justify-between">
				<Breadcrumbs />
				<NavbarButtons />
			</div>
		</div>
	);
}
