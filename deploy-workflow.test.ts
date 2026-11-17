import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Step {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
}

interface Job {
  needs?: string | string[];
  if?: string;
  steps: Step[];
}

interface Workflow {
  jobs: Record<string, Job>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkflow(value: unknown): value is Workflow {
  if (!isRecord(value) || !isRecord(value["jobs"])) {
    return false;
  }
  return Object.values(value["jobs"]).every(
    (job) => isRecord(job) && Array.isArray(job["steps"]),
  );
}

const parsed: unknown = parse(
  readFileSync(".github/workflows/deploy.yml", "utf8"),
);
if (!isWorkflow(parsed)) {
  throw new Error("deploy.yml is not a workflow with jobs and steps");
}
const workflow = parsed;

function requireStep(job: string, id: string): Step {
  const step = workflow.jobs[job]?.steps.find(
    (candidate) => candidate.id === id,
  );
  if (step === undefined) {
    throw new Error(`deploy.yml has no step "${id}" in job "${job}"`);
  }
  return step;
}

const ghStub = `#!/bin/sh
[ "$*" = "api meta --jq .domains.actions[]" ] || { echo "unexpected gh call: $*" >&2; exit 2; }
cat "$GH_STUB_FIXTURE"
[ -z "$GH_STUB_FAIL" ] || exit 1
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "deploy-workflow-"));
  const gh = join(dir, "gh");
  writeFileSync(gh, ghStub);
  chmodSync(gh, 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function runHostsStep(hosts: string[], { ghFails = false } = {}) {
  const run = requireStep("ArtifactHosts", "hosts").run;
  if (run === undefined) {
    throw new Error("the hosts step has no run script");
  }
  const fixture = join(dir, "meta.txt");
  const output = join(dir, "github-output");
  writeFileSync(fixture, hosts.map((host) => `${host}\n`).join(""));
  writeFileSync(output, "");
  const result = spawnSync("bash", ["-c", run], {
    encoding: "utf8",
    env: {
      PATH: `${dir}:${process.env["PATH"] ?? ""}`,
      GITHUB_OUTPUT: output,
      GH_STUB_FIXTURE: fixture,
      ...(ghFails ? { GH_STUB_FAIL: "1" } : {}),
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    output: readFileSync(output, "utf8"),
  };
}

describe("ArtifactHosts job", () => {
  it("outputs the artifact storage hosts GitHub lists, new ranges included", () => {
    const result = runHostsStep([
      "github.com",
      "*.actions.githubusercontent.com",
      "productionresultssa0.blob.core.windows.net",
      "productionresultssa30.blob.core.windows.net",
      "productionresultssa199.blob.core.windows.net",
    ]);

    expect(result.status).toBe(0);
    expect(result.output).toBe(
      [
        "hosts<<HOSTS_END",
        "productionresultssa0.blob.core.windows.net",
        "productionresultssa30.blob.core.windows.net",
        "productionresultssa199.blob.core.windows.net",
        "HOSTS_END",
        "",
      ].join("\n"),
    );
  });

  it("drops hosts that only look like artifact storage", () => {
    const result = runHostsStep([
      "productionresultssa1.blob.core.windows.net",
      "evil-productionresultssa1.blob.core.windows.net",
      "productionresultssa1.blob.core.windows.net.example.org",
      "productionresultssa.blob.core.windows.net",
      "productionresultssa1x.blob.core.windows.net",
    ]);

    expect(result.status).toBe(0);
    expect(result.output).toBe(
      [
        "hosts<<HOSTS_END",
        "productionresultssa1.blob.core.windows.net",
        "HOSTS_END",
        "",
      ].join("\n"),
    );
  });

  it("fails when GitHub lists no artifact storage host", () => {
    const result = runHostsStep([
      "github.com",
      "*.actions.githubusercontent.com",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("::error::");
    expect(result.output).toBe("");
  });

  it("fails when gh api meta cannot be read", () => {
    const result = runHostsStep(
      ["productionresultssa0.blob.core.windows.net"],
      {
        ghFails: true,
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toBe("");
  });
});

describe("ArtifactHostsFailure job", () => {
  const notice = workflow.jobs["ArtifactHostsFailure"];

  it("runs after a failed hosts job, on a pull request only", () => {
    expect(notice?.needs).toBe("ArtifactHosts");
    expect(notice?.if).toContain("failure()");
    expect(notice?.if).toContain("github.event_name == 'pull_request'");
  });
});

describe("Deploy job", () => {
  const deploy = workflow.jobs["Deploy"];

  it("waits for the hosts job", () => {
    expect(deploy?.needs).toContain("ArtifactHosts");
  });

  it("starts with the egress filter, fed by the hosts job and listing no storage host by hand", () => {
    const first = deploy?.steps[0];

    expect(first?.uses).toMatch(/^bullfrogsec\/bullfrog@/);
    const allowed = first?.with?.["allowed-domains"] ?? "";
    expect(allowed).toContain("${{ needs.ArtifactHosts.outputs.hosts }}");
    expect(allowed).not.toMatch(/productionresultssa\d/);
  });
});
