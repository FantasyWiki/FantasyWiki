import { execSync } from "child_process";

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
        path: "src/**/*.{vue,ts}",
      },
    ],
  });

  plop.setActionType("prettify", function (answers, config) {
    try {
      execSync(`npx prettier --write ${config.path}`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      return "Prettier formatting completed";
    } catch (error) {
      throw `Prettier formatting failed: ${error.message}`;
    }
  });
}
