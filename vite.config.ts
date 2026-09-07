import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  compatibility_date: '2026-05-22',
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  // Database bindings are defined once in wrangler.jsonc (also used by db:init).
};

export default defineConfig(async ({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), 'DID_');
  const vars = Object.fromEntries(
    ['DID_AGENT_ID', 'DID_CLIENT_KEY', 'DID_AVATAR_TYPE'].map((key) => [
      key,
      process.env[key] || localEnv[key] || '',
    ]),
  );
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: { ...localBindingConfig, vars },
      }),
    ],
  };
});
