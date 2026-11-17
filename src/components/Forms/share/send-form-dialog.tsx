import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import type {
	Encounter,
	Patient,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import {
	Button,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectTrigger,
	SelectValue,
	Textarea,
	ToggleGroup,
	ToggleGroupItem,
	toast,
} from "@health-samurai/react-components";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
	getConfigurationLabel,
	getQuestionnaireThemeLabel,
	useConfigurationReferences,
	useQuestionnaireThemes,
} from "../api/configurations";
import type { Form } from "../api/forms";
import { useQuestionnaireMetadata } from "../api/plan-definitions";
import {
	capitalizeLabel,
	FormBehaviorFields,
	FormSettingsFields,
	fillPatientFromSubject,
	GroupLabel,
	getLaunchContextDefinitions,
	NATIVE_INPUT_CLASS_NAME,
	parseOptionalMinutes,
	Row,
	resourceReference,
	Section,
	SendFormIcon,
	ToggleRow,
} from "../form-dialog-fields";
import {
	type AidboxReferenceResource,
	type AidboxSearchResource,
	formatAidboxReferenceLabel,
	formatEncounterLabel,
	formatPatientLabel,
	getPatientEmail,
	searchAidboxReferenceResources,
	useEncounters,
	usePatients,
	useSendForm,
} from "./api";
import { ResourceSearchSelect } from "./resource-search-select";

const EMAIL_PROVIDER_OPTIONS = [
	{ label: "SendGrid", value: "sendgrid-provider" },
	{ label: "Postmark", value: "postmark-provider" },
	{ label: "Mailgun", value: "mailgun-provider" },
	{ label: "SMTP", value: "smtp-provider" },
] as const;

type DeliveryMode = "now" | "schedule";
const DIALOG_BODY_CLASS_NAME =
	"min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-6 py-6";

type ScheduleErrors = {
	date?: string;
	time?: string;
};

type InvalidSendFieldTarget = {
	id: string;
	section: "emailDelivery" | "formBehavior";
};

function formatLocalDateInputValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
		date.getDate(),
	).padStart(2, "0")}`;
}

function formatDateForSend(value: string) {
	if (!value) {
		return undefined;
	}

	const [year, month, day] = value.split("-");

	if (!year || !month || !day) {
		return undefined;
	}

	return `${year}-${month}-${day}`;
}

function computeSendAt(mode: DeliveryMode, date: string, time: string) {
	if (mode !== "schedule" || !date || !time) {
		return undefined;
	}

	const formattedDate = formatDateForSend(date);

	if (!formattedDate) {
		return undefined;
	}

	const localDate = new Date(`${formattedDate}T${time}:00`);

	if (Number.isNaN(localDate.getTime())) {
		return undefined;
	}

	return localDate.toISOString();
}

function validateSchedule(
	mode: DeliveryMode,
	date: string,
	time: string,
): ScheduleErrors {
	if (mode !== "schedule") {
		return {};
	}

	if (!date && !time) {
		return {
			date: "Select a date",
			time: "Select a time",
		};
	}

	if (!date) {
		return {
			date: "Select a date",
		};
	}

	if (!time) {
		return {
			time: "Select a time",
		};
	}

	const todayDate = formatLocalDateInputValue(new Date());

	if (date && date < todayDate) {
		return {
			date: "Date must not be in the past",
		};
	}

	const sendAt = computeSendAt(mode, date, time);

	if (time && sendAt && new Date(sendAt).getTime() < Date.now()) {
		return {
			time: "Time must not be in the past",
		};
	}

	return {};
}

function getFirstInvalidSendFieldTarget({
	deadlineError,
	recipientEmailError,
	scheduleErrors,
	sessionTimeoutError,
	warningTimeoutError,
}: {
	deadlineError?: string;
	recipientEmailError?: string;
	scheduleErrors: ScheduleErrors;
	sessionTimeoutError?: string;
	warningTimeoutError?: string;
}): InvalidSendFieldTarget | undefined {
	if (recipientEmailError) {
		return {
			id: "send-form-recipient-email",
			section: "emailDelivery",
		};
	}

	if (scheduleErrors.date) {
		return {
			id: "send-form-date",
			section: "emailDelivery",
		};
	}

	if (scheduleErrors.time) {
		return {
			id: "send-form-time",
			section: "emailDelivery",
		};
	}

	if (deadlineError) {
		return {
			id: "send-form-deadline-days",
			section: "emailDelivery",
		};
	}

	if (sessionTimeoutError) {
		return {
			id: "send-form-session-timeout",
			section: "formBehavior",
		};
	}

	if (warningTimeoutError) {
		return {
			id: "send-form-warning-timeout",
			section: "formBehavior",
		};
	}

	return undefined;
}

// A native date or time input renders a fixed-size value plus its picker icon,
// so a full-width field leaves a wide empty gap after the icon. These sizes fit
// that content — the widest format Chrome renders, `dd. mm. yyyy.` and a
// 12-hour `--:-- --`, measured with room to spare — plus the breathing room the
// browser chrome needs.
//
// `block` overrides the `flex` in `NATIVE_INPUT_CLASS_NAME`, which a date or
// time input must not have: as a flex container Chrome packs the value and the
// picker button to the start, so whenever the value is narrower than the field
// — a 24-hour `--:--`, a short date format — the icon trails the text with all
// the empty space after it. As a block the picker sits at the padding edge, the
// way the browser draws it by default.
const DATE_INPUT_CLASS_NAME = "block w-full sm:w-[9.75rem]";
const TIME_INPUT_CLASS_NAME = "block w-full sm:w-[7rem]";

function DaysInput({
	ariaLabel,
	id,
	onChange,
	testId,
	value,
}: {
	ariaLabel?: string;
	id: string;
	onChange: (value: string) => void;
	testId?: string;
	value: string;
}) {
	return (
		<div className="relative w-full sm:w-[6.5rem]">
			<input
				id={id}
				type="number"
				min="1"
				aria-label={ariaLabel}
				data-test-id={testId}
				className={`${NATIVE_INPUT_CLASS_NAME} pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
			<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 typo-body text-text-tertiary">
				days
			</span>
		</div>
	);
}

function VariableToken({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-sm text-text-secondary">
			{children}
		</span>
	);
}

type SendByEmailSectionsProps = {
	deadlineDays: string;
	deadlineError?: string;
	deliveryMode: DeliveryMode;
	emailDeliveryOpen: boolean;
	emailMessage: string;
	emailProvider: string;
	emailSubject: string;
	followUpDays: string;
	followUpEnabled: boolean;
	followUpMessage: string;
	followUpTime: string;
	patientEmail: string;
	patientEmailManuallyEdited: boolean;
	practitionerEmail: string;
	recipientEmailError?: string;
	recipientEmailHint: string;
	scheduleErrors: ScheduleErrors;
	sendDate: string;
	sendTime: string;
	sendValidationRequested: boolean;
	setDeadlineDays: (value: string) => void;
	setDeliveryMode: (value: DeliveryMode) => void;
	setEmailDeliveryOpen: (open: boolean) => void;
	setEmailMessage: (value: string) => void;
	setEmailProvider: (value: string) => void;
	setEmailSubject: (value: string) => void;
	setFollowUpDays: (value: string) => void;
	setFollowUpEnabled: (value: boolean) => void;
	setFollowUpMessage: (value: string) => void;
	setFollowUpTime: (value: string) => void;
	setPatientEmail: (value: string) => void;
	setPatientEmailManuallyEdited: (value: boolean) => void;
	setPractitionerEmail: (value: string) => void;
	setSendDate: (value: string) => void;
	setSendTime: (value: string) => void;
};

function SendByEmailSections({
	deadlineDays,
	deadlineError,
	deliveryMode,
	emailDeliveryOpen,
	emailMessage,
	emailProvider,
	emailSubject,
	followUpDays,
	followUpEnabled,
	followUpMessage,
	followUpTime,
	patientEmail,
	patientEmailManuallyEdited,
	practitionerEmail,
	recipientEmailError,
	recipientEmailHint,
	scheduleErrors,
	sendDate,
	sendTime,
	sendValidationRequested,
	setDeadlineDays,
	setDeliveryMode,
	setEmailDeliveryOpen,
	setEmailMessage,
	setEmailProvider,
	setEmailSubject,
	setFollowUpDays,
	setFollowUpEnabled,
	setFollowUpMessage,
	setFollowUpTime,
	setPatientEmail,
	setPatientEmailManuallyEdited,
	setPractitionerEmail,
	setSendDate,
	setSendTime,
}: SendByEmailSectionsProps) {
	return (
		<>
			<section className="pb-5">
				<Row
					htmlFor="send-form-recipient-email"
					label="Send to"
					required
					error={sendValidationRequested ? recipientEmailError : undefined}
					description={recipientEmailHint}
					testId="send-form-dialog__recipient-email-field"
				>
					<input
						id="send-form-recipient-email"
						data-test-id="send-form-dialog__recipient-email-input"
						type="email"
						className={NATIVE_INPUT_CLASS_NAME}
						placeholder="patient@example.com"
						value={patientEmail}
						onChange={(event) => {
							setPatientEmail(event.target.value);
							if (!patientEmailManuallyEdited) {
								setPatientEmailManuallyEdited(true);
							}
						}}
					/>
				</Row>
			</section>

			<Section
				title="Email delivery"
				open={emailDeliveryOpen}
				onOpenChange={setEmailDeliveryOpen}
				testId="send-form-dialog__email-delivery-section"
			>
				<Row label="Provider" testId="send-form-dialog__email-provider-field">
					<Select value={emailProvider} onValueChange={setEmailProvider}>
						<SelectTrigger
							className="w-full bg-bg-primary"
							data-test-id="send-form-dialog__email-provider-dropdown"
						>
							<SelectValue placeholder="Select provider" />
						</SelectTrigger>
						<AppSelectContent data-test-id="send-form-dialog__email-provider-options">
							{EMAIL_PROVIDER_OPTIONS.map((option) => (
								<AppSelectItem
									key={option.value}
									data-test-id="send-form-dialog__email-provider-option"
									value={option.value}
								>
									{option.label}
								</AppSelectItem>
							))}
						</AppSelectContent>
					</Select>
				</Row>

				<Row label="Send" testId="send-form-dialog__delivery-mode-field">
					<ToggleGroup
						type="single"
						value={deliveryMode}
						variant="outline"
						className="w-fit"
						onValueChange={(value) => {
							if (value === "now" || value === "schedule") {
								setDeliveryMode(value);
							}
						}}
					>
						<ToggleGroupItem
							value="now"
							className="min-w-24"
							data-test-id="send-form-dialog__send-now-button"
						>
							Now
						</ToggleGroupItem>
						<ToggleGroupItem
							value="schedule"
							className="min-w-28"
							data-test-id="send-form-dialog__schedule-button"
						>
							Schedule
						</ToggleGroupItem>
					</ToggleGroup>
				</Row>

				{deliveryMode === "schedule" ? (
					<Row
						label="Schedule"
						error={
							sendValidationRequested
								? (scheduleErrors.date ?? scheduleErrors.time)
								: undefined
						}
						testId="send-form-dialog__schedule-field"
					>
						<div className="flex flex-wrap gap-3">
							<input
								id="send-form-date"
								data-test-id="send-form-dialog__send-date-input"
								type="date"
								aria-label="Date"
								className={cn(NATIVE_INPUT_CLASS_NAME, DATE_INPUT_CLASS_NAME)}
								value={sendDate}
								onChange={(event) => setSendDate(event.target.value)}
								aria-invalid={Boolean(scheduleErrors.date)}
							/>
							<input
								id="send-form-time"
								data-test-id="send-form-dialog__send-time-input"
								type="time"
								aria-label="Time"
								className={cn(NATIVE_INPUT_CLASS_NAME, TIME_INPUT_CLASS_NAME)}
								value={sendTime}
								onChange={(event) => setSendTime(event.target.value)}
								aria-invalid={Boolean(scheduleErrors.time)}
							/>
						</div>
					</Row>
				) : null}

				<Row
					htmlFor="send-form-deadline-days"
					label="Link expires in"
					required
					error={sendValidationRequested ? deadlineError : undefined}
					testId="send-form-dialog__deadline-days-field"
				>
					<DaysInput
						id="send-form-deadline-days"
						testId="send-form-dialog__deadline-days-input"
						value={deadlineDays}
						onChange={setDeadlineDays}
					/>
				</Row>
			</Section>

			<Section title="Message" testId="send-form-dialog__message-section">
				<Row
					htmlFor="send-form-subject"
					label="Subject"
					testId="send-form-dialog__subject-field"
				>
					<Input
						id="send-form-subject"
						data-test-id="send-form-dialog__subject-input"
						className="bg-bg-primary"
						value={emailSubject}
						onChange={(event) => setEmailSubject(event.target.value)}
						placeholder="Please complete this form"
					/>
				</Row>
				<Row
					htmlFor="send-form-message"
					label="Body"
					testId="send-form-dialog__message-field"
				>
					<Textarea
						id="send-form-message"
						data-test-id="send-form-dialog__message-textarea"
						rows={8}
						className="min-h-44 bg-bg-primary"
						value={emailMessage}
						onChange={(event) => setEmailMessage(event.target.value)}
						placeholder={
							"Hello {{patient.firstName}},\n\nPlease complete the {{form.title}} form at your earliest convenience."
						}
					/>
					<div className="flex flex-wrap items-center gap-1.5 text-sm text-text-tertiary">
						Variables:
						<VariableToken>{"{{patient.firstName}}"}</VariableToken>
						<VariableToken>{"{{form.title}}"}</VariableToken>
						<VariableToken>{"{{link}}"}</VariableToken>
					</div>
				</Row>
			</Section>

			<Section title="Follow-up" testId="send-form-dialog__follow-up-section">
				<Row
					htmlFor="send-form-practitioner-email"
					label="Notify"
					description="Emailed when the form is completed or expires."
					testId="send-form-dialog__practitioner-email-field"
				>
					<input
						id="send-form-practitioner-email"
						data-test-id="send-form-dialog__practitioner-email-input"
						type="email"
						className={NATIVE_INPUT_CLASS_NAME}
						placeholder="doctor@example.com"
						value={practitionerEmail}
						onChange={(event) => setPractitionerEmail(event.target.value)}
					/>
				</Row>

				<ToggleRow
					checked={followUpEnabled}
					label="Remind if the form isn't completed"
					onChange={setFollowUpEnabled}
					testId="send-form-dialog__follow-up-switch"
				/>

				{followUpEnabled ? (
					<div className="grid gap-4">
						<Row
							label="Reminder"
							testId="send-form-dialog__follow-up-reminder-field"
						>
							<div className="flex flex-wrap gap-3">
								<DaysInput
									ariaLabel="Reminder delay in days"
									id="send-form-follow-up-days"
									testId="send-form-dialog__follow-up-days-input"
									value={followUpDays}
									onChange={setFollowUpDays}
								/>
								<input
									id="send-form-follow-up-time"
									data-test-id="send-form-dialog__follow-up-time-input"
									type="time"
									aria-label="Reminder time"
									className={cn(NATIVE_INPUT_CLASS_NAME, TIME_INPUT_CLASS_NAME)}
									value={followUpTime}
									onChange={(event) => setFollowUpTime(event.target.value)}
								/>
							</div>
						</Row>
						<Row
							htmlFor="send-form-follow-up-message"
							label="Message"
							testId="send-form-dialog__follow-up-message-field"
						>
							<Textarea
								id="send-form-follow-up-message"
								data-test-id="send-form-dialog__follow-up-message-textarea"
								rows={3}
								className="bg-bg-primary"
								value={followUpMessage}
								onChange={(event) => setFollowUpMessage(event.target.value)}
								placeholder={
									"Hello {{patient.firstName}},\n\nThis is a reminder to complete the {{form.title}} form."
								}
							/>
						</Row>
					</div>
				) : null}
			</Section>
		</>
	);
}

type SendFormDialogProps = {
	onOpenChange: (open: boolean) => void;
	form: Form | null;
};

export function SendFormDialog({ onOpenChange, form }: SendFormDialogProps) {
	const open = form !== null;
	const isPlanDefinition = form?.resourceType === "PlanDefinition";
	const formLabel = isPlanDefinition ? "package" : "form";
	const referencedQuestionnaires = useQuestionnaireMetadata(
		open && isPlanDefinition,
	);
	const statusLabel = capitalizeLabel(form?.status ?? "");

	const [patientQuery, setPatientQuery] = useState("");
	const [encounterQuery, setEncounterQuery] = useState("");
	const [formBehaviorOpen, setFormBehaviorOpen] = useState(false);
	const [emailDeliveryOpen, setEmailDeliveryOpen] = useState(true);

	const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
	const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(
		null,
	);
	const [selectedThemeId, setSelectedThemeId] = useState("");
	const [selectedConfigId, setSelectedConfigId] = useState("");
	const [allowAmend, setAllowAmend] = useState(false);
	const [allowRepopulate, setAllowRepopulate] = useState(false);
	const [readOnly, setReadOnly] = useState(false);
	const [redirectOnSubmit, setRedirectOnSubmit] = useState("");
	const [redirectOnSave, setRedirectOnSave] = useState("");
	const [redirectOnTimeout, setRedirectOnTimeout] = useState("");
	const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("");
	const [warningTimeoutMinutes, setWarningTimeoutMinutes] = useState("");
	const [launchContextQueryByName, setLaunchContextQueryByName] = useState<
		Record<string, string>
	>({});
	const [selectedLaunchContextByName, setSelectedLaunchContextByName] =
		useState<Record<string, AidboxSearchResource | null>>({});

	const [patientEmail, setPatientEmail] = useState("");
	const [patientEmailManuallyEdited, setPatientEmailManuallyEdited] =
		useState(false);
	const [sendValidationRequested, setSendValidationRequested] = useState(false);
	const [practitionerEmail, setPractitionerEmail] = useState("");
	const [emailSubject, setEmailSubject] = useState("Please complete this form");
	const [emailMessage, setEmailMessage] = useState("");
	const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
	const [sendDate, setSendDate] = useState("");
	const [sendTime, setSendTime] = useState("");
	const [followUpEnabled, setFollowUpEnabled] = useState(false);
	const [followUpDays, setFollowUpDays] = useState("3");
	const [followUpTime, setFollowUpTime] = useState("10:00");
	const [followUpMessage, setFollowUpMessage] = useState(
		"Hello {{patient.firstName}},\n\nThis is a reminder to complete the {{form.title}} form.",
	);
	const [deadlineDays, setDeadlineDays] = useState("7");
	const [emailProvider, setEmailProvider] = useState<string>(
		EMAIL_PROVIDER_OPTIONS[0].value,
	);
	const launchContextDefinitions = useMemo(
		() =>
			getLaunchContextDefinitions(
				form,
				referencedQuestionnaires.data?.resources,
			),
		[form, referencedQuestionnaires.data],
	);

	const scheduleErrors = useMemo(
		() => validateSchedule(deliveryMode, sendDate, sendTime),
		[deliveryMode, sendDate, sendTime],
	);

	const patientsQuery = usePatients(patientQuery, open);
	const encountersQuery = useEncounters(encounterQuery, open);
	const themesQuery = useQuestionnaireThemes(open);
	const configurationReferencesQuery = useConfigurationReferences(open);
	const aidboxClient = useAidboxClient();
	const launchContextQueries = useQueries({
		queries: launchContextDefinitions.map((definition) => ({
			enabled: open,
			placeholderData: (previousData: AidboxSearchResource[] | undefined) =>
				previousData,
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				searchAidboxReferenceResources(
					aidboxClient,
					definition.resourceType,
					launchContextQueryByName[definition.name] ?? "",
					signal,
				),
			queryKey: [
				"use-form",
				"launch-context",
				definition.resourceType,
				launchContextQueryByName[definition.name] ?? "",
			],
			refetchOnWindowFocus: false,
			staleTime: 60 * 1000,
		})),
	});
	const sendForm = useSendForm();
	const selectedPatientEmail = useMemo(
		() => getPatientEmail(selectedPatient),
		[selectedPatient],
	);
	const recipientEmailHint = useMemo(() => {
		if (
			selectedPatient &&
			!patientEmailManuallyEdited &&
			selectedPatientEmail
		) {
			return "Prefilled from the patient record. You can change it.";
		}

		if (selectedPatient && !selectedPatientEmail) {
			return "No patient email found. Enter the recipient email manually.";
		}

		return "The form link will be sent to this address.";
	}, [patientEmailManuallyEdited, selectedPatient, selectedPatientEmail]);
	const deadlineDaysValue = Number(deadlineDays);
	const deadlineError =
		!deadlineDays.trim() ||
		Number.isNaN(deadlineDaysValue) ||
		deadlineDaysValue < 1
			? "Expiration must be at least 1 day"
			: undefined;
	const recipientEmailError = !patientEmail.trim()
		? "Recipient email is required"
		: undefined;
	const sessionTimeout = useMemo(
		() => parseOptionalMinutes(sessionTimeoutMinutes),
		[sessionTimeoutMinutes],
	);
	const warningTimeout = useMemo(
		() => parseOptionalMinutes(warningTimeoutMinutes),
		[warningTimeoutMinutes],
	);
	const themeOptions = useMemo(
		() =>
			(themesQuery.data ?? [])
				.filter((theme) => Boolean(theme.id))
				.map((theme) => ({
					label: getQuestionnaireThemeLabel(theme),
					value: theme.id ?? "",
				})),
		[themesQuery.data],
	);
	const configurationOptions = useMemo(
		() =>
			(configurationReferencesQuery.data ?? [])
				.filter((configuration) => Boolean(configuration.id))
				.map((configuration) => ({
					label: getConfigurationLabel(configuration),
					value: configuration.id ?? "",
				})),
		[configurationReferencesQuery.data],
	);
	const sendPending = sendForm.isPending;
	const isBusy = sendPending;
	const selectedLaunchContextReferences = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(selectedLaunchContextByName).flatMap(
					([name, resource]) =>
						resource?.id
							? [
									[
										name,
										{
											id: resource.id,
											resourceType: resource.resourceType,
										} satisfies AidboxReferenceResource,
									],
								]
							: [],
				),
			),
		[selectedLaunchContextByName],
	);

	useEffect(() => {
		if (!form) {
			return;
		}

		setFormBehaviorOpen(false);
		setEmailDeliveryOpen(true);
		setPatientQuery("");
		setEncounterQuery("");
		setSelectedPatient(null);
		setSelectedEncounter(null);
		setSelectedThemeId("");
		setSelectedConfigId("");
		setAllowAmend(false);
		setAllowRepopulate(false);
		setReadOnly(false);
		setRedirectOnSubmit("");
		setRedirectOnSave("");
		setRedirectOnTimeout("");
		setSessionTimeoutMinutes("");
		setWarningTimeoutMinutes("");
		setLaunchContextQueryByName({});
		setSelectedLaunchContextByName({});
		setPatientEmail("");
		setPatientEmailManuallyEdited(false);
		setSendValidationRequested(false);
		setPractitionerEmail("");
		setEmailSubject("Please complete this form");
		setEmailMessage(
			"Hello {{patient.firstName}},\n\nPlease complete the {{form.title}} form at your earliest convenience.",
		);
		setDeliveryMode("now");
		setSendDate("");
		setSendTime("");
		setFollowUpEnabled(false);
		setFollowUpDays("3");
		setFollowUpTime("10:00");
		setFollowUpMessage(
			"Hello {{patient.firstName}},\n\nThis is a reminder to complete the {{form.title}} form.",
		);
		setDeadlineDays("7");
		setEmailProvider(EMAIL_PROVIDER_OPTIONS[0].value);
	}, [form]);

	const hasValidSendFields =
		Boolean(patientEmail.trim()) &&
		Boolean(form?.id) &&
		!scheduleErrors.date &&
		!scheduleErrors.time &&
		!deadlineError &&
		!sessionTimeout.error &&
		!warningTimeout.error;
	const sendActionLabel =
		deliveryMode === "schedule" ? "Schedule send" : `Send ${formLabel}`;
	const firstInvalidSendFieldTarget = getFirstInvalidSendFieldTarget({
		deadlineError,
		recipientEmailError,
		scheduleErrors,
		sessionTimeoutError: sessionTimeout.error,
		warningTimeoutError: warningTimeout.error,
	});
	const scrollToField = (targetId: string) => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				const element = document.getElementById(targetId);

				if (!(element instanceof HTMLElement)) {
					return;
				}

				element.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
				element.focus({ preventScroll: true });
			});
		});
	};
	const handleSendSubmit = (formRef: AidboxReferenceResource) => {
		if (!hasValidSendFields) {
			setSendValidationRequested(true);

			if (firstInvalidSendFieldTarget?.section === "emailDelivery") {
				setEmailDeliveryOpen(true);
			}

			if (firstInvalidSendFieldTarget?.section === "formBehavior") {
				setFormBehaviorOpen(true);
			}

			if (firstInvalidSendFieldTarget) {
				scrollToField(firstInvalidSendFieldTarget.id);
			}

			return;
		}

		setSendValidationRequested(false);
		void sendForm
			.mutateAsync({
				allowAmend,
				allowRepopulate: isPlanDefinition ? undefined : allowRepopulate,
				clinicianEmail: practitionerEmail,
				configId: selectedConfigId || undefined,
				deadlineDays: deadlineDaysValue,
				email: patientEmail.trim(),
				emailMessage,
				emailProvider,
				emailSubject,
				encounter: resourceReference(selectedEncounter),
				followUpDays: Number(followUpDays) || 0,
				followUpEnabled,
				followUpMessage,
				followUpTime,
				launchContext: selectedLaunchContextReferences,
				form: formRef,
				readOnly: isPlanDefinition ? undefined : readOnly,
				redirectOnSave: redirectOnSave || undefined,
				redirectOnSubmit: redirectOnSubmit || undefined,
				redirectOnTimeout: redirectOnTimeout || undefined,
				sessionTimeout: sessionTimeout.value,
				sendAt: computeSendAt(deliveryMode, sendDate, sendTime),
				subject: resourceReference(selectedPatient),
				themeId: selectedThemeId || undefined,
				warningTimeout: warningTimeout.value,
			})
			.then(() => {
				toast.success("Form-sending process started");
				onOpenChange(false);
			})
			.catch((error: unknown) => {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to start form-sending process",
				);
			});
	};
	const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const formRef = resourceReference(form);

		if (!formRef) {
			return;
		}

		handleSendSubmit(formRef);
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
				data-test-id="send-form-dialog"
			>
				<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-6 pr-14">
					<DialogTitle data-test-id="send-form-dialog__title">
						Send {formLabel}
					</DialogTitle>
					<DialogDescription>Send it by email.</DialogDescription>
				</DialogHeader>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={handleFormSubmit}
				>
					<div className={DIALOG_BODY_CLASS_NAME}>
						<div className="flex items-center gap-3 rounded-lg bg-bg-secondary px-4 py-3">
							<span
								className="shrink-0 text-sm font-semibold text-text-primary"
								data-test-id="send-form-dialog__form-status-text"
							>
								{statusLabel
									? `${statusLabel} ${formLabel}`
									: capitalizeLabel(formLabel)}
							</span>
							<span
								className="truncate text-sm text-text-secondary"
								data-test-id="send-form-dialog__form-reference-text"
							>
								{form?.id ? `${form.resourceType}/${form.id}` : ""}
							</span>
						</div>

						<div className="mt-5">
							{isPlanDefinition && referencedQuestionnaires.isError && (
								<p
									role="alert"
									className="mb-4 text-sm text-text-error-primary"
								>
									Could not load the package’s prefill fields.{" "}
									<Button
										type="button"
										variant="ghost"
										size="small"
										onClick={() => void referencedQuestionnaires.refetch()}
									>
										Retry
									</Button>
								</p>
							)}
							<section className="pb-4">
								<Row label="Patient" testId="send-form-dialog__patient-field">
									<ResourceSearchSelect
										items={patientsQuery.data ?? []}
										isLoading={patientsQuery.isLoading}
										getKey={(patient) => patient.id ?? ""}
										getLabel={(patient) => formatPatientLabel(patient)}
										onQueryChange={setPatientQuery}
										onSelect={(patient) => {
											setSelectedPatient(patient);
											setSelectedLaunchContextByName((current) =>
												fillPatientFromSubject(
													current,
													launchContextDefinitions,
													patient as AidboxSearchResource | null,
												),
											);

											if (!patientEmailManuallyEdited) {
												setPatientEmail(getPatientEmail(patient));
											}
										}}
										placeholder="Select patient"
										searchPlaceholder="Search patients..."
										selectedItem={selectedPatient}
										testId="send-form-dialog__patient-select"
									/>
								</Row>
							</section>

							<SendByEmailSections
								deadlineDays={deadlineDays}
								deadlineError={deadlineError}
								deliveryMode={deliveryMode}
								emailDeliveryOpen={emailDeliveryOpen}
								emailMessage={emailMessage}
								emailProvider={emailProvider}
								emailSubject={emailSubject}
								followUpDays={followUpDays}
								followUpEnabled={followUpEnabled}
								followUpMessage={followUpMessage}
								followUpTime={followUpTime}
								patientEmail={patientEmail}
								patientEmailManuallyEdited={patientEmailManuallyEdited}
								practitionerEmail={practitionerEmail}
								recipientEmailError={recipientEmailError}
								recipientEmailHint={recipientEmailHint}
								scheduleErrors={scheduleErrors}
								sendDate={sendDate}
								sendTime={sendTime}
								sendValidationRequested={sendValidationRequested}
								setDeadlineDays={setDeadlineDays}
								setDeliveryMode={setDeliveryMode}
								setEmailDeliveryOpen={setEmailDeliveryOpen}
								setEmailMessage={setEmailMessage}
								setEmailProvider={setEmailProvider}
								setEmailSubject={setEmailSubject}
								setFollowUpDays={setFollowUpDays}
								setFollowUpEnabled={setFollowUpEnabled}
								setFollowUpMessage={setFollowUpMessage}
								setFollowUpTime={setFollowUpTime}
								setPatientEmail={setPatientEmail}
								setPatientEmailManuallyEdited={setPatientEmailManuallyEdited}
								setPractitionerEmail={setPractitionerEmail}
								setSendDate={setSendDate}
								setSendTime={setSendTime}
							/>

							<Section
								title="Advanced options"
								description="Prefill data, theme, configuration, permissions, timeouts, and redirects."
								defaultOpen={false}
								open={formBehaviorOpen}
								onOpenChange={setFormBehaviorOpen}
								testId="send-form-dialog__advanced-section"
							>
								<Row
									label="Encounter"
									testId="send-form-dialog__encounter-field"
								>
									<ResourceSearchSelect
										items={encountersQuery.data ?? []}
										isLoading={encountersQuery.isLoading}
										getKey={(encounter) => encounter.id ?? ""}
										getLabel={(encounter) => formatEncounterLabel(encounter)}
										onQueryChange={setEncounterQuery}
										onSelect={setSelectedEncounter}
										placeholder="Select encounter"
										searchPlaceholder="Search encounters..."
										selectedItem={selectedEncounter}
										testId="send-form-dialog__encounter-select"
									/>
								</Row>

								{launchContextDefinitions.map((definition, index) => (
									<Row
										key={definition.name}
										label={definition.label}
										testId={`send-form-dialog__launch-context-${definition.name}-field`}
									>
										<ResourceSearchSelect
											items={launchContextQueries[index]?.data ?? []}
											isLoading={
												launchContextQueries[index]?.isLoading ?? false
											}
											getKey={(resource) => resource.id ?? ""}
											getLabel={formatAidboxReferenceLabel}
											onQueryChange={(value) =>
												setLaunchContextQueryByName((current) => ({
													...current,
													[definition.name]: value,
												}))
											}
											onSelect={(resource) =>
												setSelectedLaunchContextByName((current) => ({
													...current,
													[definition.name]: resource,
												}))
											}
											placeholder={`Select ${definition.label.toLowerCase()}`}
											searchPlaceholder={`Search ${definition.label.toLowerCase()}...`}
											selectedItem={
												selectedLaunchContextByName[definition.name] ?? null
											}
											testId={`send-form-dialog__launch-context-${definition.name}-select`}
										/>
									</Row>
								))}

								<GroupLabel className="pt-3">Form settings</GroupLabel>
								<FormSettingsFields
									configurationOptions={configurationOptions}
									isConfigurationLoading={
										configurationReferencesQuery.isLoading
									}
									isThemeLoading={themesQuery.isLoading}
									selectedConfigId={selectedConfigId}
									selectedThemeId={selectedThemeId}
									setSelectedConfigId={setSelectedConfigId}
									setSelectedThemeId={setSelectedThemeId}
									testIdPrefix="send-form-dialog"
									themeOptions={themeOptions}
								/>

								<FormBehaviorFields
									isPlanDefinition={isPlanDefinition}
									allowAmend={allowAmend}
									allowRepopulate={allowRepopulate}
									idPrefix="send-form"
									readOnly={readOnly}
									redirectOnSave={redirectOnSave}
									redirectOnSubmit={redirectOnSubmit}
									redirectOnTimeout={redirectOnTimeout}
									sessionTimeoutError={sessionTimeout.error}
									sessionTimeoutMinutes={sessionTimeoutMinutes}
									setAllowAmend={setAllowAmend}
									setAllowRepopulate={setAllowRepopulate}
									setReadOnly={setReadOnly}
									setRedirectOnSave={setRedirectOnSave}
									setRedirectOnSubmit={setRedirectOnSubmit}
									setRedirectOnTimeout={setRedirectOnTimeout}
									setSessionTimeoutMinutes={setSessionTimeoutMinutes}
									setWarningTimeoutMinutes={setWarningTimeoutMinutes}
									testIdPrefix="send-form-dialog"
									warningTimeoutError={warningTimeout.error}
									warningTimeoutMinutes={warningTimeoutMinutes}
								/>
							</Section>
						</div>
					</div>
					<DialogFooter className="border-t border-border-primary bg-bg-primary px-6 py-4">
						<Button
							type="button"
							variant="secondary"
							data-test-id="send-form-dialog__cancel-button"
							onClick={() => onOpenChange(false)}
							disabled={isBusy}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							data-test-id="send-form-dialog__submit-button"
							disabled={sendPending || !form?.id}
						>
							<SendFormIcon className="size-4" />
							{sendActionLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
