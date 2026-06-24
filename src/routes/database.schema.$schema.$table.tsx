import { createFileRoute } from "@tanstack/react-router";
import { TableDetail } from "../components/database/table-detail";

export const Route = createFileRoute("/database/schema/$schema/$table")({
	loader: (cx) => ({ breadCrumb: `${cx.params.schema}.${cx.params.table}` }),
	component: RouteComponent,
});

function RouteComponent() {
	const { schema, table } = Route.useParams();
	return <TableDetail schema={schema} table={table} />;
}
