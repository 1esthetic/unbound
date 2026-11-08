(function(exports,api){'use strict';// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
var REPLY = 1;
var REPLY_EDIT = 2;
var ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';
var unpatch;
function start() {
    // The class is behind a lazy module handle; load it before reading its prototype.
    var module = api.metro.findByFilePath(ROW_MANAGER, {
        lazy: false
    });
    var RowManager = module === null || module === void 0 ? void 0 : module.default;
    if (typeof RowManager !== 'function') {
        logger.warn('Could not find Discord’s row generator.');
        return;
    }
    unpatch = api.patcher.after(RowManager.prototype, 'generate', function(param) {
        var result = param.result;
        if ((result === null || result === void 0 ? void 0 : result.swipeActions) !== REPLY_EDIT) return result;
        result.swipeActions = REPLY;
        return result;
    });
}
function stop() {
    unpatch === null || unpatch === void 0 ? void 0 : unpatch();
    unpatch = undefined;
}exports.start=start;exports.stop=stop;return exports;})({},window.unbound);