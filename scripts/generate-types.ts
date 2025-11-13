import { APIBuilder } from "@atomic-ehr/codegen";

console.log("📦 Generating FHIR R4 Core Types...");

const builder = new APIBuilder()
	.verbose()
	.throwException()
	.fromPackage("hl7.fhir.r4.core", "4.0.1")
	.typescript({ withDebugComment: false })
	.outputTo("./src/fhir-types")
	.cleanOutput(true);

const report = await builder.generate();

console.log(report);

if (report.success) {
	console.log("✅ FHIR R4 types generated successfully!");
} else {
	console.error("❌ FHIR R4 types generation failed.");
	process.exit(1);
}
