use std::process::Command;
use tracing::debug;

#[derive(Debug, Clone, Default)]
pub struct TailscaleInfo {
    pub ipv4: Option<String>,
    pub magic_dns: Option<String>,
}

pub fn resolve_tailscale_info() -> Option<TailscaleInfo> {
    // 1. Try finding tailscale binary in standard locations
    let candidates = [
        "tailscale",
        "/usr/local/bin/tailscale",
        "/opt/homebrew/bin/tailscale",
        "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    ];

    for bin in &candidates {
        if let Ok(output) = Command::new(bin).args(["status", "--json"]).output() {
            if output.status.success() {
                if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    let mut info = TailscaleInfo::default();

                    // MagicDNS from Self.DNSName
                    if let Some(dns) = val
                        .get("Self")
                        .and_then(|s| s.get("DNSName"))
                        .and_then(|d| d.as_str())
                    {
                        let trimmed = dns.trim_end_matches('.').to_string();
                        if !trimmed.is_empty() {
                            info.magic_dns = Some(trimmed);
                        }
                    }

                    // IPv4 from Self.TailscaleIPs or root TailscaleIPs
                    let ips = val
                        .get("Self")
                        .and_then(|s| s.get("TailscaleIPs"))
                        .or_else(|| val.get("TailscaleIPs"))
                        .and_then(|i| i.as_array());

                    if let Some(arr) = ips {
                        for ip_val in arr {
                            if let Some(ip_str) = ip_val.as_str() {
                                if is_tailscale_ipv4(ip_str) {
                                    info.ipv4 = Some(ip_str.to_string());
                                    break;
                                }
                            }
                        }
                    }

                    if info.ipv4.is_some() || info.magic_dns.is_some() {
                        debug!("Tailscale resolved via '{} status --json': {:?}", bin, info);
                        return Some(info);
                    }
                }
            }
        }

        // Fallback to `tailscale ip -4`
        if let Ok(output) = Command::new(bin).args(["ip", "-4"]).output() {
            if output.status.success() {
                let ip_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if is_tailscale_ipv4(&ip_str) {
                    debug!("Tailscale resolved via '{} ip -4': {}", bin, ip_str);
                    return Some(TailscaleInfo {
                        ipv4: Some(ip_str),
                        magic_dns: None,
                    });
                }
            }
        }
    }

    // 2. Fallback: inspect network interfaces using `ifconfig` (macOS / Linux)
    if let Ok(output) = Command::new("ifconfig").output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for word in text.split_whitespace() {
                let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.');
                if is_tailscale_ipv4(cleaned) {
                    debug!("Tailscale resolved via ifconfig scan: {}", cleaned);
                    return Some(TailscaleInfo {
                        ipv4: Some(cleaned.to_string()),
                        magic_dns: None,
                    });
                }
            }
        }
    }

    None
}

fn is_tailscale_ipv4(ip_str: &str) -> bool {
    let parts: Vec<&str> = ip_str.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    // Tailscale IPv4 CGNAT range: 100.64.0.0/10 (100.64.0.0 to 100.127.255.255)
    if parts[0] != "100" {
        return false;
    }
    if let Ok(second) = parts[1].parse::<u8>() {
        (64..=127).contains(&second)
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_tailscale_ipv4() {
        assert!(is_tailscale_ipv4("100.95.140.26"));
        assert!(is_tailscale_ipv4("100.64.0.1"));
        assert!(is_tailscale_ipv4("100.127.255.254"));
        assert!(!is_tailscale_ipv4("100.63.255.255"));
        assert!(!is_tailscale_ipv4("100.128.0.0"));
        assert!(!is_tailscale_ipv4("192.168.1.1"));
        assert!(!is_tailscale_ipv4("127.0.0.1"));
    }
}
