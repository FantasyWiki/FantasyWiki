import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";

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

  afterEach(() => {
    // Clean up generated files after each test
    testCases.forEach(({ viewPath, testPath }) => {
      const viewFullPath = path.resolve(__dirname, "../../", viewPath);
      const testFullPath = path.resolve(__dirname, "../../", testPath);

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

      try {
        if (
          existsSync(viewDir) &&
          viewDir !== path.resolve(__dirname, "../../src/views")
        ) {
          rmSync(viewDir, { recursive: true, force: true });
        }
        if (
          existsSync(testDir) &&
          testDir !== path.resolve(__dirname, "../../src/tests")
        ) {
          rmSync(testDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore errors when cleaning up directories
      }
    });
  });

  testCases.forEach(({ name, viewPath, testPath }) => {
    it(`should generate ${name} component and spec file that pass prettier`, () => {
      const frontendDir = path.resolve(__dirname, "../../");

      // Generate component using plop
      try {
        execSync(`npx plop component --name ${name}`, {
          cwd: frontendDir,
          stdio: "pipe",
        });
      } catch (error) {
        throw new Error(`Failed to generate component: ${error.message}`);
      }

      const viewFullPath = path.resolve(frontendDir, viewPath);
      const testFullPath = path.resolve(frontendDir, testPath);

      // Check if files were created
      expect(existsSync(viewFullPath)).toBe(true);
      expect(existsSync(testFullPath)).toBe(true);

      // Check if generated files pass prettier
      let prettierOutput: string;
      try {
        prettierOutput = execSync(
          `npx prettier --check ${viewFullPath} ${testFullPath}`,
          {
            cwd: frontendDir,
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
