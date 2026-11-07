import { claimhub, demoFrame } from "@baret/content";
import { addressOf } from "@baret/demo-evm/wallet";
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
import { useDemoWallet } from "../kit/wallet/useDemoWallet.js";
import { useSiteSign } from "../kit/wallet/useSiteSign.js";
import { ClaimCard } from "./ClaimCard.js";
import { ClaimGlyph, VIEWS } from "./Glyph.js";
import { ART, SAMPLE, walletFor } from "./sample.js";
import { HUB, LIVE_VALUES, SOURCE, signCalls } from "./source.js";

/**
 * ClaimHub: an airdrop page in its own kraft palette, with Baret's strip on
 * top and Baret's panel behind the claim button.
 *
 * The story (claimhub.content.ts): the eligibility check is theatre; every
 * wallet is eligible. Honest, the claim calls claim and HUB arrives. In the
 * attack the same button asks for an unlimited allowance on your USDC and
 * sends nothing. With a wallet connected, Baret checks the real request
 * from that address; without one, the prepared sample (source.ts). That button
 * signs and sends nothing; "Sign with your wallet" under it sends the same
 * request to the connected wallet for real (kit/wallet/useSiteSign.tsx).
 */

const { site, analysis } = claimhub;

export function ClaimHubSite(): JSX.Element {
  const [mode, setMode] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [address, setAddress] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { wallet: demoWallet, from, live } = useDemoWallet();
  // A real wallet, not the developer's test address: the field's hint names it.
  const connectedWallet = addressOf(demoWallet);
  const { view, go } = useSiteView(VIEWS);
  const page = site.pages.views.find((v) => v.id === view);
  const sign = useSiteSign(claimhub.sign);

  /**
   * The page's eligibility check: any address, or the connected wallet (the
   * sample wallet with none) when left empty. False when the address is
   * refused, so the card can move focus to it.
   */
  function checkEligibility(): boolean {
    const next = walletFor(address, connectedWallet ?? SAMPLE.wallet);
    if (next === null) {
      setError(site.panel.errors.invalid);
      return false;
    }
    setError(null);
    if (address.trim() === "" && connectedWallet === null) setConnected(true);
    setWallet(next);
    return true;
  }

  function runCheck(version: DemoMode): void {
    setChecked(version);
    setOpen(true);
    check.start({ mode: version, wallet: wallet ?? connectedWallet ?? SAMPLE.wallet, from });
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next);
  }

  const copy = analysis.modes[checked];
  const values = live ? LIVE_VALUES : { contract: SAMPLE.distributor, spender: SAMPLE.spender };

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
        glyph={<ClaimGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {page ? (
          <SiteViewPage view={page} note={site.pages.sampleNote} faqName="claimhub-page-faq" />
        ) : (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              body={site.hero.body}
              card={
                <ClaimCard
                  mode={mode}
                  onMode={setMode}
                  address={address}
                  onAddress={(value) => {
                    setAddress(value);
                    if (error) setError(null);
                  }}
                  error={error}
                  checked={wallet !== null}
                  onCheck={checkEligibility}
                  onClaim={() => runCheck(mode)}
                  // HUB is read in both versions: in the attack it is the balance that does not move.
                  sign={sign.block(
                    (owner) => ({
                      mode,
                      calls: signCalls(mode, owner),
                      token: HUB,
                    }),
                    mode,
                  )}
                  hint={connectedWallet ? site.panel.hintConnected : site.panel.hint}
                />
              }
            />
            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.hero} blocks={site.sections} portrait />
            <Faq items={site.faq} name="claimhub-faq" title={demoFrame.site.faqTitle} />
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
          asks: fill(copy.asks, values),
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
