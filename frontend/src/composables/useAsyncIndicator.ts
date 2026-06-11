import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface AsyncIndicatorTask {
  id: number;
  label: string;
  createdAt: number;
}

let nextTaskId = 1;

export const useAsyncIndicator = defineStore("asyncIndicator", () => {
  // ========== STATE ==========
  const tasks = ref<AsyncIndicatorTask[]>([]);

  // ========== GETTERS ==========
  const isVisible = computed(() => tasks.value.length > 0);

  // Show the newest task message if multiple are active concurrently.
  const currentTask = computed<AsyncIndicatorTask | null>(() => {
    if (tasks.value.length === 0) return null;
    return tasks.value[tasks.value.length - 1];
  });

  const label = computed(
    () => currentTask.value?.label ?? useI18n().t("asyncIndicator.loading")
  );

  // ========== ACTIONS ==========
  function startTask(labelText: string): number {
    const id = nextTaskId++;
    tasks.value = [
      ...tasks.value,
      { id, label: labelText, createdAt: Date.now() },
    ];
    return id;
  }

  function endTask(id: number) {
    tasks.value = tasks.value.filter((task) => task.id !== id);
  }

  async function trackTask<T>(
    labelText: string,
    task: () => Promise<T>
  ): Promise<T> {
    const id = startTask(labelText);
    try {
      return await task();
    } finally {
      endTask(id);
    }
  }

  return {
    tasks,
    isVisible,
    currentTask,
    label,
    startTask,
    endTask,
    trackTask,
  };
});
