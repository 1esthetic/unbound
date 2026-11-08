(function(exports,api){'use strict';// REPLY_EDIT is 2, REPLY is 1 in Discord's SwipeActionsType. Forcing 2 to 1 keeps the swipe
// gesture but makes it reply on your own messages instead of opening the editor.
var REPLY = 1;
var REPLY_EDIT = 2;
var ROW_MANAGER = 'modules/messages/native/renderer/RowGenerator.tsx';
var unpatch;
var stopped = false;
function start() {
    stopped = false;
    // `findLazy` never runs Discord's row generator just to find it: it resolves when Discord
    // loads the module itself, which keeps the plugin off the launch path.
    void api.metro.findLazy(api.metro.filters.byFilePath(ROW_MANAGER)).then(function(module) {
        var _ref;
        if (stopped) return;
        var RowManager = (_ref = module === null || module === void 0 ? void 0 : module.default) !== null && _ref !== void 0 ? _ref : module;
        if (typeof RowManager !== 'function') {
            logger.warn('Could not find Discord’s row generator.');
            return;
        }
        var remove = api.patcher.after(RowManager.prototype, 'generate', function(param) {
            var result = param.result;
            if ((result === null || result === void 0 ? void 0 : result.swipeActions) !== REPLY_EDIT) return result;
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
function stop() {
    stopped = true;
    unpatch === null || unpatch === void 0 ? void 0 : unpatch();
    unpatch = undefined;
}exports.start=start;exports.stop=stop;return exports;})({},window.unbound);