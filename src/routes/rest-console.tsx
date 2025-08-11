import { Button, Label, Textarea } from "@panthevm_original/react-components";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/rest-console")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <div className="h-full"></div>;
}
