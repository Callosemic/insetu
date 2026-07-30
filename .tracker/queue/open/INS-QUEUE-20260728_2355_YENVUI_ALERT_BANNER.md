---
id: "INS-QUEUE-20260728_2355_YENVUI_ALERT_BANNER"
repo: "insetu"
type: "queue"
status: "open"
title: "Generalize System Banner Alerts into <yenvui-alert-banner> Component"
created_at: "2026-07-28T23:55:00"
closed_at: null
sub_bucket: "UI"
tags: ["yenVUI", "UI", "Refactor"]
---

## Description
Abstract localized banner alert logic (such as `<insetu-config-banner>`) out of `ui_primitives.js` and generalize it into a vendorized `<yenvui-alert-banner>` Web Component in `insetu/static/vendor/yenvui/js/alert-banner.js`.

### Action Items
- [ ] **Construct `<yenvui-alert-banner>` Primitive**:
  - Expose `intent` property (`warning`, `danger`, `info`, `success`).
  - Accept primary text via property or default slot.
  - Support boolean `dismissable` property with `@yv-dismiss` custom event emission.
  - Encapsulate fixed overlay positioning and theme token styling within component shadow DOM.
- [ ] **Refactor `<insetu-config-banner>`**:
  - Update `InSetConfigBanner` in `ui_primitives.js` to render `<yenvui-alert-banner>` declaratively.
  - Bind the `@yv-dismiss` event to mutate `AppStore.configMissing = false`.