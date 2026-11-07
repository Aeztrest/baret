import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { readTokenBalance } from "./store.js";

/**
 * One ERC-20 balance of `owner`, read from Monad testnet: null with no
 * owner, until read, or when unreadable. A read that is no longer the latest
 * is dropped, so a slow answer for an earlier address never shows.
 * `refresh` always reads the current owner, even when a caller kept it
 * from an earlier render (a run that ended after the account changed).
 */
export function useTokenBalance(
  token: Address,
  owner: Address | null,
): { value: bigint | null; refresh: () => void } {
  const [value, setValue] = useState<bigint | null>(null);
  const latest = useRef(0);

  const load = useCallback(() => {
    latest.current += 1;
    const id = latest.current;
    if (owner === null) {
      setValue(null);
      return;
    }
    readTokenBalance(token, owner).then(
      (next) => {
        if (latest.current === id) setValue(next);
      },
      () => {
        if (latest.current === id) setValue(null);
      },
    );
  }, [token, owner]);

  const current = useRef(load);
  current.current = load;
  const refresh = useCallback(() => current.current(), []);

  useEffect(() => {
    setValue(null);
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  return { value, refresh };
}
