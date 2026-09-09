import Foundation
import SwiftUI

enum EndpointKind: String, Sendable, CaseIterable {
    case tailscale = "Tailscale"
    case lan = "LAN"
    case localhost = "Localhost"
    case custom = "Custom"

    var iconName: String {
        switch self {
        case .tailscale: return "shield.checkered"
        case .lan: return "wifi"
        case .localhost: return "laptopcomputer"
        case .custom: return "network"
        }
    }

    var color: Color {
        switch self {
        case .tailscale: return .cyan
        case .lan: return .green
        case .localhost: return .secondary
        case .custom: return .indigo
        }
    }

    var backgroundOpacity: Double {
        switch self {
        case .tailscale: return 0.15
        case .lan: return 0.15
        case .localhost: return 0.10
        case .custom: return 0.15
        }
    }
}

struct EndpointInfo: Identifiable, Hashable, Sendable {
    let rawUrl: String

    var id: String { rawUrl }

    var kind: EndpointKind {
        EndpointInfo.classify(rawUrl)
    }

    var isLocalhost: Bool {
        kind == .localhost
    }

    var isRecommendedDefault: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return kind != .localhost
        #endif
    }

    var displayAddress: String {
        var str = rawUrl
        if str.hasPrefix("ws://") {
            str = String(str.dropFirst(5))
        } else if str.hasPrefix("wss://") {
            str = String(str.dropFirst(6))
        }
        if str.hasSuffix("/rpc") {
            str = String(str.dropLast(4))
        }
        return str
    }

    static func classify(_ endpoint: String) -> EndpointKind {
        let lower = endpoint.lowercased()
        if lower.contains(".ts.net") || matchesTailscaleCGNAT(lower) {
            return .tailscale
        }
        if lower.contains("127.0.0.1") || lower.contains("localhost") {
            return .localhost
        }
        if lower.contains("192.168.") || lower.contains("10.") || lower.contains(".local") || matchesPrivate172(lower) {
            return .lan
        }
        return .custom
    }

    var healthCheckUrl: URL? {
        var str = rawUrl
        if str.hasPrefix("ws://") {
            str = "http://" + str.dropFirst(5)
        } else if str.hasPrefix("wss://") {
            str = "https://" + str.dropFirst(6)
        }
        if str.hasSuffix("/rpc") {
            str = String(str.dropLast(4)) + "/health"
        } else if str.hasSuffix("/") {
            str = str + "health"
        } else {
            str = str + "/health"
        }
        return URL(string: str)
    }

    private static func matchesTailscaleCGNAT(_ str: String) -> Bool {
        // CGNAT range 100.64.0.0 to 100.127.255.255
        let pattern = #"100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\."#
        return str.range(of: pattern, options: .regularExpression) != nil
    }

    private static func matchesPrivate172(_ str: String) -> Bool {
        let pattern = #"172\.(1[6-9]|2[0-9]|3[0-1])\."#
        return str.range(of: pattern, options: .regularExpression) != nil
    }
}

// MARK: - Endpoint Health Status & Checker

enum EndpointHealth: Equatable, Sendable {
    case checking
    case online(latencyMs: Int)
    case offline(reason: String)

    var isLive: Bool {
        if case .online = self { return true }
        return false
    }

    var latencyMs: Int? {
        if case .online(let ms) = self { return ms }
        return nil
    }
}

actor EndpointHealthChecker {
    static let shared = EndpointHealthChecker()

    func check(endpoint: String, timeoutSeconds: TimeInterval = 2.5) async -> EndpointHealth {
        let info = EndpointInfo(rawUrl: endpoint)
        guard let url = info.healthCheckUrl else {
            return .offline(reason: "Invalid URL")
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = timeoutSeconds
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData

        let start = DispatchTime.now()
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                return .offline(reason: "Server error")
            }
            let end = DispatchTime.now()
            let nanoTime = end.uptimeNanoseconds - start.uptimeNanoseconds
            let latencyMs = max(1, Int(nanoTime / 1_000_000))
            return .online(latencyMs: latencyMs)
        } catch {
            return .offline(reason: "Unreachable")
        }
    }

    func checkAll(endpoints: [String], timeoutSeconds: TimeInterval = 2.5) async -> [String: EndpointHealth] {
        await withTaskGroup(of: (String, EndpointHealth).self) { group in
            for ep in endpoints {
                group.addTask {
                    let health = await self.check(endpoint: ep, timeoutSeconds: timeoutSeconds)
                    return (ep, health)
                }
            }
            var results: [String: EndpointHealth] = [:]
            for await (ep, health) in group {
                results[ep] = health
            }
            return results
        }
    }
}
