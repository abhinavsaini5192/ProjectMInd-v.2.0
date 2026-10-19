import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runVerification() {
  console.log('[MCP E2E] Starting live MCP Stdio integration verification...');

  const tmpBase = path.join(os.tmpdir(), `pm-e2e-mcp-${Date.now()}`);
  const repoPath = path.join(tmpBase, 'sample-repo');

  fs.mkdirSync(path.join(repoPath, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'src', 'billing'), { recursive: true });

  fs.writeFileSync(
    path.join(repoPath, 'src', 'auth', 'TokenManager.ts'),
    `export class TokenManager {
  private secret = 'token_secret_123';
  public generateToken(userId: string): string {
    return 'token_' + userId;
  }
  public verifyToken(token: string): boolean {
    return token.startsWith('token_');
  }
}`
  );

  fs.writeFileSync(
    path.join(repoPath, 'src', 'auth', 'AuthService.ts'),
    `import { TokenManager } from './TokenManager.js';

export class AuthService {
  private tokenManager = new TokenManager();
  public async login(userId: string): Promise<string> {
    return this.tokenManager.generateToken(userId);
  }
}`
  );

  fs.writeFileSync(
    path.join(repoPath, 'src', 'billing', 'PaymentService.ts'),
    `export class PaymentService {
  public charge(amount: number): string {
    return 'tx_' + amount;
  }
}`
  );

  console.log('[MCP E2E] Disposable test repository prepared at:', repoPath);

  const serverScript = path.resolve('dist/integrations/mcp/server/main.js');
  console.log('[MCP E2E] Connecting to server executable:', process.execPath);
  console.log('[MCP E2E] Server script entry point:', serverScript);

  if (!fs.existsSync(serverScript)) {
    throw new Error(`Server script not found at ${serverScript}. Run npm run build first.`);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript, '--workspace', repoPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  const client = new Client(
    { name: 'antigravity-e2e-verifier', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log('[MCP E2E] Connecting over stdio transport...');
    await client.connect(transport);
    console.log('[MCP E2E] Connected successfully to ProjectMind MCP Server!');

    // 1. Tool Discovery
    console.log('[MCP E2E] Discovering tools...');
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    console.log('[MCP E2E] Discovered tools:', toolNames);

    if (!toolNames.includes('projectmind_search')) throw new Error('Missing projectmind_search');
    if (!toolNames.includes('projectmind_get_context')) throw new Error('Missing projectmind_get_context');
    if (!toolNames.includes('projectmind_explain_feature')) throw new Error('Missing projectmind_explain_feature');
    if (!toolNames.includes('projectmind_impact_analysis')) throw new Error('Missing projectmind_impact_analysis');

    // 2. Invoke projectmind_search
    console.log('[MCP E2E] Testing projectmind_search...');
    const searchRes = await client.callTool({
      name: 'projectmind_search',
      arguments: {
        projectPath: repoPath,
        query: 'TokenManager',
        limit: 5,
      },
    });
    console.log('[MCP E2E] Search response received. Content length:', searchRes.content.length);
    const searchPayload = JSON.parse(searchRes.content[0].text.match(/```json\n([\s\S]*?)\n```/)[1]);
    console.log('[MCP E2E] Search match count:', searchPayload.count);
    if (!searchPayload.results.some((r) => r.resourceId.includes('TokenManager.ts'))) {
      throw new Error('Expected TokenManager.ts in search results');
    }
    console.log('[MCP E2E] Search verification PASSED.');

    // 3. Invoke projectmind_get_context
    console.log('[MCP E2E] Testing projectmind_get_context...');
    const contextRes = await client.callTool({
      name: 'projectmind_get_context',
      arguments: {
        projectPath: repoPath,
        task: 'Implement authentication tokens for users',
        maxFiles: 5,
      },
    });
    const ctxPayload = JSON.parse(contextRes.content[0].text.match(/```json\n([\s\S]*?)\n```/)[1]);
    console.log('[MCP E2E] Context files selected:', ctxPayload.selectedFilesCount);
    if (ctxPayload.selectedFilesCount === 0) {
      throw new Error('Expected at least one file selected for auth task');
    }
    console.log('[MCP E2E] Context verification PASSED.');

    // 4. Invoke projectmind_explain_feature
    console.log('[MCP E2E] Testing projectmind_explain_feature...');
    const explainRes = await client.callTool({
      name: 'projectmind_explain_feature',
      arguments: {
        projectPath: repoPath,
        feature: 'AuthService',
      },
    });
    const explainPayload = JSON.parse(explainRes.content[0].text.match(/```json\n([\s\S]*?)\n```/)[1]);
    console.log('[MCP E2E] Feature found:', explainPayload.found, 'verified files:', explainPayload.verifiedFiles);
    if (!explainPayload.found) {
      throw new Error('Expected AuthService feature to be found');
    }
    console.log('[MCP E2E] Feature explanation verification PASSED.');

    // 5. Invoke projectmind_impact_analysis
    console.log('[MCP E2E] Testing projectmind_impact_analysis...');
    const impactRes = await client.callTool({
      name: 'projectmind_impact_analysis',
      arguments: {
        projectPath: repoPath,
        target: 'src/auth/TokenManager.ts',
        changeDescription: 'Upgrade token secret and verification method',
      },
    });
    const impactPayload = JSON.parse(impactRes.content[0].text.match(/```json\n([\s\S]*?)\n```/)[1]);
    console.log('[MCP E2E] Impact target:', impactPayload.targetFile, 'blast radius:', impactPayload.blastRadiusScore);
    console.log('[MCP E2E] Directly affected files:', impactPayload.directlyAffectedFiles);
    if (!impactPayload.directlyAffectedFiles.some((f) => f.includes('AuthService.ts'))) {
      throw new Error('Expected AuthService.ts to be directly affected by TokenManager change');
    }
    console.log('[MCP E2E] Impact analysis verification PASSED.');

    // 6. Test Error Handling (Invalid input)
    console.log('[MCP E2E] Testing error safety on invalid input...');
    const errRes = await client.callTool({
      name: 'projectmind_search',
      arguments: {
        projectPath: path.join(tmpBase, 'non_existent_folder_abc'),
        query: 'test',
      },
    });
    if (!errRes.isError) {
      throw new Error('Expected isError: true on missing folder');
    }
    console.log('[MCP E2E] Error response correctly returned isError: true. Text:', errRes.content[0].text);
    console.log('[MCP E2E] Error safety verification PASSED.');

    // 7. Clean Shutdown
    console.log('[MCP E2E] Closing client and stopping transport...');
    await client.close();
    console.log('[MCP E2E] Client closed cleanly.');
  } finally {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }

  console.log('[MCP E2E] ===================================================');
  console.log('[MCP E2E] ALL LIVE STDIO PROTOCOL VERIFICATIONS PASSED (7/7)!');
  console.log('[MCP E2E] ===================================================');
}

runVerification().catch((err) => {
  console.error('[MCP E2E] Verification FAILED:', err);
  process.exit(1);
});
