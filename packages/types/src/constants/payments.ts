// Product-level payment toggles — a fork turns off the flow it does not sell.
// At least one must stay enabled; CatalogService fail-fasts on startup otherwise.
//
// Annotated as `boolean` deliberately: with a literal type TypeScript would
// treat the disabled branch as unreachable and strip the handling code from
// type-checking, so flipping a flag would surface errors that never ran.

export const PAYMENTS_SUBSCRIPTION_ENABLED: boolean = true;

export const PAYMENTS_ONE_OFF_ENABLED: boolean = true;
