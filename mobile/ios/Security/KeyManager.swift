import Foundation
import CryptoKit
import Security

final class KeyManager: @unchecked Sendable {
    static let shared = KeyManager()

    private let tag = "com.canywhere.mobile.device-key"

    private init() {}

    /// Retrieves or generates the device's persistent Ed25519 private key in the Keychain
    func getOrCreatePrivateKey() throws -> Curve25519.Signing.PrivateKey {
        if let existingKey = try loadKeyFromKeychain() {
            return existingKey
        }

        let newKey = Curve25519.Signing.PrivateKey()
        try saveKeyToKeychain(newKey)
        return newKey
    }

    /// Returns the Ed25519 key in lowercase hex string
    func publicKeyHex() throws -> String {
        let privateKey = try getOrCreatePrivateKey()
        let rawBytes = privateKey.publicKey.rawRepresentation
        return rawBytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Signs an ASCII/UTF-8 challenge token and returns the 64-byte Ed25519 signature in lowercase hex
    func signToken(_ token: String) throws -> String {
        let privateKey = try getOrCreatePrivateKey()
        guard let tokenData = token.data(using: .utf8) else {
            throw NSError(domain: "KeyManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid token encoding"])
        }
        let signature = try privateKey.signature(for: tokenData)
        return signature.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Keychain Operations

    private func loadKeyFromKeychain() throws -> Curve25519.Signing.PrivateKey? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeEC,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess, let keyData = item as? Data else {
            throw NSError(domain: "KeyManager", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain read error: \(status)"])
        }

        return try Curve25519.Signing.PrivateKey(rawRepresentation: keyData)
    }

    private func saveKeyToKeychain(_ key: Curve25519.Signing.PrivateKey) throws {
        let keyData = key.rawRepresentation
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeEC,
            kSecValueData as String: keyData,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "KeyManager", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain write error: \(status)"])
        }
    }
}
