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
    ],
  });
}
