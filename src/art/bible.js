// Style Bible and Character Bible: the single source of truth for every drawn asset.
// The renderer reads colours and line rules from here, and the QA step checks the
// rendered pixels against the same values, so the look cannot drift.

export const STYLE = {
  name: 'Boni Ligne claire',
  version: 1,
  description: 'Klare, gleichmäßige schwarze Tuschekonturen, flächige Farben ohne Verläufe, aufgeräumte Formen.',
  line: {
    ink: '#16110d',          // warm black, never pure #000
    width: 0.95,             // one line weight for contours and details, in figure units
    join: 'round',
    cap: 'round',
  },
  shading: {
    mode: 'flat',            // Ligne claire: flat colour; at most one cast shadow on the ground
    groundShadow: 'rgba(22,17,13,0.22)',
  },
  light: 'Gleichmäßiges Tageslicht von links oben, keine Glanzlichter außer in den Augen.',
  perspective: 'Seitliche Schrägansicht wie im Spiel (Projektion x 16, y 8, z 14 px je Meter); Figuren im Profil, Halbprofil oder frontal.',
  proportions: 'Figuren gut 3 Kopfhöhen; Kopf rund, Körper kompakt, Hände und Skates leicht vergrößert.',
  // Every colour an asset may use (ink blends at anti-aliased edges are allowed by QA).
  palette: {
    ink: '#16110d', paper: '#f4ecd8',
    fur: '#8a4b22', furDark: '#5c3015', muzzle: '#e0a37c', snout: '#f0a8a0', pink: '#f29a9a', tusk: '#fff6e4',
    eyeWhite: '#ffffff', pupil: '#2a160c',
    jersey: '#1f5a33', cream: '#f3e3b5', orange: '#d2642a', pants: '#2b2018',
    helmet: '#1d4a2c', glove: '#1f5a33', boot: '#25222c', frame: '#b8bfcc', wheel: '#e8763a',
    wood: '#c99a5b', tape: '#1c1c22',
    asphalt: '#6b6e72', asphaltLight: '#8c8e8f', line: '#eeece4', board: '#f2f0ea', boardTrim: '#1f5a33',
    goalRed: '#d8303c', net: '#ffffff', fence: '#5f6b62', leaf: '#7fae4a', leafDark: '#4f7d32', trunk: '#6b5442',
    wall: '#efe6d3', wallShade: '#d8ccb3', roof: '#b8502e', roofDark: '#8e3a22', window: '#a9c4cf', sky: '#bfe0f0',
    car: '#c63b3b', carGrey: '#8a9099', bench: '#8a5a34',
    // depth tones: the far side of a figure is one step darker (no shading, just depth)
    jerseyFar: '#143d22', creamFar: '#b8a983', orangeFar: '#a8481a', bootFar: '#141219', wheelFar: '#b0541f',
    helmetDark: '#10301b', muzzleDark: '#c4835f', snoutDark: '#d98479',
    nostril: '#5a2a20', mouth: '#7a2a2a', tapeLine: '#4a4a55', star: '#ffd84a', trimFar: '#8d8a80',
  },
  rules: [
    'Eine Linienstärke für alles; keine An- und Abschwellungen.',
    'Keine Verläufe, keine weichen Schatten auf Figuren; nur ein flacher Bodenschatten.',
    'Jede Fläche ist geschlossen umrandet.',
    'Farben nur aus der Palette.',
    'Hintergründe detailreich, aber mit größeren ruhigen Flächen als die Figuren.',
  ],
};

export const CHARACTERS = {
  bonny: {
    name: 'Bonny',
    role: 'Stürmer, Maskottchen der Boni Borstentiere',
    species: 'Wildschwein (Eilenriede)',
    number: 61,
    nameplate: 'BONI',
    traits: ['neugierig', 'mutig', 'tollpatschig', 'gibt nie auf'],
    look: [
      'kastanienbraunes Fell, dunkler Borstenschopf, der oben aus dem Helm schaut',
      'spitze Ohren durch Aussparungen im grünen Helm',
      'langer Rüssel mit rosa Scheibe und zwei Nasenlöchern, zwei kleine weiße Hauer',
      'große runde Augen, kräftige Brauen',
      'dünnes Schwänzchen mit Quaste',
    ],
    kit: {
      jersey: 'dunkelgrün, Saum und Ärmel Creme–Orange–Creme, Schnürkragen, Wappen auf der Brust',
      back: 'BONI über der 61, 61 auch auf beiden Ärmeln',
      pants: 'dunkelbraun', socks: 'grün mit Creme-Orange-Creme-Ringen',
      helmet: 'dunkelgrün, offen, Ohr-Aussparungen', gloves: 'grün mit oranger Stulpe',
      skates: 'schwarz, Alu-Schiene, vier orange Rollen', stick: 'Holz, schwarzes Tape am Blatt',
    },
    colors: {
      fur: 'fur', furDark: 'furDark', muzzle: 'muzzle', snout: 'snout', jersey: 'jersey', helmet: 'helmet',
    },
    heightUnits: 72,          // ground to helmet tuft
    references: ['front', 'side', 'back'],
    poses: ['idle', 'skate', 'shot', 'cheer'],
  },
};

/** Resolve a palette name to a colour. */
export const col = (name) => STYLE.palette[name] ?? name;
