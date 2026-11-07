import { demoFrame, orbityield } from "@baret/content";
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
import { OrbitGlyph, VIEWS } from "./Glyph.js";
import { StakeCard } from "./StakeCard.js";
import { ART, overLimit, poolOf, SAMPLE } from "./sample.js";
import { livePoolOf, overLimitLive, RECEIPT, SOURCE, signCalls } from "./source.js";

/**
 * OrbitYield: a liquid staking page in its own observatory palette, with
 * Baret's strip on top and Baret's panel behind the main button.
 *
 * The story (orbityield.content.ts): nothing here is provably an attack.
 * Honest, the deposit goes to the pool Baret knows and oMON comes back. In
 * the attack the same button pays a second pool on no list that sends
 * nothing back: Caution, and Blocked once the deposit is above the loss
 * limit, which is what the expected verdict then says too. With a wallet
 * connected, Baret checks the real request from that address against its
 * real balance; without one, the prepared sample (source.ts). That button
 * signs and sends nothing; "Sign with your wallet" under it sends the same
 * request to the connected wallet for real (kit/wallet/useSiteSign.tsx).
 */

const { site, analysis } = orbityield;

export function OrbitYieldSite(): JSX.Element {
  const [mode, setMode] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [amount, setAmount] = useState<string>(site.panel.start);
  const [staked, setStaked] = useState(Number(site.panel.start));
  const [stakedWei, setStakedWei] = useState(toWei(site.panel.start) ?? 0n);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { from, live, balance, walletConnected } = useDemoWallet();
  const { view, go } = useSiteView(VIEWS);
  const page = site.pages.views.find((v) => v.id === view);
  const sign = useSiteSign(orbityield.sign);

  /** The run "Sign with your wallet" starts; null when the amount is refused. */
  function signRun(owner: Address): SignRun | null {
    const wei = toWei(amount);
    if (wei === null) {
      setError(site.panel.errors.empty);
      return null;
    }
    // A stake above the wallet's MON never reaches the wallet: the site says why, like stake().
    if (exceeds(wei, balance)) {
      setError(fill(demoFrame.wallet.short, { balance: formatMon(balance ?? 0n) }));
      return null;
    }
    setError(null);
    // The receipt token is read in both versions: the attack is the balance that does not move.
    return { mode, calls: signCalls(mode, wei, owner), values: { amount }, token: RECEIPT };
  }

  function runCheck(version: DemoMode, value: number, wei: bigint): void {
    setChecked(version);
    setStaked(value);
    setStakedWei(wei);
    setConnected(true);
    setOpen(true);
    check.start({ mode: version, amount: value, wei, from });
  }

  /** False when the amount is refused, so the card can move focus to it. */
  function stake(): boolean {
    const value = parseAmount(amount);
    const wei = toWei(amount);
    if (value === null || wei === null) {
      setError(site.panel.errors.empty);
      return false;
    }
    // Live, the stake is paid from the connected wallet; the sample has its own balance.
    if (live ? exceeds(wei, balance) : value > SAMPLE.mon) {
      setError(
        live && balance !== null
          ? fill(demoFrame.wallet.short, { balance: formatMon(balance) })
          : site.panel.errors.tooHigh,
      );
      return false;
    }
    setError(null);
    runCheck(mode, value, wei);
    return true;
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next, staked, stakedWei);
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
        glyph={<OrbitGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {page ? (
          <SiteViewPage view={page} note={site.pages.sampleNote} faqName="orbityield-page-faq" />
        ) : (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              body={site.hero.body}
              card={
                <StakeCard
                  mode={mode}
                  onMode={setMode}
                  amount={amount}
                  onAmount={(value) => {
                    setAmount(value);
                    if (error) setError(null);
                  }}
                  error={error}
                  onStake={stake}
                  sign={sign.block(signRun, mode)}
                  live={live}
                  liveBalance={balance === null ? null : formatMon(balance)}
                  walletConnected={walletConnected}
                />
              }
            />
            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.hero} blocks={site.sections} portrait />
            <Faq items={site.faq} name="orbityield-faq" title={demoFrame.site.faqTitle} />
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
          asks: fill(copy.asks, { contract: live ? livePoolOf(checked) : poolOf(checked) }),
          call: copy.call,
          // Above the loss limit the expected answer is Blocked; the body says so.
          expected: (live ? overLimitLive(checked, stakedWei, balance) : overLimit(checked, staked))
            ? "blocked"
            : copy.expected,
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
