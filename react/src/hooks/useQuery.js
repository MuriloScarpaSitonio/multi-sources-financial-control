import { useEffect, useState } from "react";

export const useQuery = (instance, url) => {
  const [data, setData] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let typingDelay = setTimeout(() => {
      setIsLoaded(false);
      instance
        .get(url)
        .then((response) => setData(response.data))
        .catch((err) => setError(err))
        .finally(() => setIsLoaded(true));
    }, 600);
    return () => clearTimeout(typingDelay);
  }, [url, instance]);

  return [data, isLoaded, error];
};
