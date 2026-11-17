import { describe, expect, it } from "vitest";
import { instanceProjects, instanceShare, instanceUsageMonths, instanceWorkflows, projectUsageMonths, workflowUsageMonths } from "./portal-instance-activity";
import { personas, personasNew, type Instance, type Persona } from "./portal-data";

function expectRollup(instance: Instance) {
  const projects = instanceProjects(instance);
  const workflows = instanceWorkflows(instance);
  const expected = instance.executions ?? 0;
  expect(projects.reduce((sum, project) => sum + project.executions, 0)).toBe(expected);
  expect(workflows.reduce((sum, workflow) => sum + workflow.executions, 0)).toBe(expected);
  for (const project of projects) {
    const inProject = workflows.filter((workflow) => workflow.project === project.name);
    expect(inProject.reduce((sum, workflow) => sum + workflow.executions, 0)).toBe(project.executions);
  }
}

function expectMonthlyRollup(persona: Persona, instance: Instance) {
  const subscription = persona.subscriptions.find((row) => row.id === instance.subscriptionId);
  if (!subscription || instance.executions === null) return;
  const months = instanceUsageMonths(instance, subscription, persona.instances);
  expect(months.reduce((sum, month) => sum + month.executions, 0)).toBe(instance.executions);
  if (instance.executions > 0 && months.length > 1) {
    expect(months.at(-1)!.executions).toBeLessThan(instance.executions);
  }
  const projects = instanceProjects(instance);
  const workflows = instanceWorkflows(instance);
  const projectMonths = new Map(projects.map((project) => [project.id, projectUsageMonths(instance, project, subscription, persona.instances)]));
  const workflowMonths = new Map(workflows.map((workflow) => [workflow.id, workflowUsageMonths(instance, workflow, subscription, persona.instances)]));
  for (const project of projects) {
    const monthsForProject = projectMonths.get(project.id)!;
    expect(monthsForProject.reduce((sum, month) => sum + month.executions, 0)).toBe(project.executions);
    const inProject = workflows.filter((workflow) => workflow.project === project.name);
    for (const workflow of inProject) {
      expect(workflowMonths.get(workflow.id)!.reduce((sum, month) => sum + month.executions, 0)).toBe(workflow.executions);
    }
    months.forEach((_, index) => {
      const workflowSum = inProject.reduce((sum, workflow) => sum + workflowMonths.get(workflow.id)![index]!.executions, 0);
      expect(workflowSum).toBe(monthsForProject[index]!.executions);
    });
  }
  months.forEach((month, index) => {
    const projectSum = projects.reduce((sum, project) => sum + projectMonths.get(project.id)![index]!.executions, 0);
    expect(projectSum).toBe(month.executions);
  });
}

describe("instance project and workflow rollups", () => {
  it("sums every fixture instance's projects and workflows to its existing executions", () => {
    for (const persona of [...personas, ...personasNew]) {
      for (const instance of persona.instances) {
        expectRollup(instance);
        expectMonthlyRollup(persona, instance);
        if (instance.executions !== null && instance.name !== "prd-hr-01") {
          expect(instanceProjects(instance).length).toBeGreaterThanOrEqual(3);
          expect(instanceWorkflows(instance).length).toBeGreaterThanOrEqual(8);
        }
      }
    }
  }, 20_000);

  it("gives prd-hr-01 one dominant HR project and one dominant workflow inside it", () => {
    const instance = personasNew.find((persona) => persona.id === "full")!.instances.find((row) => row.id === "i1")!;
    expect(instance.name).toBe("prd-hr-01");
    expect(instance.executions).toBe(214_000);

    expect(instanceProjects(instance).map((project) => [project.name, project.executions])).toEqual([
      ["People operations", 132_680],
      ["Leave and absence", 34_240],
      ["Payroll", 29_960],
      ["Recruiting", 17_120],
    ]);
    expect(instanceWorkflows(instance).map((workflow) => [workflow.name, workflow.project, workflow.executions])).toEqual([
      ["New hire provisioning", "People operations", 98_440],
      ["Contract updates", "People operations", 19_260],
      ["Offboarding checklist", "People operations", 8_560],
      ["Policy acknowledgement", "People operations", 6_420],
      ["Leave approval", "Leave and absence", 19_260],
      ["Absence calendar", "Leave and absence", 8_560],
      ["Return to work", "Leave and absence", 6_420],
      ["Monthly payroll export", "Payroll", 17_120],
      ["Payslip delivery", "Payroll", 8_560],
      ["Tax filing reminder", "Payroll", 4_280],
      ["Candidate screening", "Recruiting", 10_700],
      ["Interview scheduling", "Recruiting", 6_420],
    ]);
    const largest = [...instanceWorkflows(instance)].sort((a, b) => b.executions - a.executions)[0]!;
    expect(largest.name).toBe("New hire provisioning");

    const persona = personasNew.find((row) => row.id === "full")!;
    const subscription = persona.subscriptions.find((row) => row.id === instance.subscriptionId)!;
    const months = instanceUsageMonths(instance, subscription, persona.instances);
    expect(months.map((month) => month.shortLabel)).toEqual(["Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26", "Sept 26", "Oct 26"]);
    expect(months.at(-1)?.open).toBe(true);
    expect(months.at(-1)!.executions).toBeLessThan(instance.executions!);
    const hire = instanceWorkflows(instance)[0]!;
    const hireLatest = workflowUsageMonths(instance, hire, subscription, persona.instances).at(-1)!.executions;
    expect(hireLatest).toBeLessThan(months.at(-1)!.executions);
  });

  it("does not reuse the 214,000 story for another instance that shares the name", () => {
    const eu = personasNew.find((persona) => persona.id === "full")!.instances.find((row) => row.id === "eu1")!;
    expect(eu.name).toBe("prd-hr-01");
    expect(eu.executions).toBe(280_000);
    expect(instanceProjects(eu)).toHaveLength(4);
    expect(instanceWorkflows(eu)).toHaveLength(12);
    expect(instanceProjects(eu).reduce((sum, project) => sum + project.executions, 0)).toBe(280_000);
    expect(instanceWorkflows(eu)[0]).toMatchObject({ name: "New hire provisioning", executions: 128_800 });
    expect(instanceShare(instanceWorkflows(eu)[0]!.executions, eu.executions)).toBe("46.0%");
    const workflows = instanceWorkflows(eu);
    expect(instanceProjects(eu).map((project) => [project.name, workflows.filter((workflow) => workflow.project === project.name).length])).toEqual([
      ["People operations", 4],
      ["Leave and absence", 3],
      ["Payroll", 3],
      ["Recruiting", 2],
    ]);
  });
});
