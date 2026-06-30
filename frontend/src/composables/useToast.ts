import { toastController } from "@ionic/vue";

type ToastColor = "success" | "danger" | "primary" | "medium" | "dark";

export function useToast() {
  async function show(
    message: string,
    color: ToastColor = "primary",
    duration = 3000
  ) {
    const toast = await toastController.create({
      message,
      color,
      duration,
      position: "bottom",
    });
    await toast.present();
  }

  // Shows a toast that stays until the returned dismiss function is called.
  // present() is intentionally not awaited so the dismiss fn is returned as
  // soon as the element exists — callers can cancel it without waiting for
  // the enter animation to finish.
  async function showPersistent(
    message: string,
    color: ToastColor = "primary"
  ): Promise<() => Promise<void>> {
    const toast = await toastController.create({
      message,
      color,
      duration: 0,
      position: "bottom",
    });
    void toast.present();
    return async () => {
      await toast.dismiss();
    };
  }

  return {
    showSuccess: (message: string) => show(message, "success"),
    showError: (message: string) => show(message, "danger"),
    show,
    showPersistent,
  };
}
