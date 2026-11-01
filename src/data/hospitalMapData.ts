export type HospitalBuilding = {
  id: string;
  name: string;
  floors: string[];
};

export type HospitalDepartment = {
  id: number;
  name: string;
  building: string;
  floor: string;
  room: string;
  category: string;
  icon: string;
};

export type FurnitureKind =
  | "bed"
  | "reception"
  | "consultation"
  | "laboratory"
  | "pharmacy"
  | "waiting"
  | "imaging"
  | "washroom"
  | "office";

export type FloorSpace = {
  id: string;
  label: string;
  roomNumber: string;
  furniture: FurnitureKind;
  x: number;
  z: number;
  department: HospitalDepartment | null;
};

export const hospitalBuildings: HospitalBuilding[] = [
  {
    id: "A",
    name: "Main Block",
    floors: ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"],
  },
  {
    id: "B",
    name: "Emergency Block",
    floors: ["Ground Floor", "1st Floor", "2nd Floor"],
  },
  {
    id: "C",
    name: "Diagnostic Block",
    floors: ["Ground Floor", "1st Floor", "2nd Floor"],
  },
  {
    id: "D",
    name: "Speciality Block",
    floors: ["Ground Floor", "1st Floor", "2nd Floor"],
  },
];

export const hospitalDepartments: HospitalDepartment[] = [
  {
    id: 1,
    name: "Cardiology",
    building: "A",
    floor: "2nd Floor",
    room: "A-205",
    category: "Speciality",
    icon: "❤️",
  },
  {
    id: 2,
    name: "Neurology",
    building: "A",
    floor: "3rd Floor",
    room: "A-305",
    category: "Speciality",
    icon: "🧠",
  },
  {
    id: 3,
    name: "General Medicine",
    building: "A",
    floor: "1st Floor",
    room: "A-105",
    category: "Consultation",
    icon: "🩺",
  },
  {
    id: 4,
    name: "Emergency",
    building: "B",
    floor: "Ground Floor",
    room: "B-001",
    category: "Emergency",
    icon: "🚑",
  },
  {
    id: 5,
    name: "Laboratory",
    building: "C",
    floor: "Ground Floor",
    room: "C-001",
    category: "Diagnostic",
    icon: "🧪",
  },
  {
    id: 6,
    name: "Radiology",
    building: "C",
    floor: "1st Floor",
    room: "C-105",
    category: "Diagnostic",
    icon: "🩻",
  },
  {
    id: 7,
    name: "Pharmacy",
    building: "A",
    floor: "Ground Floor",
    room: "A-010",
    category: "Facility",
    icon: "💊",
  },
  {
    id: 8,
    name: "Billing Counter",
    building: "A",
    floor: "Ground Floor",
    room: "A-015",
    category: "Facility",
    icon: "💳",
  },
  {
    id: 9,
    name: "Orthopaedics",
    building: "D",
    floor: "1st Floor",
    room: "D-105",
    category: "Speciality",
    icon: "🦴",
  },
  {
    id: 10,
    name: "Cafeteria",
    building: "B",
    floor: "Ground Floor",
    room: "B-010",
    category: "Facility",
    icon: "☕",
  },
];

const spacePositions: [number, number][] = [
  [-3.15, -2.15],
  [0, -2.15],
  [3.15, -2.15],
  [-3.15, 2.15],
  [0, 2.15],
  [3.15, 2.15],
];

const defaultSpaces: { label: string; roomNumber: string; furniture: FurnitureKind }[] = [
  { label: "Reception", roomNumber: "R-001", furniture: "reception" },
  { label: "Consultation", roomNumber: "C-101", furniture: "consultation" },
  { label: "Patient room", roomNumber: "P-102", furniture: "bed" },
  { label: "Waiting area", roomNumber: "W-001", furniture: "waiting" },
  { label: "Washroom", roomNumber: "F-001", furniture: "washroom" },
  { label: "Nursing station", roomNumber: "N-001", furniture: "office" },
];

const buildingSpaces: Record<
  string,
  { label: string; roomNumber: string; furniture: FurnitureKind }[]
> = {
  A: defaultSpaces,
  B: [
    { label: "Triage", roomNumber: "T-001", furniture: "reception" },
    { label: "Resuscitation", roomNumber: "ER-002", furniture: "bed" },
    { label: "Emergency consult", roomNumber: "ER-003", furniture: "consultation" },
    { label: "Waiting area", roomNumber: "W-001", furniture: "waiting" },
    { label: "Washroom", roomNumber: "F-001", furniture: "washroom" },
    { label: "Nursing station", roomNumber: "N-001", furniture: "office" },
  ],
  C: [
    { label: "Sample reception", roomNumber: "S-001", furniture: "reception" },
    { label: "Lab preparation", roomNumber: "L-002", furniture: "laboratory" },
    { label: "Imaging suite", roomNumber: "I-003", furniture: "imaging" },
    { label: "Waiting area", roomNumber: "W-001", furniture: "waiting" },
    { label: "Washroom", roomNumber: "F-001", furniture: "washroom" },
    { label: "Staff room", roomNumber: "S-004", furniture: "office" },
  ],
  D: [
    { label: "Speciality consult", roomNumber: "C-101", furniture: "consultation" },
    { label: "Patient room", roomNumber: "P-102", furniture: "bed" },
    { label: "Treatment room", roomNumber: "T-103", furniture: "bed" },
    { label: "Waiting area", roomNumber: "W-001", furniture: "waiting" },
    { label: "Washroom", roomNumber: "F-001", furniture: "washroom" },
    { label: "Nursing station", roomNumber: "N-001", furniture: "office" },
  ],
};

function furnitureForDepartment(department: HospitalDepartment): FurnitureKind {
  const name = department.name.toLowerCase();
  if (name.includes("emergency")) return "bed";
  if (name.includes("laboratory")) return "laboratory";
  if (name.includes("radiology")) return "imaging";
  if (name.includes("pharmacy")) return "pharmacy";
  if (name.includes("billing")) return "reception";
  if (name.includes("cafeteria")) return "waiting";
  if (["cardiology", "neurology"].includes(name)) return "bed";
  return "consultation";
}

export function getFloorSpaces(
  buildingId: string,
  floor: string,
  departments: HospitalDepartment[] = hospitalDepartments,
): FloorSpace[] {
  const departmentRooms = departments.filter(
    (department) =>
      department.building === buildingId && department.floor === floor,
  );
  const sharedSpaces = buildingSpaces[buildingId] ?? defaultSpaces;
  const spaces: FloorSpace[] = departmentRooms.map((department, index) => ({
    id: `department-${department.id}`,
    label: department.name,
    roomNumber: department.room,
    furniture: furnitureForDepartment(department),
    x: spacePositions[index % spacePositions.length][0],
    z: spacePositions[index % spacePositions.length][1],
    department,
  }));
  let sharedIndex = 0;

  spacePositions.forEach(([x, z], index) => {
    if (index < departmentRooms.length) return;
    const shared = sharedSpaces[sharedIndex % sharedSpaces.length];
    sharedIndex += 1;
    spaces.push({
      id: `${buildingId}-${floor}-shared-${index}`,
      ...shared,
      x,
      z,
      department: null,
    });
  });

  return spaces;
}

export function getDepartmentSlot(
  buildingId: string,
  floor: string,
  departmentId: number,
  departments: HospitalDepartment[] = hospitalDepartments,
): [number, number] | null {
  const space = getFloorSpaces(buildingId, floor, departments).find(
    (item) => item.department?.id === departmentId,
  );
  return space ? [space.x, space.z] : null;
}
