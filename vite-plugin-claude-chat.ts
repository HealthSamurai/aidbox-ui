import type {
	AnyMessage,
	Client,
	RequestPermissionRequest,
	RequestPermissionResponse,
	SessionNotification,
	SessionUpdate,
	Stream,
} from "@agentclientprotocol/sdk";
import {
	AgentSideConnection,
	ClientSideConnection,
	PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";
import { ClaudeAcpAgent } from "@zed-industries/claude-agent-acp";
import type { Plugin, ViteDevServer } from "vite";

function inMemoryStream(): [Stream, Stream] {
	let controllerA: ReadableStreamDefaultController<AnyMessage>;
	let controllerB: ReadableStreamDefaultController<AnyMessage>;

	const readableA = new ReadableStream<AnyMessage>({
		start(c) { controllerA = c; },
	});
	const readableB = new ReadableStream<AnyMessage>({
		start(c) { controllerB = c; },
	});

	const writableA = new WritableStream<AnyMessage>({
		write(msg) { controllerB.enqueue(msg); },
	});
	const writableB = new WritableStream<AnyMessage>({
		write(msg) { controllerA.enqueue(msg); },
	});

	return [
		{ readable: readableA, writable: writableA },
		{ readable: readableB, writable: writableB },
	];
}

export default function claudeChat(): Plugin {
	let server: ViteDevServer;
	let clientConn: ClientSideConnection | null = null;
	let sessionId: string | null = null;
	let currentPromptId: string | null = null;

	function broadcast(event: string, data: Record<string, unknown>) {
		server.hot.send(event, data);
	}

	function handleSessionUpdate(update: SessionUpdate) {
		const id = currentPromptId;
		if (!id) return;

		switch (update.sessionUpdate) {
			case "agent_message_chunk": {
				if (update.content.type === "text") {
					broadcast("claude-chat:event", {
						type: "chunk", id, text: update.content.text,
					});
				}
				break;
			}
			case "tool_call": {
				const title = "title" in update
					? (update as Record<string, unknown>).title
					: "tool";
				broadcast("claude-chat:event", {
					type: "tool_use", id, tool: (title as string) ?? "tool",
				});
				break;
			}
			case "tool_call_update":
			case "plan":
			case "agent_thought_chunk":
			case "user_message_chunk":
				break;
		}
	}

	return {
		name: "vite-plugin-claude-chat",
		apply: "serve",

		configureServer(srv) {
			server = srv;
			const cwd = server.config.root;

			// Create in-memory bidirectional stream pair
			const [clientStream, agentStream] = inMemoryStream();

			// Client side (our Vite plugin = IDE)
			const acpClient: Client = {
				async requestPermission(
					params: RequestPermissionRequest,
				): Promise<RequestPermissionResponse> {
					const option = params.options.find(
						(o) => o.kind === "allow_always",
					) ?? params.options.find(
						(o) => o.kind === "allow_once",
					) ?? params.options[0];
					return {
						outcome: {
							outcome: "selected",
							optionId: option!.optionId,
						},
					};
				},
				async sessionUpdate(params: SessionNotification): Promise<void> {
					handleSessionUpdate(params.update);
				},
			};

			clientConn = new ClientSideConnection(() => acpClient, clientStream);

			// Agent side (Claude agent-acp)
			new AgentSideConnection(
				(conn) => new ClaudeAcpAgent(conn),
				agentStream,
			);

			// Initialize and create session
			(async () => {
				try {
					console.log("[claude-chat] Initializing ACP connection...");
					const initResult = await clientConn!.initialize({
						protocolVersion: PROTOCOL_VERSION,
						clientInfo: { name: "AidboxUI", version: "1.0.0" },
						clientCapabilities: {},
					});
					console.log(
						`[claude-chat] ACP initialized (v${initResult.protocolVersion})`,
					);

					const sessionResult = await clientConn!.newSession({
						cwd,
						mcpServers: [],
					});
					sessionId = sessionResult.sessionId;
					console.log(`[claude-chat] Session created: ${sessionId}`);
					broadcast("claude-chat:event", {
						type: "status", status: "connected",
					});
				} catch (err) {
					console.error("[claude-chat] Init error:", err);
					broadcast("claude-chat:event", {
						type: "status", status: "disconnected",
					});
				}
			})();

			server.hot.on("claude-chat:send", (data: Record<string, unknown>) => {
				const msgType = data["type"] as string;

				if (msgType === "send_message") {
					const id = data["id"] as string;
					const content = data["content"] as string;
					const contexts = data["contexts"] as
						| Record<string, unknown>[]
						| undefined;

					if (!clientConn || !sessionId) {
						broadcast("claude-chat:event", {
							type: "error", id,
							error: "Claude not ready yet.",
						});
						return;
					}

					let prompt = content;
					if (contexts && contexts.length > 0) {
						const allLines: string[] = [];
						for (let i = 0; i < contexts.length; i++) {
							const context = contexts[i];
							const rect = context["rect"] as
								| { top: number; left: number; width: number; height: number }
								| undefined;
							const lines = [
								`[UI Element ${String(i + 1)} of ${String(contexts.length)}]`,
								`Page: ${context["pageUrl"]}`,
								`Route: ${context["routePath"]}`,
								`Tag: <${context["tagName"]}>`,
								`Component: ${context["componentName"]}`,
								`Component hierarchy: ${(context["componentHierarchy"] as string[])?.join(" → ") || "unknown"}`,
								`Selector: ${context["selector"]}`,
								`Nearest landmark: ${context["nearestLandmark"]}`,
								`Text: "${context["textContent"]}"`,
								`Attributes: ${JSON.stringify(context["attributes"])}`,
							];
							if (rect) {
								lines.push(`Position: top=${String(Math.round(rect.top))} left=${String(Math.round(rect.left))} size=${String(Math.round(rect.width))}×${String(Math.round(rect.height))}`);
							}
							const props = context["props"] as
								| Record<string, unknown>
								| undefined;
							if (props && Object.keys(props).length > 0) {
								lines.push(`Props: ${JSON.stringify(props)}`);
							}
							const styles = context["computedStyles"] as
								| Record<string, string>
								| undefined;
							if (styles && Object.keys(styles).length > 0) {
								lines.push(`Computed styles: ${JSON.stringify(styles)}`);
							}
							allLines.push(lines.join("\n"));
						}
						allLines.push("", `User request: ${content}`);
						prompt = allLines.join("\n\n");
					}

					currentPromptId = id;
					clientConn
						.prompt({
							sessionId,
							prompt: [{ type: "text", text: prompt }],
						})
						.then((result) => {
							console.log(`[claude-chat] Prompt done: ${result.stopReason}`);
							broadcast("claude-chat:event", { type: "done", id });
							currentPromptId = null;
						})
						.catch((err: unknown) => {
							const msg = err instanceof Error ? err.message : String(err);
							console.error("[claude-chat] Prompt error:", msg);
							broadcast("claude-chat:event", {
								type: "error", id, error: msg,
							});
							broadcast("claude-chat:event", { type: "done", id });
							currentPromptId = null;
						});
				} else if (msgType === "abort") {
					if (clientConn && sessionId) {
						clientConn.cancel({ sessionId }).catch((e: unknown) => {
							console.error("[claude-chat] Cancel error:", e);
						});
					}
				}
			});

			server.hot.on("claude-chat:init", () => {
				broadcast("claude-chat:event", {
					type: "status",
					status: clientConn && sessionId ? "connected" : "connecting",
				});
			});
		},
	};
}
