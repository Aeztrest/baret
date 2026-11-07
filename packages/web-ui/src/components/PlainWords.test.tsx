import { explain } from "@baret/content";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearExplainCache, EXPLAIN_RETRY_MS } from "../lib/explain.js";
import { LOADING_DELAY_MS, PlainWords } from "./PlainWords.js";

/** English placeholder text for every language; the test checks the request and the lang attribute. */
const answer = (language: string) => ({
  decision: "caution",
  explanation: {
    headline: `Headline in ${language}`,
    summary: "The spender is new.",
    points: ["It was deployed today."],
    advice: "Lower the amount.",
  },
  language,
  model: { provider: "kimi", name: "kimi-k2" },
});

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const asked = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(
    ([, init]) =>
      (JSON.parse((init as RequestInit).body as string) as { language: string }).language,
  );

beforeEach(() => {
  clearExplainCache();
  vi.stubGlobal("navigator", { ...navigator, language: "en-US" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch that answers only when the test says so. */
function held() {
  let release: (response: Response) => void = () => undefined;
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  return { fetchMock, release: (response: Response) => release(response) };
}

describe("PlainWords", () => {
  it("shows nothing at first, the loading line after a moment, then the text with its lang attribute", async () => {
    const { fetchMock, release } = held();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PlainWords requestId="req-1" />);
    expect(container.innerHTML).toBe("");
    const loading = await screen.findByRole("status", {}, { timeout: LOADING_DELAY_MS + 1000 });
    expect(loading.textContent).toBe(explain.loading);
    release(respond(200, answer("en")));
    const headline = await screen.findByText("Headline in en");
    expect(headline.closest("[lang]")?.getAttribute("lang")).toBe("en");
    expect(screen.getByText(explain.title)).toBeTruthy();
    expect(screen.getByText(explain.byline)).toBeTruthy();
    expect(screen.getByText("It was deployed today.")).toBeTruthy();
  });

  it("renders nothing when the server answers 503", async () => {
    const fetchMock = vi.fn(async () => respond(503, { error: "unavailable" }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PlainWords requestId="req-2" />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing and asks nothing with no request id", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PlainWords requestId={null} />);
    expect(container.innerHTML).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once per language and not again when switching back", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { language } = JSON.parse(init.body as string) as { language: string };
      return respond(200, answer(language));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PlainWords requestId="req-3" />);
    await screen.findByText("Headline in en");

    fireEvent.click(screen.getByRole("radio", { name: explain.languages.tr }));
    const tr = await screen.findByText("Headline in tr");
    expect(tr.closest("[lang]")?.getAttribute("lang")).toBe("tr");

    fireEvent.click(screen.getByRole("radio", { name: explain.languages.en }));
    expect(screen.getByText("Headline in en")).toBeTruthy();
    expect(asked(fetchMock)).toEqual(["en", "tr"]);
  });

  it("keeps the switch when a later language fails, and switching back shows the cached answer", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { language } = JSON.parse(init.body as string) as { language: string };
      return language === "en"
        ? respond(200, answer("en"))
        : respond(503, { error: "unavailable" });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PlainWords requestId="req-4" />);
    await screen.findByText("Headline in en");

    const tr = screen.getByRole("radio", { name: explain.languages.tr });
    fireEvent.click(tr);
    await screen.findByText(explain.unavailable);
    expect(screen.getByRole("group", { name: explain.languageLabel })).toBeTruthy();
    expect(screen.getByRole("radio", { name: explain.languages.tr })).toBe(tr);

    fireEvent.click(screen.getByRole("radio", { name: explain.languages.en }));
    expect(screen.getByText("Headline in en")).toBeTruthy();
    expect(asked(fetchMock)).toEqual(["en", "tr"]);
  });

  it("renders nothing for an answer about another verdict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, answer("en"))),
    );
    const { container } = render(<PlainWords requestId="req-5" verdict="safe" />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("puts the wrapper on only while the block renders", async () => {
    const { fetchMock, release } = held();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <PlainWords requestId="req-6" wrap={(block) => <div data-testid="wrap">{block}</div>} />,
    );
    expect(screen.queryByTestId("wrap")).toBeNull();
    await screen.findByTestId("wrap", {}, { timeout: LOADING_DELAY_MS + 1000 });
    release(respond(503, { error: "unavailable" }));
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("never flashes in when the server says no at once (no key)", async () => {
    const fetchMock = vi.fn(async () => respond(503, { error: "explain_unavailable" }));
    vi.stubGlobal("fetch", fetchMock);
    const wrap = vi.fn((block: ReactNode) => <div>{block}</div>);
    const { container } = render(<PlainWords requestId="req-7" wrap={wrap} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, LOADING_DELAY_MS + 200));
    expect(wrap).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
  });
});

describe("PlainWords after a failure", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lets the fetch mock settle and runs timers up to `ms` from now. */
  const pass = (ms = 0) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("asks nothing within the minute, once after it, and again on a later mount", async () => {
    const fetchMock = vi.fn(async () => respond(503, { error: "explain_unavailable" }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<PlainWords requestId="req-8" />);
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = render(<PlainWords requestId="req-8" />);
    await pass(EXPLAIN_RETRY_MS / 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.container.innerHTML).toBe("");
    await pass(EXPLAIN_RETRY_MS / 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await pass(EXPLAIN_RETRY_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.container.innerHTML).toBe("");
    second.unmount();

    render(<PlainWords requestId="req-8" />);
    await pass();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows the answer when the retry after the minute succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(503, { error: "explain_unavailable" }))
      .mockResolvedValueOnce(respond(200, answer("en")));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<PlainWords requestId="req-9" />);
    await pass(LOADING_DELAY_MS + 100);
    expect(container.innerHTML).toBe("");
    await pass(EXPLAIN_RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Headline in en")).toBeTruthy();
  });

  it("never asks again after a 404 verdict_unknown", async () => {
    const fetchMock = vi.fn(async () => respond(404, { error: "verdict_unknown" }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<PlainWords requestId="req-10" />);
    await pass(EXPLAIN_RETRY_MS * 2);
    expect(first.container.innerHTML).toBe("");
    first.unmount();
    render(<PlainWords requestId="req-10" />);
    await pass(EXPLAIN_RETRY_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the failed line after an earlier answer and retries that language once a minute", async () => {
    let trWorks = false;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { language } = JSON.parse(init.body as string) as { language: string };
      return language === "en" || trWorks
        ? respond(200, answer(language))
        : respond(503, { error: "explain_unavailable" });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PlainWords requestId="req-11" />);
    await pass();
    expect(screen.getByText("Headline in en")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: explain.languages.tr }));
    await pass();
    expect(screen.getByRole("status").textContent).toBe(explain.unavailable);

    fireEvent.click(screen.getByRole("radio", { name: explain.languages.en }));
    await pass();
    fireEvent.click(screen.getByRole("radio", { name: explain.languages.tr }));
    await pass(EXPLAIN_RETRY_MS / 2);
    expect(screen.getByRole("status").textContent).toBe(explain.unavailable);
    expect(asked(fetchMock)).toEqual(["en", "tr"]);

    trWorks = true;
    await pass(EXPLAIN_RETRY_MS / 2);
    expect(asked(fetchMock)).toEqual(["en", "tr", "tr"]);
    expect(screen.getByText("Headline in tr")).toBeTruthy();
  });
});
