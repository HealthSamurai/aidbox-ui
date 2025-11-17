import type * as Aidbox from "@health-samurai/aidbox-client";
import { makeClient } from "@health-samurai/aidbox-client";
import { redirect } from "@tanstack/react-router";
import * as React from "react";
import type { Bundle, OperationOutcome } from "./fhir-types/hl7-fhir-r5-core";

export type AidboxClientR5 = Aidbox.AidboxClient<Bundle, OperationOutcome>;

export const AidboxClientContext = React.createContext<
	AidboxClientR5 | undefined
>(undefined);

export type AidboxClientProviderProps = {
	baseurl: string;
	children: React.ReactNode;
};

function makeAuthHandler(baseurl: string) {
	return (response: Aidbox.AidboxRawResponse) => {
		if (response.response.status === 401 || response.response.status === 403) {
			const encodedLocation = btoa(window.location.href);
			const redirectTo = `${baseurl}/auth/login?redirect_to=${encodedLocation}`;
			window.location.href = redirectTo;
			// FIXME: doesn't work without window.location.href
			throw redirect({ href: redirectTo });
		}
		return response;
	};
}

export function AidboxClientProvider({
	baseurl,
	children,
}: AidboxClientProviderProps): React.JSX.Element {
	const client = makeClient<Bundle, OperationOutcome>({
		baseurl,
		onRawResponseHook: makeAuthHandler(baseurl),
	});

	return (
		<AidboxClientContext.Provider value={client}>
			{children}
		</AidboxClientContext.Provider>
	);
}

export function useAidboxClient(aidboxClient?: AidboxClientR5): AidboxClientR5 {
	const client = React.useContext(AidboxClientContext);

	if (aidboxClient) return aidboxClient;

	if (!client)
		throw new Error("No AidboxClient set, use AidboxClientProvider to set one");

	return client;
}
