import {
	createContext,
	type Dispatch,
	type PropsWithChildren,
	useContext,
	useEffect,
	useReducer,
} from "react";
import type { ChatMessage, ConnectionStatus, ElementContext } from "./types";

const STORAGE_KEY = "claude-chat-messages";
const OPEN_STORAGE_KEY = "claude-chat-open";
const MAX_PERSISTED = 10;

function loadMessages(): ChatMessage[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const msgs = JSON.parse(raw) as ChatMessage[];
		return msgs
			.filter((m) => m.content)
			.map((m) => ({ ...m, isStreaming: false, toolName: undefined }))
			.slice(-MAX_PERSISTED);
	} catch {
		return [];
	}
}

function saveMessages(messages: ChatMessage[]) {
	try {
		const toSave = messages.filter((m) => m.content).slice(-MAX_PERSISTED);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
	} catch {
		// ignore quota errors
	}
}

type State = {
	isOpen: boolean;
	status: ConnectionStatus;
	messages: ChatMessage[];
	pickerActive: boolean;
	elementContext: ElementContext | null;
};

type Action =
	| { type: "toggle" }
	| { type: "close" }
	| { type: "set_status"; status: ConnectionStatus }
	| {
			type: "add_user_message";
			id: string;
			content: string;
			elementContext?: ElementContext;
	  }
	| { type: "append_chunk"; id: string; text: string }
	| { type: "set_tool_use"; id: string; tool: string }
	| { type: "mark_done"; id: string }
	| { type: "set_error"; id: string; error: string }
	| { type: "set_picker"; active: boolean }
	| { type: "set_element_context"; context: ElementContext | null };

function loadIsOpen(): boolean {
	try {
		return localStorage.getItem(OPEN_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

function createInitialState(): State {
	return {
		isOpen: loadIsOpen(),
		status: "disconnected",
		messages: loadMessages(),
		pickerActive: false,
		elementContext: null,
	};
}

const initialState: State = createInitialState();

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "toggle": {
			const isOpen = !state.isOpen;
			try {
				localStorage.setItem(OPEN_STORAGE_KEY, String(isOpen));
			} catch {}
			return { ...state, isOpen };
		}
		case "close":
			try {
				localStorage.setItem(OPEN_STORAGE_KEY, "false");
			} catch {}
			return { ...state, isOpen: false };
		case "set_status":
			return { ...state, status: action.status };
		case "add_user_message":
			return {
				...state,
				messages: [
					...state.messages,
					{
						id: action.id,
						role: "user",
						content: action.content,
						elementContext: action.elementContext,
					},
					{
						id: `${action.id}-response`,
						role: "assistant",
						content: "",
						isStreaming: true,
					},
				],
				elementContext: null,
			};
		case "append_chunk":
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === `${action.id}-response`
						? { ...m, content: m.content + action.text }
						: m,
				),
			};
		case "set_tool_use":
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === `${action.id}-response`
						? { ...m, toolName: action.tool }
						: m,
				),
			};
		case "mark_done":
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === `${action.id}-response`
						? { ...m, isStreaming: false, toolName: undefined }
						: m,
				),
			};
		case "set_error":
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === `${action.id}-response`
						? {
								...m,
								content: m.content || `Error: ${action.error}`,
								isStreaming: false,
							}
						: m,
				),
			};
		case "set_picker":
			return { ...state, pickerActive: action.active };
		case "set_element_context":
			return { ...state, elementContext: action.context };
	}
}

const ChatStateContext = createContext<State>(initialState);
const ChatDispatchContext = createContext<Dispatch<Action>>(() => {});

export function ChatProvider({ children }: PropsWithChildren) {
	const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

	useEffect(() => {
		saveMessages(state.messages);
	}, [state.messages]);

	return (
		<ChatStateContext value={state}>
			<ChatDispatchContext value={dispatch}>{children}</ChatDispatchContext>
		</ChatStateContext>
	);
}

export function useChatState() {
	return useContext(ChatStateContext);
}

export function useChatDispatch() {
	return useContext(ChatDispatchContext);
}
