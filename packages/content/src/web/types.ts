/**
 * Shapes the web app's page copy satisfies (ported from Baret-Metropolis content/types.ts).
 * A demo site's file satisfies `ScenarioSite`, so one set of components renders every site.
 */
/**
 * Shared building blocks for every content file.
 *
 * These types describe the SHAPE of copy, never how it looks. A content file
 * may nest them freely. Nothing here knows about React, routes or styling.
 */

/** A button or link. `href` is omitted when the button triggers an action. */
export interface Action {
  label: string;
  href?: string;
  /** Small print under or beside the button. */
  note?: string;
}

/** A heading and a paragraph. The unit almost every section is built from. */
export interface Block {
  title: string;
  body: string;
}

/** A block with supporting bullet points. */
export interface Feature extends Block {
  points?: readonly string[];
}

/** One step in a flow, numbered by its position in the array. */
export interface Step extends Block {
  /** Two or three words for a progress indicator. */
  short?: string;
  action?: Action;
}

/** A question and its answer. */
export interface Faq {
  question: string;
  answer: string;
}

/** What a screen says when it has nothing to show yet. */
export interface EmptyState {
  title: string;
  body: string;
  action?: Action;
}

/** What a screen says when something went wrong. Always name the next move. */
export interface ErrorState {
  title: string;
  body: string;
  action?: Action;
}

/** Document head. Used for the browser tab and link previews. */
export interface Meta {
  title: string;
  description: string;
}

/** A marketing section: small label above, heading, paragraph. */
export interface Section extends Block {
  eyebrow?: string;
}

/** One row in a settings list: the label and the current-state line under it. */
export interface SettingsRow {
  label: string;
  hint: string;
}

/** One row in a two-column comparison table. */
export interface ComparisonRow {
  aspect: string;
  without: string;
  with: string;
}

/** The four states a verdict can take. */
export type VerdictKind = "safe" | "caution" | "blocked" | "unreachable";

/** A named threat demo on the showcase. */
export interface Scenario {
  /** Route slug, also the folder name. */
  slug: string;
  /** The fake product's display name. */
  name: string;
  /** What the fake product claims to be. */
  category: string;
  /** One line of the fake product's own marketing. */
  tagline: string;
  /** What the demo does, in our voice. */
  summary: string;
  /** Three things the analysis will flag. */
  watchFor: readonly string[];
  /** The class of attack, for the filter chips. */
  threatClass: string;
  /** Why this attack works on real people. */
  whyItMatters: string;
  /** The verdict the user should expect to see. */
  verdict: VerdictKind | "capped";
}

/**
 * One threat scenario page on the showcase. The six files in showcase/ satisfy
 * this, so one component renders all six. Three layers, in page order:
 *
 *   scenario  the story, in Baret's voice. Also the card on the hub.
 *   site      the fake product's own voice. Convincing on purpose, and the
 *             same in both versions: only the transaction changes.
 *   analysis  Baret's framing around the live result. Labels, the expected
 *             verdict and the lesson. Never a finding: findings come live from
 *             shared/findings.
 *
 * Copy that is identical on all six pages (the frame, the panel labels, the
 * empty and error states) lives in web/demo.content.ts.
 */
/** A demo dApp's secondary pages. Every figure on them is sample data. */
export interface SitePages {
  /** Shown above every secondary page: the figures are not live. */
  sampleNote: string;
  pools: {
    title: string;
    body: string;
    columns: { pair: string; tvl: string; volume: string; fee: string };
    action: string;
    items: readonly { pair: string; tvl: string; volume: string; fee: string }[];
  };
  stats: {
    title: string;
    body: string;
    chart: {
      title: string;
      caption: string;
      unit: string;
      days: readonly string[];
      values: readonly number[];
    };
    top: { title: string; items: readonly { label: string; value: string }[] };
  };
  docs: {
    title: string;
    body: string;
    toc: string;
    contract: { label: string; note: string };
    sections: readonly { id: string; title: string; body: string }[];
  };
}

/** A row of a secondary page's list: a short label, a title and one sentence. */
export interface SiteListItem {
  label: string;
  title: string;
  body: string;
}

/**
 * One secondary page of a demo site, by kind. One renderer draws every kind
 * in the landing's grammar (a title, one paragraph, rows on hairlines), so a
 * site only writes its copy.
 */
export type SiteView = { id: string; title: string; body: string } & (
  | {
      kind: "table";
      columns: readonly string[];
      /** One string per column. The first cell is the row's heading. */
      rows: readonly (readonly string[])[];
    }
  | {
      kind: "chart";
      chart: {
        title: string;
        caption: string;
        unit: string;
        days: readonly string[];
        values: readonly number[];
      };
      top: { title: string; items: readonly { label: string; value: string }[] };
    }
  | {
      kind: "docs";
      toc: string;
      /** A section may carry a short code sample, shown as written. */
      sections: readonly { id: string; title: string; body: string; code?: string }[];
    }
  | { kind: "list"; items: readonly SiteListItem[] }
  | { kind: "faq"; items: readonly Faq[] }
  | {
      kind: "shares";
      /** Percentages that add up to 100, drawn as one bar and listed below it. */
      items: readonly { label: string; value: number; body: string }[];
    }
);

/**
 * Another demo site's secondary pages: one view per nav item after the
 * first, in nav order. Every figure on them is sample data, and `sampleNote`
 * says so above each page.
 */
export interface SiteViews {
  sampleNote: string;
  views: readonly SiteView[];
}

/** What a demo card says when its one input cannot be used. */
export interface SiteInputErrors {
  empty?: string;
  /** Text that is not what the input takes (an address that is not one). */
  invalid?: string;
  /** Above the balance, or above the most the site takes. */
  tooHigh?: string;
  /** Below the least the site takes. */
  tooLow?: string;
}

/**
 * A demo site's "Sign with your wallet": the label of each step the wallet
 * is asked for, the token whose balance is read before and after ("" when no
 * balance says anything), and the sentence under a run that went through.
 */
export interface SiteSign {
  token: string;
  steps: Record<"safe" | "danger", readonly string[]>;
  outcome: Record<"safe" | "danger", string>;
}

export interface ScenarioSite {
  meta: Meta;
  scenario: Scenario & { threatClass: "drainer" | "trap" | "agent" };
  site: {
    brand: string;
    /** A made-up hostname on the reserved .example domain. Never a real one. */
    hostname: string;
    nav: readonly string[];
    /** The fake site's wallet control. Pressing it fills in a sample address. */
    connect?: { label: string; connected: string };
    hero: { badge: string; title: string; body: string; cta: string };
    /** The main card: the swap form, the mint box, the question box. */
    panel: {
      title: string;
      /** Placeholder text of the card's one input. */
      input: string;
      rows: readonly { label: string; value: string }[];
      cta: string;
      note: string;
      /** Label for the wallet balance shown next to the input. */
      balance?: string;
      /** The control that fills the whole balance. */
      max?: string;
      /** The card's input as the page opens, so the demo works in one press. */
      start?: string;
      /** The input's visible label and a line under it, when the placeholder alone would not say. */
      label?: string;
      hint?: string;
      /** The hint once a real wallet is connected (ClaimHub's eligibility field). */
      hintConnected?: string;
      /** Label for what the amount buys, when no row says it (LaunchPad's LNTL). */
      receive?: string;
      /** Validation messages for the card's one input. */
      errors?: SiteInputErrors;
    };
    stats: readonly { value: string; label: string }[];
    sections: readonly Block[];
    faq: readonly Faq[];
    /** The site's own progress line while the request runs. */
    progress: readonly string[];
    /** What the site says once you sign. The same in both versions. */
    done: Block;
    footer: string;
    /** The fake site's other pages, one per nav item after the first. */
    pages?: SitePages | SiteViews;
    /**
     * The card in the attack version, when it asks for something other than
     * the honest card (NovaSwap: a dUSDC sale behind "enable trading"), and
     * the switch at the bottom of the card that turns it on.
     */
    attack?: {
      switch: { label: string; on: string; off: string };
      input?: string;
      rows?: readonly { label: string; value: string }[];
      cta?: string;
      note?: string;
      errors?: SiteInputErrors;
      /** Anything else the site's attack card needs (an agent loop, a counter). */
      readonly [key: string]: unknown;
    };
  };
  analysis: {
    /** The two versions. Same page, same button, a different transaction. */
    modes: Record<
      "safe" | "danger",
      {
        /** Label on the version switch. */
        label: string;
        /** What this version builds, in one or two sentences. */
        body: string;
        /** "{Site} wants you to ...". Placeholders are filled live. */
        asks: string;
        /** The function the site calls, shown in mono. */
        call: string;
        /** `asks`, `call` and `expectedBody` for more than one item, when the card takes a quantity ({count}). */
        many?: { asks: string; call: string; expectedBody: string };
        /** The verdict this version should get under the Balanced rules. */
        expected: VerdictKind | "capped";
        /** Why that verdict is expected. Framed as expected, never as found. */
        expectedBody: string;
      }
    >;
    /** "The site says" beside "Baret checks". */
    claims: readonly { claim: string; check: string }[];
    /** What to look at before pressing the button. */
    watch: Block;
    /** What the attack version would do if it were signed. */
    without: Block;
    /** One takeaway the reader can use on any site. */
    lesson: Block;
    /** Only SCRYBE has this: the agent's run of payments against the cap, in the panel. */
    run?: { title: string; payment: string; paid: string; total: string };
  };
  /** Only SCRYBE has this: the bridge to the agents page. */
  cta?: Block & { action: Action };
}
