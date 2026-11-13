import { customAlphabet } from "nanoid/non-secure";

// Resource and UI IDs, not security tokens. Works on HTTP without Web Crypto.
// FHIR IDs cannot contain the underscore used by Nano ID's default alphabet.
export const generateId = customAlphabet(
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
	21,
);
