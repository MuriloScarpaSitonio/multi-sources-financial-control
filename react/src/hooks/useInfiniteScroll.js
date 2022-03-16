import { useEffect, useState } from "react";

export const useInfiniteScroll = (instance, url) => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoaded(false);
    instance
      .get(url)
      .then((response) => {
        setData((prevData) => [...prevData, ...response.data.results]);
        setHasMore(Boolean(response.data.next));
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoaded(true));
  }, [url, instance]);

  return [data, isLoaded, hasMore, error];
};
