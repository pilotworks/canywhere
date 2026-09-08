#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "7890".to_string())
        .parse::<u16>()?;

    canywhere_server::start_daemon(port).await
}
