import { EventEmitter } from "node:events";
export const rideEvents = new EventEmitter();
const events = Object.freeze({
  accepted: "ride:accepted",
  driver_arriving: "ride:driver-arriving",
  driver_arrived: "ride:driver-arrived",
  in_progress: "ride:started",
  completed: "ride:completed",
  cancelled: "ride:cancelled",
});
export function publishRideChange(ride) {
  rideEvents.emit("change", {
    event: events[ride.status],
    rideId: String(ride._id),
    status: ride.status,
    timestamp: new Date(ride.updatedAt).toISOString(),
  });
}
