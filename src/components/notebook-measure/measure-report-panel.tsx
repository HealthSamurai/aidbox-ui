import { useMeasure } from "./measure-api";
import { MeasurePatients } from "./measure-patients";
import { MeasureReportView, type PatientsSlot } from "./measure-report-view";
import type { Measure, MeasureReport } from "./measure-types";

const renderPatients: PatientsSlot = (ctx) => <MeasurePatients {...ctx} />;

// A MeasureReport rendered with its Measure's definitions (looked up by the
// report's canonical unless the caller already has it) and, for a summary
// over a SQL-backed Measure, the per-patient drill-down.
export function MeasureReportPanel({
	report,
	measure,
	showMeasure = true,
}: {
	report: MeasureReport;
	measure?: Measure | null;
	showMeasure?: boolean;
}) {
	const { data: fetched } = useMeasure(
		measure === undefined ? report.measure : null,
	);
	return (
		<MeasureReportView
			report={report}
			measure={measure ?? fetched}
			showMeasure={showMeasure}
			patients={renderPatients}
		/>
	);
}
