import { describe, expect, it, vi } from "vitest";
import { emitSquareFocus, onSquareFocus } from "./focus-square";

describe("square focus events", () => {
  it("delivers the selected handle and can unsubscribe", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = onSquareFocus(target, listener);

    emitSquareFocus(target, "linear.app");
    unsubscribe();
    emitSquareFocus(target, "stripe.com");

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("linear.app");
  });
});
