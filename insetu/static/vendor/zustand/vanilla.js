var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/zustand/vanilla.js
var require_vanilla = __commonJS({
  "node_modules/zustand/vanilla.js"(exports, module) {
    var createStoreImpl = function createStoreImpl2(createState) {
      var state;
      var listeners = /* @__PURE__ */ new Set();
      var setState = function setState2(partial, replace) {
        var nextState = typeof partial === "function" ? partial(state) : partial;
        if (!Object.is(nextState, state)) {
          var _previousState = state;
          state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
          listeners.forEach(function(listener) {
            return listener(state, _previousState);
          });
        }
      };
      var getState = function getState2() {
        return state;
      };
      var getInitialState = function getInitialState2() {
        return initialState;
      };
      var subscribe = function subscribe2(listener) {
        listeners.add(listener);
        return function() {
          return listeners.delete(listener);
        };
      };
      var destroy = function destroy2() {
        if (true) {
          console.warn("[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected.");
        }
        listeners.clear();
      };
      var api = {
        setState,
        getState,
        getInitialState,
        subscribe,
        destroy
      };
      var initialState = state = createState(setState, getState, api);
      return api;
    };
    var createStore = function createStore2(createState) {
      return createState ? createStoreImpl(createState) : createStoreImpl;
    };
    var vanilla = (function(createState) {
      if (true) {
        console.warn("[DEPRECATED] Default export is deprecated. Instead use import { createStore } from 'zustand/vanilla'.");
      }
      return createStore(createState);
    });
    exports.createStore = createStore;
    exports.default = vanilla;
    module.exports = vanilla;
    module.exports.createStore = createStore;
    exports.default = module.exports;
  }
});
export default require_vanilla();
