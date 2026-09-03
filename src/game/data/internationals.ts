import type { TeamData } from "../types";

// Starting XVs listed in shirt-number order (1 loosehead ... 15 fullback).
export const INTERNATIONAL_TEAMS: TeamData[] = [
  {
    id: "eng", name: "England", short: "ENG", country: "England", type: "international",
    primary: "#f5f5f5", secondary: "#c8102e", rating: 87, stadiumId: "twickenham",
    players: [
      "Ellis Genge", "Jamie George", "Will Stuart", "Maro Itoje", "George Martin",
      "Chandler Cunningham-South", "Sam Underhill", "Ben Earl", "Alex Mitchell", "Marcus Smith",
      "Tommy Freeman", "Ollie Lawrence", "Henry Slade", "Immanuel Feyi-Waboso", "George Furbank",
      "Joe Marler", "Theo Dan", "Dan Cole", "Alex Coles", "Ollie Chessum",
      "Tom Willis", "Ethan Roots", "Danny Care", "Fin Smith", "Harry Randall",
      "Max Malins", "Ollie Sleightholme", "Elliot Daly", "Freddie Steward", "Joe Carpenter",
      "Ben Spencer", "Manu Tuilagi", "Louis Lynagh", "Cadghan Murley", "Gabriel Ibitoye",
      "Tom Roebuck", "Will Goodrick-Clarke", "Ewan Richards", "Elliott Obatoyinbo"
    ],
  },
  {
    id: "fra", name: "France", short: "FRA", country: "France", type: "international",
    primary: "#1e3a8a", secondary: "#ffffff", rating: 91, stadiumId: "stadedefrance",
    players: [
      "Cyril Baille", "Peato Mauvaka", "Uini Atonio", "Thibaud Flament", "Emmanuel Meafou",
      "François Cros", "Charles Ollivon", "Grégory Alldritt", "Antoine Dupont", "Matthieu Jalibert",
      "Louis Bielle-Biarrey", "Yoram Moefana", "Gaël Fickou", "Damian Penaud", "Thomas Ramos",
      "Reda Wardi", "Julien Marchand", "Dorian Aldegheri", "Paul Gabrillagues", "Cameron Woki",
      "Anthime Jelich", "Paul Boudehent", "Sekou Macalou", "Baptiste Couillande", "Noah Lolesio",
      "Antoine Hastoy", "Nicolas Depoort", "Jonathan Danty", "Yoram Moefana", "Matthis Lebel",
      "Émilien Gailleton", "Théo Attissogbé", "Éric Dos Santos", "Rodrigue Neti", "Alexandre Roumat",
      "Antoine Zeghdar", "Romain Ntamack", "Pita Ahki", "Arthur Retière"
    ],
  },
  {
    id: "ire", name: "Ireland", short: "IRE", country: "Ireland", type: "international",
    primary: "#15803d", secondary: "#ffffff", rating: 92, stadiumId: "aviva",
    players: [
      "Andrew Porter", "Dan Sheehan", "Tadhg Furlong", "Joe McCarthy", "Tadhg Beirne",
      "Josh van der Flier", "Caelan Doris", "Jamison Gibson-Park", "Sam Prendergast",
      "James Lowe", "Bundee Aki", "Garry Ringrose", "Mack Hansen", "Hugo Keenan",
      "Finlay Bealham", "Ronan Kelleher", "Cian Healy", "James Ryan", "Iain Henderson",
      "Tom O'Toole", "Jack Conan", "Craig Casey", "Jack Crowley", "Ross Byrne",
      "Jordan Larmour", "Jimmy O'Brien", "Stuart McCloskey", "Tommy Bowe", "Rob Herring",
      "Dave Kilcoyne", "Jeremy Loughman", "Ed Byrne", "Max Deegan", "Jack Boyle",
      "Cian Prendergast", "Shane Daly", "Garry Ringrose", "Keith Earls", "Simon Zebo",
      "Cian Healy", "John Ryan"
    ],
  },
  {
    id: "ita", name: "Italy", short: "ITA", country: "Italy", type: "international",
    primary: "#38bdf8", secondary: "#ffffff", rating: 78, stadiumId: "olimpico",
    players: ["Danilo Fischetti", "Giacomo Nicotera", "Simone Ferrari", "Niccolò Cannone", "Federico Ruzza", "Sebastian Negri", "Michele Lamaro", "Lorenzo Cannone", "Stephen Varney", "Paolo Garbisi", "Monty Ioane", "Tommaso Menoncello", "Juan Ignacio Brex", "Louis Lynagh", "Ange Capuozzo"],
  },
  {
    id: "sco", name: "Scotland", short: "SCO", country: "Scotland", type: "international",
    primary: "#1e293b", secondary: "#ffffff", rating: 85, stadiumId: "murrayfield",
    players: ["Pierre Schoeman", "Dave Cherry", "Zander Fagerson", "Scott Cummings", "Grant Gilchrist", "Matt Fagerson", "Rory Darge", "Jack Dempsey", "Ben White", "Finn Russell", "Duhan van der Merwe", "Sione Tuipulotu", "Huw Jones", "Darcy Graham", "Blair Kinghorn"],
  },
  {
    id: "wal", name: "Wales", short: "WAL", country: "Wales", type: "international",
    primary: "#dc2626", secondary: "#ffffff", rating: 76, stadiumId: "principality",
    players: ["Gareth Thomas", "Dewi Lake", "Keiron Assiratti", "Dafydd Jenkins", "Adam Beard", "Aaron Wainwright", "Jac Morgan", "Taulupe Faletau", "Tomos Williams", "Gareth Anscombe", "Rio Dyer", "Ben Thomas", "Owen Watkin", "Josh Adams", "Liam Williams"],
  },
  {
    id: "nzl", name: "New Zealand", short: "NZL", country: "New Zealand", type: "international",
    primary: "#111111", secondary: "#ffffff", rating: 92, stadiumId: "edenpark",
    players: [
      "Ethan de Groot", "Codie Taylor", "Tyrel Lomax", "Scott Barrett", "Tupou Vaa'i",
      "Wallace Sititi", "Dalton Papali'i", "Ardie Savea", "Cam Roigard", "Damian McKenzie",
      "Caleb Clarke", "Jordie Barrett", "Rieko Ioane", "Will Jordan", "Beauden Barrett",
      "Ofa Tu'ungafasi", "Asafo Aumua", "Fletcher Newell", "Patrick Tuipulotu", "Sam Darry",
      "Akira Ioane", "Luke Jacobson", "Finlay Christie", "Stephen Perofeta", "Emoni Narawa",
      "Anton Lienert-Brown", "David Havili", "Sevu Reece", "Mark Tele'a", "Zarn Sullivan",
      "TJ Perenara", "Ruben Love", "Petrus Danskie", "Ethan Blackadder", "Tom Christie"
    ],
  },
  {
    id: "rsa", name: "South Africa", short: "RSA", country: "South Africa", type: "international",
    primary: "#166534", secondary: "#facc15", rating: 94, stadiumId: "ellispark",
    players: [
      "Ox Nché", "Malcolm Marx", "Frans Malherbe", "Eben Etzebeth", "Franco Mostert",
      "Pieter-Steph du Toit", "Jasper Wiese", "Faf de Klerk", "Handré Pollard", "Kurt-Lee Arendse",
      "Damian de Allende", "Jesse Kriel", "Cheslin Kolbe", "Willie le Roux", "Trevor Nyakane",
      "Bongi Mbonambi", "Vincent Koch", "RG Snyman", "Salmaan Moerat", "Evan Roos",
      "Deon Fourie", "Cobus Reinach", "Manie Libbok", "Canan Moodie", "Makazole Mapimpi",
      "Aphelele Fassi", "Andre Esterhuizen", "Lukhanyo Am", "Grant Williams", "Siya Masuku",
      "Kwagga Smith", "Elton Jantjies", "Ruan Nortje", "Ben-Jason Dixon"
    ],
  },
  {
    id: "aus", name: "Australia", short: "AUS", country: "Australia", type: "international",
    primary: "#eab308", secondary: "#14532d", rating: 83, stadiumId: "accor",
    players: [
      "James Slipper", "Matt Faessler", "Allan Alaalatoa", "Nick Frost", "Jeremy Williams",
      "Rob Valetini", "Fraser McReight", "Harry Wilson", "Jake Gordon", "Noah Lolesio",
      "Max Jorgensen", "Len Ikitau", "Joseph Suaalii", "Andrew Kellaway", "Tom Wright",
      "Angus Bell", "Dave Porecki", "Taniela Tupou", "Ryan Smith", "Cadeyrn Neville",
      "Langi Gleeson", "Charlie Cale", "Tate McDermott", "Tom Lynagh", "Lachie Anderson",
      "Jock Campbell", "Hunter Paisami", "Lalakai Foketi", "Darby Lancaster", "Dylan Pietsch",
      "Ben Donaldson", "Nic White", "Reece Hodge", "Marika Koroibete", "Filipo Daugunu"
    ],
  },
  {
    id: "arg", name: "Argentina", short: "ARG", country: "Argentina", type: "international",
    primary: "#7dd3fc", secondary: "#ffffff", rating: 85, stadiumId: "amalfitani",
    players: [
      "Thomas Gallo", "Julián Montoya", "Joel Sclavi", "Guido Petti", "Pedro Rubiolo",
      "Pablo Matera", "Marcos Kremer", "Juan Martín González", "Gonzalo Bertranou", "Tomás Albornoz",
      "Mateo Carreras", "Santiago Chocobares", "Lucio Cinti", "Bautista Delguy", "Juan Cruz Mallía",
      "Facundo Gigena", "Mayco Vivas", "Ignacio Ruiz", "Matías Alemanno", "Lautaro Soccino",
      "Francisco Orrantia", "Santiago Grondona", "Lautaro Bazán", "Santiago Carreras", "Lucas Martínez",
      "Jerónimo de la Fuente", "Matías Orlando", "Emilio Cordero", "Facundo Isa", "Lucio Anconetani",
      "Ignacio Mendy", "Socino Bautista", "Agustín Segura"
    ],
  },
  {
    id: "jpn", name: "Japan", short: "JPN", country: "Japan", type: "international",
    primary: "#dc2626", secondary: "#ffffff", rating: 74,
    players: ["Keita Inagaki", "Mamoru Harada", "Shuhei Takeuchi", "Warner Dearns", "Jack Cornelsen", "Michael Leitch", "Kazuki Himeno", "Amato Fakatava", "Naoto Saito", "Seungsin Lee", "Jone Naikabula", "Dylan Riley", "Tomoki Osada", "Kotaro Matsushima", "Lomano Lemeki"],
  },
  {
    id: "fij", name: "Fiji", short: "FIJ", country: "Fiji", type: "international",
    primary: "#f8fafc", secondary: "#0f172a", rating: 80,
    players: ["Eroni Mawi", "Tevita Ikanivere", "Samu Tawake", "Isoa Nasilasila", "Temo Mayanavanua", "Lekima Tagitagivalu", "Levani Botia", "Viliame Mata", "Frank Lomani", "Caleb Muntz", "Semi Radradra", "Josua Tuisova", "Waisea Nayacalevu", "Selestino Ravutaumada", "Ilaisa Droasese"],
  },
  {
    id: "geo", name: "Georgia", short: "GEO", country: "Georgia", type: "international",
    primary: "#b91c1c", secondary: "#ffffff", rating: 72,
    players: ["Mikheil Nariashvili", "Vano Karkadze", "Beka Gigashvili", "Nodar Cheishvili", "Konstantine Mikautadze", "Luka Ivanishvili", "Beka Saginadze", "Tornike Jalagonia", "Vasil Lobzhanidze", "Luka Matkava", "Akaki Tabutsadze", "Merab Sharikadze", "Demur Tapladze", "Mirian Modebadze", "Davit Niniashvili"],
  },
  {
    id: "sam", name: "Samoa", short: "SAM", country: "Samoa", type: "international",
    primary: "#1d4ed8", secondary: "#ffffff", rating: 70,
    players: ["Jordan Lay", "Sama Malolo", "Paul Alo-Emile", "Theo McFarland", "Chris Vui", "Taleni Seu", "Fritz Lee", "Steven Luatua", "Jonathan Taumateine", "Rodney Iona", "Nigel Ah Wong", "Tumua Manu", "UJ Seuteni", "Ed Fidow", "Duncan Paia'aua"],
  },
  {
    id: "ton", name: "Tonga", short: "TGA", country: "Tonga", type: "international",
    primary: "#dc2626", secondary: "#ffffff", rating: 68,
    players: ["Siegfried Fisi'ihoi", "Sam Moli", "Ben Tameifuna", "Adam Coleman", "Sam Lousi", "Tanginoa Halaifonua", "Sione Talitui", "Vaea Fifita", "Sonatane Takulua", "William Havili", "Solomone Kata", "Pita Ahki", "Malakai Fekitoa", "Afusipa Taumoepeau", "Charles Piutau"],
  },
  {
    id: "por", name: "Portugal", short: "POR", country: "Portugal", type: "international",
    primary: "#b91c1c", secondary: "#15803d", rating: 66,
    players: ["Francisco Fernandes", "Mike Tadjer", "Diogo Hasse Ferreira", "José Madeira", "Steevy Cerqueira", "João Granate", "Nicolas Martins", "Rafael Simões", "Samuel Marques", "Jerónimo Portela", "Rodrigo Marta", "Tomás Appleton", "José Lima", "Raffaele Storti", "Nuno Sousa Guedes"],
  },
];
