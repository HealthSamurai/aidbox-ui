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
    <div className="flex items-center gap-1">
      <div className="flex-shrink-0">{getIcon()}</div>
      <div>
        {element.name}
        {element.union && "[x]"}
      </div>
    </div>
  );
};

// Flags cell component
const FlagsCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  return (
    <div className="flex flex-row items-center h-full">
      {element.flags?.has("mustSupport") && (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-[2px] text-white bg-red-600 rounded text-xs">
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
            <span className="px-[2px] mr-1 text-xs">Σ</span>
          </TooltipTrigger>
          <TooltipContent>
            <pre>Part of the summary set</pre>
          </TooltipContent>
        </Tooltip>
      )}
      {element.flags?.has("modifier") && (
        <Tooltip>
          <TooltipTrigger>
            <span className="px-[2px] mr-1 text-xs">!?</span>
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
  return <div className="font-mono text-xs">{`${min}..${max}`}</div>;
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
      <div className="text-xs">
        <a href={href} className={href ? "text-[#358FEA]" : "text-red-700"}>
          {label}
        </a>
        {element.slice_type}
        {element.refers && (
          <span className="space-x-1">
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
    <div className="text-xs">
      {element.element_reference
        ? `see ${element.element_reference}`
        : element.datatype}
    </div>
  );
};

// Description cell component
const DescriptionCell: React.FC<{ element: FHIRElement }> = ({ element }) => {
  return (
    <div className="text-xs">
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
    </div>
  );
};

// Tree line component
const TreeLine: React.FC<{
  level: number;
  isLast: boolean;
  hasChildren: boolean;
}> = ({ level, isLast, hasChildren }) => {
  if (level === 0) return null;

  return (
    <>
      {Array.from({ length: level }).map((_, i) => (
        <span
          key={i}
          className="tree-indent-level"
          style={{
            width: "20px",
            display: "inline-block",
            position: "relative",
            height: "100%",
          }}
        >
          {i === level - 1 ? (
            <>
              <span
                className="tree-vertical"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: isLast ? "0" : "-50%",
                  bottom: isLast ? "50%" : "0",
                  borderLeft: "1px dotted #9ca3af",
                  width: "1px",
                }}
              />
              <span
                className="tree-horizontal"
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  width: "8px",
                  borderTop: "1px dotted #9ca3af",
                  height: "1px",
                }}
              />
            </>
          ) : (
            <span
              className="tree-vertical-through"
              style={{
                position: "absolute",
                left: "10px",
                top: "0",
                bottom: "0",
                borderLeft: "1px dotted #9ca3af",
                width: "1px",
              }}
            />
          )}
        </span>
      ))}
    </>
  );
};

// Tree node component
const TreeNode: React.FC<{
  element: FHIRElement;
  isLast: boolean;
  parentLevels: boolean[];
}> = ({ element, isLast, parentLevels }) => {
  const hasChildren = element.children && element.children.length > 0;

  return (
    <>
      <tr className="group fhir-row">
        <td className="px-2 py-0.5 align-middle">
          <div className="flex items-center" style={{ minHeight: "28px" }}>
            <div
              className="tree-structure"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              {parentLevels.map((isParentLast, i) => (
                <span
                  key={i}
                  className="tree-indent-level"
                  style={{
                    width: "20px",
                    display: "inline-block",
                    position: "relative",
                    height: "28px",
                  }}
                >
                  {!isParentLast && (
                    <span
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "0",
                        bottom: "0",
                        borderLeft: "1px dotted #9ca3af",
                        width: "1px",
                      }}
                    />
                  )}
                </span>
              ))}
              {element.lvl > 0 && (
                <span
                  className="tree-indent-level"
                  style={{
                    width: "20px",
                    display: "inline-block",
                    position: "relative",
                    height: "28px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: isLast ? "0" : "-100%",
                      bottom: isLast ? "50%" : "0",
                      borderLeft: "1px dotted #9ca3af",
                      width: "1px",
                      height: isLast ? "14px" : "auto",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "14px",
                      width: "8px",
                      borderTop: "1px dotted #9ca3af",
                      height: "1px",
                    }}
                  />
                </span>
              )}
            </div>
            <div className="ml-1">
              <NameCell element={element} />
            </div>
          </div>
        </td>
        <td className="px-2 py-0.5 align-middle">
          <FlagsCell element={element} />
        </td>
        <td className="px-2 py-0.5 align-middle">
          <CardinalityCell element={element} />
        </td>
        <td className="px-2 py-0.5 align-middle">
          <DatatypeCell element={element} />
        </td>
        <td className="px-2 py-0.5 align-middle">
          <DescriptionCell element={element} />
        </td>
      </tr>
      {hasChildren &&
        element.children!.map((child, index) => (
          <TreeNode
            key={`${element.path}.${child.name}`}
            element={child}
            isLast={index === element.children!.length - 1}
            parentLevels={[...parentLevels, isLast]}
          />
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

  return (
    <table className="fhir-structure-table w-full font-[Inter] text-[12px] font-normal">
      <thead>
        <tr className="sticky top-0 z-50">
          <th className="px-2 py-1 text-left font-normal bg-gray-50 text-gray-900">
            Name
          </th>
          <th className="px-2 py-1 text-left font-normal bg-gray-50 text-gray-900">
            Flags
          </th>
          <th className="px-2 py-1 text-left font-normal bg-gray-50 text-gray-900">
            Card.
          </th>
          <th className="px-2 py-1 text-left font-normal bg-gray-50 text-gray-900">
            Type
          </th>
          <th className="px-2 py-1 text-left font-normal bg-gray-50 text-gray-900">
            Description
          </th>
        </tr>
      </thead>
      <tbody>
        {nestedElements.map((node, index) => (
          <TreeNode
            key={node.name}
            element={node}
            isLast={index === nestedElements.length - 1}
            parentLevels={[]}
          />
        ))}
      </tbody>
    </table>
  );
};

export default FHIRStructureTable;
