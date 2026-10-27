import { EventEmitter } from "node:events";
export const shareEvents = new EventEmitter();
export const trackingEvents = new EventEmitter();
// These keys are process-internal room identities, never public authorization credentials.
export const shareKey = (share) => `${share._id}:${share.generation}`;
export function publishShareEnded(key, reason) {
  shareEvents.emit("ended", { key, reason });
}
