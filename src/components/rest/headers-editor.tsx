import {
	Button,
	Checkbox,
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
	Input,
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Header } from "./active-tabs";

const HTTP_HEADER_SUGGESTIONS = [
	"Accept",
	"Accept-Charset",
	"Accept-Encoding",
	"Accept-Language",
	"Authorization",
	"Cache-Control",
	"Connection",
	"Content-Disposition",
	"Content-Encoding",
	"Content-Language",
	"Content-Length",
	"Content-Type",
	"Cookie",
	"Date",
	"ETag",
	"Expect",
	"Forwarded",
	"From",
	"Host",
	"If-Match",
	"If-Modified-Since",
	"If-None-Match",
	"If-Range",
	"If-Unmodified-Since",
	"Origin",
	"Pragma",
	"Prefer",
	"Range",
	"Referer",
	"Transfer-Encoding",
	"User-Agent",
	"Via",
	"Warning",
	"traceparent",
	"X-Audit",
	"X-Audit-Req-Body",
	"X-Client-Auth",
	"X-Client-Token",
	"X-Conditional-Delete",
	"X-Correlation-Id",
	"X-Debug",
	"X-Forwarded-For",
	"X-Forwarded-Host",
	"X-Forwarded-Proto",
	"X-Http-Method-Override",
	"X-Max-Isolation-Level",
	"X-Original-Uri",
	"X-Patient-Id",
	"X-Request-Id",
	"X-Use-Ro-Replica",
];

function HeaderNameAutocomplete({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const filtered = useMemo(() => {
		if (!value) return HTTP_HEADER_SUGGESTIONS;
		const lower = value.toLowerCase();
		return HTTP_HEADER_SUGGESTIONS.filter((h) =>
			h.toLowerCase().includes(lower),
		);
	}, [value]);

	const showPopover = open && filtered.length > 0 && !disabled;

	const scrollKey = useRef(-1);
	const selectedRef = (node: HTMLDivElement | null) => {
		if (node && scrollKey.current !== selectedIndex) {
			scrollKey.current = selectedIndex;
			node.scrollIntoView({ block: "nearest" });
		}
	};

	const selectItem = (val: string) => {
		onChange(val);
		setOpen(false);
		setSelectedIndex(0);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!showPopover) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((i) => (i + 1) % filtered.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
		} else if (e.key === "Tab") {
			e.preventDefault();
			if (e.shiftKey) {
				setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
			} else {
				setSelectedIndex((i) => (i + 1) % filtered.length);
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (filtered[selectedIndex]) {
				selectItem(filtered[selectedIndex]);
			}
		} else if (e.key === "Escape") {
			setOpen(false);
			setSelectedIndex(0);
		}
	};

	return (
		<Popover open={showPopover}>
			<PopoverAnchor asChild>
				<Input
					ref={inputRef}
					placeholder="Key"
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setSelectedIndex(0);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
				/>
			</PopoverAnchor>
			<PopoverContent
				className="p-0"
				style={{ width: "var(--radix-popover-trigger-width)" }}
				align="start"
				sideOffset={4}
				onOpenAutoFocus={(e) => e.preventDefault()}
				onFocusOutside={(e) => e.preventDefault()}
				onInteractOutside={(e) => e.preventDefault()}
			>
				<Command shouldFilter={false}>
					<CommandList>
						<CommandEmpty>No matching headers</CommandEmpty>
						{filtered.map((header, index) => (
							<CommandItem
								key={header}
								ref={index === selectedIndex ? selectedRef : undefined}
								value={header}
								className={index === selectedIndex ? "bg-bg-tertiary" : ""}
								onSelect={selectItem}
								onMouseDown={(e) => e.preventDefault()}
								onMouseEnter={() => setSelectedIndex(index)}
							>
								{header}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export default function HeadersEditor({
	headers,
	onHeaderChange,
	onHeaderRemove,
}: {
	headers: Header[];
	onHeaderChange: (headerIndex: number, header: Header) => void;
	onHeaderRemove: (headerIndex: number) => void;
}) {
	return (
		<div className="flex flex-col gap-3 p-4 bg-bg-primary">
			{headers.map((header, index) => {
				return (
					<div key={header.id} className="flex gap-2 items-center">
						<Checkbox
							className="mr-2"
							checked={header.enabled ?? true}
							onCheckedChange={(checked) =>
								onHeaderChange(index, { ...header, enabled: !!checked })
							}
						/>
						<div className="max-w-90 w-90">
							<HeaderNameAutocomplete
								value={header.name}
								onChange={(name) => onHeaderChange(index, { ...header, name })}
								disabled={!(header.enabled ?? true)}
							/>
						</div>
						<Input
							placeholder="Value"
							defaultValue={header.value}
							onChange={(e) =>
								onHeaderChange(index, { ...header, value: e.target.value })
							}
							disabled={!(header.enabled ?? true)}
						/>
						<Button
							variant="link"
							size="small"
							onClick={() => onHeaderRemove(index)}
							disabled={header.name === undefined || header.name === ""}
							style={{
								opacity:
									header.name === undefined || header.name === "" ? 0 : 1,
								pointerEvents:
									header.name === undefined || header.name === ""
										? "none"
										: "auto",
							}}
						>
							<Trash2 />
						</Button>
					</div>
				);
			})}
		</div>
	);
}
