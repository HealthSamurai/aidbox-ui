import * as HSComp from "@health-samurai/react-components";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";

type FormsTab = "forms" | "responses" | "templates";

const TAB_ROUTES = {
	forms: "/forms",
	responses: "/forms/responses",
	templates: "/forms/templates",
} as const;

/** Forms, Responses and Templates are routes; the tabs switch between them. */
export function FormsTabs({
	value,
	children,
}: {
	value: FormsTab;
	children: React.ReactNode;
}) {
	const navigate = useNavigate();
	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Tabs fill their parent by default; here they only head the grid. */}
			<HSComp.Tabs
				value={value}
				onValueChange={(next) =>
					navigate({ to: TAB_ROUTES[next as FormsTab] ?? "/forms" })
				}
				className="h-auto flex-none"
			>
				<div className="border-b w-full h-10">
					<HSComp.TabsList className="px-4">
						<HSComp.TabsTrigger value="forms" data-test-id="forms-tabs__forms">
							Forms
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger
							value="responses"
							data-test-id="forms-tabs__responses"
						>
							Responses
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger
							value="templates"
							data-test-id="forms-tabs__templates"
						>
							Templates
						</HSComp.TabsTrigger>
					</HSComp.TabsList>
				</div>
			</HSComp.Tabs>
			<div className="min-h-0 flex-1">{children}</div>
		</div>
	);
}
