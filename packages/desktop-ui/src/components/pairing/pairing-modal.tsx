import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, ShieldCheck, Clock, Laptop, X } from "lucide-react";
import { useDeviceStore } from "../../store/index.js";
import { client } from "../../network/client.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";

export interface PairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({ open, onOpenChange }) => {
  const qrPayload = useDeviceStore((s) => s.qrPayload);
  const devices = useDeviceStore((s) => s.devices);
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
        { type: "svg", margin: 1, color: { dark: "#f4f4f5", light: "#09090b" } },
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[var(--foreground)]" />
            <DialogTitle className="text-sm font-semibold">Pair Remote Mobile Device</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-[var(--muted-foreground)]">
            Scan with the Canywhere iOS app to establish an authenticated peer connection.
          </DialogDescription>
        </DialogHeader>

        {/* QR Section */}
        <div className="flex flex-col items-center justify-center p-5 bg-[var(--code-bg)] border border-[var(--border)] rounded-xl my-1">
          {qrSvg ? (
            <div
              className="w-52 h-52 rounded-lg overflow-hidden flex items-center justify-center bg-black/90 p-2"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-[var(--muted-foreground)] text-xs font-mono">
              Generating payload...
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 text-[11px] font-mono text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")} remaining
              </span>
            </div>
            <span>•</span>
            <span className="text-[10px] text-emerald-500 font-medium">Ed25519 Verified</span>
          </div>
        </div>

        {/* Currently Paired Devices List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            <span>Currently Paired Devices ({devices.length})</span>
          </div>

          {devices.length === 0 ? (
            <div className="p-3 text-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] italic font-mono">
              No devices paired yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium text-[var(--foreground)] truncate">{dev.name}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                        Key: {dev.publicKey.slice(0, 8)}...{dev.publicKey.slice(-6)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security invariant footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] justify-center pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Strictly peer-to-peer over local LAN or Tailscale.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
