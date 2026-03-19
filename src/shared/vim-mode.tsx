import * as React from "react";
import { useLocalStorage } from "../hooks";
import { VIM_MODE_KEY } from "./const";

const VimModeContext = React.createContext(false);

export function VimModeProvider({ children }: { children: React.ReactNode }) {
	const [vimMode] = useLocalStorage<boolean>({
		key: VIM_MODE_KEY,
		defaultValue: false,
		getInitialValueInEffect: false,
	});

	return (
		<VimModeContext.Provider value={vimMode}>
			{children}
		</VimModeContext.Provider>
	);
}

export function useVimMode(): boolean {
	return React.useContext(VimModeContext);
}
