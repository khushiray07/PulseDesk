import { useEffect, useReducer, useState } from 'react';
import { api } from '../services/api.js';

export function useResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [revision, refresh] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: null });
    api.get(path, { signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted) setState({ data: response.data.data, loading: false, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ data: null, loading: false, error });
    });
    return () => controller.abort();
  }, [path, revision]);
  return { ...state, refresh };
}
