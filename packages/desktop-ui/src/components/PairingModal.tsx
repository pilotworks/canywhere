import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import QRCode from "qrcode";
import { Smartphone, X, ShieldCheck, Clock } from "lucide-react";
import { useDeviceStore } from "../store/index.js";
import { client } from "../network/client.js";

export const PairingModal: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange
}) => {
  const qrPayload = useDeviceStore((s) => s.qrPayload);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(300);

  useEffect(() => {
    if (open) {
      client.createPairingSession();
    }
  }, [open]);

  useEffect(() => {
    if (qrPayload) {
      QRCode.toString(
        JSON.stringify(qrPayload),
        { type: "svg", margin: 2, color: { dark: "#ffffff", light: "#171717" } },
        (err, svg) => {
          if (!err) setQrSvg(svg);
        }
      );

      const updateRemaining = () => {
        const remaining = Math.max(0, Math.floor((qrPayload.expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
      };
      updateRemaining();
      const interval = setInterval(updateRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [qrPayload]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-xl p-6 shadow-2xl z-50 text-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-400" />
              <Dialog.Title className="text-lg font-semibold">Pair Mobile Device</Dialog.Title>
            </div>
            <Dialog.Close className="text-neutral-400 hover:text-white p-1 rounded-md transition cursor-pointer">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-neutral-400 mb-6">
            Open Canywhere on iOS and scan this QR code to establish an encrypted Ed25519 pairing session.
          </Dialog.Description>

          <div className="flex flex-col items-center justify-center p-6 bg-neutral-950 border border-neutral-800 rounded-xl mb-4">
            {qrSvg ? (
              <div
                className="w-56 h-56 rounded-lg overflow-hidden flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-neutral-500">
                Generating secure QR payload...
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero cloud relay • Strictly peer-to-peer over LAN / Tailscale</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
