import Foundation
import SwiftUI

/// Detailed failure diagnostic for a single network endpoint attempt
struct EndpointFailureDetail: Identifiable, Sendable {
    let endpoint: String
    let kind: EndpointKind
    let rawError: String
    let errorCode: Int
    let domain: String
    let friendlyReason: String
    let suggestion: String
    let isTerminalTokenError: Bool

    var id: String { endpoint }

    var displayAddress: String {
        EndpointInfo(rawUrl: endpoint).displayAddress
    }
}

/// Comprehensive report when pairing fails across attempted endpoints
struct PairingDiagnosticReport: LocalizedError, Sendable {
    let hostName: String
    let token: String
    let failures: [EndpointFailureDetail]

    var isTokenExpired: Bool {
        failures.contains { $0.isTerminalTokenError }
    }

    var errorDescription: String? {
        if isTokenExpired {
            return "QR code has expired or has already been used. Please generate a new QR code on your Mac."
        }

        if failures.isEmpty {
            return "Unable to connect to host server \(hostName)."
        }

        if failures.count == 1, let single = failures.first {
            return "\(single.friendlyReason) (\(single.displayAddress))"
        }

        return "Unable to connect to \(failures.count) network endpoints for \(hostName)."
    }

    var detailedSummary: String {
        var lines: [String] = []
        if isTokenExpired {
            lines.append("⚠️ Pairing token is invalid or has expired (5-minute limit).")
            lines.append("👉 Solution: Click 'Pair New Device' on your Mac to show a fresh QR code.")
            return lines.joined(separator: "\n")
        }

        lines.append("Connection failure details:")
        for failure in failures {
            lines.append("• [\(failure.kind.rawValue)] \(failure.displayAddress): \(failure.friendlyReason)")
            if !failure.suggestion.isEmpty {
                lines.append("  ↳ \(failure.suggestion)")
            }
        }
        return lines.joined(separator: "\n")
    }
}

/// Utility for analyzing socket, HTTP, POSIX, and RPC errors into actionable user diagnostics
enum ConnectionDiagnostics {

    static func analyze(endpoint: String, error: Error) -> EndpointFailureDetail {
        let nsError = error as NSError
        let domain = nsError.domain
        let code = nsError.code
        let rawMessage = error.localizedDescription
        let lowerMsg = rawMessage.lowercased()

        let info = EndpointInfo(rawUrl: endpoint)
        let kind = info.kind

        // 1. Terminal Pairing Token Errors from Host Server RPC
        if lowerMsg.contains("invalid or expired pairing token") ||
           lowerMsg.contains("expired pairing token") ||
           lowerMsg.contains("missing token") ||
           (domain == "HostServerRPC" && lowerMsg.contains("token")) {
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "QR code has expired (after 5 minutes) or was already paired.",
                suggestion: "Generate a new QR code on your Mac by clicking 'Pair New Device'.",
                isTerminalTokenError: true
            )
        }

        // 2. Physical iOS device connecting to Localhost (127.0.0.1)
        #if !targetEnvironment(simulator)
        if info.isLocalhost {
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: "Cannot connect to 127.0.0.1 on physical device",
                errorCode: 61,
                domain: "NSPOSIXErrorDomain",
                friendlyReason: "127.0.0.1 refers to this iPhone itself, not your Mac.",
                suggestion: "Deselect Localhost and select your Mac's Wi-Fi (LAN) or Tailscale IP.",
                isTerminalTokenError: false
            )
        }
        #endif

        // 3. POSIX & CFNetwork Error Classifications
        // Code 61: ECONNREFUSED ("Connection refused")
        if code == 61 || lowerMsg.contains("connection refused") {
            let suggestion: String
            if kind == .tailscale {
                suggestion = "Verify that Canywhere is running on your Mac and Tailscale is connected."
            } else {
                suggestion = "Ensure Canywhere is running on your Mac and Firewall is not blocking port 7890."
            }
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "Connection refused on port 7890.",
                suggestion: suggestion,
                isTerminalTokenError: false
            )
        }

        // Code 60: ETIMEDOUT ("Operation timed out") or URL error timedOut (-1001)
        if code == 60 || code == -1001 || lowerMsg.contains("timed out") || lowerMsg.contains("timeout") {
            let suggestion: String
            if kind == .tailscale {
                suggestion = "Ensure Tailscale is connected on both iPhone and Mac, and check network access."
            } else {
                suggestion = "Ensure iPhone and Mac are on the same Wi-Fi. Disable router AP Isolation if active."
            }
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "Connection timed out waiting for response.",
                suggestion: suggestion,
                isTerminalTokenError: false
            )
        }

        // Code 50/51/8: ENETDOWN, ENETUNREACH, EHOSTUNREACH ("No route to host") or URL error cannotConnectToHost (-1004)
        if code == 50 || code == 51 || code == 8 || code == -1004 || lowerMsg.contains("no route to host") || lowerMsg.contains("network is unreachable") {
            let suggestion: String
            if kind == .tailscale {
                suggestion = "Open the Tailscale app on iPhone and verify Connected status."
            } else {
                suggestion = "Ensure iPhone Wi-Fi is active and Mac IP address has not changed."
            }
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "No route to host IP address.",
                suggestion: suggestion,
                isTerminalTokenError: false
            )
        }

        // URL error notConnectedToInternet (-1009)
        if code == -1009 || lowerMsg.contains("not connected to internet") {
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "iPhone is not connected to internet or Wi-Fi.",
                suggestion: "Turn on Wi-Fi or cellular data on your iPhone.",
                isTerminalTokenError: false
            )
        }

        // Local Network Permission block (iOS 14+)
        if code == 53 || code == 65 || lowerMsg.contains("local network") {
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "iOS blocked local network access.",
                suggestion: "Go to iPhone Settings > Canywhere > Turn on 'Local Network'.",
                isTerminalTokenError: false
            )
        }

        // Tailscale specific failure
        if kind == .tailscale {
            return EndpointFailureDetail(
                endpoint: endpoint,
                kind: kind,
                rawError: rawMessage,
                errorCode: code,
                domain: domain,
                friendlyReason: "Unable to connect via Tailscale VPN.",
                suggestion: "Ensure both iPhone and Mac are logged into the same Tailscale tailnet and VPN is active.",
                isTerminalTokenError: false
            )
        }

        // Generic fallback with raw error details
        return EndpointFailureDetail(
            endpoint: endpoint,
            kind: kind,
            rawError: rawMessage,
            errorCode: code,
            domain: domain,
            friendlyReason: rawMessage.isEmpty ? "Unknown connection error" : rawMessage,
            suggestion: "Check if Canywhere is running on your Mac and try scanning a new QR code.",
            isTerminalTokenError: false
        )
    }
}
