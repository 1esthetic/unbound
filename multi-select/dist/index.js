(function(exports,api,react){'use strict';var ActionSheets = api.metro.api.ActionSheets;
var Constants = api.metro.common.Constants;
/**
 * The runtime exposes stores through `unbound.flux`. Older SDK builds read them with
 * `metro.findStore`, so both paths are kept for compatibility.
 */ var runtime = globalThis.unbound;
var flux = runtime === null || runtime === void 0 ? void 0 : runtime.flux;
var findStore = function findStore(name) {
    var _ref;
    var _flux_getStore, _metro_findStore;
    return (_ref = flux === null || flux === void 0 ? void 0 : (_flux_getStore = flux.getStore) === null || _flux_getStore === void 0 ? void 0 : _flux_getStore.call(flux, name)) !== null && _ref !== void 0 ? _ref : (_metro_findStore = api.metro.findStore) === null || _metro_findStore === void 0 ? void 0 : _metro_findStore.call(api.metro, name);
};
var ChannelStore = findStore('Channel');
var MessageStore = findStore('Message');
var SelectedChannelStore = findStore('SelectedChannel');
var UserStore = findStore('User');
var PermissionStore = findStore('Permission');
/**
 * The chat screen receives Discord's single-tap and long-press message handlers as props.
 * Patching it lets selection mode intercept taps before Discord handles them.
 */ var Chat = api.metro.findByFilePath('modules/chat/native/Chat.ios.tsx');
/**
 * Discord has moved message actions between modules across builds, so the delete call is resolved
 * lazily and from a couple of candidates instead of being read at module scope.
 */ function getDeleteMessage() {
    var candidates = [
        api.metro.api.Messages,
        api.metro.findByProps('deleteMessage')
    ];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = candidates[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var candidate = _step.value;
            var deleteMessage = candidate === null || candidate === void 0 ? void 0 : candidate.deleteMessage;
            if (typeof deleteMessage === 'function') {
                return deleteMessage.bind(candidate);
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return undefined;
}var selected = new Map();
var listeners = new Set();
var selecting = false;
var rangeStart = null;
function notify() {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var listener = _step.value;
            listener();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}
function subscribe(listener) {
    listeners.add(listener);
    return function() {
        return listeners.delete(listener);
    };
}
function getSelected() {
    return Array.from(selected.values());
}
function count() {
    return selected.size;
}
function isSelected(messageId) {
    return selected.has(messageId);
}
/** Whether tapping a message toggles it instead of opening or focusing it. */ function isSelecting() {
    return selecting;
}
function setSelecting(value) {
    selecting = value;
    notify();
}
function clear() {
    if (!selected.size) return;
    selected.clear();
    notify();
}
function toggle(message) {
    if (selected.has(message.id)) {
        selected.delete(message.id);
        notify();
        return 'removed';
    }
    selected.set(message.id, message);
    notify();
    return 'added';
}
/** Adds every message that is not selected yet, notifying once. */ function addMany(messages) {
    var added = 0;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = messages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var message = _step.value;
            if (selected.has(message.id)) continue;
            selected.set(message.id, message);
            added += 1;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    if (added) notify();
    return added;
}
/** The message a range starts at, while the user is choosing its other end. */ function getRangeStart() {
    return rangeStart;
}
function isRangePending() {
    return rangeStart !== null;
}
/** Clears the selection and waits for the user to tap the last message of a range. */ function startRange(message) {
    selected.clear();
    rangeStart = message;
    selecting = true;
    notify();
}
function clearRange() {
    rangeStart = null;
}
/**
 * @description Turns a Discord message record into the small record the selection keeps.
 * @param message The message record.
 * @param fallbackChannelId A channel to use when the record carries none.
 * @returns The selected record, or `null` when the message or its channel is missing.
 */ function toSelected(message, fallbackChannelId) {
    var _ref, _message_channel_id, _ref1, _ref2;
    var _message_author;
    if (!(message === null || message === void 0 ? void 0 : message.id)) return null;
    var channelId = (_ref = (_message_channel_id = message.channel_id) !== null && _message_channel_id !== void 0 ? _message_channel_id : message.channelId) !== null && _ref !== void 0 ? _ref : fallbackChannelId;
    if (typeof channelId !== 'string') return null;
    return {
        id: String(message.id),
        channelId: channelId,
        authorId: String((_ref1 = (_ref2 = (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.id) !== null && _ref2 !== void 0 ? _ref2 : message.authorId) !== null && _ref1 !== void 0 ? _ref1 : ''),
        preview: typeof message.content === 'string' ? message.content.slice(0, 120) : ''
    };
}
/**
 * @description Reads the message a long-press sheet is about, in the shapes Discord has used.
 * @param props The props Discord opened the sheet with.
 * @returns The message, or `null` when the sheet is not about a message.
 */ function messageFromSheet(props) {
    var _ref, _message_channel_id;
    var _MessageStore_getMessage;
    var sheet = props;
    var message = sheet === null || sheet === void 0 ? void 0 : sheet.message;
    if (!(message === null || message === void 0 ? void 0 : message.id)) return null;
    var channelId = (_ref = (_message_channel_id = message.channel_id) !== null && _message_channel_id !== void 0 ? _message_channel_id : message.channelId) !== null && _ref !== void 0 ? _ref : sheet === null || sheet === void 0 ? void 0 : sheet.channelId;
    if (typeof channelId !== 'string') return null;
    // The sheet's message can be a trimmed view model; the store has the author and full record.
    var stored = MessageStore === null || MessageStore === void 0 ? void 0 : (_MessageStore_getMessage = MessageStore.getMessage) === null || _MessageStore_getMessage === void 0 ? void 0 : _MessageStore_getMessage.call(MessageStore, channelId, String(message.id));
    return toSelected(stored !== null && stored !== void 0 ? stored : message, channelId);
}
/**
 * @description Reads the message from the payload Discord's chat sends to its tap handler.
 * @param event The native tap event, which carries at least a message id.
 * @returns The message, or `null` when the id or the stored message is missing.
 */ function messageFromEvent(event) {
    var _ref, _ref1, _ref2, _ref3, _ref4;
    var _SelectedChannelStore_getChannelId, _MessageStore_getMessage;
    var payload = event;
    var native = payload === null || payload === void 0 ? void 0 : payload.nativeEvent;
    var messageId = (_ref = (_ref1 = (_ref2 = payload === null || payload === void 0 ? void 0 : payload.messageId) !== null && _ref2 !== void 0 ? _ref2 : payload === null || payload === void 0 ? void 0 : payload.id) !== null && _ref1 !== void 0 ? _ref1 : native === null || native === void 0 ? void 0 : native.messageId) !== null && _ref !== void 0 ? _ref : native === null || native === void 0 ? void 0 : native.id;
    var channelId = (_ref3 = (_ref4 = payload === null || payload === void 0 ? void 0 : payload.channelId) !== null && _ref4 !== void 0 ? _ref4 : native === null || native === void 0 ? void 0 : native.channelId) !== null && _ref3 !== void 0 ? _ref3 : SelectedChannelStore === null || SelectedChannelStore === void 0 ? void 0 : (_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId) === null || _SelectedChannelStore_getChannelId === void 0 ? void 0 : _SelectedChannelStore_getChannelId.call(SelectedChannelStore);
    if (messageId === undefined || typeof channelId !== 'string') return null;
    var stored = MessageStore === null || MessageStore === void 0 ? void 0 : (_MessageStore_getMessage = MessageStore.getMessage) === null || _MessageStore_getMessage === void 0 ? void 0 : _MessageStore_getMessage.call(MessageStore, channelId, String(messageId));
    return toSelected(stored, channelId);
}
/**
 * @description Checks whether the current account may delete a message: its own always, another
 * author's only with Manage Messages. When the permission modules are unavailable the server is
 * left to decide, so the plugin does not block a deletion it cannot judge.
 * @param message The selected message.
 * @returns `true` when the delete may be attempted.
 */ function canDelete(message) {
    var _UserStore_getCurrentUser, _Constants_Permissions, _ChannelStore_getChannel;
    var me = UserStore === null || UserStore === void 0 ? void 0 : (_UserStore_getCurrentUser = UserStore.getCurrentUser) === null || _UserStore_getCurrentUser === void 0 ? void 0 : _UserStore_getCurrentUser.call(UserStore);
    if (!(me === null || me === void 0 ? void 0 : me.id)) return true;
    // An unknown author is left to the server rather than guessed at.
    if (!message.authorId) return true;
    if (message.authorId === me.id) return true;
    var permission = Constants === null || Constants === void 0 ? void 0 : (_Constants_Permissions = Constants.Permissions) === null || _Constants_Permissions === void 0 ? void 0 : _Constants_Permissions.MANAGE_MESSAGES;
    if (!permission || typeof (PermissionStore === null || PermissionStore === void 0 ? void 0 : PermissionStore.can) !== 'function') return true;
    var channel = ChannelStore === null || ChannelStore === void 0 ? void 0 : (_ChannelStore_getChannel = ChannelStore.getChannel) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.call(ChannelStore, message.channelId);
    if (!channel) return true;
    try {
        return PermissionStore.can(permission, channel) === true;
    } catch (unused) {
        return true;
    }
}var selectionToast;
var deleteSelected;
/** Shows a toast on both the current API (`show`) and older builds (`showToast`). */ function showToast$1(options) {
    var _api_show;
    var api$1 = api.toasts;
    var show = (_api_show = api$1.show) !== null && _api_show !== void 0 ? _api_show : api$1.showToast;
    return show.call(api.toasts, options);
}
/** Lets the UI call the delete flow without importing it and creating a cycle. */ function setDeleteSelectedAction(action) {
    deleteSelected = action;
}
/** Leaves selection mode and drops everything selected. */ function exitSelection() {
    clearRange();
    setSelecting(false);
    clear();
    refreshSelectionToast();
}
/** Shows a short warning, such as when a message cannot be deleted by this account. */ function showSelectionWarning(title, content) {
    showToast$1({
        title: title,
        content: content,
        duration: 5000
    });
}
/**
 * @description Shows or updates the persistent toast that tracks selection mode. In the mode it
 * explains that taps select messages; once anything is selected it also offers Delete and Done.
 */ function refreshSelectionToast() {
    var total = count();
    var active = isSelecting();
    var range = isRangePending();
    if (!total && !active) {
        selectionToast === null || selectionToast === void 0 ? void 0 : selectionToast.close();
        selectionToast = undefined;
        return;
    }
    var buttons = [];
    if (total && !range) {
        buttons.push({
            content: 'Delete',
            variant: 'primary',
            onPress: function onPress() {
                deleteSelected === null || deleteSelected === void 0 ? void 0 : deleteSelected();
            }
        });
    }
    buttons.push({
        content: 'Done',
        variant: 'secondary',
        onPress: exitSelection
    });
    var options = {
        id: 'tunya-multi-select-selection',
        title: range ? 'Select range' : total ? "Selected: ".concat(total) : 'Select messages',
        content: range ? 'Tap the last message in the range.' : total ? 'Tap more messages, then press Delete.' : 'Tap messages to select them.',
        duration: 0,
        buttons: buttons
    };
    if (selectionToast) {
        selectionToast.update(options);
    } else {
        selectionToast = showToast$1(options);
    }
}function asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator$1(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator$1(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
var failures = [];
function showToast(options) {
    var _api_show;
    var api$1 = api.toasts;
    var show = (_api_show = api$1.show) !== null && _api_show !== void 0 ? _api_show : api$1.showToast;
    return show.call(api.toasts, options);
}
function sleep(ms) {
    return new Promise(function(resolve) {
        return setTimeout(resolve, ms);
    });
}
function errorStatus(error) {
    var _ref, _ref1, _ref2;
    var _error_body;
    var value = (_ref = (_ref1 = (_ref2 = error === null || error === void 0 ? void 0 : error.status) !== null && _ref2 !== void 0 ? _ref2 : error === null || error === void 0 ? void 0 : error.statusCode) !== null && _ref1 !== void 0 ? _ref1 : error === null || error === void 0 ? void 0 : error.code) !== null && _ref !== void 0 ? _ref : error === null || error === void 0 ? void 0 : (_error_body = error.body) === null || _error_body === void 0 ? void 0 : _error_body.code;
    return typeof value === 'number' ? value : undefined;
}
function deleteOne(deleteMessage, item) {
    return _async_to_generator$1(function() {
        var attempt, error, status, _ref, _ref1, _ref2, _error_body, retryAfter, wait;
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    attempt = 0;
                    _state.label = 1;
                case 1:
                    if (!(attempt < 5)) return [
                        3,
                        8
                    ];
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        4,
                        ,
                        7
                    ]);
                    return [
                        4,
                        deleteMessage(item.channelId, item.id)
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    error = _state.sent();
                    status = errorStatus(error);
                    if (!((status === 429 || status === 502 || status === 503) && attempt < 4)) return [
                        3,
                        6
                    ];
                    retryAfter = (_ref = (_ref1 = (_ref2 = error === null || error === void 0 ? void 0 : error.retryAfter) !== null && _ref2 !== void 0 ? _ref2 : error === null || error === void 0 ? void 0 : error.retry_after) !== null && _ref1 !== void 0 ? _ref1 : error === null || error === void 0 ? void 0 : (_error_body = error.body) === null || _error_body === void 0 ? void 0 : _error_body.retry_after) !== null && _ref !== void 0 ? _ref : 1;
                    wait = Math.min(10, Math.max(1, Number(retryAfter))) * 1000;
                    return [
                        4,
                        sleep(wait)
                    ];
                case 5:
                    _state.sent();
                    return [
                        3,
                        7
                    ];
                case 6:
                    throw error;
                case 7:
                    attempt += 1;
                    return [
                        3,
                        1
                    ];
                case 8:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Asks for confirmation and deletes every selected message one by one. The progress
 * toast is updated after each call, and failures are counted instead of aborting the rest.
 */ function confirmAndDelete() {
    return _async_to_generator$1(function() {
        var items, deleteMessage, title, confirm, confirmed, _tmp, progress, deleted, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, error, _ref, err;
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    items = getSelected();
                    if (!items.length) return [
                        2
                    ];
                    deleteMessage = getDeleteMessage();
                    if (!deleteMessage) {
                        showToast({
                            title: 'Multi Select',
                            content: 'Could not find the message delete action in this Discord version.',
                            duration: 6000
                        });
                        return [
                            2
                        ];
                    }
                    title = "Delete ".concat(items.length, " message").concat(items.length === 1 ? '' : 's', "?");
                    confirm = api.dialogs.confirm;
                    if (!(confirm.length >= 2)) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        confirm(title, {
                            body: 'This cannot be undone.',
                            confirm: 'Delete',
                            cancel: 'Cancel',
                            destructive: true
                        })
                    ];
                case 1:
                    _tmp = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 2:
                    return [
                        4,
                        confirm({
                            title: title,
                            body: 'This cannot be undone.',
                            confirmLabel: 'Delete',
                            cancelLabel: 'Cancel',
                            destructive: true
                        })
                    ];
                case 3:
                    _tmp = _state.sent();
                    _state.label = 4;
                case 4:
                    confirmed = _tmp;
                    if (!confirmed) {
                        refreshSelectionToast();
                        return [
                            2
                        ];
                    }
                    failures.length = 0;
                    progress = showToast({
                        title: 'Deleting messages…',
                        content: "0/".concat(items.length),
                        duration: 0
                    });
                    deleted = 0;
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 5;
                case 5:
                    _state.trys.push([
                        5,
                        14,
                        15,
                        16
                    ]);
                    _iterator = items[Symbol.iterator]();
                    _state.label = 6;
                case 6:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        13
                    ];
                    item = _step.value;
                    _state.label = 7;
                case 7:
                    _state.trys.push([
                        7,
                        9,
                        ,
                        10
                    ]);
                    return [
                        4,
                        deleteOne(deleteMessage, item)
                    ];
                case 8:
                    _state.sent();
                    deleted += 1;
                    return [
                        3,
                        10
                    ];
                case 9:
                    error = _state.sent();
                    failures.push({
                        id: item.id,
                        channelId: item.channelId,
                        status: errorStatus(error),
                        code: typeof (error === null || error === void 0 ? void 0 : error.code) === 'number' ? error.code : undefined,
                        message: String((_ref = error === null || error === void 0 ? void 0 : error.message) !== null && _ref !== void 0 ? _ref : error)
                    });
                    logger.warn("Could not delete message ".concat(item.id, ":"), error);
                    return [
                        3,
                        10
                    ];
                case 10:
                    progress.update({
                        content: "".concat(deleted + failures.length, "/").concat(items.length)
                    });
                    if (!(deleted + failures.length < items.length)) return [
                        3,
                        12
                    ];
                    return [
                        4,
                        sleep(250)
                    ];
                case 11:
                    _state.sent();
                    _state.label = 12;
                case 12:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        6
                    ];
                case 13:
                    return [
                        3,
                        16
                    ];
                case 14:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        16
                    ];
                case 15:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 16:
                    setSelecting(false);
                    clear();
                    refreshSelectionToast();
                    progress.close();
                    if (failures.length) {
                        showToast({
                            title: 'Some messages were not deleted',
                            content: "Deleted: ".concat(deleted, ". Failed: ").concat(failures.length, "."),
                            duration: 3000
                        });
                    } else {
                        showToast({
                            title: 'Done',
                            content: "Deleted: ".concat(deleted, "."),
                            duration: 3000
                        });
                    }
                    return [
                        2
                    ];
            }
        });
    })();
}function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Finds the function behind a component export, unwrapping memo and forwardRef wrappers.
 * @param owner The module or element that holds the component.
 * @param key The property holding it, `default` for a module export.
 * @returns The object and key to patch, or `null` when there is no render function.
 */ function findRenderTarget(owner) {
    var key = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'default';
    var holder = owner;
    var prop = key;
    var current = owner[key];
    while(current && (typeof current === "undefined" ? "undefined" : _type_of$3(current)) === 'object'){
        var next = current.type ? 'type' : current.render ? 'render' : null;
        if (!next) break;
        holder = current;
        prop = next;
        current = current[next];
    }
    return typeof current === 'function' ? {
        holder: holder,
        key: prop
    } : null;
}function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var MAX_DEPTH = 15;
function isElementNode(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$2(value)) === 'object' && value !== null;
}
function getElementName(element) {
    var _type_displayName, _ref, _ref1, _ref2, _ref3, _ref4;
    var _type_render, _type_render1, _type_type, _type_type1;
    var type = element.type;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') return (_type_displayName = type.displayName) !== null && _type_displayName !== void 0 ? _type_displayName : type.name;
    return (_ref = (_ref1 = (_ref2 = (_ref3 = (_ref4 = type === null || type === void 0 ? void 0 : type.displayName) !== null && _ref4 !== void 0 ? _ref4 : type === null || type === void 0 ? void 0 : type.name) !== null && _ref3 !== void 0 ? _ref3 : type === null || type === void 0 ? void 0 : (_type_render = type.render) === null || _type_render === void 0 ? void 0 : _type_render.displayName) !== null && _ref2 !== void 0 ? _ref2 : type === null || type === void 0 ? void 0 : (_type_render1 = type.render) === null || _type_render1 === void 0 ? void 0 : _type_render1.name) !== null && _ref1 !== void 0 ? _ref1 : type === null || type === void 0 ? void 0 : (_type_type = type.type) === null || _type_type === void 0 ? void 0 : _type_type.displayName) !== null && _ref !== void 0 ? _ref : type === null || type === void 0 ? void 0 : (_type_type1 = type.type) === null || _type_type1 === void 0 ? void 0 : _type_type1.name;
}
function findElement(node, predicate) {
    var depth = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    var _node_props;
    if (depth > MAX_DEPTH || !isElementNode(node)) return;
    if (Array.isArray(node)) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = node[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var child = _step.value;
                var match = findElement(child, predicate, depth + 1);
                if (match) return match;
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return;
    }
    if (predicate(node)) return node;
    return findElement((_node_props = node.props) === null || _node_props === void 0 ? void 0 : _node_props.children, predicate, depth + 1);
}
function isRow(value) {
    if (!isElementNode(value) || !isElementNode(value.props) || Array.isArray(value.props)) {
        return false;
    }
    return typeof value.props.label === 'string' && typeof value.props.onPress === 'function';
}
function isActionSheetRowGroup(value) {
    var _value_props, _value_props1;
    if (!isElementNode(value) || Array.isArray(value)) return false;
    if (getElementName(value) === 'ActionSheetRowGroup') return true;
    var children = (_value_props = value.props) === null || _value_props === void 0 ? void 0 : _value_props.children;
    if (typeof ((_value_props1 = value.props) === null || _value_props1 === void 0 ? void 0 : _value_props1.hasIcons) !== 'boolean' || !Array.isArray(children)) return false;
    return children.length > 0 && children.every(isRow);
}
function getActionSheetRow() {
    return api.metro.components.BottomSheets.ActionSheetRow;
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _iterable_to_array_limit$1(arr, i) {
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
function _non_iterable_rest$1() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest$1();
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread$1();
}
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
function assetId(name) {
    var _assets_getIDByName;
    var get = (_assets_getIDByName = api.assets.getIDByName) !== null && _assets_getIDByName !== void 0 ? _assets_getIDByName : api.assets.getIdByName;
    return typeof get === 'function' ? get.call(api.assets, name) : undefined;
}
/**
 * @description Adds the selection rows to Discord's message long-press sheet: a row that enters
 * selection mode and toggles the open message, plus Delete and Done while the mode is on.
 * @returns A function that removes every patch and ignores sheets still loading afterwards.
 */ function startMessageSheet() {
    var current = null;
    var sheetKey = null;
    var disposed = false;
    var unpatches = [];
    var patchedModules = new WeakSet();
    var hide = function hide() {
        if (!sheetKey) return;
        try {
            ActionSheets.hideActionSheet(sheetKey);
        } catch (error) {
            logger.warn('Could not close the action sheet:', error);
        }
    };
    var render = function render(result) {
        var _rows;
        var _findElement_props, _findElement;
        if (!current || disposed) return result;
        var Row = getActionSheetRow();
        if (!Row) return result;
        var rows = (_findElement = findElement(result, isActionSheetRowGroup)) === null || _findElement === void 0 ? void 0 : (_findElement_props = _findElement.props) === null || _findElement_props === void 0 ? void 0 : _findElement_props.children;
        if (!Array.isArray(rows)) return result;
        if (rows.some(function(row) {
            return (row === null || row === void 0 ? void 0 : row.key) === 'tunya-multi-select-toggle';
        })) return result;
        var rowIcon = function rowIcon() {
            for(var _len = arguments.length, names = new Array(_len), _key = 0; _key < _len; _key++){
                names[_key] = arguments[_key];
            }
            if (!Row.Icon) return undefined;
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = names[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var name = _step.value;
                    var source = assetId(name);
                    if (source !== undefined) return /*#__PURE__*/ react.createElement(Row.Icon, {
                        source: source
                    });
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
            return undefined;
        };
        var message = current;
        var selected = isSelected(message.id);
        var total = count();
        var additions = [
            /*#__PURE__*/ react.createElement(Row, {
                key: 'tunya-multi-select-toggle',
                label: selected ? 'Deselect message' : 'Select message',
                icon: selected ? rowIcon('CheckmarkLargeIcon') : rowIcon('PlusLargeIcon', 'PlusMediumIcon', 'CirclePlusIcon', 'AddIcon'),
                onPress: function onPress() {
                    hide();
                    if (!selected && !canDelete(message)) {
                        showSelectionWarning('Cannot delete this message', "It isn't yours and you don't have Manage Messages in this channel.");
                        return;
                    }
                    setSelecting(true);
                    toggle(message);
                    refreshSelectionToast();
                }
            })
        ];
        additions.push(/*#__PURE__*/ react.createElement(Row, {
            key: 'tunya-multi-select-range',
            label: 'Select range from here',
            icon: rowIcon('ArrowLargeDownIcon', 'ArrowDownIcon', 'ChevronLargeRightIcon'),
            onPress: function onPress() {
                hide();
                startRange(message);
                refreshSelectionToast();
            }
        }));
        if (isSelecting() || total > 0) {
            var _rowIcon;
            if (total > 0) {
                var _rowIcon1;
                additions.push(/*#__PURE__*/ react.createElement(Row, {
                    key: 'tunya-multi-select-delete',
                    label: "Delete selected (".concat(total, ")"),
                    icon: (_rowIcon1 = rowIcon('TrashIcon')) !== null && _rowIcon1 !== void 0 ? _rowIcon1 : rowIcon('DeleteIcon'),
                    variant: 'danger',
                    onPress: function onPress() {
                        hide();
                        void confirmAndDelete();
                    }
                }));
            }
            additions.push(/*#__PURE__*/ react.createElement(Row, {
                key: 'tunya-multi-select-done',
                label: 'Done selecting',
                icon: (_rowIcon = rowIcon('CircleXIcon')) !== null && _rowIcon !== void 0 ? _rowIcon : rowIcon('XIcon'),
                onPress: function onPress() {
                    hide();
                    exitSelection();
                }
            }));
        }
        for(var index = rows.length - 1; index >= 0; index -= 1){
            var _rows_index;
            var key = (_rows_index = rows[index]) === null || _rows_index === void 0 ? void 0 : _rows_index.key;
            if (typeof key === 'string' && key.startsWith('tunya-multi-select-')) {
                rows.splice(index, 1);
            }
        }
        (_rows = rows).splice.apply(_rows, [
            Math.min(1, rows.length),
            0
        ].concat(_to_consumable_array$1(additions)));
        return result;
    };
    function patchModule(module) {
        if (disposed || !module || (typeof module === "undefined" ? "undefined" : _type_of$1(module)) !== 'object' || patchedModules.has(module)) return;
        patchedModules.add(module);
        var target = findRenderTarget(module);
        if (!target) return;
        unpatches.push(api.patcher.after(target.holder, target.key, function(param) {
            var result = param.result;
            return render(result);
        }));
    }
    // Most sheets, including iOS's message long-press sheet, arrive through openLazy.
    unpatches.push(api.patcher.before(ActionSheets, 'openLazy', function(param) {
        var args = param.args;
        var _args = _sliced_to_array$1(args, 3), sheet = _args[0], key = _args[1], props = _args[2];
        if (typeof key !== 'string' || !key.endsWith('MessageLongPressActionSheet') || !props) {
            return;
        }
        var message = messageFromSheet(props);
        if (!message) return;
        current = message;
        sheetKey = key;
        if (sheet && typeof sheet.then === 'function') {
            sheet.then(patchModule).catch(function() {
                return undefined;
            });
        }
    }));
    // Some builds render the sheet directly instead of opening it through openLazy.
    void Promise.resolve(api.metro.findLazy(api.metro.filters.byFilePath('modules/messages/native/long_press/LongPressMessageActionSheet.tsx'))).then(function(module) {
        if (disposed || !module || (typeof module === "undefined" ? "undefined" : _type_of$1(module)) !== 'object') return;
        var target = findRenderTarget(module);
        if (!target) return;
        unpatches.push(api.patcher.after(target.holder, target.key, function(context) {
            var _context_args;
            var message = messageFromSheet((_context_args = context.args) === null || _context_args === void 0 ? void 0 : _context_args[0]);
            if (!message) return context.result;
            current = message;
            sheetKey = null;
            return render(context.result);
        }));
    }).catch(function() {
        return undefined;
    });
    return function() {
        disposed = true;
        current = null;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    };
}function _define_property$1(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _object_spread$1(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$1(target, key, source[key]);
        });
    }
    return target;
}
function recordsOf(channelId) {
    var _MessageStore_getMessages;
    var collection = MessageStore === null || MessageStore === void 0 ? void 0 : (_MessageStore_getMessages = MessageStore.getMessages) === null || _MessageStore_getMessages === void 0 ? void 0 : _MessageStore_getMessages.call(MessageStore, channelId);
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (typeof collection.toArray === 'function') return collection.toArray();
    if (Array.isArray(collection._array)) return collection._array;
    return [];
}
/**
 * @description Selects every message between the pending range start and the tapped end,
 * including both. Messages the account cannot delete are counted but left out.
 * @param end The message that closes the range.
 * @returns How many messages were added and skipped, and whether the end was in another channel.
 */ function completeRange(end) {
    var start = getRangeStart();
    clearRange();
    if (!start) return {
        added: 0,
        skipped: 0,
        wrongChannel: false
    };
    if (start.channelId !== end.channelId) {
        return {
            added: 0,
            skipped: 0,
            wrongChannel: true
        };
    }
    var records = recordsOf(start.channelId);
    var startIndex = records.findIndex(function(record) {
        return String(record.id) === start.id;
    });
    var endIndex = records.findIndex(function(record) {
        return String(record.id) === end.id;
    });
    var recordsInRange;
    if (startIndex === -1 || endIndex === -1) {
        recordsInRange = [
            start,
            end
        ];
    } else {
        var from = Math.min(startIndex, endIndex);
        var to = Math.max(startIndex, endIndex);
        recordsInRange = records.slice(from, to + 1);
    }
    var messages = recordsInRange.map(function(record) {
        return toSelected(record, start.channelId);
    }).filter(function(message) {
        return message !== null;
    }).filter(function(message) {
        return canDelete(message);
    });
    return {
        added: addMany(messages),
        skipped: recordsInRange.length - messages.length,
        wrongChannel: false
    };
}
/**
 * @description Applies a message tap: closes the pending range when there is one, otherwise
 * toggles the message if the account may delete it.
 * @param message The tapped message.
 * @returns What the tap did, so the caller can show the matching feedback.
 */ function handleMessageTap(message) {
    if (getRangeStart()) {
        return _object_spread$1({
            kind: 'range'
        }, completeRange(message));
    }
    if (!canDelete(message)) return {
        kind: 'blocked'
    };
    toggle(message);
    return {
        kind: 'toggle'
    };
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
var MESSAGE_CELL = 'DCDMessageTableViewCell';
var skipTapId;
var skipTapTimer;
/**
 * @description Tells whether a native tap already handled this message, so the slower JS tap
 * Discord sends afterwards does not toggle it a second time.
 * @param messageId The message the JS tap is about.
 * @returns `true` when the native touch handler already handled it.
 */ function consumeSkippedTap(messageId) {
    if (skipTapId !== messageId) return false;
    skipTapId = undefined;
    if (skipTapTimer) clearTimeout(skipTapTimer);
    skipTapTimer = undefined;
    return true;
}
function markSkippedTap(messageId) {
    skipTapId = messageId;
    if (skipTapTimer) clearTimeout(skipTapTimer);
    skipTapTimer = setTimeout(function() {
        skipTapId = undefined;
        skipTapTimer = undefined;
    }, 1500);
}
function stringValue(value) {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of(value)) === 'bigint') return String(value);
}
function nativeString(value, objc) {
    return _async_to_generator(function() {
        var direct;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    direct = stringValue(value);
                    if (direct || !value || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== 'object') return [
                        2,
                        direct
                    ];
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        ,
                        4
                    ]);
                    if (!objc.respondsTo(value, 'description')) return [
                        2
                    ];
                    return [
                        4,
                        objc.invokeAsync(value, 'description', [])
                    ];
                case 2:
                    return [
                        2,
                        stringValue.apply(void 0, [
                            _state.sent()
                        ])
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    return [
                        2
                    ];
            }
        });
    })();
}
function readMessageId(cell, objc) {
    return _async_to_generator(function() {
        var viewModel, _ref, message, id;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        2,
                        ,
                        3
                    ]);
                    viewModel = objc.getIvar(cell, 'viewModel');
                    if (!viewModel || !objc.respondsTo(viewModel, 'message')) return [
                        2
                    ];
                    return [
                        4,
                        objc.batch([
                            {
                                target: viewModel,
                                selector: 'message',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'id',
                                args: []
                            }
                        ])
                    ];
                case 1:
                    _ref = _sliced_to_array.apply(void 0, [
                        _state.sent(),
                        2
                    ]), message = _ref[0], id = _ref[1];
                    if (!message) return [
                        2
                    ];
                    return [
                        2,
                        nativeString(id, objc)
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}
function cellKey(cell, objc) {
    try {
        var _objc_className;
        var hash = objc.call(cell, 'hash');
        var identity;
        if (typeof hash === 'number' || (typeof hash === "undefined" ? "undefined" : _type_of(hash)) === 'bigint' || typeof hash === 'string') {
            identity = String(hash);
        } else if (objc.respondsTo(cell, 'description')) {
            var description = objc.call(cell, 'description');
            if (typeof description === 'string' && description) identity = description;
        }
        if (identity !== undefined) return "".concat((_objc_className = objc.className(cell)) !== null && _objc_className !== void 0 ? _objc_className : MESSAGE_CELL, ":").concat(identity);
    } catch (unused) {
        return;
    }
}
function handles(value, objc) {
    if (Array.isArray(value)) return value;
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== 'object') return [];
    try {
        return objc.array(value);
    } catch (unused) {
        return [];
    }
}
function findVisibleCells(objc) {
    return _async_to_generator(function() {
        var UIApplication, _ref, windowList, keyWindow, windows, cells, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, window, _cells, found, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    UIApplication = objc.getClass('UIApplication');
                    if (!UIApplication) return [
                        2,
                        []
                    ];
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        13,
                        ,
                        14
                    ]);
                    return [
                        4,
                        objc.batch([
                            {
                                target: UIApplication,
                                selector: 'sharedApplication',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'windows',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'keyWindow',
                                args: []
                            }
                        ])
                    ];
                case 2:
                    _ref = _sliced_to_array.apply(void 0, [
                        _state.sent(),
                        3
                    ]), windowList = _ref[1], keyWindow = _ref[2];
                    windows = handles(windowList, objc);
                    if (keyWindow) windows.push(keyWindow);
                    cells = [];
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        10,
                        11,
                        12
                    ]);
                    _iterator = windows[Symbol.iterator]();
                    _state.label = 4;
                case 4:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        9
                    ];
                    window = _step.value;
                    _state.label = 5;
                case 5:
                    _state.trys.push([
                        5,
                        7,
                        ,
                        8
                    ]);
                    return [
                        4,
                        objc.findViews(window, MESSAGE_CELL, {
                            maxDepth: 64,
                            maxVisited: 4096,
                            maxResults: 256,
                            attachedOnly: true,
                            stopAtMatch: true
                        })
                    ];
                case 6:
                    found = _state.sent();
                    (_cells = cells).push.apply(_cells, _to_consumable_array(found));
                    return [
                        3,
                        8
                    ];
                case 7:
                    _state.sent();
                    return [
                        3,
                        8
                    ];
                case 8:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        4
                    ];
                case 9:
                    return [
                        3,
                        12
                    ];
                case 10:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        12
                    ];
                case 11:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 12:
                    return [
                        2,
                        cells
                    ];
                case 13:
                    _state.sent();
                    return [
                        2,
                        []
                    ];
                case 14:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Paints selected messages with the same translucent cell background Discord's own
 * long-press uses. Visible cells are remembered as they appear, so a selection change only repaints
 * those rows instead of rescanning the whole native tree.
 * @param context The plugin context, which carries the native bridge.
 * @returns A cleanup that removes the hooks and clears the painted cells.
 */ function startNativeHighlight(context) {
    var _context_native;
    var objc = context === null || context === void 0 ? void 0 : (_context_native = context.native) === null || _context_native === void 0 ? void 0 : _context_native.objc;
    if (!objc) return;
    var cells = new Map();
    var state = new Map();
    var hooks = [];
    var highlight;
    var clear;
    var disposed = false;
    var lastScanAt = 0;
    var touchStartedAt = 0;
    var touchCellKey;
    var touchMoved = false;
    try {
        var UIColor = objc.getClass('UIColor');
        if (!UIColor) return;
        // A translucent gray that reads as a highlight on both dark and light themes.
        highlight = objc.call(UIColor, 'colorWithWhite:alpha:', 0.5, 0.18);
        clear = objc.call(UIColor, 'clearColor');
    } catch (error) {
        logger.warn('Could not create the highlight colors:', error);
        return;
    }
    function remember(cell) {
        var key = cellKey(cell, objc);
        if (key !== undefined) cells.set(key, cell);
        return key;
    }
    function forget(cell) {
        var key = cellKey(cell, objc);
        if (key !== undefined) {
            cells.delete(key);
            state.delete(key);
        }
        return key;
    }
    function paint(cell) {
        return _async_to_generator(function() {
            var key, cached, messageId, selected;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (disposed || !highlight || !clear) return [
                            2
                        ];
                        key = remember(cell);
                        if (key === undefined) return [
                            2
                        ];
                        cached = state.get(key);
                        if (!!cached) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            readMessageId(cell, objc)
                        ];
                    case 1:
                        messageId = _state.sent();
                        // A cell can be mid-reuse; don't remember a failed read forever.
                        if (messageId === undefined) {
                            state.delete(key);
                            return [
                                2
                            ];
                        }
                        cached = {
                            messageId: messageId
                        };
                        state.set(key, cached);
                        _state.label = 2;
                    case 2:
                        selected = isSelected(cached.messageId);
                        if (!selected) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            objc.invokeAsync(cell, 'setBackgroundColor:', [
                                highlight
                            ])
                        ];
                    case 3:
                        _state.sent();
                        cached.applied = true;
                        return [
                            3,
                            6
                        ];
                    case 4:
                        if (!cached.applied) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            objc.invokeAsync(cell, 'setBackgroundColor:', [
                                clear
                            ])
                        ];
                    case 5:
                        _state.sent();
                        cached.applied = false;
                        _state.label = 6;
                    case 6:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    /**
	 * @description Repaints the rows already known to the plugin. The first call in a session walks
	 * the native tree once to seed that list; every later selection change is a short loop.
	 */ function hasSelectedCell() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = cells[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _sliced_to_array(_step.value, 1), key = _step_value[0];
                var cached = state.get(key);
                if ((cached === null || cached === void 0 ? void 0 : cached.messageId) && isSelected(cached.messageId)) return true;
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return false;
    }
    function seed() {
        return _async_to_generator(function() {
            var now, found, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        now = Date.now();
                        // A scan walks the native tree, so keep it off the hot path and retry at most once a second.
                        if (now - lastScanAt < 800) return [
                            2
                        ];
                        lastScanAt = now;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            3,
                            ,
                            4
                        ]);
                        return [
                            4,
                            findVisibleCells(objc)
                        ];
                    case 2:
                        found = _state.sent();
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = found[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                cell = _step.value;
                                remember(cell);
                            }
                        } catch (err) {
                            _didIteratorError = true;
                            _iteratorError = err;
                        } finally{
                            try {
                                if (!_iteratorNormalCompletion && _iterator.return != null) {
                                    _iterator.return();
                                }
                            } finally{
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                        }
                        return [
                            3,
                            4
                        ];
                    case 3:
                        _state.sent();
                        return [
                            3,
                            4
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function refresh() {
        return _async_to_generator(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell, err;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (disposed) return [
                            2
                        ];
                        if (!(!cells.size || count() > 0 && !hasSelectedCell())) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            seed()
                        ];
                    case 1:
                        _state.sent();
                        _state.label = 2;
                    case 2:
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            8,
                            9,
                            10
                        ]);
                        _iterator = cells.values()[Symbol.iterator]();
                        _state.label = 4;
                    case 4:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            7
                        ];
                        cell = _step.value;
                        return [
                            4,
                            paint(cell).catch(function() {
                                return undefined;
                            })
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        _iteratorNormalCompletion = true;
                        return [
                            3,
                            4
                        ];
                    case 7:
                        return [
                            3,
                            10
                        ];
                    case 8:
                        err = _state.sent();
                        _didIteratorError = true;
                        _iteratorError = err;
                        return [
                            3,
                            10
                        ];
                    case 9:
                        try {
                            if (!_iteratorNormalCompletion && _iterator.return != null) {
                                _iterator.return();
                            }
                        } finally{
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                        return [
                            7
                        ];
                    case 10:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function reset(cell) {
        forget(cell);
        if (clear) {
            void objc.invokeAsync(cell, 'setBackgroundColor:', [
                clear
            ]).catch(function() {
                return undefined;
            });
        }
    }
    function handleNativeTap(cell) {
        return _async_to_generator(function() {
            var _SelectedChannelStore_getChannelId, channelId, messageId, message, result;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        channelId = SelectedChannelStore === null || SelectedChannelStore === void 0 ? void 0 : (_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId) === null || _SelectedChannelStore_getChannelId === void 0 ? void 0 : _SelectedChannelStore_getChannelId.call(SelectedChannelStore);
                        return [
                            4,
                            readMessageId(cell, objc)
                        ];
                    case 1:
                        messageId = _state.sent();
                        if (!channelId || !messageId) return [
                            2
                        ];
                        message = messageFromEvent({
                            messageId: messageId,
                            channelId: channelId
                        });
                        if (!message) return [
                            2
                        ];
                        markSkippedTap(messageId);
                        result = handleMessageTap(message);
                        if (result.kind === 'blocked') {
                            showSelectionWarning('Cannot delete this message', "It isn't yours and you don't have Manage Messages in this channel.");
                            return [
                                2
                            ];
                        }
                        if (result.kind === 'range') {
                            if (result.wrongChannel) {
                                showSelectionWarning('Range selection', 'Pick the last message in the same channel.');
                            } else if (result.skipped > 0) {
                                showSelectionWarning('Range selection', "Skipped ".concat(result.skipped, " message").concat(result.skipped === 1 ? '' : 's', " you can't delete."));
                            }
                        }
                        refreshSelectionToast();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    try {
        var options = {
            coalesce: 'receiver',
            payload: {
                receiver: true,
                arguments: []
            }
        };
        hooks.push(objc.hook(MESSAGE_CELL, 'didMoveToWindow', {
            after: function after(param) {
                var self = param.self;
                if (self) {
                    remember(self);
                    void paint(self).catch(function() {
                        return undefined;
                    });
                }
            }
        }, options), objc.hook(MESSAGE_CELL, 'layoutSubviews', {
            after: function after(param) {
                var self = param.self;
                if (self) void paint(self).catch(function() {
                    return undefined;
                });
            }
        }, options), objc.hook(MESSAGE_CELL, 'prepareForReuse', {
            after: function after(param) {
                var self = param.self;
                if (self) reset(self);
            }
        }), objc.hook(MESSAGE_CELL, 'touchesBegan:withEvent:', {
            after: function after(param) {
                var self = param.self;
                if (!self || !isSelecting()) return;
                touchStartedAt = Date.now();
                touchCellKey = cellKey(self, objc);
                touchMoved = false;
            }
        }, options), objc.hook(MESSAGE_CELL, 'touchesMoved:withEvent:', {
            after: function after() {
                if (isSelecting()) touchMoved = true;
            }
        }, options), objc.hook(MESSAGE_CELL, 'touchesCancelled:withEvent:', {
            after: function after() {
                touchMoved = true;
            }
        }, options), objc.hook(MESSAGE_CELL, 'touchesEnded:withEvent:', {
            after: function after(param) {
                var self = param.self;
                if (!self || !isSelecting() || touchMoved) return;
                if (Date.now() - touchStartedAt > 350) return;
                if (cellKey(self, objc) !== touchCellKey) return;
                touchCellKey = undefined;
                void handleNativeTap(self).catch(function() {
                    return undefined;
                });
            }
        }, options));
    } catch (error) {
        logger.warn('Could not hook iOS message cells:', error);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = hooks.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var hook = _step.value;
                try {
                    hook.remove();
                } catch (unused) {
                // The scope may have removed it already.
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return;
    }
    var unsubscribe = subscribe(function() {
        void refresh();
        // A sheet closing or the list relayouting can reset cell backgrounds after the first paint.
        setTimeout(function() {
            return void refresh();
        }, 150);
        setTimeout(function() {
            return void refresh();
        }, 600);
        setTimeout(function() {
            return void refresh();
        }, 1400);
    });
    // Seed the cell list once in the background, so the first tap is already fast.
    void refresh();
    return function() {
        disposed = true;
        unsubscribe();
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = hooks.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var hook = _step.value;
                try {
                    hook.remove();
                } catch (unused) {
                // Already removed with the plugin scope.
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        void function() {
            return _async_to_generator(function() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell, err;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                6,
                                7,
                                8
                            ]);
                            _iterator = cells.values()[Symbol.iterator]();
                            _state.label = 2;
                        case 2:
                            if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                3,
                                5
                            ];
                            cell = _step.value;
                            if (!clear) return [
                                3,
                                4
                            ];
                            return [
                                4,
                                objc.invokeAsync(cell, 'setBackgroundColor:', [
                                    clear
                                ]).catch(function() {
                                    return undefined;
                                })
                            ];
                        case 3:
                            _state.sent();
                            _state.label = 4;
                        case 4:
                            _iteratorNormalCompletion = true;
                            return [
                                3,
                                2
                            ];
                        case 5:
                            return [
                                3,
                                8
                            ];
                        case 6:
                            err = _state.sent();
                            _didIteratorError = true;
                            _iteratorError = err;
                            return [
                                3,
                                8
                            ];
                        case 7:
                            try {
                                if (!_iteratorNormalCompletion && _iterator.return != null) {
                                    _iterator.return();
                                }
                            } finally{
                                if (_didIteratorError) {
                                    throw _iteratorError;
                                }
                            }
                            return [
                                7
                            ];
                        case 8:
                            cells.clear();
                            state.clear();
                            return [
                                2
                            ];
                    }
                });
            })();
        }();
    };
}function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
/**
 * @description While selection mode is on, a single tap on a message toggles it and Discord's
 * own tap handling is skipped. Outside the mode the original handler runs unchanged.
 * @returns A function that removes the patch.
 */ function startMessageTaps() {
    return api.patcher.before(Chat, 'default', function(param) {
        var args = param.args;
        var props = args[0];
        var original = props === null || props === void 0 ? void 0 : props.onTapMessage;
        if (!props || typeof original !== 'function') return;
        var onTapMessage = function onTapMessage(event) {
            var _ref, _ref1, _ref2;
            if (!isSelecting()) return original(event);
            var payload = event;
            var native = payload === null || payload === void 0 ? void 0 : payload.nativeEvent;
            var id = (_ref = (_ref1 = (_ref2 = payload === null || payload === void 0 ? void 0 : payload.messageId) !== null && _ref2 !== void 0 ? _ref2 : payload === null || payload === void 0 ? void 0 : payload.id) !== null && _ref1 !== void 0 ? _ref1 : native === null || native === void 0 ? void 0 : native.messageId) !== null && _ref !== void 0 ? _ref : native === null || native === void 0 ? void 0 : native.id;
            // The native touch hook already handled this tap on touch-up.
            if (id !== undefined && consumeSkippedTap(String(id))) return;
            var message = messageFromEvent(event);
            if (!message) return;
            var result = handleMessageTap(message);
            if (result.kind === 'blocked') {
                showSelectionWarning('Cannot delete this message', "It isn't yours and you don't have Manage Messages in this channel.");
                return;
            }
            if (result.kind === 'range') {
                if (result.wrongChannel) {
                    showSelectionWarning('Range selection', 'Pick the last message in the same channel.');
                } else if (result.skipped > 0) {
                    showSelectionWarning('Range selection', "Skipped ".concat(result.skipped, " message").concat(result.skipped === 1 ? '' : 's', " you can't delete."));
                }
            }
            refreshSelectionToast();
        };
        return [
            _object_spread_props(_object_spread({}, props), {
                onTapMessage: onTapMessage
            })
        ];
    });
}var stopMessageSheet;
var stopMessageTaps;
var stopNativeHighlight;
var stopChannelWatch;
function onChannelSelect() {
    exitSelection();
}
/**
 * @description Starts the multi-select features and clears the selection when the open channel
 * changes, so a deletion cannot target messages the user is no longer looking at.
 * @param context The plugin context, which carries the native bridge for the row highlight.
 */ function startMultiSelect(context) {
    stopMessageSheet = startMessageSheet();
    stopMessageTaps = startMessageTaps();
    stopNativeHighlight = startNativeHighlight(context);
    setDeleteSelectedAction(function() {
        void confirmAndDelete();
    });
    try {
        var _globalThis_unbound, _flux_onAction;
        var flux = (_globalThis_unbound = globalThis.unbound) === null || _globalThis_unbound === void 0 ? void 0 : _globalThis_unbound.flux;
        var remove = flux === null || flux === void 0 ? void 0 : (_flux_onAction = flux.onAction) === null || _flux_onAction === void 0 ? void 0 : _flux_onAction.call(flux, 'CHANNEL_SELECT', onChannelSelect);
        if (typeof remove === 'function') {
            stopChannelWatch = remove;
        }
    } catch (error) {
        logger.warn('Could not watch channel changes:', error);
    }
    // A channel may already be open when the plugin turns on.
    refreshSelectionToast();
}
function stopMultiSelect() {
    stopMessageSheet === null || stopMessageSheet === void 0 ? void 0 : stopMessageSheet();
    stopMessageTaps === null || stopMessageTaps === void 0 ? void 0 : stopMessageTaps();
    stopNativeHighlight === null || stopNativeHighlight === void 0 ? void 0 : stopNativeHighlight();
    stopMessageSheet = undefined;
    stopMessageTaps = undefined;
    stopNativeHighlight = undefined;
    try {
        stopChannelWatch === null || stopChannelWatch === void 0 ? void 0 : stopChannelWatch();
    } catch (unused) {
    // The dispatcher may be gone while Discord shuts down.
    }
    stopChannelWatch = undefined;
    setDeleteSelectedAction(undefined);
    exitSelection();
}function start(context) {
    startMultiSelect(context);
}
function stop() {
    stopMultiSelect();
}exports.start=start;exports.stop=stop;return exports;})({},window.unbound,React);