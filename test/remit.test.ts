import { describe, it, expect, vi } from "vitest";
import { ANY_EVENT, Remitter } from "../src/main";

describe("remit", () => {
  it("should run prepare when first listener is added", () => {
    const spy1Disposer = vi.fn();
    const spy1 = vi.fn(() => spy1Disposer);
    const spy2Disposer = vi.fn();
    const spy2 = vi.fn(() => spy2Disposer);
    const spy3 = vi.fn();
    const remitter = new Remitter<{ event1: number }>();

    remitter.remit("event1", spy1);

    // @ts-expect-error - no event2
    remitter.remit("event2", spy2);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    remitter.emit("event1", 1);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    remitter.on("event1", spy3);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    expect(spy1).lastCalledWith(remitter);
    expect(spy3).toHaveBeenCalledTimes(0);

    spy1.mockClear();

    remitter.off("event1", spy3);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    expect(spy1Disposer).lastCalledWith(undefined);
    expect(spy3).toHaveBeenCalledTimes(0);
  });

  it("should dispose remit", () => {
    const spy1Disposer = vi.fn();
    const spy1 = vi.fn(() => spy1Disposer);

    const remitter = new Remitter<{
      event1: number;
    }>();

    const dispose1 = remitter.remit("event1", spy1);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);

    dispose1();

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);

    const spy2 = vi.fn();
    remitter.on("event1", spy2);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.off("event1", spy2);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    const dispose2 = remitter.remit("event1", spy1);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.on("event1", spy2);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    dispose2();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.off("event1", spy2);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(0);
  });

  it("should support pure `start` callback", () => {
    type OtherEventListener = (v: string) => void;
    const otherEventListeners = new Set<OtherEventListener>();
    const otherEvent = {
      addListener: vi.fn((listener: OtherEventListener) =>
        otherEventListeners.add(listener)
      ),
      removeListener: vi.fn((listener: OtherEventListener) =>
        otherEventListeners.delete(listener)
      ),
      emit: vi.fn((value: string) =>
        otherEventListeners.forEach(listener => listener(value))
      ),
    };

    interface RemitterConfig {
      event1: string;
    }

    const pureStartCallback = (remitter: Remitter<RemitterConfig>) => {
      const handler = (value: string) => {
        remitter.emit("event1", "remitter-" + value);
      };
      otherEvent.addListener(handler);
      return () => otherEvent.removeListener(handler);
    };

    const remitter = new Remitter<RemitterConfig>();

    remitter.remit("event1", pureStartCallback);

    expect(otherEvent.addListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.removeListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.emit).toHaveBeenCalledTimes(0);

    otherEvent.emit("other-event1");

    expect(otherEvent.addListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.removeListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.emit).toHaveBeenCalledTimes(1);
    expect(otherEvent.emit).lastCalledWith("other-event1");

    const spy1 = vi.fn();
    remitter.on("event1", spy1);

    expect(otherEvent.addListener).toHaveBeenCalledTimes(1);
    expect(otherEvent.removeListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.emit).toHaveBeenCalledTimes(1);
    expect(otherEvent.emit).lastCalledWith("other-event1");
    expect(spy1).toHaveBeenCalledTimes(0);

    otherEvent.emit("other-event2");

    expect(otherEvent.addListener).toHaveBeenCalledTimes(1);
    expect(otherEvent.removeListener).toHaveBeenCalledTimes(0);
    expect(otherEvent.emit).toHaveBeenCalledTimes(2);
    expect(otherEvent.emit).lastCalledWith("other-event2");
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1).lastCalledWith("remitter-other-event2");
  });

  it("should start remit immediately if eventName exists listeners", () => {
    const spy1Disposer = vi.fn();
    const spy1 = vi.fn(() => spy1Disposer);
    const spy2 = vi.fn();
    const remitter = new Remitter<{ event1: number; event2: number }>();

    remitter.on("event1", spy2);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.remit("event2", spy1);

    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.remit("event1", spy1);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);

    remitter.dispose();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy1Disposer).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(0);
  });

  it("should catch error on listener", () => {
    const consoleErrorMock = vi
      .spyOn(console, "error")
      .mockImplementation(() => void 0);

    const error1 = new Error("error1");
    const error2 = new Error("error2");
    const error3 = new Error("error3");

    const remitter = new Remitter<{
      event1: number;
      event2: number;
      event3: number;
    }>();
    remitter.on("event1", () => {
      throw error1;
    });
    remitter.remit("event2", () => {
      throw error2;
    });
    remitter.remit("event3", () => {
      return () => {
        throw error3;
      };
    });

    expect(consoleErrorMock).toHaveBeenCalledTimes(0);

    remitter.emit("event1", 1);

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).lastCalledWith(error1);

    consoleErrorMock.mockClear();

    remitter.on("event2", () => void 0);

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).lastCalledWith(error2);

    consoleErrorMock.mockClear();

    remitter.on("event3", () => void 0);

    expect(consoleErrorMock).toHaveBeenCalledTimes(0);

    remitter.dispose();

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).lastCalledWith(error3);

    consoleErrorMock.mockRestore();
  });

  it("should remit by all emitter listeners", () => {
    const spyRemitDisposer = vi.fn();
    const spyRemit = vi.fn(() => spyRemitDisposer);

    const spy1Disposer = vi.fn();
    const spy1 = vi.fn(() => spy1Disposer);

    const spy2Disposer = vi.fn();
    const spy2 = vi.fn(() => spy2Disposer);

    interface EventData {
      event1: number;
      event2: string;
    }
    const remitter = new Remitter<EventData>();

    remitter.remitAny(spyRemit);

    expect(spyRemit).toHaveBeenCalledTimes(0);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    remitter.emit("event1", 1);

    expect(spyRemit).toHaveBeenCalledTimes(0);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    remitter.on("event1", spy1);

    expect(spyRemit).toHaveBeenCalledTimes(1);
    expect(spyRemit).lastCalledWith(remitter);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    spyRemit.mockClear();

    remitter.on("event2", spy2);

    expect(spyRemit).toHaveBeenCalledTimes(0);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    spyRemit.mockClear();

    remitter.off("event1", spy1);

    expect(spyRemit).toHaveBeenCalledTimes(0);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);

    remitter.off("event2", spy2);

    expect(spyRemit).toHaveBeenCalledTimes(0);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(1);
    expect(spyRemitDisposer).lastCalledWith(undefined);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
    expect(spy2).toHaveBeenCalledTimes(0);
    expect(spy2Disposer).toHaveBeenCalledTimes(0);
  });

  it("should remit ANY_EVENT if listener count > 0", () => {
    const spyRemitDisposer = vi.fn();
    const spyRemit = vi.fn(() => spyRemitDisposer);

    const spy1Disposer = vi.fn();
    const spy1 = vi.fn(() => spy1Disposer);

    interface EventData {
      event1: number;
      event2: string;
    }
    const remitter = new Remitter<EventData>();

    remitter.on("event1", spy1);

    remitter.remitAny(spyRemit);

    expect(spyRemit).toHaveBeenCalledTimes(1);
    expect(spyRemitDisposer).toHaveBeenCalledTimes(0);
    expect(spy1).toHaveBeenCalledTimes(0);
    expect(spy1Disposer).toHaveBeenCalledTimes(0);
  });

  it("should remit a remitter", () => {
    interface SourceEventData {
      a: number;
      b: string;
    }
    const source = new Remitter<SourceEventData>();

    interface RemitterEventData {
      c: number;
      d: string;
    }
    const remitter = new Remitter<RemitterEventData>();

    remitter.remit(remitter.ANY_EVENT, () =>
      source.on(source.ANY_EVENT, ({ event, data }) => {
        if (event === "a") {
          remitter.emit("c", data);
        } else if (event === "b") {
          remitter.emit("d", data);
        }
      })
    );

    const spy = vi.fn();
    remitter.once("c", spy);

    expect(spy).toHaveBeenCalledTimes(0);

    source.emit("a", 1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith(1);

    source.emit("a", 2);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
