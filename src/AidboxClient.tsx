import type * as Aidbox from "@health-samurai/aidbox-client";
import {
	AidboxClient,
	BrowserAuthProvider,
} from "@health-samurai/aidbox-client";
import * as React from "react";
import type {
	Bundle,
	OperationOutcome,
	Resource,
} from "./fhir-types/hl7-fhir-r5-core";

// FIXME: sansara#6557 Generate from IG
export type User = Resource & {
	email?: string;
};

export type AidboxClientR5 = Aidbox.AidboxClient<
	Bundle,
	OperationOutcome,
	User
>;

export const AidboxClientContext = React.createContext<
	AidboxClientR5 | undefined
>(undefined);

export type AidboxClientProviderProps = {
	baseurl: string;
	children: React.ReactNode;
};

export function AidboxClientProvider({
	baseurl,
	children,
}: AidboxClientProviderProps): React.JSX.Element {
	const client = new AidboxClient<Bundle, OperationOutcome, User>(
		baseurl,
		new BrowserAuthProvider(baseurl),
	);

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
