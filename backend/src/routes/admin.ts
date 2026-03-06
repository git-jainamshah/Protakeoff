import { Router, Response } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [userCount, companyCount, projectCount, documentCount, shapeCount] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.project.count(),
      prisma.document.count(),
      prisma.shape.count(),
    ]);

    const recentProjects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { name: true } }, createdBy: { select: { name: true } } },
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.json({
      counts: { users: userCount, companies: companyCount, projects: projectCount, documents: documentCount, shapes: shapeCount },
      recentProjects,
      recentUsers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/git/log', (_req: AuthRequest, res: Response): void => {
  try {
    const log = execSync(
      'git log --pretty=format:\'{"hash":"%H","shortHash":"%h","message":"%s","author":"%an","email":"%ae","date":"%ai","refs":"%D"}\' -20',
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    );

    const commits = log
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const statusOutput = execSync('git status --short', { cwd: REPO_ROOT, encoding: 'utf-8' });
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
    const currentHash = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();

    res.json({
      commits,
      currentBranch,
      currentHash,
      hasUncommittedChanges: statusOutput.trim().length > 0,
      status: statusOutput.trim(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read git log', details: String(err) });
  }
});

router.post('/git/restore/:hash', (req: AuthRequest, res: Response): void => {
  try {
    const hash = req.params.hash as string;

    if (!/^[a-f0-9]{6,40}$/i.test(hash)) {
      res.status(400).json({ error: 'Invalid commit hash' });
      return;
    }

    execSync('git stash', { cwd: REPO_ROOT });
    execSync(`git checkout ${hash}`, { cwd: REPO_ROOT });

    res.json({
      message: `Successfully restored to commit ${hash}`,
      note: 'Restart the server to apply all code changes',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to restore version', details: String(err) });
  }
});

router.post('/git/restore-latest', (_req: AuthRequest, res: Response): void => {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
    execSync('git checkout HEAD', { cwd: REPO_ROOT });
    execSync(`git checkout ${currentBranch}`, { cwd: REPO_ROOT });
    res.json({ message: 'Restored to latest version on current branch' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to restore to latest' });
  }
});

router.get('/github/commits', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const owner = process.env.GITHUB_OWNER || 'git-jainamshah';
    const repo = process.env.GITHUB_REPO || 'Protakeoff';
    const token = process.env.GITHUB_TOKEN;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ProTakeOff-Admin/1.0',
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`, { headers });

    if (!response.ok) {
      res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
      return;
    }

    const commits = await response.json() as Array<{
      sha: string;
      commit: { message: string; author: { name: string; email: string; date: string } };
      html_url: string;
    }>;

    const mapped = commits.map((c) => ({
      hash: c.sha,
      shortHash: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch GitHub commits' });
  }
});

router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        company: { select: { id: true, name: true } },
        createdAt: true,
        _count: { select: { createdProjects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
