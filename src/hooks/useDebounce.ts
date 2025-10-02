import React from "react";

export const useDebounce = (
	callback: (resource: string) => void,
	delay: number,
) => {
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const callbackRef = React.useRef(callback);

	React.useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	return React.useCallback(
		(resource: string) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout(() => {
				callbackRef.current(resource);
			}, delay);
		},
		[delay],
	);
};
