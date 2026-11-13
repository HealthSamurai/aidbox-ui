import fsp from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

// The canonical manager reads every resource of a package at once; R4 core
// alone is more files than the usual 4096 open-file limit (EMFILE). Queue the
// reads before the codegen is loaded, so its `node:fs/promises` import sees it.
const MAX_PARALLEL_READS = 256;
const readFile = fsp.readFile;
const waiting: Array<() => void> = [];
let reading = 0;
fsp.readFile = (async (...args: Parameters<typeof readFile>) => {
	if (reading >= MAX_PARALLEL_READS)
		await new Promise<void>((resolve) => waiting.push(resolve));
	else reading++;
	try {
		return await readFile(...args);
	} finally {
		const next = waiting.shift();
		if (next) next();
		else reading--;
	}
}) as typeof readFile;
syncBuiltinESMExports();

const { APIBuilder } = await import("@atomic-ehr/codegen");

const OUTPUT = "./src/fhir-types";

// R5 core comes in through the SQL-on-FHIR IG and only supplies the
// version-neutral types the client and the generic screens use. The SDC
// screens edit what the box stores, which is R4: packages are RequestGroups,
// and questions still have `choice` / `open-choice` types.
//
// R4 and R5 share canonical URLs (ValueSets above all), so each version gets a
// build of its own; in one build R5 types pick up R4 code lists.

const SDC_CONFIG_STRUCTURE_DEFINITION_URL =
	"http://health-samurai.io/fhir/sdc/StructureDefinition/SDCConfig";
// Still in the package, no longer read or written by the box.
const OBSOLETE_SDC_CONFIG_ELEMENT_PATHS = new Set([
	"SDCConfig.builder.custom-renderers.source",
	"SDCConfig.builder.custom-renderers.title",
]);

const typescriptOptions = {
	withDebugComment: false,
	generateProfile: false,
	openResourceTypeSet: true,
};

const r5 = new APIBuilder()
	.throwException()
	.typescript(typescriptOptions)
	.fromPackageRef("https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/package.tgz")
	// The IG names its FHIR version but not the core package, which its
	// ViewDefinition types build on.
	.fromPackage("hl7.fhir.r5.core", "5.0.0")
	.outputTo(OUTPUT)
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

const r4 = new APIBuilder({
	preprocessPackage(context) {
		if (
			context.kind !== "resource" ||
			context.resource.url !== SDC_CONFIG_STRUCTURE_DEFINITION_URL
		) {
			return context;
		}

		const resource = structuredClone(context.resource);

		for (const sectionName of ["differential", "snapshot"] as const) {
			const section = resource[sectionName] as
				| { element?: Array<{ path?: string }> }
				| undefined;

			if (section?.element) {
				section.element = section.element.filter(
					(element) =>
						!element.path ||
						!OBSOLETE_SDC_CONFIG_ELEMENT_PATHS.has(element.path),
				);
			}
		}

		return { ...context, resource };
	},
})
	.throwException()
	.typescript(typescriptOptions)
	.fromPackage("hl7.fhir.r4.core", "4.0.1")
	.fromPackage("io.health-samurai.core.r4", "0.2610.2")
	.fromPackage("io.health-samurai.sdc.r4", "0.2610.2")
	.outputTo(OUTPUT)
	.typeSchema({
		treeShake: {
			"hl7.fhir.r4.core": {
				"http://hl7.org/fhir/StructureDefinition/OperationOutcome": {},
				"http://hl7.org/fhir/StructureDefinition/Bundle": {},
				"http://hl7.org/fhir/StructureDefinition/Resource": {},
				"http://hl7.org/fhir/StructureDefinition/Patient": {},
				"http://hl7.org/fhir/StructureDefinition/Encounter": {},
				"http://hl7.org/fhir/StructureDefinition/Questionnaire": {},
				"http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse": {},
				"http://hl7.org/fhir/StructureDefinition/PlanDefinition": {},
				"http://hl7.org/fhir/StructureDefinition/RequestGroup": {},
				"http://hl7.org/fhir/StructureDefinition/Task": {},
				"http://hl7.org/fhir/StructureDefinition/DomainResource": {
					ignoreFields: ["extension", "modifierExtension"],
				},
				"http://hl7.org/fhir/StructureDefinition/BackboneElement": {
					ignoreFields: ["modifierExtension"],
				},
				"http://hl7.org/fhir/StructureDefinition/Element": {
					ignoreFields: ["extension"],
				},
			},
			"io.health-samurai.sdc.r4": {
				"http://health-samurai.io/fhir/sdc/StructureDefinition/QuestionnaireTheme":
					{},
				"http://health-samurai.io/fhir/sdc/StructureDefinition/SDCConfig": {},
			},
		},
	})
	// Keeps what the R5 build has just written.
	.cleanOutput(false);

for (const [name, builder] of [
	["R5 core and SQL-on-FHIR", r5],
	["R4 core and SDC", r4],
] as const) {
	console.log(`📦 Generating ${name} types...`);
	const report = await builder.generate();
	console.log(report);
	if (!report.success) {
		console.error(`❌ ${name} types generation failed.`);
		process.exit(1);
	}
}

console.log("✅ FHIR types generated successfully!");
