import { useEffect } from "react";

export function VhFixProvider() {
  useEffect(() => {
    const update = () => {
      const vh = (window.visualViewport?.height ?? window.innerHeight) / 100;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return null;
}
