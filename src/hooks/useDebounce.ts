import React from "react";

export const useDebounce = <T>(callback: (value: T) => void, delay: number) => {
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const callbackRef = React.useRef(callback);

	React.useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	return React.useCallback(
		(value: T) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout(() => {
				callbackRef.current(value);
			}, delay);
		},
		[delay],
	);
};
