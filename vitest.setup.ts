import "@testing-library/jest-dom/vitest";

// jsdom does not implement IntersectionObserver, which motion's `whileInView`
// (used by components/motion/reveal.tsx) relies on. Minimal stub so components
// using it can mount in tests; it never fires, so it doesn't affect assertions.
class IntersectionObserverStub {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
