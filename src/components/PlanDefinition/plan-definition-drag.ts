import { PointerActivationConstraints } from "@dnd-kit/dom";
import { KeyboardSensor, PointerSensor } from "@dnd-kit/react";

export const planDefinitionDragSensors = [
	PointerSensor.configure({
		activationConstraints: [
			new PointerActivationConstraints.Distance({ value: 5 }),
		],
	}),
	KeyboardSensor.configure({
		keyboardCodes: {
			...KeyboardSensor.defaults.keyboardCodes,
			start: ["Space"],
		},
	}),
];
