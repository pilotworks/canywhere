import Foundation
import Network

struct DiscoveredHost: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let endpoint: String
    let lastDiscovered: Date
}

@MainActor
final class BonjourBrowser: ObservableObject {
    static let shared = BonjourBrowser()

    @Published private(set) var discoveredHosts: [DiscoveredHost] = []
    @Published private(set) var isSearching: Bool = false

    private var browser: NWBrowser?
    private let queue = DispatchQueue(label: "com.canywhere.bonjour", qos: .utility)

    private init() {}

    func startDiscovery() {
        guard !isSearching else { return }
        isSearching = true

        let parameters = NWParameters()
        parameters.includePeerToPeer = true

        let descriptor = NWBrowser.Descriptor.bonjour(type: "_canywhere._tcp", domain: "local.")
        let nwBrowser = NWBrowser(for: descriptor, using: parameters)
        self.browser = nwBrowser

        nwBrowser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                switch state {
                case .ready:
                    self?.isSearching = true
                case .failed(let error):
                    print("⚠️ [Bonjour] Browser failed: \(error)")
                    self?.isSearching = false
                case .cancelled:
                    self?.isSearching = false
                default:
                    break
                }
            }
        }

        nwBrowser.browseResultsChangedHandler = { [weak self] results, changes in
            Task { @MainActor in
                var hosts: [DiscoveredHost] = []
                for result in results {
                    if case let .service(name, _, _, _) = result.endpoint {
                        let safeHost = name
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                            .addingPercentEncoding(withAllowedCharacters: .urlHostAllowed) ?? name
                        let wsEndpoint = "ws://\(safeHost).local:7890/rpc"
                        hosts.append(DiscoveredHost(
                            id: name,
                            name: name,
                            endpoint: wsEndpoint,
                            lastDiscovered: Date()
                        ))
                    }
                }
                self?.discoveredHosts = hosts
            }
        }

        nwBrowser.start(queue: queue)
    }

    func stopDiscovery() {
        browser?.cancel()
        browser = nil
        isSearching = false
    }
}
