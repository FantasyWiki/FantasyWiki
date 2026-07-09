import { toastController } from "@ionic/vue";

type ToastColor = "success" | "danger" | "primary" | "medium" | "dark";

// Bottom toasts would cover the mobile navigation footer. Ionic keeps the
// previous pages (each with its own NavBar footer) mounted but display:none
// in the router outlet, so several footers can be in the DOM at once —
// anchor to the one that is actually visible. offsetParent is null for the
// hidden ones and on desktop widths, where the default bottom position is
// fine.
function bottomAnchor(): HTMLElement | undefined {
  const footers = document.querySelectorAll<HTMLElement>(
    "ion-footer.mobile-nav-footer"
  );
  return Array.from(footers).find((footer) => footer.offsetParent !== null);
}

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
      positionAnchor: bottomAnchor(),
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
      positionAnchor: bottomAnchor(),
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
