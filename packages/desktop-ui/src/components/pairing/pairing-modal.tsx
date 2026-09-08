import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Smartphone,
  ShieldCheck,
  Clock,
  Laptop,
  RotateCw,
  Copy,
  Check,
  Trash2,
  Wifi,
  AlertCircle
} from "lucide-react";
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
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSession = async () => {
    setIsGenerating(true);
    try {
      await client.createPairingSession();
    } catch (e) {
      console.error("Failed to generate pairing session:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSession();
    }
  }, [open]);

  useEffect(() => {
    if (qrPayload) {
      // Standard high-contrast QR code (dark black dots on clean white) for optimal phone camera scanning
      QRCode.toString(
        JSON.stringify(qrPayload),
        {
          type: "svg",
          margin: 1,
          color: { dark: "#09090b", light: "#ffffff" },
        },
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

  const handleCopyPayload = async () => {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(qrPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy pairing payload:", err);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await client.revokeDevice(deviceId);
    } catch (err) {
      console.error("Failed to revoke device:", err);
    } finally {
      setRevokingId(null);
    }
  };

  const isExpired = timeLeft <= 0;
  const endpoints = qrPayload?.endpoints || [];

  const getEndpointBadge = (ep: string) => {
    if (ep.includes(".ts.net") || /100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(ep)) {
      return {
        label: "Tailscale",
        color: "text-sky-400 bg-sky-950/50 border-sky-800/50",
        icon: ShieldCheck,
      };
    }
    if (ep.includes("127.0.0.1") || ep.includes("localhost")) {
      return {
        label: "Localhost",
        color: "text-neutral-400 bg-neutral-900 border-neutral-700",
        icon: Laptop,
      };
    }
    return {
      label: "LAN",
      color: "text-emerald-400 bg-emerald-950/50 border-emerald-800/50",
      icon: Wifi,
    };
  };

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
        <div className="flex flex-col items-center justify-center p-4 bg-[var(--code-bg)] border border-[var(--border)] rounded-xl my-1">
          {/* High-contrast camera-ready container */}
          <div className="relative w-52 h-52 rounded-xl bg-white p-2.5 shadow-md border border-neutral-200 flex items-center justify-center overflow-hidden">
            {isExpired && (
              <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
                <AlertCircle className="w-6 h-6 text-amber-400 mb-1.5" />
                <span className="text-xs font-semibold text-white mb-1">Session Expired</span>
                <span className="text-[10px] text-neutral-300 mb-3 leading-relaxed">
                  Tokens expire after 5 minutes for security.
                </span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={fetchSession}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 h-7 text-xs"
                >
                  <RotateCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
                  Regenerate QR
                </Button>
              </div>
            )}

            {isGenerating ? (
              <div className="flex flex-col items-center justify-center gap-2 text-neutral-600 text-xs font-mono">
                <RotateCw className="w-5 h-5 animate-spin text-neutral-800" />
                <span>Generating payload...</span>
              </div>
            ) : qrSvg ? (
              <div
                className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="text-neutral-500 text-xs font-mono">Loading QR Code...</div>
            )}
          </div>

          {/* Status Bar */}
          <div className="mt-3 flex items-center justify-between w-full px-2 text-[11px] font-mono text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1.5">
              <Clock className={`w-3 h-3 ${isExpired ? "text-rose-500" : "text-amber-500"}`} />
              <span className={isExpired ? "text-rose-400 font-semibold" : ""}>
                {isExpired
                  ? "Expired"
                  : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")} remaining`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-500 font-medium">Ed25519</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={fetchSession}
                disabled={isGenerating}
                title="Regenerate Pairing Token"
              >
                <RotateCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Endpoint Details & Copy Button */}
          {endpoints.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-[var(--border)] w-full space-y-1.5 px-0.5">
              <div className="flex items-center justify-between text-[10px] font-medium text-[var(--muted-foreground)]">
                <span>Available Network Endpoints</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPayload}
                  className="h-5 px-1.5 text-[9px] shrink-0 flex items-center gap-1 font-mono"
                  title="Copy full pairing JSON payload"
                >
                  {copied ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[10px] pr-0.5">
                {endpoints.map((ep) => {
                  const badge = getEndpointBadge(ep);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={ep}
                      className="flex items-center justify-between gap-1.5 p-1 px-1.5 rounded bg-[var(--background)] border border-[var(--border)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="truncate" title={ep}>
                          {ep}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded border font-medium shrink-0 font-sans ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Currently Paired Devices List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            <span>Connected Devices ({devices.length})</span>
          </div>

          {devices.length === 0 ? (
            <div className="p-3 text-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] italic font-mono">
              No devices paired yet. Scan the QR code above from the iOS app.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    {dev.platform === "ios" ? (
                      <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Laptop className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    )}
                    <div className="min-w-0 truncate">
                      <div className="font-medium text-[var(--foreground)] truncate flex items-center gap-1.5">
                        <span className="truncate">{dev.name}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] uppercase font-mono">
                          ({dev.lastTransport})
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                        Key: {dev.publicKey.slice(0, 8)}...{dev.publicKey.slice(-6)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {dev.revoked ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <>
                        <Badge variant="success">Active</Badge>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRevoke(dev.id)}
                          disabled={revokingId === dev.id}
                          className="hover:text-rose-400 hover:bg-rose-950/20"
                          title="Revoke device access"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
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
