import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";

const FRONTEND_DIR = path.resolve(__dirname, "../../");

describe("Plop Component Generator", () => {
  const testCases = [
    {
      name: "SimpleComponent",
      viewPath: "src/views/SimpleComponent.vue",
      testPath: "src/tests/SimpleComponent.spec.ts",
    },
    {
      name: "feature/NestedComponent",
      viewPath: "src/views/feature/NestedComponent.vue",
      testPath: "src/tests/feature/NestedComponent.spec.ts",
    },
    {
      name: "deeply/nested/path/DeepComponent",
      viewPath: "src/views/deeply/nested/path/DeepComponent.vue",
      testPath: "src/tests/deeply/nested/path/DeepComponent.spec.ts",
    },
  ];

  const cleanupDirectory = (dirPath: string, basePath: string) => {
    try {
      if (existsSync(dirPath) && dirPath !== basePath) {
        rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore errors when cleaning up directories
    }
  };

  afterEach(() => {
    // Clean up generated files after each test
    testCases.forEach(({ viewPath, testPath }) => {
      const viewFullPath = path.resolve(FRONTEND_DIR, viewPath);
      const testFullPath = path.resolve(FRONTEND_DIR, testPath);

      // Remove files if they exist
      if (existsSync(viewFullPath)) {
        rmSync(viewFullPath);
      }
      if (existsSync(testFullPath)) {
        rmSync(testFullPath);
      }

      // Clean up empty directories
      const viewDir = path.dirname(viewFullPath);
      const testDir = path.dirname(testFullPath);

      cleanupDirectory(viewDir, path.resolve(FRONTEND_DIR, "src/views"));
      cleanupDirectory(testDir, path.resolve(FRONTEND_DIR, "src/tests"));
    });
  });

  testCases.forEach(({ name, viewPath, testPath }) => {
    it(`should generate ${name} component and spec file that pass prettier`, () => {
      // Generate component using plop
      try {
        execSync(`npx plop component --name "${name}"`, {
          cwd: FRONTEND_DIR,
          stdio: "pipe",
        });
      } catch (error) {
        throw new Error(`Failed to generate component: ${error.message}`);
      }

      const viewFullPath = path.resolve(FRONTEND_DIR, viewPath);
      const testFullPath = path.resolve(FRONTEND_DIR, testPath);

      // Check if files were created
      expect(existsSync(viewFullPath)).toBe(true);
      expect(existsSync(testFullPath)).toBe(true);

      // Check if generated files pass prettier
      let prettierOutput: string;
      try {
        prettierOutput = execSync(
          `npx prettier --check "${viewFullPath}" "${testFullPath}"`,
          {
            cwd: FRONTEND_DIR,
            encoding: "utf-8",
            stdio: "pipe",
          }
        );
      } catch (error) {
        throw new Error(
          `Prettier check failed for ${name}: ${error.stdout || error.message}`
        );
      }

      // Prettier exits with 0 and outputs "All matched files use Prettier code style!" when files are formatted
      expect(prettierOutput).toContain("Prettier code style");
    });
  });
});
