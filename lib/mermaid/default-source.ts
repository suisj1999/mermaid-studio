/**
 * The diagram a fresh editor starts with.
 *
 * Shared by both UI styles so the scratch experience is identical
 * whichever theme is active.
 */
export const DEFAULT_SOURCE = `graph TD
  A[User] --> B{Authenticated?}
  B -->|yes| C[Dashboard]
  B -->|no| D[Login Page]
  D --> E[OAuth Provider]
  E --> B`;
