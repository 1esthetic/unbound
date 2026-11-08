(function(exports){'use strict';function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
/** The theme's chat colour, used behind the native swipe indicator. */ var CHAT = [
    0x12,
    0x12,
    0x12
];
/** The theme's accent, used for the reply circle. */ var ACCENT = [
    0x7d,
    0x75,
    0x69
];
var hook;
function uiColor(objc, param) {
    var _param = _sliced_to_array(param, 3), r = _param[0], g = _param[1], b = _param[2];
    return objc.call(objc.getClass('UIColor'), 'colorWithRed:green:blue:alpha:', r / 255, g / 255, b / 255, 1);
}
function isBlue(description) {
    if (typeof description !== 'string') return false;
    var match = description.match(/([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/);
    if (!match) return false;
    var _match_slice_map = _sliced_to_array(match.slice(1, 4).map(Number), 3), r = _match_slice_map[0], g = _match_slice_map[1], b = _match_slice_map[2];
    return b > r + 0.15 && b > g + 0.1;
}
function underSwipe(objc, view) {
    var current = objc.call(view, 'superview');
    for(var depth = 0; depth < 6 && current; depth++){
        if (objc.className(current) === 'DCDSwipeToReplyView') return true;
        current = objc.call(current, 'superview');
    }
    return false;
}
/** Only paint while Nocturne is the applied theme, so another theme or light mode stays Discord's. */ function nocturneApplied() {
    var _globalThis_unbound;
    var themes = (_globalThis_unbound = globalThis.unbound) === null || _globalThis_unbound === void 0 ? void 0 : _globalThis_unbound.themes;
    return !themes || themes.isEnabled('1esthetic.nocturne');
}
/**
 * @description Swaps Discord's blurple swipe background for the theme colours. Discord draws the
 * swipe indicator natively, so themes cannot recolour it; this catches the colour before it is set.
 */ function start(context) {
    var _context_native;
    var objc = context === null || context === void 0 ? void 0 : (_context_native = context.native) === null || _context_native === void 0 ? void 0 : _context_native.objc;
    if (!(objc === null || objc === void 0 ? void 0 : objc.hook)) {
        logger.warn('No native bridge; the swipe indicator keeps Discord’s colours.');
        return;
    }
    var chat = uiColor(objc, CHAT);
    var accent = uiColor(objc, ACCENT);
    hook = objc.hook('UIView', 'setBackgroundColor:', {
        before: function before(ctx) {
            try {
                if (!nocturneApplied()) return;
                var color = ctx.args[0];
                if (!color) return;
                if (objc.className(ctx.self) === 'DCDSwipeToReplyView') {
                    ctx.replaceObjectArgument(0, chat);
                    return;
                }
                var description = objc.call(color, 'description');
                if (isBlue(description) && underSwipe(objc, ctx.self)) {
                    ctx.replaceObjectArgument(0, accent);
                }
            } catch (error) {
                logger.warn('Could not recolour the swipe background:', error);
            }
        }
    });
}
function stop() {
    hook === null || hook === void 0 ? void 0 : hook.remove();
    hook = undefined;
}exports.start=start;exports.stop=stop;return exports;})({});