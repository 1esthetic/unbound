import { metro, patcher } from '@unbound-app/api';

// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
const REPLY = 1;
const REPLY_EDIT = 2;
const ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';

let unpatch: (() => void) | undefined;
let stopped = false;

export function start() {
	stopped = false;

	// `findLazy` never runs Discord's row generator just to find it: it resolves when Discord
	// loads the module itself, which keeps the plugin off the launch path.
	void metro.findLazy(metro.filters.byFilePath(ROW_MANAGER)).then((module: any) => {
		if (stopped) return;

		const RowManager = module?.default ?? module;

		if (typeof RowManager !== 'function') {
			logger.warn('Could not find Discord’s row generator.');

			return;
		}

		const remove = patcher.after(RowManager.prototype, 'generate', ({ result }: { result: any }) => {
			if (result?.swipeActions !== REPLY_EDIT) return result;

			result.swipeActions = REPLY;

			return result;
		});

		if (stopped) {
			remove();
		} else {
			unpatch = remove;
		}
	});
}

export function stop() {
	stopped = true;
	unpatch?.();
	unpatch = undefined;
}
