import { useEffect, type DependencyList } from "react";
import { listen, type Event, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Безопасная подписка на Tauri event с защитой от race condition.
 * Если компонент размонтирован до резолва listen(), подписка будет
 * немедленно отменена.
 */
export function useTauriListener<T>(
  eventName: string,
  handler: EventCallback<T>,
  deps: DependencyList = [],
) {
  useEffect(() => {
    let disposed = false;
    let unlistenFn: UnlistenFn | null = null;

    listen<T>(eventName, ((event: Event<T>) => {
      handler(event);
    }) as EventCallback<T>).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      disposed = true;
      unlistenFn?.();
    };
  }, deps);
}
