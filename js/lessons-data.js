/*
 * Built-in lesson library. Text fields are trusted, author-written HTML
 * (they may contain <sup>, <strong>, etc.) and are rendered as-is.
 *
 * Block types inside a section's `body`:
 *   'plain string'        -> paragraph
 *   { formula: '...' }    -> highlighted formula
 *   { list: ['...'] }     -> bullet list
 */
window.PX_LESSONS = [
  // ------------------------------------------------------------------ Math
  {
    id: 'math-pythagoras',
    subject: 'Math',
    title: 'The Pythagorean Theorem',
    summary: 'Find a missing side of any right-angled triangle.',
    minutes: 6,
    sections: [
      {
        heading: 'What it says',
        body: [
          'In a right-angled triangle, the two shorter sides are called <strong>a</strong> and <strong>b</strong>. The longest side, opposite the right angle, is the <strong>hypotenuse c</strong>.',
          { formula: 'a<sup>2</sup> + b<sup>2</sup> = c<sup>2</sup>' },
          'The area of the square on the hypotenuse equals the sum of the areas of the squares on the other two sides.',
        ],
      },
      {
        heading: 'Worked example',
        body: [
          'A ladder leans against a wall. Its foot is 3 m from the wall and it reaches 4 m up. How long is the ladder?',
          { list: ['a = 3, b = 4', 'c<sup>2</sup> = 3<sup>2</sup> + 4<sup>2</sup> = 9 + 16 = 25', 'c = √25 = <strong>5 m</strong>'] },
        ],
      },
      {
        heading: 'Finding a shorter side',
        body: [
          'Rearrange the formula: a<sup>2</sup> = c<sup>2</sup> − b<sup>2</sup>. If c = 13 and b = 12, then a<sup>2</sup> = 169 − 144 = 25, so a = 5.',
        ],
      },
    ],
    keyPoints: [
      'Only works for right-angled triangles.',
      'c is always the longest side, opposite the right angle.',
      'Square, add, then take the square root to find c.',
    ],
    quiz: [
      { q: 'A right triangle has legs 6 and 8. What is the hypotenuse?', options: ['10', '14', '48', '100'], answer: 0, explain: '6² + 8² = 36 + 64 = 100, and √100 = 10.' },
      { q: 'Which side is the hypotenuse?', options: ['The shortest side', 'The side opposite the right angle', 'Any side', 'The base'], answer: 1, explain: 'The hypotenuse is always opposite the right angle and is the longest side.' },
    ],
  },
  {
    id: 'math-pi-circles',
    subject: 'Math',
    title: 'Pi (π) and Circles',
    summary: 'Circumference, area and why π ≈ 3.14159.',
    minutes: 5,
    sections: [
      {
        heading: 'What is π?',
        body: [
          'π (pi) is the ratio of any circle\'s circumference to its diameter. It is the same for every circle: about <strong>3.14159</strong>, often rounded to 3.14 or 22/7.',
          'π is an <strong>irrational number</strong> — its decimal digits go on forever without repeating.',
        ],
      },
      {
        heading: 'Key formulas',
        body: [
          { formula: 'Circumference = 2πr = πd' },
          { formula: 'Area = πr<sup>2</sup>' },
          'Here r is the radius (centre to edge) and d is the diameter (d = 2r).',
        ],
      },
      {
        heading: 'Worked example',
        body: [
          'A circular garden has radius 7 m. Using π ≈ 22/7:',
          { list: ['Circumference = 2 × 22/7 × 7 = <strong>44 m</strong>', 'Area = 22/7 × 7 × 7 = <strong>154 m²</strong>'] },
        ],
      },
    ],
    keyPoints: ['π ≈ 3.14159 and never ends.', 'Circumference = 2πr.', 'Area = πr².'],
    quiz: [
      { q: 'What is the area of a circle with radius 10 (use π ≈ 3.14)?', options: ['31.4', '62.8', '314', '100'], answer: 2, explain: 'Area = πr² = 3.14 × 100 = 314.' },
      { q: 'π is…', options: ['Exactly 3.14', 'A rational number', 'An irrational number', 'Equal to 22/7 exactly'], answer: 2, explain: '3.14 and 22/7 are only approximations; π is irrational.' },
    ],
  },
  {
    id: 'math-linear-equations',
    subject: 'Math',
    title: 'Solving Linear Equations',
    summary: 'Balance both sides to find the unknown.',
    minutes: 6,
    sections: [
      {
        heading: 'The balance idea',
        body: [
          'An equation is like a balanced scale. Whatever you do to one side, you must do to the other so it stays balanced.',
          'Goal: get the variable (like x) alone on one side.',
        ],
      },
      {
        heading: 'Step by step',
        body: [
          'Solve 3x + 5 = 20:',
          { list: ['Subtract 5 from both sides: 3x = 15', 'Divide both sides by 3: x = 5', 'Check: 3(5) + 5 = 20 ✔'] },
        ],
      },
      {
        heading: 'Variables on both sides',
        body: [
          'Solve 5x − 4 = 2x + 8: subtract 2x from both sides (3x − 4 = 8), add 4 (3x = 12), divide by 3 (x = 4).',
        ],
      },
    ],
    keyPoints: ['Undo operations in reverse order.', 'Do the same thing to both sides.', 'Always check by substituting back.'],
    quiz: [
      { q: 'Solve 2x − 7 = 9.', options: ['x = 1', 'x = 8', 'x = 16', 'x = 4'], answer: 1, explain: 'Add 7: 2x = 16, divide by 2: x = 8.' },
      { q: 'What is the first step to solve x/4 + 2 = 5?', options: ['Multiply by 4', 'Subtract 2 from both sides', 'Divide by 2', 'Add 4'], answer: 1, explain: 'Undo the +2 first: x/4 = 3, then multiply by 4 to get x = 12.' },
    ],
  },

  // --------------------------------------------------------------- Physics
  {
    id: 'physics-newton-laws',
    subject: 'Physics',
    title: "Newton's Three Laws of Motion",
    summary: 'Inertia, F = ma, and action–reaction.',
    minutes: 7,
    sections: [
      {
        heading: 'First law — inertia',
        body: ['An object stays at rest, or keeps moving at a constant velocity, unless an unbalanced force acts on it. That is why passengers lurch forward when a bus brakes suddenly.'],
      },
      {
        heading: 'Second law — F = ma',
        body: [
          { formula: 'F = m × a' },
          'The net force on an object equals its mass times its acceleration. Force is measured in newtons (N), mass in kilograms (kg) and acceleration in m/s².',
          'Example: pushing a 10 kg trolley so it accelerates at 2 m/s² needs F = 10 × 2 = <strong>20 N</strong>.',
        ],
      },
      {
        heading: 'Third law — action and reaction',
        body: ['For every action there is an equal and opposite reaction. A rocket pushes gas down, and the gas pushes the rocket up.'],
      },
    ],
    keyPoints: ['No net force → no change in motion.', 'F = ma links force, mass and acceleration.', 'Forces always come in equal, opposite pairs acting on different objects.'],
    quiz: [
      { q: 'What force is needed to accelerate a 5 kg box at 3 m/s²?', options: ['8 N', '15 N', '1.67 N', '2 N'], answer: 1, explain: 'F = ma = 5 × 3 = 15 N.' },
      { q: 'A seatbelt protects you mainly because of…', options: ['The third law', 'Inertia (first law)', 'Gravity', 'Friction only'], answer: 1, explain: 'Your body tends to keep moving forward when the car stops — that is inertia.' },
    ],
  },
  {
    id: 'physics-motion',
    subject: 'Physics',
    title: 'Speed, Velocity and Acceleration',
    summary: 'Describe how fast things move and how that changes.',
    minutes: 6,
    sections: [
      {
        heading: 'Speed vs velocity',
        body: [
          { formula: 'speed = distance ÷ time' },
          '<strong>Speed</strong> only tells you how fast. <strong>Velocity</strong> is speed in a given direction, e.g. 20 m/s north.',
        ],
      },
      {
        heading: 'Acceleration',
        body: [
          { formula: 'a = (v − u) ÷ t' },
          'u is the starting velocity, v the final velocity and t the time taken. A car going from 0 to 20 m/s in 5 s has a = 20 ÷ 5 = <strong>4 m/s²</strong>.',
          'Negative acceleration (slowing down) is called deceleration.',
        ],
      },
    ],
    keyPoints: ['Speed is a scalar; velocity is a vector.', 'Acceleration is the rate of change of velocity.', 'Units: m/s for speed, m/s² for acceleration.'],
    quiz: [
      { q: 'A cyclist travels 300 m in 60 s. What is their average speed?', options: ['5 m/s', '18 000 m/s', '0.2 m/s', '360 m/s'], answer: 0, explain: 'speed = 300 ÷ 60 = 5 m/s.' },
      { q: 'Which quantity includes direction?', options: ['Speed', 'Distance', 'Velocity', 'Time'], answer: 2, explain: 'Velocity is a vector — it has both size and direction.' },
    ],
  },
  {
    id: 'physics-ohms-law',
    subject: 'Physics',
    title: "Electric Circuits and Ohm's Law",
    summary: 'How voltage, current and resistance relate.',
    minutes: 6,
    sections: [
      {
        heading: 'Three key quantities',
        body: [{ list: ['<strong>Voltage (V)</strong> — the push that drives charge, in volts.', '<strong>Current (I)</strong> — the flow of charge, in amperes (A).', '<strong>Resistance (R)</strong> — how much a component opposes current, in ohms (Ω).'] }],
      },
      {
        heading: "Ohm's law",
        body: [
          { formula: 'V = I × R' },
          'A 12 V battery connected to a 4 Ω resistor gives a current of I = V ÷ R = 12 ÷ 4 = <strong>3 A</strong>.',
        ],
      },
      {
        heading: 'Series and parallel',
        body: ['In <strong>series</strong>, resistances add up: R = R₁ + R₂. In <strong>parallel</strong>, the total resistance is less than the smallest branch, because current has more than one path.'],
      },
    ],
    keyPoints: ['V = IR.', 'Series resistors add directly.', 'Parallel paths lower total resistance.'],
    quiz: [
      { q: 'What current flows through a 10 Ω resistor across 5 V?', options: ['50 A', '2 A', '0.5 A', '15 A'], answer: 2, explain: 'I = V ÷ R = 5 ÷ 10 = 0.5 A.' },
      { q: 'Two 3 Ω resistors in series have a total resistance of…', options: ['1.5 Ω', '3 Ω', '6 Ω', '9 Ω'], answer: 2, explain: 'In series, resistances add: 3 + 3 = 6 Ω.' },
    ],
  },

  // ------------------------------------------------------------- Chemistry
  {
    id: 'chem-atoms',
    subject: 'Chemistry',
    title: 'Atoms and Atomic Structure',
    summary: 'Protons, neutrons, electrons and the atomic number.',
    minutes: 6,
    sections: [
      {
        heading: 'Inside an atom',
        body: [
          { list: ['<strong>Protons</strong> — positive charge, in the nucleus.', '<strong>Neutrons</strong> — no charge, in the nucleus.', '<strong>Electrons</strong> — negative charge, in shells around the nucleus.'] },
          'Atoms are neutral overall because they have equal numbers of protons and electrons.',
        ],
      },
      {
        heading: 'Atomic number and mass number',
        body: [
          'The <strong>atomic number</strong> is the number of protons — it defines the element. The <strong>mass number</strong> is protons + neutrons.',
          'Carbon-12 has 6 protons, 6 neutrons and 6 electrons.',
        ],
      },
      {
        heading: 'Isotopes',
        body: ['Isotopes are atoms of the same element with different numbers of neutrons, e.g. carbon-12 and carbon-14.'],
      },
    ],
    keyPoints: ['Atomic number = protons.', 'Mass number = protons + neutrons.', 'Isotopes differ only in neutron count.'],
    quiz: [
      { q: 'Sodium has atomic number 11 and mass number 23. How many neutrons?', options: ['11', '12', '23', '34'], answer: 1, explain: 'Neutrons = mass number − atomic number = 23 − 11 = 12.' },
      { q: 'Which particle has a negative charge?', options: ['Proton', 'Neutron', 'Electron', 'Nucleus'], answer: 2, explain: 'Electrons carry a negative charge.' },
    ],
  },
  {
    id: 'chem-ph',
    subject: 'Chemistry',
    title: 'Acids, Bases and the pH Scale',
    summary: 'Measure how acidic or alkaline a solution is.',
    minutes: 5,
    sections: [
      {
        heading: 'The pH scale',
        body: [
          'pH runs from about 0 to 14. <strong>Below 7</strong> is acidic, <strong>7</strong> is neutral, and <strong>above 7</strong> is basic (alkaline).',
          { list: ['Lemon juice ≈ pH 2 (acidic)', 'Pure water = pH 7 (neutral)', 'Soap ≈ pH 10 (basic)'] },
        ],
      },
      {
        heading: 'Neutralisation',
        body: [
          { formula: 'acid + base → salt + water' },
          'For example, hydrochloric acid + sodium hydroxide → sodium chloride + water. Antacid tablets neutralise excess stomach acid this way.',
        ],
      },
    ],
    keyPoints: ['pH < 7 acidic, 7 neutral, > 7 basic.', 'Each pH step is a ten-fold change in acidity.', 'Acid + base → salt + water.'],
    quiz: [
      { q: 'A solution has pH 12. It is…', options: ['Strongly acidic', 'Neutral', 'Strongly basic', 'Weakly acidic'], answer: 2, explain: 'pH values well above 7 are strongly basic (alkaline).' },
      { q: 'What are the products of neutralisation?', options: ['Salt and water', 'Acid and oxygen', 'Hydrogen only', 'Carbon dioxide only'], answer: 0, explain: 'An acid and a base react to form a salt and water.' },
    ],
  },
  {
    id: 'chem-balancing',
    subject: 'Chemistry',
    title: 'Balancing Chemical Equations',
    summary: 'Atoms are never created or destroyed in a reaction.',
    minutes: 7,
    sections: [
      {
        heading: 'Why balance?',
        body: ['The <strong>law of conservation of mass</strong> says atoms are rearranged, not created or destroyed. So each side of an equation must have the same number of each type of atom.'],
      },
      {
        heading: 'Example',
        body: [
          'Unbalanced: H₂ + O₂ → H₂O (2 O on the left, 1 O on the right).',
          { list: ['Put 2 in front of H₂O: H₂ + O₂ → 2H₂O (now 4 H on the right)', 'Put 2 in front of H₂: 2H₂ + O₂ → 2H₂O', 'Check: 4 H and 2 O on each side ✔'] },
          { formula: '2H₂ + O₂ → 2H₂O' },
        ],
      },
      {
        heading: 'Rules',
        body: ['Only change the big numbers in front (coefficients). Never change the small subscripts — that would change the substance itself.'],
      },
    ],
    keyPoints: ['Count atoms of each element on both sides.', 'Adjust coefficients, never subscripts.', 'Mass is conserved.'],
    quiz: [
      { q: 'Which is balanced?', options: ['N₂ + H₂ → NH₃', 'N₂ + 3H₂ → 2NH₃', 'N₂ + 2H₂ → NH₃', '2N₂ + H₂ → 2NH₃'], answer: 1, explain: 'N₂ + 3H₂ → 2NH₃ has 2 N and 6 H on both sides.' },
      { q: 'When balancing, you may change…', options: ['Subscripts', 'Coefficients', 'Element symbols', 'Both sides freely'], answer: 1, explain: 'Only coefficients change; subscripts define the substance.' },
    ],
  },

  // --------------------------------------------------------------- Biology
  {
    id: 'bio-cell',
    subject: 'Biology',
    title: 'The Cell — Unit of Life',
    summary: 'Organelles and the difference between plant and animal cells.',
    minutes: 6,
    sections: [
      {
        heading: 'Main parts of a cell',
        body: [{ list: ['<strong>Nucleus</strong> — holds DNA and controls the cell.', '<strong>Cell membrane</strong> — controls what enters and leaves.', '<strong>Cytoplasm</strong> — jelly where most reactions happen.', '<strong>Mitochondria</strong> — release energy through respiration.', '<strong>Ribosomes</strong> — make proteins.'] }],
      },
      {
        heading: 'Plant cells have extra parts',
        body: [{ list: ['<strong>Cell wall</strong> made of cellulose for support.', '<strong>Chloroplasts</strong> for photosynthesis.', 'A large permanent <strong>vacuole</strong> filled with cell sap.'] }],
      },
    ],
    keyPoints: ['All living things are made of cells.', 'Mitochondria release energy.', 'Only plant cells have a cell wall, chloroplasts and a large vacuole.'],
    quiz: [
      { q: 'Which organelle is found in plant cells but not animal cells?', options: ['Nucleus', 'Mitochondria', 'Chloroplast', 'Cell membrane'], answer: 2, explain: 'Chloroplasts carry out photosynthesis and are only in plant (and algal) cells.' },
      { q: 'Where is most of the cell\'s energy released?', options: ['Ribosomes', 'Mitochondria', 'Vacuole', 'Nucleus'], answer: 1, explain: 'Mitochondria are the site of aerobic respiration.' },
    ],
  },
  {
    id: 'bio-photosynthesis',
    subject: 'Biology',
    title: 'Photosynthesis',
    summary: 'How plants turn light into food.',
    minutes: 5,
    sections: [
      {
        heading: 'The equation',
        body: [
          { formula: 'carbon dioxide + water → glucose + oxygen' },
          { formula: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂' },
          'This happens in chloroplasts, using light energy absorbed by the green pigment <strong>chlorophyll</strong>.',
        ],
      },
      {
        heading: 'What affects the rate?',
        body: [{ list: ['Light intensity', 'Carbon dioxide concentration', 'Temperature (enzymes work best in a certain range)'] }],
      },
    ],
    keyPoints: ['Needs light, CO₂ and water.', 'Produces glucose and oxygen.', 'Takes place in chloroplasts using chlorophyll.'],
    quiz: [
      { q: 'Which gas is released during photosynthesis?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], answer: 2, explain: 'Oxygen is released as a by-product.' },
      { q: 'Chlorophyll is found in the…', options: ['Mitochondria', 'Chloroplasts', 'Nucleus', 'Cell wall'], answer: 1, explain: 'Chlorophyll is in chloroplasts, where it absorbs light.' },
    ],
  },
  {
    id: 'bio-dna',
    subject: 'Biology',
    title: 'DNA, Genes and Chromosomes',
    summary: 'The instructions that make every living thing.',
    minutes: 6,
    sections: [
      {
        heading: 'From DNA to chromosomes',
        body: [
          '<strong>DNA</strong> is a long molecule shaped like a twisted ladder — a double helix. A <strong>gene</strong> is a section of DNA that codes for one protein.',
          'DNA is packed into <strong>chromosomes</strong>. Human body cells have 46 chromosomes (23 pairs).',
        ],
      },
      {
        heading: 'The base pairs',
        body: [
          'The rungs of the ladder are made of four bases: A, T, C and G. They always pair the same way:',
          { formula: 'A — T      C — G' },
        ],
      },
    ],
    keyPoints: ['DNA is a double helix.', 'Genes code for proteins.', 'A pairs with T, C pairs with G.'],
    quiz: [
      { q: 'Which base pairs with Adenine (A)?', options: ['Cytosine', 'Guanine', 'Thymine', 'Adenine'], answer: 2, explain: 'A always pairs with T.' },
      { q: 'How many chromosomes are in a typical human body cell?', options: ['23', '46', '92', '12'], answer: 1, explain: 'Human body cells have 23 pairs = 46 chromosomes.' },
    ],
  },
];
