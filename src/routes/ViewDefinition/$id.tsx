import {
  Button,
  CodeEditor,
  PlayIcon,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState } from "react";
import { AidboxCallWithMeta } from "../../api/auth";

export const Route = createFileRoute("/ViewDefinition/$id")({
  component: ViewDefinitionPage,
  staticData: {
    title: "View Definitions",
  },
});

function LeftPanel({
  onRunResponse,
}: {
  onRunResponse: (response: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<"form" | "code" | "sql">("form");
  const [codeContent, setCodeContent] = useState(
    JSON.stringify(
      {
        resourceType: "ViewDefinition",
        id: "patient_view",
        name: "patient_view",
        status: "draft",
        resource: "Patient",
        description: "Patient flat view",
        select: [
          {
            column: [
              { name: "id", path: "id", type: "id" },
              { name: "birthDate", path: "birthDate", type: "date" },
              { name: "gender", path: "gender", type: "code" },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Parse the ViewDefinition from the code editor
      let viewDefinition;
      try {
        viewDefinition = JSON.parse(codeContent);
      } catch (parseError) {
        console.error("Invalid JSON in code editor:", parseError);
        onRunResponse(
          JSON.stringify({ error: "Invalid JSON in code editor" }, null, 2),
        );
        setIsSaving(false);
        return;
      }

      // Extract the ID from the ViewDefinition
      const id = viewDefinition.id;
      if (!id) {
        console.error("ViewDefinition must have an id field");
        onRunResponse(
          JSON.stringify(
            { error: "ViewDefinition must have an id field" },
            null,
            2,
          ),
        );
        setIsSaving(false);
        return;
      }

      const response = await AidboxCallWithMeta({
        method: "PUT",
        url: `/fhir/ViewDefinition/${id}`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(viewDefinition),
      });

      // Parse and format the response
      try {
        const parsedBody = JSON.parse(response.body);
        onRunResponse(JSON.stringify({ saved: true, ...parsedBody }, null, 2));
      } catch {
        onRunResponse(response.body);
      }
    } catch (error) {
      console.error("Error saving ViewDefinition:", error);
      onRunResponse(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    try {
      // Parse the ViewDefinition from the code editor
      let viewDefinition;
      try {
        viewDefinition = JSON.parse(codeContent);
      } catch (parseError) {
        console.error("Invalid JSON in code editor:", parseError);
        onRunResponse(
          JSON.stringify({ error: "Invalid JSON in code editor" }, null, 2),
        );
        setIsLoading(false);
        return;
      }

      // Wrap the ViewDefinition in Parameters object as required by the API
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
          Accept: "application/json",
        },
        body: JSON.stringify(parametersPayload),
      });

      // Parse and format the response
      try {
        const parsedBody = JSON.parse(response.body);
        onRunResponse(JSON.stringify(parsedBody, null, 2));
      } catch {
        onRunResponse(response.body);
      }
    } catch (error) {
      console.error("Error running ViewDefinition:", error);
      onRunResponse(JSON.stringify({ error: error.message }, null, 2));
    } finally {
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
        className="flex flex-col h-full"
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
        <div className="flex-1 flex flex-col">
          <TabsContent value="form" className="flex-1">
            <div className="p-4">
              <p className="text-text-secondary">Form content goes here</p>
            </div>
          </TabsContent>
          <TabsContent value="code" className="flex-1">
            <CodeEditor
              defaultValue={codeContent}
              onChange={(value) => setCodeContent(value || "")}
              mode="json"
            />
          </TabsContent>
          <TabsContent value="sql" className="flex-1">
            <CodeEditor readOnly={true} currentValue="" mode="sql" />
          </TabsContent>
        </div>
        <div className="border-t p-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="primary" onClick={handleRun} disabled={isLoading}>
            <PlayIcon />
            {isLoading ? "Running..." : "Run"}
          </Button>
        </div>
      </Tabs>
    </div>
  );
}

function RightPanel() {
  const [activeTab, setActiveTab] = useState<"schema" | "examples">("schema");

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
          <CodeEditor readOnly defaultValue="{}" mode="json" />
        </TabsContent>
        <TabsContent value="examples">
          <CodeEditor readOnly defaultValue="{}" mode="json" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BottomPanel({ response }: { response: string | null }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center bg-bg-secondary pl-6 pr-2 py-3 border-b h-10">
        <span className="typo-label text-text-secondary">
          View Definition Result:
        </span>
      </div>
      {response ? (
        <CodeEditor readOnly={true} currentValue={response} mode="json" />
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
            <ResizablePanel defaultSize={50} className="min-w-[200px]">
              <LeftPanel onRunResponse={setRunResponse} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50} className="min-w-[200px]">
              <RightPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={30} className="min-h-[150px]">
          <BottomPanel response={runResponse} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
