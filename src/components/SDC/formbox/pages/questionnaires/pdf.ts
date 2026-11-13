// pdf.js and its worker come from the same pinned package, bundled as chunks
// that load with the first PDF.
import type { PDFPageProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

type PdfJsModule = typeof import("pdfjs-dist");

export type PdfPageImage = {
	dataUrl: string;
	height: number;
	pageNumber: number;
	width: number;
};

export type PdfPreview = {
	pages: PdfPageImage[];
	/** Pages in the document, which can be more than were rendered. */
	totalPages: number;
};

async function importPdfJs(): Promise<PdfJsModule> {
	const module = await import("pdfjs-dist");
	module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
	return module;
}

async function pageToImage(
	page: PDFPageProxy,
	pageNumber: number,
	scale: number,
	compression: number,
): Promise<PdfPageImage> {
	const viewport = page.getViewport({ scale });
	const canvas = document.createElement("canvas");
	canvas.width = viewport.width;
	canvas.height = viewport.height;

	const canvasContext = canvas.getContext("2d");
	if (!canvasContext) throw new Error("This browser cannot draw PDF pages.");
	const renderTask = page.render({ canvasContext, viewport });
	await renderTask.promise;

	return {
		dataUrl: canvas.toDataURL("image/jpeg", compression),
		height: viewport.height,
		pageNumber,
		width: viewport.width,
	};
}

/**
 * Pages rendered for the preview strip. Rendering everything would hold one
 * canvas plus one JPEG data URL per page in memory at once — megabytes on a long
 * document, for a strip that shows a handful of thumbnails.
 */
const PREVIEW_PAGE_LIMIT = 5;

export type ParsePdfOptions = {
	compression: number;
	limit?: number;
	scale: number;
};

const DEFAULT_PARSE_OPTIONS: ParsePdfOptions = {
	compression: 0.8,
	scale: 1.8,
};

export async function renderPdfPages(
	pdfJs: PdfJsModule,
	pdfBuffer: ArrayBuffer,
	options: ParsePdfOptions = DEFAULT_PARSE_OPTIONS,
): Promise<PdfPreview> {
	const loadingTask = pdfJs.getDocument({ data: pdfBuffer.slice(0) });
	const documentProxy = await loadingTask.promise;
	const pageCount = Math.min(
		documentProxy.numPages,
		options.limit ?? PREVIEW_PAGE_LIMIT,
	);
	const images: PdfPageImage[] = [];

	// Sequentially: one canvas alive at a time instead of `pageCount` of them.
	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
		const page = await documentProxy.getPage(pageNumber);

		images.push(
			await pageToImage(page, pageNumber, options.scale, options.compression),
		);
	}

	return { pages: images, totalPages: documentProxy.numPages };
}

export async function parsePdfToImages(
	pdfBuffer: ArrayBuffer,
	options: ParsePdfOptions = DEFAULT_PARSE_OPTIONS,
): Promise<PdfPreview> {
	return renderPdfPages(await importPdfJs(), pdfBuffer, options);
}
