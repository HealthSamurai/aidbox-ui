import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@health-samurai/react-components";
import {
  DiamondIcon,
  ChoiceIcon,
  DatatypeIcon,
  ResourceIcon,
  PrimitiveIcon,
  SliceItemIcon,
  ExternalLinkIcon,
} from "./icons";
import "./styles.css";

// Type definitions
export interface Coordinate {
  id?: string;
  label?: string;
  package_spec?: {
    name: string;
    version: string;
  };
}

export interface FHIRElement {
  name: string;
  lvl: number;
  path: string;
  type?: string;
  datatype?: string;
  union?: boolean;
  extension_url?: string;
  slice_type?: string;
  flags?: Set<string>;
  min?: number;
  max?: number | string;
  short?: string;
  desc?: string;
  binding?: string;
  coordinate?: Coordinate;
  extension_coordinate?: Coordinate;
  vs_coordinate?: Coordinate;
  element_reference?: string;
  refers?: Array<{ name: string; package: string; url: string }>;
  children?: FHIRElement[];
}

export interface FHIRStructureTableProps {
  elements: FHIRElement[];
  options?: Record<string, any>;
}

// Utility function for combining classes
function classNames(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

// Nest elements by level to create tree structure
function nestByLevel(items: FHIRElement[]): FHIRElement[] {
  const result: FHIRElement[] = [];
  const stack: Array<number[]> = [];

  for (const item of items) {
    const node: FHIRElement = { ...item, children: [] };
    const lvl = item.lvl;

    // Pop stack until we find the right parent level
    while (stack.length > 0) {
      const parentPath = stack[stack.length - 1];
      const parentLvl = getNestedElement(result, parentPath).lvl;
      if (parentLvl >= lvl) {
        stack.pop();
      } else {
        break;
      }
    }

    if (stack.length === 0) {
      // Add as root element
      const idx = result.length;
      result.push(node);
      stack.push([idx]);
    } else {
      // Add as child of current parent
      const parentPath = stack[stack.length - 1];
      const parent = getNestedElement(result, parentPath);
      if (!parent.children) parent.children = [];
      parent.children.push(node);
      const newChildIdx = parent.children.length - 1;
      stack.push([...parentPath, newChildIdx]);
    }
  }

  return result;
}

// Helper function to get nested element by path
function getNestedElement(
  elements: FHIRElement[],
  path: number[],
): FHIRElement {
  let current = elements[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (current.children) {
      current = current.children[path[i]];
    }
  }
  return current;
}

// Primitive types set
const PRIMITIVE_TYPES = new Set([
  "boolean",
  "integer",
  "string",
  "decimal",
  "uri",
  "url",
  "canonical",
  "base64Binary",
  "instant",
  "date",
  "dateTime",
  "time",
  "code",
  "oid",
  "id",
  "markdown",
  "unsignedInt",
  "positiveInt",
  "uuid",
  "xhtml",
]);

// Name cell component
const NameCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  const getIcon = () => {
    if (element.type === "root") {
      return <ResourceIcon />;
    }
    if (element.extension_url || element.slice_type) {
      return (
        <span className="text-green-600">
          <SliceItemIcon />
        </span>
      );
    }
    if (element.datatype && PRIMITIVE_TYPES.has(element.datatype)) {
      return <PrimitiveIcon />;
    }
    if (element.union) {
      return (
        <span className="text-blue-600">
          <ChoiceIcon />
        </span>
      );
    }
    if (element.datatype === "Reference") {
      return (
        <span className="text-blue-600">
          <ExternalLinkIcon />
        </span>
      );
    }
    return <DatatypeIcon />;
  };

  return (
    <div className="flex pt-2 pb-1 ml-1">
      <div className="pt-[2px]">{getIcon()}</div>
      <div className="pl-2">
        {element.name}
        {element.union && "[x]"}
      </div>
    </div>
  );
};

// Flags cell component
const FlagsCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  return (
    <div className="flex flex-row h-full">
      {element.flags?.has("mustSupport") && (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-[2px] max-h-[20px] text-white bg-red-600 rounded">
              S
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <pre>Must be supported</pre>
          </TooltipContent>
        </Tooltip>
      )}
      {element.flags?.has("summary") && (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-[2px] max-h-[20px] mr-1">Σ</span>
          </TooltipTrigger>
          <TooltipContent>
            <pre>Part of the summary set</pre>
          </TooltipContent>
        </Tooltip>
      )}
      {element.flags?.has("modifier") && (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-[2px] max-h-[20px] mr-1">!?</span>
          </TooltipTrigger>
          <TooltipContent>
            <pre>Modifying element</pre>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

// Cardinality cell component
const CardinalityCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  if (element.lvl === 0) return null;
  const min = element.min ?? 0;
  const max = element.max ?? 1;
  return <div className="flex flex-row h-full">{`${min}..${max}`}</div>;
};

// Datatype cell component
const DatatypeCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  if (element.coordinate) {
    const { id, label, package_spec } = element.coordinate;
    const href =
      id && package_spec
        ? `#/ig/${package_spec.name}#${package_spec.version}/sd/${id}`
        : undefined;

    return (
      <div>
        <a href={href} className={href ? "text-[#358FEA]" : "text-red-700"}>
          {label}
        </a>
        {element.slice_type}
        {element.refers && (
          <span className="space-x-2">
            {" ("}
            {element.refers.map((r, idx) => (
              <React.Fragment key={r.name}>
                {idx > 0 && ", "}
                <a
                  href={`#/ig/introspector/${encodeURIComponent(r.package)}?url=${encodeURIComponent(r.url)}`}
                  className="text-[#358FEA]"
                >
                  {r.name}
                </a>
              </React.Fragment>
            ))}
            {")"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      {element.element_reference
        ? `see ${element.element_reference}`
        : element.datatype}
    </div>
  );
};

// Description cell component
const DescriptionCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  return (
    <>
      {element.short && <div>{element.short}</div>}
      {!element.short && element.desc && <div>{element.desc}</div>}
      {element.extension_url && (
        <div>
          URL:{" "}
          {element.extension_coordinate && (
            <a
              href={
                element.extension_coordinate.id &&
                element.extension_coordinate.package_spec
                  ? `#/ig/${element.extension_coordinate.package_spec.name}#${element.extension_coordinate.package_spec.version}/sd/${element.extension_coordinate.id}`
                  : undefined
              }
              className={
                element.extension_coordinate.id
                  ? "text-[#358FEA]"
                  : "text-red-700"
              }
            >
              {element.extension_coordinate.label}
            </a>
          )}
        </div>
      )}
      {element.binding && element.vs_coordinate && (
        <div>
          Binding:{" "}
          <a
            href={
              element.vs_coordinate.id && element.vs_coordinate.package_spec
                ? `#/ig/${element.vs_coordinate.package_spec.name}#${element.vs_coordinate.package_spec.version}/vs/${element.vs_coordinate.id}`
                : undefined
            }
            className={
              element.vs_coordinate.id ? "text-[#358FEA]" : "text-red-700"
            }
          >
            {element.vs_coordinate.label}
          </a>
        </div>
      )}
    </>
  );
};

// Tree node component
const TreeNode: React.FC<{
  element: FHIRElement;
  lastChilds: FHIRElement[];
}> = ({ element, lastChilds }) => {
  const isLastChild = lastChilds.some((lc) => lc.path === element.path);

  if (!element.children || element.children.length === 0) {
    return (
      <tr className="group">
        <td
          className={classNames(
            "px-4 py-2 align-top text-[#010205] font-inter flex h-full pl-[15px] py-0",
          )}
        >
          <div className="element flex h-full">
            {Array.from({ length: element.lvl }).map((_, i) => (
              <span key={i} className="block li w-[15px] h-auto" />
            ))}
          </div>
          <div className="z-10 bg-white group-even:bg-[#f7f7f8]">
            <NameCell element={element} />
            {isLastChild && (
              <div className="relative -left-[15px] h-full -top-[10px] border-l border-white group-even:border-[#f7f7f8]" />
            )}
          </div>
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter space-x-2">
          <FlagsCell element={element} />
        </td>
        <td
          className="px-4 py-2 align-top text-[#010205] font-inter"
          style={{ fontFamily: "JetBrains Mono" }}
        >
          <CardinalityCell element={element} />
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter">
          <DatatypeCell element={element} />
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter text-[12px]">
          <DescriptionCell element={element} />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="group">
        <td
          className={classNames(
            "px-4 py-2 align-top text-[#010205] font-inter flex h-full pl-[15px] py-0",
          )}
        >
          <div className="element flex h-full">
            {Array.from({ length: element.lvl }).map((_, i) => (
              <span key={i} className="block li w-[15px] h-auto" />
            ))}
          </div>
          <div className="z-10 bg-white group-even:bg-[#f7f7f8]">
            <NameCell element={element} />
            {element.lvl !== 0 && (
              <div className="ml-[10px] h-[calc(100%-6px)] border-l border-dotted border-[#b3bac0]" />
            )}
          </div>
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter space-x-2">
          <FlagsCell element={element} />
        </td>
        <td
          className="px-4 py-2 align-top text-[#010205] font-inter"
          style={{ fontFamily: "JetBrains Mono" }}
        >
          <CardinalityCell element={element} />
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter">
          <DatatypeCell element={element} />
        </td>
        <td className="px-4 py-2 align-top text-[#010205] font-inter text-[12px]">
          <DescriptionCell element={element} />
        </td>
      </tr>
      {element.children.map((child) => (
        <TreeNode key={child.name} element={child} lastChilds={lastChilds} />
      ))}
    </>
  );
};

// Main component
export const FHIRStructureTable: React.FC<FHIRStructureTableProps> = ({
  elements,
  options,
}) => {
  const nestedElements = nestByLevel(elements);

  // Find last childs (elements where next element has lower level or is root)
  const lastChilds = elements.filter((element, idx) => {
    const nextElement = elements[idx + 1];
    if (!nextElement) return false;
    return nextElement.lvl === 0 || nextElement.lvl === element.lvl - 1;
  });

  return (
    <table className="w-full h-[1px] font-[Inter] text-[12px] font-normal">
      <thead>
        <tr className="sticky top-0 z-50">
          <th className="px-4 py-2 text-left font-normal bg-[var(--color-surface-1)] text-[#1D2331]">
            Name
          </th>
          <th className="px-4 py-2 text-left font-normal bg-[var(--color-surface-1)] text-[#1D2331]">
            Flags
          </th>
          <th className="px-4 py-2 text-left font-normal bg-[var(--color-surface-1)] text-[#1D2331]">
            Card.
          </th>
          <th className="px-4 py-2 text-left font-normal bg-[var(--color-surface-1)] text-[#1D2331]">
            Type
          </th>
          <th className="px-4 py-2 text-left font-normal bg-[var(--color-surface-1)] text-[#1D2331]">
            Description
          </th>
        </tr>
      </thead>
      <tbody className="tree">
        {nestedElements.map((node) => (
          <TreeNode key={node.name} element={node} lastChilds={lastChilds} />
        ))}
      </tbody>
    </table>
  );
};

export default FHIRStructureTable;
