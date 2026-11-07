import { demoFrame, pixeldrop } from "@baret/content";
import type { Address } from "@baret/demo-evm/wallet";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useState } from "react";
import { AnalysisPanel } from "../kit/AnalysisPanel.js";
import { DemoBar } from "../kit/DemoBar.js";
import { SiteHero } from "../kit/site/Page.js";
import { Faq, Features, SiteFooter, Stats } from "../kit/site/Sections.js";
import { SiteHeader } from "../kit/site/SiteHeader.js";
import { useSiteView } from "../kit/site/useSiteView.js";
import { SiteViewPage } from "../kit/site/Views.js";
import { useCheck } from "../kit/useCheck.js";
import { exceeds, formatMon, useDemoWallet } from "../kit/wallet/useDemoWallet.js";
import { type SignRun, useSiteSign } from "../kit/wallet/useSiteSign.js";
import { PixelGlyph, VIEWS } from "./Glyph.js";
import { MintCard } from "./MintCard.js";
import { ART, parseQuantity, priceOf, SAMPLE } from "./sample.js";
import { costOf, LIVE_VALUES, SOURCE, signCalls } from "./source.js";

/**
 * PixelDrop: a mint page for the Night Shift collection in its own
 * risograph palette, with Baret's strip on top and Baret's panel behind the
 * main button.
 *
 * The story (pixeldrop.content.ts): honest, the button mints and one piece
 * arrives for 0.01 MON. In the attack version the same button grants another
 * address every piece you hold, now and later, and mints nothing. With a
 * wallet connected, Baret checks the real request from that address; without
 * one, the prepared sample (source.ts). That button
 * signs and sends nothing; "Sign with your wallet" under it sends the same
 * request to the connected wallet for real (kit/wallet/useSiteSign.tsx).
 */

const { site, analysis } = pixeldrop;

export function PixelDropSite(): JSX.Element {
  const [mode, setMode] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [quantity, setQuantity] = useState<string>(site.panel.start);
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { from, live, balance } = useDemoWallet();
  const { view, go } = useSiteView(VIEWS);
  const page = site.pages.views.find((v) => v.id === view);
  const sign = useSiteSign(pixeldrop.sign);

  /** The run "Sign with your wallet" starts; null when the quantity is refused. */
  function signRun(owner: Address): SignRun | null {
    const value = parseQuantity(quantity);
    if (value === null || value > SAMPLE.perWallet) {
      setError(value === null ? site.panel.errors.empty : site.panel.errors.tooHigh);
      return null;
    }
    setError(null);
    return {
      mode,
      calls: signCalls(mode, value, owner),
      values: { count: String(value), price: priceOf(value) },
      // The honest mint shows as one more piece; the approval moves no balance.
      ...(mode === "safe" ? { token: { address: LIVE_VALUES.contract, decimals: 0 } } : {}),
    };
  }

  function runCheck(version: DemoMode, pieces: number): void {
    setChecked(version);
    setCount(pieces);
    setConnected(true);
    setOpen(true);
    check.start({ mode: version, count: pieces, from });
  }

  /** False when the quantity is refused, so the card can move focus to it. */
  function mint(): boolean {
    const value = parseQuantity(quantity);
    if (value === null) {
      setError(site.panel.errors.empty);
      return false;
    }
    if (value > SAMPLE.perWallet) {
      setError(site.panel.errors.tooHigh);
      return false;
    }
    // Live, the mint is paid from the connected wallet: say so before Baret
    // simulates a payment the wallet cannot make.
    if (live && balance !== null && exceeds(costOf(mode, value), balance)) {
      setError(fill(demoFrame.wallet.short, { balance: formatMon(balance) }));
      return false;
    }
    setError(null);
    runCheck(mode, value);
    return true;
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next, count);
  }

  const modeCopy = analysis.modes[checked];
  // The honest ask names how many pieces; the attack asks for the collection.
  const many = checked === "safe" && count > 1 ? analysis.modes.safe.many : null;
  const values = {
    contract: live ? LIVE_VALUES.contract : SAMPLE.collection,
    operator: live ? LIVE_VALUES.operator : SAMPLE.operator,
    count: String(count),
    price: priceOf(count),
  };

  return (
    <>
      <DemoBar
        mode={mode}
        onMode={setMode}
        labels={{ safe: analysis.modes.safe.label, danger: analysis.modes.danger.label }}
        body={analysis.modes[mode].body}
      />
      <SiteHeader
        brand={site.brand}
        glyph={<PixelGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {page ? (
          <SiteViewPage view={page} note={site.pages.sampleNote} faqName="pixeldrop-page-faq" />
        ) : (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              body={site.hero.body}
              card={
                <MintCard
                  mode={mode}
                  onMode={setMode}
                  quantity={quantity}
                  onQuantity={(value) => {
                    setQuantity(value);
                    if (error) setError(null);
                  }}
                  error={error}
                  onMint={mint}
                  sign={sign.block(signRun, mode)}
                />
              }
            />
            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.hero} blocks={site.sections} />
            <Faq items={site.faq} name="pixeldrop-faq" title={demoFrame.site.faqTitle} />
          </>
        )}
      </main>

      <SiteFooter note={site.footer} hostname={site.hostname} />

      <AnalysisPanel
        open={open}
        onOpenChange={setOpen}
        state={check.state}
        live={live}
        mode={checked}
        image={checked === "safe" ? ART.safe : ART.danger}
        copy={{
          asks: fill(many?.asks ?? modeCopy.asks, values),
          call: fill(many?.call ?? modeCopy.call, values),
          expected: modeCopy.expected,
          expectedBody: fill(many?.expectedBody ?? modeCopy.expectedBody, values),
          claims: analysis.claims,
          without: analysis.without,
          lesson: analysis.lesson,
        }}
        onTryOther={tryOther}
      />
    </>
  );
}
