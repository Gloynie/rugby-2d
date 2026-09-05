// DHL Stadium top-down plan helpers are implemented in the renderer so they can use its pixel camera.
// This file documents the reference cues: pale oval roof shell, yellow DHL fascia, dark multi-tier bowl,
// central rugby field, east video screen, and Table Mountain beyond the north-west side.
export const DHL_PLAN_REFERENCE = {
  roof: "pale elliptical outer canopy",
  fascia: "yellow DHL sponsor ring with red lettering",
  bowl: "dark blue-grey multi-tier seating around an open central field",
  screen: "large east-side video screen",
  landmark: "Table Mountain north-west of the stadium",
} as const;
