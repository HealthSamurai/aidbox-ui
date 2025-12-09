import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";

export const fetchResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Resource> => {
	const result = await client.read<Resource>({
		type: resourceType,
		id: id,
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const fetchResourceHistory = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Bundle> => {
	const result = await client.historyInstance({
		type: resourceType,
		id: id,
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const createResource = async (
	client: AidboxClientR5,
	resourceType: string,
	resource: Resource,
) => {
	const result = await client.create<Resource>({
		type: resourceType,
		resource: resource,
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const updateResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
	resource: Resource,
) => {
	const result = await client.update<Resource>({
		type: resourceType,
		id: id,
		resource: resource,
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value },
		);

	return result.value.resource;
};

export const deleteResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
) => {
	const result = await client.delete<Resource>({
		type: resourceType,
		id: id,
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};
