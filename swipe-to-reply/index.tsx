import { metro, patcher } from '@unbound-app/api';

// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
const REPLY = 1;
const REPLY_EDIT = 2;
const ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';

let unpatch: (() => void) | undefined;

export function start() {
	// The class is behind a lazy module handle; load it before reading its prototype.
	const module = metro.findByFilePath(ROW_MANAGER, { lazy: false }) as any;
	const RowManager = module?.default;

	if (typeof RowManager !== 'function') {
		logger.warn('Could not find Discord’s row generator.');

		return;
	}

	unpatch = patcher.after(RowManager.prototype, 'generate', ({ result }: { result: any }) => {
		if (result?.swipeActions !== REPLY_EDIT) return result;

		result.swipeActions = REPLY;

		return result;
	});
}

export function stop() {
	unpatch?.();
	unpatch = undefined;
}
