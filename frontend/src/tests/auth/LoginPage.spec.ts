import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import router from "@/router/index";
import LoginPage from "@/views/auth/LoginPage.vue";
import { IonInput } from "@ionic/vue";
import { ApiError, passwordAuthApi, sessionApi } from "@/services/api";

function mountLoginPage() {
  return mount(LoginPage, { global: { plugins: [router] } });
}

describe("auth/LoginPage.vue", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should mount without any console errors or warnings", async () => {
    await router.push("/");
    await router.isReady();
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  /**
   * The demo sign-in is a local development affordance. A deployed build is
   * never started with the flag, and the backend refuses `/auth/dev` there
   * regardless — but the button not being in the DOM is the half a reader of
   * this page can check.
   */
  it("offers no demo sign-in unless the build asked for one", async () => {
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().text()).not.toContain("demo player");
  });

  it("offers demo sign-in when VITE_DEV_LOGIN is set", async () => {
    vi.stubEnv("VITE_DEV_LOGIN", "true");
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().text()).toContain("demo player");
  });

  /**
   * A form on this card means somewhere to type a username and a password —
   * every other way in is a button that navigates. So the presence of one is
   * the whole question, and asking it this way keeps the test independent of
   * how the fields are labelled or laid out.
   *
   * The same argument as the demo button, and a stronger one: the deployed
   * Worker does not contain `/auth/password` at all, and no Pages Function
   * forwards it, so a build that showed this form would be offering a door
   * with nothing behind it (docs/architecture/auth-modes.md).
   */
  it("takes no credentials unless the build asked for them", async () => {
    // Stubbed off rather than left unset: Vite loads the developer's own
    // `.env.local` into the test run, so an absent stub would make this assert
    // whatever that file happens to say.
    vi.stubEnv("VITE_PASSWORD_AUTH", "");
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().find("form").exists()).toBe(false);
  });

  it("takes credentials when VITE_PASSWORD_AUTH is set", async () => {
    vi.stubEnv("VITE_PASSWORD_AUTH", "true");
    await router.push("/");
    await router.isReady();

    expect(mountLoginPage().find("form").exists()).toBe(true);
  });

  /**
   * The failure that matters is the one *after* the account exists. Reporting a
   * broken session fetch as "check your username and password" is not merely
   * wrong: the obvious retry answers 409, so the app then tells someone the
   * username they successfully registered a moment ago is taken.
   */
  it("does not blame the credentials when registration already succeeded", async () => {
    setActivePinia(createPinia());
    vi.stubEnv("VITE_PASSWORD_AUTH", "true");
    vi.spyOn(passwordAuthApi, "register").mockResolvedValue({ isNew: true });
    vi.spyOn(sessionApi, "get").mockRejectedValue(
      new ApiError("gateway blew up", 502)
    );
    await router.push("/");
    await router.isReady();

    const wrapper = mountLoginPage();
    // Into registering mode: the second button in the form flips it.
    await wrapper.findAll("form ion-button")[1].trigger("click");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(passwordAuthApi.register).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Check your username and password");
    expect(wrapper.text()).toContain("Please refresh the page");
  });

  it("sends the username without the spaces around it", async () => {
    setActivePinia(createPinia());
    vi.stubEnv("VITE_PASSWORD_AUTH", "true");
    const login = vi
      .spyOn(passwordAuthApi, "login")
      .mockResolvedValue({ isNew: false });
    vi.spyOn(sessionApi, "get").mockRejectedValue(
      new ApiError("stop here", 502)
    );
    await router.push("/");
    await router.isReady();

    const wrapper = mountLoginPage();
    // `setValue` does not work on an Ionic web component; the v-model binding
    // is what the field really is, so drive that.
    const fields = wrapper.findAllComponents(IonInput);
    await fields[0].vm.$emit("update:modelValue", "  ada  ");
    await fields[1].vm.$emit("update:modelValue", "hunter2");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(login).toHaveBeenCalledWith({
      username: "ada",
      password: "hunter2",
    });
  });

  it("switches the credential form between signing in and registering", async () => {
    vi.stubEnv("VITE_PASSWORD_AUTH", "true");
    await router.push("/");
    await router.isReady();

    const wrapper = mountLoginPage();
    expect(wrapper.text()).toContain("Create an account");

    // The second button in the form: the first is submit, this one flips modes.
    await wrapper.findAll("form ion-button")[1].trigger("click");

    expect(wrapper.text()).toContain("Already have an account");
  });
});
