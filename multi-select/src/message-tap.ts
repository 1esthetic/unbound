import { patcher } from '@unbound-app/api';

import { Chat } from './modules';
import { consumeSkippedTap } from './native-highlight';
import { handleMessageTap } from './range';
import { isSelecting, messageFromEvent } from './selection';
import { refreshSelectionToast, showSelectionWarning } from './selection-ui';

type TapHandler = (event: unknown) => unknown;
type ChatProps = Record<string, any> & { onTapMessage?: TapHandler };

/**
 * @description While selection mode is on, a single tap on a message toggles it and Discord's
 * own tap handling is skipped. Outside the mode the original handler runs unchanged.
 * @returns A function that removes the patch.
 */
export function startMessageTaps(): () => void {
	return patcher.before(Chat, 'default', ({ args }: { args: any[] }) => {
		const props = args[0] as ChatProps | undefined;
		const original = props?.onTapMessage;

		if (!props || typeof original !== 'function') return;

		const onTapMessage = (event: unknown) => {
			if (!isSelecting()) return original(event);

			const payload = event as Record<string, any> | undefined;
			const native = payload?.nativeEvent as Record<string, any> | undefined;
			const id = payload?.messageId ?? payload?.id ?? native?.messageId ?? native?.id;

			// The native touch hook already handled this tap on touch-up.
			if (id !== undefined && consumeSkippedTap(String(id))) return;

			const message = messageFromEvent(event);

			if (!message) return;

			const result = handleMessageTap(message);

			if (result.kind === 'blocked') {
				showSelectionWarning(
					'Cannot delete this message',
					"It isn't yours and you don't have Manage Messages in this channel.",
				);

				return;
			}

			if (result.kind === 'range') {
				if (result.wrongChannel) {
					showSelectionWarning(
						'Range selection',
						'Pick the last message in the same channel.',
					);
				} else if (result.skipped > 0) {
					showSelectionWarning(
						'Range selection',
						`Skipped ${result.skipped} message${result.skipped === 1 ? '' : 's'} you can't delete.`,
					);
				}
			}

			refreshSelectionToast();
		};

		return [{ ...props, onTapMessage }];
	});
}
