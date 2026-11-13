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
const corridorXs = [-3.9, -3.15, 0, 3.15, 3.9];

function addCorridorEdge(from: RouteNode, to: RouteNode, label: string) {
  const fromPosition = from.mapPosition;
  const toPosition = to.mapPosition;
  if (!fromPosition || !toPosition) return;
  const distanceMetres = Math.hypot(
    fromPosition[0] - toPosition[0],
    fromPosition[2] - toPosition[2],
  ) * 2;
  edges.push({
    from: from.id,
    to: to.id,
    distanceMetres: Math.max(distanceMetres, 0.2),
    kind: "corridor",
    accessible: true,
    walkable: true,
    bidirectional: true,
    label: `SAMPLE-ONLY ${label}`,
    path: [fromPosition, toPosition],
  });
}

function addRouteNode(node: Omit<RouteNode, "connectedNodeIds">) {
  const connectedNode: RouteNode = { ...node, connectedNodeIds: [] };
  nodes.push(connectedNode);
  return connectedNode;
}

for (const building of hospitalBuildings) {
  for (const [floorIndex, floor] of building.floors.entries()) {
    const floorId = nodeIdPart(floor);
    const mainNodes = corridorXs.map((x, index) =>
      addRouteNode({
        id: `demo-${building.id}-${floorId}-main-${index}`,
        kind: index === 0 || index === corridorXs.length - 1 ? "corridor" : "junction",
        buildingId: building.id,
        floor,
        label: index === 0 || index === corridorXs.length - 1
          ? "Sample main-corridor segment"
          : "Sample main-corridor junction",
        mapPosition: [x, 0.1, 0],
      }),
    );

    for (let index = 0; index < mainNodes.length - 1; index += 1) {
      const current = mainNodes[index];
      const next = mainNodes[index + 1];
      if (current && next) addCorridorEdge(current, next, "main corridor");
    }

    const liftNodes = [-1, 1].map((side) =>
      addRouteNode({
        id: `demo-${building.id}-${floorId}-elevator-${side < 0 ? "west" : "east"}`,
        kind: "elevator",
        buildingId: building.id,
        floor,
        label: "Sample elevator entrance",
        mapPosition: [side * 4.7, 0.1, 0],
      }),
    );
    liftNodes.forEach((lift, index) => {
      const corridorNode = mainNodes[index === 0 ? 0 : mainNodes.length - 1];
      if (corridorNode) addCorridorEdge(corridorNode, lift, "lift access");
    });

    const stairNode = addRouteNode({
      id: `demo-${building.id}-${floorId}-staircase`,
      kind: "staircase",
      buildingId: building.id,
      floor,
      label: "Sample staircase entrance",
      mapPosition: [-3.55, 0.1, -0.55],
    });
    const stairJunction = mainNodes[1];
    if (stairJunction) addCorridorEdge(stairJunction, stairNode, "stair access");

    const entranceNode = floorIndex === 0
      ? addRouteNode({
          id: `demo-entrance-${building.id}`,
          kind: "entrance",
          buildingId: building.id,
          floor,
          label: `Sample building entrance · ${building.id}`,
          mapPosition: [0, 0.1, 3],
        })
      : null;
    if (entranceNode) {
      const entranceJunction = mainNodes[2];
      if (entranceJunction) addCorridorEdge(entranceNode, entranceJunction, "building entrance pathway");
    }

    const departments = hospitalDepartments.filter(
      (department) =>
        department.building === building.id && department.floor === floor,
    );
    for (const department of departments) {
      const slot = getDepartmentSlot(building.id, floor, department.id);
      if (!slot) continue;
      const side = slot[1] < 0 ? -1 : 1;
      const entrancePosition: [number, number, number] = [
        slot[0],
        0.1,
        side * 1.25,
      ];
      const departmentNode = addRouteNode({
        id: `demo-department-${department.id}`,
        kind: "department",
        buildingId: building.id,
        floor,
        label: `${department.name} entrance`,
        departmentId: department.id,
        mapPosition: entrancePosition,
      });
      const junction = mainNodes.find(
        (node) => node.mapPosition?.[0] === slot[0],
      );
      if (junction) addCorridorEdge(junction, departmentNode, "room entrance pathway");
    }

    const nextFloor = building.floors[floorIndex + 1];
    if (nextFloor) {
      const nextFloorId = nodeIdPart(nextFloor);
      liftNodes.forEach((lift, index) => {
        const side = index === 0 ? "west" : "east";
        edges.push({
          from: lift.id,
          to: `demo-${building.id}-${nextFloorId}-elevator-${side}`,
          distanceMetres: 12,
          kind: "elevator",
          accessible: true,
          walkable: true,
          bidirectional: true,
          label: "SAMPLE-ONLY elevator",
        });
      });
      edges.push({
        from: stairNode.id,
        to: `demo-${building.id}-${nextFloorId}-staircase`,
        distanceMetres: 15,
        kind: "staircase",
        accessible: false,
        walkable: true,
        bidirectional: true,
        label: "SAMPLE-ONLY staircase",
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
    walkable: true,
    bidirectional: true,
    label: "SAMPLE-ONLY campus connection",
  });
}

for (const node of nodes) {
  node.connectedNodeIds = edges.flatMap((edge) =>
    edge.walkable &&
    (edge.from === node.id || (edge.bidirectional && edge.to === node.id))
      ? [edge.from === node.id ? edge.to : edge.from]
      : [],
  );
}

export const demoRouteGraph: HospitalRouteGraph = { nodes, edges };

export const demoRouteStartNodes = nodes.filter(
  (node) => node.kind === "entrance" && node.id.startsWith("demo-entrance-"),
);

export const defaultDemoRouteStartNodeId = mainEntranceId;
