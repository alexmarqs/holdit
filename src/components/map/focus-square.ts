const EVENT = "holdit:focus-square";

export function emitSquareFocus(target: EventTarget, handle: string) {
  target.dispatchEvent(new CustomEvent(EVENT, { detail: handle }));
}

export function onSquareFocus(target: EventTarget, listener: (handle: string) => void) {
  const receive = (event: Event) => listener((event as CustomEvent<string>).detail);
  target.addEventListener(EVENT, receive);
  return () => target.removeEventListener(EVENT, receive);
}
