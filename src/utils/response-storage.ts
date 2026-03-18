import type { ResponseData } from "../components/rest/active-tabs";

type Listener = () => void;

export type ResponseStorage = {
	subscribe: (listener: Listener) => () => void;
	getSnapshot: () => Map<string, ResponseData>;
	set: (tabId: string, response: ResponseData) => void;
	delete: (tabId: string) => void;
};

function createResponseStorage(): ResponseStorage {
	let snapshot = new Map<string, ResponseData>();
	const listeners = new Set<Listener>();

	const emitChange = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		subscribe: (listener: Listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		getSnapshot: () => snapshot,

		set: (tabId: string, response: ResponseData) => {
			const next = new Map(snapshot);
			next.set(tabId, response);
			snapshot = next;
			emitChange();
		},

		delete: (tabId: string) => {
			const next = new Map(snapshot);
			next.delete(tabId);
			snapshot = next;
			emitChange();
		},
	};
}

// Singleton instance
export const responseStorage = createResponseStorage();
