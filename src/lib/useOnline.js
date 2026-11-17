import { useSyncExternalStore } from "react";

// True while the browser has a network connection. The app keeps working either way,
// because all data lives in localStorage and the app files are cached by the service worker.
const subscribe = (cb) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
