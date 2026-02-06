import type { ResponseData } from "../components/rest/active-tabs";

const DB_NAME = "aidbox-rest-console";
const DB_VERSION = 1;
const STORE_NAME = "responses";

type Listener = () => void;

export type ResponseStorage = {
	subscribe: (listener: Listener) => () => void;
	getSnapshot: () => Map<string, ResponseData>;
	set: (tabId: string, response: ResponseData) => void;
	delete: (tabId: string) => void;
};

function createResponseStorage(): ResponseStorage {
	let db: IDBDatabase | undefined;
	let dbErrorReported = false;
	let snapshot = new Map<string, ResponseData>();
	const listeners = new Set<Listener>();

	const emitChange = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	const reportDbUnavailable = (msg?: string) => {
		if (dbErrorReported === false) {
			console.error(msg ?? "IndexedDB unavailable for response storage");
			dbErrorReported = true;
		}
	};

	const loadAll = () => {
		if (db === undefined) return;

		const transaction = db.transaction(STORE_NAME, "readonly");
		const objectStore = transaction.objectStore(STORE_NAME);
		const request = objectStore.openCursor();
		const results = new Map<string, ResponseData>();

		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				results.set(cursor.key as string, cursor.value as ResponseData);
				cursor.continue();
			} else {
				snapshot = results;
				emitChange();
			}
		};

		request.onerror = (ev) => {
			console.error("Failed to load responses from IndexedDB:", ev);
		};
	};

	const req = self.indexedDB.open(DB_NAME, DB_VERSION);

	req.onerror = (ev) => {
		console.error(ev);
		console.error(
			"Could not open IndexedDB database for response storage. Responses will not persist.",
		);
		db = undefined;
	};

	req.onsuccess = () => {
		const resDb = req.result;
		db = resDb;

		resDb.onversionchange = () => {
			console.log("DB version changed. Closing the database.");
			resDb.close();
			db = undefined;
		};

		loadAll();
	};

	req.onupgradeneeded = () => {
		const resDb = req.result;
		try {
			resDb.deleteObjectStore(STORE_NAME);
		} catch {
			// Store doesn't exist yet, which is fine
		}
		resDb.createObjectStore(STORE_NAME);
		db = resDb;
	};

	req.onblocked = (ev) => {
		console.error(ev);
		console.log("DB is blocked");
		db = undefined;
	};

	const persistSet = (tabId: string, response: ResponseData) => {
		if (db === undefined) {
			reportDbUnavailable();
			return;
		}

		const transaction = db.transaction(STORE_NAME, "readwrite");
		const objectStore = transaction.objectStore(STORE_NAME);
		const request = objectStore.put(response, tabId);

		request.onerror = (ev) => {
			console.error("Could not save response to IndexedDB:", ev);
		};
	};

	const persistDelete = (tabId: string) => {
		if (db === undefined) return;

		const transaction = db.transaction(STORE_NAME, "readwrite");
		const objectStore = transaction.objectStore(STORE_NAME);
		const request = objectStore.delete(tabId);

		request.onerror = (ev) => {
			console.error("Could not delete response from IndexedDB:", ev);
		};
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
			persistSet(tabId, response);
		},

		delete: (tabId: string) => {
			const next = new Map(snapshot);
			next.delete(tabId);
			snapshot = next;
			emitChange();
			persistDelete(tabId);
		},
	};
}

// Singleton instance, eagerly created
export const responseStorage = createResponseStorage();
