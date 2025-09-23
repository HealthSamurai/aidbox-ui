import { useMemo } from "react";
import type { FHIRElement } from "./FHIRStructureTable";

/**
 * Hook to transform the differential schema data from Aidbox into FHIRElement format
 * for the FHIRStructureTable component
 */
export function useFHIRStructureTable(schemaData: any): FHIRElement[] {
  return useMemo(() => {
    if (!schemaData) return [];

    // Transform the differential schema into FHIRElement format
    const transformElement = (element: any, level: number = 0): FHIRElement => {
      const flags = new Set<string>();

      // Parse flags from the schema
      if (element.mustSupport) flags.add("mustSupport");
      if (element.isSummary) flags.add("summary");
      if (element.isModifier) flags.add("modifier");

      // Get the name from path or id
      let name = element.id || element.path || "unknown";
      // If it's a nested path, get the last segment
      if (name.includes(".")) {
        const segments = name.split(".");
        name = segments[segments.length - 1];
      }

      // Handle choice types ([x])
      const isUnion = element.path?.includes("[x]") || name.endsWith("[x]");

      return {
        name: name,
        lvl: level,
        path: element.path || element.id || "",
        type: element.type?.[0]?.code,
        datatype: element.type?.[0]?.code || element.type,
        union: isUnion,
        extension_url: element.extension?.[0]?.url,
        slice_type: element.slicing?.discriminator?.[0]?.type,
        flags,
        min: element.min,
        max: element.max === "*" ? "∗" : element.max,
        short: element.short,
        desc: element.definition,
        binding: element.binding?.valueSet || element.binding?.strength,
        coordinate: element.type?.[0]?.profile
          ? {
              id: element.type[0].profile[0],
              label: element.type[0].code,
            }
          : undefined,
        children: [],
      };
    };

    // If schemaData is an array of elements (differential.element)
    if (Array.isArray(schemaData)) {
      const elements: FHIRElement[] = [];

      schemaData.forEach((el: any) => {
        const path = el.path || "";
        const level = path.split(".").length - 1;
        elements.push(transformElement(el, level));
      });

      return elements;
    }

    // If schemaData has a differential property with elements
    if (schemaData.differential?.element) {
      const elements: FHIRElement[] = [];

      schemaData.differential.element.forEach((el: any) => {
        const path = el.path || "";
        const level = path.split(".").length - 1;
        elements.push(transformElement(el, level));
      });

      return elements;
    }

    // If schemaData has element property directly
    if (schemaData.element) {
      const elements: FHIRElement[] = [];

      schemaData.element.forEach((el: any) => {
        const path = el.path || "";
        const level = path.split(".").length - 1;
        elements.push(transformElement(el, level));
      });

      return elements;
    }

    // Fallback: try to parse as a single structure definition
    if (schemaData.snapshot?.element || schemaData.differential?.element) {
      const sourceElements =
        schemaData.snapshot?.element || schemaData.differential?.element;
      const elements: FHIRElement[] = [];

      sourceElements.forEach((el: any) => {
        const path = el.path || "";
        const level = path.split(".").length - 1;
        elements.push(transformElement(el, level));
      });

      return elements;
    }

    return [];
  }, [schemaData]);
}
