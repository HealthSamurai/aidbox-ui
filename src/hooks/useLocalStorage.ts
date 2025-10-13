/* eslint-disable no-console */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowEvent } from "./useWindowEvent";

export type StorageType = "localStorage" | "sessionStorage";

export interface UseStorageOptions<T> {
	/** Storage key */
	key: string;

	/** Default value that will be set if value is not found in storage */
	defaultValue?: T;

	/** If set to true, value will be updated in useEffect after mount. Default value is true. */
	getInitialValueInEffect?: boolean;

	/** Determines whether the value must be synced between browser tabs, `true` by default */
	sync?: boolean;

	/** Function to serialize value into string to be save in storage */
	serialize?: (value: T) => string;

	/** Function to deserialize string value from storage to value */
	deserialize?: (value: string | undefined) => T;
}

function serializeJSON<T>(value: T, hookName: string = "use-local-storage") {
	try {
		return JSON.stringify(value);
	} catch (_error) {
		throw new Error(`${hookName}: Failed to serialize the value`);
	}
}

function deserializeJSON(value: string | undefined) {
	try {
		return value && JSON.parse(value);
	} catch {
		return value;
	}
}

function createStorageHandler(type: StorageType) {
	const getItem = (key: string) => {
		try {
			return window[type].getItem(key);
		} catch (_error) {
			console.warn("use-local-storage: Failed to get value from storage, localStorage is blocked");
			return null;
		}
	};

	const setItem = (key: string, value: string) => {
		try {
			window[type].setItem(key, value);
		} catch (_error) {
			console.warn("use-local-storage: Failed to set value to storage, localStorage is blocked");
		}
	};

	const removeItem = (key: string) => {
		try {
			window[type].removeItem(key);
		} catch (_error) {
			console.warn("use-local-storage: Failed to remove value from storage, localStorage is blocked");
		}
	};

	return { getItem, setItem, removeItem };
}

export type UseStorageReturnValue<T> = [
	T, // current value
	(val: T | ((prevState: T) => T)) => void, // callback to set value in storage
	() => void, // callback to remove value from storage
];

export function createStorage<T>(type: StorageType, hookName: string) {
	const eventName = type === "localStorage" ? "local-storage" : "session-storage";
	const { getItem, setItem, removeItem } = createStorageHandler(type);

	return function useStorage({
		key,
		defaultValue,
		getInitialValueInEffect = true,
		sync = true,
		deserialize = deserializeJSON,
		serialize,
	}: UseStorageOptions<T>): UseStorageReturnValue<T> {
		const serializeFn = useCallback(
			(value: T) => {
				if (serialize) {
					return serialize(value);
				} else {
					return serializeJSON(value, hookName);
				}
			},
			[serialize, hookName],
		);

		const defaultValueRef = useRef(defaultValue);
		defaultValueRef.current = defaultValue;

		const readStorageValue = useCallback(
			(skipStorage?: boolean): T => {
				let storageBlockedOrSkipped: boolean;

				try {
					storageBlockedOrSkipped =
						typeof window === "undefined" || !(type in window) || window[type] === null || !!skipStorage;
				} catch (_e) {
					storageBlockedOrSkipped = true;
				}

				if (storageBlockedOrSkipped) {
					return defaultValueRef.current as T;
				}

				const storageValue = getItem(key);
				return storageValue !== null ? deserialize(storageValue) : (defaultValueRef.current as T);
			},
			[key, deserialize, type],
		);

		const [value, setValue] = useState<T>(() => {
			return readStorageValue(getInitialValueInEffect);
		});

		const setStorageValue = useCallback(
			(val: T | ((prevState: T) => T)) => {
				if (val instanceof Function) {
					setValue((current) => {
						const result = val(current);
						setItem(key, serializeFn(result));

						queueMicrotask(() => {
							window.dispatchEvent(
								new CustomEvent(eventName, {
									detail: { key, value: val(current) },
								}),
							);
						});
						return result;
					});
				} else {
					setItem(key, serializeFn(val));
					window.dispatchEvent(new CustomEvent(eventName, { detail: { key, value: val } }));
					setValue(val);
				}
			},
			[key, serializeFn],
		);

		const removeStorageValue = useCallback(() => {
			removeItem(key);
			window.dispatchEvent(
				new CustomEvent(eventName, {
					detail: { key, value: defaultValueRef.current },
				}),
			);
		}, [key]);

		useWindowEvent("storage", (event) => {
			if (sync) {
				if (event.storageArea === window[type] && event.key === key) {
					setValue(deserialize(event.newValue ?? undefined));
				}
			}
		});

		useWindowEvent(eventName, (event: CustomEventInit<{ key: string; value: T }>) => {
			if (sync) {
				if (event?.detail?.key === key) {
					setValue(event.detail.value);
				}
			}
		});

		// biome-ignore lint/correctness/useExhaustiveDependencies: we no need readStorageValue in deps
		useEffect(() => {
			if (getInitialValueInEffect) {
				const val = readStorageValue();
				if (val !== undefined) {
					setValue(val);
				}
			}
		}, [getInitialValueInEffect]);

		// Handle setting default value when value is undefined
		useEffect(() => {
			if (defaultValueRef.current !== undefined && value === undefined) {
				setValue(defaultValueRef.current);
				setItem(key, serializeFn(defaultValueRef.current));
			}
		}, [key, serializeFn, value]);

		return [value === undefined ? (defaultValueRef.current as T) : value, setStorageValue, removeStorageValue];
	};
}

export function readValue(type: StorageType) {
	const { getItem } = createStorageHandler(type);

	return function read<T>({ key, defaultValue, deserialize = deserializeJSON }: UseStorageOptions<T>) {
		let storageBlockedOrSkipped: boolean;

		try {
			storageBlockedOrSkipped = typeof window === "undefined" || !(type in window) || window[type] === null;
		} catch (_e) {
			storageBlockedOrSkipped = true;
		}

		if (storageBlockedOrSkipped) {
			return defaultValue as T;
		}

		const storageValue = getItem(key);
		return storageValue !== null ? deserialize(storageValue) : (defaultValue as T);
	};
}

export function useLocalStorage<T = string>(props: UseStorageOptions<T>) {
	return createStorage<T>("localStorage", "use-local-storage")(props);
}

export const readLocalStorageValue = readValue("localStorage");
