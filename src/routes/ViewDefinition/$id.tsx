import {
  Button,
  CodeEditor,
  type ColumnDef,
  CopyIcon,
  DataTable,
  Input,
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
  FHIRStructureView,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import { ChevronLeft, ChevronRight, Save, TextQuote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (viewDefinition) {
      if (codeMode === "yaml") {
        setCodeContent(yaml.dump(viewDefinition, { indent: 2 }));
      } else {
        setCodeContent(JSON.stringify(viewDefinition, null, 2));
      }
    }
  }, [viewDefinition, codeMode]);

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
      let viewDefinition: any;
      try {
        if (codeMode === "yaml") {
          viewDefinition = yaml.load(codeContent);
        } else {
          viewDefinition = JSON.parse(codeContent);
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
        body: JSON.stringify(viewDefinition),
      });

      try {
        const parsedBody = JSON.parse(response.body);
        onRunResponse(JSON.stringify({ saved: true, ...parsedBody }, null, 2));
        onViewDefinitionUpdate(parsedBody);
      } catch {
        onRunResponse(response.body);
      }
    } catch (error) {
      console.error("Error saving ViewDefinition:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      onRunResponse(JSON.stringify({ error: errorMessage }, null, 2));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    try {
      let viewDefinition: any;
      try {
        if (codeMode === "yaml") {
          viewDefinition = yaml.load(codeContent);
        } else {
          viewDefinition = JSON.parse(codeContent);
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

      const parametersPayload = {
        resourceType: "Parameters",
        parameter: [
          {
            name: "viewResource",
            resource: viewDefinition,
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
        if (json.data && typeof json.data === "string") {
          try {
            const decoded = atob(json.data);
            parsedBody = JSON.parse(decoded);
          } catch {
            parsedBody = json.data;
          }
        } else {
          parsedBody = json.data;
        }
        onRunResponse(JSON.stringify(parsedBody, null, 2));
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
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "form" | "code" | "sql")
        }
      >
        <div className="flex items-center justify-between bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
          <div className="flex items-center gap-8">
            <span className="typo-label text-text-secondary">
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
            <div className="p-4">
              <p className="text-text-secondary">Form content goes here</p>
            </div>
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
                  onChange={(value) => setCodeContent(value || "")}
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
          console.error("Error fetching schema:", error);
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

  const handleSearch = async () => {
    if (!viewDefinition?.resource) return;

    setIsLoadingExample(true);
    try {
      const url = searchQuery.trim()
        ? `/fhir/${viewDefinition.resource}?${searchQuery}`
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
      console.error("Error fetching resource example:", error);
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
    console.log("Transforming data:", data);

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
      console.log("No elements found after checking all possible paths");
      console.log("Data keys:", Object.keys(data || {}));
      return {};
    }

    console.log("Found elements:", elements.length, "items");
    console.log("First element sample:", elements[0]);

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
        node.meta.description = element.short;
      } else if (element.desc) {
        node.meta.description = element.desc;
      }

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

    console.log("Generated tree with", Object.keys(tree).length, "nodes");
    console.log("Root children:", tree.root.children);
    return tree;
  };

  const fhirStructureTree = useMemo(() => {
    if (schemaData) {
      return transformDifferentialToTree(schemaData);
    }
    return {};
  }, [schemaData]);

  console.log(JSON.stringify(fhirStructureTree));

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
          View Definition Result:
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
        console.error("Error fetching ViewDefinition:", error);
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
