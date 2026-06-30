
export interface StarData {
  name?: string; 
  ra: number; 
  dec: number; 
  mag: number; 
  bv: number; 
}

export const STARS: StarData[] = [

  { name: "Sirius", ra: 6.752, dec: -16.716, mag: -1.46, bv: 0.0 },
  { name: "Canopus", ra: 6.399, dec: -52.696, mag: -0.74, bv: 0.15 },
  { name: "Arcturus", ra: 14.261, dec: 19.182, mag: -0.05, bv: 1.23 },
  { name: "Rigil Kent", ra: 14.66, dec: -60.835, mag: -0.01, bv: 0.71 },
  { name: "Vega", ra: 18.616, dec: 38.784, mag: 0.03, bv: 0.0 },
  { name: "Capella", ra: 5.278, dec: 45.998, mag: 0.08, bv: 0.8 },
  { name: "Rigel", ra: 5.242, dec: -8.202, mag: 0.13, bv: -0.03 },
  { name: "Procyon", ra: 7.655, dec: 5.225, mag: 0.34, bv: 0.42 },
  { name: "Achernar", ra: 1.629, dec: -57.237, mag: 0.46, bv: -0.16 },
  { name: "Betelgeuse", ra: 5.919, dec: 7.407, mag: 0.5, bv: 1.85 },
  { name: "Hadar", ra: 14.064, dec: -60.373, mag: 0.61, bv: -0.23 },
  { name: "Altair", ra: 19.846, dec: 8.868, mag: 0.77, bv: 0.22 },
  { name: "Acrux", ra: 12.443, dec: -63.1, mag: 0.76, bv: -0.24 },
  { name: "Aldebaran", ra: 4.599, dec: 16.509, mag: 0.85, bv: 1.54 },
  { name: "Antares", ra: 16.49, dec: -26.432, mag: 0.96, bv: 1.83 },
  { name: "Spica", ra: 13.42, dec: -11.161, mag: 0.97, bv: -0.23 },
  { name: "Pollux", ra: 7.755, dec: 28.026, mag: 1.14, bv: 1.0 },
  { name: "Fomalhaut", ra: 22.961, dec: -29.622, mag: 1.16, bv: 0.09 },
  { name: "Deneb", ra: 20.69, dec: 45.28, mag: 1.25, bv: 0.09 },
  { name: "Mimosa", ra: 12.795, dec: -59.689, mag: 1.25, bv: -0.23 },
  { name: "Regulus", ra: 10.139, dec: 11.967, mag: 1.35, bv: -0.11 },

  { name: "Adhara", ra: 6.977, dec: -28.972, mag: 1.5, bv: -0.21 },
  { name: "Castor", ra: 7.577, dec: 31.888, mag: 1.58, bv: 0.03 },
  { name: "Shaula", ra: 17.56, dec: -37.104, mag: 1.63, bv: -0.22 },
  { name: "Gacrux", ra: 12.519, dec: -57.113, mag: 1.63, bv: 1.59 },
  { name: "Bellatrix", ra: 5.419, dec: 6.35, mag: 1.64, bv: -0.22 },
  { name: "Elnath", ra: 5.438, dec: 28.608, mag: 1.65, bv: -0.13 },
  { name: "Miaplacidus", ra: 9.22, dec: -69.717, mag: 1.68, bv: 0.07 },
  { name: "Alnilam", ra: 5.604, dec: -1.202, mag: 1.69, bv: -0.18 },
  { name: "Alnair", ra: 22.137, dec: -46.961, mag: 1.74, bv: -0.07 },
  { name: "Alnitak", ra: 5.679, dec: -1.943, mag: 1.77, bv: -0.21 },
  { name: "Alioth", ra: 12.9, dec: 55.96, mag: 1.77, bv: -0.02 },
  { name: "Dubhe", ra: 11.062, dec: 61.751, mag: 1.79, bv: 1.07 },
  { name: "Mirfak", ra: 3.405, dec: 49.861, mag: 1.79, bv: 0.48 },
  { name: "Kaus Australis", ra: 18.403, dec: -34.385, mag: 1.85, bv: -0.03 },
  { name: "Wezen", ra: 7.14, dec: -26.394, mag: 1.84, bv: 0.67 },
  { name: "Alkaid", ra: 13.792, dec: 49.313, mag: 1.86, bv: -0.19 },
  { name: "Sargas", ra: 17.622, dec: -42.998, mag: 1.87, bv: 0.4 },
  { name: "Avior", ra: 8.376, dec: -59.51, mag: 1.86, bv: 1.18 },
  { name: "Menkalinan", ra: 5.992, dec: 44.948, mag: 1.9, bv: 0.08 },
  { name: "Atria", ra: 16.811, dec: -69.028, mag: 1.92, bv: 1.44 },
  { name: "Alhena", ra: 6.629, dec: 16.399, mag: 1.93, bv: 0.0 },
  { name: "Peacock", ra: 20.427, dec: -56.735, mag: 1.94, bv: -0.2 },
  { name: "Polaris", ra: 2.53, dec: 89.264, mag: 1.98, bv: 0.63 },
  { name: "Mirzam", ra: 6.379, dec: -17.956, mag: 1.98, bv: -0.24 },

  { name: "Alpheratz", ra: 0.14, dec: 29.091, mag: 2.06, bv: -0.11 },
  { name: "Saiph", ra: 5.796, dec: -9.67, mag: 2.09, bv: -0.18 },
  { name: "Mintaka", ra: 5.533, dec: -0.299, mag: 2.23, bv: -0.21 },
  { name: "Diphda", ra: 0.726, dec: -17.987, mag: 2.04, bv: 1.02 },
  { name: "Rasalhague", ra: 17.582, dec: 12.56, mag: 2.07, bv: 0.15 },
  { name: "Algol", ra: 3.136, dec: 40.957, mag: 2.12, bv: -0.05 },
  { name: "Denebola", ra: 11.817, dec: 14.572, mag: 2.13, bv: 0.09 },
  { name: "Tiaki", ra: 22.711, dec: -46.885, mag: 2.39, bv: 1.02 },
  { name: "Muhlifain", ra: 12.692, dec: -48.96, mag: 2.17, bv: -0.01 },
  { name: "Aspidiske", ra: 9.285, dec: -59.275, mag: 2.25, bv: 0.18 },
  { name: "Mizar", ra: 13.399, dec: 54.925, mag: 2.27, bv: 0.02 },
  { name: "Suhail", ra: 9.133, dec: -43.433, mag: 2.21, bv: 1.66 },
  { name: "Alphecca", ra: 15.578, dec: 26.715, mag: 2.23, bv: 0.03 },
  { name: "Sadr", ra: 20.37, dec: 40.257, mag: 2.2, bv: 0.67 },
  { name: "Schedar", ra: 0.675, dec: 56.537, mag: 2.23, bv: 1.17 },
  { name: "Eltanin", ra: 17.943, dec: 51.489, mag: 2.23, bv: 1.52 },
  { name: "Naos", ra: 8.059, dec: -40.003, mag: 2.25, bv: -0.27 },
  { name: "Almach", ra: 2.065, dec: 42.33, mag: 2.26, bv: 1.37 },
  { name: "Caph", ra: 0.153, dec: 59.15, mag: 2.27, bv: 0.34 },
  { name: "Enif", ra: 21.736, dec: 9.875, mag: 2.39, bv: 1.52 },
  { name: "Markab", ra: 23.079, dec: 15.205, mag: 2.49, bv: -0.04 },
  { name: "Scheat", ra: 23.063, dec: 28.083, mag: 2.42, bv: 1.67 },
  { name: "Algenib", ra: 0.22, dec: 15.184, mag: 2.83, bv: -0.22 },
  { name: "Dschubba", ra: 16.005, dec: -22.622, mag: 2.32, bv: -0.12 },
  { name: "Nunki", ra: 18.921, dec: -26.297, mag: 2.05, bv: -0.13 },
  { name: "Thuban", ra: 14.073, dec: 64.376, mag: 3.65, bv: -0.05 },
  { name: "Merak", ra: 11.031, dec: 56.382, mag: 2.37, bv: 0.03 },
  { name: "Phecda", ra: 11.897, dec: 53.695, mag: 2.44, bv: 0.04 },
  { name: "Megrez", ra: 12.257, dec: 57.033, mag: 3.31, bv: 0.08 },

  { name: "Lesath", ra: 17.53, dec: -37.296, mag: 2.69, bv: -0.22 },
  { name: "Sargas θ Sco", ra: 17.622, dec: -42.998, mag: 1.87, bv: 0.4 },

  { name: "Kochab", ra: 14.845, dec: 74.156, mag: 2.08, bv: 1.47 },
  { name: "Pherkad", ra: 15.345, dec: 71.834, mag: 3.0, bv: -0.08 },

  { name: "Algieba", ra: 10.333, dec: 19.842, mag: 2.28, bv: 1.14 },
  { name: "Zosma", ra: 11.235, dec: 20.524, mag: 2.56, bv: 0.12 },

  { name: "Mebsuta", ra: 6.383, dec: 25.131, mag: 3.06, bv: 0.9 },
  { name: "Tejat", ra: 6.383, dec: 22.514, mag: 2.88, bv: 1.64 },
  { name: "Alhena γ Gem", ra: 6.629, dec: 16.399, mag: 1.93, bv: 0.0 },
  { name: "Wasat", ra: 7.335, dec: 21.982, mag: 3.53, bv: 0.34 },

  { name: "Alcyone", ra: 3.791, dec: 24.105, mag: 2.87, bv: -0.09 },
  { name: "Atlas", ra: 3.819, dec: 24.053, mag: 3.63, bv: -0.07 },

  { name: "Albireo", ra: 19.512, dec: 27.96, mag: 3.08, bv: 1.09 },
  { name: "Gienah Cyg", ra: 20.77, dec: 33.97, mag: 2.46, bv: 1.02 },

  { name: "Tarazed", ra: 19.771, dec: 10.613, mag: 2.72, bv: 1.52 },
  { name: "Deneb el Okab", ra: 19.09, dec: 13.863, mag: 3.36, bv: 0.01 },

  { name: "Sheliak", ra: 18.835, dec: 33.363, mag: 3.45, bv: -0.08 },
  { name: "Sulafat", ra: 18.982, dec: 32.69, mag: 3.24, bv: 0.0 },

  { name: "Navi", ra: 0.945, dec: 60.717, mag: 2.47, bv: -0.15 },
  { name: "Ruchbah", ra: 1.43, dec: 60.235, mag: 2.68, bv: 0.13 },

  { name: "Atik", ra: 3.964, dec: 40.01, mag: 2.85, bv: 0.02 },

  { name: "Ascella", ra: 19.043, dec: -29.88, mag: 2.59, bv: 0.08 },
  { name: "Kaus Media", ra: 18.35, dec: -29.828, mag: 2.72, bv: 1.38 },
  { name: "Kaus Borealis", ra: 18.466, dec: -25.421, mag: 2.82, bv: 1.1 },
  { name: "Alnasl", ra: 18.097, dec: -30.424, mag: 2.99, bv: 0.98 },

  { name: "Vindemiatrix", ra: 13.036, dec: 10.959, mag: 2.83, bv: 0.94 },
  { name: "Porrima", ra: 12.694, dec: -1.449, mag: 2.74, bv: 0.36 },

  { name: "Izar", ra: 14.75, dec: 27.075, mag: 2.37, bv: 1.02 },
  { name: "Muphrid", ra: 13.912, dec: 18.397, mag: 2.68, bv: 0.58 },

  { name: "Zubenelgenubi", ra: 14.848, dec: -16.042, mag: 2.75, bv: 0.15 },
  { name: "Zubeneschamali", ra: 15.283, dec: -9.383, mag: 2.61, bv: -0.07 },

  { name: "Aludra", ra: 7.402, dec: -29.303, mag: 2.45, bv: -0.13 },
  { name: "Furud", ra: 6.338, dec: -30.063, mag: 3.02, bv: -0.18 },

  { name: "Gomeisa", ra: 7.453, dec: 8.289, mag: 2.9, bv: -0.09 },

  { name: "Hamal", ra: 2.12, dec: 23.462, mag: 2.0, bv: 1.15 },
  { name: "Sheratan", ra: 1.911, dec: 20.808, mag: 2.64, bv: 0.17 },

  { name: "Eta Piscium", ra: 1.525, dec: 15.346, mag: 3.63, bv: 0.97 },

  { name: "Mirach", ra: 1.163, dec: 35.621, mag: 2.06, bv: 1.58 },

  { name: "Mothallah", ra: 1.885, dec: 29.579, mag: 3.41, bv: 0.14 },

  { name: "Mahasim", ra: 5.995, dec: 37.213, mag: 3.17, bv: 0.01 },
  { name: "Hassaleh", ra: 4.95, dec: 33.166, mag: 2.69, bv: 1.53 },

  { name: "Cursa", ra: 5.131, dec: -5.086, mag: 2.79, bv: 0.13 },
  { name: "Zaurak", ra: 3.967, dec: -13.508, mag: 2.95, bv: 1.59 },

  { name: "Sabik", ra: 17.173, dec: -15.725, mag: 2.43, bv: 0.06 },
  { name: "Yed Prior", ra: 16.239, dec: -3.694, mag: 2.73, bv: 1.17 },

  { name: "Unukalhai", ra: 15.738, dec: 6.426, mag: 2.65, bv: 1.17 },

  { name: "Kornephoros", ra: 16.504, dec: 21.489, mag: 2.77, bv: 0.94 },
  { name: "Zeta Her", ra: 16.688, dec: 31.603, mag: 2.81, bv: 0.65 },
  { name: "Pi Her", ra: 17.251, dec: 36.809, mag: 3.16, bv: 1.09 },
  { name: "Eta Her", ra: 16.715, dec: 38.922, mag: 3.53, bv: 0.92 },

  { name: "Rastaban", ra: 17.507, dec: 52.301, mag: 2.79, bv: 0.91 },
  { name: "Aldhibah", ra: 17.147, dec: 65.715, mag: 3.17, bv: -0.12 },

  { name: "Matar", ra: 22.717, dec: 30.221, mag: 2.94, bv: 0.86 },

  { name: "Sadalsuud", ra: 21.526, dec: -5.571, mag: 2.91, bv: 0.83 },
  { name: "Sadalmelik", ra: 22.096, dec: -0.32, mag: 2.96, bv: 0.97 },

  { name: "Deneb Algedi", ra: 21.784, dec: -16.127, mag: 2.87, bv: 0.33 },
  { name: "Dabih", ra: 20.35, dec: -14.781, mag: 3.08, bv: 0.79 },

  { name: "Menkent", ra: 14.111, dec: -36.37, mag: 2.06, bv: 1.01 },

  { name: "Imai", ra: 12.252, dec: -58.749, mag: 2.8, bv: -0.18 },

  { name: "Turais", ra: 8.075, dec: -24.304, mag: 2.25, bv: 0.27 },

  { name: "Markeb", ra: 9.368, dec: -55.011, mag: 2.5, bv: -0.18 },

  { name: "Pi Pup", ra: 7.286, dec: -37.097, mag: 2.71, bv: 1.62 },

  { name: "Phact", ra: 5.661, dec: -34.074, mag: 2.64, bv: -0.12 },

  { name: "Arneb", ra: 5.545, dec: -17.822, mag: 2.58, bv: 0.21 },
  { name: "Nihal", ra: 5.471, dec: -20.759, mag: 2.84, bv: 0.82 },

  { name: "Alphard", ra: 9.46, dec: -8.659, mag: 1.98, bv: 1.44 },

  { name: "Gienah Corvi", ra: 12.263, dec: -17.542, mag: 2.59, bv: -0.11 },
  { name: "Kraz", ra: 12.573, dec: -23.397, mag: 2.65, bv: 0.89 },
  { name: "Algorab", ra: 12.497, dec: -16.516, mag: 2.95, bv: 0.04 },
  { name: "Minkar", ra: 12.168, dec: -22.62, mag: 3.02, bv: 1.33 },

  { name: "Alkes", ra: 10.996, dec: -18.299, mag: 4.08, bv: 1.12 },

  { name: "Acubens", ra: 8.975, dec: 11.858, mag: 4.25, bv: 0.14 },
  { name: "Al Tarf", ra: 8.275, dec: 9.186, mag: 3.52, bv: 1.48 },

  { name: "Alrisha", ra: 2.034, dec: 2.764, mag: 3.79, bv: 0.25 },

  { ra: 0.44, dec: -42.31, mag: 3.56, bv: 0.55 },
  { ra: 1.1, dec: -10.18, mag: 3.47, bv: 1.02 },
  { ra: 1.86, dec: -51.61, mag: 3.32, bv: -0.09 },
  { ra: 2.72, dec: 3.24, mag: 3.69, bv: 1.0 },
  { ra: 3.04, dec: -8.83, mag: 3.73, bv: 1.48 },
  { ra: 3.41, dec: -9.46, mag: 3.29, bv: 0.94 },
  { ra: 3.72, dec: -64.81, mag: 3.85, bv: 0.33 },
  { ra: 4.33, dec: 15.63, mag: 3.54, bv: 0.98 },
  { ra: 4.48, dec: -55.05, mag: 3.84, bv: 0.04 },
  { ra: 4.57, dec: -14.3, mag: 3.87, bv: -0.07 },
  { ra: 5.13, dec: -12.94, mag: 3.19, bv: 0.87 },
  { ra: 5.46, dec: -22.37, mag: 3.55, bv: -0.17 },
  { ra: 5.59, dec: -69.76, mag: 3.85, bv: 0.0 },
  { ra: 6.06, dec: -33.8, mag: 3.49, bv: -0.19 },
  { ra: 6.25, dec: -72.8, mag: 3.84, bv: 0.31 },
  { ra: 6.63, dec: -52.97, mag: 3.85, bv: 0.95 },
  { ra: 7.49, dec: -43.2, mag: 3.61, bv: -0.11 },
  { ra: 7.65, dec: -26.8, mag: 3.47, bv: -0.08 },
  { ra: 8.16, dec: -47.34, mag: 3.62, bv: 1.19 },
  { ra: 8.63, dec: -33.19, mag: 3.6, bv: 0.3 },
  { ra: 9.25, dec: 34.39, mag: 3.52, bv: 0.04 },
  { ra: 9.53, dec: -57.03, mag: 3.13, bv: 0.07 },
  { ra: 10.28, dec: -61.33, mag: 3.87, bv: 0.69 },
  { ra: 10.78, dec: -49.42, mag: 3.84, bv: -0.16 },
  { ra: 11.55, dec: -63.02, mag: 3.59, bv: -0.22 },
  { ra: 12.14, dec: -50.72, mag: 3.41, bv: -0.13 },
  { ra: 13.34, dec: -36.71, mag: 3.56, bv: 1.19 },
  { ra: 13.66, dec: -53.47, mag: 3.83, bv: 0.01 },
  { ra: 14.53, dec: -42.16, mag: 3.55, bv: 0.71 },
  { ra: 15.04, dec: -25.28, mag: 3.22, bv: 0.1 },
  { ra: 15.58, dec: -41.17, mag: 3.41, bv: 0.48 },
  { ra: 16.12, dec: -19.81, mag: 3.32, bv: -0.1 },
  { ra: 16.62, dec: -28.22, mag: 3.56, bv: -0.08 },
  { ra: 17.42, dec: -55.53, mag: 3.31, bv: -0.11 },
  { ra: 17.79, dec: -40.13, mag: 3.17, bv: -0.14 },
  { ra: 18.09, dec: -21.06, mag: 3.51, bv: -0.04 },
  { ra: 18.29, dec: -36.76, mag: 3.11, bv: 0.18 },
  { ra: 19.16, dec: -21.02, mag: 3.32, bv: 0.77 },
  { ra: 19.51, dec: -40.62, mag: 3.77, bv: 0.03 },
  { ra: 19.77, dec: -15.95, mag: 3.77, bv: 0.33 },
  { ra: 20.19, dec: -12.51, mag: 3.27, bv: 0.9 },
  { ra: 20.63, dec: -47.29, mag: 3.49, bv: 0.08 },
  { ra: 21.07, dec: -27.93, mag: 3.77, bv: 0.0 },
  { ra: 21.44, dec: -22.41, mag: 3.27, bv: -0.01 },
  { ra: 21.9, dec: -32.35, mag: 3.69, bv: 0.75 },
  { ra: 22.18, dec: 6.2, mag: 3.27, bv: 0.57 },
  { ra: 22.49, dec: -4.23, mag: 3.68, bv: 0.87 },
  { ra: 22.88, dec: -43.5, mag: 3.86, bv: 0.4 },
  { ra: 23.06, dec: 25.35, mag: 3.41, bv: 0.02 },
  { ra: 23.66, dec: -20.1, mag: 3.7, bv: 0.97 },
];

export interface ConstellationData {
  name: string;
  abbr: string;
  lines: [string, string][];
}

export const CONSTELLATIONS: ConstellationData[] = [
  {
    name: "Orion",
    abbr: "Ori",
    lines: [
      ["Betelgeuse", "Bellatrix"],
      ["Betelgeuse", "Alnilam"],
      ["Bellatrix", "Mintaka"],
      ["Alnilam", "Alnitak"],
      ["Alnilam", "Mintaka"],
      ["Alnitak", "Saiph"],
      ["Mintaka", "Rigel"],
      ["Rigel", "Saiph"],
    ],
  },
  {
    name: "Ursa Major",
    abbr: "UMa",
    lines: [
      ["Dubhe", "Merak"],
      ["Merak", "Phecda"],
      ["Phecda", "Megrez"],
      ["Megrez", "Alioth"],
      ["Alioth", "Mizar"],
      ["Mizar", "Alkaid"],
      ["Megrez", "Dubhe"],
    ],
  },
  {
    name: "Ursa Minor",
    abbr: "UMi",
    lines: [
      ["Polaris", "Kochab"],
      ["Kochab", "Pherkad"],
    ],
  },
  {
    name: "Cassiopeia",
    abbr: "Cas",
    lines: [
      ["Schedar", "Caph"],
      ["Schedar", "Navi"],
      ["Navi", "Ruchbah"],
    ],
  },
  {
    name: "Cygnus",
    abbr: "Cyg",
    lines: [
      ["Deneb", "Sadr"],
      ["Sadr", "Albireo"],
      ["Sadr", "Gienah Cyg"],
    ],
  },
  {
    name: "Leo",
    abbr: "Leo",
    lines: [
      ["Regulus", "Algieba"],
      ["Algieba", "Zosma"],
      ["Zosma", "Denebola"],
      ["Regulus", "Denebola"],
    ],
  },
  {
    name: "Scorpius",
    abbr: "Sco",
    lines: [
      ["Antares", "Dschubba"],
      ["Antares", "Shaula"],
      ["Shaula", "Lesath"],
    ],
  },
  {
    name: "Gemini",
    abbr: "Gem",
    lines: [
      ["Castor", "Pollux"],
      ["Castor", "Mebsuta"],
      ["Pollux", "Wasat"],
      ["Mebsuta", "Tejat"],
    ],
  },
  {
    name: "Taurus",
    abbr: "Tau",
    lines: [
      ["Aldebaran", "Elnath"],
      ["Aldebaran", "Alcyone"],
    ],
  },
  {
    name: "Canis Major",
    abbr: "CMa",
    lines: [
      ["Sirius", "Mirzam"],
      ["Sirius", "Adhara"],
      ["Sirius", "Wezen"],
      ["Adhara", "Wezen"],
      ["Wezen", "Aludra"],
    ],
  },
  {
    name: "Canis Minor",
    abbr: "CMi",
    lines: [["Procyon", "Gomeisa"]],
  },
  {
    name: "Lyra",
    abbr: "Lyr",
    lines: [
      ["Vega", "Sheliak"],
      ["Vega", "Sulafat"],
      ["Sheliak", "Sulafat"],
    ],
  },
  {
    name: "Aquila",
    abbr: "Aql",
    lines: [
      ["Altair", "Tarazed"],
      ["Altair", "Deneb el Okab"],
    ],
  },
  {
    name: "Pegasus",
    abbr: "Peg",
    lines: [
      ["Markab", "Scheat"],
      ["Scheat", "Alpheratz"],
      ["Alpheratz", "Algenib"],
      ["Algenib", "Markab"],
      ["Scheat", "Matar"],
      ["Markab", "Enif"],
    ],
  },
  {
    name: "Andromeda",
    abbr: "And",
    lines: [
      ["Alpheratz", "Mirach"],
      ["Mirach", "Almach"],
    ],
  },
  {
    name: "Sagittarius",
    abbr: "Sgr",
    lines: [
      ["Kaus Australis", "Kaus Media"],
      ["Kaus Media", "Kaus Borealis"],
      ["Kaus Australis", "Ascella"],
      ["Ascella", "Nunki"],
      ["Nunki", "Kaus Borealis"],
      ["Alnasl", "Kaus Media"],
    ],
  },
  {
    name: "Crux",
    abbr: "Cru",
    lines: [
      ["Acrux", "Gacrux"],
      ["Mimosa", "Imai"],
    ],
  },
  {
    name: "Centaurus",
    abbr: "Cen",
    lines: [
      ["Rigil Kent", "Hadar"],
      ["Hadar", "Menkent"],
    ],
  },
  {
    name: "Corvus",
    abbr: "Crv",
    lines: [
      ["Gienah Corvi", "Kraz"],
      ["Kraz", "Algorab"],
      ["Algorab", "Minkar"],
      ["Minkar", "Gienah Corvi"],
    ],
  },
  {
    name: "Aries",
    abbr: "Ari",
    lines: [["Hamal", "Sheratan"]],
  },
  {
    name: "Virgo",
    abbr: "Vir",
    lines: [
      ["Spica", "Porrima"],
      ["Porrima", "Vindemiatrix"],
      ["Porrima", "Denebola"],
    ],
  },
  {
    name: "Boötes",
    abbr: "Boo",
    lines: [
      ["Arcturus", "Izar"],
      ["Arcturus", "Muphrid"],
    ],
  },
  {
    name: "Libra",
    abbr: "Lib",
    lines: [["Zubenelgenubi", "Zubeneschamali"]],
  },
  {
    name: "Perseus",
    abbr: "Per",
    lines: [
      ["Mirfak", "Algol"],
      ["Mirfak", "Atik"],
    ],
  },
  {
    name: "Auriga",
    abbr: "Aur",
    lines: [
      ["Capella", "Menkalinan"],
      ["Capella", "Hassaleh"],
      ["Menkalinan", "Mahasim"],
      ["Capella", "Elnath"],
    ],
  },
  {
    name: "Hydra",
    abbr: "Hya",
    lines: [["Alphard", "Alphard"]], 
  },
  {
    name: "Hercules",
    abbr: "Her",
    lines: [
      ["Kornephoros", "Zeta Her"],
      ["Zeta Her", "Eta Her"],
      ["Eta Her", "Pi Her"],
      ["Pi Her", "Kornephoros"],
    ],
  },
];

const ra_p = 3.366; 
const dec_p = 0.4735; 
const cp_x = Math.cos(dec_p) * Math.cos(ra_p);
const cp_y = Math.cos(dec_p) * Math.sin(ra_p);
const cp_z = Math.sin(dec_p);

let generated = 0;
while (generated < 3000) {

  const u = Math.random() * 2 - 1;
  const theta = Math.random() * 2 * Math.PI;
  const x = Math.sqrt(1 - u * u) * Math.cos(theta);
  const y = Math.sqrt(1 - u * u) * Math.sin(theta);
  const z = u;

  const sin_b = x * cp_x + y * cp_y + z * cp_z;
  const b_deg = Math.abs((Math.asin(sin_b) * 180) / Math.PI);

  const prob = Math.exp(-b_deg / 15.0) + 0.08;

  if (Math.random() < prob) {
    const dec = (Math.asin(z) * 180) / Math.PI;
    let ra = (Math.atan2(y, x) * 12) / Math.PI;
    if (ra < 0) ra += 24;

    const mag = 4.5 + Math.pow(Math.random(), 2.0) * 2.3;

    const bv = -0.1 + Math.random() * 1.6;

    STARS.push({ ra, dec, mag, bv });
    generated++;
  }
}

export function buildStarNameIndex(): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < STARS.length; i++) {
    if (STARS[i].name) {
      map.set(STARS[i].name!, i);
    }
  }
  return map;
}
