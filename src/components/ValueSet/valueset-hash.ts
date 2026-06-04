import { cleanEmptyValues } from "../../utils/clean-empty-values";
import type { ValueSet } from "./types";

export function computeValueSetHash(vs: ValueSet): string {
	return JSON.stringify(cleanEmptyValues(vs));
}
