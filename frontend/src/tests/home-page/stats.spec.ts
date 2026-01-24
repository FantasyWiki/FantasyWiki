import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from "@/router/index";
import AppStats from '@/views/home-page/AppStats.vue';

describe('home-page/stats.vue', () => {
  it('should mount without any console errors or warnings', () => {
    router.push("/");
    router.isReady().then(() => {
      const wrapper = mount(AppStats, {
        global: {
          plugins: [router],
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  })
})
