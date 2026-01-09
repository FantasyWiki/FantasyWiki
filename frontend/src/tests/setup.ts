import { vi } from 'vitest';

const failOn = ['warn', 'error'];

failOn.forEach((method) => {
  vi.spyOn(console, method as any).mockImplementation((msg) => {
    throw new Error(`Failing test due to console.${method}: ${msg}`);
  });
});