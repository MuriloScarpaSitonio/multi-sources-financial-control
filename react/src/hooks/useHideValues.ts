import { useState, useEffect, useCallback } from "react";
import { stringToBoolean } from "../helpers";

const STORAGE_KEY = "hideValues";

export function useHideValues() {
  const [hideValues, setHideValues] = useState<boolean>(() =>
    stringToBoolean(localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setHideValues(stringToBoolean(localStorage.getItem(STORAGE_KEY)));
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const toggle = useCallback(() => {
    setHideValues((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEY, String(newValue));
      window.dispatchEvent(new Event("storage")); // Force update across components
      return newValue;
    });
  }, []);

  return { hideValues, toggle };
}
