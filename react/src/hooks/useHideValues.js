import { useEffect, useState } from "react";

export const useHideValues = () => {
  const [hideValues, setHideValues] = useState("");

  const setHide = (value) => {
    console.log("value =", value);
    window.localStorage.setItem("hideValues", value);
    setHideValues(value);
  };

  const hideValuesToggler = () =>
    Boolean(hideValues) ? setHide("") : setHide("true");

  useEffect(() => {
    const localHideValues = window.localStorage.getItem("hideValues");
    localHideValues && setHideValues(localHideValues);
  }, []);
  return hideValuesToggler;
};
