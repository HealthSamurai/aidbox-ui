import {
  Button,
  CodeEditor,
  type ColumnDef,
  Combobox,
  type ComboboxOption,
  CopyIcon,
  DataTable,
  FHIRStructureView,
  Input,
  type ItemInstance,
  PlayIcon,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SegmentControl,
  SegmentControlItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TreeView,
  type TreeViewItem,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import {
  ChevronLeft,
  ChevronRight,
  Funnel,
  Pi,
  PlusIcon,
  Save,
  TextQuote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { format as formatSQL } from "sql-formatter";
import { AidboxCall, AidboxCallWithMeta } from "../../api/auth";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface ViewDefinition {
  resourceType: string;
  id?: string;
  name?: string;
  status?: string;
  resource?: string;
  description?: string;
  select?: Array<{
    column?: Array<{
      name?: string;
      path?: string;
      type?: string;
    }>;
  }>;
  [key: string]: any;
}

export const Route = createFileRoute("/ViewDefinition/$id")({
  component: ViewDefinitionPage,
  staticData: {
    title: "View Definitions",
  },
});

const CodeEditorMenu = ({
  mode,
  onModeChange,
  copyText,
  onFormat,
}: {
  mode: "json" | "yaml";
  onModeChange: (mode: "json" | "yaml") => void;
  copyText: string;
  onFormat: () => void;
}) => {
  return (
    <div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
      <SegmentControl
        defaultValue={mode}
        name="code-editor-menu"
        onValueChange={(value) => onModeChange(value as "json" | "yaml")}
      >
        <SegmentControlItem value="json">JSON</SegmentControlItem>
        <SegmentControlItem value="yaml">YAML</SegmentControlItem>
      </SegmentControl>
      <Button
        variant="ghost"
        size="small"
        onClick={onFormat}
        title="Format code"
      >
        <TextQuote className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="small" asChild>
        <CopyIcon text={copyText} />
      </Button>
    </div>
  );
};

const ExampleTabEditorMenu = ({
  mode,
  onModeChange,
  copyText,
  onPrevious,
  onNext,
  canGoToPrevious,
  canGoToNext,
}: {
  mode: "json" | "yaml";
  onModeChange: (mode: "json" | "yaml") => void;
  copyText: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoToPrevious: boolean;
  canGoToNext: boolean;
}) => {
  return (
    <div className="flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary">
      <SegmentControl
        defaultValue={mode}
        name="example-editor-menu"
        onValueChange={(value) => onModeChange(value as "json" | "yaml")}
      >
        <SegmentControlItem value="json">JSON</SegmentControlItem>
        <SegmentControlItem value="yaml">YAML</SegmentControlItem>
      </SegmentControl>
      <Button variant="ghost" size="small" asChild>
        <CopyIcon text={copyText} />
      </Button>
      <div className="border-l h-6" />
      <Button
        variant="ghost"
        size="small"
        onClick={onPrevious}
        disabled={!canGoToPrevious}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="small"
        onClick={onNext}
        disabled={!canGoToNext}
      >
        <ChevronRight />
      </Button>
    </div>
  );
};

const ViewDefinitionForm = ({
  viewDefinition,
  onUpdate,
}: {
  viewDefinition: ViewDefinition;
  onUpdate?: (updatedViewDef: ViewDefinition) => void;
}) => {
  // State for resource types dropdown
  const [resourceTypes, setResourceTypes] = useState<ComboboxOption[]>([]);
  const [isLoadingResourceTypes, setIsLoadingResourceTypes] = useState(false);

  // State for managing constants dynamically
  const [constants, setConstants] = useState<
    Array<{
      id: string;
      name: string;
      valueString: string;
    }>
  >([]);

  // State for managing where conditions dynamically
  const [whereConditions, setWhereConditions] = useState<
    Array<{
      id: string;
      name: string;
      value: string;
    }>
  >([]);

  // State for managing select columns dynamically
  const [selectColumns, setSelectColumns] = useState<
    Array<{
      id: string;
      name: string;
      path: string;
    }>
  >([]);

  // State for expanded items using localStorage
  const [expandedItemIds, setExpandedItemIds] = useLocalStorage<string[]>({
    key: `viewDefinition-form-expanded-${viewDefinition?.id || "default"}`,
    defaultValue: [
      "viewDefinition",
      "_constant",
      "_select",
      "_column",
      "_where",
    ],
  });

  // Fetch resource types on component mount
  useEffect(() => {
    const fetchResourceTypes = async () => {
      setIsLoadingResourceTypes(true);
      try {
        const response = await AidboxCall<Record<string, any>>({
          method: "GET",
          url: "/$resource-types",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (response) {
          // Convert the response object keys to ComboboxOption format
          const options: ComboboxOption[] = Object.keys(response)
            .sort() // Sort alphabetically for better UX
            .map((resourceType) => ({
              value: resourceType,
              label: resourceType,
            }));
          setResourceTypes(options);
        }
      } catch (error) {
        console.error("Failed to fetch resource types:", error);
        // Set some default FHIR resource types as fallback
        const defaultTypes = [
          "Patient",
          "Practitioner",
          "Organization",
          "Observation",
          "Condition",
          "Procedure",
          "Encounter",
          "Medication",
          "MedicationRequest",
          "AllergyIntolerance",
        ];
        setResourceTypes(
          defaultTypes.map((type) => ({ value: type, label: type })),
        );
      } finally {
        setIsLoadingResourceTypes(false);
      }
    };

    fetchResourceTypes();
  }, []);

  // Initialize constants from viewDefinition
  useEffect(() => {
    if (
      viewDefinition?.constant &&
      Array.isArray(viewDefinition.constant) &&
      viewDefinition.constant.length > 0
    ) {
      const constantsWithIds = viewDefinition.constant.map(
        (c: any, index: number) => ({
          id: `constant-${index}-${crypto.randomUUID()}`,
          name: c.name || "",
          valueString: c.valueString || "",
        }),
      );
      setConstants(constantsWithIds);
    } else {
      // Start with empty array - constants will be added by clicking the add button
      setConstants([]);
    }

    // Initialize where conditions from viewDefinition
    if (
      viewDefinition?.where &&
      Array.isArray(viewDefinition.where) &&
      viewDefinition.where.length > 0
    ) {
      const whereWithIds = viewDefinition.where.map(
        (w: any, index: number) => ({
          id: `where-${index}-${crypto.randomUUID()}`,
          name: w.name || "",
          value: w.value || "",
        }),
      );
      setWhereConditions(whereWithIds);
    } else {
      // Start with empty array - where conditions will be added by clicking the add button
      setWhereConditions([]);
    }

    // Initialize select columns from viewDefinition
    if (
      viewDefinition?.select &&
      Array.isArray(viewDefinition.select) &&
      viewDefinition.select.length > 0 &&
      viewDefinition.select[0]?.column
    ) {
      const columnsWithIds = viewDefinition.select[0].column.map(
        (c: any, index: number) => ({
          id: `column-${index}-${crypto.randomUUID()}`,
          name: c.name || "",
          path: c.path || "",
        }),
      );
      setSelectColumns(columnsWithIds);
    } else {
      // Start with empty array - columns will be added by clicking the add button
      setSelectColumns([]);
    }
  }, [viewDefinition]);

  // Function to update ViewDefinition with new constants and where conditions
  const updateViewDefinition = useCallback(
    (
      updatedConstants?: Array<{
        id: string;
        name: string;
        valueString: string;
      }>,
      updatedWhere?: Array<{ id: string; name: string; value: string }>,
      updatedFields?: { name?: string; resource?: string },
      updatedSelect?: Array<{
        id: string;
        name: string;
        path: string;
      }>,
    ) => {
      if (onUpdate) {
        const constantArray = (updatedConstants || constants).map((c) => ({
          name: c.name,
          valueString: c.valueString,
        }));

        const whereArray = (updatedWhere || whereConditions).map((w) => ({
          name: w.name,
          value: w.value,
        }));

        const selectArray = (updatedSelect || selectColumns).map((col) => ({
          name: col.name,
          path: col.path,
        }));

        const updatedViewDef: any = {
          ...viewDefinition,
          ...(updatedFields || {}),
        };

        // Only add arrays if they have content
        if (constantArray.length > 0) {
          updatedViewDef.constant = constantArray;
        } else {
          delete updatedViewDef.constant;
        }

        if (whereArray.length > 0) {
          updatedViewDef.where = whereArray;
        } else {
          delete updatedViewDef.where;
        }

        if (selectArray.length > 0) {
          updatedViewDef.select = [{ column: selectArray }];
        } else {
          delete updatedViewDef.select;
        }

        onUpdate(updatedViewDef);
      }
    },
    [viewDefinition, constants, whereConditions, selectColumns, onUpdate],
  );

  // Function to add a new constant
  const addConstant = () => {
    const newConstant = {
      id: `constant-${constants.length}-${crypto.randomUUID()}`,
      name: "",
      valueString: "",
    };
    const updatedConstants = [...constants, newConstant];
    setConstants(updatedConstants);
    updateViewDefinition(updatedConstants);
  };

  // Function to update a specific constant
  const updateConstant = (
    id: string,
    field: "name" | "valueString",
    value: string,
  ) => {
    const updatedConstants = constants.map((c) =>
      c.id === id ? { ...c, [field]: value } : c,
    );
    setConstants(updatedConstants);
    updateViewDefinition(updatedConstants);
  };

  // Function to remove a constant
  const removeConstant = (id: string) => {
    const updatedConstants = constants.filter((c) => c.id !== id);
    setConstants(updatedConstants);
    updateViewDefinition(updatedConstants);
  };

  // Function to add a new where condition
  const addWhereCondition = () => {
    const newWhere = {
      id: `where-${whereConditions.length}-${crypto.randomUUID()}`,
      name: "",
      value: "",
    };
    const updatedWhere = [...whereConditions, newWhere];
    setWhereConditions(updatedWhere);
    updateViewDefinition(undefined, updatedWhere);
  };

  // Function to update a specific where condition
  const updateWhereCondition = (
    id: string,
    field: "name" | "value",
    value: string,
  ) => {
    const updatedWhere = whereConditions.map((w) =>
      w.id === id ? { ...w, [field]: value } : w,
    );
    setWhereConditions(updatedWhere);
    updateViewDefinition(undefined, updatedWhere);
  };

  // Function to remove a where condition
  const removeWhereCondition = (id: string) => {
    const updatedWhere = whereConditions.filter((w) => w.id !== id);
    setWhereConditions(updatedWhere);
    updateViewDefinition(undefined, updatedWhere);
  };

  // Function to update name field
  const updateName = (name: string) => {
    updateViewDefinition(undefined, undefined, { name });
  };

  // Function to update resource field
  const updateResource = (resource: string) => {
    updateViewDefinition(undefined, undefined, { resource });
  };

  // Function to add a new select column
  const addSelectColumn = () => {
    const newColumn = {
      id: `column-${selectColumns.length}-${crypto.randomUUID()}`,
      name: "",
      path: "",
    };
    const updatedColumns = [...selectColumns, newColumn];
    setSelectColumns(updatedColumns);
    updateViewDefinition(undefined, undefined, undefined, updatedColumns);
  };

  // Function to update a specific select column
  const updateSelectColumn = (
    id: string,
    field: "name" | "path",
    value: string,
  ) => {
    const updatedColumns = selectColumns.map((col) =>
      col.id === id ? { ...col, [field]: value } : col,
    );
    setSelectColumns(updatedColumns);
    updateViewDefinition(undefined, undefined, undefined, updatedColumns);
  };

  // Function to remove a select column
  const removeSelectColumn = (id: string) => {
    const updatedColumns = selectColumns.filter((col) => col.id !== id);
    setSelectColumns(updatedColumns);
    updateViewDefinition(undefined, undefined, undefined, updatedColumns);
  };

  // Dynamic tree generation based on current constants and where conditions
  const tree: Record<string, TreeViewItem<any>> = useMemo(() => {
    const constantChildren =
      constants.length > 0 ? constants.map((c) => c.id) : [];
    constantChildren.push("_constant_add");

    const whereChildren =
      whereConditions.length > 0 ? whereConditions.map((w) => w.id) : [];
    whereChildren.push("_where_add");

    const selectChildren =
      selectColumns.length > 0 ? selectColumns.map((col) => col.id) : [];
    selectChildren.push("_select_add");

    const treeStructure: Record<string, TreeViewItem<any>> = {
      root: {
        name: "root",
        children: ["viewDefinition"],
      },
      viewDefinition: {
        name: "ViewDefinition",
        children: ["_name", "_resource", "_constant", "_where", "_select"],
      },
      _name: {
        name: "_name",
        meta: {
          type: "name",
        },
      },
      _resource: {
        name: "_resource",
        meta: {
          type: "resource",
        },
      },
      _constant: {
        name: "_constant",
        meta: {
          type: "constant",
        },
        children: constantChildren,
      },
      _constant_add: {
        name: "_constant_add",
        meta: {
          type: "constant-add",
        },
      },
      _where: {
        name: "_where",
        meta: {
          type: "where",
        },
        children: whereChildren,
      },
      _where_add: {
        name: "_where_add",
        meta: {
          type: "where-add",
        },
      },
      _select: {
        name: "_select",
        meta: {
          type: "select",
        },
        children: ["_column"],
      },
      _column: {
        name: "_column",
        meta: {
          type: "column",
        },
        children: selectChildren,
      },
      _select_add: {
        name: "_select_add",
        meta: {
          type: "select-add",
        },
      },
    };

    // Add each constant as a tree node
    constants.forEach((constant, index) => {
      treeStructure[constant.id] = {
        name: constant.id,
        meta: {
          type: "constant-value",
          lastNode: index === constants.length - 1,
          constantData: constant,
        },
      };
    });

    // Add each where condition as a tree node
    whereConditions.forEach((whereCondition, index) => {
      treeStructure[whereCondition.id] = {
        name: whereCondition.id,
        meta: {
          type: "where-value",
          lastNode: index === whereConditions.length - 1,
          whereData: whereCondition,
        },
      };
    });

    // Add each select column as a tree node
    selectColumns.forEach((column, index) => {
      treeStructure[column.id] = {
        name: column.id,
        meta: {
          type: "select-column",
          lastNode: index === selectColumns.length - 1,
          columnData: column,
        },
      };
    });

    return treeStructure;
  }, [constants, whereConditions, selectColumns]);

  const labelView = (item: ItemInstance<TreeViewItem<any>>) => {
    const metaType = item.getItemData()?.meta?.type;
    let additionalClass = "";

    if (metaType === "column") {
      // Green color scheme for column
      additionalClass = "text-[#009906] bg-[#E5FAE8]";
    } else if (
      metaType === "name" ||
      metaType === "resource" ||
      metaType === "constant" ||
      metaType === "select" ||
      metaType === "where"
    ) {
      // Purple color scheme for other structural nodes
      additionalClass = "text-[#765FC9] bg-[#F1EFFA]";
    }

    return (
      <span className={`uppercase px-1.5 py-0.5 rounded-md ${additionalClass}`}>
        {metaType}
      </span>
    );
  };

  const InputView = ({
    placeholder,
    className,
    value,
    onBlur,
  }: {
    placeholder: string;
    className?: string;
    value?: string;
    onBlur?: (value: string) => void;
  }) => {
    const [localValue, setLocalValue] = useState(value || "");

    // Update local value when prop changes
    useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    return (
      <Input
        className={`h-6 py-0 px-1.5 ${className}`}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          if (onBlur && localValue !== value) {
            onBlur(localValue);
          }
        }}
      />
    );
  };

  const customItemView = (item: ItemInstance<TreeViewItem<any>>) => {
    const metaType = item.getItemData()?.meta?.type;
    switch (metaType) {
      case "name":
        return (
          <div className="flex w-full items-center justify-between">
            {labelView(item)}
            <div className="w-[50%]">
              <InputView
                placeholder="ViewDefinition name"
                value={viewDefinition.name || ""}
                onBlur={(value) => updateName(value)}
              />
            </div>
          </div>
        );
      case "resource":
        return (
          <div className="flex w-full items-center justify-between">
            {labelView(item)}
            <div className="w-[50%]">
              <Combobox
                options={resourceTypes}
                value={viewDefinition.resource || ""}
                onValueChange={(value) => updateResource(value)}
                placeholder="Select resource type..."
                searchPlaceholder="Search resources..."
                emptyText="No resource types found"
                disabled={isLoadingResourceTypes}
                className="h-6"
              />
            </div>
          </div>
        );
      case "constant":
        return <div>{labelView(item)}</div>;
      case "select":
        return <div>{labelView(item)}</div>;
      case "column":
        return <div>{labelView(item)}</div>;
      case "where":
        return <div>{labelView(item)}</div>;
      case "select-add":
        return (
          <Button
            variant="link"
            size="small"
            className="px-0"
            onClick={addSelectColumn}
            asChild
          >
            <span>
              <PlusIcon size={16} strokeWidth={3} />
              <span className="typo-label">Column</span>
            </span>
          </Button>
        );
      case "select-column": {
        const columnData = item.getItemData()?.meta?.columnData;
        if (!columnData) return null;

        return (
          <div className="flex items-center w-full gap-2">
            <span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
              <TextQuote size={12} />
            </span>
            <InputView
              placeholder="Column name"
              value={columnData.name}
              onBlur={(value) =>
                updateSelectColumn(columnData.id, "name", value)
              }
            />
            <InputView
              placeholder="Path"
              value={columnData.path}
              onBlur={(value) =>
                updateSelectColumn(columnData.id, "path", value)
              }
            />
            <Button
              variant="link"
              size="small"
              className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
              onClick={() => removeSelectColumn(columnData.id)}
              asChild
            >
              <span>
                <X size={14} />
              </span>
            </Button>
          </div>
        );
      }
      case "where-add":
        return (
          <Button
            variant="link"
            size="small"
            className="px-0"
            onClick={addWhereCondition}
            asChild
          >
            <span>
              <PlusIcon size={16} strokeWidth={3} />
              <span className="typo-label">Where</span>
            </span>
          </Button>
        );
      case "where-value": {
        const whereData = item.getItemData()?.meta?.whereData;
        if (!whereData) return null;

        console.log("WHERE rerender");
        return (
          <div className="flex items-center w-full gap-2">
            <span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
              <Funnel size={12} />
            </span>
            <InputView
              placeholder="Where name"
              value={whereData.name}
              onBlur={(value) =>
                updateWhereCondition(whereData.id, "name", value)
              }
            />
            <InputView
              placeholder="Where value"
              value={whereData.value}
              onBlur={(value) =>
                updateWhereCondition(whereData.id, "value", value)
              }
            />
            <Button
              variant="link"
              size="small"
              className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
              onClick={() => removeWhereCondition(whereData.id)}
              asChild
            >
              <span>
                <X size={14} />
              </span>
            </Button>
          </div>
        );
      }
      case "constant-add":
        return (
          <Button
            variant="link"
            size="small"
            className="px-0"
            onClick={addConstant}
            asChild
          >
            <span>
              <PlusIcon size={16} strokeWidth={3} />
              <span className="typo-label">Constant</span>
            </span>
          </Button>
        );
      case "constant-value": {
        const constantData = item.getItemData()?.meta?.constantData;
        if (!constantData) return null;

        return (
          <div className="flex items-center w-full gap-2">
            <span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1">
              <Pi size={12} />
            </span>
            <InputView
              placeholder="Name"
              value={constantData.name}
              onBlur={(value) => updateConstant(constantData.id, "name", value)}
            />
            <InputView
              placeholder="Value"
              value={constantData.valueString}
              onBlur={(value) =>
                updateConstant(constantData.id, "valueString", value)
              }
            />

            <Button
              variant="link"
              size="small"
              className="group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
              onClick={() => removeConstant(constantData.id)}
              asChild
            >
              <span>
                <X size={14} />
              </span>
            </Button>
          </div>
        );
      }
    }
  };
  return (
    <TreeView
      items={tree}
      rootItemId="root"
      expandedItemIds={expandedItemIds}
      onExpandedItemsChange={(newExpandedIds, _) => {
        setExpandedItemIds(newExpandedIds);
      }}
      customItemView={customItemView}
      disableHover={true}
    />
  );
};

function LeftPanel({
  onRunResponse,
  routeId,
  setRunResponseVersion,
  viewDefinition,
  isLoadingViewDef,
  onViewDefinitionUpdate,
}: {
  onRunResponse: (response: string | null) => void;
  routeId: string;
  setRunResponseVersion: (version: string) => void;
  viewDefinition: ViewDefinition | null;
  isLoadingViewDef: boolean;
  onViewDefinitionUpdate: (viewDef: ViewDefinition) => void;
}) {
  const [activeTab, setActiveTab] = useLocalStorage<"form" | "code" | "sql">({
    key: `viewDefinition-leftPanel-activeTab-${routeId}`,
    defaultValue: "form",
  });
  const [codeContent, setCodeContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sqlContent, setSqlContent] = useState("");
  const [isLoadingSQL, setIsLoadingSQL] = useState(false);
  const [codeMode, setCodeMode] = useLocalStorage<"json" | "yaml">({
    key: `viewDefinition-leftPanel-codeMode-${routeId}`,
    defaultValue: "json",
  });

  // Local state for Form tab - doesn't sync until tab switch
  const [localFormViewDef, setLocalFormViewDef] =
    useState<ViewDefinition | null>(viewDefinition);
  // Local state for Code tab - stores the pending changes
  const [pendingCodeViewDef, setPendingCodeViewDef] =
    useState<ViewDefinition | null>(null);

  // Update local form state when parent viewDefinition changes
  useEffect(() => {
    setLocalFormViewDef(viewDefinition);
  }, [viewDefinition]);

  // Sync code content with viewDefinition only when switching TO code tab or changing code mode
  useEffect(() => {
    if (activeTab === "code" && viewDefinition) {
      if (codeMode === "yaml") {
        setCodeContent(yaml.dump(viewDefinition, { indent: 2 }));
      } else {
        setCodeContent(JSON.stringify(viewDefinition, null, 2));
      }
    }
  }, [activeTab, codeMode]);

  // Handle tab changes with synchronization
  const handleTabChange = (newTab: string) => {
    const typedTab = newTab as "form" | "code" | "sql";

    // Sync data when switching tabs
    if (activeTab === "form" && typedTab === "code") {
      // Switching from Form to Code - sync form changes to parent
      if (localFormViewDef) {
        onViewDefinitionUpdate(localFormViewDef);
        // Update code content with the latest form data
        if (codeMode === "yaml") {
          setCodeContent(yaml.dump(localFormViewDef, { indent: 2 }));
        } else {
          setCodeContent(JSON.stringify(localFormViewDef, null, 2));
        }
      }
    } else if (activeTab === "code" && typedTab === "form") {
      // Switching from Code to Form - sync code changes to parent
      if (pendingCodeViewDef) {
        onViewDefinitionUpdate(pendingCodeViewDef);
        setLocalFormViewDef(pendingCodeViewDef);
        setPendingCodeViewDef(null); // Clear pending changes
      }
    }

    setActiveTab(typedTab);
  };

  // Update ViewDefinition when code content changes (store locally, don't sync)
  const handleCodeContentChange = useCallback(
    (value: string) => {
      setCodeContent(value || "");

      // Try to parse and store locally - don't sync until tab switch
      try {
        let parsedViewDef: any;
        if (codeMode === "yaml") {
          parsedViewDef = yaml.load(value || "");
        } else {
          parsedViewDef = JSON.parse(value || "{}");
        }

        // Only store if parsing was successful and it's a valid ViewDefinition
        if (parsedViewDef && typeof parsedViewDef === "object") {
          setPendingCodeViewDef(parsedViewDef);
        }
      } catch (error) {
        // Ignore parsing errors - user might still be typing
        console.debug("Parsing error (expected while typing):", error);
        setPendingCodeViewDef(null); // Clear pending if invalid
      }
    },
    [codeMode],
  );

  const handleFormatCode = () => {
    try {
      if (codeMode === "yaml") {
        // Parse and re-dump YAML to format it
        const parsed = yaml.load(codeContent);
        setCodeContent(yaml.dump(parsed, { indent: 2 }));
      } else {
        // Parse and re-stringify JSON to format it
        const parsed = JSON.parse(codeContent);
        setCodeContent(JSON.stringify(parsed, null, 2));
      }
    } catch (error) {
      // If parsing fails, leave content as is
      console.error(`Failed to format ${codeMode.toUpperCase()}:`, error);
    }
  };

  useEffect(() => {
    const fetchSQL = async () => {
      if (activeTab === "sql" && viewDefinition) {
        setIsLoadingSQL(true);
        try {
          const parametersPayload = {
            resourceType: "Parameters",
            parameter: [
              {
                name: "viewResource",
                resource: viewDefinition,
              },
            ],
          };

          const response = await AidboxCallWithMeta({
            method: "POST",
            url: "/fhir/ViewDefinition/$sql",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/fhir+json",
            },
            body: JSON.stringify(parametersPayload),
          });

          try {
            const json = JSON.parse(response.body);
            if (json.issue) {
              setSqlContent(
                `-- Error: ${json.issue[0]?.diagnostics || "Unknown error"}`,
              );
            } else if (json.parameter && json.parameter[0]?.valueString) {
              try {
                const formattedSQL = formatSQL(json.parameter[0].valueString, {
                  language: "postgresql",
                  keywordCase: "upper",
                  linesBetweenQueries: 2,
                });
                setSqlContent(formattedSQL);
              } catch {
                setSqlContent(json.parameter[0].valueString);
              }
            } else {
              setSqlContent(response.body);
            }
          } catch {
            setSqlContent(response.body);
          }
        } catch (error) {
          console.error("Error fetching SQL:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          setSqlContent(`-- Error fetching SQL: ${errorMessage}`);
        } finally {
          setIsLoadingSQL(false);
        }
      }
    };

    fetchSQL();
  }, [activeTab, viewDefinition]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let viewDefinitionToSave: any;

      // Use the current tab's state
      if (activeTab === "form") {
        // Use form's local state
        viewDefinitionToSave = localFormViewDef;
      } else if (activeTab === "code") {
        // Parse and use code editor's content
        try {
          if (codeMode === "yaml") {
            viewDefinitionToSave = yaml.load(codeContent);
          } else {
            viewDefinitionToSave = JSON.parse(codeContent);
          }
        } catch (parseError) {
          console.error(
            `Invalid ${codeMode.toUpperCase()} in code editor:`,
            parseError,
          );
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="typo-body">Failed to save</span>
              <span className="typo-code text-text-secondary">
                Invalid {codeMode.toUpperCase()} in code editor
              </span>
            </div>,
            { duration: 3000 },
          );
          setIsSaving(false);
          return;
        }
      } else {
        // SQL tab - shouldn't save from here
        toast.error("Cannot save from SQL tab");
        setIsSaving(false);
        return;
      }

      const response = await AidboxCallWithMeta({
        method: "PUT",
        url: `/fhir/ViewDefinition/${routeId}`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(viewDefinitionToSave),
      });

      // Check if the response indicates success
      // Try multiple ways to detect success since response structure might vary
      const status = response.meta?.status || response.status;
      const isSuccess =
        (status && status >= 200 && status < 300) ||
        response.meta?.ok === true ||
        (!response.meta?.status && response.body); // If no status, assume success if there's a body

      if (isSuccess) {
        try {
          const parsedBody = JSON.parse(response.body);
          onViewDefinitionUpdate(parsedBody);
          // Also update local states to reflect saved data
          setLocalFormViewDef(parsedBody);
          setPendingCodeViewDef(null);
        } catch {
          // If parsing fails, still update with the original viewDefinition
          onViewDefinitionUpdate(viewDefinitionToSave);
          setLocalFormViewDef(viewDefinitionToSave);
          setPendingCodeViewDef(null);
        }
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="typo-body">Successfully saved</span>
            <span className="typo-code text-text-secondary">
              ViewDefinition/{routeId}
            </span>
          </div>,
          { duration: 2000 },
        );
      } else {
        // Error response
        let errorMessage = "Failed to save ViewDefinition";
        try {
          const errorBody = JSON.parse(response.body);
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch {
          errorMessage = response.body || errorMessage;
        }
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="typo-body">Failed to save</span>
            <span className="typo-code text-text-secondary">
              {errorMessage}
            </span>
          </div>,
          { duration: 3000 },
        );
      }
    } catch (error) {
      console.error("Error saving ViewDefinition:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="typo-body">Failed to save</span>
          <span className="typo-code text-text-secondary">{errorMessage}</span>
        </div>,
        { duration: 3000 },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    try {
      let viewDefinitionToRun: any;

      // Use the current tab's state
      if (activeTab === "form") {
        // Use form's local state
        viewDefinitionToRun = localFormViewDef;
      } else if (activeTab === "code") {
        // Parse and use code editor's content
        try {
          if (codeMode === "yaml") {
            viewDefinitionToRun = yaml.load(codeContent);
          } else {
            viewDefinitionToRun = JSON.parse(codeContent);
          }
        } catch (parseError) {
          console.error(
            `Invalid ${codeMode.toUpperCase()} in code editor:`,
            parseError,
          );
          onRunResponse(
            JSON.stringify(
              { error: `Invalid ${codeMode.toUpperCase()} in code editor` },
              null,
              2,
            ),
          );
          setIsLoading(false);
          return;
        }
      } else {
        // SQL tab - can't run from here
        toast.error("Cannot run from SQL tab");
        setIsLoading(false);
        return;
      }

      const parametersPayload = {
        resourceType: "Parameters",
        parameter: [
          {
            name: "viewResource",
            resource: viewDefinitionToRun,
          },
          {
            name: "_format",
            valueCode: "json",
          },
        ],
      };

      const response = await AidboxCallWithMeta({
        method: "POST",
        url: "/fhir/ViewDefinition/$run",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/fhir+json",
        },
        body: JSON.stringify(parametersPayload),
      });

      try {
        let parsedBody: any;
        const json = JSON.parse(response.body);

        // Check if response is an OperationOutcome with errors
        if (json.resourceType === "OperationOutcome" && json.issue) {
          // Collect all diagnostic messages from issues
          const diagnostics = json.issue
            .filter((issue: any) => issue.diagnostics)
            .map((issue: any) => issue.diagnostics);

          if (diagnostics.length > 0) {
            // Display error toast with all diagnostic messages
            toast.error(
              <div className="flex flex-col gap-1">
                <span className="typo-body">Failed to run ViewDefinition</span>
                <div className="flex flex-col gap-1">
                  {diagnostics.map((diagnostic: string, index: number) => (
                    <span key={index} className="typo-code text-text-secondary">
                      • {diagnostic}
                    </span>
                  ))}
                </div>
              </div>,
              { duration: 5000 },
            );
          } else {
            // Generic error message if no diagnostics available
            toast.error(
              <div className="flex flex-col gap-1">
                <span className="typo-body">Failed to run ViewDefinition</span>
                <span className="typo-code text-text-secondary">
                  {json.issue[0]?.code || "Unknown error occurred"}
                </span>
              </div>,
              { duration: 5000 },
            );
          }

          // Still show the error in the response panel for debugging
          onRunResponse(JSON.stringify(json, null, 2));
        } else if (json.data && typeof json.data === "string") {
          // Handle successful response with base64 encoded data
          try {
            const decoded = atob(json.data);
            parsedBody = JSON.parse(decoded);
          } catch {
            parsedBody = json.data;
          }
          onRunResponse(JSON.stringify(parsedBody, null, 2));
        } else if (json.data) {
          // Handle successful response with direct data
          parsedBody = json.data;
          onRunResponse(JSON.stringify(parsedBody, null, 2));
        } else {
          // Handle other response formats
          onRunResponse(JSON.stringify(json, null, 2));
        }
      } catch {
        onRunResponse(response.body);
      }
    } catch (error) {
      console.error("Error running ViewDefinition:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      onRunResponse(JSON.stringify({ error: errorMessage }, null, 2));
    } finally {
      setRunResponseVersion(crypto.randomUUID());
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
          <div className="flex items-center gap-8">
            <span className="typo-label text-text-secondary truncate">
              View Definition:
            </span>
            <TabsList>
              <TabsTrigger value="form" className="px-0 mr-6">
                Form
              </TabsTrigger>
              <TabsTrigger value="code" className="px-0 mr-6">
                Code
              </TabsTrigger>
              <TabsTrigger value="sql" className="px-0">
                SQL
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <div className="flex flex-col grow min-h-0">
          <TabsContent value="form" className="grow min-h-0">
            {localFormViewDef && (
              <ViewDefinitionForm
                viewDefinition={localFormViewDef}
                onUpdate={setLocalFormViewDef}
              />
            )}
          </TabsContent>
          <TabsContent value="code" className="grow min-h-0">
            {isLoadingViewDef ? (
              <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center">
                  <div className="text-lg mb-2">Loading ViewDefinition...</div>
                  <div className="text-sm">Fetching content from Aidbox</div>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <div className="absolute top-2 right-3 z-10">
                  <CodeEditorMenu
                    mode={codeMode}
                    onModeChange={setCodeMode}
                    copyText={codeContent}
                    onFormat={handleFormatCode}
                  />
                </div>
                <CodeEditor
                  currentValue={codeContent}
                  onChange={handleCodeContentChange}
                  mode={codeMode === "yaml" ? "yaml" : "json"}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="sql" className="grow min-h-0">
            {isLoadingSQL ? (
              <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center">
                  <div className="text-lg mb-2">Loading SQL...</div>
                  <div className="text-sm">
                    Generating SQL query from ViewDefinition
                  </div>
                </div>
              </div>
            ) : (
              <CodeEditor
                readOnly={true}
                currentValue={sqlContent}
                mode="sql"
              />
            )}
          </TabsContent>
        </div>
        <div className="border-t p-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4" />
            Save
          </Button>
          <Button variant="primary" onClick={handleRun} disabled={isLoading}>
            <PlayIcon />
            Run
          </Button>
        </div>
      </Tabs>
    </div>
  );
}

function RightPanel({
  routeId,
  viewDefinition,
  isLoadingViewDef,
}: {
  routeId: string;
  viewDefinition: ViewDefinition | null;
  isLoadingViewDef: boolean;
}) {
  const [activeTab, setActiveTab] = useLocalStorage<"schema" | "examples">({
    key: `viewDefinition-rightPanel-activeTab-${routeId}`,
    defaultValue: "schema",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [exampleResource, setExampleResource] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>(
    [],
  );
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [exampleMode, setExampleMode] = useLocalStorage<"json" | "yaml">({
    key: `viewDefinition-rightPanel-exampleMode-${routeId}`,
    defaultValue: "json",
  });
  const [schemaData, setSchemaData] = useState<any>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const resourceType = viewDefinition?.resource || "Patient";

  // Fetch schema when activeTab changes to "schema" or resourceType changes
  useEffect(() => {
    if (activeTab === "schema" && resourceType && !isLoadingViewDef) {
      const fetchSchema = async () => {
        setIsLoadingSchema(true);
        setSchemaError(null);
        try {
          const response = await AidboxCallWithMeta({
            method: "POST",
            url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              method: "aidbox.introspector/get-schemas-by-resource-type",
              params: { "resource-type": resourceType },
            }),
          });

          try {
            const data = JSON.parse(response.body);

            // Extract the object with "default?": true from the result
            if (data?.result) {
              const defaultSchema = Object.values(data.result).find(
                (schema: any) => schema?.["default?"] === true,
              );

              if (defaultSchema) {
                // Extract only the differential value from the default schema
                const differential = (defaultSchema as any)?.snapshot;
                setSchemaData(differential || defaultSchema);
              } else {
                // If no default schema found, try to use the first one
                const schemas = Object.values(data.result);
                const firstSchema = schemas[0] as any;
                const differential = firstSchema?.differential;
                setSchemaData(differential || firstSchema || data);
              }
            } else {
              // Fallback to the entire response if no result property
              setSchemaData(data);
            }
          } catch (parseError) {
            console.error("Failed to parse schema response:", parseError);
            setSchemaError("Failed to parse schema response");
          }
        } catch (error) {
          setSchemaError(
            error instanceof Error ? error.message : "Failed to fetch schema",
          );
        } finally {
          setIsLoadingSchema(false);
        }
      };

      fetchSchema();
    }
  }, [activeTab, resourceType, isLoadingViewDef]);

  // Auto-fetch examples when tab changes to "examples" and no data exists
  useEffect(() => {
    if (
      activeTab === "examples" &&
      viewDefinition?.resource &&
      !exampleResource &&
      !searchResults.length &&
      !isLoadingExample
    ) {
      // Perform initial search without parameters to get all available instances
      handleSearch("");
    }
  }, [activeTab, viewDefinition?.resource]);

  const handleSearch = async (query?: string) => {
    if (!viewDefinition?.resource) return;

    setIsLoadingExample(true);
    try {
      const searchParams = query !== undefined ? query : searchQuery;
      const url = searchParams.trim()
        ? `/fhir/${viewDefinition.resource}?${searchParams}`
        : `/fhir/${viewDefinition.resource}`;

      const response = await AidboxCall<{
        entry?: Array<{ resource: Record<string, unknown> }>;
      }>({
        method: "GET",
        url: url,
        headers: {
          Accept: "application/json",
        },
      });

      if (response?.entry && response.entry.length > 0) {
        const resources = response.entry.map((entry) => entry.resource);
        setSearchResults(resources);
        setCurrentResultIndex(0);
        setExampleResource(resources[0] || null);
      } else {
        setSearchResults([]);
        setCurrentResultIndex(0);
        setExampleResource({ message: "No results found" });
      }
    } catch (error) {
      setSearchResults([]);
      setCurrentResultIndex(0);
      setExampleResource({
        error: "Failed to fetch resource",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoadingExample(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handlePrevious = () => {
    if (currentResultIndex > 0 && searchResults.length > 0) {
      const newIndex = currentResultIndex - 1;
      setCurrentResultIndex(newIndex);
      setExampleResource(searchResults[newIndex] || null);
    }
  };

  const handleNext = () => {
    if (currentResultIndex < searchResults.length - 1) {
      const newIndex = currentResultIndex + 1;
      setCurrentResultIndex(newIndex);
      setExampleResource(searchResults[newIndex] || null);
    }
  };

  const canGoToPrevious = currentResultIndex > 0;
  const canGoToNext = currentResultIndex < searchResults.length - 1;

  // Transform differential data to tree format for FHIRStructureView
  const transformDifferentialToTree = (data: any) => {
    // Handle different possible data structures
    let elements: any[] = [];

    // Check if data.snapshot is an array (prioritize snapshot over differential)
    if (data?.snapshot && Array.isArray(data.snapshot)) {
      elements = data.snapshot;
    } else if (Array.isArray(data)) {
      elements = data;
    } else if (data?.element && Array.isArray(data.element)) {
      elements = data.element;
    } else if (
      data?.snapshot?.element &&
      Array.isArray(data.snapshot.element)
    ) {
      elements = data.snapshot.element;
    } else if (
      data?.differential?.element &&
      Array.isArray(data.differential.element)
    ) {
      elements = data.differential.element;
    } else {
      const possibleArrays = Object.values(data || {}).filter((v) =>
        Array.isArray(v),
      );
      if (possibleArrays.length > 0) {
        elements = possibleArrays[0] as any[];
      }
    }

    if (!elements || elements.length === 0) {
      return {};
    }

    const tree: Record<string, any> = {};
    const childrenMap: Record<string, string[]> = {};

    // First pass: create all nodes and collect parent-child relationships
    elements.forEach((element: any) => {
      // Skip root elements that are just type indicators
      if (element.type === "root") return;

      const path = element.path || element.id;
      if (!path) return;

      const parts = path.split(".");
      const name = element.name || parts[parts.length - 1];

      // Handle union types (elements ending with [x] or with union? flag)
      const isUnion = element["union?"] === true;
      const displayName =
        isUnion && !name.includes("[x]") ? `${name}[x]` : name;

      // Create the node
      const node: any = {
        name: displayName,
        meta: {},
      };

      // Map properties from the new differential format to meta
      if (element.min !== undefined && element.min !== null) {
        node.meta.min = String(element.min);
      }
      if (element.max !== undefined && element.max !== null) {
        node.meta.max = element.max === "*" ? "*" : String(element.max);
      }

      // Use short for description, fallback to desc
      if (element.short) {
        node.meta.short = element.short;
      }
      if (element.desc) {
        node.meta.desc = element.desc;
      }
      // Set description to short or desc for backward compatibility
      node.meta.description = element.short || element.desc;

      // Set the datatype
      if (isUnion) {
        node.meta.type = "union";
      } else if (element.datatype) {
        node.meta.type = element.datatype;
      } else if (element.type === "complex") {
        node.meta.type = element.datatype || "BackboneElement";
      } else if (element.type) {
        node.meta.type = element.type;
      }

      // Handle flags array
      if (element.flags && Array.isArray(element.flags)) {
        element.flags.forEach((flag: string) => {
          if (flag === "summary") node.meta.isSummary = true;
          if (flag === "modifier") node.meta.isModifier = true;
          if (flag === "mustSupport") node.meta.mustSupport = true;
        });
      }

      // Handle extension metadata
      if (element["extension-url"]) {
        node.meta.extensionUrl = element["extension-url"];
      }
      if (element["extension-coordinate"]) {
        node.meta.extensionCoordinate = element["extension-coordinate"];
      }

      // Handle binding metadata
      if (element.binding) {
        node.meta.binding = element.binding;
      }
      if (element["vs-coordinate"]) {
        node.meta.vsCoordinate = element["vs-coordinate"];
      }

      tree[path] = node;

      // Track parent-child relationships based on lvl or path structure
      // But we need to be careful with union children
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];

        // Check all possible parent paths to find if this is a union child
        let addedToUnionParent = false;

        // For a path like "Patient.deceasedBoolean", check if there's a union "Patient.deceased"
        // We need to find union elements whose path could be a parent of this element
        elements.forEach((potentialParent: any) => {
          if (
            !addedToUnionParent &&
            potentialParent["union?"] === true &&
            potentialParent.path
          ) {
            const unionParts = potentialParent.path.split(".");
            const unionName = unionParts[unionParts.length - 1];

            // For "Patient.deceasedBoolean" to be a child of "Patient.deceased":
            // 1. The element name "deceasedBoolean" must start with "deceased"
            // 2. The element must be at the same level as where the union would be
            if (lastPart.startsWith(unionName) && lastPart !== unionName) {
              // Check if this union could be our parent
              // We replace our last part with just the union name and see if it matches
              const possibleUnionPath =
                parts.slice(0, -1).join(".") + "." + unionName;

              if (potentialParent.path === possibleUnionPath) {
                // This element is a child of the union!
                if (!childrenMap[potentialParent.path]) {
                  childrenMap[potentialParent.path] = [];
                }
                // Only add if not already present (prevent duplicates)
                if (!childrenMap[potentialParent.path].includes(path)) {
                  childrenMap[potentialParent.path].push(path);
                }
                addedToUnionParent = true;
              }
            }
          }
        });

        // Only add to the regular parent if we didn't add it to a union parent
        if (!addedToUnionParent) {
          const parentPath = parts.slice(0, -1).join(".");
          if (!childrenMap[parentPath]) {
            childrenMap[parentPath] = [];
          }
          // Only add if not already present (prevent duplicates)
          if (!childrenMap[parentPath].includes(path)) {
            childrenMap[parentPath].push(path);
          }
        }
      }
    });

    // Second pass: add children arrays and mark last nodes
    Object.entries(childrenMap).forEach(([parentPath, children]) => {
      if (tree[parentPath]) {
        tree[parentPath].children = children;

        // Mark the last child node
        if (children.length > 0) {
          const lastChildPath = children[children.length - 1];
          if (
            tree[lastChildPath] &&
            (!childrenMap[lastChildPath] ||
              childrenMap[lastChildPath].length === 0)
          ) {
            tree[lastChildPath].meta.lastNode = true;
          }
        }
      }
    });

    // Union children are now handled in the first pass above where we build the childrenMap

    // Identify the resource type - look for the root element or the first path without dots
    let resourceType = "";

    // First try to find a root type element
    const rootElement = elements.find((e: any) => e.type === "root");
    if (rootElement && rootElement.name) {
      resourceType = rootElement.name;
    } else {
      // Otherwise find the first element with a single-part path
      elements.forEach((element: any) => {
        const path = element.path || element.id;
        if (path && !path.includes(".")) {
          resourceType = path;
        }
      });

      // If still not found, extract from first path
      if (!resourceType && elements.length > 0) {
        const firstPath = elements.find((e: any) => e.path)?.path;
        if (firstPath) {
          resourceType = firstPath.split(".")[0];
        }
      }
    }

    // Create or update the main resource node
    if (resourceType) {
      // Find all direct children of the resource
      // But exclude union children (e.g., exclude Patient.deceasedBoolean if Patient.deceased is a union)
      const directChildren: string[] = [];
      Object.keys(tree).forEach((path) => {
        const parts = path.split(".");
        if (parts.length === 2 && parts[0] === resourceType) {
          // Check if this is a union child (but not the union itself)
          const elementName = parts[1];
          let isUnionChild = false;

          // Look for a union parent that this could belong to
          elements.forEach((element: any) => {
            if (element["union?"] === true && element.path) {
              const unionName = element.path.split(".").pop();
              // If this element's name starts with a union name AND is not the union itself, it's a union child
              if (
                elementName.startsWith(unionName) &&
                elementName !== unionName && // Don't exclude the union itself
                element.path === `${resourceType}.${unionName}`
              ) {
                isUnionChild = true;
              }
            }
          });

          if (!isUnionChild && !directChildren.includes(path)) {
            directChildren.push(path);
          }
        }
      });

      // If the main resource node doesn't exist in the tree, create it
      if (!tree[resourceType]) {
        const resourceElement = elements.find(
          (e: any) =>
            e.path === resourceType ||
            (e.type === "root" && e.name === resourceType),
        );

        tree[resourceType] = {
          name: resourceType,
          meta: {
            type: "Resource",
            min: "0",
            max: "*",
            description:
              resourceElement?.short ||
              resourceElement?.desc ||
              `Information about ${resourceType}`,
          },
          children: directChildren,
        };
      } else {
        // Update children if the resource exists
        if (
          !tree[resourceType].children ||
          tree[resourceType].children.length === 0
        ) {
          tree[resourceType].children = directChildren;
        }
      }
    }

    // Always create a root node that points to the main resource
    tree.root = {
      name: "Root",
      children: resourceType ? [resourceType] : [],
    };

    return tree;
  };

  const fhirStructureTree = useMemo(() => {
    if (schemaData) {
      return transformDifferentialToTree(schemaData);
    }
    return {};
  }, [schemaData]);

  // Generate copy text based on current mode and content
  const getCopyText = () => {
    if (!exampleResource) {
      const defaultContent = {
        resourceType,
        hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
        examples: ["_id=<resource-id>", "name=<name>", "_count=10"],
      };
      return exampleMode === "yaml"
        ? yaml.dump(defaultContent, { indent: 2 })
        : JSON.stringify(defaultContent, null, 2);
    }

    return exampleMode === "yaml"
      ? yaml.dump(exampleResource, { indent: 2 })
      : JSON.stringify(exampleResource, null, 2);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "schema" | "examples")}
      >
        <div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
          <div className="flex items-center gap-8">
            <span className="typo-label text-text-secondary">Resource:</span>
            <TabsList>
              <TabsTrigger value="schema" className="px-0 mr-6">
                Schema
              </TabsTrigger>
              <TabsTrigger value="examples" className="px-0">
                Instance Examples
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="schema" className="h-full overflow-auto">
          {isLoadingViewDef || isLoadingSchema ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="text-center">
                <div className="text-lg mb-2">Loading schema...</div>
                <div className="text-sm">Fetching {resourceType} schema</div>
              </div>
            </div>
          ) : schemaError ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="text-center">
                <div className="text-lg mb-2 text-red-600">
                  Error loading schema
                </div>
                <div className="text-sm">{schemaError}</div>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full overflow-auto">
              <FHIRStructureView tree={fhirStructureTree} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="examples" className="flex flex-col h-full">
          <div className="p-3 border-b">
            <div className="flex gap-2">
              <Input
                type="text"
                className="flex-1"
                prefixValue={
                  <span className="text-nowrap">
                    <span className="font-medium">GET</span>
                    <span>{` /fhir/${viewDefinition?.resource || resourceType}?`}</span>
                  </span>
                }
                placeholder={`e.g., _id=123, name=John, _count=10`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button
                variant="secondary"
                onClick={handleSearch}
                disabled={isLoadingExample}
              >
                Search
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoadingViewDef ? (
              <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center">
                  <div className="text-lg mb-2">Loading examples...</div>
                  <div className="text-sm">
                    Fetching {resourceType} examples
                  </div>
                </div>
              </div>
            ) : isLoadingExample ? (
              <div className="flex items-center justify-center h-full text-text-secondary">
                <div className="text-center">
                  <div className="text-lg mb-2">Searching...</div>
                  <div className="text-sm">
                    Fetching {resourceType} instances
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <div className="absolute top-2 right-3 z-10">
                  <ExampleTabEditorMenu
                    mode={exampleMode}
                    onModeChange={setExampleMode}
                    copyText={getCopyText()}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                    canGoToPrevious={canGoToPrevious}
                    canGoToNext={canGoToNext}
                  />
                </div>
                <CodeEditor
                  readOnly
                  currentValue={
                    exampleResource
                      ? exampleMode === "yaml"
                        ? yaml.dump(exampleResource, { indent: 2 })
                        : JSON.stringify(exampleResource, null, 2)
                      : exampleMode === "yaml"
                        ? yaml.dump(
                            {
                              resourceType,
                              hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
                              examples: [
                                "_id=<resource-id>",
                                "name=<name>",
                                "_count=10",
                              ],
                            },
                            { indent: 2 },
                          )
                        : JSON.stringify(
                            {
                              resourceType,
                              hint: `Press Enter in the search bar above to search for ${resourceType} instances`,
                              examples: [
                                "_id=<resource-id>",
                                "name=<name>",
                                "_count=10",
                              ],
                            },
                            null,
                            2,
                          )
                  }
                  mode={exampleMode}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BottomPanel({
  response,
  version,
}: {
  response: string | null;
  version: string;
}) {
  const { tableData, columns, isEmptyArray } = useMemo(() => {
    if (!response) {
      return { tableData: [], columns: [], isEmptyArray: false };
    }

    try {
      const parsedResponse = JSON.parse(response);

      if (Array.isArray(parsedResponse) && parsedResponse.length === 0) {
        return { tableData: [], columns: [], isEmptyArray: true };
      }

      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        const allKeys = new Set<string>();
        parsedResponse.forEach((row) => {
          if (typeof row === "object" && row !== null) {
            Object.keys(row).forEach((key) => allKeys.add(key));
          }
        });

        const columns: ColumnDef<Record<string, any>, any>[] = Array.from(
          allKeys,
        ).map((key) => ({
          accessorKey: key,
          header: key.charAt(0).toUpperCase() + key.slice(1),
          cell: ({ getValue }) => {
            const value = getValue();
            if (value === null || value === undefined) {
              return <span className="text-text-tertiary">null</span>;
            }
            return String(value);
          },
        }));

        return { tableData: parsedResponse, columns, isEmptyArray: false };
      }
    } catch (error) {
      console.error("Error parsing response:", error);
    }

    return { tableData: [], columns: [], isEmptyArray: false };
  }, [response]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
        <span className="typo-label text-text-secondary">
          View Definition Result: {tableData.length} row
          {tableData.length !== 1 ? "s" : ""}
        </span>
      </div>
      {response ? (
        isEmptyArray ? (
          <div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
            <div className="text-center">
              <div className="text-lg mb-2">No results</div>
              <div className="text-sm">
                The query executed successfully but returned no data
              </div>
            </div>
          </div>
        ) : tableData.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <DataTable columns={columns} data={tableData} key={version} />
          </div>
        ) : (
          <div className="flex-1 p-4">
            <CodeEditor readOnly={true} currentValue={response} mode="json" />
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-full text-text-secondary bg-bg-primary">
          <div className="text-center">
            <div className="text-lg mb-2">No results yet</div>
            <div className="text-sm">
              Click Run to execute the ViewDefinition
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewDefinitionPage() {
  const { id } = Route.useParams();
  const [runResponse, setRunResponse] = useState<string | null>(null);
  const [runResponseVersion, setRunResponseVersion] = useState<string>(
    crypto.randomUUID(),
  );

  const [viewDefinition, setViewDefinition] = useState<ViewDefinition | null>(
    null,
  );
  const [isLoadingViewDef, setIsLoadingViewDef] = useState(false);

  useEffect(() => {
    const fetchViewDefinition = async () => {
      setIsLoadingViewDef(true);
      try {
        const fetchedViewDefinition = await AidboxCall<ViewDefinition>({
          method: "GET",
          url: `/fhir/ViewDefinition/${id}`,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (fetchedViewDefinition) {
          setViewDefinition(fetchedViewDefinition);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setRunResponse(
          JSON.stringify(
            { error: `Failed to fetch ViewDefinition: ${errorMessage}` },
            null,
            2,
          ),
        );
      } finally {
        setIsLoadingViewDef(false);
      }
    };

    if (id) {
      fetchViewDefinition();
    }
  }, [id]);

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup
        direction="vertical"
        className="grow"
        autoSaveId={`view-definition-vertical-${id}`}
      >
        <ResizablePanel defaultSize={70} className="min-h-[200px]">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
            autoSaveId={`view-definition-horizontal-${id}`}
          >
            <ResizablePanel defaultSize={50} minSize={20}>
              <LeftPanel
                onRunResponse={setRunResponse}
                routeId={id}
                setRunResponseVersion={setRunResponseVersion}
                viewDefinition={viewDefinition}
                isLoadingViewDef={isLoadingViewDef}
                onViewDefinitionUpdate={setViewDefinition}
              />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50} minSize={20}>
              <RightPanel
                routeId={id}
                viewDefinition={viewDefinition}
                isLoadingViewDef={isLoadingViewDef}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={30} className="min-h-[150px]">
          <BottomPanel response={runResponse} version={runResponseVersion} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
