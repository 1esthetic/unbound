import type { PluginContext } from '@unbound-app/api/native';

import { confirmAndDelete } from './delete';
import { startMessageSheet } from './message-sheet';
import { startMessageTaps } from './message-tap';
import { startNativeHighlight } from './native-highlight';
import { exitSelection, refreshSelectionToast, setDeleteSelectedAction } from './selection-ui';

let stopMessageSheet: (() => void) | undefined;
let stopMessageTaps: (() => void) | undefined;
let stopNativeHighlight: (() => void) | undefined;
let stopChannelWatch: (() => void) | undefined;

function onChannelSelect() {
	exitSelection();
}

/**
 * @description Starts the multi-select features and clears the selection when the open channel
 * changes, so a deletion cannot target messages the user is no longer looking at.
 * @param context The plugin context, which carries the native bridge for the row highlight.
 */
export function startMultiSelect(context?: PluginContext): void {
	stopMessageSheet = startMessageSheet();
	stopMessageTaps = startMessageTaps();
	stopNativeHighlight = startNativeHighlight(context);
	setDeleteSelectedAction(() => {
		void confirmAndDelete();
	});

	try {
		const flux = (globalThis as any).unbound?.flux;
		const remove = flux?.onAction?.('CHANNEL_SELECT', onChannelSelect);

		if (typeof remove === 'function') {
			stopChannelWatch = remove;
		}
	} catch (error) {
		logger.warn('Could not watch channel changes:', error);
	}

	// A channel may already be open when the plugin turns on.
	refreshSelectionToast();
}

export function stopMultiSelect(): void {
	stopMessageSheet?.();
	stopMessageTaps?.();
	stopNativeHighlight?.();
	stopMessageSheet = undefined;
	stopMessageTaps = undefined;
	stopNativeHighlight = undefined;

	try {
		stopChannelWatch?.();
	} catch {
		// The dispatcher may be gone while Discord shuts down.
	}

	stopChannelWatch = undefined;
	setDeleteSelectedAction(undefined);
	exitSelection();
}
