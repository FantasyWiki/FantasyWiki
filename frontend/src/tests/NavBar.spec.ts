import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import {createPinia, Pinia} from 'pinia';
import router from "@/router/index";
import NavBar from '@/layout/NavBar.vue';

describe('NavBar.vue', () => {
  let pinia: Pinia;

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    pinia = createPinia();
  });

  it('should mount without any console errors or warnings', async () => {
    // Wait for router to be ready
    await router.push("/");
    await router.isReady();

    const wrapper = mount(NavBar, {
      global: {
        plugins: [router, pinia], // Add Pinia to plugins
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});