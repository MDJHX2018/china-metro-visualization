// Deploy the static build to GitHub Pages.
//
// Requirements:
//   - GH_TOKEN: a GitHub Personal Access Token with `repo` scope
//     (or fine-grained: Contents RW, Pages RW, Administration RW, Metadata R)
//   - GITHUB_REPO (optional): repo name, defaults to "china-metro-visualization"
//
// Steps: create repo if missing -> commit & push source -> build:pages ->
// push dist/ to gh-pages branch -> enable Pages -> wait for the build.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publish } from "gh-pages";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const token = process.env.GH_TOKEN;
if (!token) {
  console.error("缺少 GH_TOKEN 环境变量：请提供 GitHub Personal Access Token（scope 至少包含 repo）。");
  process.exit(1);
}
const repoName = process.env.GITHUB_REPO || "china-metro-visualization";
const API = "https://api.github.com";

// Git transport fixes for this sandboxed environment:
// - the bundled git's libexec dir lacks remote helpers -> point GIT_EXEC_PATH
//   at the directory containing git-remote-https.exe
// - Windows Credential Manager is unavailable -> token comes from the URL
// - the Schannel TLS backend cannot access the certificate store -> use OpenSSL
function setupGitEnv() {
  const execPath = execFileSync("git", ["--exec-path"], { cwd: root, encoding: "utf8" })
    .toString()
    .trim();
  for (const dir of [execPath, join(execPath, "..", "bin"), join(execPath, "..", "..", "bin")]) {
    if (existsSync(join(dir, "git-remote-https.exe")) || existsSync(join(dir, "git-remote-https"))) {
      process.env.GIT_EXEC_PATH = dir;
      break;
    }
  }
  process.env.GIT_TERMINAL_PROMPT = "0";
  process.env.GIT_CONFIG_COUNT = "2";
  process.env.GIT_CONFIG_KEY_0 = "credential.helper";
  process.env.GIT_CONFIG_VALUE_0 = "";
  process.env.GIT_CONFIG_KEY_1 = "http.sslbackend";
  process.env.GIT_CONFIG_VALUE_1 = "openssl";
}
setupGitEnv();

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "codex-metro-deploy",
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Account + repo
const userRes = await api("/user");
if (userRes.status !== 200) {
  console.error("Token 无效或权限不足：", userRes.status, JSON.stringify(userRes.body).slice(0, 200));
  process.exit(1);
}
const owner = userRes.body.login;
console.log(`GitHub 用户: ${owner}`);

let repoRes = await api(`/repos/${owner}/${repoName}`);
if (repoRes.status === 404) {
  console.log(`仓库 ${owner}/${repoName} 不存在，正在创建（public）…`);
  repoRes = await api("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      description: "全国城市地铁可视化系统 - 全国概览 + 单城市深度探索仪表板",
      private: false,
      has_issues: false,
      has_wiki: false,
    }),
  });
  if (repoRes.status !== 201) {
    console.error("创建仓库失败：", repoRes.status, JSON.stringify(repoRes.body).slice(0, 300));
    process.exit(1);
  }
  console.log("仓库已创建。");
} else if (repoRes.status !== 200) {
  console.error("查询仓库失败：", repoRes.status, JSON.stringify(repoRes.body).slice(0, 300));
  process.exit(1);
} else {
  console.log(`仓库已存在: ${owner}/${repoName}`);
}

// 2. Commit & push source
// NOTE: the sandbox keeps the project's own .git read-only, so source commits
// happen in a writable bare repository under work/deploy-bare.git.
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
const runQuiet = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: "utf8" }).toString().trim();

const gitDir = join(root, "work", "deploy-bare.git");
if (!existsSync(gitDir)) {
  run("git", ["init", "--bare", gitDir]);
}
const g = (args) => run("git", [`--git-dir=${gitDir}`, `--work-tree=${root}`, ...args]);
const gq = (args) =>
  execFileSync("git", [`--git-dir=${gitDir}`, `--work-tree=${root}`, ...args], {
    cwd: root,
    encoding: "utf8",
  })
    .toString()
    .trim();

g(["symbolic-ref", "HEAD", "refs/heads/main"]);
g(["config", "user.name", "Metro Explorer"]);
g(["config", "user.email", "metro-explorer@users.noreply.github.com"]);

g(["add", "-A"]);
const changed = gq(["status", "--porcelain"]);
if (changed) {
  g(["commit", "-m", "feat: 全国城市地铁可视化系统（源码）"]);
} else {
  console.log("源码无变更，跳过提交。");
}
g(["push", `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`, "HEAD:main"]);
console.log("源码已推送到 main。");

// 3. Build the Pages variant
console.log("正在构建 GitHub Pages 版本…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:pages"]);

// 4. Publish dist/ to gh-pages branch
await new Promise((resolve, reject) => {
  publish(join(root, "dist"), {
    branch: "gh-pages",
    repo: `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`,
    user: { name: "Metro Explorer", email: "metro-explorer@users.noreply.github.com" },
    message: "Deploy to GitHub Pages [ci skip]",
    dotfiles: false,
  }, (err) => (err ? reject(err) : resolve()));
});
console.log("dist/ 已发布到 gh-pages 分支。");

// 5. Enable Pages
let pagesRes = await api(`/repos/${owner}/${repoName}/pages`);
if (pagesRes.status === 404) {
  console.log("正在启用 GitHub Pages…");
  pagesRes = await api(`/repos/${owner}/${repoName}/pages`, {
    method: "POST",
    body: JSON.stringify({ source: { branch: "gh-pages", path: "/" } }),
  });
  if (![201, 409].includes(pagesRes.status)) {
    console.error("启用 Pages 失败：", pagesRes.status, JSON.stringify(pagesRes.body).slice(0, 300));
    process.exit(1);
  }
} else if (pagesRes.status === 200) {
  console.log("Pages 已启用，检查 source 分支…");
  if (pagesRes.body.source?.branch !== "gh-pages") {
    await api(`/repos/${owner}/${repoName}/pages`, {
      method: "PUT",
      body: JSON.stringify({ source: { branch: "gh-pages", path: "/" } }),
    });
  }
}

// 6. Wait for the build to finish
console.log("等待 GitHub Pages 构建…");
const deadline = Date.now() + 180_000;
let url = null;
while (Date.now() < deadline) {
  await sleep(5000);
  const res = await api(`/repos/${owner}/${repoName}/pages`);
  if (res.status === 200 && res.body.html_url) {
    url = res.body.html_url;
    if (res.body.status === "built") break;
    console.log(`  状态: ${res.body.status}`);
  }
}

if (!url) {
  console.error("等待超时，请稍后访问 https://github.com/" + owner + "/" + repoName + "/settings/pages 查看状态。");
  process.exit(1);
}
console.log("\n🎉 部署完成！");
console.log(`访问地址: ${url}`);
console.log(`仓库地址: https://github.com/${owner}/${repoName}`);
