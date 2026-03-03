import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Check, Info } from "lucide-react";
import { SENSITIVE_PLACEHOLDER, SOURCE_TITLES } from "./constants";
import type { Setting } from "./types";
import {
	getDefaultValue,
	getEnvName,
	getSettingSourceValue,
	isValueFromAidboxSetting,
	isValueFromEnv,
	overrideSettingValue,
} from "./utils";

function ValueDisplay({ value }: { value: unknown }) {
	if (value == null)
		return (
			<span className="text-[var(--color-elements-assistive)]">
				not defined
			</span>
		);
	return (
		<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
			{String(value)}
		</code>
	);
}

function KvRow({
	label,
	value,
	className,
}: {
	label: string;
	value: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`flex gap-2 py-0.5 text-sm ${className ?? ""}`}>
			<span className="shrink-0 text-text-secondary">{label}</span>
			<span className="min-w-0 break-all">{value}</span>
		</div>
	);
}

export function SettingInfoPanel({ setting }: { setting: Setting }) {
	const sensitive = setting.sensitive;
	const pendingValue = setting["pending-value"];
	const activeValue = setting.value;
	const defaultValue = getDefaultValue(setting);
	const envName = getEnvName(setting);
	const envValue = getSettingSourceValue(setting, SOURCE_TITLES.env);
	const dbValue = getSettingSourceValue(setting, SOURCE_TITLES.database);
	const valueFromEnv = isValueFromEnv(setting);
	const valueFromAidbox = isValueFromAidboxSetting(setting);

	return (
		<div className="space-y-3 pt-2 text-sm">
			{pendingValue != null && (
				<>
					<KvRow
						label="Pending value:"
						value={
							<span>
								<ValueDisplay value={pendingValue} />
								<span className="pl-1 text-[var(--color-illustrations-solid)]">
									(requires restart)
								</span>
							</span>
						}
					/>
					<KvRow
						label="Active value:"
						value={
							activeValue != null ? (
								<ValueDisplay
									value={overrideSettingValue(setting, activeValue)}
								/>
							) : (
								<span className="text-[var(--color-elements-assistive)]">
									not defined
								</span>
							)
						}
					/>
				</>
			)}

			<KvRow
				label="Setting ID:"
				value={
					<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
						{setting.name}
					</code>
				}
			/>

			{defaultValue != null && (
				<KvRow
					label="Default value:"
					value={
						<ValueDisplay value={overrideSettingValue(setting, defaultValue)} />
					}
				/>
			)}

			<div className="flex items-center gap-1 pt-1 font-medium text-[var(--color-elements-assistive)]">
				<span>Value sources</span>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="cursor-help">
							<Info size={14} />
						</span>
					</TooltipTrigger>
					<TooltipContent side="right">
						Values are applied based on the highest-priority defined source
					</TooltipContent>
				</Tooltip>
			</div>

			<div className="ml-4 space-y-2">
				{envName && (
					<div>
						<div
							className={`flex items-center gap-1 text-sm ${valueFromEnv ? "text-[var(--color-cta)]" : "text-[var(--color-elements-assistive)]"}`}
						>
							<span>Environment variable</span>
							{valueFromEnv && <Check size={14} />}
						</div>
						<div className="ml-4">
							<KvRow
								label="Name:"
								className={
									valueFromEnv
										? "text-[var(--color-cta)]"
										: "text-[var(--color-elements-assistive)]"
								}
								value={
									<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
										{envName}
									</code>
								}
							/>
							<KvRow
								label="Value:"
								value={
									sensitive && valueFromEnv ? (
										<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
											{SENSITIVE_PLACEHOLDER}
										</code>
									) : envValue != null ? (
										<ValueDisplay value={envValue} />
									) : (
										<span className="text-[var(--color-elements-assistive)]">
											not defined
										</span>
									)
								}
							/>
						</div>
					</div>
				)}

				<div>
					<div
						className={`flex items-center gap-1 text-sm ${valueFromAidbox ? "text-[var(--color-cta)]" : "text-[var(--color-elements-assistive)]"}`}
					>
						<span>Aidbox settings</span>
						{valueFromAidbox && <Check size={14} />}
					</div>
					<div className="ml-4">
						<KvRow
							label="Name:"
							className={
								valueFromAidbox ? "" : "text-[var(--color-elements-assistive)]"
							}
							value={
								<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
									{setting.name}
								</code>
							}
						/>
						<KvRow
							label="Value:"
							value={
								sensitive && valueFromAidbox ? (
									<code className="rounded bg-bg-tertiary px-1 py-0.5 text-xs">
										{SENSITIVE_PLACEHOLDER}
									</code>
								) : (
									<ValueDisplay
										value={overrideSettingValue(
											setting,
											pendingValue ?? dbValue ?? activeValue ?? defaultValue,
										)}
									/>
								)
							}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
