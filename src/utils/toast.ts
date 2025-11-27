export const toast = {
  success: (message: string, options?: { duration?: number }) => {
    try {
      const globalToast = (window as any).toast;
      if (globalToast?.success) {
        globalToast.success(message, options);
      } else {
        alert(message);
      }
    } catch {
      alert(message);
    }
  },
  error: (message: string, options?: { duration?: number }) => {
    try {
      const globalToast = (window as any).toast;
      if (globalToast?.error) {
        globalToast.error(message, options);
      } else {
        alert(message);
      }
    } catch {
      alert(message);
    }
  }
};
