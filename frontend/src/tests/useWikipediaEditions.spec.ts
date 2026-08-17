import { describe, it, expect, beforeEach } from "vitest";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount, flushPromises } from "@vue/test-utils";
import { useWikipediaEditions } from "@/composables/useWikipediaEditions";

/**
 * The search a player uses to find their language among ~348 editions. Mounted
 * inside a throwaway component because the composable owns a `useQuery`, which
 * needs an app context.
 */
function withComposable(search: ReturnType<typeof ref<string>>) {
  let api: ReturnType<typeof useWikipediaEditions> | null = null;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  mount(
    {
      setup() {
        api = useWikipediaEditions(search as never);
        return () => null;
      },
    },
    { global: { plugins: [createPinia(), [VueQueryPlugin, { queryClient }]] } }
  );
  return () => api!;
}

describe("useWikipediaEditions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("matches on the autonym, the English name and the code", async () => {
    const search = ref("");
    const get = withComposable(search);
    await flushPromises();

    // All three are things a player might type: the name in that edition's own
    // language, its English name, or the code if they know them.
    for (const [needle, code] of [
      ["italiano", "it"],
      ["German", "de"],
      ["ja", "ja"],
    ] as const) {
      search.value = needle;
      await flushPromises();
      expect(get().matching.value.map((e) => e.code)).toContain(code);
    }
  });

  it("ignores case and accents, so `espanol` finds `español`", async () => {
    const search = ref("espanol");
    const get = withComposable(search);
    await flushPromises();

    expect(get().matching.value.map((e) => e.code)).toContain("es");
  });

  it("offers the whole list when nothing is typed", async () => {
    const search = ref("");
    const get = withComposable(search);
    await flushPromises();

    expect(get().matching.value.length).toBeGreaterThan(1);
    expect(get().matching.value).toEqual(get().editions.value);
  });
});
