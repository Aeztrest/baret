import { demoFrame, launchpad } from "@baret/content";
import type { Address } from "@baret/demo-evm/wallet";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useState } from "react";
import { AnalysisPanel } from "../kit/AnalysisPanel.js";
import { parseAmount, toWei } from "../kit/amount.js";
import { DemoBar } from "../kit/DemoBar.js";
import { SiteHero } from "../kit/site/Page.js";
import { Faq, Features, SiteFooter, Stats } from "../kit/site/Sections.js";
import { SiteHeader } from "../kit/site/SiteHeader.js";
import { useSiteView } from "../kit/site/useSiteView.js";
import { SiteViewPage } from "../kit/site/Views.js";
import { useCheck } from "../kit/useCheck.js";
import { exceeds, formatMon, useDemoWallet } from "../kit/wallet/useDemoWallet.js";
import { type SignRun, useSiteSign } from "../kit/wallet/useSiteSign.js";
import { ContributeCard } from "./ContributeCard.js";
import { LaunchGlyph, VIEWS } from "./Glyph.js";
import { ART, limitOf, SAMPLE, saleOf } from "./sample.js";
import { liveSaleOf, SALE_TOKEN, SOURCE, signCalls } from "./source.js";

/**
 * LaunchPad: a token sale page in its own plum palette, with Baret's strip
 * on top and Baret's panel behind the main button.
 *
 * The story (launchpad.content.ts): the tokens really arrive in both
 * versions. Honest, the contribution pays a plain sale with fixed code. In
 * the attack the same button pays a proxy whose code its deployer can
 * replace after the sale: Caution under Balanced. With a wallet connected,
 * Baret checks the real request from that address; without one, the
 * prepared sample (source.ts). That button
 * signs and sends nothing; "Sign with your wallet" under it sends the same
 * request to the connected wallet for real (kit/wallet/useSiteSign.tsx).
 */

const { site, analysis } = launchpad;

export function LaunchPadSite(): JSX.Element {
  const [mode, setMode] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [amount, setAmount] = useState<string>(site.panel.start);
  const [paid, setPaid] = useState(Number(site.panel.start));
  const [paidWei, setPaidWei] = useState(toWei(site.panel.start) ?? 0n);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { from, live, balance } = useDemoWallet();
  const { view, go } = useSiteView(VIEWS);
  const page = site.pages.views.find((v) => v.id === view);
  const sign = useSiteSign(launchpad.sign);

  /** The run "Sign with your wallet" starts; null when the amount is refused. */
  function signRun(owner: Address): SignRun | null {
    const value = parseAmount(amount);
    const wei = toWei(amount);
    const broken = value === null || wei === null ? "empty" : limitOf(value);
    if (broken || wei === null) {
      setError(site.panel.errors[broken ?? "empty"]);
      return null;
    }
    setError(null);
    return { mode, calls: signCalls(mode, wei, owner), values: { amount }, token: SALE_TOKEN };
  }

  function runCheck(version: DemoMode, value: number, wei: bigint): void {
    setChecked(version);
    setPaid(value);
    setPaidWei(wei);
    setConnected(true);
    setOpen(true);
    check.start({ mode: version, amount: value, wei, from });
  }

  /** False when the amount is refused, so the card can move focus to it. */
  function contribute(): boolean {
    const value = parseAmount(amount);
    const wei = toWei(amount);
    if (value === null || wei === null) {
      setError(site.panel.errors.empty);
      return false;
    }
    const broken = limitOf(value);
    if (broken) {
      setError(site.panel.errors[broken]);
      return false;
    }
    // Live, the contribution is paid from the connected wallet.
    if (live && balance !== null && exceeds(wei, balance)) {
      setError(fill(demoFrame.wallet.short, { balance: formatMon(balance) }));
      return false;
    }
    setError(null);
    runCheck(mode, value, wei);
    return true;
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next, paid, paidWei);
  }

  const copy = analysis.modes[checked];

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
        glyph={<LaunchGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {page ? (
          <SiteViewPage view={page} note={site.pages.sampleNote} faqName="launchpad-page-faq" />
        ) : (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              body={site.hero.body}
              card={
                <ContributeCard
                  mode={mode}
                  onMode={setMode}
                  amount={amount}
                  onAmount={(value) => {
                    setAmount(value);
                    if (error) setError(null);
                  }}
                  error={error}
                  onContribute={contribute}
                  sign={sign.block(signRun, mode)}
                />
              }
            />
            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.hero} blocks={site.sections} portrait />
            <Faq items={site.faq} name="launchpad-faq" title={demoFrame.site.faqTitle} />
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
          asks: fill(copy.asks, { contract: live ? liveSaleOf(checked) : saleOf(checked) }),
          call: copy.call,
          expected: copy.expected,
          expectedBody: copy.expectedBody,
          claims: analysis.claims,
          without: analysis.without,
          lesson: analysis.lesson,
        }}
        onTryOther={tryOther}
      />
    </>
  );
}
