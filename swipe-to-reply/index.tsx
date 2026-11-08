import { metro, patcher } from '@unbound-app/api';

// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
const REPLY = 1;
const REPLY_EDIT = 2;
const ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';

let unpatch: (() => void) | undefined;
let stopWaiting: (() => void) | undefined;
let stopped = false;

/**
 * @description Wraps the row generator so a swipe on your own message replies instead of editing.
 * @param module What Discord exports for the row generator's module.
 */
function patchRowManager(module: any) {
	if (stopped || unpatch) return;

	const RowManager = module?.default ?? module;
	const prototype = typeof RowManager === 'function' ? RowManager.prototype : undefined;

	// A module record can exist before its exports do, so an unusable candidate is not an error:
	// `onModuleLoaded` calls this again once Discord has finished loading the module.
	if (!prototype || typeof prototype.generate !== 'function') return;

	unpatch = patcher.after(prototype, 'generate', ({ result }: { result: any }) => {
		if (result?.swipeActions !== REPLY_EDIT) return result;

		result.swipeActions = REPLY;

		return result;
	});
}

export function start() {
	stopped = false;

	// `findLazy` never loads Discord's row generator to look for it, so the plugin stays off the
	// launch path. Register for the load first: the module record may already exist while its
	// exports are still being prepared, and patching it then would silently do nothing.
	const filter = metro.filters.byFilePath(ROW_MANAGER);
	const handle = metro.findLazy(filter);

	const remove = metro.onModuleLoaded(filter, patchRowManager);

	if (typeof remove === 'function') stopWaiting = remove;

	const loaded = metro.getLoadedModule(handle);

	if (loaded) patchRowManager(loaded);
}

export function stop() {
	stopped = true;

	stopWaiting?.();
	stopWaiting = undefined;

	unpatch?.();
	unpatch = undefined;
}
