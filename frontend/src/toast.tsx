type ToastContent = React.ReactNode;

interface ToastMethods {
  success(content: ToastContent): void;
  error(content: ToastContent): void;
  warn(content: ToastContent): void;
  info(content: ToastContent): void;
}

declare global {
  interface Native {
    showToast(level: string, content: string): void;
  }
  interface Window {
    _native?: Native;
  }
}

let toast: ToastMethods;
let createToastContainer: () => React.ReactNode;

if (import.meta.env.USE_NATIVE_TOAST) {
  function method(level: string) {
    return (content: ToastContent) => {
      if (!content)
        return;
      if (window._native) {
        window._native.showToast(level, content.toString());
      } else {
        console.log(`[toast:${level}]`, content);
      }
    };
  }

  toast = {
    success: method("success"),
    error: method("error"),
    warn: method("warn"),
    info: method("info"),
  };

  createToastContainer = () => {
    return null;
  };
} else {
  const reactToastify = await import("react-toastify");
  await import("react-toastify/dist/ReactToastify.css");

  toast = reactToastify.toast;

  createToastContainer = () => {
    return (
      <reactToastify.ToastContainer
        className="toast-container"
        position="bottom-right"
        theme="dark"
      />
    );
  };
}

export { toast, createToastContainer };
