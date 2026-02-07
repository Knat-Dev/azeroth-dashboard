import { useState, useEffect, useRef } from "react";

export function useDebounce(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  return debounced;
}
