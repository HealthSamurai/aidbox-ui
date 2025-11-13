import type * as Aidbox from "@health-samurai/aidbox-client";
import { makeClient } from "@health-samurai/aidbox-client";
import * as React from "react";

export const AidboxClientContext = React.createContext<
	Aidbox.Client | undefined
>(undefined);

export type AidboxClientProviderProps = {
	baseurl: string;
	children: React.ReactNode;
};

export function AidboxClientProvider({
	baseurl,
	children,
}: AidboxClientProviderProps): React.JSX.Element {
	const client = makeClient({ baseurl });

	return (
		<AidboxClientContext.Provider value={client}>
			{children}
		</AidboxClientContext.Provider>
	);
}

export function useAidboxClient(aidboxClient?: Aidbox.Client): Aidbox.Client {
	const client = React.useContext(AidboxClientContext);

	if (aidboxClient) return aidboxClient;

	if (!client)
		throw new Error("No AidboxClient set, use AidboxClientProvider to set one");

	return client;
}
