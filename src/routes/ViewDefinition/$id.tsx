import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ViewDefinition/$id")({
  component: ViewDefinitionPage,
  staticData: {
    title: "View Definitions",
  },
});

function ViewDefinitionPage() {
  const { id } = Route.useParams();

  return (
    <div className="p-4">
      <h1>ViewDefinition: {id}</h1>
    </div>
  );
}
