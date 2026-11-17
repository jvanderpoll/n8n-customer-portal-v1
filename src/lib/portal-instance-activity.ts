import { pastPeriods } from "./portal-billing";
import type { Instance, Subscription } from "./portal-data";

/** Synthetic project on an instance. Executions are a split of the instance total. */
export interface InstanceProject {
  id: string;
  name: string;
  executions: number;
}

/** Synthetic workflow on an instance. Executions roll up to its project. */
export interface InstanceWorkflow {
  id: string;
  name: string;
  project: string;
  executions: number;
}

type WorkflowSpec = { name: string; weight: number };
type ProjectSpec = { name: string; workflows: WorkflowSpec[] };

/** Shared uneven weights: one workflow is clearly the largest, eight workflows, three projects. */
const UNEVEN: number[][] = [
  [42, 11, 7],
  [12, 7, 4],
  [11, 6],
];

function catalog(projects: { name: string; workflows: string[] }[]): ProjectSpec[] {
  return projects.map((project, index) => ({
    name: project.name,
    workflows: project.workflows.map((name, workflowIndex) => ({
      name,
      weight: UNEVEN[index]![workflowIndex]!,
    })),
  }));
}

const THEMES: Record<string, ProjectSpec[]> = {
  hr: catalog([
    { name: "People operations", workflows: ["New hire provisioning", "Contract updates", "Offboarding checklist"] },
    { name: "Leave and absence", workflows: ["Leave approval", "Absence calendar", "Return to work"] },
    { name: "Payroll", workflows: ["Monthly payroll export", "Payslip delivery"] },
  ]),
  finance: catalog([
    { name: "Invoice intake", workflows: ["Invoice capture", "Payment matching", "Duplicate check"] },
    { name: "Month-end close", workflows: ["Close checklist", "Accrual review", "Report pack"] },
    { name: "Expense claims", workflows: ["Expense intake", "Receipt chase"] },
  ]),
  sales: catalog([
    { name: "Lead routing", workflows: ["Inbound lead assignment", "Lead enrichment", "Territory check"] },
    { name: "Quote follow-up", workflows: ["Quote reminder", "Deal stage update", "Proposal send"] },
    { name: "Account handoff", workflows: ["Handoff checklist", "Welcome sequence"] },
  ]),
  ops: catalog([
    { name: "Operations desk", workflows: ["Ticket triage", "Shift handover", "Vendor check"] },
    { name: "Incident follow-up", workflows: ["Status page update", "Postmortem draft", "Customer notice"] },
    { name: "Facilities", workflows: ["Access request", "Room booking sync"] },
  ]),
  support: catalog([
    { name: "Support queue", workflows: ["Ticket reply", "Macro suggestion", "Queue routing"] },
    { name: "Escalations", workflows: ["Escalation handoff", "Severity review", "On-call page"] },
    { name: "Feedback", workflows: ["Satisfaction survey", "Review request"] },
  ]),
  data: catalog([
    { name: "Data sync", workflows: ["Nightly sync", "Incremental pull", "Backfill"] },
    { name: "Quality checks", workflows: ["Schema check", "Anomaly alert", "Null report"] },
    { name: "Catalog", workflows: ["Lineage refresh", "Owner reminder"] },
  ]),
  it: catalog([
    { name: "Access requests", workflows: ["Account provisioning", "Access review", "Role change"] },
    { name: "Device inventory", workflows: ["Inventory refresh", "Warranty check", "Return processing"] },
    { name: "Service desk", workflows: ["Password reset", "Software request"] },
  ]),
  marketing: catalog([
    { name: "Campaigns", workflows: ["Campaign send", "Audience build", "Send-time test"] },
    { name: "Audience sync", workflows: ["List hygiene", "Suppression update", "Consent sync"] },
    { name: "Reporting", workflows: ["Attribution pull", "Weekly digest"] },
  ]),
  legal: catalog([
    { name: "Contract review", workflows: ["Clause review", "Redline routing", "Counterparty check"] },
    { name: "Policy updates", workflows: ["Policy publish", "Acknowledgement chase", "Version archive"] },
    { name: "Filings", workflows: ["Filing reminder", "Signature chase"] },
  ]),
  procurement: catalog([
    { name: "Purchase orders", workflows: ["PO approval", "Receipt match", "Budget check"] },
    { name: "Vendor onboarding", workflows: ["Vendor check", "Bank detail review", "Contract request"] },
    { name: "Replenishment", workflows: ["Reorder alert", "Supplier quote"] },
  ]),
};

/** prd-hr-01: four HR projects and twelve workflows. Weights sum to 100 so the split tracks the instance total. */
const HR_PRIMARY: ProjectSpec[] = [
  {
    name: "People operations",
    workflows: [
      { name: "New hire provisioning", weight: 46 },
      { name: "Contract updates", weight: 9 },
      { name: "Offboarding checklist", weight: 4 },
      { name: "Policy acknowledgement", weight: 3 },
    ],
  },
  {
    name: "Leave and absence",
    workflows: [
      { name: "Leave approval", weight: 9 },
      { name: "Absence calendar", weight: 4 },
      { name: "Return to work", weight: 3 },
    ],
  },
  {
    name: "Payroll",
    workflows: [
      { name: "Monthly payroll export", weight: 8 },
      { name: "Payslip delivery", weight: 4 },
      { name: "Tax filing reminder", weight: 2 },
    ],
  },
  {
    name: "Recruiting",
    workflows: [
      { name: "Candidate screening", weight: 5 },
      { name: "Interview scheduling", weight: 3 },
    ],
  },
];

function splitExact(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const basis = weightSum > 0 ? weights : weights.map(() => 1);
  const basisSum = basis.reduce((sum, weight) => sum + weight, 0);
  const parts = basis.map((weight) => Math.floor((total * weight) / basisSum));
  let assigned = parts.reduce((sum, part) => sum + part, 0);
  let index = 0;
  while (assigned < total) {
    parts[index % parts.length]! += 1;
    assigned += 1;
    index += 1;
  }
  return parts;
}

/** One billing month of usage. Months sum to the thing they belong to. */
export interface UsageMonth {
  id: string;
  label: string;
  shortLabel: string;
  executions: number;
  open: boolean;
}

function monthSlots(subscription: Subscription, instances: Instance[]) {
  const periods = pastPeriods(subscription, instances);
  if (!periods.length) {
    return [{ id: "term", label: "Term", shortLabel: "Term", weight: 1, open: false }];
  }
  return periods.map((period) => ({
    id: period.id,
    label: period.label,
    shortLabel: new Date(period.start).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
    weight: period.executions,
    open: period.standing === "in-progress",
  }));
}

function monthsFromParts(slots: ReturnType<typeof monthSlots>, parts: number[]): UsageMonth[] {
  return slots.map((slot, index) => ({
    id: slot.id,
    label: slot.label,
    shortLabel: slot.shortLabel,
    executions: parts[index] ?? 0,
    open: slot.open,
  }));
}

function addMonthRows(slots: ReturnType<typeof monthSlots>, rows: UsageMonth[][]): UsageMonth[] {
  return slots.map((slot, index) => ({
    id: slot.id,
    label: slot.label,
    shortLabel: slot.shortLabel,
    executions: rows.reduce((sum, row) => sum + (row[index]?.executions ?? 0), 0),
    open: slot.open,
  }));
}

export function workflowUsageMonths(instance: Instance, workflow: InstanceWorkflow, subscription: Subscription, instances: Instance[]): UsageMonth[] {
  const slots = monthSlots(subscription, instances);
  return monthsFromParts(slots, splitExact(workflow.executions, slots.map((slot) => slot.weight)));
}

export function projectUsageMonths(instance: Instance, project: InstanceProject, subscription: Subscription, instances: Instance[]): UsageMonth[] {
  const slots = monthSlots(subscription, instances);
  const rows = instanceWorkflows(instance)
    .filter((workflow) => workflow.project === project.name)
    .map((workflow) => workflowUsageMonths(instance, workflow, subscription, instances));
  return addMonthRows(slots, rows);
}

export function instanceUsageMonths(instance: Instance, subscription: Subscription, instances: Instance[]): UsageMonth[] {
  const slots = monthSlots(subscription, instances);
  if (instance.executions === null) return monthsFromParts(slots, slots.map(() => 0));
  const rows = instanceProjects(instance).map((project) => projectUsageMonths(instance, project, subscription, instances));
  return addMonthRows(slots, rows);
}

export function latestMonthExecutions(months: UsageMonth[]): number | null {
  const latest = months.at(-1);
  return latest ? latest.executions : null;
}

const FALLBACK: ProjectSpec[] = catalog([
  { name: "Operations", workflows: ["Main run", "Follow-up", "Retry"] },
  { name: "Alerts", workflows: ["Alert", "Digest", "Escalation"] },
  { name: "Maintenance", workflows: ["Cleanup", "Health check"] },
]);

function catalogFor(instance: Instance): ProjectSpec[] {
  if (instance.name === "prd-hr-01") return HR_PRIMARY;
  const token = instance.name.split("-")[1] ?? "";
  return THEMES[token] ?? FALLBACK;
}

function allocated(instance: Instance) {
  const spec = catalogFor(instance);
  const weights = spec.flatMap((project) => project.workflows.map((workflow) => workflow.weight));
  const parts = splitExact(instance.executions ?? 0, weights);
  let cursor = 0;
  return spec.map((project) => {
    const workflows = project.workflows.map((workflow) => {
      const executions = parts[cursor] ?? 0;
      cursor += 1;
      return { name: workflow.name, executions };
    });
    return {
      name: project.name,
      executions: workflows.reduce((sum, workflow) => sum + workflow.executions, 0),
      workflows,
    };
  });
}

export function instanceProjects(instance: Instance): InstanceProject[] {
  if (instance.executions === null) return [];
  return allocated(instance).map((project, index) => ({
    id: `${instance.id}-p${index + 1}`,
    name: project.name,
    executions: project.executions,
  }));
}

export function instanceWorkflows(instance: Instance): InstanceWorkflow[] {
  if (instance.executions === null) return [];
  let index = 0;
  return allocated(instance).flatMap((project) => project.workflows.map((workflow) => {
    index += 1;
    return {
      id: `${instance.id}-w${index}`,
      name: workflow.name,
      project: project.name,
      executions: workflow.executions,
    };
  }));
}

/** Project executions as a share of the instance total. */
export function instanceShare(part: number, total: number | null): string {
  if (total === null) return "—";
  if (total <= 0) return "0%";
  const pct = Math.round((part / total) * 1000) / 10;
  return `${pct.toFixed(1)}%`;
}
