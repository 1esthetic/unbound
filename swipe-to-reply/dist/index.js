(function(exports,api){'use strict';// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
var REPLY = 1;
var REPLY_EDIT = 2;
var ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';
var unpatch;
var stopWaiting;
var stopped = false;
/**
 * @description Wraps the row generator so a swipe on your own message replies instead of editing.
 * @param module What Discord exports for the row generator's module.
 */ function patchRowManager(module) {
    var _ref;
    if (stopped || unpatch) return;
    var RowManager = (_ref = module === null || module === void 0 ? void 0 : module.default) !== null && _ref !== void 0 ? _ref : module;
    var prototype = typeof RowManager === 'function' ? RowManager.prototype : undefined;
    // A module record can exist before its exports do, so an unusable candidate is not an error:
    // `onModuleLoaded` calls this again once Discord has finished loading the module.
    if (!prototype || typeof prototype.generate !== 'function') return;
    unpatch = api.patcher.after(prototype, 'generate', function(param) {
        var result = param.result;
        if ((result === null || result === void 0 ? void 0 : result.swipeActions) !== REPLY_EDIT) return result;
        result.swipeActions = REPLY;
        return result;
    });
}
function start() {
    stopped = false;
    // `findLazy` never loads Discord's row generator to look for it, so the plugin stays off the
    // launch path. Register for the load first: the module record may already exist while its
    // exports are still being prepared, and patching it then would silently do nothing.
    var filter = api.metro.filters.byFilePath(ROW_MANAGER);
    var handle = api.metro.findLazy(filter);
    var remove = api.metro.onModuleLoaded(filter, patchRowManager);
    if (typeof remove === 'function') stopWaiting = remove;
    var loaded = api.metro.getLoadedModule(handle);
    if (loaded) patchRowManager(loaded);
}
function stop() {
    stopped = true;
    stopWaiting === null || stopWaiting === void 0 ? void 0 : stopWaiting();
    stopWaiting = undefined;
    unpatch === null || unpatch === void 0 ? void 0 : unpatch();
    unpatch = undefined;
}exports.start=start;exports.stop=stop;return exports;})({},window.unbound);