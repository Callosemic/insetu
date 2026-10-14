# ADR 0023: Polymorphic Entity-Action Card Registry

## Status
Accepted (2026-07-16)

## Context
In previous iterations of the V2 SDK, custom extensions injected contextual user actions into file trees and lists by passing raw `lit-html` template strings through localized layout zone hooks (e.g., `zone:file-card-actions`). This strategy compromised the Unidirectional Data Flow (UDF) model by scattering presentation state across decoupled components, causing visual order anomalies, and complicating cross-extension stability.

## Decision
We formally graduate the frontend layout ecosystem to a Polymorphic Entity-Action Card Registry. Core UI display elements (`<insetu-card>`) are now entirely stateless regarding application business logic. They broadcast an `entityType` classification string and an `entityData` property dictionary. Extensions declaratively register metadata action configurations (`entityActions`) with the global `ExtensionRegistry`. Primitives are rendered dynamically using a deterministic CSS-order scale.

## Consequences
* **Positives:** Enforces rigorous presentation uniformity across all active dashboard views.
* **Positives:** Complete elimination of imperatively generated HTML nodes and inline component-level event listener bloat.
* **Negatives:** Requires extension developers to structure callback interactions within precise data property dictionaries rather than writing free-form inline template layouts.