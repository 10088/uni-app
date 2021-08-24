'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var debug = _interopDefault(require('debug'));
var isRelative = _interopDefault(require('licia/isRelative'));
var WebSocket = _interopDefault(require('ws'));
var events = require('events');
var uuid = _interopDefault(require('licia/uuid'));
var stringify = _interopDefault(require('licia/stringify'));
var dateFormat = _interopDefault(require('licia/dateFormat'));
var waitUntil = _interopDefault(require('licia/waitUntil'));
var fs$1 = _interopDefault(require('licia/fs'));
var isFn = _interopDefault(require('licia/isFn'));
var trim = _interopDefault(require('licia/trim'));
var isStr = _interopDefault(require('licia/isStr'));
var startWith = _interopDefault(require('licia/startWith'));
var isNum = _interopDefault(require('licia/isNum'));
var sleep$1 = _interopDefault(require('licia/sleep'));
var isUndef = _interopDefault(require('licia/isUndef'));
var address = _interopDefault(require('address'));
var defaultGateway = _interopDefault(require('default-gateway'));
var getPort = _interopDefault(require('licia/getPort'));
var child_process = require('child_process');
var toStr = _interopDefault(require('licia/toStr'));

class Transport extends events.EventEmitter {
    constructor(ws) {
        super();
        this.ws = ws;
        this.ws.addEventListener("message", (event) => {
            this.emit("message", event.data);
        });
        this.ws.addEventListener("close", () => {
            this.emit("close");
        });
    }
    send(message) {
        this.ws.send(message);
    }
    close() {
        this.ws.close();
    }
}

const CLOSE_ERR_TIP = "Connection closed";
class Connection extends events.EventEmitter {
    constructor(transport, puppet, namespace) {
        super();
        this.puppet = puppet;
        this.namespace = namespace;
        this.callbacks = new Map();
        this.transport = transport;
        this.debug = debug("automator:protocol:" + this.namespace);
        this.onMessage = (msg) => {
            this.debug(`${dateFormat("yyyy-mm-dd HH:MM:ss:l")} ◀ RECV ${msg}`);
            const { id, method, error, result, params } = JSON.parse(msg);
            if (!id) {
                return this.puppet.emit(method, params);
            }
            const { callbacks } = this;
            if (id && callbacks.has(id)) {
                const promise = callbacks.get(id);
                callbacks.delete(id);
                error ? promise.reject(Error(error.message)) : promise.resolve(result);
            }
        };
        this.onClose = () => {
            this.callbacks.forEach((promise) => {
                promise.reject(Error(CLOSE_ERR_TIP));
            });
        };
        this.transport.on("message", this.onMessage);
        this.transport.on("close", this.onClose);
    }
    send(method, params = {}, reflect = true) {
        if (reflect && this.puppet.adapter.has(method)) {
            return this.puppet.adapter.send(this, method, params);
        }
        const id = uuid();
        const data = stringify({
            id,
            method,
            params,
        });
        this.debug(`${dateFormat("yyyy-mm-dd HH:MM:ss:l")} SEND ► ${data}`);
        return new Promise((resolve, reject) => {
            try {
                this.transport.send(data);
            }
            catch (e) {
                reject(Error(CLOSE_ERR_TIP));
            }
            this.callbacks.set(id, {
                resolve,
                reject,
            });
        });
    }
    dispose() {
        this.transport.close();
    }
    static createDevtoolConnection(url, puppet) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.addEventListener("open", () => {
                resolve(new Connection(new Transport(ws), puppet, "devtool"));
            });
            ws.addEventListener("error", reject);
        });
    }
    static createRuntimeConnection(port, puppet, timeout) {
        return new Promise((resolve, reject) => {
            debug("automator:runtime")(`${dateFormat("yyyy-mm-dd HH:MM:ss:l")} port=${port}`);
            const wss = new WebSocket.Server({
                port,
            });
            waitUntil(async () => {
                if (puppet.runtimeConnection) {
                    return true;
                }
            }, timeout, 1e3).catch(() => {
                wss.close();
                reject("Failed to connect to runtime, please make sure the project is running");
            });
            wss.on("connection", function connection(ws) {
                debug("automator:runtime")(`${dateFormat("yyyy-mm-dd HH:MM:ss:l")} connected`);
                const connection = new Connection(new Transport(ws), puppet, "runtime");
                // 可能会被重新连接，刷新成最新的
                puppet.setRuntimeConnection(connection);
                resolve(connection);
            });
            puppet.setRuntimeServer(wss);
        });
    }
}

const qrCodeTerminal = require("qrcode-terminal");
const QrCodeReader = require("qrcode-reader");
const isWin = /^win/.test(process.platform);
function printQrCode(content) {
    return new Promise((resolve) => {
        qrCodeTerminal.generate(content, {
            small: true,
        }, (qrcode) => {
            process.stdout.write(qrcode);
            resolve();
        });
    });
}
function toArray(str) {
    if (isStr(str)) {
        return [true, [str]];
    }
    return [false, str];
}
async function invokeManyToMany(fn, str) {
    const [isSingle, strArr] = toArray(str);
    const result = await fn(strArr);
    return isSingle ? result[0] : result;
}
async function resolvePort(port, defaultPort) {
    const newPort = await getPort(port || defaultPort);
    if (port && newPort !== port) {
        throw Error(`Port ${port} is in use, please specify another port`);
    }
    return newPort;
}
function getWsEndpoint(port) {
    let host;
    try {
        // This can only return an IPv4 address
        const result = defaultGateway.v4.sync();
        host = address.ip(result && result.interface);
        if (host) {
            // Check if the address is a private ip
            // https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
            if (!/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(host)) {
                // Address is not private, so we will discard it
                host = undefined;
            }
        }
    }
    catch (_e) {
        // ignored
    }
    return "ws://" + (host || "localhost") + ":" + port;
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

var TYPES;
(function (TYPES) {
    TYPES["RUNTIME"] = "runtime";
    TYPES["DEVTOOL"] = "devtool";
})(TYPES || (TYPES = {}));
function wrapper(type, descriptor) {
    const method = descriptor.value;
    descriptor.value = async function (params) {
        const fn = await (method === null || method === void 0 ? void 0 : method.call(this, params));
        return fn(type);
    };
    return descriptor;
}
function runtime(target, propertyName, descriptor) {
    return wrapper(TYPES.RUNTIME, descriptor);
}
function devtool(target, propertyName, descriptor) {
    return wrapper(TYPES.DEVTOOL, descriptor);
}
class Base {
    constructor(puppet) {
        this.puppet = puppet;
    }
    invoke(method, params) {
        return async (type) => {
            if (!this.puppet.devtoolConnection) {
                return this.puppet.runtimeConnection.send(method, params);
            }
            return (type === TYPES.DEVTOOL
                ? this.puppet.devtoolConnection
                : this.puppet.runtimeConnection).send(method, params);
        };
    }
    on(method, listener) {
        this.puppet.on(method, listener);
    }
}

class Element extends Base {
    constructor(puppet, options) {
        super(puppet);
        this.id = options.elementId;
        this.pageId = options.pageId;
        this.nodeId = options.nodeId;
        this.videoId = options.videoId;
    }
    async getData(params) {
        return this.invokeMethod("Element.getData", params);
    }
    async setData(params) {
        return this.invokeMethod("Element.setData", params);
    }
    async callMethod(params) {
        return this.invokeMethod("Element.callMethod", params);
    }
    async getElement(params) {
        return this.invokeMethod("Element.getElement", params);
    }
    async getElements(params) {
        return this.invokeMethod("Element.getElements", params);
    }
    async getOffset() {
        return this.invokeMethod("Element.getOffset");
    }
    async getHTML(params) {
        return this.invokeMethod("Element.getHTML", params);
    }
    async getAttributes(params) {
        return this.invokeMethod("Element.getAttributes", params);
    }
    async getStyles(params) {
        return this.invokeMethod("Element.getStyles", params);
    }
    async getDOMProperties(params) {
        return this.invokeMethod("Element.getDOMProperties", params);
    }
    async getProperties(params) {
        return this.invokeMethod("Element.getProperties", params);
    }
    async tap() {
        return this.invokeMethod("Element.tap");
    }
    async longpress() {
        return this.invokeMethod("Element.longpress");
    }
    async touchstart(params) {
        return this.invokeMethod("Element.touchstart", params);
    }
    async touchmove(params) {
        return this.invokeMethod("Element.touchmove", params);
    }
    async touchend(params) {
        return this.invokeMethod("Element.touchend", params);
    }
    async triggerEvent(params) {
        return this.invokeMethod("Element.triggerEvent", params);
    }
    async callFunction(params) {
        return this.invokeMethod("Element.callFunction", params);
    }
    async callContextMethod(params) {
        return this.invokeMethod("Element.callContextMethod", params);
    }
    invokeMethod(method, params = {}) {
        params.elementId = this.id;
        params.pageId = this.pageId;
        this.nodeId && (params.nodeId = this.nodeId);
        this.videoId && (params.videoId = this.videoId);
        return this.invoke(method, params);
    }
}
__decorate([
    runtime
], Element.prototype, "getData", null);
__decorate([
    runtime
], Element.prototype, "setData", null);
__decorate([
    runtime
], Element.prototype, "callMethod", null);
__decorate([
    devtool
], Element.prototype, "getElement", null);
__decorate([
    devtool
], Element.prototype, "getElements", null);
__decorate([
    devtool
], Element.prototype, "getOffset", null);
__decorate([
    devtool
], Element.prototype, "getHTML", null);
__decorate([
    devtool
], Element.prototype, "getAttributes", null);
__decorate([
    devtool
], Element.prototype, "getStyles", null);
__decorate([
    devtool
], Element.prototype, "getDOMProperties", null);
__decorate([
    devtool
], Element.prototype, "getProperties", null);
__decorate([
    devtool
], Element.prototype, "tap", null);
__decorate([
    devtool
], Element.prototype, "longpress", null);
__decorate([
    devtool
], Element.prototype, "touchstart", null);
__decorate([
    devtool
], Element.prototype, "touchmove", null);
__decorate([
    devtool
], Element.prototype, "touchend", null);
__decorate([
    devtool
], Element.prototype, "triggerEvent", null);
__decorate([
    devtool
], Element.prototype, "callFunction", null);
__decorate([
    devtool
], Element.prototype, "callContextMethod", null);

const util = require("util");
class Element$1 {
    constructor(puppet, options, elementMap) {
        this.puppet = puppet;
        this.id = options.elementId;
        this.pageId = options.pageId;
        this.nodeId = options.nodeId || null;
        this.videoId = options.videoId || null;
        this.tagName = options.tagName;
        this.nvue = options.nvue;
        this.elementMap = elementMap;
        // 统一格式化为 page
        if (this.tagName === "body" || this.tagName === "page-body") {
            this.tagName = "page";
        }
        this.api = new Element(puppet, options);
    }
    toJSON() {
        return JSON.stringify({
            id: this.id,
            tagName: this.tagName,
            pageId: this.pageId,
            nodeId: this.nodeId,
            videoId: this.videoId,
        });
    }
    toString() {
        return this.toJSON();
    }
    [util.inspect.custom]() {
        return this.toJSON();
    }
    async $(selector) {
        try {
            const element = await this.api.getElement({ selector });
            return Element$1.create(this.puppet, Object.assign({}, element, {
                pageId: this.pageId,
            }), this.elementMap);
        }
        catch (e) {
            return null;
        }
    }
    async $$(selector) {
        const { elements } = await this.api.getElements({ selector });
        return elements.map((elem) => Element$1.create(this.puppet, Object.assign({}, elem, {
            pageId: this.pageId,
        }), this.elementMap));
    }
    async size() {
        const [width, height] = await this.domProperty([
            "offsetWidth",
            "offsetHeight",
        ]);
        return {
            width,
            height,
        };
    }
    async offset() {
        const { left, top } = await this.api.getOffset();
        return {
            left,
            top,
        };
    }
    async text() {
        return this.domProperty("innerText");
    }
    async attribute(name) {
        if (!isStr(name)) {
            throw Error("name must be a string");
        }
        return (await this.api.getAttributes({ names: [name] })).attributes[0];
    }
    async value() {
        return this.property("value");
    }
    async property(name) {
        if (!isStr(name)) {
            throw Error("name must be a string");
        }
        if (this.puppet.checkProperty) {
            let props = this.publicProps;
            if (!props) {
                this.publicProps = props = await this._property("__propPublic");
            }
            if (!props[name]) {
                throw Error(`${this.tagName}.${name} not exists`);
            }
        }
        return this._property(name);
    }
    async html() {
        return (await this.api.getHTML({ type: "inner" })).html;
    }
    async outerHtml() {
        return (await this.api.getHTML({ type: "outer" })).html;
    }
    async style(name) {
        if (!isStr(name)) {
            throw Error("name must be a string");
        }
        return (await this.api.getStyles({ names: [name] })).styles[0];
    }
    async tap() {
        return this.api.tap();
    }
    async longpress() {
        if (this.nvue) {
            return this.api.longpress();
        }
        await this.touchstart();
        await sleep$1(350);
        return this.touchend();
    }
    async trigger(type, detail) {
        const event = {
            type,
        };
        if (!isUndef(detail)) {
            event.detail = detail;
        }
        return this.api.triggerEvent(event);
    }
    async touchstart(options) {
        return this.api.touchstart(options);
    }
    async touchmove(options) {
        return this.api.touchmove(options);
    }
    async touchend(options) {
        return this.api.touchend(options);
    }
    async domProperty(name) {
        return invokeManyToMany(async (names) => (await this.api.getDOMProperties({ names })).properties, name);
    }
    _property(name) {
        return invokeManyToMany(async (names) => (await this.api.getProperties({ names })).properties, name);
    }
    send(method, params) {
        params.elementId = this.id;
        params.pageId = this.pageId;
        this.nodeId && (params.nodeId = this.nodeId);
        this.videoId && (params.videoId = this.videoId);
        return this.puppet.send(method, params);
    }
    async callFunction(functionName, ...args) {
        return (await this.api.callFunction({
            functionName,
            args,
        })).result;
    }
    static create(puppet, options, elementMap) {
        let element = elementMap.get(options.elementId);
        if (element) {
            return element;
        }
        let ElementClass;
        if (options.nodeId) {
            ElementClass = CustomElement;
        }
        else {
            switch (options.tagName) {
                case "input":
                    ElementClass = InputElement;
                    break;
                case "textarea":
                    ElementClass = TextareaElement;
                    break;
                case "scroll-view":
                    ElementClass = ScrollViewElement;
                    break;
                case "swiper":
                    ElementClass = SwiperElement;
                    break;
                case "movable-view":
                    ElementClass = MovableViewElement;
                    break;
                case "switch":
                    ElementClass = SwitchElement;
                    break;
                case "slider":
                    ElementClass = SliderElement;
                    break;
                case "video":
                    ElementClass = ContextElement;
                    break;
                default:
                    ElementClass = Element$1;
            }
        }
        element = new ElementClass(puppet, options, elementMap);
        elementMap.set(options.elementId, element);
        return element;
    }
}
class CustomElement extends Element$1 {
    async setData(data) {
        return this.api.setData({ data });
    }
    async data(path) {
        const data = {};
        if (path) {
            data.path = path;
        }
        return (await this.api.getData(data)).data;
    }
    async callMethod(method, ...args) {
        return (await this.api.callMethod({
            method,
            args,
        })).result;
    }
}
class InputElement extends Element$1 {
    async input(value) {
        return this.callFunction("input.input", value);
    }
}
class TextareaElement extends Element$1 {
    async input(value) {
        return this.callFunction("textarea.input", value);
    }
}
class ScrollViewElement extends Element$1 {
    async scrollTo(x, y) {
        return this.callFunction("scroll-view.scrollTo", x, y);
    }
    async property(name) {
        if (name === "scrollTop") {
            return this.callFunction("scroll-view.scrollTop");
        }
        else if (name === "scrollLeft") {
            return this.callFunction("scroll-view.scrollLeft");
        }
        return super.property(name);
    }
    async scrollWidth() {
        return this.callFunction("scroll-view.scrollWidth");
    }
    async scrollHeight() {
        return this.callFunction("scroll-view.scrollHeight");
    }
}
class SwiperElement extends Element$1 {
    async swipeTo(index) {
        return this.callFunction("swiper.swipeTo", index);
    }
}
class MovableViewElement extends Element$1 {
    async moveTo(x, y) {
        return this.callFunction("movable-view.moveTo", x, y);
    }
    async property(name) {
        if (name === "x") {
            return this._property("_translateX");
        }
        else if (name === "y") {
            return this._property("_translateY");
        }
        return super.property(name);
    }
}
class SwitchElement extends Element$1 {
    async tap() {
        return this.callFunction("switch.tap");
    }
}
class SliderElement extends Element$1 {
    async slideTo(value) {
        return this.callFunction("slider.slideTo", value);
    }
}
class ContextElement extends Element$1 {
    async callContextMethod(method, ...args) {
        const result = await this.api.callContextMethod({
            method,
            args,
        });
        return result;
    }
}

class Page extends Base {
    constructor(puppet, options) {
        super(puppet);
        this.id = options.id;
    }
    async getData(params) {
        return this.invokeMethod("Page.getData", params);
    }
    async setData(params) {
        return this.invokeMethod("Page.setData", params);
    }
    async callMethod(params) {
        return this.invokeMethod("Page.callMethod", params);
    }
    async getElement(params) {
        return this.invokeMethod("Page.getElement", params);
    }
    async getElements(params) {
        return this.invokeMethod("Page.getElements", params);
    }
    async getWindowProperties(params) {
        return this.invokeMethod("Page.getWindowProperties", params);
    }
    invokeMethod(method, params = {}) {
        params.pageId = this.id;
        return this.invoke(method, params);
    }
}
__decorate([
    runtime
], Page.prototype, "getData", null);
__decorate([
    runtime
], Page.prototype, "setData", null);
__decorate([
    runtime
], Page.prototype, "callMethod", null);
__decorate([
    devtool
], Page.prototype, "getElement", null);
__decorate([
    devtool
], Page.prototype, "getElements", null);
__decorate([
    devtool
], Page.prototype, "getWindowProperties", null);

const util$1 = require("util");
class Page$1 {
    constructor(puppet, options) {
        this.puppet = puppet;
        this.id = options.id;
        this.path = options.path;
        this.query = options.query;
        this.elementMap = new Map();
        this.api = new Page(puppet, options);
    }
    toJSON() {
        return JSON.stringify({ id: this.id, path: this.path, query: this.query });
    }
    toString() {
        return this.toJSON();
    }
    [util$1.inspect.custom]() {
        return this.toJSON();
    }
    async waitFor(condition) {
        if (isNum(condition)) {
            return await sleep$1(condition);
        }
        else if (isFn(condition)) {
            return waitUntil(condition);
        }
        else if (isStr(condition)) {
            return waitUntil(async () => {
                const elms = await this.$$(condition);
                return elms.length > 0;
            });
        }
    }
    async $(selector) {
        try {
            const page = await this.api.getElement({ selector });
            return Element$1.create(this.puppet, Object.assign({
                selector,
            }, page, {
                pageId: this.id,
            }), this.elementMap);
        }
        catch (t) {
            return null;
        }
    }
    async $$(selector) {
        const { elements } = await this.api.getElements({ selector });
        return elements.map((elem) => Element$1.create(this.puppet, Object.assign({
            selector,
        }, elem, {
            pageId: this.id,
        }), this.elementMap));
    }
    async data(path) {
        const payload = {};
        if (path) {
            payload.path = path;
        }
        return (await this.api.getData(payload)).data;
    }
    async setData(data) {
        return this.api.setData({ data });
    }
    async size() {
        const [width, height] = await this.windowProperty([
            "document.documentElement.scrollWidth",
            "document.documentElement.scrollHeight",
        ]);
        return {
            width,
            height,
        };
    }
    async callMethod(method, ...args) {
        return (await this.api.callMethod({
            method,
            args,
        })).result;
    }
    async scrollTop() {
        return this.windowProperty("document.documentElement.scrollTop");
    }
    async windowProperty(names) {
        const isSingle = isStr(names);
        if (isSingle) {
            names = [names];
        }
        const { properties } = await this.api.getWindowProperties({
            names: names,
        });
        return isSingle ? properties[0] : properties;
    }
    static create(puppet, options, pageMap) {
        let page = pageMap.get(options.id);
        if (page) {
            //update query (部分页面id被锁定，如tabBar页面)
            page.query = options.query;
            return page;
        }
        page = new Page$1(puppet, options);
        pageMap.set(options.id, page);
        return page;
    }
}

class App extends Base {
    async getPageStack() {
        return this.invoke("App.getPageStack");
    }
    async callUniMethod(params) {
        return this.invoke("App.callUniMethod", params);
    }
    async getCurrentPage() {
        return this.invoke("App.getCurrentPage");
    }
    async mockUniMethod(params) {
        return this.invoke("App.mockUniMethod", params);
    }
    async callFunction(params) {
        return this.invoke("App.callFunction", params);
    }
    async captureScreenshot(params) {
        return this.invoke("App.captureScreenshot", params);
    }
    async exit() {
        return this.invoke("App.exit");
    }
    async addBinding(params) {
        return this.invoke("App.addBinding", params);
    }
    async enableLog() {
        return this.invoke("App.enableLog");
    }
    onLogAdded(listener) {
        return this.on("App.logAdded", listener);
    }
    onBindingCalled(listener) {
        return this.on("App.bindingCalled", listener);
    }
    onExceptionThrown(listener) {
        return this.on("App.exceptionThrown", listener);
    }
}
__decorate([
    runtime
], App.prototype, "getPageStack", null);
__decorate([
    runtime
], App.prototype, "callUniMethod", null);
__decorate([
    runtime
], App.prototype, "getCurrentPage", null);
__decorate([
    runtime
], App.prototype, "mockUniMethod", null);
__decorate([
    devtool
], App.prototype, "callFunction", null);
__decorate([
    devtool
], App.prototype, "captureScreenshot", null);
__decorate([
    devtool
], App.prototype, "exit", null);
__decorate([
    devtool
], App.prototype, "addBinding", null);
__decorate([
    devtool
], App.prototype, "enableLog", null);

class Tool extends Base {
    async getInfo() {
        return this.invoke("Tool.getInfo");
    }
    async enableRemoteDebug(params) {
        return this.invoke("Tool.enableRemoteDebug");
    }
    async close() {
        return this.invoke("Tool.close");
    }
    async getTestAccounts() {
        return this.invoke("Tool.getTestAccounts");
    }
    onRemoteDebugConnected(listener) {
        this.puppet.once("Tool.onRemoteDebugConnected", listener);
        // mp-baidu
        this.puppet.once("Tool.onPreviewConnected", listener);
    }
}
__decorate([
    devtool
], Tool.prototype, "getInfo", null);
__decorate([
    devtool
], Tool.prototype, "enableRemoteDebug", null);
__decorate([
    devtool
], Tool.prototype, "close", null);
__decorate([
    devtool
], Tool.prototype, "getTestAccounts", null);

function sleep(timeout) {
    return new Promise((e) => setTimeout(e, timeout));
}
function isFnStr(str) {
    return (isStr(str) &&
        ((str = trim(str)), startWith(str, "function") || startWith(str, "() =>")));
}
class Program extends events.EventEmitter {
    constructor(puppet, options) {
        super();
        this.puppet = puppet;
        this.options = options;
        this.pageMap = new Map();
        this.appBindings = new Map();
        this.appApi = new App(puppet);
        this.toolApi = new Tool(puppet);
        this.appApi.onLogAdded((msg) => {
            this.emit("console", msg);
        });
        this.appApi.onBindingCalled(({ name, args }) => {
            try {
                const fn = this.appBindings.get(name);
                fn && fn(...args);
            }
            catch (t) { }
        });
        this.appApi.onExceptionThrown((error) => {
            this.emit("exception", error);
        });
    }
    async pageStack() {
        return (await this.appApi.getPageStack()).pageStack.map((page) => Page$1.create(this.puppet, page, this.pageMap));
    }
    async navigateTo(url) {
        return this.changeRoute("navigateTo", url);
    }
    async redirectTo(url) {
        return this.changeRoute("redirectTo", url);
    }
    async navigateBack() {
        return this.changeRoute("navigateBack");
    }
    async reLaunch(url) {
        return this.changeRoute("reLaunch", url);
    }
    async switchTab(url) {
        return this.changeRoute("switchTab", url);
    }
    async currentPage() {
        const { id, path, query } = await this.appApi.getCurrentPage();
        return Page$1.create(this.puppet, { id, path, query }, this.pageMap);
    }
    async systemInfo() {
        return this.callUniMethod("getSystemInfoSync");
    }
    async callUniMethod(method, ...args) {
        return (await this.appApi.callUniMethod({ method, args })).result;
    }
    async mockUniMethod(method, result, ...args) {
        if (isFn(result) || isFnStr(result)) {
            return this.appApi.mockUniMethod({
                method,
                functionDeclaration: result.toString(),
                args,
            });
        }
        return this.appApi.mockUniMethod({ method, result });
    }
    async restoreUniMethod(method) {
        return this.appApi.mockUniMethod({ method });
    }
    async evaluate(appFunction, // tslint:disable-line
    ...args) {
        return (await this.appApi.callFunction({
            functionDeclaration: appFunction.toString(),
            args,
        })).result;
    }
    async pageScrollTo(scrollTop) {
        await this.callUniMethod("pageScrollTo", {
            scrollTop,
            duration: 0,
        });
    }
    async close() {
        try {
            await this.appApi.exit();
        }
        catch (t) { }
        await sleep(1e3);
        this.puppet.disposeRuntimeServer();
        await this.toolApi.close();
        this.disconnect();
    }
    async teardown() {
        return this[this.options.teardown === "disconnect" ? "disconnect" : "close"]();
    }
    async remote(auto) {
        if (!this.puppet.devtools.remote) {
            return console.warn(`Failed to enable remote, ${this.puppet.devtools.name} is unimplemented`);
        }
        const { qrCode } = await this.toolApi.enableRemoteDebug({ auto });
        qrCode && (await printQrCode(qrCode));
        const connectedPromise = new Promise((resolve) => {
            this.toolApi.onRemoteDebugConnected(async () => {
                await sleep(1e3);
                resolve();
            });
        });
        const runtimePromise = new Promise((resolve) => {
            this.puppet.setRemoteRuntimeConnectionCallback(() => {
                resolve();
            });
        });
        return Promise.all([connectedPromise, runtimePromise]);
    }
    disconnect() {
        this.puppet.dispose();
    }
    on(event, listener) {
        if (event === "console") {
            this.appApi.enableLog();
        }
        super.on(event, listener);
        return this;
    }
    async exposeFunction(name, bindingFunction) {
        if (this.appBindings.has(name)) {
            throw Error(`Failed to expose function with name ${name}: already exists!`);
        }
        this.appBindings.set(name, bindingFunction);
        await this.appApi.addBinding({ name });
    }
    async checkVersion() { }
    async screenshot(options) {
        const { data } = await this.appApi.captureScreenshot({
            fullPage: options === null || options === void 0 ? void 0 : options.fullPage,
        });
        if (!(options === null || options === void 0 ? void 0 : options.path))
            return data;
        await fs$1.writeFile(options.path, data, "base64");
    }
    async testAccounts() {
        return (await this.toolApi.getTestAccounts()).accounts;
    }
    async changeRoute(method, url) {
        await this.callUniMethod(method, {
            url,
        });
        await sleep(3e3);
        return this.currentPage();
    }
}

class Adapter {
    constructor(options) {
        this.options = options;
    }
    has(method) {
        return !!this.options[method];
    }
    send(connection, method, params) {
        const option = this.options[method];
        if (!option) {
            return Promise.reject(Error(`adapter for ${method} not found`));
        }
        const reflect = option.reflect;
        if (!reflect) {
            return Promise.reject(Error(`${method}'s reflect is required`));
        }
        if (option.params) {
            params = option.params(params);
        }
        if (typeof reflect === "function") {
            return reflect(connection.send.bind(connection), params);
        }
        else {
            method = reflect;
        }
        return connection.send(method, params);
    }
}

const debugPuppet = debug("automator:puppet");
const AUTOMATOR_JSON_FILE = ".automator.json";
function tryRequire(path) {
    try {
        return require(path);
    }
    catch (e) { }
}
function resolveAutomatorJson(projectPath, platform, mode) {
    let json;
    let jsonPath;
    if (process.env.UNI_OUTPUT_DIR) {
        jsonPath = path.join(process.env.UNI_OUTPUT_DIR, `../.automator/${platform}`, AUTOMATOR_JSON_FILE);
        json = tryRequire(jsonPath);
    }
    else {
        jsonPath = path.join(projectPath, `dist/${mode}/.automator/${platform}`, AUTOMATOR_JSON_FILE);
        json = tryRequire(jsonPath);
        if (!json) {
            jsonPath = path.join(projectPath, `unpackage/dist/${mode}/.automator/${platform}`, AUTOMATOR_JSON_FILE);
            json = tryRequire(jsonPath);
        }
    }
    debugPuppet(`${jsonPath}=>${JSON.stringify(json)}`);
    return json;
}
function equalWsEndpoint(projectPath, port, platform, mode) {
    const json = resolveAutomatorJson(projectPath, platform, mode);
    if (!json || !json.wsEndpoint) {
        return false;
    }
    const version = require("../package.json").version;
    if (json.version !== version) {
        debugPuppet(`unmet=>${json.version}!==${version}`);
        return false;
    }
    const wsEndpoint = getWsEndpoint(port);
    debugPuppet(`wsEndpoint=>${wsEndpoint}`);
    return json.wsEndpoint === wsEndpoint;
}
class Puppet extends events.EventEmitter {
    constructor(platform, target) {
        super();
        if (target) {
            this.target = target;
        }
        else {
            this.target = require(`@dcloudio/uni-${platform === "app" ? "app-plus" : platform}/lib/uni.automator.js`);
        }
        if (!this.target) {
            throw Error("puppet is not provided");
        }
        this.platform = platform;
        this.adapter = new Adapter(this.target.adapter || {});
    }
    setCompiler(compiler) {
        this.compiler = compiler;
    }
    setRuntimeServer(wss) {
        this.wss = wss;
    }
    setRemoteRuntimeConnectionCallback(callback) {
        this.remoteRuntimeConnectionCallback = callback;
    }
    setRuntimeConnection(connection) {
        this.runtimeConnection = connection;
        if (this.remoteRuntimeConnectionCallback) {
            this.remoteRuntimeConnectionCallback();
            this.remoteRuntimeConnectionCallback = null;
        }
    }
    setDevtoolConnection(connection) {
        this.devtoolConnection = connection;
    }
    disposeRuntimeServer() {
        this.wss && this.wss.close();
    }
    disposeRuntime() {
        this.runtimeConnection.dispose();
    }
    disposeDevtool() {
        this.compiler && this.compiler.stop();
        this.devtoolConnection && this.devtoolConnection.dispose();
    }
    dispose() {
        this.disposeRuntime();
        this.disposeDevtool();
        this.disposeRuntimeServer();
    }
    send(method, params) {
        return this.runtimeConnection.send(method, params);
    }
    validateProject(projectPath) {
        const required = this.target.devtools.required;
        if (!required) {
            return true;
        }
        return !required.find((file) => !fs.existsSync(path.join(projectPath, file)));
    }
    validateDevtools(opions) {
        const validate = this.target.devtools.validate;
        if (validate) {
            return validate(opions, this);
        }
        return Promise.resolve(opions);
    }
    createDevtools(devtoolsProjectPath, options, timeout) {
        const create = this.target.devtools.create;
        if (create) {
            options.timeout = timeout;
            return create(devtoolsProjectPath, options, this);
        }
        return Promise.resolve();
    }
    shouldCompile(projectPath, port, options, devtoolsOptions) {
        this.compiled = true;
        const shouldCompile = this.target.shouldCompile;
        if (shouldCompile) {
            this.compiled = shouldCompile(options, devtoolsOptions);
        }
        else {
            if (options.compile === true) {
                this.compiled = true;
            }
            else {
                //自动检测
                this.compiled = !equalWsEndpoint(projectPath, port, this.platform, this.mode);
            }
        }
        return this.compiled;
    }
    get checkProperty() {
        return this.platform === "mp-weixin";
    }
    get devtools() {
        return this.target.devtools;
    }
    get mode() {
        const mode = this.target.mode;
        if (mode) {
            return mode;
        }
        return process.env.NODE_ENV === "production" ? "build" : "dev";
    }
}

const debugCompiler = debug("automator:compiler");
const SIGNAL_DONE = "DONE  Build complete";
const SIGNAL_DONE_H5 = "- Network";
const SIGNAL_DONE_VITE_H5 = "> Network";
const PATH_RE = /The\s+(.*)\s+directory is ready/;
class Compiler {
    constructor(puppet) {
        this.puppet = puppet;
        this.puppet.setCompiler(this);
    }
    compile(options) {
        const mode = this.puppet.mode;
        const platform = this.puppet.platform;
        let silent = options.silent;
        const autoPort = options.port;
        const autoHost = options.host;
        const npmScript = `${mode}:${platform}`;
        const projectPath = options.projectPath;
        const [command, cliArgs] = this.getSpawnArgs(options, npmScript);
        cliArgs.push("--auto-port");
        cliArgs.push(toStr(autoPort));
        if (autoHost) {
            cliArgs.push("--auto-host");
            cliArgs.push(autoHost);
        }
        const cliOptions = {
            cwd: options.cliPath,
            env: Object.assign(Object.assign({}, process.env), { NODE_ENV: mode === "build" ? "production" : "development" }),
        };
        return new Promise((resolve, reject) => {
            const onError = (err) => {
                reject(err);
            };
            const onStdoutData = (data) => {
                const msg = data.toString().trim();
                !silent && console.log(msg);
                if (msg.includes(SIGNAL_DONE_H5) || msg.includes(SIGNAL_DONE_VITE_H5)) {
                    const networkUrl = msg.match(/Network:(.*)/)[1].trim();
                    // H5 DONE
                    debugCompiler(`url: ${networkUrl}`);
                    resolve({ path: networkUrl });
                }
                else if (msg.includes(SIGNAL_DONE)) {
                    const matches = msg.match(PATH_RE);
                    let outputDir = "";
                    if (matches && matches.length > 1) {
                        outputDir = path.join(projectPath, matches[1]);
                    }
                    else {
                        outputDir = path.join(projectPath, `dist/${mode}/${platform}`);
                        if (!fs.existsSync(outputDir)) {
                            outputDir = path.join(projectPath, `unpackage/dist/${mode}/${platform}`);
                        }
                    }
                    silent = true; // 编译已完成
                    this.stop();
                    resolve({
                        path: outputDir,
                    });
                }
            };
            debugCompiler(`${command} ${cliArgs.join(" ")} %o`, cliOptions);
            this.cliProcess = child_process.spawn(command, cliArgs, cliOptions);
            this.cliProcess.on("error", onError);
            this.cliProcess.stdout.on("data", onStdoutData);
            this.cliProcess.stderr.on("data", onStdoutData);
        });
    }
    stop() {
        this.cliProcess && this.cliProcess.kill("SIGTERM");
    }
    getSpawnArgs(options, npmScript) {
        let pkg;
        const cliPath = options.cliPath;
        try {
            pkg = require(path.join(cliPath, "package.json"));
        }
        catch (e) { }
        if (pkg && pkg.scripts && pkg.scripts[npmScript]) {
            return [
                process.env.UNI_NPM_PATH ||
                    (/^win/.test(process.platform) ? "npm.cmd" : "npm"),
                ["run", npmScript, "--"],
            ];
        }
        process.env.UNI_INPUT_DIR = options.projectPath;
        process.env.UNI_OUTPUT_DIR = path.join(options.projectPath, `unpackage/dist/${this.puppet.mode}/${this.puppet.platform}`);
        return [
            process.env.UNI_NODE_PATH || "node",
            [path.join(cliPath, "bin/uniapp-cli.js")],
        ];
    }
}

const PORT = 9520;
const TIMEOUT = 6e4;
function exit(msg) {
    throw Error(msg);
}
class Launcher {
    async launch(options) {
        let devtools = (options.platform === "app"
            ? options.app || options["app-plus"]
            : options[options.platform]) || {};
        this.puppet = new Puppet(options.platform, devtools.puppet);
        // 1.校验参数
        const { port, cliPath, timeout, projectPath } = await this.validate(options);
        devtools = await this.puppet.validateDevtools(devtools);
        // 2.编译
        let shouldCompile = this.puppet.shouldCompile(projectPath, port, options, devtools);
        let devtoolsProjectPath = process.env.UNI_OUTPUT_DIR || projectPath;
        if (!shouldCompile) {
            if (!this.puppet.validateProject(devtoolsProjectPath)) {
                devtoolsProjectPath = path.join(projectPath, "dist/" + this.puppet.mode + "/" + this.puppet.platform);
                if (!this.puppet.validateProject(devtoolsProjectPath)) {
                    devtoolsProjectPath = path.join(projectPath, "unpackage/dist/" + this.puppet.mode + "/" + this.puppet.platform);
                    if (!this.puppet.validateProject(devtoolsProjectPath)) {
                        shouldCompile = true;
                    }
                }
            }
        }
        if (shouldCompile) {
            this.puppet.compiled = options.compile = true;
            this.compiler = new Compiler(this.puppet);
            const compilerResult = await this.compiler.compile({
                host: options.host,
                port,
                cliPath,
                projectPath,
                silent: !!options.silent,
            });
            if (compilerResult.path) {
                devtoolsProjectPath = compilerResult.path;
            }
        }
        const promises = [];
        // 3.runtime
        promises.push(this.createRuntimeConnection(port, timeout));
        // 4.devtool
        promises.push(this.puppet.createDevtools(devtoolsProjectPath, devtools, timeout));
        return new Promise((resolve, reject) => {
            Promise.all(promises)
                .then(([runtimeConnection, devtoolConnection]) => {
                runtimeConnection &&
                    this.puppet.setRuntimeConnection(runtimeConnection);
                devtoolConnection &&
                    this.puppet.setDevtoolConnection(devtoolConnection);
                debug("automator:program")("ready");
                const teardown = devtools.teardown || "disconnect";
                resolve(new Program(this.puppet, { teardown, port }));
            })
                .catch((err) => reject(err));
        });
    }
    resolveCliPath(cliPath) {
        if (!cliPath) {
            return cliPath;
        }
        try {
            const { dependencies, devDependencies } = require(path.join(cliPath, "package.json"));
            if (hasCliDeps(devDependencies) || hasCliDeps(dependencies)) {
                return cliPath;
            }
        }
        catch (e) { }
    }
    resolveProjectPath(projectPath, options) {
        if (!projectPath) {
            projectPath = process.env.UNI_INPUT_DIR || process.cwd();
        }
        if (isRelative(projectPath)) {
            projectPath = path.resolve(projectPath);
        }
        if (!fs.existsSync(projectPath)) {
            exit(`Project path ${projectPath} doesn't exist`);
        }
        return projectPath;
    }
    async validate(options) {
        const projectPath = this.resolveProjectPath(options.projectPath, options);
        let cliPath = process.env.UNI_CLI_PATH || options.cliPath;
        cliPath = this.resolveCliPath(cliPath || "");
        !cliPath && (cliPath = this.resolveCliPath(process.cwd()));
        !cliPath && (cliPath = this.resolveCliPath(projectPath));
        if (!cliPath) {
            throw Error("cliPath is not provided");
        }
        const port = await resolvePort(options.port || PORT);
        const timeout = options.timeout || TIMEOUT;
        return {
            port,
            cliPath,
            timeout,
            projectPath,
        };
    }
    async createRuntimeConnection(port, timeout) {
        return Connection.createRuntimeConnection(port, this.puppet, timeout);
    }
}
function hasCliDeps(deps) {
    if (!deps) {
        return false;
    }
    return !!(deps["@dcloudio/vue-cli-plugin-uni"] || deps["@dcloudio/vite-plugin-uni"]);
}

class Automator {
    constructor() {
        this.launcher = new Launcher();
    }
    // async connect(options: IConnectOptions) {
    //   return this.launcher.connect(options);
    // }
    async launch(options) {
        return this.launcher.launch(options);
    }
}

module.exports = Automator;
