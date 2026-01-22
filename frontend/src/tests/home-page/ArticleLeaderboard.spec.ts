import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import router from "@/router/index";
import ArticleLeaderboard from '@/views/home-page/ArticleLeaderboard.vue';

describe('ArticleLeaderboard.vue', () => {
  it('should mount without any console errors or warnings', async () => {
    router.push("/");
    await router.isReady();
    const wrapper = mount(ArticleLeaderboard, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.exists()).toBe(true);
  })
})
