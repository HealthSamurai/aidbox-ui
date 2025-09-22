import {
  CodeEditor,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/ViewDefinition/$id")({
  component: ViewDefinitionPage,
  staticData: {
    title: "View Definitions",
  },
});

function LeftPanel() {
  const [activeTab, setActiveTab] = useState<"form" | "code" | "sql">("form");

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
              {/*why tabs have different spacings?*/}
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
        <TabsContent value="form">
          <div className="p-4">
            <p className="text-text-secondary">Form content goes here</p>
          </div>
        </TabsContent>
        <TabsContent value="code">
          <CodeEditor defaultValue="{}" mode="json" />
        </TabsContent>
        <TabsContent value="sql">
          <CodeEditor readOnly currentValue="" mode="sql" />
        </TabsContent>
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

function ViewDefinitionPage() {
  const { id } = Route.useParams();

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup
        direction="horizontal"
        className="grow"
        autoSaveId={`view-definition-${id}`}
      >
        <ResizablePanel defaultSize={50} className="min-w-[200px]">
          <LeftPanel />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} className="min-w-[200px]">
          <RightPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
