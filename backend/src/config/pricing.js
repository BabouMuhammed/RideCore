// Academic GMD tariff for new rides, not an FX conversion of historical GBP fares.
export const pricing = Object.freeze({
  currency: "GMD",
  baseFare: 75,
  perKm: 25,
  perMinute: 5,
  averageSpeedKmh: 30,
  multipliers: Object.freeze({ economy: 1, comfort: 1.3, xl: 1.6 }),
});
