export default function (plop) {
  // Add a custom helper to extract the component name from a path
  plop.setHelper('componentName', function(text) {
    // Extract the last part of the path (the actual component name)
    return text.split('/').pop();
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
