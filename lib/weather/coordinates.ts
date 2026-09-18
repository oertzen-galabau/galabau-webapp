/** Grober Rahmen für plausible Koordinaten in Deutschland. */
export function isPlausibleGermanCoordinates(latitude: number, longitude: number) {
  return latitude >= 47.2 && latitude <= 55.2 && longitude >= 5.8 && longitude <= 15.1;
}
