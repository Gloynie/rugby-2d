import type { Stadium } from "../types";

export const STADIUMS: Stadium[] = [
  { id: "twickenham", name: "Allianz Stadium, Twickenham", city: "London", country: "England", capacity: 82000, grassA: "#2f8f3a", grassB: "#2a7f33", stand: "#2b2f3a", accent: "#c8102e", architecture: "classic", night: false },
  { id: "stadedefrance", name: "Stade de France", city: "Saint-Denis", country: "France", capacity: 80698, grassA: "#2e8b3a", grassB: "#287a32", stand: "#2d2d33", accent: "#1e3a8a", architecture: "oval-bowl", night: true },
  { id: "aviva", name: "Aviva Stadium", city: "Dublin", country: "Ireland", capacity: 51700, grassA: "#2f9440", grassB: "#298438", stand: "#2f3542", accent: "#15803d", architecture: "asymmetric-arch", night: false },
  { id: "principality", name: "Principality Stadium", city: "Cardiff", country: "Wales", capacity: 73931, grassA: "#2c8437", grassB: "#26752f", stand: "#3a2b2b", accent: "#dc2626", architecture: "enclosed-roof", night: true },
  { id: "murrayfield", name: "Scottish Gas Murrayfield", city: "Edinburgh", country: "Scotland", capacity: 67144, grassA: "#2f8b3c", grassB: "#297a34", stand: "#2b2f3a", accent: "#1e293b", architecture: "open-end", night: false },
  { id: "olimpico", name: "Stadio Olimpico", city: "Rome", country: "Italy", capacity: 70634, grassA: "#3a9a44", grassB: "#32893c", stand: "#3b3a33", accent: "#38bdf8", architecture: "oval-bowl", night: false },
  { id: "edenpark", name: "Eden Park", city: "Auckland", country: "New Zealand", capacity: 50000, grassA: "#2b8a3a", grassB: "#257a32", stand: "#26282e", accent: "#111111", architecture: "classic", night: true },
  { id: "ellispark", name: "Emirates Airline Park (Ellis Park)", city: "Johannesburg", country: "South Africa", capacity: 62567, grassA: "#3d9a3f", grassB: "#348936", stand: "#3a332a", accent: "#166534", architecture: "modern-bowl", night: false },
  { id: "accor", name: "Accor Stadium", city: "Sydney", country: "Australia", capacity: 83500, grassA: "#3a9642", grassB: "#32853a", stand: "#2b2f3a", accent: "#eab308", architecture: "oval-bowl", night: true },
  { id: "amalfitani", name: "Estadio José Amalfitani", city: "Buenos Aires", country: "Argentina", capacity: 49540, grassA: "#37913f", grassB: "#2f8037", stand: "#33333a", accent: "#7dd3fc", architecture: "open-end", night: false },
  { id: "suncorp", name: "Suncorp Stadium", city: "Brisbane", country: "Australia", capacity: 52500, grassA: "#3a9a44", grassB: "#32893c", stand: "#2a2d36", accent: "#7f1d1d", architecture: "roofed-bowl", night: true },
  { id: "loftus", name: "Loftus Versfeld", city: "Pretoria", country: "South Africa", capacity: 51762, grassA: "#3f9c40", grassB: "#368a37", stand: "#3a3a3a", accent: "#38bdf8", architecture: "classic", night: false },
  { id: "dhl", name: "DHL Stadium", city: "Cape Town", country: "South Africa", capacity: 55000, grassA: "#2f9440", grassB: "#298438", stand: "#2f3542", accent: "#1d4ed8", architecture: "modern-bowl", night: false },
  { id: "thomond", name: "Thomond Park", city: "Limerick", country: "Ireland", capacity: 25600, grassA: "#2c8a3a", grassB: "#267a32", stand: "#2b2f3a", accent: "#b91c1c", architecture: "classic", night: true },
  { id: "kingsholm", name: "Kingsholm", city: "Gloucester", country: "England", capacity: 16115, grassA: "#2f8f3a", grassB: "#2a7f33", stand: "#3a2b2b", accent: "#b91c1c", architecture: "classic", night: false },
  { id: "franklins", name: "Franklin's Gardens", city: "Northampton", country: "England", capacity: 15249, grassA: "#2f9440", grassB: "#298438", stand: "#2b332b", accent: "#14532d", architecture: "classic", night: false },
  { id: "sandypark", name: "Sandy Park", city: "Exeter", country: "England", capacity: 15600, grassA: "#2e8b3a", grassB: "#287a32", stand: "#2f2f2f", accent: "#ec4899", architecture: "open-end", night: false },
  { id: "forsythbarr", name: "Forsyth Barr Stadium", city: "Dunedin", country: "New Zealand", capacity: 30748, grassA: "#39a04a", grassB: "#318f41", stand: "#25283a", accent: "#facc15", architecture: "enclosed-roof", night: true },
  { id: "velodrome", name: "Stade Vélodrome", city: "Marseille", country: "France", capacity: 67394, grassA: "#3a9a44", grassB: "#32893c", stand: "#2b3a4a", accent: "#38bdf8", architecture: "roofed-bowl", night: true },
];

export function getStadium(id: string | undefined): Stadium {
  return STADIUMS.find((s) => s.id === id) ?? STADIUMS[0];
}
