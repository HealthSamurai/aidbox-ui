import { cleanEmptyValues } from "../../utils/clean-empty-values";
import type { CodeSystem } from "./types";

export function computeCodeSystemHash(cs: CodeSystem): string {
	return JSON.stringify(cleanEmptyValues(cs));
}
