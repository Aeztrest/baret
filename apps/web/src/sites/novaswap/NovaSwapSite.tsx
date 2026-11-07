import { demoFrame, novaswap } from "@baret/content";
import { NOVASWAP } from "@baret/demo-evm";
import {
  type Address,
  addressOf,
  isBaretExtension,
  requestPicker,
  switchToMonad,
  useSendFlow,
  useTokenBalance,
} from "@baret/demo-evm/wallet";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useEffect, useRef, useState } from "react";
import { AnalysisPanel } from "../kit/AnalysisPanel.js";
import { toUnits, toWei } from "../kit/amount.js";
import { DemoBar } from "../kit/DemoBar.js";
import { displayAmount } from "../kit/live.js";
import { SiteHero } from "../kit/site/Page.js";
import { Faq, Features, SiteFooter, Stats } from "../kit/site/Sections.js";
import { SiteHeader } from "../kit/site/SiteHeader.js";
import { useSiteView } from "../kit/site/useSiteView.js";
import { useCheck } from "../kit/useCheck.js";
import { SignBlock } from "../kit/wallet/SignBlock.js";
import {
  exceeds,
  formatMon,
  MONAD_TESTNET_ID,
  useDemoWallet,
  walletLabel,
} from "../kit/wallet/useDemoWallet.js";
import { Faucet } from "./Faucet.js";
import { DocsPage, PoolsPage, StatsPage } from "./Pages.js";
import { NovaGlyph, VIEWS } from "./SiteHeader.js";
import { SwapCard } from "./SwapCard.js";
import { ART, balanceOf, parseAmount, SAMPLE } from "./sample.js";
import { contractOf, faucetCall, SOURCE, signCalls } from "./source.js";

/**
 * NovaSwap: a believable swap venue in its own cobalt palette, with Baret's
 * strip on top and Baret's panel waiting behind the main button.
 *
 * The story (novaswap.content.ts, D-018): the honest version buys dUSDC
 * with MON on the NovaSwap router. The attack version sells dUSDC and first
 * asks to "enable trading", an unlimited allowance to a look-alike router.
 * Baret's strip and the switch in the card flip between the two. The main
 * button opens the panel with Baret's answer for the version switched on:
 * the live answer from the connected wallet's address, or the prepared
 * sample without one (source.ts). Beside it, "Sign with your wallet" sends
 * the same request to the connected wallet, unchecked, on Monad testnet: the
 * attack signs the allowance and then the "swap" that drains the dUSDC the
 * visitor took from the faucet, and the card shows the balance before and after.
 * Under it, "Check with Baret" sends the same request to the Baret wallet in
 * its own window, which checks it and refuses the attack before any signature.
 */

const { site, analysis } = novaswap;

/** The amount each version starts with: MON under most faucet grants, so a fresh account can swap it, and a dUSDC sale. */
const START: Record<DemoMode, string> = { safe: "0.02", danger: "20" };

/** Why the last sign or faucet press did not start: no wallet, another network, or no dUSDC to sell. */
type Need = "wallet" | "network" | "empty";

export function NovaSwapSite(): JSX.Element {
  const [mode, setModeState] = useState<DemoMode>("safe");
  const [checked, setChecked] = useState<DemoMode>("safe");
  const [amount, setAmount] = useState(START.safe);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const check = useCheck(demoFrame.panel.phases.length, SOURCE);
  const { wallet, from, live, balance } = useDemoWallet();
  // The page lives in ?view= so Back works and a page can be linked.
  const { view, go } = useSiteView(VIEWS);
  const sign = useSendFlow();
  const faucet = useSendFlow();
  const address = addressOf(wallet);
  const usdc = useTokenBalance(NOVASWAP.usdc, address);
  const walletName =
    wallet.connection.status === "connected" ? walletLabel(wallet.connection.wallet) : "";
  // The Baret extension checks a request with Baret itself: the sign block then never
  // says it skips the check.
  const walletChecks =
    wallet.connection.status === "connected" && isBaretExtension(wallet.connection.wallet.id);
  const chainId = wallet.connection.status === "connected" ? wallet.connection.chainId : null;
  const [need, setNeed] = useState<Need | null>(null);
  // The version and amount the last run started with: its labels and
  // outcome read these, not the inputs the visitor may have changed since.
  const [ran, setRan] = useState<{ mode: DemoMode; amount: string } | null>(null);

  // A need clears once what it waited for arrives.
  useEffect(() => {
    if (need === "wallet" && address !== null) setNeed(null);
    if (need === "network" && chainId === MONAD_TESTNET_ID) setNeed(null);
    if (need === "empty" && usdc.value !== null && usdc.value > 0n) setNeed(null);
  }, [need, address, chainId, usdc.value]);

  // Another account drops both runs: their steps belong to the address before.
  const seen = useRef(address);
  useEffect(() => {
    if (seen.current === address) return;
    seen.current = address;
    sign.reset();
    faucet.reset();
    setNeed(null);
  }, [address, sign.reset, faucet.reset]);

  /** The two versions spend different tokens, so each starts from its own amount. */
  function setMode(next: DemoMode): void {
    if (next === mode) return;
    setModeState(next);
    setAmount(START[next]);
    setError(null);
    sign.reset();
    faucet.reset();
    setNeed(null);
  }

  function runCheck(version: DemoMode, value: string): void {
    setChecked(version);
    setConnected(true);
    setOpen(true);
    check.start({ mode: version, amount: value, wei: toWei(value) ?? 0n, from });
  }

  /** Whether the typed amount can be sent; when not, the card shows why. */
  function amountOk(): boolean {
    const errors = mode === "safe" ? site.panel.errors : site.attack.errors;
    const value = parseAmount(amount);
    if (value === null) {
      setError(errors?.empty ?? null);
      return false;
    }
    // The sample checks its own balances. Live, the honest swap pays MON
    // from the connected wallet; the attack's approval costs nothing.
    if (!live && value > balanceOf(mode)) {
      setError(errors?.tooHigh ?? null);
      return false;
    }
    if (live && mode === "safe") {
      const wei = toWei(amount);
      if (wei === null) {
        setError(errors?.empty ?? null);
        return false;
      }
      if (balance !== null && exceeds(wei, balance)) {
        setError(fill(demoFrame.wallet.short, { balance: formatMon(balance) }));
        return false;
      }
    }
    setError(null);
    return true;
  }

  /** False when the amount is refused, so the card can move focus to it. */
  function review(): boolean {
    if (!amountOk()) return false;
    runCheck(mode, amount);
    return true;
  }

  /**
   * No wallet opens the header's picker; another network asks for Monad
   * testnet. Both say why under the button and clear once fixed.
   */
  function ready(): Address | null {
    if (address === null) {
      setNeed("wallet");
      requestPicker();
      return null;
    }
    if (chainId !== MONAD_TESTNET_ID) {
      setNeed("network");
      return null;
    }
    return address;
  }

  function onSign(): void {
    setNeed(null);
    const owner = ready();
    if (owner === null || !amountOk()) return;
    const units = toUnits(amount, NOVASWAP.usdcDecimals);
    if (mode === "danger") {
      // The attack sells dUSDC: with none, or none read yet, there is nothing to show.
      if (usdc.value === null || usdc.value === 0n) {
        setNeed("empty");
        return;
      }
      if (units === null) {
        setError(site.attack.errors?.empty ?? null);
        return;
      }
      if (units > usdc.value) {
        setError(site.attack.errors?.tooHigh ?? null);
        return;
      }
    }
    setRan({ mode, amount });
    faucet.reset();
    const calls = signCalls(mode, toWei(amount) ?? 0n, units ?? 0n, owner);
    void sign.run(calls, { token: NOVASWAP.usdc, owner }).then(() => usdc.refresh());
  }

  function onFaucet(): void {
    setNeed(null);
    const owner = ready();
    if (owner === null) return;
    const calls = [faucetCall(owner)];
    void faucet.run(calls).then(() => usdc.refresh());
  }

  function tryOther(): void {
    const next: DemoMode = checked === "safe" ? "danger" : "safe";
    setMode(next);
    runCheck(next, START[next]);
  }

  const copy = analysis.modes[checked];
  const signMode = ran?.mode ?? mode;
  // The attack sells dUSDC: a wallet read as holding none cannot run it, so
  // the button is disabled and says why, instead of a press doing nothing.
  const noUsdc =
    mode === "danger" &&
    address !== null &&
    chainId === MONAD_TESTNET_ID &&
    usdc.value === 0n &&
    sign.state.phase !== "running";
  const { outcome } = novaswap.sign;
  // The attack signed here with no check, both balances read: Baret's panel
  // for the same request shows what it cost, in place of "If this were signed".
  const { before, after } = sign.state;
  const drained =
    checked === "danger" &&
    ran?.mode === "danger" &&
    sign.state.phase === "done" &&
    before !== null &&
    after !== null
      ? {
          title: novaswap.sign.panel.title,
          body: fill(novaswap.sign.panel.body, {
            before: displayAmount(before, NOVASWAP.usdcDecimals),
            after: displayAmount(after, NOVASWAP.usdcDecimals),
          }),
        }
      : null;

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
        glyph={<NovaGlyph />}
        nav={site.nav}
        views={VIEWS}
        view={view}
        onView={go}
        connect={site.connect}
        sample={{ connected, address: SAMPLE.wallet, onUse: () => setConnected(true) }}
      />

      <main key={view} id="main" tabIndex={-1} className="focus:outline-none">
        {view === "pools" ? <PoolsPage onSwap={() => go("swap")} /> : null}
        {view === "stats" ? <StatsPage /> : null}
        {view === "docs" ? <DocsPage /> : null}
        {view === "swap" ? (
          <>
            <SiteHero
              badge={site.hero.badge}
              title={site.hero.title}
              keepCase={["dUSDC"]}
              body={site.hero.body}
              card={
                <SwapCard
                  mode={mode}
                  onMode={setMode}
                  amount={amount}
                  onAmount={(value) => {
                    setAmount(value);
                    if (error) setError(null);
                  }}
                  error={error}
                  onReview={review}
                  live={live}
                  liveBalance={balance === null ? null : formatMon(balance)}
                  walletConnected={address !== null}
                  liveToken={
                    usdc.value === null ? null : displayAmount(usdc.value, NOVASWAP.usdcDecimals)
                  }
                  faucet={
                    mode === "danger" && address !== null ? (
                      <Faucet
                        flow={faucet.state}
                        walletName={walletName}
                        disabled={sign.state.phase === "running"}
                        onTake={onFaucet}
                      />
                    ) : null
                  }
                  sign={
                    <SignBlock
                      flow={sign.state}
                      labels={novaswap.sign.steps[signMode].map((label) =>
                        fill(label, { amount: ran?.amount ?? amount }),
                      )}
                      walletName={walletName}
                      need={need === "empty" ? null : need}
                      note={need === "empty" && !noUsdc ? novaswap.sign.empty : null}
                      blocked={noUsdc ? novaswap.sign.empty : null}
                      switching={wallet.switching}
                      onConnect={requestPicker}
                      onSwitch={() => void switchToMonad()}
                      token={{ symbol: novaswap.sign.token, decimals: NOVASWAP.usdcDecimals }}
                      outcome={
                        signMode === "danger"
                          ? [outcome.danger, outcome.open, outcome.next]
                          : [outcome.safe]
                      }
                      stoppedNote={signMode === "danger" ? outcome.open : null}
                      busy={faucet.state.phase === "running"}
                      checks={walletChecks}
                      attack={mode === "danger"}
                      ranAttack={signMode === "danger"}
                      onSign={onSign}
                    />
                  }
                />
              }
            />

            <Stats items={site.stats} title={demoFrame.site.statsTitle} />
            <Features image={ART.routes} blocks={site.sections} />
            <Faq items={site.faq} name="novaswap-faq" title={demoFrame.site.faqTitle} />
          </>
        ) : null}
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
          asks: fill(copy.asks, { contract: contractOf(checked) }),
          call: copy.call,
          expected: copy.expected,
          expectedBody: copy.expectedBody,
          claims: analysis.claims,
          without: drained ?? analysis.without,
          lesson: analysis.lesson,
        }}
        onTryOther={tryOther}
      />
    </>
  );
}
