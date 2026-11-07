import { demoFrame, scrybe } from "@baret/content";
import { addressOf, isBaretExtension, requestPicker, switchToMonad } from "@baret/demo-evm/wallet";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useEffect, useState } from "react";
import { AnalysisPanel } from "../kit/AnalysisPanel.js";
import { DemoBar } from "../kit/DemoBar.js";
import { SiteHero } from "../kit/site/Page.js";
import { Faq, Features, SiteFooter, Stats } from "../kit/site/Sections.js";
import { SiteHeader } from "../kit/site/SiteHeader.js";
import { useSiteView } from "../kit/site/useSiteView.js";
import { SiteViewPage } from "../kit/site/Views.js";
import { useCheck } from "../kit/useCheck.js";
import { MONAD_TESTNET_ID, useDemoWallet, walletLabel } from "../kit/wallet/useDemoWallet.js";
import { AskCard } from "./AskCard.js";
import { ScrybeGlyph, VIEWS } from "./Glyph.js";
import { PayBlock } from "./PayBlock.js";
import { usePay } from "./pay.js";
import { AgentsBridge, Run } from "./Run.js";
import { ART, type Cap, SAMPLE, START_CAP, usdc } from "./sample.js";
import { LIVE_VALUES, SOURCE } from "./source.js";

/**
 * Scrybe: a pay-per-answer service in its own highlighter palette, with
 * Baret's strip on top and Baret's panel behind the main button.
 *
 * The story (scrybe.content.ts): nothing here is malicious. One answer is a
 * small x402 payment, Safe. The agent loop pays question after question; the
 * payment that would take the hour over the visitor's cap is stopped. The
 * panel shows the run, the stop and the way to the same caps on /agents.
 * With a wallet connected, Baret checks the real payment from that address
 * under the visitor's cap; without one, the prepared sample (source.ts).
 * That button signs and sends nothing. "Pay with your wallet" under it makes
 * the honest payment for real: an x402 payment settled on Monad testnet
 * (pay.ts).
 */

const { site, analysis } = scrybe;

export function ScrybeSite(): JSX.Element {
  const [mode, setMode] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [question, setQuestion] = useState<string>(site.panel.start);
  const [cap, setCap] = useState<Cap>(START_CAP);
  const [checkedCap, setCheckedCap] = useState<Cap>(START_CAP);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { wallet, from, live } = useDemoWallet();
  const pay = usePay();
  const address = addressOf(wallet);
  const connection = wallet.connection.status === "connected" ? wallet.connection : null;
  const [need, setNeed] = useState<"wallet" | "network" | null>(null);

  // A need clears once what it waited for arrives.
  useEffect(() => {
    if (need === "wallet" && address !== null) setNeed(null);
    if (need === "network" && connection?.chainId === MONAD_TESTNET_ID) setNeed(null);
  }, [need, address, connection?.chainId]);

  // Another account drops the payment shown: it belongs to the address before.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the account changes
  useEffect(() => pay.reset(), [address]);
  const { view, go } = useSiteView(VIEWS);
  const page = site.pages.views.find((v) => v.id === view);

  function runCheck(version: DemoMode): void {
    setChecked(version);
    setCheckedCap(cap);
    setConnected(true);
    setOpen(true);
    check.start({ mode: version, cap, from });
  }

  /** False when the question is missing, so the card can move focus to it. */
  function ask(): boolean {
    if (mode === "safe" && question.trim() === "") {
      setError(site.panel.errors.empty);
      return false;
    }
    setError(null);
    runCheck(mode);
    return true;
  }

  function payForReal(): void {
    if (question.trim() === "") {
      setError(site.panel.errors.empty);
      return;
    }
    setError(null);
    if (address === null) {
      setNeed("wallet");
      return;
    }
    if (connection?.chainId !== MONAD_TESTNET_ID) {
      setNeed("network");
      return;
    }
    setNeed(null);
    void pay.run(address, question.trim());
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next);
  }

  const copy = analysis.modes[checked];
  const values = {
    amount: usdc(SAMPLE.price),
    merchant: live ? LIVE_VALUES.merchant : SAMPLE.merchant,
  };

  return (
    <>
      <DemoBar
        pill={scrybe.frame.pill}
        mode={mode}
        onMode={setMode}
        labels={{ safe: analysis.modes.safe.label, danger: analysis.modes.danger.label }}
        body={analysis.modes[mode].body}
      />
      <SiteHeader
        brand={site.brand}
        glyph={<ScrybeGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {page ? (
          <SiteViewPage view={page} note={site.pages.sampleNote} faqName="scrybe-page-faq" />
        ) : (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              body={site.hero.body}
              card={
                <AskCard
                  mode={mode}
                  onMode={setMode}
                  question={question}
                  onQuestion={(value) => {
                    setQuestion(value);
                    if (error) setError(null);
                  }}
                  cap={cap}
                  onCap={setCap}
                  error={error}
                  onAsk={ask}
                  merchant={values.merchant}
                  pay={
                    <div className="grid gap-3">
                      {/* A real payment in test USDC: said before the button, not only in the strip. */}
                      <p className={T.small}>{scrybe.frame.notice}</p>
                      <PayBlock
                        state={pay.state}
                        walletName={connection ? walletLabel(connection.wallet) : ""}
                        need={need}
                        switching={wallet.switching}
                        onConnect={requestPicker}
                        onSwitch={() => void switchToMonad()}
                        price={SAMPLE.price}
                        merchant={LIVE_VALUES.merchant}
                        checks={connection ? isBaretExtension(connection.wallet.id) : false}
                        onPay={payForReal}
                      />
                    </div>
                  }
                />
              }
            />
            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.hero} blocks={site.sections} />
            <Faq items={site.faq} name="scrybe-faq" title={demoFrame.site.faqTitle} />
          </>
        )}
      </main>

      <SiteFooter note={site.footer} hostname={site.hostname} />

      <AnalysisPanel
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Closing the panel cancels a check that is still running.
          if (!next) check.reset();
        }}
        state={check.state}
        live={live}
        mode={checked}
        image={checked === "safe" ? ART.safe : ART.danger}
        copy={{
          asks: fill(copy.asks, values),
          call: copy.call,
          expected: copy.expected,
          expectedBody: copy.expectedBody,
          claims: analysis.claims,
          without: analysis.without,
          lesson: analysis.lesson,
        }}
        extra={checked === "danger" ? <Run cap={checkedCap} /> : null}
        after={<AgentsBridge />}
        onTryOther={tryOther}
      />
    </>
  );
}
