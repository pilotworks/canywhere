use anyhow::{bail, Result};
use ed25519_dalek::{Signature, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use std::sync::Arc;

use canywhere_protocol::models::{Device, DevicePlatform, DeviceTransport, PairingQrPayload};
use crate::db::repositories::RepositoryManager;

pub struct PairingSecurityManager {
    repo: Arc<RepositoryManager>,
    _signing_key: SigningKey,
    verifying_key_hex: String,
    port: u16,
}

impl PairingSecurityManager {
    pub fn new(repo: Arc<RepositoryManager>, port: u16) -> Self {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key_hex = hex::encode(signing_key.verifying_key().to_bytes());

        Self {
            repo,
            _signing_key: signing_key,
            verifying_key_hex,
            port,
        }
    }

    pub fn host_public_key(&self) -> &str {
        &self.verifying_key_hex
    }

    pub fn create_pairing_session(&self, host_name: &str) -> Result<PairingQrPayload> {
        let token = nanoid::nanoid!(32);
        let secret = nanoid::nanoid!(32);
        let expires_at = self.repo.create_pairing_session(&token, &secret, 300_000)?;

        let mut endpoints = vec![format!("ws://127.0.0.1:{}/rpc", self.port)];

        // Probe local network IP if available
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    let ip = local_addr.ip();
                    if !ip.is_loopback() {
                        endpoints.insert(0, format!("ws://{}:{}/rpc", ip, self.port));
                    }
                }
            }
        }

        Ok(PairingQrPayload {
            host_id: nanoid::nanoid!(16),
            host_name: host_name.to_string(),
            token,
            endpoints,
            host_public_key: self.verifying_key_hex.clone(),
            expires_at,
        })
    }

    pub fn verify_and_register(
        &self,
        token: &str,
        client_pubkey_hex: &str,
        signature_hex: &str,
        device_name: &str,
        platform: DevicePlatform,
    ) -> Result<Device> {
        let valid_token = self.repo.consume_pairing_token(token)?;
        if !valid_token {
            bail!("Invalid or expired pairing token");
        }

        // Verify ed25519 signature
        let pubkey_bytes = hex::decode(client_pubkey_hex)?;
        let verifying_key = VerifyingKey::from_bytes(
            pubkey_bytes.as_slice().try_into().map_err(|_| anyhow::anyhow!("Invalid pubkey length"))?,
        )?;

        let sig_bytes = hex::decode(signature_hex)?;
        let signature = Signature::from_bytes(
            sig_bytes.as_slice().try_into().map_err(|_| anyhow::anyhow!("Invalid signature length"))?,
        );

        verifying_key.verify(token.as_bytes(), &signature)?;

        let dev = Device {
            id: nanoid::nanoid!(16),
            name: device_name.to_string(),
            platform,
            public_key: client_pubkey_hex.to_string(),
            paired_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
            last_seen_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_millis() as i64,
            last_transport: DeviceTransport::Lan,
            revoked: false,
        };

        self.repo.register_device(dev)
    }
}
