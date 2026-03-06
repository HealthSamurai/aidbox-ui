import type { RefObject } from "react";
import { useEffect } from "react";
import type { ViewDefinitionBuilderActions } from "./view-definition-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"vd_get_view_definition",
	"vd_set_view_definition",
	"vd_get_resource_type",
	"vd_set_resource_type",
	"vd_run",
	"vd_save",
	"vd_materialize",
	"vd_delete",
	"vd_get_run_results",
	"vd_get_run_error",
	"vd_get_status",
	"vd_switch_builder_tab",
	"vd_get_builder_tab",
	"vd_toggle_instances_panel",
	"vd_get_instances_panel_open",
	"vd_instances_search",
	"vd_instances_get_current",
	"vd_instances_get_count",
	"vd_instances_get_index",
	"vd_instances_next",
	"vd_instances_previous",
	"vd_instances_go_to_index",
	"vd_get_form_tree",
	"vd_set_name",
	"vd_set_status",
	"vd_add_constant",
	"vd_update_constant",
	"vd_remove_constant",
	"vd_add_where",
	"vd_update_where",
	"vd_remove_where",
	"vd_add_select",
	"vd_remove_select",
	"vd_update_select_expression",
	"vd_add_column",
	"vd_update_column",
	"vd_remove_column",
] as const;

export function useWebMCPViewDefinition(
	actionsRef: RefObject<ViewDefinitionBuilderActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "vd_get_view_definition",
			description:
				"[ViewDefinition Builder] Get the current ViewDefinition resource as JSON.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const vd = actionsRef.current.getViewDefinition();
				if (!vd) return textResult("No ViewDefinition loaded");
				return textResult(JSON.stringify(vd, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_set_view_definition",
			description:
				"[ViewDefinition Builder] Set the ViewDefinition resource. " +
				"Pass a complete ViewDefinition JSON object as a string. " +
				"resourceType is auto-added if missing. Also updates the resource type selector.",
			inputSchema: {
				type: "object",
				properties: {
					value: {
						type: "string",
						description: "ViewDefinition JSON string",
					},
				},
				required: ["value"],
			},
			execute: async (args: { value: string }) => {
				try {
					const vd = JSON.parse(args.value);
					if (!vd.resourceType) vd.resourceType = "ViewDefinition";
					actionsRef.current.setViewDefinition(vd);
					return textResult("ViewDefinition updated");
				} catch (e) {
					return textResult(
						`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_resource_type",
			description:
				"[ViewDefinition Builder] Get the current resource type (e.g. Patient, Observation).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const rt = actionsRef.current.getResourceType();
				return textResult(rt || "No resource type set");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_set_resource_type",
			description:
				"[ViewDefinition Builder] Set the resource type (the 'resource' field) for the ViewDefinition. " +
				"Updates both the ViewDefinition and the Instances panel.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "FHIR resource type (e.g. Patient, Observation)",
					},
				},
				required: ["resourceType"],
			},
			execute: async (args: { resourceType: string }) => {
				actionsRef.current.setResourceType(args.resourceType);
				return textResult(`Resource type set to ${args.resourceType}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_run",
			description:
				"[ViewDefinition Builder] Execute the current ViewDefinition and return the results. " +
				"Returns the result data as a JSON array of rows.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const data = await actionsRef.current.run();
					return textResult(data);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_save",
			description:
				"[ViewDefinition Builder] Save the current ViewDefinition (create if new, update if existing).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					await actionsRef.current.save();
					return textResult("ViewDefinition saved successfully");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_materialize",
			description:
				"[ViewDefinition Builder] Materialize the ViewDefinition as a database view, materialized view, or table.",
			inputSchema: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["view", "materialized-view", "table"],
						description: "Materialization type",
					},
				},
				required: ["type"],
			},
			execute: async (args: {
				type: "view" | "materialized-view" | "table";
			}) => {
				try {
					const viewName = await actionsRef.current.materialize(args.type);
					return textResult(`Materialized as ${args.type}: ${viewName}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_delete",
			description:
				"[ViewDefinition Builder] Delete the current ViewDefinition. " +
				"Only works on existing saved resources.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					await actionsRef.current.delete();
					return textResult("ViewDefinition deleted");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_run_results",
			description:
				"[ViewDefinition Builder] Get the results from the last run as a JSON array.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const results = actionsRef.current.getRunResults();
				if (!results) return textResult("No run results available");
				return textResult(results);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_run_error",
			description:
				"[ViewDefinition Builder] Get validation or run errors from the last execution.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const error = actionsRef.current.getRunError();
				if (!error) return textResult("No errors");
				return textResult(JSON.stringify(error, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_status",
			description:
				"[ViewDefinition Builder] Get the current status: whether there are unsaved changes, " +
				"resource type, and whether run results are available.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(
					JSON.stringify(
						{
							isDirty: actionsRef.current.isDirty(),
							resourceType: actionsRef.current.getResourceType(),
							hasRunResults: !!actionsRef.current.getRunResults(),
							hasRunError: !!actionsRef.current.getRunError(),
						},
						null,
						2,
					),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_switch_builder_tab",
			description:
				"[ViewDefinition Builder] Switch the builder sub-tab: form (visual builder), code (JSON/YAML editor), sql (SQL preview).",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["form", "code", "sql"],
						description: "Builder tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: "form" | "code" | "sql" }) => {
				actionsRef.current.switchBuilderTab(args.tab);
				return textResult(`Switched to ${args.tab} tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_builder_tab",
			description:
				"[ViewDefinition Builder] Get the currently active builder sub-tab (form, code, or sql).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(actionsRef.current.getBuilderTab());
			},
		});

		// --- Instances panel ---

		navigator.modelContext.registerTool({
			name: "vd_toggle_instances_panel",
			description:
				"[ViewDefinition Builder] Toggle the Instances side panel open or closed.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.toggleInstancesPanel();
				return textResult("Instances panel toggled");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_get_instances_panel_open",
			description:
				"[ViewDefinition Builder] Check if the Instances side panel is currently open.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(String(actionsRef.current.isInstancesPanelOpen()));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_search",
			description:
				"[ViewDefinition Instances] Search for FHIR resource instances. " +
				"Opens the Instances panel if closed. Pass FHIR search parameters " +
				"(e.g. 'code=8480-6&_count=5', '_id=123', 'name=John'). " +
				"Empty string fetches default results.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "FHIR search parameters (e.g. 'code=8480-6&_count=5')",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				actionsRef.current.openInstancesPanel();
				actionsRef.current.instancesSearch(args.query);
				return textResult(`Search started: ${args.query || "(default)"}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_get_current",
			description:
				"[ViewDefinition Instances] Get the currently displayed FHIR resource instance as JSON. " +
				"Opens the Instances panel if closed.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openInstancesPanel();
				const resource = actionsRef.current.instancesGetCurrent();
				if (!resource) return textResult("No instance loaded");
				return textResult(resource);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_get_count",
			description:
				"[ViewDefinition Instances] Get the total number of fetched instances.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(String(actionsRef.current.instancesGetCount()));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_get_index",
			description:
				"[ViewDefinition Instances] Get the current instance index (0-based).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(String(actionsRef.current.instancesGetIndex()));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_next",
			description:
				"[ViewDefinition Instances] Navigate to the next instance. Opens the Instances panel if closed.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openInstancesPanel();
				const prevIndex = actionsRef.current.instancesGetIndex();
				const count = actionsRef.current.instancesGetCount();
				actionsRef.current.instancesNext();
				const newIndex = Math.min(prevIndex + 1, count - 1);
				return textResult(`Index: ${newIndex} / ${count}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_previous",
			description:
				"[ViewDefinition Instances] Navigate to the previous instance. Opens the Instances panel if closed.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openInstancesPanel();
				const prevIndex = actionsRef.current.instancesGetIndex();
				actionsRef.current.instancesPrevious();
				const newIndex = Math.max(prevIndex - 1, 0);
				return textResult(`Index: ${newIndex}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_instances_go_to_index",
			description:
				"[ViewDefinition Instances] Navigate to a specific instance by index (0-based). Opens the Instances panel if closed.",
			inputSchema: {
				type: "object",
				properties: {
					index: {
						type: "number",
						description: "Instance index (0-based)",
					},
				},
				required: ["index"],
			},
			execute: async (args: { index: number }) => {
				actionsRef.current.openInstancesPanel();
				actionsRef.current.instancesGoToIndex(args.index);
				return textResult(`Navigated to index ${args.index}`);
			},
		});

		// --- Builder Form tools ---

		navigator.modelContext.registerTool({
			name: "vd_get_form_tree",
			description:
				"[ViewDefinition Builder Form] Get the full form tree as JSON. " +
				"Returns properties (name, status, resourceType), constants, where conditions, " +
				"and the recursive select tree with nodeIds for use in other form tools.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const tree = actionsRef.current.getFormTree();
				return textResult(JSON.stringify(tree, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_set_name",
			description: "[ViewDefinition Builder Form] Set the ViewDefinition name.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "ViewDefinition name",
					},
				},
				required: ["name"],
			},
			execute: async (args: { name: string }) => {
				actionsRef.current.setName(args.name);
				return textResult(`Name set to "${args.name}"`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_set_status",
			description:
				"[ViewDefinition Builder Form] Set the ViewDefinition status.",
			inputSchema: {
				type: "object",
				properties: {
					status: {
						type: "string",
						enum: ["draft", "active", "retired", "unknown"],
						description: "ViewDefinition status",
					},
				},
				required: ["status"],
			},
			execute: async (args: { status: string }) => {
				actionsRef.current.setStatus(args.status);
				return textResult(`Status set to "${args.status}"`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_add_constant",
			description:
				"[ViewDefinition Builder Form] Add a new constant. " +
				"Optionally provide name and value immediately (recommended). Returns the nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Constant name (optional)",
					},
					value: {
						type: "string",
						description: "Constant value (optional)",
					},
				},
			},
			execute: async (args: { name?: string; value?: string }) => {
				const nodeId = actionsRef.current.addConstant(args.name, args.value);
				return textResult(
					JSON.stringify({ nodeId, message: "Constant added" }),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_update_constant",
			description:
				"[ViewDefinition Builder Form] Update a constant's name or value. " +
				"Use vd_get_form_tree to get nodeIds.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Constant nodeId from vd_get_form_tree",
					},
					field: {
						type: "string",
						enum: ["name", "valueString"],
						description: "Field to update",
					},
					value: {
						type: "string",
						description: "New value",
					},
				},
				required: ["nodeId", "field", "value"],
			},
			execute: async (args: {
				nodeId: string;
				field: "name" | "valueString";
				value: string;
			}) => {
				actionsRef.current.updateConstant(args.nodeId, args.field, args.value);
				return textResult(`Constant ${args.field} updated`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_remove_constant",
			description: "[ViewDefinition Builder Form] Remove a constant by nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Constant nodeId from vd_get_form_tree",
					},
				},
				required: ["nodeId"],
			},
			execute: async (args: { nodeId: string }) => {
				actionsRef.current.removeConstant(args.nodeId);
				return textResult("Constant removed");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_add_where",
			description:
				"[ViewDefinition Builder Form] Add a new where condition. " +
				"Optionally provide the FHIRPath expression immediately (recommended). Returns the nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					path: {
						type: "string",
						description: "FHIRPath expression (optional)",
					},
				},
			},
			execute: async (args: { path?: string }) => {
				const nodeId = actionsRef.current.addWhere(args.path);
				return textResult(
					JSON.stringify({ nodeId, message: "Where condition added" }),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_update_where",
			description:
				"[ViewDefinition Builder Form] Update a where condition's FHIRPath expression.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Where condition nodeId from vd_get_form_tree",
					},
					path: {
						type: "string",
						description: "FHIRPath expression",
					},
				},
				required: ["nodeId", "path"],
			},
			execute: async (args: { nodeId: string; path: string }) => {
				actionsRef.current.updateWhere(args.nodeId, args.path);
				return textResult("Where condition updated");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_remove_where",
			description:
				"[ViewDefinition Builder Form] Remove a where condition by nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Where condition nodeId from vd_get_form_tree",
					},
				},
				required: ["nodeId"],
			},
			execute: async (args: { nodeId: string }) => {
				actionsRef.current.removeWhere(args.nodeId);
				return textResult("Where condition removed");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_add_select",
			description:
				"[ViewDefinition Builder Form] Add a new select item. " +
				"Types: column (flat columns), forEach/forEachOrNull (iterate with expression), unionAll (merge results). " +
				"Optionally nest inside a parent select by providing parentNodeId. Returns the nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["column", "forEach", "forEachOrNull", "unionAll"],
						description: "Select item type",
					},
					parentNodeId: {
						type: "string",
						description:
							"Optional parent select nodeId for nesting (forEach/forEachOrNull/unionAll)",
					},
				},
				required: ["type"],
			},
			execute: async (args: {
				type: "column" | "forEach" | "forEachOrNull" | "unionAll";
				parentNodeId?: string;
			}) => {
				const nodeId = actionsRef.current.addSelect(
					args.type,
					args.parentNodeId,
				);
				return textResult(
					JSON.stringify({
						nodeId,
						message: `Select item (${args.type}) added`,
					}),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_remove_select",
			description:
				"[ViewDefinition Builder Form] Remove a select item and all its children by nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Select item nodeId from vd_get_form_tree",
					},
				},
				required: ["nodeId"],
			},
			execute: async (args: { nodeId: string }) => {
				actionsRef.current.removeSelect(args.nodeId);
				return textResult("Select item removed");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_update_select_expression",
			description:
				"[ViewDefinition Builder Form] Update the FHIRPath expression of a forEach or forEachOrNull select item.",
			inputSchema: {
				type: "object",
				properties: {
					nodeId: {
						type: "string",
						description: "Select item nodeId (forEach/forEachOrNull)",
					},
					expression: {
						type: "string",
						description: "FHIRPath expression",
					},
				},
				required: ["nodeId", "expression"],
			},
			execute: async (args: { nodeId: string; expression: string }) => {
				actionsRef.current.updateSelectExpression(args.nodeId, args.expression);
				return textResult("Select expression updated");
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_add_column",
			description:
				"[ViewDefinition Builder Form] Add a new column to any select item (column, forEach, forEachOrNull, unionAll). " +
				"Optionally provide name and path to set them immediately (recommended to avoid race conditions). " +
				"Returns the column nodeId.",
			inputSchema: {
				type: "object",
				properties: {
					selectNodeId: {
						type: "string",
						description:
							"NodeId of the column-type select item from vd_get_form_tree",
					},
					name: {
						type: "string",
						description:
							"Column name (optional, can be set later with vd_update_column)",
					},
					path: {
						type: "string",
						description:
							"FHIRPath expression (optional, can be set later with vd_update_column)",
					},
				},
				required: ["selectNodeId"],
			},
			execute: async (args: {
				selectNodeId: string;
				name?: string;
				path?: string;
			}) => {
				const nodeId = actionsRef.current.addColumn(
					args.selectNodeId,
					args.name,
					args.path,
				);
				return textResult(JSON.stringify({ nodeId, message: "Column added" }));
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_update_column",
			description:
				"[ViewDefinition Builder Form] Update a column's name or FHIRPath path.",
			inputSchema: {
				type: "object",
				properties: {
					selectNodeId: {
						type: "string",
						description: "Parent select item nodeId",
					},
					columnNodeId: {
						type: "string",
						description: "Column nodeId from vd_get_form_tree",
					},
					field: {
						type: "string",
						enum: ["name", "path"],
						description: "Field to update",
					},
					value: {
						type: "string",
						description: "New value",
					},
				},
				required: ["selectNodeId", "columnNodeId", "field", "value"],
			},
			execute: async (args: {
				selectNodeId: string;
				columnNodeId: string;
				field: "name" | "path";
				value: string;
			}) => {
				actionsRef.current.updateColumn(
					args.selectNodeId,
					args.columnNodeId,
					args.field,
					args.value,
				);
				return textResult(`Column ${args.field} updated`);
			},
		});

		navigator.modelContext.registerTool({
			name: "vd_remove_column",
			description:
				"[ViewDefinition Builder Form] Remove a column from a column-type select item.",
			inputSchema: {
				type: "object",
				properties: {
					selectNodeId: {
						type: "string",
						description: "Parent select item nodeId",
					},
					columnNodeId: {
						type: "string",
						description: "Column nodeId from vd_get_form_tree",
					},
				},
				required: ["selectNodeId", "columnNodeId"],
			},
			execute: async (args: { selectNodeId: string; columnNodeId: string }) => {
				actionsRef.current.removeColumn(args.selectNodeId, args.columnNodeId);
				return textResult("Column removed");
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
