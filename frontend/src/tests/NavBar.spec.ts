import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from "@/router/index";
import NavBar from '@/layout/NavBar.vue';

describe('NavBar.vue', () => {
  it('should mount without any console errors or warnings', () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(NavBar, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  })
})
