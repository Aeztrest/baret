import { demoFrame } from "@baret/content";
import { DEMO_FAUCET } from "@baret/demo-evm";
import {
  connectWallet,
  disconnectWallet,
  isBaretExtension,
  onPickerRequest,
  prefetch,
  refreshBalance,
  switchToMonad,
  useWallet,
  type WalletOption,
  type WalletState,
} from "@baret/demo-evm/wallet";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Mark,
  truncateAddress,
} from "@baret/ui";
import { CopyButton } from "@baret/web-ui/components/CopyButton";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { Wallet } from "lucide-react";
import { type JSX, useEffect, useId, useRef, useState } from "react";
import { DEMO_FROM, formatMon, MONAD_TESTNET_ID, walletLabel } from "./useDemoWallet.js";

/**
 * The wallet control in a demo site's header, in the site's own palette:
 * "Connect wallet" opens the picker; once a wallet is connected, a chip with
 * its address opens the wallet's menu. A site that ran on the sample wallet
 * shows that chip instead, and it opens the picker too.
 *
 * The picker lists every wallet the browser announced over EIP-6963 (the
 * Baret extension among them, drawn with Baret's mark), then the sample
 * wallet, which needs no extension.
 * Connected, Baret checks each request from that address, live, and nothing
 * is signed unless the visitor signs it in the wallet (a card's "Sign with
 * your wallet", which opens this picker when no wallet is connected). The
 * wallet code loads on the first hover, focus or press.
 */

const copy = demoFrame.wallet;

const LINK =
  "inline-flex min-h-11 w-max items-center text-sm font-medium text-[color:var(--fg)] underline decoration-[color:var(--rule-strong)] underline-offset-4 hover:decoration-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

const CHIP =
  "flex min-h-11 items-center gap-2 border border-[color:var(--rule-strong)] px-3 py-2 text-left transition-colors hover:border-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

const ROW =
  "flex min-h-14 w-full items-center gap-3 border border-[color:var(--rule-strong)] px-4 py-3 text-left transition-colors hover:border-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

/** A wallet's own icon when it sent a safe one, a plain wallet glyph otherwise. */
function WalletIcon({ option, size = 28 }: { option: WalletOption; size?: number }): JSX.Element {
  if (option.icon)
    return (
      <img
        src={option.icon}
        alt=""
        width={size}
        height={size}
        // A wallet's icon that does not decode leaves its box empty, not a broken image.
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
        }}
        className="shrink-0 object-contain"
      />
    );
  if (option.extension) return <Mark size={size} slit="var(--surface)" decorative />;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center border border-[color:var(--rule-strong)] text-[color:var(--fg-muted)]"
      style={{ width: size, height: size }}
    >
      <Wallet />
    </span>
  );
}

function Picker({
  wallet,
  onPick,
  onSample,
}: {
  wallet: WalletState;
  onPick: (option: WalletOption) => void;
  onSample: () => void;
}): JSX.Element {
  const othersId = useId();
  const others = [...wallet.options].sort((a, b) => walletLabel(a).localeCompare(walletLabel(b)));
  const pendingId = wallet.connection.status === "connecting" ? wallet.connection.id : null;
  const pending = pendingId ? (wallet.options.find((o) => o.id === pendingId) ?? null) : null;
  const status = pending
    ? fill(copy.connecting, { wallet: walletLabel(pending) })
    : wallet.error
      ? fill(copy.errors[wallet.error.kind], { wallet: wallet.error.name })
      : wallet.ready
        ? ""
        : copy.looking;

  return (
    <>
      <div className="grid gap-2 pr-10">
        <DialogTitle className={`${T.h3} text-[color:var(--fg)]`}>{copy.title}</DialogTitle>
        <DialogDescription className={T.small}>{copy.body}</DialogDescription>
      </div>

      <section aria-labelledby={othersId} className="grid gap-2">
        <h3 id={othersId} className={T.label}>
          {copy.others}
        </h3>
        {wallet.ready && others.length === 0 ? <p className={T.small}>{copy.none}</p> : null}
        {others.length > 0 ? (
          <ul className="grid gap-2">
            {others.map((option) => (
              <li key={option.id}>
                <button type="button" className={ROW} onClick={() => onPick(option)}>
                  <WalletIcon option={option} />
                  {isBaretExtension(option.id) ? (
                    <span className="grid">
                      <span className="font-medium text-[color:var(--fg)]">
                        {copy.extension.name}
                      </span>
                      <span className={T.small}>{copy.extension.body}</span>
                    </span>
                  ) : (
                    <span className="font-medium text-[color:var(--fg)]">{option.name}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <button type="button" className={ROW} onClick={onSample}>
        <span className="grid">
          <span className="font-medium text-[color:var(--fg)]">{copy.sample.label}</span>
          <span className={T.small}>{copy.sample.body}</span>
        </span>
      </button>

      <p role="status" className={`${T.small} min-h-5`}>
        {status}
      </p>
    </>
  );
}

function Account({
  wallet,
  onDisconnect,
}: {
  wallet: WalletState;
  onDisconnect: () => void;
}): JSX.Element | null {
  const { connection, balance, switching } = wallet;
  if (connection.status !== "connected") return null;
  const onMonad = connection.chainId === MONAD_TESTNET_ID;
  const { account } = copy;

  return (
    <>
      <div className="grid gap-2 pr-10">
        <DialogTitle className={`${T.h3} text-[color:var(--fg)]`}>{account.title}</DialogTitle>
        <DialogDescription className={T.small}>{account.live}</DialogDescription>
      </div>

      <div className="grid gap-2 border-t border-[color:var(--rule)] pt-4">
        <p className="flex items-center gap-3 font-medium text-[color:var(--fg)]">
          <WalletIcon option={connection.wallet} />
          {walletLabel(connection.wallet)}
        </p>
        <p className="font-mono text-sm text-[color:var(--fg)] [overflow-wrap:anywhere]">
          {connection.address}
        </p>
        <CopyButton
          text={connection.address}
          label={account.copy.label}
          done={account.copy.done}
          className="justify-self-start"
        />
      </div>

      <div className="grid gap-2 border-t border-[color:var(--rule)] pt-4">
        {onMonad ? (
          <p className="flex items-center gap-2 text-sm text-[color:var(--fg)]">
            <span aria-hidden="true" className="size-2 rounded-full bg-[color:var(--safe)]" />
            {account.network.ok}
          </p>
        ) : (
          <>
            <p className={T.small}>{account.network.wrong}</p>
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="justify-self-start"
              disabled={switching === "busy"}
              onClick={() => void switchToMonad()}
            >
              {switching === "busy" ? account.switch.busy : account.switch.label}
            </Button>
            {switching === "failed" ? (
              <p role="alert" className={T.small}>
                {account.switch.failed}
              </p>
            ) : null}
          </>
        )}
        {balance !== null ? (
          <p className="text-sm text-[color:var(--fg)]">
            {fill(account.balance, { amount: formatMon(balance) })}
          </p>
        ) : null}
        {balance === 0n ? (
          <>
            <p className={T.small}>{account.empty}</p>
            <a
              href={DEMO_FAUCET ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              {account.faucet.label}
            </a>
          </>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="md"
        className="justify-self-start"
        onClick={onDisconnect}
      >
        {account.disconnect}
      </Button>
    </>
  );
}

export function WalletControl({
  connect,
  sample,
}: {
  /** The site's own words for the button and the sample chip. */
  connect: { readonly label: string; readonly connected: string };
  /** The sample wallet: in use once the site's main button ran on it. */
  sample: { readonly connected: boolean; readonly address: string; readonly onUse: () => void };
}): JSX.Element {
  const wallet = useWallet();
  const { connection } = wallet;
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const trigger = useRef<HTMLSpanElement>(null);
  // Set when a pick in the picker started a connect: its success closes the
  // picker, is read out and moves focus to the chip. A wallet that comes
  // back by itself on load stays silent.
  const picked = useRef(false);

  const address = connection.status === "connected" ? connection.address : null;
  const name = connection.status === "connected" ? walletLabel(connection.wallet) : "";
  useEffect(() => {
    if (!address || !picked.current) return;
    picked.current = false;
    setOpen(false);
    setSaid(fill(copy.announce.connected, { wallet: name, address: truncateAddress(address) }));
  }, [address, name]);

  // A card's "Sign with your wallet" with no wallet opens the picker here.
  useEffect(
    () =>
      onPickerRequest(() => {
        prefetch();
        setOpen(true);
      }),
    [],
  );

  // A failed pick or a decline keeps the picker open with its message.
  useEffect(() => {
    if (wallet.error) picked.current = false;
  }, [wallet.error]);

  function focusTrigger(): void {
    trigger.current?.querySelector<HTMLElement>("button")?.focus();
  }

  function openWith(): void {
    prefetch();
    setOpen(true);
  }

  const sampleLabel = DEMO_FROM ? copy.testAddress : connect.connected;
  const sampleAddress = DEMO_FROM ?? sample.address;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      <span ref={trigger} className="contents">
        {connection.status === "connected" ? (
          <button
            type="button"
            className={CHIP}
            aria-label={fill(copy.account.open, {
              wallet: walletLabel(connection.wallet),
              address: truncateAddress(connection.address),
            })}
            onClick={() => {
              setOpen(true);
              void refreshBalance();
            }}
          >
            <WalletIcon option={connection.wallet} size={20} />
            <span className="font-mono text-sm text-[color:var(--fg)]">
              {truncateAddress(connection.address)}
            </span>
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${connection.chainId === MONAD_TESTNET_ID ? "bg-[color:var(--safe)]" : "bg-[color:var(--caution)]"}`}
            />
          </button>
        ) : sample.connected ? (
          <button
            type="button"
            className={CHIP}
            onPointerEnter={prefetch}
            onFocus={prefetch}
            onClick={openWith}
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-[color:var(--safe)]" />
            <span className="text-sm text-[color:var(--fg-muted)]">{sampleLabel}</span>
            <span className="font-mono text-sm text-[color:var(--fg)]">
              {truncateAddress(sampleAddress)}
            </span>
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onPointerEnter={prefetch}
            onFocus={prefetch}
            onClick={openWith}
          >
            {connect.label}
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel={copy.close}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusTrigger();
          }}
          className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-none border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6 text-[color:var(--fg)] ring-0 sm:max-w-md"
        >
          {connection.status === "connected" ? (
            <Account
              wallet={wallet}
              onDisconnect={() => {
                void disconnectWallet().finally(() => {
                  setOpen(false);
                  setSaid(copy.announce.disconnected);
                });
              }}
            />
          ) : (
            <Picker
              wallet={wallet}
              onPick={(option) => {
                picked.current = true;
                void connectWallet(option.id);
              }}
              onSample={() => {
                sample.onUse();
                setOpen(false);
                setSaid(`${sampleLabel} ${truncateAddress(sampleAddress)}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
