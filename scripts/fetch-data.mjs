// Refreshes the data files the site is built from.
// GitHub contribution calendar: GraphQL API (needs a token with read access).
// Hugging Face stats: public API, no token needed.
// If a fetch fails, the previously committed file is kept so the build never breaks.
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src", "data");
const USER = "AdarshSingh7647";
const HF = "https://huggingface.co/api";

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function levelFor(count, thresholds) {
  if (count === 0) return 0;
  if (count <= thresholds[0]) return 1;
  if (count <= thresholds[1]) return 2;
  if (count <= thresholds[2]) return 3;
  return 4;
}

async function fetchGitHub() {
  const token = githubToken();
  if (!token) throw new Error("no GitHub token (set GITHUB_TOKEN or run gh auth login)");
  const query = `query($login: String!) {
    user(login: $login) {
      login
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount weekday } }
        }
      }
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "adarsh-fun-build" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  const u = json.data.user;
  const cc = u.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const nonZero = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => (nonZero.length ? nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] : 1);
  const thresholds = [q(0.25), q(0.5), q(0.75)];
  const weeks = cc.contributionCalendar.weeks.map((w) => ({
    days: w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: levelFor(d.contributionCount, thresholds),
    })),
  }));
  return {
    generatedAt: new Date().toISOString(),
    user: USER,
    totalContributions: cc.contributionCalendar.totalContributions,
    commits: cc.totalCommitContributions,
    pullRequests: cc.totalPullRequestContributions,
    repositories: u.repositories.totalCount,
    weeks,
  };
}

function classify(id) {
  const n = id.toLowerCase();
  if (n.includes("math")) return "Math";
  if (n.includes("passage")) return "Passage";
  if (n.includes("table") || n.includes("tabrank")) return "Table";
  if (n.includes("dataset") || n.includes("data")) return "Data";
  return "Other";
}

async function fetchHFList(kind) {
  const url = `${HF}/${kind}?author=${USER}&limit=200&expand[]=downloadsAllTime&expand[]=downloads&expand[]=likes&expand[]=lastModified`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF ${kind} HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({
    id: r.id,
    name: r.id.split("/")[1],
    downloadsAll: r.downloadsAllTime ?? 0,
    downloads30d: r.downloads ?? 0,
    likes: r.likes ?? 0,
    lastModified: (r.lastModified ?? "").slice(0, 10),
    kind: classify(r.id),
  }));
}

async function fetchHuggingFace() {
  const models = (await fetchHFList("models")).sort((a, b) => b.downloadsAll - a.downloadsAll);
  const datasets = (await fetchHFList("datasets")).sort((a, b) => b.downloadsAll - a.downloadsAll);
  return {
    generatedAt: new Date().toISOString(),
    user: USER,
    totalModelDownloads: models.reduce((s, m) => s + m.downloadsAll, 0),
    totalDatasetDownloads: datasets.reduce((s, m) => s + m.downloadsAll, 0),
    modelCount: models.length,
    datasetCount: datasets.length,
    models,
    datasets,
  };
}

async function run(name, file, fn) {
  try {
    const data = await fn();
    writeFileSync(join(dataDir, file), JSON.stringify(data, null, 2) + "\n");
    console.log(`[data] ${name}: updated ${file}`);
  } catch (err) {
    const kept = existsSync(join(dataDir, file));
    console.warn(`[data] ${name}: ${err.message}. ${kept ? "keeping previous snapshot" : "NO snapshot available"}`);
  }
}

await run("github", "github.json", fetchGitHub);
await run("huggingface", "huggingface.json", fetchHuggingFace);
