/* =============================================================
   CONTENT — EDIT HERE
   =============================================================
   Every entry on the site is one object in the ORGS array below,
   in order (most recent first). The panel, badge, map, coordinate
   label, and navigation dot are all generated from the object —
   change a field in place, or copy a whole { ... } block to add a
   new entry. Nothing else needs to change.

   Fields:
     id       unique slug (used for anchors)
     no       display numeral on the badge ("01" … "05")
     org      organization name (badge + heading)
     role     role / degree line
     dates    date range shown in the header line
     loc      short location shown in the header line
     place    full place name drawn on the map
     coords   [latitude, longitude] — drives the procedural map
     videoId  YouTube id; omit (or null) for a placeholder frame
     videoLabel  caption under the video (source / type)
     summary  one-paragraph overview
     threads  [{ name, bullets:[…] }] — work threads with bullets
     tags     short skill chips

   Content & security policy (applies to all edits):
   Public copy stays at resume-level, unclassified detail. Only
   "Dragonfly" is named among APL programs — every other program is
   a neutral work-thread title. Specific airframes, radar vendors,
   boards, and ground-control tools stay generalized. New APL text
   is draft until it passes the same check.
   ============================================================= */

const ORGS = [
  {
    id: "apl",
    no: "01",
    org: "Johns Hopkins APL",
    role: "ISRT Software & DevOps Engineer",
    dates: "2022–Present",
    loc: "Laurel, MD",
    place: "Laurel, Maryland",
    coords: [39.168, -76.897],
    videoId: "i7kR2PvNURM",
    videoLabel: "Dragonfly rotorcraft testing — official APL footage",
    summary:
      "Software and systems engineering across flight software, RF & radar simulation, and uncrewed-systems autonomy at the Johns Hopkins University Applied Physics Laboratory. Concurrently pursuing an M.S. in Autonomous Systems & Robotics at Johns Hopkins (4.0 GPA, expected 2028). Recognized with a 2025 Resilience Award at APL's annual awards.",
    threads: [
      {
        name: "Dragonfly — flight-software acceptance",
        bullets: [
          "Constructing software acceptance testing for the Dragonfly mission on the Independent Acceptance Team, using software-in-the-loop (SITL) environments to verify critical flight-software functionality — file commanding, multiple-file commanding, and time-tagged flight commands.",
          "Building novel Python test utilities that expose flight-software bugs, escalating flaws to inform ongoing development."
        ]
      },
      {
        name: "RF & radar simulation",
        bullets: [
          "Programming scenario features for an RF scene-generation simulation, modeling synthetic-aperture radar (SAR) across varied parameters.",
          "Architecting SAR analysis with higher-fidelity terrain and clutter models, enabling more realistic maritime scenarios for sponsor systems.",
          "Implemented CI/CD infrastructure from scratch for a multi-platform ray-tracing renderer and camera emulator, with pipelines spanning Windows, Ubuntu, and RHEL across GCC, Python, and MATLAB toolchains."
        ]
      },
      {
        name: "Autonomy & mission systems",
        bullets: [
          "Developed STANAG 4586 Level-of-Interoperability-3 UAV mission-control capability by reverse-engineering a proprietary small-UAV command protocol with Wireshark, delivering a C++ parser integrated into the mission-management messaging architecture to unlock remote gimbal control.",
          "Prototyped a multi-threaded network parser achieving a 33% reduction in UDP packet-processing latency for UAV telemetry streams, enabling real-time camera control (zoom, field of view, operator settings).",
          "Constructed an interface to commercial maritime radar systems, translating vendor protocols into internal data structures for real-time radar visualization and filter control.",
          "Engineered deployment onto an ARM-based edge-compute module — standardized the module-flashing workflow, created a framework for ARM builds, and merged in ARM-compatible software."
        ]
      },
      {
        name: "Autonomy R&D — team lead",
        bullets: [
          "Led a cross-functional team of five engineers from four sectors, managing a $63K budget and coordinating with subject-matter experts across APL to define a problem and solution scope.",
          "Formulated a novel COTS approach to manufacturing a two-way shape-memory-alloy ultra-wideband antenna, successfully employing drawn Nitinol wire in place of powder Nitinol at over 10× the cost — operating at 100–400 MHz and 6 GHz for potential air-traffic-control applications during solar flares.",
          "Built a UAV–USV coordination system with an open-source ground-control station and flight controller, leading electromechanical integration of a prototype scaled-down USV and testing coordination in HITL/SITL setups."
        ]
      }
    ],
    tags: ["Python", "C++", "SAR / RF", "STANAG 4586", "CI/CD", "SITL / HITL"]
  },

  {
    id: "intel",
    no: "02",
    org: "Intel Corporation",
    role: "Hardware Systems Engineer · Product Owner",
    dates: "2020–2022",
    loc: "Hillsboro, OR",
    place: "Hillsboro, Oregon",
    coords: [45.523, -122.989],
    videoId: "NvBB2T8NHzY",
    videoLabel: "Intel's automated superhighway — official Intel footage",
    summary:
      "Owned the robotic overhead-hoist-vehicle system inside Intel's D1 development fab — a fleet of automated vehicles moving wafers between tools around the clock.",
    threads: [
      {
        name: "Automated material handling systems",
        bullets: [
          "Led the sustaining team for the robotic overhead-hoist-vehicle (OHV) system, improving mean cycles between incident to 200% of the supplier's product specification through metrics and automation scripts in Python and SQL.",
          "Directed operations — construction, preventative maintenance, continuous improvement, and projects — for over 500 OHV vehicles completing roughly 6,000 inter-fab transfers per hour.",
          "Troubleshot on-call escalations for Intel's D1 material-handling system on a weekly rotation: the material control system, automated stocker robots, and three types of automated vehicles.",
          "Co-authored a peer-reviewed paper on system-of-systems architecture for automated material handling in semiconductor manufacturing (IEEE ASMC 2021)."
        ]
      }
    ],
    tags: ["Python", "SQL", "Robotics", "Semiconductor", "Systems engineering"]
  },

  {
    id: "ge",
    no: "03",
    org: "GE Global Research",
    role: "Edison Engineering Development Program Intern",
    dates: "Summer 2019",
    loc: "Niskayuna, NY",
    place: "Niskayuna, New York",
    coords: [42.779, -73.849],
    videoId: "_Um9bD3VLLM",
    videoLabel:
      "Representative clip — a GE Research pipe-robotics project; the specific tool-pod work is not public",
    summary:
      "Robotics prototyping with the Robotics and Autonomous Systems group — turning off-the-shelf components into working inspection-robot demonstrations.",
    threads: [
      {
        name: "Robotics & autonomous systems",
        bullets: [
          "Engineered robotic design prototypes in SolidWorks and devised the robotic system, in a three-person team, for a pipe-inspection robot tool pod and turbine-blade inspection robot demonstrations.",
          "Built off-the-shelf electromechanical components with basic controls software — Python on Raspberry Pi devices — into new robotic platforms, showing proof-of-concept to internal and external customers."
        ]
      }
    ],
    tags: ["SolidWorks", "Python", "Raspberry Pi", "Prototyping"]
  },

  {
    id: "cmu",
    no: "04",
    org: "Carnegie Mellon University",
    role: "M.S. Mechanical Engineering — Robotics & Controls",
    dates: "2018–2020",
    loc: "Pittsburgh, PA",
    place: "Pittsburgh, Pennsylvania",
    coords: [40.443, -79.943],
    videoId: null,
    videoLabel: null,
    summary:
      "Master of Science in Mechanical Engineering with a concentration in Robotics and Controls, 3.84 GPA — graduate research in micro-UAV sensing alongside hands-on robot design coursework.",
    threads: [
      {
        name: "Graduate research — micro-UAV sensing",
        bullets: [
          "Investigated a MEMS barometric pressure sensor for remote sensing in micro-UAV applications.",
          "Developed data-acquisition techniques in MATLAB and C/C++ with Arduino and Teensy microcontrollers for further study of pressure sensing on micro-UAVs."
        ]
      },
      {
        name: "Robot design & experimentation",
        bullets: [
          "Conceptualized and produced the mechanical design for the structure and flapping mechanisms of an underwater robot using penguin-like propulsion, in a five-person team.",
          "Fabricated, assembled, and tested electromechanical components with ANSYS FEA and SolidWorks while managing the project schedule and integrating the other mechanical design components.",
          "Collaborated on the kinematics and dynamics model used to develop the robot's controller."
        ]
      }
    ],
    tags: ["MATLAB", "C/C++", "Controls", "FEA", "Microcontrollers"]
  },

  {
    id: "richmond",
    no: "05",
    org: "University of Richmond",
    role: "B.S. Physics",
    dates: "2014–2018",
    loc: "Richmond, VA",
    place: "Richmond, Virginia",
    coords: [37.541, -77.434],
    videoId: null,
    videoLabel: null,
    summary:
      "Bachelor of Science in Physics, 3.76 GPA — the first-principles foundation under everything since: electromagnetics behind the RF and antenna work, mechanics behind the robots, and the habit of modeling a system before trusting it.",
    threads: [],
    tags: ["Physics", "Electromagnetics", "Mechanics"]
  }
];

/* Shared profile bits used by the intro and footer. */
const PROFILE = {
  name: "William Moreno",
  tagline: "Autonomous systems · RF & radar · Flight software",
  intro:
    "Software and systems engineer at the Johns Hopkins Applied Physics Laboratory, working across flight-software acceptance for the Dragonfly mission, SAR and RF simulation, and uncrewed-systems autonomy. Before that: robotic material handling at Intel-scale, robotics research at GE, and graduate work at Carnegie Mellon.",
  links: [
    { label: "LinkedIn", href: "https://linkedin.com/in/wjmoreno" },
    { label: "Email", href: "mailto:wjmoreno@alumni.cmu.edu" }
  ]
};
