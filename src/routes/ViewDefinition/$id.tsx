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

  const resourceType = viewDefinition?.resource || "Patient";

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
        <TabsContent value="schema">
          {isLoadingViewDef ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              <div className="text-center">
                <div className="text-lg mb-2">Loading schema...</div>
                <div className="text-sm">Fetching {resourceType} schema</div>
              </div>
            </div>
          ) : (
            <CodeEditor
              readOnly
              defaultValue={JSON.stringify(
                {
                  resourceType,
                  description: `Schema for ${resourceType} resource`,
                  properties: viewDefinition?.select?.[0]?.column || [],
                },
                null,
                2,
              )}
              mode="json"
            />
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
