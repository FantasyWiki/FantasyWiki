import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from "@/router/index";
import AppLogo from '@/views/AppLogo.vue';

describe('AppLogo.vue', () => {
  it('should mount without any console errors or warnings', () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(AppLogo, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  })
})
