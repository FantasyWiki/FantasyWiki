import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import prettier from "prettier";

export default function (plop) {
  plop.setHelper("componentName", function (text) {
    return text.split("/").pop();
  });

  plop.setGenerator("component", {
    description: "Create a Vue component and its test",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Component name?",
      },
    ],
    actions: [
      {
        type: "add",
        path: "src/views/{{name}}.vue",
        templateFile: "templates/component.vue.hbs",
        skipIfExists: true,
      },
      {
        type: "add",
        path: "src/tests/{{name}}.spec.ts",
        templateFile: "templates/component.spec.ts.hbs",
        skipIfExists: true,
      },
      {
        type: "prettify",
      },
    ],
  });

  plop.setActionType("prettify", async function (answers) {
    const viewPath = `src/views/${answers.name}.vue`;
    const testPath = `src/tests/${answers.name}.spec.ts`;

    try {
      // Read prettier config
      const prettierConfig = await prettier.resolveConfig(process.cwd());

      // Format both files
      for (const filePath of [viewPath, testPath]) {
        // Check if file exists before formatting
        try {
          await access(filePath, constants.F_OK);
        } catch {
          continue; // Skip file if it doesn't exist
        }

        const content = await readFile(filePath, "utf8");
        const formatted = await prettier.format(content, {
          ...prettierConfig,
          filepath: filePath,
        });
        await writeFile(filePath, formatted, "utf8");
      }

      return "Prettier formatting completed";
    } catch (error) {
      throw new Error(`Prettier formatting failed: ${error.message}`);
    }
  });
}
