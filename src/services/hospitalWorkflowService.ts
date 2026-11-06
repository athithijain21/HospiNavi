import type { HospitalDepartment } from "../data/hospitalMapData";

export type HospitalWorkflow = {
  id: string;
  name: string;
  departmentId: number;
  prerequisiteDepartmentIds: number[];
};

// Configure operational prerequisites here. No clinical workflow is assumed by
// default; only prerequisites verified by hospital staff should be added.
export const hospitalWorkflows: HospitalWorkflow[] = [];

export function getWorkflowPlan(
  departmentIds: number[],
  departments: HospitalDepartment[],
  prerequisites = hospitalWorkflows,
) {
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
  const workflowsByTarget = new Map(
    prerequisites.map((workflow) => [workflow.departmentId, workflow]),
  );
  const requested = new Set<number>();
  const dependencies = new Map<number, Set<number>>();
  const addWithPrerequisites = (id: number, visiting = new Set<number>()) => {
    if (!departmentMap.has(id)) return;
    if (visiting.has(id)) {
      throw new Error("Configured hospital workflow prerequisites contain a cycle.");
    }
    if (requested.has(id)) return;
    requested.add(id);
    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);
    const workflow = workflowsByTarget.get(id);
    workflow?.prerequisiteDepartmentIds.forEach((prerequisiteId) => {
      if (!departmentMap.has(prerequisiteId)) {
        throw new Error(
          `Workflow ${workflow.name} references an unknown prerequisite department.`,
        );
      }
      const currentDependencies = dependencies.get(id) ?? new Set<number>();
      currentDependencies.add(prerequisiteId);
      dependencies.set(id, currentDependencies);
      addWithPrerequisites(prerequisiteId, nextVisiting);
    });
  };
  departmentIds.forEach((id) => addWithPrerequisites(id));
  return { departmentIds: [...requested], dependencies };
}

export function orderDepartmentsByWorkflow(
  departmentIds: number[],
  departments: HospitalDepartment[],
  prerequisites = hospitalWorkflows,
) {
  const workflowPlan = getWorkflowPlan(departmentIds, departments, prerequisites);
  const requested = workflowPlan.departmentIds;
  const requestedSet = new Set(requested);
  const edges = new Map<number, Set<number>>();
  const indegree = new Map(requested.map((id) => [id, 0]));
  requested.forEach((targetId) => {
    workflowPlan.dependencies.get(targetId)?.forEach((prerequisiteId) => {
      if (!requestedSet.has(prerequisiteId) || prerequisiteId === targetId) return;
      const targets = edges.get(prerequisiteId) ?? new Set<number>();
      if (targets.has(targetId)) return;
      targets.add(targetId);
      edges.set(prerequisiteId, targets);
      indegree.set(targetId, (indegree.get(targetId) ?? 0) + 1);
    });
  });

  const ready = requested.filter((id) => indegree.get(id) === 0);
  const result: number[] = [];
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    result.push(current);
    edges.get(current)?.forEach((targetId) => {
      const nextIndegree = (indegree.get(targetId) ?? 1) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) ready.push(targetId);
    });
  }

  if (result.length !== requested.length) {
    throw new Error("Configured hospital workflow prerequisites contain a cycle.");
  }
  return result;
}
