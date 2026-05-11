import { APIBuilder } from "@atomic-ehr/codegen";

console.log("📦 Generating FHIR R4 Core Types...");

const builder = new APIBuilder()
	.throwException()
	.typescript({
		withDebugComment: false,
		generateProfile: false,
		openResourceTypeSet: true,
	})
	.fromPackageRef("https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/package.tgz")
	.outputTo("./src/fhir-types")
	.typeSchema({
		treeShake: {
			"hl7.fhir.r5.core": {
				"http://hl7.org/fhir/StructureDefinition/OperationOutcome": {},
				"http://hl7.org/fhir/StructureDefinition/Bundle": {},
				"http://hl7.org/fhir/StructureDefinition/Resource": {},
			},
			"org.sql-on-fhir.ig": {
				"https://sql-on-fhir.org/ig/StructureDefinition/ViewDefinition": {},
			},
		},
	})
	.cleanOutput(true);

const report = await builder.generate();

console.log(report);

if (report.success) {
	console.log("✅ FHIR types generated successfully!");
} else {
	console.error("❌ FHIR types generation failed.");
	process.exit(1);
}
