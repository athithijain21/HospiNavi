import {
  getDepartmentSlot,
  hospitalBuildings,
  hospitalDepartments,
} from "./hospitalMapData";
import type {
  HospitalRouteGraph,
  RouteEdge,
  RouteNode,
} from "./hospitalRouteGraphData";

function nodeIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const nodes: RouteNode[] = [];
const edges: RouteEdge[] = [];

for (const building of hospitalBuildings) {
  for (const [floorIndex, floor] of building.floors.entries()) {
    const corridorId = `demo-${building.id}-${nodeIdPart(floor)}-corridor`;
    const elevatorId = `demo-${building.id}-${nodeIdPart(floor)}-elevator`;
    nodes.push(
      {
        id: corridorId,
        kind: "corridor",
        buildingId: building.id,
        floor,
        label: "Sample central corridor",
        mapPosition: [0, 0.1, 0],
      },
      {
        id: elevatorId,
        kind: "elevator",
        buildingId: building.id,
        floor,
        label: "Sample elevator",
        mapPosition: [-4.7, 0.1, 0],
      },
    );
    edges.push({
      from: corridorId,
      to: elevatorId,
      distanceMetres: 8,
      kind: "corridor",
      accessible: true,
      bidirectional: true,
      label: "SAMPLE-ONLY corridor",
      path: [
        [0, 0.1, 0],
        [-4.7, 0.1, 0],
      ],
    });

    if (floorIndex === 0) {
      const entranceId = `demo-entrance-${building.id}`;
      nodes.push({
        id: entranceId,
        kind: "entrance",
        buildingId: building.id,
        floor,
        label: `Sample entrance · Building ${building.id}`,
        mapPosition: [0, 0.1, 3],
      });
      edges.push({
        from: entranceId,
        to: corridorId,
        distanceMetres: 5,
        kind: "corridor",
        accessible: true,
        bidirectional: true,
        label: "SAMPLE-ONLY entrance passage",
        path: [
          [0, 0.1, 3],
          [0, 0.1, 0],
        ],
      });
    }

    const departments = hospitalDepartments.filter(
      (department) =>
        department.building === building.id && department.floor === floor,
    );
    for (const department of departments) {
      const slot = getDepartmentSlot(building.id, floor, department.id);
      if (!slot) continue;
      const departmentId = `demo-department-${department.id}`;
      const position: [number, number, number] = [slot[0], 0.1, slot[1]];
      nodes.push({
        id: departmentId,
        kind: "department",
        buildingId: building.id,
        floor,
        label: department.name,
        departmentId: department.id,
        mapPosition: position,
      });
      edges.push({
        from: corridorId,
        to: departmentId,
        distanceMetres: Math.max(4, Math.hypot(slot[0], slot[1]) * 2),
        kind: "corridor",
        accessible: true,
        bidirectional: true,
        label: "SAMPLE-ONLY route",
        path: [
          [0, 0.1, 0],
          position,
        ],
      });
    }

    const nextFloor = building.floors[floorIndex + 1];
    if (nextFloor) {
      edges.push({
        from: elevatorId,
        to: `demo-${building.id}-${nodeIdPart(nextFloor)}-elevator`,
        distanceMetres: 12,
        kind: "elevator",
        accessible: true,
        bidirectional: true,
        label: "SAMPLE-ONLY elevator",
      });
    }
  }
}

const mainEntranceId = "demo-entrance-A";
for (const building of hospitalBuildings.filter((item) => item.id !== "A")) {
  edges.push({
    from: mainEntranceId,
    to: `demo-entrance-${building.id}`,
    distanceMetres: 25,
    kind: "building-transition",
    accessible: true,
    bidirectional: true,
    label: "SAMPLE-ONLY campus connection",
  });
}

export const demoRouteGraph: HospitalRouteGraph = { nodes, edges };

export const demoRouteStartNodes = nodes.filter(
  (node) => node.kind === "entrance",
);

export const defaultDemoRouteStartNodeId = mainEntranceId;
