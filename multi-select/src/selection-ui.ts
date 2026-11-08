import { toasts } from '@unbound-app/api';

import { clear, clearRange, count, isRangePending, isSelecting, setSelecting } from './selection';

type ToastHandle = { update: (options: any) => void; close: () => void };

let selectionToast: ToastHandle | undefined;
let deleteSelected: (() => void) | undefined;

/** Shows a toast on both the current API (`show`) and older builds (`showToast`). */
function showToast(options: any): ToastHandle {
	const api = toasts as any;
	const show = api.show ?? api.showToast;

	return show.call(toasts, options);
}

/** Lets the UI call the delete flow without importing it and creating a cycle. */
export function setDeleteSelectedAction(action: (() => void) | undefined): void {
	deleteSelected = action;
}

/** Leaves selection mode and drops everything selected. */
export function exitSelection(): void {
	clearRange();
	setSelecting(false);
	clear();
	refreshSelectionToast();
}

/** Shows a short warning, such as when a message cannot be deleted by this account. */
export function showSelectionWarning(title: string, content: string): void {
	showToast({ title, content, duration: 5000 });
}

/**
 * @description Shows or updates the persistent toast that tracks selection mode. In the mode it
 * explains that taps select messages; once anything is selected it also offers Delete and Done.
 */
export function refreshSelectionToast(): void {
	const total = count();
	const active = isSelecting();
	const range = isRangePending();

	if (!total && !active) {
		selectionToast?.close();
		selectionToast = undefined;

		return;
	}

	const buttons: any[] = [];

	if (total && !range) {
		buttons.push({
			content: 'Delete',
			variant: 'primary',
			onPress: () => {
				deleteSelected?.();
			},
		});
	}

	buttons.push({
		content: 'Done',
		variant: 'secondary',
		onPress: exitSelection,
	});

	const options = {
		id: '1esthetic-multi-select-selection',
		title: range ? 'Select range' : total ? `Selected: ${total}` : 'Select messages',
		content: range
			? 'Tap the last message in the range.'
			: total
				? 'Tap more messages, then press Delete.'
				: 'Tap messages to select them.',
		duration: 0,
		buttons,
	};

	if (selectionToast) {
		selectionToast.update(options);
	} else {
		selectionToast = showToast(options);
	}
}

/** Closes the selection toast, such as when the plugin stops. */
export function closeSelectionToast(): void {
	selectionToast?.close();
	selectionToast = undefined;
}
