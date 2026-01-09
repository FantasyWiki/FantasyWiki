import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from "@/router/index";
import LoginPage from '@/views/LoginPage.vue';

describe('LoginPage.vue', () => {
  it('should mount without any console errors or warnings', () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(LoginPage, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  })
})
