import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // O worktree da branch vive dentro do repositório: sem esta exclusão a
    // suíte do checkout canônico roda os testes dele em duplicidade.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});
