import { createFileRoute } from '@tanstack/react-router'
import { Resources } from "../../components/ResourceBrowser/ViewDefinition/page";

const PageComponent = () => {
  return <Resources />
}

export const Route = createFileRoute('/resourceType/ViewDefinition')({
  component: PageComponent,
	staticData: {
		title: "View Definitions",
	},
})
